"""Local, host-operated Google account connection demo; separate from eval runs."""
from __future__ import annotations

import argparse
import hashlib
import html
import json
import secrets
import sys
import threading
import time
from datetime import datetime, timezone
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

from interview.google_adapter import SCOPES, GoogleAccessError, execute_request, google_libraries, save_token
from interview.storage import write_json


class ConnectionFailure(GoogleAccessError):
    def __init__(self, code):
        self.code = code
        super().__init__(code)


def scope_set(value):
    return set(value.split() if isinstance(value, str) else value or [])


def fetch_connection_token(flow, code):
    """Accept extra previously granted scopes, but never accept missing required access."""
    try:
        flow.fetch_token(code=code, timeout=30)
    except Warning as warning:
        # oauthlib raises after parsing a valid token if Google's returned scopes
        # differ, including a superset from an earlier grant. Do not relax scope
        # validation globally or exchange the one-use authorization code twice.
        token = getattr(warning, "token", None)
        granted = scope_set(getattr(warning, "new_scope", None))
        if not isinstance(token, dict) or not token.get("access_token") or not hasattr(warning, "old_scope"):
            raise
        if not set(SCOPES).issubset(granted):
            raise ConnectionFailure("missing_permissions") from None
        restored = dict(token)
        restored["scope"] = sorted(granted)
        flow.oauth2session.token = restored


def failure_diagnostic(error, stage):
    code = getattr(error, "code", None) if isinstance(error, ConnectionFailure) else None
    oauth_error = getattr(error, "error", None)
    if code is None:
        if oauth_error in {"invalid_grant", "invalid_client", "unauthorized_client", "access_denied", "invalid_scope"}:
            code = oauth_error
        elif isinstance(error, OSError) and isinstance(error, (PermissionError, FileNotFoundError)):
            code = "local_storage_error"
        elif getattr(error, "status", None) in {401, 403, 404, 429, 500, 502, 503}:
            code = "google_api_" + str(error.status)
        elif type(error).__name__ in {"SSLError", "SSLCertVerificationError", "SSLHandshakeError"}:
            code = "tls_error"
        elif type(error).__name__ in {"Timeout", "ConnectTimeout", "ReadTimeout", "TimeoutError", "ConnectionError", "ServerNotFoundError", "TransportError", "ProxiesUnavailableError"}:
            code = "network_error"
        else:
            code = "authorization_failed"
    messages = {
        "missing_permissions": "Google did not grant both required permissions. Reconnect and select Gmail read-only and Google Calendar event access on the consent page.",
        "cancelled": "Google authorization was cancelled. Reconnect when you are ready.",
        "invalid_grant": "Google rejected the authorization code. Start a fresh connection from this page; old callback links cannot be reused.",
        "invalid_client": "Google rejected this installation's OAuth client. The developer needs to repair the client configuration.",
        "unauthorized_client": "This OAuth client is not permitted to complete the connection. The developer needs to check its configuration.",
        "access_denied": "Google denied access. Check the selected account and requested permissions before reconnecting.",
        "invalid_scope": "Google rejected a requested permission. The developer needs to check this installation's scope configuration.",
        "google_api_403": "Google sign-in completed, but Gmail account verification was denied (HTTP 403). The developer needs to check Gmail API access and granted permissions.",
        "google_api_401": "Google sign-in completed, but the issued credentials could not verify Gmail access (HTTP 401).",
        "local_storage_error": "Google authorization could not be saved locally. The developer needs to repair the local credential directory.",
        "tls_error": "A secure connection to Google could not be verified. The developer needs to check the local certificate or proxy configuration.",
        "network_error": "The application could not reach Google's verification service. The developer needs to check its network connection.",
    }
    message = messages.get(code, "Google authorization could not be completed. The local diagnostic code is " + stage + ":" + code + ".")
    return {"stage": stage, "code": code, "message": message}


def verified_connection(flow, root):
    credentials = flow.credentials
    granted = credentials.granted_scopes if credentials.granted_scopes is not None else credentials.scopes
    if not set(SCOPES).issubset(scope_set(granted)):
        raise ConnectionFailure("missing_permissions")
    httplib2, _, _, AuthorizedHttp, _, build = google_libraries()
    transport = AuthorizedHttp(credentials, http=httplib2.Http(timeout=30))
    gmail = build("gmail", "v1", http=transport, cache_discovery=False)
    email = execute_request(gmail.users().getProfile(userId="me")).get("emailAddress", "").strip().casefold()
    if not email or "@" not in email:
        raise GoogleAccessError("Google did not return an account identity")
    key = hashlib.sha256(email.encode()).hexdigest()
    directory = root / "users" / key
    save_token(directory / "token.json", credentials.to_json())
    metadata = {"version": 1, "account": email, "user_key": key,
                "connected_at": datetime.now(timezone.utc).isoformat(),
                "granted_scopes": sorted(scope_set(granted)),
                "calendar_selected": False}
    write_json(directory / "connection.json", metadata)
    return {"account": email, "connected": True}


