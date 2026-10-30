"""Opt-in context-bound plans, reusing exact host approval and preparation storage."""
from __future__ import annotations

import argparse
import hashlib
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

from pydantic import Field

from interview.freshness import check as check_source
from interview.candidate_learning import sources as learning_sources
from interview.preparation import MaterialPack, PlanSection, ProposalDraft, approved_plan, context_fingerprint, latest, schema
from interview.preparation_context import ContextRequest, ResearchUsage, Source, Topic, load_context, request_token
from interview.schemas import Contract
from interview.storage import Store, canonical, digest, read_json, write_json

AREAS = {"self_introduction", "why_company", "why_role", "behavioral", "role_round_practice", "interviewer_questions"}
Area = Literal["self_introduction", "why_company", "why_role", "behavioral", "role_round_practice", "interviewer_questions"]


class PreparationPolicy(Contract):
    required_areas: list[Area]
    origin: Literal["default", "user_instruction", "synthetic_test_script"]
    reason: str = Field(min_length=1)


def default_policy():
    return {"required_areas": ["self_introduction", "why_company", "why_role"], "origin": "default",
            "reason": "Keep compact common-question preparation across rounds; change only for explicit user preferences, without claiming these questions are guaranteed."}


def current_policy(store):
    path = store.workspace / "inputs/context/preparation-policy.json"
    return PreparationPolicy.model_validate(read_json(path) if path.is_file() else default_policy())


class ContextSection(PlanSection):
    focus_topics: list[Topic] = Field(min_length=1)
    depth: Literal["foundational", "applied", "advanced", "mixed"]
    rationale: str = Field(min_length=1, description="Explain the role/round/level and time-allocation choice, preserving uncertainty.")
    deliverable: str = Field(min_length=1, description="A reviewable rehearsal outcome, not full answers before approval.")


class Coverage(Contract):
    area: Literal["self_introduction", "why_company", "why_role", "behavioral", "role_round_practice", "interviewer_questions"]
    disposition: Literal["included", "deferred"]
    section_ids: list[str]
    reason: str = Field(min_length=1, description="Explain inclusion or explicit deferral under the current round and budget.")


class ContextProposal(ProposalDraft):
    context_hash: str = Field(pattern=r"^[a-f0-9]{64}$")
    policy_hash: str = Field(pattern=r"^[a-f0-9]{64}$", description="Copy the current preparation-policy hash; it binds required coverage separately from source analysis.")
    sections: list[ContextSection] = Field(min_length=1, max_length=6)
    coverage: list[Coverage] = Field(min_length=6, max_length=6)


class ContextProposalNode(Contract):
    status: Literal["ready", "needs_input", "blocked"]
    proposal: ContextProposal | None
    questions: list[str]


class Enrichment(Contract):
    sources: list[Source]
    research: ResearchUsage


def selected_candidate_text(work):
    canonical_path = work / "inputs/sources/canonical-candidate.md"
    if not canonical_path.is_file():
        raise ValueError("Context attachment requires the canonical-candidate snapshot")
    return canonical_path.read_text(encoding="utf-8-sig")


def selected_preferences_text(work):
    path = work / "inputs/sources/preferences.md"
    text = path.read_text(encoding="utf-8-sig") if path.is_file() else ""
    priorities = read_json(work / "inputs/profile.json").get("priorities", [])
    if priorities:
        text += "\n\nConfirmed interview priorities:\n" + canonical(priorities)
    return text


