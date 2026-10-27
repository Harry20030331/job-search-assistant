"""Read-only workbench export, exact material gating and bound debrief isolation."""
import hashlib
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

from interview.candidate_learning import attach, bind, revoke
from interview.dashboard import export
from interview.debrief import append_raw, commit
from interview.preparation import approve, submit_material, submit_proposal
from interview.storage import Store, canonical, write_json
from interview.team_bridge import stage


class DashboardTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.source = self.root / "candidate.json"
        write_json(self.source, {"schemaVersion": 2, "identity": {"fullName": "Fictional Candidate"}})
        bundle = {"schemaVersion": 1, "token": "fixture", "candidateSource": {"protocol": "candidate-source-v1", "profile_path": str(self.source)},
            "sourceVersions": [{"path": str(self.source), "sha256": hashlib.sha256(self.source.read_bytes()).hexdigest()}],
            "profile": {"identity": {"fullName": "Fictional Candidate"}, "preparation_budget_minutes": 30},
            "application": {"job_id": "job-1", "application_id": "app-1", "interview_id": "interview-1", "company": "Fictional Cedar", "role": "ML Engineer", "round": "technical"},
            "sources": {"canonical-candidate": "Fictional Candidate", "invitation": "Fictional technical interview", "preferences": "Truthful answers"}}
        self.store = Store(Path(stage(bundle, self.root / "run")["workspace"]))

    def tearDown(self): self.temp.cleanup()

    def plan(self):
        return submit_proposal(self.store, {"interview_id": "interview-1", "budget_minutes": 30, "priorities": ["Rehearsal"], "unknowns": [],
            "source_refs": ["profile"], "sections": [{"section_id": str(i), "topic": "Evaluation", "objective": "Explain leakage", "minutes": 10, "basis_refs": ["profile"]} for i in range(3)]})

    def material(self, plan):
        approval = approve(self.store, "interview-1", plan["proposal_id"], plan["proposal_hash"], "synthetic_test_script: exact fictional plan")
        return submit_material(self.store, "interview-1", approval, {"proposal_id": plan["proposal_id"], "proposal_version": plan["version"],
            "proposal_hash": plan["proposal_hash"], "unknowns": [], "sections": [{"section_id": str(i), "minutes": 10, "exercises": [{"kind": "suggested_practice",
                "prompt": "Rehearse one train/test leakage example.", "steps": ["Name a split"], "answer_points": ["Separate preprocessing"], "self_check": ["No leakage"], "basis_refs": ["profile"]}]} for i in range(3)]})

    def test_empty_export_is_read_only_and_does_not_create_preparation_tables(self):
        before = self.store.path.read_bytes()
        result = export(self.store.workspace)
        self.assertIsNone(result["proposal"])
        self.assertEqual(result["debriefs"], [])
        self.assertEqual(self.store.path.read_bytes(), before)
        self.assertEqual(result["application"]["application_id"], "app-1")

    def test_exact_current_approved_materials_are_visible_but_changed_sources_withhold_them(self):
        self.material(self.plan())
        result = export(self.store.workspace)
        self.assertIsNotNone(result["materials"])
        self.assertEqual(result["freshness"], "current")
        self.source.write_text("Changed canonical facts", encoding="utf-8")
        result = export(self.store.workspace)
        self.assertEqual(result["freshness"], "stale")
        self.assertIsNone(result["materials"])
        self.assertIsNotNone(result["proposal"])

    def test_new_proposal_does_not_inherit_prior_approved_materials(self):
        self.material(self.plan())
        self.plan()
        result = export(self.store.workspace)
        self.assertEqual(result["proposal"]["version"], 2)
        self.assertIsNone(result["materials"])

    def add_debrief(self, store, record, interview, role="ML Engineer"):
        text = "In this fictional rehearsal I struggled to explain the leakage check."
        append_raw(store, record_id=record, interview_id=interview, text=text, occurred_at="2026-10-20T18:00:00Z",
            subject={"company": "Fictional Cedar", "role": role, "round": "technical"}, mode="practice", origin="synthetic_test_script")
        commit(store, record, {"summary": "Fictional self-report", "unknowns": [], "items": [{"topic": "ml_evaluation", "quote": text,
            "observation": text, "attribution": "self_assessment", "status": "active", "supersedes_id": None, "suggested_practice": "Explain the split."}]})

    def test_local_debrief_export_is_scoped_to_the_selected_interview(self):
        self.add_debrief(self.store, "current", "interview-1")
        self.add_debrief(self.store, "other", "another-interview")
        self.add_debrief(self.store, "wrong-role-same-id", "interview-1", role="Product Data Scientist")
        result = export(self.store.workspace)
        self.assertEqual([r["record_id"] for r in result["debriefs"]], ["current"])
        self.assertEqual(result["debriefs"][0]["text"], "In this fictional rehearsal I struggled to explain the leakage check.")
        self.assertEqual(result["debriefs"][0]["observations"][0]["status"], "active")

    def test_original_debrief_is_visible_even_before_model_extraction(self):
        append_raw(self.store, record_id="raw-only", interview_id="interview-1", text="My original fictional report is saved before model extraction.",
            occurred_at="2026-10-20T18:00:00Z", subject={"company": "Fictional Cedar", "role": "ML Engineer", "round": "technical"},
            mode="interview", origin="synthetic_test_script")
        result = export(self.store.workspace)
        self.assertEqual(result["debriefs"][0]["record_id"], "raw-only")
        self.assertEqual(result["debriefs"][0]["observations"], [])

    def test_bound_account_debrief_is_visible_after_update_but_revoked_accounts_are_withheld(self):
        account = Store(self.root / "account/learning")
        account.initialize({"clock": datetime.now(timezone.utc).isoformat()}, "D")
        with account.connect() as db: db.execute("INSERT INTO meta VALUES ('account','fictional@example.invalid')")
        binding = self.root / "binding.json"
        bind(self.store, account.workspace, binding, origin="synthetic_test_script", evidence="Fictional account link")
        attach(self.store, binding, {"topics": ["ml_evaluation"], "reason": "Fictional invitation"})
        self.add_debrief(account, "current-account", "interview-1")
        self.add_debrief(account, "unrelated", "another-interview")
        result = export(self.store.workspace)
        self.assertEqual(result["freshness"], "stale")
        self.assertEqual([r["record_id"] for r in result["debriefs"]], ["current-account"])
        revoke(binding, origin="synthetic_test_script", evidence="Fictional disconnection")
        self.assertEqual(export(self.store.workspace)["debriefs"], [])


if __name__ == "__main__": unittest.main()
