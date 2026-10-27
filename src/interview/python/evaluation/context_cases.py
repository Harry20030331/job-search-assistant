"""Validate/export context-v1 developer cases; never score fabricated agent outputs."""
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
from pathlib import Path
from typing import Literal

from pydantic import Field

from evaluation.workflow_review import page
from interview.preparation_context import ContextRequest, PROTOCOL, Topic, request_token
from interview.schemas import Contract
from interview.storage import canonical, digest, read_json, write_json

DEFAULT_DATASET = Path(__file__).resolve().parents[1] / "benchmark/context-v1.1"


class Expectations(Contract):
    human_review: Literal["pending", "reviewed"]
    jd_status: Literal["exact", "analogue", "missing"]
    role_focus_expected: list[Topic] = Field(min_length=1)
    round_focus_expected: list[Topic] = Field(min_length=1)
    seniority_expected: Literal["early_career", "senior"] | None
    round_expected: Literal["technical", "hr", "hiring_manager", "behavioral"]
    review_notes: list[str] = Field(min_length=1)
    general_coverage: list[Topic]
    coverage_rule: str = Field(min_length=1)
    role_focus_assessment_expected: Literal["confirmed", "inferred"] | None = None
    round_label_assessment_expected: Literal["confirmed", "inferred"] | None = None
    round_focus_assessment_expected: Literal["confirmed", "inferred"] | None = None
    round_focus_required: bool = True
    unknowns_expected: list[str] = Field(default_factory=list)


def inspect_dataset(dataset: Path):
    manifest = read_json(dataset / "manifest.json")
    if manifest["protocol"] != PROTOCOL or manifest["split"] != "development":
        raise ValueError("Unexpected developer dataset protocol")
    ids = [row["case_id"] for row in manifest["cases"]]
    if not ids or len(ids) != len(set(ids)) or any(not cid.isalnum() for cid in ids):
        raise ValueError("Case IDs must be unique safe directory names")
    jobs, interviews, candidate_hashes, cases = set(), set(), set(), []
    snapshots = {"manifest.json": hashlib.sha256((dataset / "manifest.json").read_bytes()).hexdigest()}
    review_state = manifest.get("human_review", "pending")
    if review_state not in {"pending", "reviewed"}:
        raise ValueError("Unsupported review state")
    if review_state == "reviewed":
        review = read_json(dataset / "review.json")
        if review.get("origin") != "human_current_chat" or set(review.get("decisions", {})) != set(ids):
            raise ValueError("Reviewed cases need complete human-decision provenance")
        if not all(d in {"keep", "revise"} for d in review["decisions"].values()):
            raise ValueError("Retained cases must have keep/revise decisions")
        snapshots["review.json"] = hashlib.sha256((dataset / "review.json").read_bytes()).hexdigest()
    for cid in ids:
        spec = read_json(dataset / cid / "case.json")
        if spec["case_id"] != cid or spec["fictional"] is not True or spec["human_review"] != review_state:
            raise ValueError("Unexpected case provenance")
        request = ContextRequest.model_validate(read_json(dataset / cid / "request.json"))
        gold = Expectations.model_validate(read_json(dataset / cid / "gold.json"))
        if gold.human_review != review_state:
            raise ValueError("Case and expectation review states must match the dataset")
        if request.identity.job_id in jobs or request.identity.interview_id in interviews:
            raise ValueError("This dataset declares distinct job and interview stories")
        candidate_text = "\n".join(s.content for s in request.sources if s.kind == "candidate")
        candidate_hash = hashlib.sha256(candidate_text.encode()).hexdigest()
        if candidate_hash in candidate_hashes:
            raise ValueError("Repeated candidate source must be declared as a paired variant")
        jobs.add(request.identity.job_id)
        interviews.add(request.identity.interview_id)
        candidate_hashes.add(candidate_hash)
        for filename in ("case.json", "request.json", "gold.json"):
            snapshots[cid + "/" + filename] = hashlib.sha256((dataset / cid / filename).read_bytes()).hexdigest()
        cases.append({"case_id": cid, "spec": spec, "request": request.model_dump(mode="json"),
                      "request_token": request_token(request), "proposed_expectations": gold.model_dump()})
    return {"dataset_hash": digest(snapshots), "case_count": len(cases), "authored_candidate_contexts": len(candidate_hashes),
            "case_hashes": snapshots, "cases": cases, "human_review": review_state, "agent_runs": 0,
            "note": "Distinct authored fictional contexts do not establish population independence or semantic label validity."}


def export(dataset: Path, output: Path):
    result = inspect_dataset(dataset)
    if output.resolve() == dataset.resolve() or dataset.resolve() in output.resolve().parents:
        raise ValueError("Review output must not be inside the dataset")
    output.mkdir(parents=True, exist_ok=False)
    shutil.copytree(dataset, output / "dataset_snapshot")
    if inspect_dataset(output / "dataset_snapshot")["dataset_hash"] != result["dataset_hash"]:
        raise ValueError("Dataset changed during review export")
    cards = [(row["case_id"], json.dumps(row, indent=2, ensure_ascii=False)) for row in result["cases"]]
    introduction = (f"Inspect {result['case_count']} fictional preparation-context stories. Recorded label review: {result['human_review']}. "
                    "These are context analysis tasks, not agent results or a quality-rating audit. "
                    "Check role/round focus, seniority, JD fallback and uncertainty. Keep, revise with a correction, or drop. "
                    "Review provenance is recorded separately from model performance.")
    (output / "case-review.html").write_text(page("Preparation context case review", introduction, cards,
                                                ["label_decision"], "context-cases-" + result["dataset_hash"][:12]), encoding="utf-8")
    write_json(output / "review-manifest.json", {k: v for k, v in result.items() if k != "cases"})
    (output / "START-HERE.md").write_text(
        "# Context development cases\n\nOpen case-review.html. Inspect each source and proposed interpretation before choosing keep/revise/drop. "
        "Explain revisions, especially where multiple interpretations are reasonable. Export the CSV. "
        "No agent has been evaluated by this export; do not read fixture validation as a success rate.\n",
        encoding="utf-8")
    return {"status": "review_exported", "dataset_hash": result["dataset_hash"], "cases": result["case_count"],
            "human_review": result["human_review"], "agent_runs": 0, "output": str(output)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("phase", choices=["check", "export"])
    parser.add_argument("--dataset", type=Path, default=DEFAULT_DATASET)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    if args.phase == "export" and args.output is None:
        parser.error("export requires a new --output directory")
    result = inspect_dataset(args.dataset.resolve()) if args.phase == "check" else export(args.dataset.resolve(), args.output.resolve())
    print(canonical({k: v for k, v in result.items() if k != "case_hashes" and not (k == "cases" and isinstance(v, list))}))


if __name__ == "__main__":
    main()
