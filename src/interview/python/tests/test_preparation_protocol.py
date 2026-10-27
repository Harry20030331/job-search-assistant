"""State/provenance/budget boundary tests, independent of LLM content quality."""
import copy
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock

from evaluation.preparation_flow import run_node
from interview.preparation import approve, approved_plan, latest, reject, submit_material, submit_proposal
from interview.storage import Store, write_json


class PreparationProtocolTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.store = Store(self.root)
        self.store.initialize({"clock": "2026-10-20T18:00:00+00:00"})
        write_json(self.root / "inputs/profile.json", {"preparation_budget_minutes": 90})
        write_json(self.root / "inputs/application.json", {"interview_id": "interview-test"})
        (self.root / "inputs/sources").mkdir()
        self.draft = {"interview_id": "interview-test", "budget_minutes": 90, "priorities": ["ML evaluation"],
                      "sections": [{"section_id": f"s{i}", "topic": f"Topic {i}", "minutes": 30, "objective": "Practice", "basis_refs": ["profile"]} for i in range(3)],
                      "source_refs": ["profile"], "unknowns": ["Actual employer questions unknown"]}

    def tearDown(self):
        self.temp.cleanup()

    def accepted(self):
        record = submit_proposal(self.store, self.draft)
        approval = approve(self.store, "interview-test", record["proposal_id"], record["proposal_hash"], "Declared synthetic test user accepts")
        return record, approval

    def material(self, record):
        return {"proposal_id": record["proposal_id"], "proposal_version": record["version"], "proposal_hash": record["proposal_hash"],
                "sections": [{"section_id": s["section_id"], "minutes": s["minutes"], "exercises": [{"kind": "suggested_practice", "prompt": "Explain a test scenario.", "steps": ["State assumptions"], "answer_points": ["Use a held-out test set"], "self_check": ["No data leakage"], "basis_refs": ["profile"]}]} for s in record["draft"]["sections"]], "unknowns": []}

    def test_material_node_is_blocked_before_llm_call(self):
        submit_proposal(self.store, self.draft)
        fake = Mock()
        with self.assertRaises(ValueError):
            run_node(self.root, self.root / "node", approval_id="not-approved", invoke_fn=fake)
        fake.assert_not_called()

    def test_accept_generate_and_keep_versions(self):
        record, approval = self.accepted()
        result = submit_material(self.store, "interview-test", approval, self.material(record))
        self.assertTrue(result["material_id"].startswith("prep-material-"))
        self.assertEqual(latest(self.store, "interview-test")["status"], "material_ready")
        second = submit_proposal(self.store, self.draft)
        self.assertEqual(second["version"], 2)
        with self.assertRaises(ValueError):
            approved_plan(self.store, "interview-test", approval)
        with self.store.connect() as db:
            self.assertEqual(db.execute("SELECT COUNT(*) FROM preparation_proposals").fetchone()[0], 2)
            self.assertEqual(db.execute("SELECT COUNT(*) FROM preparation_materials").fetchone()[0], 1)

    def test_calendar_approval_cannot_authorize_materials(self):
        record, _ = self.accepted()
        calendar_approval = self.store.confirm({"operation": "create"})
        with self.assertRaises(ValueError):
            submit_material(self.store, "interview-test", calendar_approval, self.material(record))

    def test_changed_inputs_invalidate_approval(self):
        _, approval = self.accepted()
        write_json(self.root / "inputs/profile.json", {"preparation_budget_minutes": 20})
        with self.assertRaises(ValueError):
            approved_plan(self.store, "interview-test", approval)

    def test_change_during_generation_is_rejected(self):
        record, approval = self.accepted()
        def invoke(*args):
            (self.root / "inputs/sources/new.md").write_text("Changed round", encoding="utf-8")
            return {"status": "completed", "output": {"status": "ready", "material": self.material(record), "questions": []}}
        result = run_node(self.root, self.root / "node", approval_id=approval, invoke_fn=invoke)
        self.assertEqual(result["status"], "validation_failed")

    def test_blocked_node_does_not_create_placeholder_proposal(self):
        fake = Mock(return_value={"status": "completed", "output": {"status": "blocked", "proposal": None, "questions": ["Command environment unavailable"]}})
        result = run_node(self.root, self.root / "blocked-node", invoke_fn=fake)
        self.assertEqual(result["status"], "blocked")
        self.assertIsNone(latest(self.store, "interview-test"))

    def test_budget_refs_identity_and_duplicate_sections_rejected(self):
        for mutate in [lambda d: d.update(budget_minutes=60), lambda d: d.update(interview_id="other"),
                       lambda d: d["sections"][0].update(basis_refs=["invented"]),
                       lambda d: d["sections"][1].update(section_id="s0"),
                       lambda d: d["sections"][0].update(minutes=20)]:
            draft = copy.deepcopy(self.draft)
            mutate(draft)
            with self.assertRaises(ValueError):
                submit_proposal(self.store, draft)

    def test_old_hash_old_version_and_changed_minutes_rejected(self):
        record, approval = self.accepted()
        for mutate in [lambda m: m.update(proposal_version=0), lambda m: m.update(proposal_hash="old"),
                       lambda m: m["sections"][0].update(minutes=20), lambda m: m["sections"][0]["exercises"][0].update(basis_refs=["unknown"])]:
            material = self.material(record)
            mutate(material)
            with self.assertRaises(ValueError):
                submit_material(self.store, "interview-test", approval, material)

    def test_rejected_or_stale_proposal_cannot_be_approved(self):
        record = submit_proposal(self.store, self.draft)
        reject(self.store, "interview-test", record["proposal_id"])
        with self.assertRaises(ValueError):
            approve(self.store, "interview-test", record["proposal_id"], record["proposal_hash"], "accept")
        second = submit_proposal(self.store, self.draft)
        with self.assertRaises(ValueError):
            approve(self.store, "interview-test", record["proposal_id"], record["proposal_hash"], "accept")
        with self.assertRaises(ValueError):
            approve(self.store, "interview-test", second["proposal_id"], second["proposal_hash"], "")


if __name__ == "__main__":
    unittest.main()
