"""Preparation freshness, immutable debriefs and next-session learning contracts."""
import copy
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock

from evaluation.debrief_flow import run_debrief
from evaluation.preparation_flow import run_node
from interview.coordinator import configure_profile, learning_store, preparation_for_handoff
from interview.debrief import append_raw, commit
from interview.freshness import attach, check
from interview.google_adapter import GoogleAdapter, GoogleAccessError, GoogleConfig, confirm_live
from interview.inbox import InboxStore
from interview.memory import search
from interview.preparation import approve, approved_plan, latest, submit_proposal
from interview.schemas import CalendarAction
from interview.storage import Store, read_json, write_json


class CoordinatorTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.inbox = InboxStore(self.root / "account/inbox.sqlite3", "test@example.invalid")
        self.inbox.enqueue([{"id": "mail-1", "threadId": "thread"}])
        self.profile = {"preparation_budget_minutes": 90, "priorities": ["ML evaluation"], "provenance": "fictional"}
        configure_profile(self.inbox, self.profile, {"resume": "Fictional text classification course project; no metrics supplied."})
        self.learning = learning_store(self.inbox, clock="2026-10-20T19:00:00+00:00")
        self.work = self.root / "work"
        self.store = Store(self.work)
        self.store.initialize({"clock": "2026-10-20T19:00:00+00:00"}, "D")
        write_json(self.work / "inputs/profile.json", self.profile)
        write_json(self.work / "inputs/application.json", {"interview_id": "interview"})
        self.draft = {"interview_id": "interview", "budget_minutes": 90, "priorities": ["evaluation"], "sections": [
            {"section_id": str(i), "topic": "Evaluation", "minutes": 30, "objective": "Practice", "basis_refs": ["profile"]} for i in range(3)], "source_refs": ["profile"], "unknowns": []}

    def tearDown(self): self.temp.cleanup()

    def raw(self, record_id="review-1", text="I struggled to explain evaluation leakage.", mode="practice"):
        return append_raw(self.learning, record_id=record_id, interview_id="historical-fictional", text=text,
                          occurred_at="2026-10-15T18:00:00+00:00", subject={"company": None, "role": "ml_engineer", "round": None},
                          mode=mode, origin="synthetic_test_script")

    def item(self, text="I struggled to explain evaluation leakage.", **updates):
        item = {"topic": "evaluation", "observation": text, "quote": text, "attribution": "self_assessment",
                "status": "active", "supersedes_id": None, "suggested_practice": "Rehearse leakage checks."}
        item.update(updates)
        return item

    def commit(self, record, items):
        return commit(self.learning, record["record_id"], {"summary": "User-reported practice debrief", "items": items, "unknowns": []})

    def approved(self):
        attach(self.store, self.inbox, "thread", learning=self.learning)
        record = submit_proposal(self.store, self.draft)
        approval = approve(self.store, "interview", record["proposal_id"], record["proposal_hash"], "synthetic_test_script: accept")
        return record, approval

    def test_newly_discovered_reply_blocks_material_model_before_classification(self):
        _, approval = self.approved()
        self.inbox.enqueue([{"id": "mail-2", "threadId": "thread"}])
        invoke = Mock()
        with self.assertRaises(ValueError): run_node(self.work, self.root / "material", approval_id=approval, invoke_fn=invoke)
        invoke.assert_not_called()

    def test_unrelated_or_duplicate_mail_does_not_invalidate(self):
        _, approval = self.approved()
        self.inbox.enqueue([{"id": "mail-1", "threadId": "thread"}, {"id": "other", "threadId": "other-thread"}])
        self.assertEqual(approved_plan(self.store, "interview", approval)["status"], "plan_approved")

    def test_rebinding_to_new_revision_cannot_resurrect_old_preparation_approval(self):
        _, approval = self.approved()
        self.inbox.enqueue([{"id": "mail-2", "threadId": "thread"}])
        attach(self.store, self.inbox, "thread", learning=self.learning)
        with self.assertRaises(ValueError): approved_plan(self.store, "interview", approval)

    def test_profile_change_and_new_debrief_invalidate_existing_material_approval(self):
        _, approval = self.approved()
        configure_profile(self.inbox, dict(self.profile, preparation_budget_minutes=20), {"resume": "Changed profile"})
        with self.assertRaises(ValueError): approved_plan(self.store, "interview", approval)
        configure_profile(self.inbox, self.profile, {"resume": "Fictional text classification course project; no metrics supplied."})
        self.raw()
        with self.assertRaises(ValueError): approved_plan(self.store, "interview", approval)

    def test_source_change_during_generation_rejects_output(self):
        attach(self.store, self.inbox, "thread")
        def invoke(*args):
            self.inbox.enqueue([{"id": "new", "threadId": "thread"}])
            return {"status": "completed", "output": {"status": "ready", "proposal": self.draft, "questions": []}}
        result = run_node(self.work, self.root / "proposal", invoke_fn=invoke)
        self.assertEqual(result["status"], "validation_failed")

    def test_group_d_ready_output_without_current_memory_lookup_is_rejected(self):
        invoke = Mock(return_value={"status": "completed", "output": {"status": "ready", "proposal": self.draft, "questions": []}})
        result = run_node(self.work, self.root / "no-lookup", invoke_fn=invoke)
        self.assertEqual(result["status"], "validation_failed")
        self.assertIn("memory.search", result["error"])
        self.assertIsNone(latest(self.store, "interview"))

    def test_remote_unsynced_reply_blocks_calendar_write_before_request(self):
        attach(self.store, self.inbox, "thread")
        config = GoogleConfig(expected_account=self.inbox.account, calendar_id="sandbox@group.calendar.google.com", namespace="freshness-test")
        with self.store.connect() as db:
            db.execute("INSERT INTO meta VALUES ('google_binding',?)", (config.binding(),))
        action = CalendarAction(operation="create", interview_id="interview", event_id=None, title="Test", start="2099-01-01T10:00:00+00:00", end="2099-01-01T11:00:00+00:00", timezone="UTC", reminder_minutes=[60])
        approval = confirm_live(self.store, action, config)
        class Request:
            def __init__(self, value): self.value = value
            def execute(self, num_retries=0): return self.value
        class Gmail:
            def users(self): return self
            def threads(self): return self
            def getProfile(self, **kwargs): return Request({"emailAddress": "test@example.invalid"})
            def get(self, **kwargs): return Request({"id": "thread", "messages": [{"id": "mail-1"}, {"id": "unsynced-reply"}]})
        calendar = Mock()
        adapter = GoogleAdapter(self.store, config, Gmail(), calendar)
        with self.assertRaises(GoogleAccessError): adapter.apply("calendar.create", dict(action.model_dump(), confirmation_id=approval))
        calendar.events.assert_not_called()

    def test_original_debrief_is_immutable_future_rejected_and_duplicate_is_idempotent(self):
        raw = self.raw()
        self.assertEqual(self.raw(), raw)
        with self.assertRaises(ValueError): self.raw(text="Altered original")
        with self.assertRaises(ValueError):
            append_raw(self.learning, record_id="future", interview_id="interview", text="Done", occurred_at="2099-01-01T00:00:00+00:00", subject=raw["subject"], mode="interview", origin="synthetic_test_script")

    def test_bad_second_memory_rolls_back_all_changes_but_keeps_original(self):
        raw = self.raw()
        with self.assertRaises(ValueError): self.commit(raw, [self.item(), self.item(quote="Invented quote")])
        self.assertEqual(self.learning.rows("memories"), [])
        self.assertEqual(self.learning.rows("history")[0]["text"], raw["text"])

    def test_revision_keeps_sources_excludes_resolved_issue_and_retains_unrelated_active_issue(self):
        text = "I struggled to explain evaluation leakage. My project story was disorganized."
        raw = self.raw(text=text)
        first = self.commit(raw, [self.item(), self.item(text="My project story was disorganized.", topic="project_story")])
        second_text = "I can now explain evaluation leakage clearly in practice."
        revised = self.raw(record_id="review-2", text=second_text)
        self.commit(revised, [self.item(text=second_text, status="resolved", supersedes_id=first["memory_ids"][0])])
        notes = self.learning.rows("memories")
        self.assertEqual([n["status"] for n in notes], ["superseded", "active", "resolved"])
        self.assertTrue(all(n["company"] is None for n in notes))
        retrieved = search(self.learning, {"query": "evaluation project story", "role": "ml_engineer", "topics": ["evaluation", "project_story"]})
        self.assertEqual([n["topics"] for n in retrieved], [["project_story"]])
        self.assertEqual(self.learning.rows("history")[0]["text"], text)
        self.assertEqual(self.commit(raw, [self.item()]), first)

    def test_cross_topic_or_superseded_revision_is_rejected(self):
        raw = self.raw()
        first = self.commit(raw, [self.item()])
        raw2 = self.raw(record_id="review-2", text="My coding improved.")
        with self.assertRaises(ValueError): self.commit(raw2, [self.item(text=raw2["text"], topic="coding", supersedes_id=first["memory_ids"][0], status="resolved")])

    def test_debrief_node_failure_retains_raw_and_repeat_saved_node_makes_no_model_call(self):
        raw = self.raw()
        failure = Mock(return_value={"status": "environment_error"})
        result = run_debrief(self.learning, raw, self.root / "failed", invoke_fn=failure)
        self.assertTrue(result["raw_record_saved"])
        self.commit(raw, [self.item()])
        repeated = Mock()
        self.assertEqual(run_debrief(self.learning, raw, self.root / "repeat", invoke_fn=repeated)["status"], "already_saved")
        repeated.assert_not_called()

    def test_prepare_bridge_reuses_current_proposal_and_versions_after_learning_change(self):
        schedule = self.root / "schedule"
        mail_dir = self.root / "classified/work"
        write_json(mail_dir / "input.json", {"messages": [{"source_id": "mail-1", "subject": "Fictional ML interview", "body": "We invite you to an ML interview."}]})
        interview = {"interview_id": "interview", "application_id": "application", "company": "Fictional", "role": "ml_engineer", "round": "technical"}
        write_json(schedule / "accepted.json", {"status": "completed", "interview": interview})
        handoff = {"handoff_id": "handoff", "thread_id": "thread", "source_attempt": str(mail_dir.parent), "source_revision": 1, "proposal_outcome": {"run": str(schedule)}}
        with self.inbox.connect() as db:
            db.execute("INSERT INTO handoffs VALUES (?,?,?,?)", ("handoff", "mail-1", json.dumps(handoff), "checked_existing"))
        calls = []
        def node(work, destination):
            calls.append(work)
            record = submit_proposal(Store(work), self.draft)
            return {"status": "awaiting_plan_approval", "accepted": record}
        first = preparation_for_handoff(self.inbox, run_root=self.root / "sessions", node_fn=node)
        second = preparation_for_handoff(self.inbox, run_root=self.root / "sessions", node_fn=node)
        self.assertTrue(second["reused"])
        self.assertEqual(len(calls), 1)
        self.assertTrue((Path(first["workspace"]) / "inputs/sources/mail-1.md").exists())
        self.raw()
        third = preparation_for_handoff(self.inbox, run_root=self.root / "sessions", node_fn=node)
        self.assertFalse(third["reused"])
        self.assertEqual(latest(Store(Path(first["workspace"])), "interview")["version"], 2)


if __name__ == "__main__":
    unittest.main()