def capture_request(store, output, *, association="unresolved", enrichment=None):
    """Read an existing canonical handoff and host-captured enrichment, without retrieval."""
    check_source(store)
    before = context_fingerprint(store)
    application = read_json(store.workspace / "inputs/application.json")
    profile = read_json(store.workspace / "inputs/profile.json")
    captured_at = datetime.now(timezone.utc).isoformat()

    def document(source_id, kind, text, origin, relation, locator):
        return {"source_id": source_id, "kind": kind, "content": text,
            "content_sha256": hashlib.sha256(text.encode("utf-8")).hexdigest(), "retrieved_at": captured_at,
            "origin": origin, "relationship": relation, "locator": locator,
            "matched_job_id": application["job_id"] if relation == "exact_role" else None,
            "company": application["company"] if relation == "exact_role" else None,
            "role": application["role"] if relation == "exact_role" else None}

    sources = [document("candidate", "candidate", selected_candidate_text(store.workspace), "canonical", "context_only", "workspace:canonical-candidate"),
        document("invitation", "invitation", (store.workspace / "inputs/sources/invitation.md").read_text(encoding="utf-8-sig"),
                 "user_record", "exact_role" if association == "verified" else "context_only", "workspace:invitation")]
    preferences = selected_preferences_text(store.workspace)
    if preferences.strip():
        sources.append(document("preferences", "preferences", preferences, "canonical", "context_only", "workspace:preferences-and-priorities"))
    evidence = Enrichment.model_validate(enrichment if enrichment is not None else {
        "sources": [], "research": {"search_queries": 0, "opened_pages": 0, "max_search_queries": 6, "max_opened_pages": 8}})
    if any(s.kind in {"candidate", "invitation", "preferences", "practice"} or s.source_id in {"candidate", "invitation", "preferences", "preparation-context"} for s in evidence.sources):
        raise ValueError("Enrichment must not replace canonical inputs or reserved source IDs")
    sources.extend(learning_sources(store))
    sources.extend(s.model_dump(mode="json") for s in evidence.sources)
    request = ContextRequest.model_validate({"protocol": "preparation-context-v1",
        "identity": {key: application[key] for key in ("job_id", "application_id", "interview_id", "company", "role")},
        "association": association, "budget_minutes": profile["preparation_budget_minutes"], "sources": sources,
        "research": evidence.research.model_dump()})
    check_source(store)
    if context_fingerprint(store) != before:
        raise ValueError("Canonical handoff changed while capturing context")
    output = Path(output)
    output.mkdir(parents=True, exist_ok=False)
    write_json(output / "request.json", request.model_dump(mode="json"))
    write_json(output / "binding.json", {"input_fingerprint": before, "request_token": request_token(request),
        "association": association, "note": "Host-selected association; job selection alone is not email identity proof."})
    return {"status": "context_request_captured", "request_token": request_token(request), "model_calls": 0, "retrieval_calls": 0}


def verify_binding(store, request):
    if any(s.source_id == "preparation-context" for s in request.sources):
        raise ValueError("Source ID collides with the derived preparation-context reference")
    application = read_json(store.workspace / "inputs/application.json")
    if any(application.get(key) != value for key, value in request.identity.model_dump().items()):
        raise ValueError("Context belongs to a different job, application, interview or role")
    if request.association != "verified":
        raise ValueError("Resolve interview association before preparation")
    profile = read_json(store.workspace / "inputs/profile.json")
    if profile.get("preparation_budget_minutes") != request.budget_minutes:
        raise ValueError("Context and current preparation budget differ")
    candidates = [s for s in request.sources if s.kind == "candidate"]
    invitations = [s for s in request.sources if s.kind == "invitation"]
    invitation = store.workspace / "inputs/sources/invitation.md"
    if len(candidates) != 1 or candidates[0].content != selected_candidate_text(store.workspace):
        raise ValueError("Context candidate evidence differs from the canonical snapshot")
    if len(invitations) != 1 or not invitation.is_file() or invitations[0].content != invitation.read_text(encoding="utf-8-sig"):
        raise ValueError("Context invitation differs from the selected invitation")
    preferences = [s for s in request.sources if s.kind == "preferences"]
    expected = selected_preferences_text(store.workspace)
    if (len(preferences) > 1 or (expected.strip() and (not preferences or preferences[0].content != expected)) or
            (preferences and not expected.strip())):
        raise ValueError("Context preferences or confirmed priorities differ from the selected inputs")
    if store.optional_meta("candidate_anchor") or store.optional_meta("candidate_learning_guard"):
        supplied = {s.source_id: s.model_dump(mode="json") for s in request.sources if s.kind == "practice"}
        expected_learning = {s["source_id"]: s for s in learning_sources(store)}
        if supplied != expected_learning:
            raise ValueError("Context learning differs from the explicitly bound account snapshot")


