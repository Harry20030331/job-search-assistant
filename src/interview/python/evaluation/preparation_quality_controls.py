"""Frozen developer challenge controls for the unchanged preparation semantic judge."""
from __future__ import annotations

import argparse
import csv
import platform
from pathlib import Path

import pydantic

from evaluation import judge
from evaluation.preparation_quality import (DIMENSIONS, RUBRIC, add_evidence_catalog, evaluate,
                                          judgment_schema, validate_judgment)
from evaluation.preparation_quality_review import review_page, sha, within
from evaluation.workflow_review import load_judge_env
from interview.context_preparation import default_policy
from interview.schemas import strict_schema
from evaluation.preparation_quality import PreparationJudgment
from interview.settings import load_settings
from interview.storage import canonical, digest, read_json, write_json

DATASET = Path(__file__).resolve().parents[1] / "benchmark/preparation-quality-controls-v1/suite.json"
PROTOCOL = "preparation-quality-controls-v1"
JUDGE_KEYS = ("judge_model", "judge_provider", "judge_endpoint", "judge_max_tokens", "judge_timeout_seconds", "judge_retry_delays")


def validate_suite(suite):
    if suite["protocol"] != PROTOCOL or not suite.get("authorship"):
        raise ValueError("Explicit diagnostic protocol and authorship required")
    stories = suite["stories"]
    if len(stories) != 4 or len({s["story_id"] for s in stories}) != 4:
        raise ValueError("Exactly four distinct source stories required")
    for story in stories:
        variants = story["variants"]
        if (story["target_dimension"] not in DIMENSIONS or story["stage"] not in {"proposal", "materials"}
                or len(variants) != 3 or {v["expected_target_score"] for v in variants} != {0, 1, 2}
                or len({v["variant_id"] for v in variants}) != 3
                or any(not v["output_text"].strip() for v in variants)):
            raise ValueError("Each story requires three nonempty, uniquely identified severity anchors")
        if bool(story["approved_sections"]) != (story["stage"] == "materials"):
            raise ValueError("Only material fixtures require a declared synthetic approved plan")
        if story["approved_sections"] and sum(s["minutes"] for s in story["approved_sections"]) != story["budget_minutes"]:
            raise ValueError("Synthetic approved section minutes must match the budget")
        for variant in variants:
            if any(c not in {"fabrication", "wrong_identity", "incorrect_guidance", "unsupported_certainty", "other"}
                   for c in variant["expected_serious_categories"]):
                raise ValueError("Unknown serious-error expectation")
    return suite


def make_packet(story, variant):
    identity = "fixture-" + digest(story["company"])[:12]
    sources = []
    for key, kind, origin in (("candidate", "candidate", "canonical"), ("invitation", "invitation", "user_record"),
                              ("jd", "jd", "official"), ("company_text", "company", "official")):
        sid = "company" if key == "company_text" else key
        sources.append({"source_id": sid, "kind": kind, "origin": origin,
                        "relationship": "exact_role" if sid in {"jd", "invitation"} else "context_only",
                        "locator": "fixture://" + identity + "/" + sid,
                        "content": story[key]})
    approved = None
    if story["stage"] == "materials":
        approved = {"version": 1, "draft": {"budget_minutes": story["budget_minutes"], "sections": story["approved_sections"]},
                    "approval_provenance": "synthetic_test_script; authored evaluator fixture only, no business approval or external action"}
    packet = {"protocol": "preparation-semantic-v1.1", "stage": story["stage"],
              "request": {"identity": {"job_id": identity, "application_id": identity + "-application", "interview_id": identity + "-interview",
                                       "company": story["company"], "role": story["role"]},
                          "budget_minutes": story["budget_minutes"], "sources": sources},
              "analysis": {"unknowns": ["Personal motivation and unprovided experience details remain unknown."],
                           "note": "No model-derived context analysis is supplied for these document-quality controls."},
              "preparation_policy": default_policy(), "approved_proposal": approved,
              "candidate_output": {"document": variant["output_text"]}, "output_text": variant["output_text"]}
    return add_evidence_catalog(packet)


