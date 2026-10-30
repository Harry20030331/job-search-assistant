"""Offline Google contract tests. Fakes are not evidence of live API success."""
from __future__ import annotations

import base64
import copy
import importlib.util
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from interview.google_adapter import GoogleAccessError, GoogleAdapter, GoogleConfig, GoogleHTTPError, confirm_live, credential_path, execute_request, load_config
from interview.google_cli import initialize
from interview.schemas import CalendarAction
from interview.storage import Store, read_json, write_json
from interview.tools import dispatch


class HTTPFailure(Exception):
    def __init__(self, status):
        self.resp = SimpleNamespace(status=status)
        super().__init__("UNTRUSTED ERROR BODY MUST NOT BE PRINTED")


class Request:
    def __init__(self, handler):
        self.handler, self.headers = handler, {}

    def execute(self, num_retries=0):
        assert num_retries == 0
        return copy.deepcopy(self.handler(self))


class Gmail:
    def __init__(self):
        self.email = "test@example.invalid"
        self.message_ids = []

    def users(self): return self
    def messages(self): return self
    def getProfile(self, **kwargs): return Request(lambda r: {"emailAddress": self.email})

    def get(self, **kwargs):
        def handle(request):
            self.message_ids.append(kwargs["id"])
            raw = b"From: Fictional Recruiter <recruiter@example.invalid>\r\nSubject: [CS329Z-TEST] Cedar invitation\r\nMessage-ID: <fixture@example.invalid>\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nFictional backend interview invitation."
            return {"raw": base64.urlsafe_b64encode(raw).decode().rstrip("="), "threadId": "thread-fixture"}
        return Request(handle)


class Calendar:
    def __init__(self):
        self.remote = {}
        self.insert_count, self.patch_count = 0, 0
        self.concurrent_edit = False
        self.corrupt_write = False
        self.repeat_pages = False
        self.list_calls = 0

    def events(self): return self

    def get(self, **kwargs):
        def handle(request):
            if kwargs["eventId"] not in self.remote:
                raise HTTPFailure(404)
            return self.remote[kwargs["eventId"]]
        return Request(handle)

    def list(self, **kwargs):
        def handle(request):
            self.list_calls += 1
            return {"timeZone": "UTC", "items": list(self.remote.values()), **({"nextPageToken": "more"} if self.repeat_pages else {})}
        return Request(handle)

    def insert(self, **kwargs):
        def handle(request):
            self.insert_count += 1
            body = copy.deepcopy(kwargs["body"])
            if body["id"] in self.remote:
                raise HTTPFailure(409)
            body.update(etag='"v1"', status="confirmed")
            if self.corrupt_write:
                body["summary"] = "Unexpected server-side change"
            self.remote[body["id"]] = body
            return body
        return Request(handle)

    def patch(self, **kwargs):
        def handle(request):
            self.patch_count += 1
            event = self.remote[kwargs["eventId"]]
            if self.concurrent_edit:
                event["etag"] = '"concurrent"'
            if request.headers.get("If-Match") != event["etag"]:
                raise HTTPFailure(412)
            event.update(copy.deepcopy(kwargs["body"]), etag='"v2"')
            return event
        return Request(handle)


class GoogleContractTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.work = self.root / "work"
        self.now = datetime.now(timezone.utc)
        self.store = Store(self.work)
        self.store.initialize({"clock": self.now.isoformat()}, "D")
        self.config = GoogleConfig(expected_account="test@example.invalid", calendar_id="dedicated@group.calendar.google.com", namespace="offline-contract-test", gmail_messages={"invite": "allowed-gmail-id"})
        with self.store.connect() as db:
            for key, value in {"backend": "google", "google_binding": self.config.binding()}.items():
                db.execute("INSERT INTO meta VALUES (?,?)", (key, value))
        self.gmail, self.calendar = Gmail(), Calendar()
        self.adapter = GoogleAdapter(self.store, self.config, self.gmail, self.calendar, now=lambda: self.now)
        start = self.now + timedelta(days=2)
        self.action = CalendarAction(operation="create", interview_id="fictional-interview", event_id=None, title="[CS329Z-TEST] Cedar interview", start=start.isoformat(), end=(start + timedelta(minutes=45)).isoformat(), timezone="UTC", reminder_minutes=[1440, 60])

    def tearDown(self): self.temp.cleanup()

    def approve(self, action=None, etag=None):
        return self.store.confirm({"backend_binding": self.config.binding(), "action": (action or self.action).model_dump(), "expected_etag": etag})

    def create(self):
        confirmation = self.approve()
        return self.adapter.apply("calendar.create", {**self.action.model_dump(), "confirmation_id": confirmation}), confirmation

    def test_explicit_gmail_ids_are_used_and_rfc_source_contract_is_preserved(self):
        result = self.adapter.read_mail({})
        self.assertEqual(self.gmail.message_ids, ["allowed-gmail-id"])
        self.assertEqual(result[0]["source_id"], "invite")
        self.assertEqual(result[0]["message_id"], "<fixture@example.invalid>")
        self.assertIn("Fictional backend", result[0]["body"])
        self.assertEqual(self.adapter.read_mail({"gmail_id": "unapproved-id"}), [])
        self.assertEqual(self.gmail.message_ids, ["allowed-gmail-id"])

    def test_wrong_account_is_rejected_before_read_or_write(self):
        self.gmail.email = "wrong@example.invalid"
        with self.assertRaisesRegex(GoogleAccessError, "TEST account"):
            self.adapter.read_mail({})
        self.assertEqual(self.gmail.message_ids, [])
        self.assertEqual(self.calendar.insert_count, 0)

    def test_missing_changed_expired_and_wrong_backend_confirmations_cannot_write(self):
        with self.assertRaisesRegex(GoogleAccessError, "host confirmation"):
            self.adapter.apply("calendar.create", self.action.model_dump())
        confirmation = self.approve()
        with self.assertRaisesRegex(GoogleAccessError, "does not match"):
            self.adapter.apply("calendar.create", {**self.action.model_dump(), "title": "Changed", "confirmation_id": confirmation})
        old_now = self.adapter.now
        self.adapter.now = lambda: self.now + timedelta(seconds=901)
        with self.assertRaisesRegex(GoogleAccessError, "expired"):
            self.adapter.apply("calendar.create", {**self.action.model_dump(), "confirmation_id": confirmation})
        self.adapter.now = old_now
        self.adapter.config = self.config.model_copy(update={"calendar_id": "different@group.calendar.google.com"})
        with self.assertRaisesRegex(GoogleAccessError, "does not match"):
            self.adapter.apply("calendar.create", {**self.action.model_dump(), "confirmation_id": confirmation})
        self.assertEqual(self.calendar.insert_count, 0)

    def test_create_is_read_back_and_retry_reuses_same_actual_event(self):
        first, confirmation = self.create()
        second = self.adapter.apply("calendar.create", {**self.action.model_dump(), "confirmation_id": confirmation})
        self.assertEqual(first["event_id"], second["event_id"])
        self.assertRegex(first["event_id"], r"^[0-9a-v]+$")
        self.assertEqual(self.calendar.insert_count, 1)
        self.assertTrue(second["idempotent_reuse"])
        self.assertEqual(len(self.calendar.remote), 1)
        self.assertEqual(len(self.store.rows("events")[0]["reminders"]), 2)

    def test_all_day_busy_event_prevents_creation_but_transparent_event_does_not(self):
        day = self.action.start[:10]
        tomorrow = (datetime.fromisoformat(day) + timedelta(days=1)).date().isoformat()
        self.calendar.remote["busy"] = {"id": "busy", "summary": "Busy", "start": {"date": day}, "end": {"date": tomorrow}, "etag": '"busy"'}
        with self.assertRaisesRegex(GoogleAccessError, "check failed"):
            self.create()
        self.assertEqual(self.calendar.insert_count, 0)
        self.calendar.remote["busy"]["transparency"] = "transparent"
        result, _ = self.create()
        self.assertEqual(result["backend"], "google")

    def update_action(self, event_id):
        return self.action.model_copy(update={"operation": "update", "event_id": event_id, "title": "[CS329Z-TEST] Updated Cedar interview"})

    def test_update_requires_cached_version_and_rejects_an_edit_after_approval(self):
        first, _ = self.create()
        action = self.update_action(first["event_id"])
        confirmation = self.approve(action, etag='"v1"')
        self.calendar.remote[first["event_id"]]["etag"] = '"external-change"'
        with self.assertRaisesRegex(GoogleAccessError, "Event changed"):
            self.adapter.apply("calendar.update", {**action.model_dump(), "confirmation_id": confirmation})
        self.assertEqual(self.calendar.patch_count, 0)

    def test_if_match_prevents_a_race_during_update(self):
        first, _ = self.create()
        action = self.update_action(first["event_id"])
        confirmation = self.approve(action, etag='"v1"')
        self.calendar.concurrent_edit = True
        with self.assertRaises(GoogleHTTPError) as caught:
            self.adapter.apply("calendar.update", {**action.model_dump(), "confirmation_id": confirmation})
        self.assertEqual(caught.exception.status, 412)
        self.assertEqual(self.calendar.patch_count, 1)
        self.assertEqual(self.calendar.remote[first["event_id"]]["summary"], self.action.title)

    def test_confirmed_update_preserves_event_identity(self):
        first, _ = self.create()
        action = self.update_action(first["event_id"])
        confirmation = self.approve(action, etag='"v1"')
        updated = self.adapter.apply("calendar.update", {**action.model_dump(), "confirmation_id": confirmation})
        self.assertEqual(updated["event_id"], first["event_id"])
        self.assertEqual(updated["title"], action.title)
        self.assertEqual(self.calendar.insert_count, 1)
        self.assertEqual(self.calendar.patch_count, 1)

    def test_foreign_event_cannot_be_updated_even_with_confirmation(self):
        self.calendar.remote["foreign"] = {"id": "foreign", "summary": "Unrelated event", "start": {"dateTime": self.action.start}, "end": {"dateTime": self.action.end}, "etag": '"v1"'}
        action = self.update_action("foreign")
        confirmation = self.approve(action, etag='"v1"')
        with self.assertRaisesRegex(GoogleAccessError, "outside this project"):
            self.adapter.apply("calendar.update", {**action.model_dump(), "confirmation_id": confirmation})
        self.assertEqual(self.calendar.patch_count, 0)

    def test_read_back_mismatch_does_not_claim_success_and_preserves_write_attempt(self):
        self.calendar.corrupt_write = True
        with self.assertRaisesRegex(GoogleAccessError, "may have committed"):
            self.create()
        self.assertEqual(len(self.calendar.remote), 1)
        attempts = [r for r in self.store.audit_rows() if r["operation"] == "google.calendar.write_attempt"]
        self.assertEqual(len(attempts), 1)
        self.assertEqual(self.store.rows("events"), [])

    def test_pagination_limit_does_not_report_a_complete_calendar(self):
        self.calendar.repeat_pages = True
        with self.assertRaisesRegex(GoogleAccessError, "pagination"):
            self.adapter.list_events({})
        self.assertEqual(self.calendar.list_calls, 10)
        self.assertEqual(self.store.rows("events"), [])

    def test_transport_errors_are_sanitized(self):
        with self.assertRaises(GoogleHTTPError) as caught:
            execute_request(Request(lambda r: (_ for _ in ()).throw(HTTPFailure(403))))
        self.assertNotIn("UNTRUSTED", str(caught.exception))

    def test_primary_calendar_and_agent_workspace_credentials_are_rejected(self):
        config_path = self.root / "config.json"
        write_json(config_path, {**self.config.model_dump(), "calendar_id": "primary"})
        with self.assertRaisesRegex(GoogleAccessError, "secondary"):
            load_config(config_path)
        with self.assertRaisesRegex(GoogleAccessError, "outside"):
            credential_path(config_path, str(self.work / "token.json"), self.work)

    def test_wrong_config_file_cannot_echo_oauth_secrets(self):
        path = self.root / "accidental-token.json"
        write_json(path, {"refresh_token": "test-secret-not-a-real-token"})
        with self.assertRaises(GoogleAccessError) as caught:
            load_config(path)
        self.assertNotIn("test-secret", str(caught.exception))

    def test_host_confirmation_requires_a_prior_read_for_updates(self):
        action = self.update_action("unknown")
        with self.assertRaisesRegex(GoogleAccessError, "Read the live event"):
            confirm_live(self.store, action, self.config)

    def test_google_backend_routes_mail_without_falling_back_to_local_fixture(self):
        self.adapter.config = self.config.model_copy(update={"gmail_messages": {}})
        with patch("interview.google_adapter.for_store", return_value=self.adapter):
            result = dispatch(self.work, "mail.read", {})
        self.assertTrue(result["ok"])
        self.assertEqual(result["data"], [])
        self.assertEqual(self.store.audit_rows()[-1]["operation"], "mail.read")

    def test_live_initializer_does_not_seed_fixture_events(self):
        config = self.root / "config.json"
        write_json(config, self.config.model_dump())
        case = Path(__file__).resolve().parents[1] / "benchmark" / "dev" / "S01"
        manifest = initialize(config, case, self.root / "integration", "C")
        live = Store(Path(manifest["workspace"]))
        self.assertEqual(live.rows("events"), [])
        self.assertEqual(live.meta("backend"), "google")
        self.assertFalse((Path(manifest["workspace"]) / "gold.json").exists())
        self.assertEqual(list((Path(manifest["workspace"]) / "inputs" / "mail").glob("*.eml")), [])
        self.assertIn("real TEST Google", (Path(manifest["workspace"]) / "TOOL_GUIDE.md").read_text(encoding="utf-8"))
        self.assertEqual(manifest["scope"], "live_google_integration_not_benchmark")

    @unittest.skipUnless(importlib.util.find_spec("googleapiclient"), "Optional Google SDK not installed")
    def test_google_sdk_discovery_accepts_the_used_methods_without_network(self):
        from google.auth.credentials import AnonymousCredentials
        from googleapiclient.discovery import build
        gmail = build("gmail", "v1", credentials=AnonymousCredentials(), static_discovery=True, cache_discovery=False)
        calendar = build("calendar", "v3", credentials=AnonymousCredentials(), static_discovery=True, cache_discovery=False)
        gmail.users().getProfile(userId="me")
        gmail.users().messages().get(userId="me", id="fixture", format="raw")
        calendar.events().list(calendarId="fixture", singleEvents=True, maxResults=250, showDeleted=False)
        request = calendar.events().patch(calendarId="fixture", eventId="fixture", body={}, sendUpdates="none")
        request.headers["If-Match"] = '"v1"'
        calendar.events().insert(calendarId="fixture", body={}, sendUpdates="none")
        gmail.close(); calendar.close()


if __name__ == "__main__":
    unittest.main()
