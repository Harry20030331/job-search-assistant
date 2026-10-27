"""Challenge selection, label isolation and diagnostic accounting; no model calls."""
import copy
import csv
import io
import json
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path

from evaluation.preparation_quality import DIMENSIONS
from evaluation.preparation_quality_controls import DATASET, export, judge_pack, report, validate_suite, verify
from interview.storage import read_json, write_json


class PreparationControlTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name) / "pack"
        export(self.root)

    def tearDown(self):
        self.temp.cleanup()

    def run_mock(self, constant=False):
        _, index, packets, _, _ = verify(self.root)
        expectations = {packets[row["sample_id"]]["output_text"]: row for row in index}
        calls = []
        def fake(messages, schema, **kwargs):
            packet = json.loads(messages[1]["content"])
            # This lookup belongs to the mock only; real requests contain no gold.
            expected = expectations[packet["output_text"]]
            calls.append(packet)
            evidence = next(iter(packet["evidence_catalog"]["output"]))
            value = {"dimensions": [{"name": name,
                "score": 2 if constant or name != expected["target_dimension"] else expected["expected_target_score"],
                "output_evidence_ids": [evidence], "source_evidence_ids": [], "reason": "Mock mechanics test, not quality evidence."}
                for name in DIMENSIONS], "serious_errors": [], "uncertain_items": [], "summary": "Mock only"}
            return {"parsed": value, "usage": {"cost": 0}, "model": "mock"}
        with redirect_stdout(io.StringIO()):
            judge_pack(self.root, request_fn=fake)
            judge_pack(self.root, request_fn=fake)
        self.assertEqual(len(calls), 12)
        return report(self.root)

    def test_gold_and_variant_labels_are_not_in_judge_or_human_packets(self):
        manifest, index, packets, rubric, _ = verify(self.root)
        self.assertEqual((manifest["source_stories"], manifest["planned_artifacts"]), (4, 12))
        page = (self.root / "human-review.html").read_text(encoding="utf-8")
        for packet in packets.values():
            text = json.dumps(packet)
            self.assertNotIn("expected_target_score", text)
            self.assertNotIn("variant_id", text)
            self.assertNotIn("story_id", text)
            self.assertNotIn("target_dimension", text)
        self.assertNotIn("expected_target_score", page)
        self.assertNotIn("impossible_repetitions", page)
        for story in {r["story_id"] for r in index}:
            group = [packets[r["sample_id"]] for r in index if r["story_id"] == story]
            self.assertEqual(group[0]["request"], group[1]["request"])
            self.assertEqual(group[1]["request"], group[2]["request"])
            self.assertEqual(group[0]["approved_proposal"], group[2]["approved_proposal"])

    def test_frozen_expectations_and_packet_edits_are_rejected(self):
        for relative in ("private-expectations.json", "suite-snapshot.json", "rubric.md"):
            path = self.root / relative
            original = path.read_bytes()
            path.write_bytes(original + b" ")
            with self.assertRaisesRegex(ValueError, "Frozen challenge"):
                verify(self.root)
            path.write_bytes(original)
        with self.assertRaises(FileExistsError):
            export(self.root)

    def test_suite_requires_severity_coverage_and_stage_binding(self):
        original = read_json(DATASET)
        invalid = copy.deepcopy(original)
        invalid["stories"][0]["variants"][0]["expected_target_score"] = 1
        with self.assertRaises(ValueError):
            validate_suite(invalid)
        invalid = copy.deepcopy(original)
        invalid["stories"][2]["approved_sections"] = None
        with self.assertRaises(ValueError):
            validate_suite(invalid)

    def test_blank_review_keeps_all_dimensions_pending(self):
        with (self.root / "ratings-template.csv").open(encoding="utf-8-sig", newline="") as stream:
            rows = list(csv.DictReader(stream))
        self.assertEqual(len(rows), 72)
        self.assertTrue(all(not r["score"] and not r["reason"] and not r["rater_id"] for r in rows))

    def test_mock_anchor_results_and_story_order_are_counted_without_human_validation(self):
        result = self.run_mock()
        self.assertEqual(result["target_anchor_agreement"]["matched"], 12)
        self.assertEqual(result["defect_detection"]["matched"], 8)
        self.assertEqual(result["severe_zero_detection"]["matched"], 4)
        self.assertTrue(all(row["strict_order"] for row in result["ordinal_by_story"]))
        self.assertFalse(result["human_calibrated"])
        self.assertEqual(result["expected_serious_categories"]["matched"], 0)

    def test_constant_two_is_not_a_successful_defect_detector(self):
        result = self.run_mock(constant=True)
        self.assertEqual(result["target_anchor_agreement"]["matched"], 4)
        self.assertEqual(result["defect_detection"]["matched"], 0)
        self.assertEqual(result["clean_two_retention"]["matched"], 4)
        self.assertTrue(all(not row["strict_order"] for row in result["ordinal_by_story"]))

    def test_missing_judge_outputs_stay_missing_and_receipt_changes_fail(self):
        manifest, _, _, _, _ = verify(self.root)
        write_json(self.root / "judge-status.json", {"pack_fingerprint": manifest["pack_fingerprint"], "results": []})
        result = report(self.root)
        self.assertEqual(result["target_anchor_agreement"], {"planned": 12, "scored": 0, "matched": 0, "rate_among_scored": None})
        self.assertTrue(all(row["observed_target_score"] is None for row in result["cases"]))
        self.run_mock()
        receipt = read_json(self.root / "judge-status.json")["results"][0]
        path = self.root / receipt["result_file"]
        path.write_bytes(path.read_bytes() + b" ")
        with self.assertRaisesRegex(ValueError, "Judge result changed"):
            report(self.root)


if __name__ == "__main__":
    unittest.main()
