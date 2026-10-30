"""Handoff plumbing and no-write/evidence gates with scripted invocations only."""
import copy
import tempfile
import unittest
from pathlib import Path

from interview.google_adapter import GoogleConfig
from interview.inbox import InboxStore
from interview.inbox_handoff import propose_handoff
from interview.storage import Store, read_json


class InboxHandoffTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.store = InboxStore(self.root / "inbox.sqlite3", "test@example.invalid")
        self.config_path = self.root / "private/config.json"
        self.config = GoogleConfig(expected_account="test@example.invalid", calendar_id="sandbox@group.calendar.google.com", namespace="offline-inbox-handoff", gmail_messages={"old": "message"})
        self.store.enqueue([{"id": "message", "threadId": "thread"}])
        self.handoff = {"handoff_id": "a" * 64, "message_id": "message", "thread_id": "thread", "route": "scheduling_review", "interview_id": "interview-existing", "existing_workspace": None,
                        "calendar_write_authorized": False, "full_preparation_authorized": False}
        self.store.complete(self.store.claim(), "cache", {}, self.handoff)
        self.event = {"event_id": "existing-event", "interview_id": "interview-existing", "start": "2026-11-03T10:00:00-08:00", "end": "2026-11-03T11:00:00-08:00", "timezone": "America/Los_Angeles"}

    def tearDown(self): self.temp.cleanup()

    def output(self, work):
        app = read_json(work / "inputs/application.json")
        return {"interview": {"interview_id": app["interview_id"], "application_id": app["application_id"], "company": None, "role": "backend_swe", "round": None, "duration_minutes": 60,
                              "start": self.event["start"], "timezone": self.event["timezone"], "source_ids": ["incoming"]},
                "status": "completed", "questions": [], "proposed_slots": [], "proposed_action": None,
                "calendar_result": {"event_id": "existing-event", "confirmation_id": None}, "preparation": None, "memory_refs": [], "artifacts": []}

    def invocation(self, *, mutate=None, omit_mail=False, write_attempt=False):
        def invoke(work, prompt, schema, destination, settings, **kwargs):
            self.assertTrue(kwargs["google_network"])
            store = Store(work)
            if not omit_mail: store.audit("mail.read", {}, {"ok": True, "data": [{"source_id": "incoming"}]})
            store.audit("calendar.list", {}, {"ok": True, "data": [copy.deepcopy(self.event)]})
            if write_attempt: store.audit("calendar.create", {}, {"ok": False, "error": "No confirmation"})
            output = self.output(work)
            if mutate: mutate(output)
            return {"status": "completed", "output": output}
        return invoke

    def propose(self, **kwargs):
        return propose_handoff(self.store, self.config_path, self.config, self.root / "run", {}, **kwargs)

    def test_existing_event_is_verified_without_duplicate_and_no_second_dispatch(self):
        result = self.propose(invoke_fn=self.invocation())
        self.assertEqual(result["status"], "checked_existing")
        self.assertTrue(result["existing_event_reused"])
        self.assertEqual(result["calendar_write_attempts"], 0)
        self.assertEqual(self.propose_other_run()["status"], "no_pending_handoff")
        config = read_json(self.config_path.parent / "handoffs" / self.handoff["handoff_id"] / "config.json")
        self.assertEqual(config["gmail_messages"], {"incoming": "message"})
        self.assertTrue(Path(config["token_file"]).is_absolute())

    def propose_other_run(self):
        return propose_handoff(self.store, self.config_path, self.config, self.root / "other-run", {}, invoke_fn=self.invocation())

    def test_completed_claim_without_actual_mail_read_is_rejected(self):
        self.assertEqual(self.propose(invoke_fn=self.invocation(omit_mail=True))["status"], "blocked")

    def test_any_calendar_write_attempt_invalidates_proposal_only_run(self):
        self.assertEqual(self.propose(invoke_fn=self.invocation(write_attempt=True))["status"], "blocked")

    def test_wrong_existing_time_cannot_count_as_duplicate_reuse(self):
        self.assertEqual(self.propose(invoke_fn=self.invocation(mutate=lambda out: out["interview"].update(start="2026-11-04T10:00:00-08:00")))["status"], "blocked")

    def test_cancellation_route_is_not_dispatched_to_unsupported_executor(self):
        with self.store.connect() as db:
            import json
            data = dict(self.handoff, route="cancellation_review")
            db.execute("UPDATE handoffs SET payload=?", (json.dumps(data),))
        def must_not_call(*args, **kwargs): self.fail("Unsupported executor must not run")
        self.assertEqual(self.propose(invoke_fn=must_not_call)["status"], "needs_review")


if __name__ == "__main__":
    unittest.main()