def export(output, *, dataset=DATASET):
    suite = validate_suite(read_json(dataset))
    rubric = RUBRIC.read_text(encoding="utf-8")
    config = load_settings()
    settings = {key: config[key] for key in JUDGE_KEYS}
    packets, index = {}, []
    for story in suite["stories"]:
        for variant in story["variants"]:
            packet = make_packet(story, variant)
            sid = "Q-" + digest({"packet": packet, "dataset": sha(dataset)})[:12]
            if sid in packets:
                raise ValueError("Duplicate challenge packet identity")
            packets[sid] = packet
            index.append({"sample_id": sid, "story_id": story["story_id"], "stage": story["stage"],
                          "variant_id": variant["variant_id"], "target_dimension": story["target_dimension"],
                          "expected_target_score": variant["expected_target_score"],
                          "expected_serious_categories": variant["expected_serious_categories"]})
    output = Path(output).resolve()
    output.mkdir(parents=True, exist_ok=False)
    snapshots = {"suite-snapshot.json": Path(dataset).read_bytes(), "rubric.md": rubric.encode(),
                 "judge-settings.json": (canonical(settings) + "\n").encode(),
                 "judge-schema.json": (canonical(strict_schema(PreparationJudgment)) + "\n").encode(),
                 "private-expectations.json": (canonical({"samples": index}) + "\n").encode(),
                 "controls_implementation.py": Path(__file__).read_bytes(),
                 "judge_implementation.py": (Path(__file__).parent / "preparation_quality.py").read_bytes(),
                 "transport_implementation.py": (Path(__file__).parent / "judge.py").read_bytes()}
    for sid, packet in packets.items():
        snapshots["packets/" + sid + ".json"] = (canonical(packet) + "\n").encode()
    for relative, content in snapshots.items():
        path = within(output, relative)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)
    files = {relative: sha(within(output, relative)) for relative in snapshots}
    manifest = {"protocol": PROTOCOL, "files": files, "source_stories": 4, "planned_artifacts": 12,
                "judge_rubric": "preparation-semantic-v1.1 unchanged", "label_origin": suite["authorship"],
                "design": suite["design"], "human_calibrated": False, "held_out": False,
                "target_dimensions": sorted({s["target_dimension"] for s in suite["stories"]}),
                "environment": {"python": platform.python_version(), "pydantic_actual": pydantic.__version__,
                                "pydantic_declared_lock": "2.13.5", "exact_lock_reproduction": pydantic.__version__ == "2.13.5"}}
    manifest["pack_fingerprint"] = digest(manifest)
    write_json(output / "pack-manifest.json", manifest)
    (output / "human-review.html").write_text(review_page(sorted(packets.items()), rubric, manifest["pack_fingerprint"]), encoding="utf-8")
    with (output / "ratings-template.csv").open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=["pack_fingerprint", "rater_id", "sample_id", "dimension", "score", "evidence", "reason"])
        writer.writeheader()
        writer.writerows({"pack_fingerprint": manifest["pack_fingerprint"], "sample_id": sid, "dimension": dim}
                         for sid in sorted(packets) for dim in DIMENSIONS)
    return {"pack_fingerprint": manifest["pack_fingerprint"], "artifacts": 12, "source_stories": 4, "human_ratings": "blank/pending"}


