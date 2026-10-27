"""Offline HTTP/OAuth boundary checks; these do not establish real Google access."""
import http.client
import tempfile
import threading
import time
import unittest
from pathlib import Path

from interview.onboarding import ConnectionServer


class FakeFlow:
    def __init__(self):
        self.codes = []
        self.authorization_calls = 0

    def authorization_url(self, **kwargs):
        self.authorization_calls += 1
        return "https://accounts.google.com/o/oauth2/auth?state=fixture-state", "fixture-state"

    def fetch_token(self, **kwargs):
        self.codes.append(kwargs["code"])


class ConnectionTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.flow = FakeFlow()
        self.calls = []
        def finish(flow, root):
            self.calls.append(flow)
            return {"connected": True, "account": "new@example.invalid"}
        self.server = ConnectionServer(("127.0.0.1", 0), Path(self.temp.name), flow_factory=lambda: self.flow, finish=finish)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        result, page = self.request("GET", "/")
        self.cookie = result.getheader("Set-Cookie").split(";")[0]
        self.assertEqual(result.getheader("Referrer-Policy"), "same-origin")
        self.assertIn("form-action 'self' https://accounts.google.com", result.getheader("Content-Security-Policy"))
        self.assertEqual(result.status, 303)
        self.assertTrue(result.getheader("Location").startswith("https://accounts.google.com/"))
        self.csrf = self.server.sessions[self.cookie.split("=", 1)[1]]["csrf"]

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        self.temp.cleanup()

    def request(self, method, path, body=None, headers=None):
        connection = http.client.HTTPConnection("127.0.0.1", self.server.server_port, timeout=3)
        connection.request(method, path, body=body, headers=headers or {})
        response = connection.getresponse()
        text = response.read().decode()
        connection.close()
        return response, text

    def connect(self):
        return self.request("POST", "/connect", "csrf=" + self.csrf,
                            {"Cookie": self.cookie, "Origin": self.server.origin})

    def callback(self, query):
        return self.request("GET", "/oauth/callback?" + query, headers={"Cookie": self.cookie})

    def test_real_redirect_shape_and_one_use_callback(self):
        response, _ = self.connect()
        self.assertEqual(response.status, 303)
        self.assertTrue(response.getheader("Location").startswith("https://accounts.google.com/"))
        response, _ = self.callback("state=fixture-state&code=TEST_CODE")
        self.assertEqual(response.status, 303)
        self.assertEqual(self.flow.codes, ["TEST_CODE"])
        self.assertEqual(len(self.calls), 1)
        self.assertEqual(self.callback("state=fixture-state&code=TEST_CODE")[0].status, 400)
        _, page = self.request("GET", "/", headers={"Cookie": self.cookie})
        self.assertIn("new@example.invalid", page)
        self.assertNotIn("TEST_CODE", page)
        self.assertNotIn("<style>", page)
        self.assertNotIn("<form", page)

    def test_wrong_state_expired_and_different_browser_rejected(self):
        self.connect()
        self.assertEqual(self.callback("state=WRONG&code=secret")[0].status, 400)
        response, _ = self.request("GET", "/oauth/callback?state=fixture-state&code=secret")
        self.assertEqual(response.status, 400)
        session = next(iter(self.server.sessions.values()))
        session["pending"]["created"] = time.monotonic() - 601
        self.assertEqual(self.callback("state=fixture-state&code=secret")[0].status, 400)
        self.assertEqual(self.calls, [])

    def test_cancelled_authorization_is_safe_and_consumed(self):
        self.connect()
        self.assertEqual(self.callback("state=fixture-state&error=access_denied")[0].status, 303)
        self.assertEqual(self.calls, [])
        self.assertEqual(self.callback("state=fixture-state&code=secret")[0].status, 400)

    def test_csrf_origin_and_host_rejected(self):
        for origin, token in [("https://attacker.invalid", self.csrf), (self.server.origin, "wrong")]:
            response, _ = self.request("POST", "/connect", "csrf=" + token,
                                       {"Cookie": self.cookie, "Origin": origin})
            self.assertEqual(response.status, 403)
        response, _ = self.request("GET", "/", headers={"Host": "attacker.invalid"})
        self.assertEqual(response.status, 403)

    def test_rejected_post_bodies_deliver_403_without_starting_oauth(self):
        started = self.flow.authorization_calls
        for _ in range(8):
            response, body = self.request("POST", "/connect", "csrf=" + self.csrf,
                {"Cookie": self.cookie, "Origin": "https://attacker.invalid"})
            self.assertEqual(response.status, 403)
            self.assertIn("Invalid connection request", body)
        self.assertEqual(self.flow.authorization_calls, started)
        self.assertEqual(self.flow.codes, [])
        self.assertEqual(self.calls, [])

    def test_browser_sessions_do_not_inherit_other_account(self):
        self.connect()
        self.callback("state=fixture-state&code=test")
        response, page = self.request("GET", "/")
        self.assertNotIn("new@example.invalid", page)
        self.assertEqual(response.status, 303)
        self.assertTrue(response.getheader("Location").startswith("https://accounts.google.com/"))


if __name__ == "__main__":
    unittest.main()
