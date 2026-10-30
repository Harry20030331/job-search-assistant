"""Same-origin workbench OAuth sessions, callback isolation and safe session sign-out."""
import http.client
import json
import tempfile
import threading
import unittest
from pathlib import Path
from unittest.mock import Mock, patch
from types import SimpleNamespace

from interview.onboarding import ConnectionServer, ConnectionFailure, fetch_connection_token, verified_connection
from interview.google_adapter import SCOPES


class Flow:
    def __init__(self): self.codes = []
    def authorization_url(self, **kwargs): return "https://accounts.google.com/o/oauth2/auth?state=workbench-fixture", "workbench-fixture"
    def fetch_token(self, **kwargs): self.codes.append(kwargs["code"])


class WorkbenchOAuthTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        (self.root / "client.json").write_text("{}", encoding="utf-8")
        self.flow = Flow()
        self.server = ConnectionServer(("127.0.0.1", 0), self.root, public_origin="http://127.0.0.1:18767", prefix="/google", return_path="/settings/accounts",
            flow_factory=lambda: self.flow, finish=lambda flow, root: {"connected": True, "account": "selected@example.invalid"})
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True); self.thread.start()
        response, body = self.request("GET", "/google/status")
        self.cookie = response.getheader("Set-Cookie").split(";", 1)[0]
        self.csrf = json.loads(body)["csrf"]

    def tearDown(self):
        self.server.shutdown(); self.server.server_close(); self.thread.join(); self.temp.cleanup()

    def request(self, method, path, body=None, *, cookie=None, origin=None):
        headers = {"Host": "127.0.0.1:18767"}
        if cookie: headers["Cookie"] = cookie
        if origin: headers["Origin"] = origin
        connection = http.client.HTTPConnection("127.0.0.1", self.server.server_port, timeout=3)
        connection.request(method, path, body=body, headers=headers)
        response = connection.getresponse(); text = response.read().decode(); connection.close()
        return response, text

    def authorize(self):
        response, _ = self.request("GET", "/google/connect", cookie=self.cookie)
        self.assertEqual(response.status, 303)
        self.assertTrue(response.getheader("Location").startswith("https://accounts.google.com/"))
        return self.request("GET", "/google/callback?state=workbench-fixture&code=FIXTURE_CODE", cookie=self.cookie)

    def test_status_does_not_start_authorization_or_inherit_saved_accounts(self):
        (self.root / "users").mkdir()
        (self.root / "users/old-account.json").write_text('{"account":"other@example.invalid"}', encoding="utf-8")
        response, body = self.request("GET", "/google/status", cookie=self.cookie)
        self.assertEqual(response.status, 200)
        value = json.loads(body)
        self.assertFalse(value["connected"]); self.assertTrue(value["configured"])
        self.assertNotIn("other@example.invalid", body)
        self.assertEqual(self.server.sessions[self.cookie.split("=", 1)[1]].get("pending"), None)

    def test_verified_callback_returns_to_account_page_and_is_one_use(self):
        response, _ = self.authorize()
        self.assertEqual((response.status, response.getheader("Location")), (303, "/settings/accounts"))
        _, body = self.request("GET", "/google/status", cookie=self.cookie)
        self.assertEqual(json.loads(body)["account"], "selected@example.invalid")
        self.assertNotIn("FIXTURE_CODE", body)
        replay, _ = self.request("GET", "/google/callback?state=workbench-fixture&code=FIXTURE_CODE", cookie=self.cookie)
        self.assertEqual(replay.status, 400); self.assertEqual(self.flow.codes, ["FIXTURE_CODE"])
        _, other = self.request("GET", "/google/status")
        self.assertFalse(json.loads(other)["connected"])

    def test_session_signout_requires_origin_and_csrf_and_keeps_saved_grant(self):
        self.authorize()
        token = self.root / "token-fixture.json"; token.write_text('{"fixture":true}', encoding="utf-8")
        for origin, csrf in [("https://attacker.invalid", self.csrf), (self.server.origin, "wrong")]:
            response, _ = self.request("POST", "/google/sign-out", "csrf=" + csrf, cookie=self.cookie, origin=origin)
            self.assertEqual(response.status, 403)
        response, _ = self.request("POST", "/google/sign-out", "csrf=" + self.csrf, cookie=self.cookie, origin=self.server.origin)
        self.assertEqual(response.status, 303); self.assertIn("Max-Age=0", response.getheader("Set-Cookie"))
        self.assertEqual(token.read_text(), '{"fixture":true}')
        _, body = self.request("GET", "/google/status", cookie=self.cookie)
        self.assertFalse(json.loads(body)["connected"])

    def test_public_callback_uses_pkce_and_fixed_local_origin(self):
        installed = Mock()
        with patch("interview.onboarding.google_libraries", return_value=(None, None, None, None, installed, None)):
            self.server.make_flow()
        self.assertEqual(installed.from_client_secrets_file.call_args.kwargs["redirect_uri"], "http://127.0.0.1:18767/google/callback")
        self.assertTrue(installed.from_client_secrets_file.call_args.kwargs["autogenerate_code_verifier"])
        with self.assertRaises(ValueError):
            ConnectionServer(("127.0.0.1", 0), self.root, public_origin="https://attacker.invalid", prefix="/google")

    def test_non_google_authorization_destination_is_not_followed(self):
        self.flow.authorization_url = lambda **kwargs: ("https://attacker.invalid/authorize", "state")
        response, _ = self.request("GET", "/google/connect", cookie=self.cookie)
        self.assertEqual(response.getheader("Location"), "/settings/accounts")
        _, body = self.request("GET", "/google/status", cookie=self.cookie)
        self.assertIn("not configured", json.loads(body)["error"])
        self.assertEqual(self.flow.codes, [])

    def test_callback_failure_has_safe_stage_diagnostic_without_exception_secrets(self):
        self.server.finish = Mock(side_effect=RuntimeError("PRIVATE_TOKEN_AND_ACCOUNT_FROM_EXCEPTION"))
        response, _ = self.authorize()
        self.assertEqual(response.status, 303)
        _, body = self.request("GET", "/google/status", cookie=self.cookie)
        self.assertEqual(json.loads(body)["error_code"], "account_verification:authorization_failed")
        diagnostic = (self.root / "oauth-diagnostic.json").read_text(encoding="utf-8")
        self.assertNotIn("PRIVATE_TOKEN", body + diagnostic)
        self.assertNotIn("FIXTURE_CODE", body + diagnostic)


