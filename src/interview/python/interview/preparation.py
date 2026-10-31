"""Versioned two-stage preparation contracts. Host approvals are separate from calendar approvals."""
from __future__ import annotations

import json
import uuid
from pathlib import Path
from typing import Literal

from pydantic import Field

from interview.schemas import Contract, strict_schema
from interview.storage import Store, canonical, digest
from interview.freshness import binding as source_binding, check as check_source


class PlanSection(Contract):
    section_id: str
    topic: str
    minutes: int = Field(gt=0)
    objective: str
    basis_refs: list[str] = Field(min_length=1)


class ProposalDraft(Contract):
    interview_id: str
    budget_minutes: int = Field(gt=0)
    priorities: list[str] = Field(min_length=1)
    sections: list[PlanSection] = Field(min_length=3, max_length=5)
    source_refs: list[str] = Field(min_length=1)
    unknowns: list[str]


class PracticeExercise(Contract):
    kind: str = Field(pattern="^suggested_practice$")
    prompt: str = Field(min_length=10)
    steps: list[str] = Field(min_length=1)
    answer_points: list[str] = Field(min_length=1)
    self_check: list[str] = Field(min_length=1)
    basis_refs: list[str] = Field(min_length=1)


class MaterialSection(Contract):
    section_id: str
    minutes: int = Field(gt=0)
    exercises: list[PracticeExercise] = Field(min_length=1, max_length=3)


class MaterialPack(Contract):
    proposal_id: str
    proposal_version: int
    proposal_hash: str
    sections: list[MaterialSection]
    unknowns: list[str]


class ProposalNodeResult(Contract):
    status: Literal["ready", "needs_input", "blocked"]
    proposal: ProposalDraft | None
    questions: list[str]


class MaterialNodeResult(Contract):
    status: Literal["ready", "needs_input", "blocked"]
    material: MaterialPack | None
    questions: list[str]


def context_fingerprint(store):
    inputs = {p.relative_to(store.workspace).as_posix(): digest(p.read_bytes().hex())
              for p in sorted((store.workspace / "inputs").rglob("*")) if p.is_file()}
    return digest({"inputs": inputs, "history": store.rows("history"), "memories": store.rows("memories"),
                   **({"inbox_guard": source_binding(store)} if source_binding(store) else {}),
                   **({"candidate_learning_guard": json.loads(store.optional_meta("candidate_learning_guard"))}
                      if store.optional_meta("candidate_learning_guard") else {})})


def known_refs(store):
    refs = {p.stem for p in (store.workspace / "inputs" / "sources").glob("*.md")}
    refs.update(p.stem for p in (store.workspace / "inputs" / "mail").glob("*.eml"))
    refs.update({"profile", "application"})
    refs.update(r["record_id"] for r in store.rows("history"))
    refs.update(r["memory_id"] for r in store.rows("memories") if r["status"] == "active")
    return refs


SOURCE_REFERENCE_CONTRACT = "source-id-catalog-v1"
SOURCE_REFERENCE_POLICY_REVISION = 3
SOURCE_REFERENCE_GUIDANCE = "Copy source_refs and basis_refs exactly from allowed_source_ids. Mail Message-ID headers, URLs, filenames and descriptive labels are not source IDs. Read the corresponding evidence using the catalog's access method before citing it; do not cite the entire catalog indiscriminately. Reserved profile/application references come from context.get, not documents.read. If explicit preparation priorities are absent, propose evidence-based focus as suggestions, not confirmed personal preferences; missing optional priorities alone does not block a plan when budget and interview context are available.\n"


def source_catalog(store):
    """Describe how to read references without exposing evaluator expectations."""
    catalog = {ref: {"source_id": ref, "kind": "canonical_input", "access": {"operation": "context.get", "arguments": {}}}
               for ref in ("profile", "application")}
    for path in (store.workspace / "inputs/sources").glob("*.md"):
        if path.stem not in catalog:
            catalog[path.stem] = {"source_id": path.stem, "kind": "document", "access": {"operation": "documents.read", "arguments": {"source_id": path.stem}}}
    for path in (store.workspace / "inputs/mail").glob("*.eml"):
        catalog[path.stem] = {"source_id": path.stem, "kind": "mail", "access": {"operation": "mail.read", "arguments": {}}, "select_source_id": path.stem}
    for record in store.rows("history"):
        ref = record["record_id"]
        catalog[ref] = {"source_id": ref, "kind": "raw_history", "access": {"operation": "history.read", "arguments": {"record_id": ref}}}
    for note in store.rows("memories"):
        if note["status"] == "active":
            catalog[note["memory_id"]] = {"source_id": note["memory_id"], "kind": "derived_memory", "access": "memory.search in group D only; verify against its attributed raw history"}
    return [catalog[ref] for ref in sorted(catalog)]


