"""Model-node isolation and retention checks, without model or network calls."""
import tempfile
import unittest
import io
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import Mock

from interview.context_flow import COMMON, GUIDANCE, run_analysis
from interview.preparation_context import ContextRequest, load_context, request_token
from interview.settings import load_settings
from interview.storage import read_json, write_json
from evaluation.context_pilot import run_pilot

ROOT = Path(__file__).resolve().parents[1]


class ContextFlowTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.path = self.root / "request.json"
        payload = read_json(ROOT / "benchmark/context-v1.1/C05/request.json")
        write_json(self.path, payload)
        self.request = ContextRequest.model_validate(payload)
        self.settings = load_settings()

    def tearDown(self):
        self.temp.cleanup()

    def node(self):
        invitation = next(s for s in self.request.sources if s.kind == "invitation")
        return {"status": "ready", "questions": [], "analysis": {"request_token": request_token(self.request),
            "jd": {"status": "analogue", "source_ids": ["jd"], "reason": "Different same-company role", "limitations": ["Not the selected role's requirements."]},
            "role_focus": [], "round_focus": [], "candidate_links": [], "company_brief": [], "reported_themes": [], "learning": [],
            "seniority": {"value": None, "assessment": "unknown", "reason": "Selected-role level is not stated.", "refs": []},
            "round_label": {"value": "hiring_manager", "assessment": "confirmed", "reason": "Explicit invitation label.",
                            "refs": [{"source_id": "invitation", "quote": invitation.content}]},
            "unknowns": ["The actual hiring-manager topics are unknown."], "questions": []}}

    def invocation(self, node=None):
        return {"status": "completed", "output": node or self.node(), "shell_command_count": 0, "thread_id": "fake-test-session"}

    def run_node(self, output="node", **kwargs):
        return run_analysis(self.path, self.root / output, settings=self.settings, **kwargs)

    def test_guided_analysis_receives_only_public_evidence_and_is_frozen(self):
        calls = []
        def fake(work, prompt, schema, dest, settings, **kwargs):
            calls.append((prompt, kwargs))
            self.assertFalse(list(work.iterdir()))
            self.assertNotIn("round_focus_expected", prompt)
            self.assertNotIn("review_notes", prompt)
            self.assertNotIn("gold.json", prompt)
            return self.invocation()
        result = self.run_node(invoke_fn=fake)
        self.assertEqual(result["status"], "context_ready")
        self.assertTrue(result["mechanical_passed"])
        self.assertEqual(calls[0][1], {"smoke": True})
        self.assertIn(GUIDANCE, calls[0][0])
        self.assertEqual(result["semantic_quality"], "pending_unrated")
        request, analysis = load_context(self.root / "node/validated/preparation-context.json")
        self.assertEqual(analysis.round_label.assessment, "confirmed")
        self.assertEqual(analysis.round_focus, [])
        self.assertEqual(request_token(request), request_token(self.request))

    def test_baseline_and_guided_have_identical_evidence_and_schema(self):
        prompts = []
        def fake(work, prompt, *args, **kwargs):
            prompts.append(prompt)
            return self.invocation()
        self.run_node("baseline", method="simple-instruction-v1", invoke_fn=fake)
        self.run_node("guided", method="context-guided-v1", invoke_fn=fake)
        self.assertEqual(prompts[0].split("PUBLIC EVIDENCE REQUEST:\n")[1], prompts[1].split("PUBLIC EVIDENCE REQUEST:\n")[1])
        self.assertNotIn(GUIDANCE, prompts[0])
        self.assertTrue(prompts[0].startswith(COMMON))
        self.assertEqual(read_json(self.root / "baseline/analysis.schema.json"), read_json(self.root / "guided/analysis.schema.json"))

    def test_mispromoted_analogue_is_retained_as_first_failure_without_repair(self):
        node = self.node()
        node["analysis"]["jd"]["status"] = "exact"
        fake = Mock(return_value=self.invocation(node))
        result = self.run_node(invoke_fn=fake)
        self.assertEqual(result["status"], "validation_failed")
        self.assertFalse((self.root / "node/validated").exists())
        self.assertEqual(read_json(self.root / "node/invocation-result.json")["output"], node)
        with self.assertRaises(FileExistsError):
            self.run_node(invoke_fn=fake)
        self.assertEqual(fake.call_count, 1)

    def test_modified_request_or_schema_invalidates_node(self):
        for number, mutate_schema in enumerate((False, True)):
            original = self.path.read_bytes()
            def fake(work, prompt, schema, *args, **kwargs):
                if mutate_schema:
                    schema.write_text("{}", encoding="utf-8")
                else:
                    payload = read_json(self.path)
                    payload["budget_minutes"] = 20
                    write_json(self.path, payload)
                return self.invocation()
            result = self.run_node("changed-" + str(number), invoke_fn=fake)
            self.assertEqual(result["status"], "validation_failed")
            self.assertIn("changed during analysis", result["error"])
            self.path.write_bytes(original)

    def test_unresolved_association_retains_question_and_prevents_ready_context(self):
        payload = self.request.model_dump(mode="json")
        payload["association"] = "unresolved"
        write_json(self.path, payload)
        self.request = ContextRequest.model_validate(payload)
        node = self.node()
        node["analysis"]["questions"] = ["Which application is this invitation for?"]
        result = self.run_node(invoke_fn=lambda *a, **k: self.invocation(node))
        self.assertEqual(result["status"], "awaiting_clarification")
        self.assertTrue(result["questions"])

    def test_deferred_node_does_not_fabricate_a_validated_context(self):
        node = {"status": "needs_input", "analysis": None, "questions": ["Please identify the interview."]}
        result = self.run_node(invoke_fn=lambda *a, **k: self.invocation(node))
        self.assertEqual(result["status"], "needs_input")
        self.assertFalse(result["mechanical_passed"])
        self.assertFalse((self.root / "node/validated").exists())

    def test_command_use_is_a_recorded_protocol_violation(self):
        invocation = self.invocation()
        invocation["shell_command_count"] = 1
        result = self.run_node(invoke_fn=lambda *a, **k: invocation)
        self.assertEqual(result["status"], "validation_failed")
        self.assertIn("inline-only", result["error"])

    def test_environment_failure_is_retained_without_fake_analysis(self):
        result = self.run_node(invoke_fn=lambda *a, **k: {"status": "environment_error"})
        self.assertEqual(result["status"], "environment_error")
        self.assertFalse(result["mechanical_passed"])
        self.assertIsNone(result["agent_cost_usd"])

    def test_project_instructions_block_invocation_before_any_output(self):
        (self.root / "AGENTS.md").write_text("Project instructions", encoding="utf-8")
        fake = Mock()
        with self.assertRaisesRegex(ValueError, "instruction ancestors"):
            self.run_node(invoke_fn=fake)
        fake.assert_not_called()
        self.assertFalse((self.root / "node").exists())

    def test_pilot_retains_failed_attempts_and_never_injects_evaluator_labels(self):
        calls = []
        def fake(work, prompt, *args, **kwargs):
            self.assertNotIn("round_focus_expected", prompt)
            self.assertNotIn("review_notes", prompt)
            calls.append(1)
            return {"status": "environment_error"}
        dataset = ROOT / "benchmark/context-v1.1"
        output = self.root / "pilot"
        with redirect_stdout(io.StringIO()):
            result = run_pilot(dataset, output, ["C05", "C08"], invoke_fn=fake)
        self.assertEqual((result["planned"], result["attempted"], len(calls)), (4, 4, 4))
        self.assertTrue(all(r["status"] == "environment_error" for r in result["results"]))
        self.assertTrue(all(r["semantic_quality"] == "pending_unrated" for r in result["results"]))
        with self.assertRaises(FileExistsError):
            run_pilot(dataset, output, ["C05", "C08"], invoke_fn=fake)
        self.assertEqual(len(calls), 4)


if __name__ == "__main__":
    unittest.main()