def verify(root):
    root = Path(root).resolve()
    manifest = read_json(root / "pack-manifest.json")
    body = {key: value for key, value in manifest.items() if key != "pack_fingerprint"}
    if manifest["protocol"] != PROTOCOL or digest(body) != manifest["pack_fingerprint"]:
        raise ValueError("Challenge manifest binding changed")
    if any(sha(within(root, relative)) != expected for relative, expected in manifest["files"].items()):
        raise ValueError("Frozen challenge inputs or expectations changed")
    for relative, implementation in (("controls_implementation.py", Path(__file__)),
                                     ("judge_implementation.py", Path(__file__).parent / "preparation_quality.py"),
                                     ("transport_implementation.py", Path(__file__).parent / "judge.py")):
        if sha(implementation) != manifest["files"][relative]:
            raise ValueError("Challenge implementation changed; use the recorded version or a new pack")
    suite = validate_suite(read_json(root / "suite-snapshot.json"))
    rubric = (root / "rubric.md").read_text(encoding="utf-8")
    settings = read_json(root / "judge-settings.json")
    index = read_json(root / "private-expectations.json")["samples"]
    if len(index) != manifest["planned_artifacts"] or len({r["sample_id"] for r in index}) != len(index):
        raise ValueError("Challenge sample denominator changed")
    stories = {s["story_id"]: s for s in suite["stories"]}
    packets = {}
    expected_pairs = {(s["story_id"], v["variant_id"]) for s in suite["stories"] for v in s["variants"]}
    if {(r["story_id"], r["variant_id"]) for r in index} != expected_pairs:
        raise ValueError("Expected variant coverage changed")
    for row in index:
        story = stories[row["story_id"]]
        variant = next(v for v in story["variants"] if v["variant_id"] == row["variant_id"])
        if any(row[key] != expected for key, expected in
               (("target_dimension", story["target_dimension"]), ("expected_target_score", variant["expected_target_score"]),
                ("expected_serious_categories", variant["expected_serious_categories"]))):
            raise ValueError("Challenge expectations disagree with the frozen suite")
        packet = read_json(within(root, "packets/" + row["sample_id"] + ".json"))
        if packet != make_packet(story, variant):
            raise ValueError("Challenge packet differs from its declared authored artifact")
        packets[row["sample_id"]] = packet
    if read_json(root / "judge-schema.json") != strict_schema(PreparationJudgment):
        raise ValueError("Applicable judge schema changed")
    return manifest, index, packets, rubric, settings


def result_path(root, packet, rubric, settings):
    fingerprint = digest({"packet": packet, "rubric": rubric, "settings": settings, "schema": judgment_schema(packet)})
    return Path(root) / "judge-results" / (fingerprint + ".json")


def judge_pack(root, *, request_fn=judge.request_structured):
    manifest, _, packets, rubric, settings = verify(root)
    rows = []
    # Hash order hides the authored quality order; each independent call sees one packet only.
    for sid, packet in sorted(packets.items()):
        path = result_path(root, packet, rubric, settings)
        try:
            result = evaluate(packet, path, rubric=rubric, settings=settings, request_fn=request_fn)
            row = {"sample_id": sid, "status": "scored_uncalibrated", "result_file": path.relative_to(root).as_posix(),
                   "result_sha256": sha(path), "usage": result.get("usage", {})}
        except (judge.JudgeAccessError, ValueError, KeyError, TypeError, OSError) as exc:
            row = {"sample_id": sid, "status": "judge_failed", "error": str(exc)}
        rows.append(row)
        write_json(Path(root) / "judge-status.json", {"pack_fingerprint": manifest["pack_fingerprint"], "results": rows})
        print(canonical({"sample_id": sid, "status": row["status"]}), flush=True)
    return {"planned": len(packets), "scored": sum(r["status"] == "scored_uncalibrated" for r in rows), "human_calibrated": False}


