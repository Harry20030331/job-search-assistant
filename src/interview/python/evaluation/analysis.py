"""Descriptive first-slice summaries. Frozen-matrix inference is a later stage."""
from __future__ import annotations

import argparse
import csv
import json
from collections import Counter
from pathlib import Path

from interview.storage import canonical, read_json, write_json


def summarize(runs: Path, output: Path) -> dict:
    output.mkdir(parents=True, exist_ok=True)
    rows = []
    for path in sorted(runs.rglob("manifest.json")):
        record = read_json(path)
        classification_path = path.parent / "diagnostic_classification.json"
        classification = read_json(classification_path) if classification_path.exists() else {}
        status = classification.get("status", record["status"])
        score_path = path.parent / "code_scores.json"
        scores = read_json(score_path) if score_path.exists() else {}
        judgment_path = path.parent / "judge.json"
        judge_record = read_json(judgment_path) if judgment_path.exists() else {}
        judgment = judge_record.get("judgment", {})
        rows.append({"case_id": record["case_id"], "group": record["group"], "status": status, "raw_status": record["status"], "code_task_success": scores.get("task_success") if status == "completed" else None, "serious_errors": ";".join(scores.get("serious_errors", [])), "judge_status": record.get("judge_status", "not_run"), "seconds": record.get("seconds"), "run_path": str(path.parent), "quality_scores": canonical({d["name"]: d["score"] for d in judgment.get("dimensions", [])}), "case_sha256": record.get("case_sha256"), "implementation_sha256": record.get("implementation_sha256"), "rubric_sha256": judge_record.get("rubric_sha256"), "review_findings_present": (path.parent / "review_findings.json").exists()})
    fieldnames = ["case_id", "group", "status", "raw_status", "code_task_success", "serious_errors", "judge_status", "seconds", "run_path", "quality_scores", "case_sha256", "implementation_sha256", "rubric_sha256", "review_findings_present"]
    with (output / "results.csv").open("w", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(stream, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    summary = {"scope": "development_descriptive_only", "run_count": len(rows), "statuses": dict(Counter(row["status"] for row in rows)), "graded_run_count": sum(row["code_task_success"] is not None for row in rows), "successful_graded_runs": sum(row["code_task_success"] is True for row in rows), "review_findings_count": sum(row["review_findings_present"] for row in rows), "note": "Access-blocked runs are not agent task failures. Repeats and implementation/rubric revisions are not independent cases. Original grades do not incorporate subsequent review findings; see per-run review_findings.json. No significance claims are made."}
    write_json(output / "summary.json", summary)
    return summary


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--runs", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=Path("deliverables/midpoint"))
    args = parser.parse_args()
    print(canonical(summarize(args.runs, args.output)))


if __name__ == "__main__":
    main()
