"""Semantic audit mechanics with mocked judgments, never agent-quality measurements."""
import copy
import csv
import io
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path

from evaluation.preparation_quality import DIMENSIONS, RUBRIC, evaluate, judgment_schema, resolve_evidence, validate_judgment
from evaluation.preparation_quality_review import compare, export, judge_pack, load_ratings, verify_pack
from interview.context_preparation import default_policy
from interview.settings import load_settings
from interview.storage import read_json, write_json

ROOT = Path(__file__).resolve().parents[1]


class PreparationQualityTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.pilot, self.pack = self.root / "pilot", self.root / "review"
        schedule = []
        for cid in ("C03", "C08"):
            request = read_json(ROOT / "benchmark/context-v1.1" / cid / "request.json")
            draft = {"context_hash": "private-context-hash", "policy_hash": "private-policy-hash", "interview_id": request["identity"]["interview_id"],
                "budget_minutes": request["budget_minutes"], "priorities": ["Mock audit fixture"], "unknowns": ["Motivation unknown"],
                "sections": [{"section_id": "s1", "topic": "Common preparation", "minutes": request["budget_minutes"],
                    "objective": "Rehearse actual facts", "basis_refs": ["candidate"], "focus_topics": ["self_introduction"],
                    "depth": "foundational", "rationale": "Mock fixture only", "deliverable": "One outline"}],
                "coverage": [{"area": d, "disposition": "included", "section_ids": ["s1"], "reason": "Mock fixture"} for d in
                             ("self_introduction", "why_company", "why_role", "behavioral", "role_round_practice", "interviewer_questions")]}
            for method in ("simple-instruction-v1", "context-balanced-v1"):
                audit = cid == "C03" and method == "context-balanced-v1"
                schedule.append({"key": cid.lower(), "method": method, "interview_id": request["identity"]["interview_id"], "synthetic_accept_material_audit": audit})
                node = self.pilot / (cid.lower() + "--" + method)
                public = {"request": request, "analysis": {"unknowns": ["Motivation unknown"]}, "preparation_policy": default_policy(),
                          "approved_proposal": None, "previous_proposal": None}
                write_json(node / "proposal/public_request.json", public)
                write_json(node / "proposal/invocation-result.json", {"output": {"proposal": draft}})
                if audit:
                    approved = {"proposal_id": "private-proposal-id", "proposal_hash": "private-proposal-hash", "version": 1, "draft": draft}
                    write_json(node / "materials/public_request.json", {**public, "approved_proposal": approved})
                    write_json(node / "materials/invocation-result.json", {"output": {"material": {"proposal_id": "private-proposal-id", "proposal_hash": "private-proposal-hash",
                        "proposal_version": 1, "unknowns": ["Motivation unknown"], "sections": [{"section_id": "s1", "minutes": 20,
                            "exercises": [{"prompt": "Rehearse actual candidate facts", "steps": ["Recall a project"], "answer_points": ["Explain actual contribution"],
                                           "self_check": ["No invented impact"], "basis_refs": ["candidate"]}]}]}}})
        write_json(self.pilot / "pilot-manifest.json", {"settings": load_settings(), "schedule": schedule})

    def tearDown(self):
        self.temp.cleanup()

    def make_pack(self):
        export(self.pilot, self.pack)
        return verify_pack(self.pack)

    def judgment(self, packet):
        return {"dimensions": [{"name": d, "score": 2, "output_evidence_ids": [next(iter(packet["evidence_catalog"]["output"]))],
                                "source_evidence_ids": [next(iter(packet["evidence_catalog"]["sources"]))],
                                "reason": "Mocked audit-mechanics test; no real quality assessment."} for d in DIMENSIONS],
                "serious_errors": [], "uncertain_items": [], "summary": "Mock judgment for contract tests only."}

    def fake_judge(self, messages, schema, **kwargs):
        import json
        packet = json.loads(messages[1]["content"])
        return {"parsed": self.judgment(packet), "usage": {"cost": 0}, "model": "mock-only"}

    def ratings(self, manifest, packets, path):
        with path.open("w", encoding="utf-8-sig", newline="") as stream:
            writer = csv.DictWriter(stream, fieldnames=["pack_fingerprint", "rater_id", "sample_id", "dimension", "score", "evidence", "reason"])
            writer.writeheader()
            writer.writerows({"pack_fingerprint": manifest["pack_fingerprint"], "rater_id": "test-rater", "sample_id": sid,
                              "dimension": d, "score": 1, "evidence": "Mock fixture", "reason": "Test-only rating, not human evidence"}
                             for sid in packets for d in DIMENSIONS)

    def test_export_hides_method_metadata_and_keeps_every_rating_blank(self):
        manifest, index, packets, _, _ = self.make_pack()
        self.assertEqual((manifest["artifact_count"], manifest["source_stories"], manifest["planned_artifacts"]), (5, 2, 5))
        page = (self.pack / "human-review.html").read_text(encoding="utf-8")
        self.assertNotIn("context-balanced-v1", page)
        self.assertNotIn("simple-instruction-v1", page)
        self.assertNotIn("private-proposal-id", page)
        self.assertEqual(len(packets), len({r["sample_id"] for r in index["samples"]}))
        with (self.pack / "ratings-template.csv").open(encoding="utf-8-sig", newline="") as stream:
            rows = list(csv.DictReader(stream))
        self.assertEqual(len(rows), 30)
        self.assertTrue(all(not row["score"] and not row["rater_id"] for row in rows))
        with self.assertRaises(ValueError):
            load_ratings(self.pack / "ratings-template.csv", manifest, packets)
        with self.assertRaises(FileExistsError):
            export(self.pilot, self.pack)

    def test_missing_planned_material_is_not_replaced_or_scored_zero(self):
        (self.pilot / "c03--context-balanced-v1/materials/invocation-result.json").unlink()
        manifest, index, packets, _, _ = self.make_pack()
        self.assertEqual((manifest["artifact_count"], len(index["missing"]), len(packets)), (4, 1, 4))
        self.assertEqual(index["missing"][0]["stage"], "materials")

    def test_raw_payload_is_retained_when_operational_validation_failed(self):
        write_json(self.pilot / "c03--simple-instruction-v1/proposal/result.json", {"status": "validation_failed"})
        self.assertEqual(self.make_pack()[0]["artifact_count"], 5)

    def test_quotes_dimensions_and_positive_evidence_are_checked(self):
        packet = next(iter(self.make_pack()[2].values()))
        judgment = self.judgment(packet)
        validate_judgment(packet, judgment)
        for change in (lambda j: j["dimensions"][0].update(name="coverage"),
                       lambda j: j["dimensions"][0].update(output_evidence_ids=["O99999"]),
                       lambda j: j["dimensions"][0].update(output_evidence_ids=[]),
                       lambda j: j["dimensions"][0].update(source_evidence_ids=["E99999"])):
            value = copy.deepcopy(judgment)
            change(value)
            with self.assertRaises(ValueError):
                validate_judgment(packet, value)

    def test_identical_payload_cache_reuses_scores_without_merging_sample_ids(self):
        self.make_pack()
        calls = []
        def fake(*args, **kwargs):
            calls.append(1)
            return self.fake_judge(*args, **kwargs)
        with redirect_stdout(io.StringIO()):
            result = judge_pack(self.pack, request_fn=fake)
            judge_pack(self.pack, request_fn=fake)
        self.assertEqual(result["scored"], 5)
        self.assertEqual(len(calls), 3)

    def test_invalid_first_judge_is_retained_without_automatic_repair(self):
        _, _, packets, rubric, settings = self.make_pack()
        packet = next(iter(packets.values()))
        calls = []
        def invalid(*args, **kwargs):
            calls.append(1)
            result = self.fake_judge(*args, **kwargs)
            result["parsed"]["dimensions"][0]["output_evidence_ids"] = ["O999999"]
            return result
        output = self.root / "invalid-judge.json"
        for _ in range(2):
            with self.assertRaises(ValueError):
                evaluate(packet, output, rubric=rubric, settings=settings, request_fn=invalid)
        self.assertEqual(len(calls), 1)
        self.assertTrue(output.with_suffix(".invalid.json").is_file())

    def test_evidence_ids_are_constrained_and_resolve_to_original_excerpts(self):
        packet = next(iter(self.make_pack()[2].values()))
        schema = judgment_schema(packet)
        self.assertEqual(schema["$defs"]["SemanticScore"]["properties"]["source_evidence_ids"]["items"]["enum"],
                         list(packet["evidence_catalog"]["sources"]))
        resolved = resolve_evidence(packet, validate_judgment(packet, self.judgment(packet)))
        for dimension in resolved["dimensions"]:
            self.assertTrue(all(quote in packet["output_text"] for quote in dimension["output_evidence"]))
            self.assertTrue(all(ref["quote"] in next(s["content"] for s in packet["request"]["sources"] if s["source_id"] == ref["source_id"])
                                for ref in dimension["source_evidence"]))

    def test_citation_revision_preserves_all_semantic_scoring_anchors(self):
        original = (RUBRIC.parent / "preparation-semantic-v1.md").read_text(encoding="utf-8")
        revised = RUBRIC.read_text(encoding="utf-8")
        anchors = lambda text: text.split("## Evidence authority", 1)[1].split("## Reporting", 1)[0]
        self.assertEqual(anchors(original), anchors(revised))

    def test_packet_or_private_method_mapping_mutation_breaks_binding(self):
        _, _, packets, _, _ = self.make_pack()
        path = self.pack / "packets" / (next(iter(packets)) + ".json")
        original = path.read_bytes()
        packet = read_json(path)
        packet["output_text"] += "Changed"
        write_json(path, packet)
        with self.assertRaises(ValueError):
            verify_pack(self.pack)
        path.write_bytes(original)
        index = read_json(self.pack / "private-index.json")
        index["samples"][0]["method"] = "another-method"
        write_json(self.pack / "private-index.json", index)
        with self.assertRaises(ValueError):
            verify_pack(self.pack)

    def test_comparison_keeps_submitted_ratings_and_reports_dimension_disagreement(self):
        manifest, _, packets, _, _ = self.make_pack()
        with redirect_stdout(io.StringIO()):
            judge_pack(self.pack, request_fn=self.fake_judge)
        ratings = self.root / "ratings.csv"
        self.ratings(manifest, packets, ratings)
        result = compare(self.pack, ratings)
        self.assertEqual((result["rows"], result["source_stories"], result["mean_absolute_error"]), (30, 2, 1))
        self.assertEqual(len(result["disagreements"]), 30)
        self.assertEqual(compare(self.pack, ratings), result)
        copies = list((self.pack / "comparisons").glob("*/submitted-ratings.csv"))
        self.assertEqual(len(copies), 1)
        self.assertEqual(copies[0].read_bytes(), ratings.read_bytes())

    def test_wrong_pack_incomplete_or_mixed_rater_csv_is_rejected(self):
        manifest, _, packets, _, _ = self.make_pack()
        ratings = self.root / "ratings.csv"
        self.ratings(manifest, packets, ratings)
        original = ratings.read_text(encoding="utf-8-sig")
        for content in (original.replace(manifest["pack_fingerprint"], "different-pack"),
                        original.replace("test-rater", "second-rater", 1),
                        "\n".join(original.splitlines()[:-1])):
            ratings.write_text(content, encoding="utf-8-sig")
            with self.assertRaises(ValueError):
                load_ratings(ratings, manifest, packets)


if __name__ == "__main__":
    unittest.main()
