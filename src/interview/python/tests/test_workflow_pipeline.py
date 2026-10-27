"""Evaluation invariants using injected responses, never model-performance claims."""
import json
import tempfile
import unittest
from pathlib import Path

from evaluation.workflow import ROOT, run_batch, run_episode, simulated_reply
from evaluation.workflow_review import compare, export
from interview.storage import read_json, write_json
from interview.schemas import AgentResult
from interview.storage import Store


class WorkflowTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.cases = ROOT / "benchmark/workflow-v1"
        from interview.settings import load_settings
        self.settings = load_settings()

    def tearDown(self):
        self.temp.cleanup()

    def response(self, output):
        return {"status": "completed", "output": output, "successful_shell_command_count": 1, "seconds": 0, "thread_id": "fake-session"}

    def test_revision_reveals_budget_only_after_first_proposal_and_binds_materials(self):
        prompts = []
        def fake(work, prompt, schema, dest, settings):
            payload = json.loads(prompt.split("CURRENT TASK AND PUBLIC DIALOGUE:\n")[1])
            prompts.append(payload)
            if payload["phase"] == "materials":
                record = payload["approved_proposal"]
                material = {"proposal_id": record["proposal_id"], "proposal_version": record["version"], "proposal_hash": record["proposal_hash"], "unknowns": [],
                    "sections": [{"section_id": s["section_id"], "minutes": s["minutes"], "exercises": [{"kind": "suggested_practice", "prompt": "Explain retry behavior for a fictional queue.", "steps": ["State assumptions"], "answer_points": ["Duplicate effects require idempotency"], "self_check": ["Verify the assumptions"], "basis_refs": ["profile"]}]} for s in record["draft"]["sections"]]}
                return self.response({"status": "ready", "material": material, "questions": []})
            app = read_json(work / "inputs/application.json")
            budget = read_json(work / "inputs/profile.json")["preparation_budget_minutes"]
            sections = [{"section_id": str(i), "topic": "Queue practice", "minutes": n, "objective": "Explain supplied project", "basis_refs": ["profile"]} for i,n in enumerate([budget//3, budget//3, budget-2*(budget//3)])]
            return self.response({"status": "ready", "proposal": {"interview_id": app["interview_id"], "budget_minutes": budget, "priorities": ["Queue practice"], "sections": sections, "source_refs": ["profile"], "unknowns": ["Actual questions unknown"]}, "questions": []})
        record = run_episode(self.cases / "W08", self.root / "episode", self.settings, invoke_fn=fake)
        self.assertTrue(record["code_passed"], record)
        self.assertNotIn("new_budget", json.dumps(prompts[0]))
        self.assertNotIn("20 minutes", json.dumps(prompts[0]))
        self.assertEqual(prompts[-1]["approved_proposal"]["version"], 2)
        self.assertEqual(prompts[-1]["approved_proposal"]["draft"]["budget_minutes"], 20)

    def test_agent_input_mutation_is_retained_as_failure(self):
        def fake(work, *args):
            write_json(work / "input.json", {"altered": True})
            return self.response({})
        result = run_episode(self.cases / "W01", self.root / "bad", self.settings, invoke_fn=fake)
        self.assertFalse(result["code_passed"])
        self.assertEqual(result["error"], "immutable_sources_modified")
        self.assertTrue((self.root / "bad/result.json").exists())

    def test_resume_preserves_failed_first_attempt_without_calling_model_again(self):
        calls = []
        def fake(*args):
            calls.append(1)
            return {"status": "environment_error"}
        root = self.root / "batch"
        run_batch(self.cases, root, selected=["W01"], invoke_fn=fake)
        first = (root / "W01/result.json").read_bytes()
        run_batch(self.cases, root, selected=["W01"], resume=True, invoke_fn=fake)
        self.assertEqual(len(calls), 1)
        self.assertEqual((root / "W01/result.json").read_bytes(), first)
        self.assertEqual(read_json(root / "summary.json")["attempted"], 1)

    def test_project_instruction_ancestor_is_rejected_before_run_creation(self):
        (self.root / "AGENTS.md").write_text("Project skill instructions", encoding="utf-8")
        with self.assertRaises(ValueError):
            run_batch(self.cases, self.root / "batch", selected=["W01"], invoke_fn=lambda *a: None)
        self.assertFalse((self.root / "batch").exists())

    def test_missing_audit_artifacts_are_reported_without_substitution(self):
        root = self.root / "batch"
        run_batch(self.cases, root, selected=["W07"], invoke_fn=lambda *a: {"status": "environment_error"})
        result = export(root)
        self.assertEqual(result["rating_samples"], 0)
        self.assertEqual(len(result["missing_prespecified"]), 1)
        template = root / "review/ratings-template.csv"
        with self.assertRaises(ValueError):
            compare(root, template)

    def test_combined_fact_and_confirmation_question_does_not_grant_approval(self):
        store = Store(self.root / "work")
        store.initialize({"clock": "2026-10-19T16:00:00+00:00"})
        answer = AgentResult.model_validate({"interview": {"interview_id": "fictional", "application_id": None, "company": None, "role": None, "round": None, "duration_minutes": 45, "start": None, "timezone": None, "source_ids": []},
            "status": "needs_input", "questions": [{"field": "timezone", "question": "Which timezone?"}, {"field": "confirmation", "question": "Then confirm it?"}], "proposed_slots": [], "proposed_action": None, "calendar_result": None, "preparation": None, "memory_refs": [], "artifacts": []})
        reply = simulated_reply(answer, {"confirm": True, "facts": {"timezone": "America/New_York"}}, store, set())
        self.assertEqual(reply["content"]["timezone"], "America/New_York")
        self.assertFalse(reply["content"]["confirmation"]["confirmed"])
        with store.connect() as db:
            self.assertEqual(db.execute("SELECT COUNT(*) FROM confirmations").fetchone()[0], 0)
        declined = simulated_reply(answer, {"confirm": False, "facts": {"timezone": "America/New_York"}}, store, set())
        self.assertIn("Leave the interview unscheduled", declined["content"]["confirmation"]["instruction"])

    def test_blank_human_ratings_are_rejected_without_filling_them(self):
        root = self.root / "review-test"
        write_json(root / "review/private-index.json", {"samples": [{"sample_id": "R-test"}]})
        path = root / "ratings.csv"
        path.write_text("sample_id,dimension,score,evidence,reason\nR-test,specificity,,pending,\n", encoding="utf-8")
        with self.assertRaises(ValueError):
            compare(root, path)

    def test_changed_outputs_cannot_reuse_prior_browser_ratings(self):
        identities = []
        for index in range(2):
            root = self.root / ("pack-" + str(index))
            run_batch(self.cases, root, selected=["W07"], invoke_fn=lambda *a: {"status": "environment_error"})
            write_json(root / "W07/quality/materials.packet.json", {"candidate_output": {"text": "Different output " + str(index)}})
            export(root)
            identities.append(read_json(root / "review/pack-manifest.json")["pack_fingerprint"])
        self.assertNotEqual(*identities)


if __name__ == "__main__":
    unittest.main()
