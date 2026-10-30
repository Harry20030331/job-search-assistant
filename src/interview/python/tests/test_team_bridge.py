"""Shared-input freshness and safe staging; entirely fictional, no external calls."""
import hashlib
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock

from evaluation.preparation_flow import run_node
from interview.freshness import check
from interview.storage import Store, read_json
from interview.team_bridge import stage


class TeamBridgeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.source = self.root / "candidate.json"
        self.source.write_text('{"fictional":true}', encoding="utf-8")
        self.bundle = {"schemaVersion": 1, "token": "fixture-token",
            "sourceVersions": [{"path": str(self.source), "sha256": hashlib.sha256(self.source.read_bytes()).hexdigest()}],
            "profile": {"preparation_budget_minutes": 90, "priorities": ["Projects"]},
            "application": {"job_id": "fictional-job", "application_id": None, "interview_id": "fictional-interview"},
            "sources": {"invitation": "Entirely fictional invitation", "canonical-candidate": "Fictional facts", "preferences": "Explicit scope"}}

    def tearDown(self):
        self.temp.cleanup()

    def test_stage_preserves_ids_without_live_backend_or_approvals(self):
        result = stage(self.bundle, self.root / "run")
        store = Store(Path(result["workspace"]))
        self.assertIsNone(store.optional_meta("backend"))
        self.assertEqual(read_json(store.workspace / "inputs/application.json")["application_id"], None)
        self.assertEqual(result["google_writes"], 0)
        check(store)
        with self.assertRaises(FileExistsError):
            stage(self.bundle, self.root / "run")

    def test_changed_canonical_input_blocks_model_invocation(self):
        result = stage(self.bundle, self.root / "run")
        self.source.write_text('{"fictional":"changed"}', encoding="utf-8")
        fake = Mock()
        with self.assertRaises(ValueError):
            run_node(Path(result["workspace"]), self.root / "proposal", invoke_fn=fake)
        fake.assert_not_called()

    def test_stale_input_is_rejected_before_creating_output(self):
        self.source.write_text("changed", encoding="utf-8")
        with self.assertRaises(ValueError):
            stage(self.bundle, self.root / "run")
        self.assertFalse((self.root / "run").exists())


if __name__ == "__main__":
    unittest.main()