def attach(store, context_path, expected_fingerprint, *, policy=None):
    check_source(store)
    context_path = Path(context_path)
    original = context_path.read_bytes()
    request, _ = load_context(context_path)
    policy = PreparationPolicy.model_validate(policy if policy is not None else default_policy())
    verify_binding(store, request)
    if context_fingerprint(store) != expected_fingerprint:
        raise ValueError("Workspace changed before context attachment")
    destination = store.workspace / "inputs/context"
    if destination.exists():
        raise FileExistsError("Context already attached; use a fresh staged run for revised context")
    check_source(store)
    if context_path.read_bytes() != original:
        raise ValueError("Selected context changed before attachment")
    destination.mkdir()
    (destination / "preparation-context.json").write_bytes(original)
    write_json(destination / "preparation-policy.json", policy.model_dump())
    check_source(store)
    store.audit("preparation.context_attached", {"context_hash": read_json(destination / "preparation-context.json")["context_hash"]}, {"ok": True})
    return {"status": "context_attached", "input_fingerprint": context_fingerprint(store)}


def stage(context_path, output, *, policy=None):
    """Create an exclusive working snapshot; never a canonical candidate or application."""
    context_path, output = Path(context_path), Path(output)
    request, _ = load_context(context_path)
    if request.association != "verified":
        raise ValueError("Resolve interview association before staging preparation")
    candidates = [s for s in request.sources if s.kind == "candidate"]
    invitations = [s for s in request.sources if s.kind == "invitation"]
    if len(candidates) != 1 or len(invitations) != 1:
        raise ValueError("Staging expects one selected canonical candidate and invitation snapshot")
    policy = PreparationPolicy.model_validate(policy if policy is not None else default_policy())
    preferences = [s for s in request.sources if s.kind == "preferences"]
    if len(preferences) > 1:
        raise ValueError("Staging expects at most one captured preference/priority source")
    output.mkdir(parents=True, exist_ok=False)
    work = output / "work"
    (work / "inputs/sources").mkdir(parents=True)
    (work / "inputs/sources/canonical-candidate.md").write_text(candidates[0].content, encoding="utf-8")
    (work / "inputs/sources/invitation.md").write_text(invitations[0].content, encoding="utf-8")
    if preferences:
        (work / "inputs/sources/preferences.md").write_text(preferences[0].content, encoding="utf-8")
    write_json(work / "inputs/profile.json", {"preparation_budget_minutes": request.budget_minutes,
        "provenance": "Working copy of captured canonical evidence; original selected candidate remains authoritative."})
    write_json(work / "inputs/application.json", request.identity.model_dump())
    store = Store(work)
    store.initialize({"clock": datetime.now(timezone.utc).isoformat(), "events": [], "history": []}, "A")
    result = attach(store, context_path, context_fingerprint(store), policy=policy.model_dump())
    return {**result, "workspace": str(work), "model_calls": 0, "google_writes": 0, "opportunity_writes": 0}


def current_context(store):
    check_source(store)
    path = store.workspace / "inputs/context/preparation-context.json"
    request, analysis = load_context(path)
    verify_binding(store, request)
    return request, analysis, read_json(path)["context_hash"]


def available_refs(request):
    return {s.source_id for s in request.sources} | {"preparation-context"}


