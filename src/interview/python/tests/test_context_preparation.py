"""Context identity, coverage, approval and method-isolation checks, without model calls."""
import copy
import hashlib
import io
import json
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import Mock

from interview.context_preparation import AREAS, attach, capture_request, current_context, current_policy, stage, submit_material, submit_proposal
from interview.context_preparation_flow import GUIDANCE, run_node
from interview.preparation import approve, approved_plan, context_fingerprint, latest, reject
from interview.preparation_context import ContextRequest, freeze
from interview.storage import Store, digest, read_json, write_json
from evaluation.context_preparation_pilot import run_pilot

ROOT = Path(__file__).resolve().parents[1]


class ContextPreparationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.request = read_json(ROOT / "benchmark/context-v1.1/C03/request.json")
        from interview.preparation_context import request_token
        self.analysis = {"request_token": request_token(ContextRequest.model_validate(self.request)),
            "jd": {"status": "exact", "source_ids": ["jd"], "reason": "Captured exact JD", "limitations": []},
            "role_focus": [], "round_focus": [], "candidate_links": [], "company_brief": [], "reported_themes": [], "learning": [],
            "seniority": {"value": None, "assessment": "unknown", "reason": "Test does not infer level.", "refs": []},
            "round_label": {"value": None, "assessment": "unknown", "reason": "Test does not infer round.", "refs": []},
            "unknowns": ["Personal motivation and actual questions are not established."], "questions": []}
        packet = freeze(self.request, self.analysis, self.root / "context")
        self.context = self.root / "context/preparation-context.json"
        self.context_hash = packet["context_hash"]
        self.work = Path(stage(self.context, self.root / "staged")["workspace"])
        self.store = Store(self.work)

    def tearDown(self):
        self.temp.cleanup()

    def draft(self):
        sections = []
        for sid, topic, minutes, focus in (("intro", "Introduction and motivations", 7, ["self_introduction", "why_company", "why_role"]),
                                           ("story", "Truthful project story", 8, ["project_ownership", "collaboration"]),
                                           ("questions", "Interviewer questions", 5, ["interviewer_questions"])):
            sections.append({"section_id": sid, "topic": topic, "minutes": minutes, "objective": "Rehearse a bounded response",
                "basis_refs": ["candidate", "invitation", "company"], "focus_topics": focus, "depth": "foundational",
                "rationale": "Follow the HR invitation within the short budget.", "deliverable": "One short rehearsal with a self-check."})
        return {"context_hash": self.context_hash, "policy_hash": digest(current_policy(self.store).model_dump()),
            "interview_id": self.request["identity"]["interview_id"], "budget_minutes": 20,
            "priorities": ["HR screen readiness"], "sections": sections, "source_refs": ["candidate", "invitation", "company"],
            "unknowns": ["Personal motivation remains unknown."],
            "coverage": [{"area": area, "disposition": "included", "section_ids": ["intro" if area in {"self_introduction", "why_company", "why_role"} else "questions" if area == "interviewer_questions" else "story"],
                          "reason": "Covered within the linked rehearsal block."} for area in sorted(AREAS)]}

    def material(self, record):
        return {"proposal_id": record["proposal_id"], "proposal_version": record["version"], "proposal_hash": record["proposal_hash"],
            "unknowns": ["Do not invent personal interests."], "sections": [{"section_id": s["section_id"], "minutes": s["minutes"],
                "exercises": [{"kind": "suggested_practice", "prompt": "Rehearse this approved section using only actual candidate facts.",
                    "steps": ["Recall actual contribution"], "answer_points": ["State scope truthfully"], "self_check": ["No invented impact"],
                    "basis_refs": ["candidate", "invitation"]}]} for s in record["draft"]["sections"]]}

    def invocation(self, output):
        return {"status": "completed", "output": output, "shell_command_count": 0}

    def test_stage_is_exclusive_and_writes_no_application_or_calendar(self):
        self.assertEqual(self.store.rows("events"), [])
        self.assertIsNone(self.store.optional_meta("backend"))
        request, _, context_hash = current_context(self.store)
        self.assertEqual(context_hash, self.context_hash)
        self.assertEqual(request.identity.model_dump(), self.request["identity"])
        with self.assertRaises(FileExistsError):
            stage(self.context, self.root / "staged")

    def test_capture_reuses_canonical_handoff_without_claiming_mail_identity(self):
        output = self.root / "capture"
        result = capture_request(self.store, output)
        captured = ContextRequest.model_validate(read_json(output / "request.json"))
        self.assertEqual(result["model_calls"], 0)
        self.assertEqual(captured.association, "unresolved")
        self.assertEqual(captured.identity.model_dump(), self.request["identity"])
        self.assertEqual(next(s for s in captured.sources if s.kind == "candidate").content,
                         next(s for s in self.request["sources"] if s["kind"] == "candidate")["content"])
        with self.assertRaises(FileExistsError):
            capture_request(self.store, output)
        with self.assertRaisesRegex(ValueError, "must not replace"):
            capture_request(self.store, self.root / "invalid-capture", enrichment={"sources": [self.request["sources"][0]], "research": self.request["research"]})

    def test_all_coverage_areas_are_required_and_linked_without_extra_minutes(self):
        valid = self.draft()
        self.assertEqual(submit_proposal(self.store, valid)["draft"]["budget_minutes"], 20)
        for mutate in (lambda d: d["coverage"].pop(),
                       lambda d: d["coverage"][0].update(section_ids=["missing"]),
                       lambda d: d["coverage"][0].update(disposition="deferred"),
                       lambda d: d["sections"][0].update(minutes=8)):
            draft = self.draft()
            mutate(draft)
            with self.assertRaises(ValueError):
                submit_proposal(self.store, draft)
        draft = self.draft()
        item = next(c for c in draft["coverage"] if c["area"] == "role_round_practice")
        item.update(disposition="deferred", section_ids=[], reason="No technical exercise requested by the HR screen; defer technical practice.")
        submit_proposal(self.store, draft)

    def test_context_and_available_reference_binding(self):
        for field, value in (("context_hash", "0" * 64), ("interview_id", "another-interview"), ("source_refs", ["fabricated"]), ("unknowns", [])):
            draft = self.draft()
            draft[field] = value
            with self.assertRaises(ValueError):
                submit_proposal(self.store, draft)

    def test_core_preparation_defaults_are_configurable_but_never_silently_deferred(self):
        draft = self.draft()
        item = next(c for c in draft["coverage"] if c["area"] == "why_company")
        item.update(disposition="deferred", section_ids=[], reason="Short budget")
        with self.assertRaisesRegex(ValueError, "required preparation areas"):
            submit_proposal(self.store, draft)
        policy = {"required_areas": ["self_introduction", "why_role"], "origin": "user_instruction",
                  "reason": "Synthetic scenario: user explicitly defers company motivation."}
        write_json(self.work / "inputs/context/preparation-policy.json", policy)
        draft["policy_hash"] = digest(policy)
        submit_proposal(self.store, draft)

    def test_policy_change_invalidates_approval_and_priority_change_invalidates_context(self):
        record = submit_proposal(self.store, self.draft())
        approval_id = approve(self.store, record["interview_id"], record["proposal_id"], record["proposal_hash"], "synthetic_test_script: accepts current plan")
        policy = current_policy(self.store).model_dump()
        policy["reason"] = "New user preparation preference"
        write_json(self.work / "inputs/context/preparation-policy.json", policy)
        fake = Mock()
        with self.assertRaises(ValueError):
            run_node(self.work, self.root / "stale-policy", approval_id=approval_id, invoke_fn=fake)
        fake.assert_not_called()
        profile = read_json(self.work / "inputs/profile.json")
        profile["priorities"] = ["Behavioral stories"]
        write_json(self.work / "inputs/profile.json", profile)
        with self.assertRaisesRegex(ValueError, "priorities differ"):
            current_context(self.store)
        capture_request(self.store, self.root / "priorities-capture")
        captured = read_json(self.root / "priorities-capture/request.json")
        self.assertIn("Behavioral stories", next(s for s in captured["sources"] if s["kind"] == "preferences")["content"])

    def test_foreign_candidate_cannot_be_attached_even_with_valid_hashes(self):
        request = copy.deepcopy(self.request)
        candidate = next(s for s in request["sources"] if s["kind"] == "candidate")
        candidate["content"] = "Another fictional candidate's facts."
        candidate["content_sha256"] = hashlib.sha256(candidate["content"].encode()).hexdigest()
        from interview.preparation_context import request_token
        analysis = copy.deepcopy(self.analysis)
        analysis["request_token"] = request_token(ContextRequest.model_validate(request))
        freeze(request, analysis, self.root / "foreign")
        with self.assertRaisesRegex(ValueError, "candidate evidence differs"):
            attach(self.store, self.root / "foreign/preparation-context.json", context_fingerprint(self.store))
        self.assertEqual(current_context(self.store)[2], self.context_hash)

    def test_changed_candidate_or_budget_blocks_generation_before_model(self):
        (self.work / "inputs/sources/canonical-candidate.md").write_text("Changed facts", encoding="utf-8")
        fake = Mock()
        with self.assertRaisesRegex(ValueError, "candidate evidence differs"):
            run_node(self.work, self.root / "node", invoke_fn=fake)
        fake.assert_not_called()

    def test_materials_require_exact_current_plan_acceptance(self):
        record = submit_proposal(self.store, self.draft())
        fake = Mock()
        with self.assertRaises(ValueError):
            run_node(self.work, self.root / "bad-materials", approval_id="not-approved", invoke_fn=fake)
        fake.assert_not_called()
        approval = approve(self.store, record["interview_id"], record["proposal_id"], record["proposal_hash"], "synthetic_test_script: accepts exact plan")
        accepted = submit_material(self.store, approval, self.material(record))
        self.assertTrue(accepted["material_id"].startswith("context-material-"))
        self.assertEqual(latest(self.store, record["interview_id"])["status"], "material_ready")
        submit_proposal(self.store, self.draft())
        with self.assertRaises(ValueError):
            submit_material(self.store, approval, self.material(record))

    def test_rejection_and_source_change_invalidate_material_acceptance(self):
        record = submit_proposal(self.store, self.draft())
        approval = approve(self.store, record["interview_id"], record["proposal_id"], record["proposal_hash"], "synthetic_test_script: accepts exact plan")
        reject(self.store, record["interview_id"], record["proposal_id"])
        with self.assertRaises(ValueError):
            submit_material(self.store, approval, self.material(record))
        record = submit_proposal(self.store, self.draft())
        approval = approve(self.store, record["interview_id"], record["proposal_id"], record["proposal_hash"], "synthetic_test_script: accepts new exact plan")
        (self.work / "inputs/sources/invitation.md").write_text("Updated round", encoding="utf-8")
        with self.assertRaises(ValueError):
            submit_material(self.store, approval, self.material(record))

    def test_plan_node_retains_first_output_and_does_not_autoapprove(self):
        output = self.root / "proposal"
        def fake(work, prompt, schema, destination, settings, **kwargs):
            self.assertTrue(kwargs["smoke"])
            self.assertIn(GUIDANCE, prompt)
            self.assertNotIn("gold.json", prompt)
            return self.invocation({"status": "ready", "proposal": self.draft(), "questions": []})
        result = run_node(self.work, output, invoke_fn=fake)
        self.assertEqual(result["status"], "awaiting_plan_approval")
        self.assertEqual(latest(self.store, self.request["identity"]["interview_id"])["status"], "awaiting_plan_approval")
        with self.assertRaises(FileExistsError):
            run_node(self.work, output, invoke_fn=fake)

    def test_baseline_and_guided_receive_identical_context_and_schema(self):
        prompts, schemas = [], []
        def fake(work, prompt, schema, *args, **kwargs):
            prompts.append(prompt.split("PUBLIC PREPARATION REQUEST:\n")[1])
            schemas.append(read_json(schema))
            return {"status": "environment_error"}
        other = Path(stage(self.context, self.root / "other-stage")["workspace"])
        run_node(self.work, self.root / "simple", method="simple-instruction-v1", invoke_fn=fake)
        run_node(other, self.root / "guided", method="context-balanced-v1", invoke_fn=fake)
        self.assertEqual(prompts[0], prompts[1])
        self.assertEqual(schemas[0], schemas[1])

    def test_source_mutation_and_invalid_coverage_are_retained_failures(self):
        draft = self.draft()
        draft["coverage"][0]["section_ids"] = ["invented"]
        result = run_node(self.work, self.root / "invalid", invoke_fn=lambda *a, **k: self.invocation({"status": "ready", "proposal": draft, "questions": []}))
        self.assertEqual(result["status"], "validation_failed")
        self.assertIsNone(latest(self.store, self.request["identity"]["interview_id"]))
        self.assertTrue((self.root / "invalid/invocation-result.json").exists())
        def mutate(*args, **kwargs):
            with self.store.connect() as db:
                db.execute("INSERT INTO history VALUES (?,?)", ("new-report", '{"record_id":"new-report","text":"A fresh report"}'))
            return self.invocation({"status": "ready", "proposal": self.draft(), "questions": []})
        result = run_node(self.work, self.root / "changed", invoke_fn=mutate)
        self.assertEqual(result["status"], "validation_failed")
        self.assertIn("changed during invocation", result["error"])

    def test_pilot_acceptance_is_explicit_synthetic_and_only_for_selected_audit(self):
        calls = []
        def fake(work, prompt, *args, **kwargs):
            payload = json.loads(prompt.split("PUBLIC PREPARATION REQUEST:\n")[1])
            calls.append(payload["phase"])
            output = ({"status": "ready", "material": self.material(payload["approved_proposal"]), "questions": []}
                      if payload["phase"] == "materials" else {"status": "ready", "proposal": self.draft(), "questions": []})
            return self.invocation(output)
        output = self.root / "pilot"
        with redirect_stdout(io.StringIO()):
            summary = run_pilot([self.context], output, material_audit=(self.request["identity"]["interview_id"], "context-balanced-v1"), invoke_fn=fake)
        self.assertEqual(calls.count("proposal"), 2)
        self.assertEqual(calls.count("materials"), 1)
        for row in summary["results"]:
            folder = output / row["result_directory"]
            decision = folder / "synthetic-plan-decision.json"
            if row["method"] == "context-balanced-v1":
                self.assertEqual(read_json(decision)["origin"], "synthetic_test_script")
                self.assertEqual(row["material_audit"]["status"], "material_ready")
            else:
                self.assertFalse(decision.exists())
                self.assertEqual(row["status"], "awaiting_plan_approval")
        with self.assertRaises(FileExistsError):
            run_pilot([self.context], output, invoke_fn=fake)
        self.assertEqual(len(calls), 3)


if __name__ == "__main__":
    unittest.main()
