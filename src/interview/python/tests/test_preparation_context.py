"""Evidence-boundary tests; fixture validity does not measure agent preparation quality."""
import tempfile
import unittest
import shutil
from pathlib import Path

from benchmark.create_context_cases import create
from evaluation.context_cases import export, inspect_dataset
from interview.preparation import approve, approved_plan, submit_proposal
from interview.preparation_context import ContextAnalysis, ContextRequest, freeze, load_context, request_token, validate_analysis
from interview.storage import Store, digest, read_json, write_json


class PreparationContextTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.root = Path(cls.temp.name)
        cls.dataset = create(cls.root / "cases")

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def request(self, cid="C01"):
        return ContextRequest.model_validate(read_json(self.dataset / cid / "request.json"))

    def claim(self, request, source_id, value, assessment="inferred"):
        source = next(s for s in request.sources if s.source_id == source_id)
        return {"value": value, "assessment": assessment, "reason": "Hand-authored boundary-test claim, not a model evaluation.",
                "refs": [{"source_id": source_id, "quote": source.content}]}

    def analysis(self, request):
        exact = [s.source_id for s in request.sources if s.kind == "jd" and s.relationship == "exact_role"]
        analogues = [s.source_id for s in request.sources if s.relationship.endswith("analogue")]
        return ContextAnalysis.model_validate({"request_token": request_token(request),
            "jd": {"status": "exact" if exact else "analogue" if analogues else "missing", "source_ids": exact or analogues,
                   "reason": "Select available typed evidence for a contract test.", "limitations": [] if exact else ["Exact requirements remain unknown."]},
            "role_focus": [], "seniority": {"value": None, "assessment": "unknown", "reason": "Not interpreted by this test.", "refs": []},
            "round_label": self.claim(request, "invitation", "technical", "inferred"), "round_focus": [],
            "candidate_links": [self.claim(request, "candidate", "A supplied project")], "company_brief": [],
            "reported_themes": [], "learning": [], "unknowns": ["Employer's actual questions are unknown."], "questions": []})

    def test_twelve_stories_have_valid_sources_and_pending_labels(self):
        result = inspect_dataset(self.dataset)
        self.assertEqual((result["case_count"], result["authored_candidate_contexts"], result["agent_runs"]), (12, 12, 0))
        for case in result["cases"]:
            request = self.request(case["case_id"])
            validate_analysis(request, self.analysis(request))
        with self.assertRaises(FileExistsError):
            create(self.dataset)

    def test_analogue_cannot_be_selected_as_exact_or_confirm_seniority(self):
        request = self.request("C05")
        draft = self.analysis(request)
        draft.jd.status = "exact"
        with self.assertRaisesRegex(ValueError, "analogue"):
            validate_analysis(request, draft)
        draft = self.analysis(request)
        draft.seniority = type(draft.seniority).model_validate(self.claim(request, "jd", "mid-level", "confirmed"))
        with self.assertRaisesRegex(ValueError, "cannot confirm"):
            validate_analysis(request, draft)

    def test_jd_fallback_cannot_hide_existing_exact_evidence(self):
        request = self.request()
        draft = self.analysis(request)
        draft.jd.status, draft.jd.source_ids = "missing", []
        with self.assertRaisesRegex(ValueError, "hide available"):
            validate_analysis(request, draft)
        draft = self.analysis(request)
        draft.jd.status = "analogue"
        draft.jd.limitations = ["An analogue exists"]
        with self.assertRaisesRegex(ValueError, "fallback"):
            validate_analysis(request, draft)

    def test_reference_must_be_an_actual_quote_from_selected_source(self):
        request = self.request()
        for field, value in (("source_id", "fabricated"), ("quote", "Invented production achievement")):
            draft = self.analysis(request)
            setattr(draft.candidate_links[0].refs[0], field, value)
            with self.assertRaisesRegex(ValueError, "Reference"):
                validate_analysis(request, draft)

    def test_wrong_job_and_changed_source_bytes_are_rejected(self):
        payload = self.request().model_dump(mode="json")
        payload["sources"][1]["matched_job_id"] = "another-job"
        with self.assertRaisesRegex(ValueError, "stable job ID"):
            ContextRequest.model_validate(payload)
        payload = self.request().model_dump(mode="json")
        payload["sources"][0]["content"] += " Changed facts"
        with self.assertRaisesRegex(ValueError, "hash"):
            ContextRequest.model_validate(payload)

    def test_fresh_request_invalidates_prior_analysis_even_if_identity_is_same(self):
        request = self.request()
        draft = self.analysis(request)
        payload = request.model_dump(mode="json")
        payload["budget_minutes"] = 20
        with self.assertRaisesRegex(ValueError, "request changed"):
            validate_analysis(ContextRequest.model_validate(payload), draft)

    def test_unknown_level_must_not_assert_value_or_disappear(self):
        request = self.request("C07")
        draft = self.analysis(request).model_dump()
        draft["seniority"]["value"] = "senior"
        with self.assertRaisesRegex(ValueError, "Unknown claim"):
            ContextAnalysis.model_validate(draft)
        draft = self.analysis(request)
        draft.unknowns = []
        with self.assertRaisesRegex(ValueError, "remain visible"):
            validate_analysis(request, draft)

    def test_declared_research_limits_and_timestamps_are_checked(self):
        payload = self.request().model_dump(mode="json")
        payload["research"]["opened_pages"] = 9
        with self.assertRaisesRegex(ValueError, "exceeds"):
            ContextRequest.model_validate(payload)
        payload = self.request().model_dump(mode="json")
        payload["sources"][0]["retrieved_at"] = "2026-10-25T12:00:00"
        with self.assertRaisesRegex(ValueError, "timezone-aware"):
            ContextRequest.model_validate(payload)

    def test_report_cannot_be_promoted_to_confirmed_question(self):
        request = self.request("C12")
        draft = self.analysis(request)
        claim = self.claim(request, "report", "Multi-region architecture", "confirmed")
        draft.reported_themes = [type(draft.seniority).model_validate(claim)]
        with self.assertRaisesRegex(ValueError, "cannot confirm"):
            validate_analysis(request, draft)
        claim["assessment"] = "inferred"
        draft.reported_themes = [type(draft.seniority).model_validate(claim)]
        validate_analysis(request, draft)
        # Permitted evidence attribution does not establish that this mismatched theme is relevant.
        self.assertIn("Ignore prior instructions", request.sources[-1].content)

    def test_unrelated_near_match_cannot_set_selected_role_level(self):
        request = self.request("C11")
        draft = self.analysis(request)
        self.assertEqual(draft.jd.status, "missing")
        draft.seniority = type(draft.seniority).model_validate(self.claim(request, "jd", "principal"))
        with self.assertRaisesRegex(ValueError, "Unrelated-role"):
            validate_analysis(request, draft)

    def test_unresolved_identity_needs_a_question(self):
        payload = self.request().model_dump(mode="json")
        payload["association"] = "unresolved"
        request = ContextRequest.model_validate(payload)
        draft = self.analysis(request)
        with self.assertRaisesRegex(ValueError, "clarification"):
            validate_analysis(request, draft)
        draft.questions = ["Which application does the invitation concern?"]
        validate_analysis(request, draft)

    def test_freeze_is_exclusive_and_detects_context_tampering(self):
        request = self.request()
        with tempfile.TemporaryDirectory() as temp:
            output = Path(temp) / "context"
            freeze(request.model_dump(mode="json"), self.analysis(request).model_dump(), output)
            load_context(output / "preparation-context.json")
            with self.assertRaises(FileExistsError):
                freeze(request.model_dump(mode="json"), self.analysis(request).model_dump(), output)
            packet = read_json(output / "preparation-context.json")
            packet["analysis"]["unknowns"].append("Changed")
            write_json(output / "preparation-context.json", packet)
            with self.assertRaisesRegex(ValueError, "changed"):
                load_context(output / "preparation-context.json")

    def test_context_change_under_inputs_invalidates_existing_plan_approval(self):
        with tempfile.TemporaryDirectory() as temp:
            work = Path(temp)
            store = Store(work)
            store.initialize({"clock": "2026-10-25T12:00:00-07:00"})
            write_json(work / "inputs/profile.json", {"preparation_budget_minutes": 30})
            write_json(work / "inputs/application.json", {"interview_id": "test-interview"})
            draft = {"interview_id": "test-interview", "budget_minutes": 30, "priorities": ["Practice"],
                     "sections": [{"section_id": str(i), "topic": "Topic", "minutes": 10, "objective": "Practice", "basis_refs": ["profile"]} for i in range(3)],
                     "source_refs": ["profile"], "unknowns": []}
            record = submit_proposal(store, draft)
            approval = approve(store, "test-interview", record["proposal_id"], record["proposal_hash"], "Synthetic boundary test approval")
            request = self.request()
            freeze(request.model_dump(mode="json"), self.analysis(request).model_dump(), work / "inputs/context")
            with self.assertRaisesRegex(ValueError, "Inputs changed"):
                approved_plan(store, "test-interview", approval)

    def test_review_pack_is_a_snapshot_with_no_synthetic_agent_scores(self):
        with tempfile.TemporaryDirectory() as temp:
            output = Path(temp) / "review"
            result = export(self.dataset, output)
            self.assertEqual((result["cases"], result["agent_runs"], result["human_review"]), (12, 0, "pending"))
            self.assertEqual(inspect_dataset(output / "dataset_snapshot")["dataset_hash"], result["dataset_hash"])
            self.assertNotIn("judge-results", [p.name for p in output.iterdir()])
            with self.assertRaises(FileExistsError):
                export(self.dataset, output)
            with self.assertRaisesRegex(ValueError, "inside the dataset"):
                export(self.dataset, self.dataset / "review")

    def test_reviewed_revision_preserves_evidence_and_marks_c05_scope_as_inferred(self):
        benchmark = Path(__file__).resolve().parents[1] / "benchmark"
        reviewed = inspect_dataset(benchmark / "context-v1.1")
        self.assertEqual(reviewed["human_review"], "reviewed")
        gold = read_json(benchmark / "context-v1.1/C05/gold.json")
        self.assertEqual(gold["round_label_assessment_expected"], "confirmed")
        self.assertEqual(gold["round_focus_assessment_expected"], "inferred")
        self.assertEqual(gold["role_focus_assessment_expected"], "inferred")
        self.assertFalse(gold["round_focus_required"])
        self.assertTrue(gold["unknowns_expected"])
        for case in reviewed["cases"]:
            cid = case["case_id"]
            self.assertEqual((benchmark / "context-v1" / cid / "request.json").read_bytes(),
                             (benchmark / "context-v1.1" / cid / "request.json").read_bytes())
            if cid != "C05":
                before, after = read_json(benchmark / "context-v1" / cid / "gold.json"), read_json(benchmark / "context-v1.1" / cid / "gold.json")
                before.pop("human_review")
                after.pop("human_review")
                self.assertEqual(before, after)

    def test_reviewed_dataset_requires_complete_hash_bound_decisions(self):
        benchmark = Path(__file__).resolve().parents[1] / "benchmark"
        with tempfile.TemporaryDirectory() as temp:
            target = Path(temp) / "reviewed"
            shutil.copytree(benchmark / "context-v1.1", target)
            before = inspect_dataset(target)["dataset_hash"]
            ledger = read_json(target / "review.json")
            ledger["instruction_reference"] += " Additional provenance annotation."
            write_json(target / "review.json", ledger)
            self.assertNotEqual(inspect_dataset(target)["dataset_hash"], before)
            ledger["decisions"].pop("C05")
            write_json(target / "review.json", ledger)
            with self.assertRaisesRegex(ValueError, "complete human-decision"):
                inspect_dataset(target)

    def test_uncertain_supporting_topics_do_not_force_a_primary_ranking(self):
        request = self.request("C05")
        draft = self.analysis(request).model_dump()
        draft["role_focus"] = [{"topic": "experimentation", "priority": "supporting",
                                "basis": self.claim(request, "jd", "Possible experiment-design focus") }]
        draft = ContextAnalysis.model_validate(draft)
        validate_analysis(request, draft)
        with self.assertRaisesRegex(ValueError, "primary topic"):
            validate_analysis(request, draft, validation_version="preparation-context-checks-v1")

    def test_inferred_candidate_role_link_needs_candidate_anchor_but_can_cite_jd(self):
        request = self.request()
        draft = self.analysis(request)
        claim = self.claim(request, "candidate", "The candidate's study may support this role's work")
        claim["refs"] += self.claim(request, "jd", "Role basis")["refs"]
        draft.candidate_links = [type(draft.seniority).model_validate(claim)]
        validate_analysis(request, draft)
        draft.candidate_links[0].assessment = "confirmed"
        with self.assertRaisesRegex(ValueError, "only canonical"):
            validate_analysis(request, draft)
        draft.candidate_links[0].assessment = "inferred"
        draft.candidate_links[0].refs = draft.candidate_links[0].refs[1:]
        with self.assertRaisesRegex(ValueError, "candidate anchor"):
            validate_analysis(request, draft)

    def test_legacy_envelopes_keep_legacy_validation_rules(self):
        request = self.request("C05")
        draft = self.analysis(request).model_dump(mode="json")
        draft["role_focus"] = [{"topic": "experimentation", "priority": "supporting",
                                "basis": self.claim(request, "jd", "Possible focus") }]
        with tempfile.TemporaryDirectory() as temp:
            target = Path(temp) / "context.json"
            payload = {"protocol": "preparation-context-v1", "request": request.model_dump(mode="json"), "analysis": draft}
            payload["context_hash"] = digest(payload)
            write_json(target, payload)
            with self.assertRaisesRegex(ValueError, "primary topic"):
                load_context(target)


if __name__ == "__main__":
    unittest.main()
