"""Scenario completeness, exact time budgets, approval gates and complete preview coverage."""
import copy
import hashlib
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock

from pydantic import ValidationError

from interview.context_preparation_flow import run_node
from interview.context_preparation import submit_material
from interview.dashboard import export
from interview.practice import SimulationPack, render_simulation
from interview.preview import prepare
from interview.preview_practice import FACTS
from interview.storage import Store, read_json, write_json
from interview.team_bridge import stage


class PracticeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.root = Path(self.temp.name)

    def tearDown(self): self.temp.cleanup()

    def workspace(self, case="materials"):
        source = self.root / (case + "-candidate.json")
        identity = {"fullName": "Alex Reed (fictional preview)"}; write_json(source, {"schemaVersion": 2, "identity": identity})
        budget = {"materials": 20, "plan": 50, "debrief": 60}[case]
        role = "Junior Modeling Data Scientist" if case == "plan" else "Graduate Software Engineer"
        bundle = {"schemaVersion": 1, "token": "fictional", "candidateSource": {"protocol": "candidate-source-v1", "profile_path": str(source)},
            "sourceVersions": [{"path": str(source), "sha256": hashlib.sha256(source.read_bytes()).hexdigest()}],
            "profile": {"identity": identity, "preparation_budget_minutes": budget, "priorities": ["Truthful preparation"]},
            "application": {"job_id": "job-" + case, "application_id": "app-" + case, "interview_id": "interview-" + case,
                "company": "Fictional Preview Company", "role": role, "round": "recruiter" if case == "materials" else "technical"},
            "sources": {"canonical-candidate": FACTS, "invitation": "Fictional scoped interview for this role; unknown employer questions stay unknown.", "preferences": "Do not invent facts."}}
        store = Store(Path(stage(bundle, self.root / case)["workspace"]))
        prepare(store.workspace, case)
        return store

    def test_every_preview_including_completed_swe_has_a_plan_and_full_practice(self):
        for case in ("plan", "materials", "debrief"):
            snapshot = export(self.workspace(case).workspace)
            self.assertEqual(snapshot["freshness"], "current")
            self.assertIsNotNone(snapshot["proposal"])
            pack = SimulationPack.model_validate(snapshot["materials"])
            self.assertEqual(sum(s.minutes for s in pack.sections), snapshot["proposal"]["draft"]["budget_minutes"])
            if case == "debrief":
                self.assertTrue(snapshot["debriefs"])
                self.assertTrue(any(e.exercise_type == "coding" for s in pack.sections for e in s.exercises))

    def test_missing_context_and_unallocated_exercise_minutes_are_rejected(self):
        snapshot = export(self.workspace().workspace)
        data = copy.deepcopy(snapshot["materials"])
        data["sections"][0]["exercises"][0].pop("scenario")
        with self.assertRaises(ValidationError): SimulationPack.model_validate(data)
        data = copy.deepcopy(snapshot["materials"])
        data["sections"][0]["exercises"][0]["timebox_minutes"] += 1
        with self.assertRaisesRegex(ValidationError, "exactly the approved section"):
            SimulationPack.model_validate(data)

    def test_simulation_node_reuses_exact_approval_and_records_its_new_protocol(self):
        store = self.workspace()
        material = export(store.workspace)["materials"]
        approval = read_json(store.workspace.parent / "synthetic-approval.json")["approval_id"]
        invoke = Mock(return_value={"status": "completed", "output": {"status": "ready", "material": material, "questions": []}, "shell_command_count": 0})
        result = run_node(store.workspace, self.root / "node", approval_id=approval, material_format="simulation-v2", invoke_fn=invoke)
        self.assertEqual(result["status"], "material_ready")
        self.assertEqual(result["protocol"], "context-practice-node-v2")
        self.assertEqual(invoke.call_count, 1)
        text = (self.root / "node/materials.md").read_text(encoding="utf-8")
        self.assertIn("### Method", text); self.assertIn("Candidate evidence", text)
        self.assertIn("### Follow-ups", render_simulation(material))
        self.assertNotIn("### Scoring anchors", text)
        self.assertTrue(result["accepted"]["sections"][0]["exercises"][0]["rubric"])

    def test_compact_answer_is_distinct_from_method_and_internal_evaluation(self):
        material = export(self.workspace().workspace)["materials"]
        material["sections"][0]["exercises"][0]["sample_answer"] = [
            "I built a course API with a teammate and implemented validation. [candidate to supply: genuine motivation]"]
        text = render_simulation(material)
        self.assertIn("### Sample answer", text)
        self.assertIn("[candidate to supply: genuine motivation]", text)
        self.assertNotIn("### Self-check", text)
        SimulationPack.model_validate(material)

    def test_simulation_cannot_run_without_current_approval(self):
        store = self.workspace()
        invoke = Mock()
        with self.assertRaisesRegex(ValueError, "exact approved plan"):
            run_node(store.workspace, self.root / "unapproved", material_format="simulation-v2", invoke_fn=invoke)
        with self.assertRaises(ValueError):
            run_node(store.workspace, self.root / "wrong-approval", approval_id="wrong", material_format="simulation-v2", invoke_fn=invoke)
        invoke.assert_not_called()

    def direct_material(self, store):
        material = export(store.workspace)["materials"]
        original = material["sections"][0]["exercises"][0]
        material["question_bank"] = []
        for index in range(3):
            exercise = copy.deepcopy(original)
            exercise["plan_section_id"] = material["sections"][0]["section_id"]
            material["question_bank"].append(exercise)
        for index, exercise in enumerate([e for s in material["sections"] for e in s["exercises"]] + material["question_bank"]):
            exercise.update(question_title="Practice question " + str(index), question_details=[], sample_answer=["Use documented facts and [candidate to supply: personal details]."])
        return material

    def test_direct_generation_keeps_alternatives_outside_the_fixed_plan_budget(self):
        store = self.workspace(); material = self.direct_material(store)
        approval = read_json(store.workspace.parent / "synthetic-approval.json")["approval_id"]
        invoke = Mock(return_value={"status": "completed", "output": {"status": "ready", "material": material, "questions": []}, "shell_command_count": 0})
        result = run_node(store.workspace, self.root / "direct", approval_id=approval, material_format="simulation-v2", direct_questions=True, invoke_fn=invoke)
        self.assertEqual(result["protocol"], "context-direct-practice-node-v2")
        self.assertEqual(result["status"], "material_ready")
        self.assertEqual(read_json(self.root / "direct/code-checks.json")["questions"], 6)
        self.assertEqual(sum(s["minutes"] for s in result["accepted"]["sections"]), 20)

    def test_direct_coding_without_code_is_rejected_before_material_publication(self):
        store = self.workspace(); material = self.direct_material(store)
        material["question_bank"][0]["exercise_type"] = "coding"
        approval = read_json(store.workspace.parent / "synthetic-approval.json")["approval_id"]
        invoke = Mock(return_value={"status": "completed", "output": {"status": "ready", "material": material, "questions": []}, "shell_command_count": 0})
        result = run_node(store.workspace, self.root / "no-code", approval_id=approval, material_format="simulation-v2", direct_questions=True, invoke_fn=invoke)
        self.assertEqual(result["status"], "validation_failed")
        self.assertIn("complete executable answer", result["error"])

    def test_alternative_source_references_and_section_binding_are_checked(self):
        store = self.workspace(); material = self.direct_material(store)
        approval = read_json(store.workspace.parent / "synthetic-approval.json")["approval_id"]
        material["question_bank"][0]["basis_refs"] = ["nonexistent-source"]
        with self.assertRaisesRegex(ValueError, "outside the approved context"):
            submit_material(store, approval, material, material_format="simulation-v2")
        material["question_bank"][0]["basis_refs"] = ["candidate"]
        material["question_bank"][0]["plan_section_id"] = "not-in-plan"
        with self.assertRaisesRegex(ValueError, "existing approved plan"):
            submit_material(store, approval, material, material_format="simulation-v2")

    def reject_direct_response(self, store, material):
        SimulationPack.model_validate(material)  # Historical storage remains compatible.
        approval = read_json(store.workspace.parent / "synthetic-approval.json")["approval_id"]
        invoke = Mock(return_value={"status": "completed", "output": {"status": "ready", "material": material, "questions": []}, "shell_command_count": 0})
        destination = self.root / "invalid-direct"
        result = run_node(store.workspace, destination, approval_id=approval, material_format="simulation-v2", direct_questions=True, invoke_fn=invoke)
        self.assertEqual(result["status"], "validation_failed")
        self.assertFalse((destination / "accepted.json").exists())

    def test_direct_null_problem_details_are_rejected_without_changing_legacy_packs(self):
        store = self.workspace(); material = self.direct_material(store)
        material["sections"][0]["exercises"][0]["question_details"] = None
        self.reject_direct_response(store, material)

    def test_direct_grouped_sections_are_rejected_even_when_minutes_sum_correctly(self):
        store = self.workspace(); material = self.direct_material(store)
        section = material["sections"][0]
        second = copy.deepcopy(section["exercises"][0])
        second["timebox_minutes"] = section["minutes"] - 1
        section["exercises"][0]["timebox_minutes"] = 1
        section["exercises"].append(second)
        self.reject_direct_response(store, material)


if __name__ == "__main__": unittest.main()
