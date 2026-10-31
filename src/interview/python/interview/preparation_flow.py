"""Two-stage preparation execution; historical benchmark protocols remain separate."""
from __future__ import annotations

import argparse
from pathlib import Path

from interview.agent_runtime import invoke
from interview.settings import load_settings as config
from interview.preparation import MaterialNodeResult, ProposalNodeResult, approved_plan, render_material, render_proposal, submit_material, submit_proposal, known_refs, reference_schema, source_catalog, SOURCE_REFERENCE_CONTRACT, SOURCE_REFERENCE_GUIDANCE, SOURCE_REFERENCE_POLICY_REVISION
from interview.schemas import strict_schema
from interview.storage import Store, canonical, read_json, write_json
from interview.freshness import check as check_source


def run_node(work, destination, *, approval_id=None, invoke_fn=invoke, reference_mode=SOURCE_REFERENCE_CONTRACT):
    if reference_mode not in {"legacy", SOURCE_REFERENCE_CONTRACT}:
        raise ValueError("Unknown source-reference contract")
    store = Store(work)
    check_source(store)
    application = read_json(work / "inputs" / "application.json")
    interview_id = application["interview_id"]
    # Enforced before starting any LLM call, and checked again before acceptance.
    record = approved_plan(store, interview_id, approval_id) if approval_id else None
    model = MaterialNodeResult if record else ProposalNodeResult
    schema_path = work / ("materials-v4.schema.json" if record else "proposal-v4.schema.json")
    refs = sorted(known_refs(store)) if reference_mode != "legacy" else None
    write_json(schema_path, reference_schema(model, refs) if refs else strict_schema(model))
    common = "Read TASK.md and TOOL_GUIDE.md. This is a preparation-only workflow. Use the supplied profile and its provenance; fictional candidate evidence is not the real account owner's resume. Do not write the calendar, send mail, inspect parent folders or credentials, modify source/configuration or SQLite. Use context.get, documents.read and relevant history if available; use memory.search only in group D. Keep user reports/self-assessments distinct from suggested practice, and do not reuse resolved/superseded issues as current weaknesses. When no relevant history exists, say so rather than importing unrelated experience. Questions/exercises you invent are suggested practice, not actual employer questions. Output the requested node result, with status=ready and populated proposal/material only after actually reading the evidence. If tools fail or key user information is unavailable, return blocked/needs_input, null proposal/material and specific questions; never fabricate a placeholder plan to satisfy the schema.\n"
    if record:
        prompt = common + "Generate full preparation materials for this exact approved proposal. Match its IDs, version, hash, sections and minute allocations. Every exercise needs a concrete prompt, steps, substantive answer points and a self-check checklist, with real source IDs for its basis. Keep unknown employer details explicitly unknown. Do not invent achievements, project metrics or a meeting URL.\nAPPROVED PROPOSAL:\n" + canonical(record)
    else:
        prompt = common + "Generate only a short preparation proposal: 3–5 sections, times summing exactly to the profile's preparation_budget_minutes, explicit objectives, source references and unknowns. Match the context's interview ID. Use the profile's requested priorities and supplied project evidence. Do not generate full questions or answer materials yet."
    destination.mkdir(parents=True, exist_ok=False)
    if refs:
        catalog = source_catalog(store)
        prompt += "\n" + SOURCE_REFERENCE_GUIDANCE + "allowed_source_ids: " + canonical(refs) + "\nsource_catalog: " + canonical(catalog)
        write_json(destination / "source-reference-contract.json", {"contract": reference_mode, "policy_revision": SOURCE_REFERENCE_POLICY_REVISION, "allowed_source_ids": refs, "source_catalog": catalog})
    (destination / "prompt.txt").write_text(prompt, encoding="utf-8")
    settings = config()
    write_json(destination / "settings.json", settings)
    audit_start = max((a["seq"] for a in store.audit_rows()), default=0)
    if store.meta("group") == "D":
        prompt += "\nThis workspace is group D. Before returning a ready proposal/material, you MUST call memory.search with role/topics from the actual context, even if it returns no notes. Verify relevant retrieved claims against raw history. A ready result without a successful current-node memory.search will be rejected.\n"
        (destination / "prompt.txt").write_text(prompt, encoding="utf-8")
    result = invoke_fn(work, prompt, schema_path, destination, settings)
    if result["status"] != "completed":
        return result
    node = model.model_validate(result["output"])
    if node.status != "ready":
        status = {"status": node.status, "questions": node.questions, "accepted": None}
        write_json(destination / "node-status.json", status)
        return status
    try:
        if store.meta("group") == "D" and not any(a["seq"] > audit_start and a["operation"] == "memory.search" and a["result"].get("ok") for a in store.audit_rows()):
            raise ValueError("Group D requires a successful memory.search in this node; raw history alone does not establish structured retrieval")
        if record:
            if node.material is None:
                raise ValueError("Ready material node omitted its materials")
            accepted = submit_material(store, interview_id, approval_id, node.material.model_dump())
            (destination / "materials.md").write_text(render_material(record, accepted), encoding="utf-8")
        else:
            if node.proposal is None:
                raise ValueError("Ready proposal node omitted its proposal")
            accepted = submit_proposal(store, node.proposal.model_dump())
            (destination / "proposal.md").write_text(render_proposal(accepted), encoding="utf-8")
    except ValueError as exc:
        status = {"status": "validation_failed", "error": str(exc), "accepted": None}
        write_json(destination / "node-status.json", status)
        return status
    write_json(destination / "accepted.json", accepted)
    return {"status": "material_ready" if record else "awaiting_plan_approval", "accepted": accepted,
            "thread_id": result.get("thread_id"), "seconds": result.get("seconds")}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("phase", choices=["proposal", "materials"])
    parser.add_argument("--workspace", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--approval-id")
    args = parser.parse_args()
    if args.phase == "materials" and not args.approval_id:
        parser.error("materials requires an exact host approval ID")
    print(canonical(run_node(args.workspace.resolve(), args.output.resolve(), approval_id=args.approval_id)))


if __name__ == "__main__":
    main()