class ConnectionServer(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self, address, root, *, flow_factory=None, finish=None, public_origin=None, prefix="", return_path="/"):
        super().__init__(address, ConnectionHandler)
        self.root = Path(root).resolve()
        self.origin = public_origin or f"http://127.0.0.1:{self.server_port}"
        parsed = urlsplit(self.origin)
        if (parsed.scheme != "http" or parsed.hostname not in {"127.0.0.1", "localhost"} or not parsed.port or
                parsed.path or parsed.query or parsed.fragment or parsed.username or prefix not in {"", "/google"} or
                return_path not in {"/", "/settings/accounts"}):
            self.server_close()
            raise ValueError("OAuth public origin and return path must be fixed local workbench routes")
        self.prefix = prefix
        self.home_path = prefix + "/connect" if prefix else "/"
        self.callback_path = prefix + "/callback" if prefix else "/oauth/callback"
        self.connect_path = prefix + "/connect"
        self.return_path = return_path
        self.cookie_name = "workbench_google_session" if prefix else "interview_session"
        self.sessions = {}
        self.lock = threading.Lock()
        self.flow_factory = flow_factory or self.make_flow
        self.finish = finish or verified_connection

    def make_flow(self):
        _, _, _, _, InstalledAppFlow, _ = google_libraries()
        return InstalledAppFlow.from_client_secrets_file(
            str(self.root / "client.json"), SCOPES, autogenerate_code_verifier=True,
            redirect_uri=self.origin + self.callback_path)