class ScopeCompatibilityTests(unittest.TestCase):
    def flow(self, scopes):
        flow = SimpleNamespace(oauth2session=SimpleNamespace(token={}))
        def exchange(**kwargs):
            warning = Warning("Fixture scope change")
            warning.token = {"access_token": "FIXTURE_ACCESS", "token_type": "Bearer", "expires_at": 9999999999,
                "scope": " ".join(scopes)}
            warning.old_scope, warning.new_scope = SCOPES, scopes
            raise warning
        flow.fetch_token = Mock(side_effect=exchange)
        return flow

    def test_scope_superset_warning_preserves_all_granted_scopes(self):
        flow = self.flow(SCOPES + ["openid"])
        fetch_connection_token(flow, "FIXTURE_CODE")
        self.assertEqual(set(flow.oauth2session.token["scope"]), set(SCOPES + ["openid"]))
        flow.fetch_token.assert_called_once_with(code="FIXTURE_CODE", timeout=30)

    def test_partial_or_empty_permissions_are_not_accepted(self):
        flow = self.flow(SCOPES[:1])
        with self.assertRaisesRegex(ConnectionFailure, "missing_permissions"):
            fetch_connection_token(flow, "FIXTURE_CODE")
        self.assertEqual(flow.oauth2session.token, {})
        flow = SimpleNamespace(credentials=SimpleNamespace(granted_scopes=[], scopes=SCOPES))
        with self.assertRaisesRegex(ConnectionFailure, "missing_permissions"):
            verified_connection(flow, Path("unused"))


if __name__ == "__main__": unittest.main()
