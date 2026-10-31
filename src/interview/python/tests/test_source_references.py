"""Exact source catalogs constrain generation; invalid references remain rejected."""
import copy
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock

import test_preparation_protocol
from evaluation.workflow import Actor
from interview.preparation import known_refs, reference_schema, source_catalog, ProposalNodeResult, MaterialNodeResult, SOURCE_REFERENCE_CONTRACT
from interview.preparation_flow import run_node
from interview.storage import read_json, Store
from interview.tools import execute


def enums(schema):
    result = []
    def visit(value):
        if isinstance(value, dict):
            for name, field in value.get("properties", {}).items():
                if name in {"source_refs", "basis_refs"}: result.append(field.get("items", {}).get("enum"))
            for child in value.values(): visit(child)
        elif isinstance(value, list):
            for child in value: visit(child)
    visit(schema)
    return result


class SourceReferenceTests(unittest.TestCase):
    def setUp(self):
        test_preparation_protocol.PreparationProtocolTests.setUp(self)
        (self.root / "inputs/mail").mkdir()
        (self.root / "inputs/mail/invite.eml").write_text("Message-ID: <fictional@example.invalid>\n\nFictional interview")

    def tearDown(self): self.temp.cleanup()

    def invoke(self, draft=None):
        return Mock(return_value={"status": "completed", "successful_shell_command_count": 1,
            "output": {"status": "ready", "proposal": draft or self.draft, "questions": []}})

    def test_catalog_uses_alias_not_message_header_for_all_reference_fields(self):
        refs = known_refs(self.store)
        self.assertIn("invite", refs)
        self.assertNotIn("invite: <fictional@example.invalid>", refs)
        for model in (ProposalNodeResult, MaterialNodeResult):
            self.assertTrue(enums(reference_schema(model, refs)))
            self.assertTrue(all(value == sorted(refs) for value in enums(reference_schema(model, refs))))

    def test_catalog_points_reserved_ids_and_mail_to_their_actual_read_interfaces(self):
        catalog = {entry["source_id"]: entry for entry in source_catalog(self.store)}
        self.assertEqual(set(catalog), known_refs(self.store))
        self.assertEqual(catalog["profile"]["access"]["operation"], "context.get")
        self.assertEqual(catalog["application"]["access"]["operation"], "context.get")
        self.assertEqual(catalog["invite"]["access"]["operation"], "mail.read")
        access = catalog["invite"]["access"]
        messages = execute(self.store, access["operation"], access["arguments"])
        self.assertEqual([message["source_id"] for message in messages], ["invite"])
        self.assertEqual(execute(self.store, "context.get", {})["profile"]["preparation_budget_minutes"], 90)

    def test_real_node_supplies_catalog_and_constrained_schema(self):
        invoke = self.invoke()
        result = run_node(self.root, self.root / "node", invoke_fn=invoke)
        self.assertEqual(result["status"], "awaiting_plan_approval")
        prompt = invoke.call_args.args[1]
        self.assertIn("Mail Message-ID headers", prompt)
        self.assertIn('"invite"', prompt)
        self.assertEqual(read_json(self.root / "node/source-reference-contract.json")["contract"], SOURCE_REFERENCE_CONTRACT)
        self.assertTrue(all(value == sorted(known_refs(self.store)) for value in enums(read_json(invoke.call_args.args[2]))))

    def test_exact_failed_output_is_still_rejected_without_automatic_repair(self):
        draft = copy.deepcopy(self.draft); draft["source_refs"] = ["invite: <fictional@example.invalid>"]
        result = run_node(self.root, self.root / "bad", invoke_fn=self.invoke(draft))
        self.assertEqual(result["status"], "validation_failed")
        self.assertIn("unavailable or inactive sources", result["error"])
        self.assertFalse((self.root / "bad/accepted.json").exists())

    def test_historical_baseline_opt_out_preserves_prompt_and_schema(self):
        invoke = self.invoke()
        run_node(self.root, self.root / "legacy", invoke_fn=invoke, reference_mode="legacy")
        self.assertNotIn("allowed_source_ids", invoke.call_args.args[1])
        self.assertTrue(all(value is None for value in enums(read_json(invoke.call_args.args[2]))))
        self.assertFalse((self.root / "legacy/source-reference-contract.json").exists())

    def test_baseline_actor_does_not_receive_the_production_guidance(self):
        schema = self.root / "node.schema.json"; schema.write_text("{}")
        for mode in ("legacy", SOURCE_REFERENCE_CONTRACT):
            response = Mock(return_value={"status": "completed", "successful_shell_command_count": 1, "output": {}})
            actor = Actor({}, response, reference_mode=mode)
            destination = self.root / mode
            actor.call(self.root, {"phase": "next_proposal"}, schema, destination)
            request = read_json(destination / "public_request.json")
            self.assertEqual("allowed_source_ids" in request, mode != "legacy")