def submit_proposal(store, data):
    request, analysis, context_hash = current_context(store)
    draft = ContextProposal.model_validate(data)
    policy = current_policy(store)
    if draft.policy_hash != digest(policy.model_dump()):
        raise ValueError("Proposal does not match the current preparation policy")
    if draft.context_hash != context_hash or draft.interview_id != request.identity.interview_id:
        raise ValueError("Proposal does not match the selected context/interview")
    if draft.budget_minutes != request.budget_minutes or sum(s.minutes for s in draft.sections) != draft.budget_minutes:
        raise ValueError("Proposal must allocate exactly the current preparation budget")
    section_ids = {s.section_id for s in draft.sections}
    if len(section_ids) != len(draft.sections):
        raise ValueError("Proposal section IDs must be unique")
    if {item.area for item in draft.coverage} != AREAS:
        raise ValueError("Explicitly account for all six preparation areas exactly once")
    covered_sections = set()
    for item in draft.coverage:
        if item.disposition == "included" and (not item.section_ids or not set(item.section_ids).issubset(section_ids)):
            raise ValueError("Included coverage must link existing plan sections")
        if item.disposition == "deferred" and item.section_ids:
            raise ValueError("Deferred areas must not claim included sections or extra minutes")
        if item.disposition == "included":
            covered_sections.update(item.section_ids)
    if covered_sections != section_ids:
        raise ValueError("Every plan section must be linked to included coverage")
    included = {item.area for item in draft.coverage if item.disposition == "included"}
    if not set(policy.required_areas).issubset(included):
        raise ValueError("Default or user-required preparation areas cannot be silently deferred")
    used = set(draft.source_refs) | {ref for section in draft.sections for ref in section.basis_refs}
    if not used.issubset(available_refs(request)):
        raise ValueError("Plan references sources outside its captured context")
    if analysis.unknowns and not draft.unknowns:
        raise ValueError("Plan must retain important context uncertainties")
    schema(store)
    old = latest(store, draft.interview_id)
    record = {"proposal_id": "context-proposal-" + uuid.uuid4().hex[:12], "interview_id": draft.interview_id,
              "version": old["version"] + 1 if old else 1, "draft": draft.model_dump(),
              "input_fingerprint": context_fingerprint(store), "status": "awaiting_plan_approval"}
    record["proposal_hash"] = digest({k: record[k] for k in ("proposal_id", "version", "draft", "input_fingerprint")})
    with store.connect() as db:
        db.execute("INSERT INTO preparation_proposals VALUES (?,?,?,?,?,?,?)", (record["proposal_id"], draft.interview_id,
            record["version"], canonical(record["draft"]), record["input_fingerprint"], record["proposal_hash"], record["status"]))
    store.audit("preparation.context_proposal_submitted", {"proposal_id": record["proposal_id"]}, {"context_hash": context_hash})
    return record


def submit_material(store, approval_id, data, *, material_format="outline-v1"):
    request, _, context_hash = current_context(store)
    record = approved_plan(store, request.identity.interview_id, approval_id)
    if record["draft"].get("context_hash") != context_hash:
        raise ValueError("Approved proposal belongs to another preparation context")
    if record["draft"].get("policy_hash") != digest(current_policy(store).model_dump()):
        raise ValueError("Approved proposal has an outdated preparation policy")
    if material_format == "simulation-v2":
        from interview.practice import SimulationPack
        pack = SimulationPack.model_validate(data)
    elif material_format == "outline-v1":
        pack = MaterialPack.model_validate(data)
    else:
        raise ValueError("Unknown preparation material format")
    if (pack.proposal_id, pack.proposal_version, pack.proposal_hash) != (record["proposal_id"], record["version"], record["proposal_hash"]):
        raise ValueError("Materials do not match the exact approved proposal")
    expected = {s["section_id"]: s["minutes"] for s in record["draft"]["sections"]}
    actual = {s.section_id: s.minutes for s in pack.sections}
    if len(actual) != len(pack.sections) or actual != expected:
        raise ValueError("Material sections and minutes must match the approved plan")
    exercises = [e for s in pack.sections for e in s.exercises] + getattr(pack, "question_bank", [])
    if not {r for e in exercises for r in e.basis_refs}.issubset(available_refs(request)):
        raise ValueError("Materials cite sources outside the approved context")
    if any(e.plan_section_id not in expected or e.timebox_minutes > expected[e.plan_section_id]
           for e in getattr(pack, "question_bank", [])):
        raise ValueError("Alternative questions must fit existing approved plan sections")
    material_id = "context-material-" + uuid.uuid4().hex[:12]
    with store.connect() as db:
        db.execute("INSERT INTO preparation_materials VALUES (?,?,?,?)", (material_id, pack.proposal_id, approval_id, canonical(pack.model_dump())))
        db.execute("UPDATE preparation_proposals SET status='material_ready' WHERE proposal_id=?", (pack.proposal_id,))
    store.audit("preparation.context_material_submitted", {"material_id": material_id, "approval_id": approval_id}, {"ok": True})
    return {"material_id": material_id, **pack.model_dump()}


