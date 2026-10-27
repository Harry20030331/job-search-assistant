"""Prespecified small context-method pilot; mechanical validation is not quality scoring."""
from __future__ import annotations

import argparse
import shutil
from pathlib import Path

from evaluation.context_cases import DEFAULT_DATASET, inspect_dataset
from interview.agent_runtime import invoke
from interview.context_flow import METHODS, isolated_output, run_analysis, runtime_info
from interview.settings import load_settings
from interview.storage import canonical, read_json, write_json


def run_pilot(dataset, output, selected, *, invoke_fn=invoke):
    dataset, output = Path(dataset).resolve(), Path(output).resolve()
    metadata = inspect_dataset(dataset)
    known = {row["case_id"] for row in metadata["cases"]}
    if not selected or len(selected) != len(set(selected)) or not set(selected).issubset(known):
        raise ValueError("Select unique existing cases before a pilot")
    isolated_output(output)
    output.mkdir(parents=True, exist_ok=False)
    shutil.copytree(dataset, output / "dataset_snapshot")
    if inspect_dataset(output / "dataset_snapshot")["dataset_hash"] != metadata["dataset_hash"]:
        raise ValueError("Dataset changed during pilot snapshot")
    settings = load_settings()
    # Alternate the fixed order across stories. This is not randomized causal inference.
    schedule = [{"case_id": cid, "method": method} for i, cid in enumerate(selected)
                for method in (METHODS if i % 2 == 0 else tuple(reversed(METHODS)))]
    write_json(output / "pilot-manifest.json", {"protocol": "context-analysis-pilot-v1.1", "dataset_hash": metadata["dataset_hash"],
        "host_runtime": runtime_info(),
        "label_review": metadata["human_review"], "settings": settings, "schedule": schedule,
        "evidence_condition": "same inline captured request per case", "automatic_retries": 0,
        "semantic_quality": "pending_unrated", "selection": "Explicit development cases chosen before this run; not a representative sample."})
    (output / "pilot_implementation.py").write_bytes(Path(__file__).read_bytes())
    rows = []
    for entry in schedule:
        cid, method = entry["case_id"], entry["method"]
        destination = output / (cid + "--" + method)
        try:
            result = run_analysis(output / "dataset_snapshot" / cid / "request.json", destination,
                                  method=method, settings=settings, invoke_fn=invoke_fn)
        except (OSError, ValueError, KeyError, TypeError) as exc:
            destination.mkdir(exist_ok=True)
            result = {"status": "execution_failed", "error": str(exc), "mechanical_passed": False,
                      "semantic_quality": "pending_unrated", "agent_cost_usd": None}
            write_json(destination / "host-failure.json", result)
        row = {**entry, "status": result["status"], "mechanical_passed": result["mechanical_passed"],
               "semantic_quality": "pending_unrated", "invocation": result.get("invocation"),
               "result_directory": destination.name}
        rows.append(row)
        write_json(output / "progress.json", {"planned": len(schedule), "attempted": len(rows), "results": rows})
        print(canonical(row), flush=True)
    report = {"planned": len(schedule), "attempted": len(rows), "source_stories": len(selected), "results": rows,
              "semantic_quality": "pending_unrated", "agent_cost_usd": None,
              "note": "Mechanical checks cover source contracts, not relevance or preparation quality. No automatic quality score or causal gain is claimed."}
    write_json(output / "summary.json", report)
    lines = ["# Context analysis development pilot", "", report["note"], "",
             "| Case | Method | Node result | Mechanical validation |", "| --- | --- | --- | --- |"]
    lines.extend("| " + " | ".join([r["case_id"], r["method"], r["status"], str(r["mechanical_passed"])]) + " |" for r in rows)
    lines.extend(["", "Every planned first attempt is retained. Sources and labels are snapshotted outside actor workspaces.",
                  "Prompts contain only public request evidence; gold expectations and review notes are evaluator-only.",
                  "The invocation logs record tokens and timing. Subscription dollar cost remains unknown.",
                  "", "## Analysis artifacts"])
    for row in rows:
        if (output / row["result_directory"] / "context.md").exists():
            lines.append("- [" + row["case_id"] + " / " + row["method"] + "](" + row["result_directory"] + "/context.md)")
    (output / "report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset", type=Path, default=DEFAULT_DATASET)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--case", action="append", required=True)
    args = parser.parse_args()
    result = run_pilot(args.dataset, args.output, args.case)
    print(canonical({k: v for k, v in result.items() if k != "results"}))


if __name__ == "__main__":
    main()
