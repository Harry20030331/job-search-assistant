"""Matched planning-node developer pilot with an optional declared synthetic materials audit."""
from __future__ import annotations

import argparse
from pathlib import Path

from interview.agent_runtime import invoke
from interview.context_flow import isolated_output, runtime_info
from interview.context_preparation import stage
from interview.context_preparation_flow import METHODS, run_node
from interview.preparation import approve
from interview.preparation_context import load_context
from interview.settings import load_settings
from interview.storage import Store, canonical, digest, read_json, write_json


def run_pilot(context_paths, output, *, material_audit=None, invoke_fn=invoke):
    captured = []
    for path in map(Path, context_paths):
        request, _ = load_context(path)
        captured.append({"path": path, "bytes": path.read_bytes(), "interview_id": request.identity.interview_id,
                         "context_hash": read_json(path)["context_hash"],
                         "key": digest({"id": request.identity.interview_id})[:12]})
    identities = {row["interview_id"] for row in captured}
    if not captured or len(identities) != len(captured):
        raise ValueError("Select distinct interview contexts")
    if material_audit and (material_audit[0] not in identities or material_audit[1] not in METHODS):
        raise ValueError("Material audit must select one declared interview and method")
    output = Path(output).resolve()
    isolated_output(output)
    output.mkdir(parents=True, exist_ok=False)
    settings = load_settings()
    schedule = []
    for index, item in enumerate(captured):
        path = output / "context_snapshots" / (item["key"] + ".json")
        path.parent.mkdir(exist_ok=True)
        path.write_bytes(item["bytes"])
        load_context(path)
        item["snapshot"] = path
        for method in METHODS if index % 2 == 0 else tuple(reversed(METHODS)):
            schedule.append({"interview_id": item["interview_id"], "key": item["key"], "method": method,
                             "context_hash": item["context_hash"],
                             "synthetic_accept_material_audit": material_audit == (item["interview_id"], method)})
    write_json(output / "pilot-manifest.json", {"protocol": "context-preparation-pilot-v1.1", "schedule": schedule,
        "settings": settings, "host_runtime": runtime_info(), "automatic_retries": 0, "semantic_quality": "pending_unrated",
        "condition": "Planning-only contrast: identical captured context analysis and original sources for both methods; fresh business state per attempt.",
        "material_audit": "One optional predeclared synthetic acceptance; does not authorize real-user work or support a paired materials comparison."})
    (output / "pilot_implementation.py").write_bytes(Path(__file__).read_bytes())
    selected = {item["interview_id"]: item for item in captured}
    rows = []
    for entry in schedule:
        destination = output / (entry["key"] + "--" + entry["method"])
        workspace = Path(stage(selected[entry["interview_id"]]["snapshot"], destination / "business")["workspace"])
        result = run_node(workspace, destination / "proposal", method=entry["method"], settings=settings, invoke_fn=invoke_fn)
        row = {**entry, "status": result["status"], "mechanical_passed": result["mechanical_passed"],
               "semantic_quality": "pending_unrated", "result_directory": destination.name, "invocation": result.get("invocation")}
        if entry["synthetic_accept_material_audit"]:
            if result["status"] == "awaiting_plan_approval":
                proposal = result["accepted"]
                decision = {"origin": "synthetic_test_script", "decision": "accept", "proposal_id": proposal["proposal_id"],
                            "proposal_hash": proposal["proposal_hash"], "context_hash": entry["context_hash"],
                            "note": "Predeclared fictional integration check; not real-user approval or a semantic quality judgment."}
                approval_id = approve(Store(workspace), entry["interview_id"], proposal["proposal_id"], proposal["proposal_hash"], canonical(decision))
                write_json(destination / "synthetic-plan-decision.json", {**decision, "approval_id": approval_id})
                material = run_node(workspace, destination / "materials", method=entry["method"], approval_id=approval_id,
                                    settings=settings, invoke_fn=invoke_fn)
                row["material_audit"] = {"status": material["status"], "mechanical_passed": material["mechanical_passed"],
                                         "invocation": material.get("invocation")}
            else:
                row["material_audit"] = {"status": "unavailable", "reason": "No accepted proposal; no replacement or retry"}
        rows.append(row)
        write_json(output / "progress.json", {"planned_proposals": len(schedule), "attempted_proposals": len(rows), "results": rows})
        print(canonical({k: row[k] for k in ("interview_id", "method", "status", "mechanical_passed")}), flush=True)
    summary = {"planned_proposals": len(schedule), "attempted_proposals": len(rows), "interview_contexts": len(captured),
               "results": rows, "semantic_quality": "pending_unrated", "agent_cost_usd": None,
               "note": "Coverage/time/reference checks are operational contracts, not evidence of better preparation or a causal component effect."}
    write_json(output / "summary.json", summary)
    lines = ["# Context preparation development pilot", "", summary["note"], "",
             "| Interview | Method | Proposal result | Material audit |", "| --- | --- | --- | --- |"]
    for row in rows:
        lines.append("| " + " | ".join([row["interview_id"], row["method"], row["status"], row.get("material_audit", {}).get("status", "Not selected")]) + " |")
    lines.extend(["", "Each method receives the same supplied context and has fresh isolated business state. All first attempts are retained.",
                  "Only the predeclared audit uses synthetic test acceptance; no real approval is inferred.", "", "## Artifacts"])
    for row in rows:
        for phase, name in (("proposal", "proposal.md"), ("materials", "materials.md")):
            relative = row["result_directory"] + "/" + phase + "/" + name
            if (output / relative).exists():
                lines.append("- [" + row["interview_id"] + " / " + row["method"] + " / " + phase + "](" + relative + ")")
    (output / "report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    return summary


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--context", action="append", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--synthetic-material-audit-interview")
    parser.add_argument("--synthetic-material-audit-method", choices=METHODS)
    args = parser.parse_args()
    if bool(args.synthetic_material_audit_interview) != bool(args.synthetic_material_audit_method):
        parser.error("Declare both interview and method for the optional synthetic material audit")
    audit = (args.synthetic_material_audit_interview, args.synthetic_material_audit_method) if args.synthetic_material_audit_interview else None
    result = run_pilot(args.context, args.output, material_audit=audit)
    print(canonical({k: v for k, v in result.items() if k != "results"}))


if __name__ == "__main__":
    main()