def reference_schema(model, refs):
    """Constrain output references without repairing or weakening host validation."""
    allowed = sorted(set(refs))
    if not allowed or any(not isinstance(ref, str) or not ref for ref in allowed):
        raise ValueError("A nonempty source-ID catalog is required")
    result = strict_schema(model)
    def visit(value):
        if isinstance(value, dict):
            for name, field in value.get("properties", {}).items():
                if name in {"source_refs", "basis_refs"}:
                    field["items"] = {**field.get("items", {}), "enum": allowed}
            for child in value.values(): visit(child)
        elif isinstance(value, list):
            for child in value: visit(child)
    visit(result)
    return result


def schema(store):
    with store.connect() as db:
        db.executescript("""
            CREATE TABLE IF NOT EXISTS preparation_proposals(
                proposal_id TEXT PRIMARY KEY, interview_id TEXT NOT NULL, version INTEGER NOT NULL,
                payload TEXT NOT NULL, fingerprint TEXT NOT NULL, proposal_hash TEXT NOT NULL, status TEXT NOT NULL);
            CREATE UNIQUE INDEX IF NOT EXISTS preparation_version ON preparation_proposals(interview_id,version);
            CREATE TABLE IF NOT EXISTS preparation_approvals(
                approval_id TEXT PRIMARY KEY, proposal_id TEXT NOT NULL, proposal_hash TEXT NOT NULL, evidence TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS preparation_materials(
                material_id TEXT PRIMARY KEY, proposal_id TEXT NOT NULL, approval_id TEXT NOT NULL, payload TEXT NOT NULL);
        """)


def latest(store, interview_id):
    schema(store)
    with store.connect() as db:
        row = db.execute("SELECT * FROM preparation_proposals WHERE interview_id=? ORDER BY version DESC LIMIT 1", (interview_id,)).fetchone()
    if row is None:
        return None
    return {"proposal_id": row[0], "interview_id": row[1], "version": row[2], "draft": json.loads(row[3]),
            "input_fingerprint": row[4], "proposal_hash": row[5], "status": row[6]}


def submit_proposal(store, data):
    check_source(store)
    draft = ProposalDraft.model_validate(data)
    ids = [s.section_id for s in draft.sections]
    if len(ids) != len(set(ids)):
        raise ValueError("Proposal section IDs must be unique")
    if sum(s.minutes for s in draft.sections) != draft.budget_minutes:
        raise ValueError("Section minutes must equal the proposed budget")
    profile = json.loads((store.workspace / "inputs" / "profile.json").read_text(encoding="utf-8-sig"))
    if profile.get("preparation_budget_minutes") is not None and draft.budget_minutes != profile["preparation_budget_minutes"]:
        raise ValueError("Proposal must use the current user budget")
    application = json.loads((store.workspace / "inputs" / "application.json").read_text(encoding="utf-8-sig"))
    if draft.interview_id != application["interview_id"]:
        raise ValueError("Proposal belongs to a different interview")
    used = set(draft.source_refs) | {r for s in draft.sections for r in s.basis_refs}
    if not used.issubset(known_refs(store)):
        raise ValueError("Proposal references unavailable or inactive sources")
    old = latest(store, draft.interview_id)
    record = {"proposal_id": "prep-proposal-" + uuid.uuid4().hex[:12], "interview_id": draft.interview_id,
              "version": old["version"] + 1 if old else 1, "draft": draft.model_dump(),
              "input_fingerprint": context_fingerprint(store), "status": "awaiting_plan_approval"}
    record["proposal_hash"] = digest({k: record[k] for k in ["proposal_id", "version", "draft", "input_fingerprint"]})
    with store.connect() as db:
        db.execute("INSERT INTO preparation_proposals VALUES (?,?,?,?,?,?,?)", (record["proposal_id"], draft.interview_id,
                   record["version"], canonical(record["draft"]), record["input_fingerprint"], record["proposal_hash"], record["status"]))
    store.audit("preparation.proposal_submitted", {"proposal_id": record["proposal_id"]}, record)
    return record


def approve(store, interview_id, proposal_id, proposal_hash, evidence):
    """Host only. Evidence records whether a real user or declared test script accepted."""
    check_source(store)
    record = latest(store, interview_id)
    if not evidence.strip():
        raise ValueError("Approval requires explicit acceptance evidence")
    if not record or (record["proposal_id"], record["proposal_hash"]) != (proposal_id, proposal_hash):
        raise ValueError("Approval must match the latest exact proposal")
    if record["status"] == "rejected" or record["input_fingerprint"] != context_fingerprint(store):
        raise ValueError("Proposal was rejected or its inputs changed")
    approval_id = "prep-approval-" + uuid.uuid4().hex[:12]
    with store.connect() as db:
        db.execute("INSERT INTO preparation_approvals VALUES (?,?,?,?)", (approval_id, proposal_id, proposal_hash, evidence))
        db.execute("UPDATE preparation_proposals SET status='plan_approved' WHERE proposal_id=?", (proposal_id,))
    store.audit("preparation.host_approved", {"approval_id": approval_id, "proposal_id": proposal_id}, {"evidence": evidence})
    return approval_id