def report(root):
    manifest, index, packets, rubric, settings = verify(root)
    status = read_json(Path(root) / "judge-status.json")
    if status["pack_fingerprint"] != manifest["pack_fingerprint"]:
        raise ValueError("Judge status belongs to another pack")
    receipts = {r["sample_id"]: r for r in status["results"]}
    if len(receipts) != len(status["results"]) or not set(receipts).issubset(packets):
        raise ValueError("Duplicate or extra judge receipts")
    rows, usages = [], []
    for expected in index:
        sid = expected["sample_id"]
        receipt = receipts.get(sid, {})
        row = {**expected, "observed_target_score": None, "target_anchor_match": None, "serious_categories": [],
               "status": receipt.get("status", "not_attempted")}
        if receipt.get("status") == "scored_uncalibrated":
            path = result_path(root, packets[sid], rubric, settings)
            if receipt["result_file"] != path.relative_to(root).as_posix() or sha(path) != receipt["result_sha256"]:
                raise ValueError("Judge result changed")
            result = read_json(path)
            if result["fingerprint"] != path.stem:
                raise ValueError("Judge result fingerprint changed")
            judgment = validate_judgment(packets[sid], result["judgment"])
            dimension = next(d for d in judgment.dimensions if d.name == expected["target_dimension"])
            row.update(observed_target_score=dimension.score, target_anchor_match=dimension.score == expected["expected_target_score"],
                       serious_categories=[e.category for e in judgment.serious_errors], reason=dimension.reason,
                       scores={d.name: d.score for d in judgment.dimensions})
            usages.append(result.get("usage", {}))
        rows.append(row)
    scored = [r for r in rows if r["observed_target_score"] is not None]
    def metric(selected, predicate):
        available = [r for r in selected if r["observed_target_score"] is not None]
        return {"planned": len(selected), "scored": len(available), "matched": sum(predicate(r) for r in available),
                "rate_among_scored": sum(predicate(r) for r in available) / len(available) if available else None}
    ordinal = []
    for sid in sorted({r["story_id"] for r in rows}):
        group = {r["expected_target_score"]: r["observed_target_score"] for r in rows if r["story_id"] == sid}
        ordinal.append({"story_id": sid, "scores_by_expected_0_1_2": [group[n] for n in range(3)],
                        "strict_order": group[0] < group[1] < group[2] if all(v is not None for v in group.values()) else None})
    result = {"protocol": PROTOCOL, "pack_fingerprint": manifest["pack_fingerprint"], "source_stories": 4,
              "label_origin": manifest["label_origin"], "human_calibrated": False,
              "target_anchor_agreement": metric(rows, lambda r: r["target_anchor_match"]),
              "defect_detection": metric([r for r in rows if r["expected_target_score"] < 2], lambda r: r["observed_target_score"] < 2),
              "severe_zero_detection": metric([r for r in rows if r["expected_target_score"] == 0], lambda r: r["observed_target_score"] == 0),
              "clean_two_retention": metric([r for r in rows if r["expected_target_score"] == 2], lambda r: r["observed_target_score"] == 2),
              "expected_serious_categories": metric([r for r in rows if r["expected_serious_categories"]],
                  lambda r: set(r["expected_serious_categories"]).issubset(r["serious_categories"])),
              "clean_serious_flags": sum(bool(r["serious_categories"]) for r in scored if r["expected_target_score"] == 2),
              "ordinal_by_story": ordinal, "cases": rows,
              "usage_scored_responses": {key: round(sum(u.get(key, 0) or 0 for u in usages), 8)
                                          for key in ("prompt_tokens", "completion_tokens", "total_tokens", "cost")},
              "constant_two_anchor_agreement": {"matched": 4, "planned": 12, "rate": 4/12},
              "limitations": "Developer-expected anchors, four story clusters, artificial defects, one judge call per artifact. Missing/invalid responses stay missing, not zero. Not human validation, natural-failure prevalence, all-dimension coverage, agent performance or causal method gain. Usage totals cover scored responses only; inspect invalid receipts separately."}
    write_json(Path(root) / "diagnostic-report.json", result)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("phase", choices=["export", "judge", "report"])
    parser.add_argument("--output", type=Path)
    parser.add_argument("--pack", type=Path)
    parser.add_argument("--judge-env", type=Path)
    args = parser.parse_args()
    if args.phase == "export":
        if args.output is None:
            parser.error("export requires a new --output")
        result = export(args.output)
    else:
        if args.pack is None:
            parser.error("judge/report requires --pack")
        if args.phase == "judge":
            load_judge_env(args.judge_env)
            result = judge_pack(args.pack.resolve())
        else:
            result = report(args.pack.resolve())
    print(canonical(result))


if __name__ == "__main__":
    main()
