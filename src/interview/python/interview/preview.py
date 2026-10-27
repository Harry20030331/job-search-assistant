"""Authored fictional workbench fixtures; never a model evaluation or live approval."""
import argparse
import hashlib
from datetime import datetime, timezone
from pathlib import Path

from interview.context_preparation import AREAS, attach, capture_request, current_policy, submit_material, submit_proposal
from interview.debrief import append_raw, commit
from interview.preparation import approve, context_fingerprint
from interview.preparation_context import ContextRequest, freeze, request_token
from interview.storage import Store, canonical, digest, read_json, write_json


def prepare(workspace, case):
    store = Store(Path(workspace))
    app = read_json(store.workspace / "inputs/application.json")
    profile = read_json(store.workspace / "inputs/profile.json")
    if profile.get("identity", {}).get("fullName") != "Alex Reed (fictional preview)" or store.optional_meta("backend"):
        raise ValueError("Preview recipes require the isolated fictional candidate without a live backend")
    if case == "debrief":
        text = ("In this fictional technical conversation I explained our course API and the request-validation tests I wrote. "
                "I spent too long on implementation details before explaining why the work mattered to users. "
                "I did give one clear example of discussing a testing disagreement with my teammate. No interviewer feedback was provided.")
        append_raw(store, record_id="preview-debrief", interview_id=app["interview_id"], text=text,
            occurred_at="2026-10-24T17:00:00Z", subject={"company": app["company"], "role": app["role"], "round": app["round"]},
            mode="interview", origin="synthetic_test_script")
        commit(store, "preview-debrief", {"summary": "Authored fictional self-report", "unknowns": ["No actual interviewer feedback or outcome is established."],
            "items": [{"topic": "self_introduction", "quote": "I spent too long on implementation details before explaining why the work mattered to users.",
                "observation": "The candidate reports that this introduction buried the user context behind implementation detail.", "attribution": "self_assessment",
                "status": "active", "supersedes_id": None, "suggested_practice": "Rehearse a 60-second project introduction: user problem, contribution, one learning. Time it once."}]})
    technical = case != "materials"
    def source(sid, kind, text):
        return {"source_id": sid, "kind": kind, "origin": "official", "relationship": "exact_role" if kind == "jd" else "context_only",
            "matched_job_id": app["job_id"] if kind == "jd" else None, "company": app["company"], "role": app["role"] if kind == "jd" else None,
            "locator": "https://preview.example.invalid/" + sid, "retrieved_at": datetime.now(timezone.utc).isoformat(),
            "content": text, "content_sha256": hashlib.sha256(text.encode()).hexdigest()}
    evidence = {"sources": [source("company", "company", app["company"] + " is a fictional company building tools for its customers. This preview company values clear explanations and learning from users."),
        source("jd", "jd", app["company"] + ": " + app["role"] + (". Early-career modeling work includes classifier evaluation and error analysis; experimentation supports product decisions." if case == "plan" else ". Graduate software work includes algorithms, request validation, API tests and collaboration. Production ownership is not established."))],
        "research": {"search_queries": 0, "opened_pages": 0, "max_search_queries": 6, "max_opened_pages": 8}}
    root = store.workspace.parent / "preview-context"
    capture_request(store, root / "capture", association="verified", enrichment=evidence)
    request = read_json(root / "capture/request.json")
    analysis = {"request_token": request_token(ContextRequest.model_validate(request)),
        "jd": {"status": "exact", "source_ids": ["jd"], "reason": "Authored exact-role fictional preview evidence", "limitations": ["Not a live employer posting or model analysis"]},
        "role_focus": [], "round_focus": [], "candidate_links": [], "company_brief": [], "reported_themes": [], "learning": [],
        "seniority": {"value": None, "assessment": "unknown", "reason": "Preview does not add inferred level claims.", "refs": []},
        "round_label": {"value": None, "assessment": "unknown", "reason": "Read the invitation for the explicit preview round.", "refs": []},
        "unknowns": ["Actual questions and personal motivations remain unknown."], "questions": []}
    freeze(request, analysis, root / "frozen")
    attach(store, root / "frozen/preparation-context.json", context_fingerprint(store))
    if case == "plan":
        blocks = [("intro", "Introduction & motivations", 8, ["self_introduction", "why_company", "why_role"], "Outline an honest introduction and identify what interests you about this role.", "A 60-second outline and two motivation prompts to complete truthfully."),
            ("story", "One project story", 7, ["project_ownership", "collaboration"], "Explain your course-project contribution and one decision you can defend.", "A short problem, contribution and learning structure with no invented impact."),
            ("experiment", "Experiment design & guardrails", 20, ["experimentation"], "Rehearse a test hypothesis, randomization unit, success metric and guardrail.", "One concise experiment outline with a reasoned stop decision."),
            ("metrics", "Product metrics", 12, ["product_metrics"], "Separate a primary success metric from diagnostic and guardrail measures.", "A three-metric map with one limitation for a clearly stated rehearsal scenario."),
            ("questions", "Questions for the interviewer", 3, ["interviewer_questions"], "Choose two questions you genuinely want to ask about this role.", "Two grounded question topics, without assuming the employer's question list.")]
    elif case == "debrief":
        blocks = [("intro", "Introduction & motivations", 8, ["self_introduction", "why_company", "why_role"], "Give a concise truthful introduction and reflect on actual role interest.", "A 60-second introduction and two honest motivation prompts."),
            ("story", "One collaboration story", 7, ["project_ownership", "collaboration"], "Explain one actual decision from the course API project.", "A scoped personal-contribution and learning outline."),
            ("coding", "Calendar interval algorithm", 30, ["coding"], "Implement and test maximal available intervals with clipping, overlap and duplicate inputs.", "A correct function, boundary tests and time/space analysis."),
            ("design", "A retry-safe reservation API", 12, ["system_design"], "Reason about validation, idempotency and a transaction in one small service.", "A bounded API contract and conflict/retry behavior."),
            ("questions", "Questions for the interviewer", 3, ["interviewer_questions"], "Choose two questions grounded in the role.", "Two candidate-chosen question topics.")]
    else:
        blocks = [("intro", "Introduction & motivations", 7, ["self_introduction", "why_company", "why_role"], "Connect your documented project experience to a genuine interest in the role.", "One short introduction and honest company/role reflection prompts."),
            ("story", "Collaboration story", 8, ["project_ownership", "collaboration"], "Rehearse a truthful teamwork example from the course API project.", "A brief situation, contribution, discussion and learning outline."),
            ("questions", "Questions & logistics", 5, ["interviewer_questions"], "Prepare two role questions and list the interview details still to clarify.", "Two candidate-chosen questions and a short logistics checklist.")]
    sections = [{"section_id": sid, "topic": title, "minutes": minutes, "focus_topics": topics, "depth": "applied" if sid in {"experiment", "metrics", "coding", "design"} else "foundational",
        "objective": objective, "deliverable": deliverable, "rationale": "Follow this round's explicit invitation and the selected time budget. Keep actual experience and personal motivation truthful.",
        "basis_refs": ["candidate", "invitation", "company", "jd"]} for sid, title, minutes, topics, objective, deliverable in blocks]
    coverage = []
    practice_ids = ["experiment", "metrics"] if case == "plan" else ["coding", "design"] if case == "debrief" else []
    for area in sorted(AREAS):
        ids = ["intro"] if area in {"self_introduction", "why_company", "why_role"} else ["story"] if area == "behavioral" else ["questions"] if area == "interviewer_questions" else practice_ids
        coverage.append({"area": area, "disposition": "included" if ids else "deferred", "section_ids": ids,
            "reason": "Covered within the linked budgeted block." if ids else "This is a recruiter conversation without coding; technical drills are deferred."})
    proposal = submit_proposal(store, {"context_hash": read_json(root / "frozen/preparation-context.json")["context_hash"],
        "policy_hash": digest(current_policy(store).model_dump()), "interview_id": app["interview_id"], "budget_minutes": profile["preparation_budget_minutes"],
        "priorities": ["Follow this round's scope", "Keep general preparation concise and truthful"], "sections": sections, "coverage": coverage,
        "source_refs": ["candidate", "invitation", "company", "jd"], "unknowns": ["Actual employer questions are not established.", "Personal motivation must be supplied by the candidate."]})
    from interview.preview_practice import pack
    approval = approve(store, app["interview_id"], proposal["proposal_id"], proposal["proposal_hash"],
        "synthetic_test_script: exact fictional preview plan acceptance, not a human decision")
    submit_material(store, approval, pack(proposal), material_format="simulation-v2")
    write_json(store.workspace.parent / "synthetic-approval.json", {"approval_id": approval, "proposal": proposal,
        "origin": "synthetic_test_script", "note": "Authored UI preview/reconstruction; not an actual historical approval."})
    write_json(store.workspace.parent / "preview-provenance.json", {"kind": "authored_fictional_preview", "model_calls": 0, "human_approvals": 0, "google_calls": 0})
    return {"status": "fictional_" + case + "_ready", "model_calls": 0, "human_approvals": 0}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workspace", required=True, type=Path)
    parser.add_argument("--case", choices=["plan", "materials", "debrief"], required=True)
    args = parser.parse_args()
    print(canonical(prepare(args.workspace, args.case)))


if __name__ == "__main__": main()