def reject(store, interview_id, proposal_id):
    record = latest(store, interview_id)
    if not record or record["proposal_id"] != proposal_id:
        raise ValueError("Rejection must match the latest proposal")
    with store.connect() as db:
        db.execute("UPDATE preparation_proposals SET status='rejected' WHERE proposal_id=?", (proposal_id,))
    store.audit("preparation.host_rejected", {"proposal_id": proposal_id}, {"ok": True})


def approved_plan(store, interview_id, approval_id):
    check_source(store)
    record = latest(store, interview_id)
    if not record or record["status"] not in {"plan_approved", "material_ready"}:
        raise ValueError("Full materials require a user-approved preparation proposal")
    with store.connect() as db:
        approval = db.execute("SELECT proposal_id,proposal_hash FROM preparation_approvals WHERE approval_id=?", (approval_id,)).fetchone()
    if not approval or tuple(approval) != (record["proposal_id"], record["proposal_hash"]):
        raise ValueError("Preparation approval has the wrong type, proposal or version")
    if record["input_fingerprint"] != context_fingerprint(store):
        raise ValueError("Inputs changed after approval; obtain approval of a new proposal")
    return record


def guard_material_write(store, db, record):
    """Serialize publication against a concurrently revised or rejected plan."""
    db.execute("BEGIN IMMEDIATE")
    check_source(store)
    current = db.execute("SELECT proposal_id,proposal_hash,status FROM preparation_proposals WHERE interview_id=? ORDER BY version DESC LIMIT 1", (record["interview_id"],)).fetchone()
    if not current or tuple(current[:2]) != (record["proposal_id"], record["proposal_hash"]) or current[2] not in {"plan_approved", "material_ready"} or record["input_fingerprint"] != context_fingerprint(store):
        raise ValueError("Preparation changed before material publication")
    from interview.practice_jobs import check_job
    check_job(store, db, record, publish=True)


def submit_material(store, interview_id, approval_id, data):
    record = approved_plan(store, interview_id, approval_id)
    pack = MaterialPack.model_validate(data)
    if (pack.proposal_id, pack.proposal_version, pack.proposal_hash) != (record["proposal_id"], record["version"], record["proposal_hash"]):
        raise ValueError("Materials do not match the approved proposal version/hash")
    expected = {s["section_id"]: s["minutes"] for s in record["draft"]["sections"]}
    actual = {s.section_id: s.minutes for s in pack.sections}
    if len(pack.sections) != len(actual) or actual != expected:
        raise ValueError("Material sections/time allocation must match the approved proposal")
    if not {r for s in pack.sections for e in s.exercises for r in e.basis_refs}.issubset(known_refs(store)):
        raise ValueError("Materials reference unavailable or inactive sources")
    material_id = "prep-material-" + uuid.uuid4().hex[:12]
    with store.connect() as db:
        guard_material_write(store, db, record)
        db.execute("INSERT INTO preparation_materials VALUES (?,?,?,?)", (material_id, pack.proposal_id, approval_id, canonical(pack.model_dump())))
        db.execute("UPDATE preparation_proposals SET status='material_ready' WHERE proposal_id=?", (pack.proposal_id,))
    store.audit("preparation.material_submitted", {"material_id": material_id, "approval_id": approval_id}, {"ok": True})
    return {"material_id": material_id, **pack.model_dump()}


def render_proposal(record):
    draft = record["draft"]
    lines = ["# Interview preparation proposal", "", f"Version {record['version']} · {draft['budget_minutes']} minutes", "",
             "Priorities: " + "; ".join(draft["priorities"]), ""]
    for s in draft["sections"]:
        lines.extend([f"## {s['topic']} — {s['minutes']} min", "", s["objective"], "", "Sources: " + ", ".join(s["basis_refs"]), ""])
    lines.extend(["## Unknowns", "", *["- " + u for u in draft["unknowns"]]])
    return "\n".join(lines) + "\n"


def render_material(record, material):
    topics = {s["section_id"]: s["topic"] for s in record["draft"]["sections"]}
    lines = ["# Interview preparation materials", "", "Practice scenarios are suggestions, not confirmed employer questions.", "",
             f"Approved proposal version: {record['version']}", ""]
    for section in material["sections"]:
        lines.extend([f"## {topics[section['section_id']]} — {section['minutes']} min", ""])
        for exercise in section["exercises"]:
            lines.extend(["### Practice prompt", "", exercise["prompt"], "", "Steps:", *[f"{i}. {x}" for i, x in enumerate(exercise["steps"], 1)],
                          "", "Answer points:", *["- " + x for x in exercise["answer_points"]], "", "Self-check:", *["- [ ] " + x for x in exercise["self_check"]],
                          "", "Sources: " + ", ".join(exercise["basis_refs"]), ""])
    lines.extend(["## Unknowns", "", *["- " + u for u in material["unknowns"]]])
    return "\n".join(lines) + "\n"