def render_proposal(record):
    draft = record["draft"]
    lines = ["# Context-aware interview preparation proposal", "", f"Version {record['version']} | {draft['budget_minutes']} minutes",
             "", "Context hash: " + draft["context_hash"], "", "Priorities: " + "; ".join(draft["priorities"])]
    for section in draft["sections"]:
        lines.extend(["", f"## {section['topic']} - {section['minutes']} min", section["objective"],
            "Depth: " + section["depth"], "Focus: " + ", ".join(section["focus_topics"]),
            "Why: " + section["rationale"], "Deliverable: " + section["deliverable"], "Sources: " + ", ".join(section["basis_refs"])])
    lines.extend(["", "## Coverage and explicit deferrals"])
    for item in draft["coverage"]:
        lines.append("- " + item["area"] + " [" + item["disposition"] + "]: " + item["reason"] +
                     (" (sections: " + ", ".join(item["section_ids"]) + ")" if item["section_ids"] else ""))
    lines.extend(["", "## Unknowns", *["- " + value for value in draft["unknowns"]],
                  "", "This proposal awaits exact user acceptance. Full practice materials have not been authorized."])
    return "\n".join(lines) + "\n"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("phase", choices=["stage", "capture", "attach", "inspect"])
    parser.add_argument("--context", type=Path)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--workspace", type=Path)
    parser.add_argument("--expected-fingerprint")
    parser.add_argument("--association", choices=["verified", "unresolved"], default="unresolved")
    parser.add_argument("--enrichment", type=Path)
    parser.add_argument("--policy", type=Path)
    args = parser.parse_args()
    if args.phase == "stage":
        if args.context is None or args.output is None:
            parser.error("stage requires --context and a new --output")
        result = stage(args.context.resolve(), args.output.resolve(), policy=read_json(args.policy.resolve()) if args.policy else None)
    else:
        if args.workspace is None:
            parser.error("attach/inspect requires --workspace")
        store = Store(args.workspace.resolve())
        if args.phase == "capture":
            if args.output is None:
                parser.error("capture requires a new --output")
            result = capture_request(store, args.output.resolve(), association=args.association,
                enrichment=read_json(args.enrichment.resolve()) if args.enrichment else None)
        elif args.phase == "attach":
            if args.context is None or not args.expected_fingerprint:
                parser.error("attach requires --context and --expected-fingerprint")
            result = attach(store, args.context.resolve(), args.expected_fingerprint, policy=read_json(args.policy.resolve()) if args.policy else None)
        else:
            check_source(store)
            result = {"input_fingerprint": context_fingerprint(store), "policy": current_policy(store).model_dump(),
                      "latest": latest(store, read_json(store.workspace / "inputs/application.json")["interview_id"])}
    print(canonical(result))


if __name__ == "__main__":
    main()