class ConnectionHandler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        # Callback URLs contain OAuth codes; never log request paths or queries.
        pass

    def respond(self, status, body="", *, headers=None):
        data = body.encode("utf-8")
        self.send_response(status)
        for key, value in {"Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store",
                           "Referrer-Policy": "same-origin", "X-Content-Type-Options": "nosniff",
                           "Content-Security-Policy": "default-src 'none'; form-action 'self' https://accounts.google.com; frame-ancestors 'none'",
                           **(headers or {})}.items():
            self.send_header(key, value)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def session(self):
        if self.headers.get("Host") != urlsplit(self.server.origin).netloc:
            self.respond(403, "Invalid local host")
            return None, None
        cookie = SimpleCookie()
        try:
            cookie.load(self.headers.get("Cookie", ""))
        except Exception:
            self.respond(400, "Invalid browser session")
            return None, None
        sid = cookie.get(self.server.cookie_name)
        key = sid.value if sid else ""
        return key, self.server.sessions.get(key)

    def do_GET(self):
        sid, session = self.session()
        if sid is None:
            return
        path = urlsplit(self.path).path
        if path == self.server.home_path or (self.server.prefix and path == self.server.prefix + "/status"):
            headers = {}
            if session is None:
                sid = secrets.token_urlsafe(32)
                session = {"csrf": secrets.token_urlsafe(32)}
                self.server.sessions[sid] = session
                headers["Set-Cookie"] = f"{self.server.cookie_name}={sid}; HttpOnly; SameSite=Lax; Path=/"
            if self.server.prefix and path.endswith("/status"):
                connection = session.get("connection", {})
                self.respond(200, json.dumps({"connected": bool(connection.get("connected")), "account": connection.get("account"),
                    "configured": (self.server.root / "client.json").is_file(), "csrf": session["csrf"], "error": session.get("error"), "error_code": session.get("error_code"),
                    "gmail": "read_only", "calendar": "owned_events", "calendar_selected": False}),
                    headers={**headers, "Content-Type": "application/json; charset=utf-8"})
                return
            if self.server.prefix:
                self.begin_authorization(session, headers)
                return
            account = session.get("connection", {}).get("account")
            if account:
                self.respond(200, f"<!doctype html><html lang='en'><meta charset='utf-8'><title>Connected</title>Connected to Google: {html.escape(account)}. You can close this window.</html>", headers=headers)
            elif session.get("error"):
                self.respond(200, "<!doctype html><html lang='en'><meta charset='utf-8'><title>Connection incomplete</title>" + html.escape(session["error"]) + "</html>", headers=headers)
            else:
                self.begin_authorization(session, headers)
        elif path == self.server.callback_path:
            query = parse_qs(urlsplit(self.path).query)
            pending = session.get("pending") if session else None
            state = query.get("state", [""])
            with self.server.lock:
                valid = (pending and session.get("pending") is pending and len(state) == 1 and secrets.compare_digest(state[0], pending["state"])
                         and time.monotonic() - pending["created"] < 600)
                if valid:
                    session.pop("pending")  # Claim once, before any network call.
            if not valid:
                self.respond(400, "Authorization expired or did not match this browser. Return to the connection page.")
                return
            stage = "authorization_response"
            try:
                code = query.get("code", [])
                if "error" in query or len(code) != 1 or not code[0]:
                    raise ConnectionFailure("cancelled")
                stage = "token_exchange"
                fetch_connection_token(pending["flow"], code[0])
                stage = "account_verification"
                session["connection"] = self.server.finish(pending["flow"], self.server.root)
                session.pop("error", None)
                session.pop("error_code", None)
            except Exception as error:
                diagnostic = failure_diagnostic(error, stage)
                session["error"] = diagnostic["message"]
                session["error_code"] = diagnostic["stage"] + ":" + diagnostic["code"]
                # Fixed categories only: never serialize exception text, token,
                # authorization code, callback URL, headers or account identity.
                try:
                    write_json(self.server.root / "oauth-diagnostic.json", {"at": datetime.now(timezone.utc).isoformat(), **diagnostic})
                except OSError:
                    pass
            self.respond(303, headers={"Location": self.server.return_path})
        else:
            self.respond(404, "Not found")

    def do_POST(self):
        # Drain a bounded, framed body before rejecting its origin. Closing a
        # socket with unread bytes can reset the connection on Windows instead
        # of delivering the intended 403. This does not authorize the request.
        try:
            if self.headers.get("Transfer-Encoding") or len(self.headers.get_all("Content-Length", [])) != 1:
                raise ValueError()
            length = int(self.headers["Content-Length"])
            if not 0 < length <= 4096:
                raise ValueError()
            self.connection.settimeout(3)
            body = self.rfile.read(length)
            if len(body) != length:
                raise ValueError()
        except (ValueError, OSError):
            self.respond(403, "Invalid connection request")
            return
        sid, session = self.session()
        if sid is None:
            return
        accepted_paths = {self.server.connect_path} | ({"/google/sign-out"} if self.server.prefix else set())
        if self.path not in accepted_paths or not session or self.headers.get("Origin") != self.server.origin:
            self.respond(403, "Invalid connection request")
            return
        try:
            form = parse_qs(body.decode())
            if form.get("csrf") != [session["csrf"]]:
                raise ValueError()
        except (ValueError, UnicodeError):
            self.respond(403, "Invalid connection request")
            return
        if self.path == "/google/sign-out":
            self.server.sessions.pop(sid, None)
            self.respond(303, headers={"Location": self.server.return_path,
                "Set-Cookie": f"{self.server.cookie_name}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0"})
        else:
            self.begin_authorization(session)

    def begin_authorization(self, session, headers=None):
        try:
            flow = self.server.flow_factory()
            url, state = flow.authorization_url(access_type="offline", prompt="select_account consent")
            destination = urlsplit(url)
            if (destination.scheme != "https" or destination.hostname != "accounts.google.com" or destination.username or
                    destination.password or destination.port not in {None, 443} or not state):
                raise GoogleAccessError("Unexpected authorization destination")
            session["pending"] = {"flow": flow, "state": state, "created": time.monotonic()}
            if not self.server.prefix:
                session.pop("connection", None)
            session.pop("error", None)
            session.pop("error_code", None)
            self.respond(303, headers={**(headers or {}), "Location": url})
        except Exception:
            session["error"] = "Google connection is not configured yet. Please contact the developer."
            self.respond(303, headers={**(headers or {}), "Location": self.server.return_path})


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(".google-local"))
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--public-origin")
    parser.add_argument("--workbench", action="store_true")
    parser.add_argument("--parent-stdin", action="store_true")
    args = parser.parse_args()
    if not (args.root / "client.json").is_file():
        parser.error("Missing developer OAuth client at configured root/client.json")
    server = ConnectionServer(("127.0.0.1", args.port), args.root, public_origin=args.public_origin,
        prefix="/google" if args.workbench else "", return_path="/settings/accounts" if args.workbench else "/")
    if args.workbench:
        print(json.dumps({"ready": True, "port": server.server_port}), flush=True)
    else:
        print(f"Open {server.origin} to connect Google. No request URLs or credentials are logged.", flush=True)
    if args.parent_stdin:
        def watch_parent():
            sys.stdin.buffer.read()
            server.shutdown()
        threading.Thread(target=watch_parent, daemon=True).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
