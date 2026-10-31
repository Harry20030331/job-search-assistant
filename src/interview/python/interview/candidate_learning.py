"""Explicit host binding and read-only, scoped debrief snapshots for canonical runs.

No account discovery, name matching, credentials, Google calls or model calls.
The binding is a host assertion, not proof that a human owns an account.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sqlite3
import uuid
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

from pydantic import Field

from interview.calendar import parse_instant
from interview.memory import normalized
from interview.schemas import Contract
from interview.storage import Store, canonical, digest, read_json, write_json
from interview.topics import POLICY as TOPIC_POLICY, canonical_topics, memory_topics

PROTOCOL = "candidate-learning-v1"
GUARD = "candidate_learning_guard"


class Scope(Contract):
    topics: list[str] = Field(min_length=1, max_length=16)
    max_age_days: int = Field(default=180, ge=1, le=3650)
    limit: int = Field(default=5, ge=1, le=5)
    reason: str = Field(min_length=1, max_length=1000)


class Binding(Contract):
    protocol: Literal["candidate-learning-v1"]
    binding_id: str
    candidate_anchor: dict
    learning_workspace: str
    account_hash: str = Field(pattern=r"^[a-f0-9]{64}$")
    created_at: str
    origin: Literal["human_current_chat", "synthetic_test_script"]
    evidence: str = Field(min_length=1, max_length=2000)


def now():
    return datetime.now(timezone.utc).isoformat()


def file_hash(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def anchor(store):
    value = store.optional_meta("candidate_anchor")
    if not value:
        raise ValueError("Restage the canonical handoff with candidate source identity before binding learning")
    value = json.loads(value)
    profile = read_json(store.workspace / "inputs/profile.json")
    if digest(profile.get("identity")) != value["identity_hash"]:
        raise ValueError("Canonical candidate identity differs from the staged anchor")
    return value


def read_learning(workspace):
    """One SQLite snapshot; mode=ro never creates or writes the selected account DB."""
    workspace = Path(workspace)
    if not workspace.is_absolute():
        raise ValueError("Learning workspace must be absolute")
    with closing(sqlite3.connect((workspace / "state.sqlite3").resolve().as_uri() + "?mode=ro", uri=True)) as db:
        db.execute("BEGIN")
        row = db.execute("SELECT value FROM meta WHERE key='account'").fetchone()
        if not row or not row[0].strip():
            raise ValueError("Learning store requires an explicit account identity")
        data = {table: [json.loads(r[0]) for r in db.execute("SELECT payload FROM " + table + " ORDER BY rowid")]
                for table in ("history", "memories")}
        return digest(row[0]), data, digest(data)


def exclusive_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("x", encoding="utf-8") as stream:
        stream.write(json.dumps(value, ensure_ascii=False, indent=2) + "\n")


def revoked_path(path):
    return Path(str(path) + ".revoked.json")


def bind(store, learning_workspace, output, *, origin, evidence):
    from interview.freshness import check
    check(store)
    identity = anchor(store)
    learning_workspace = Path(learning_workspace)
    account_hash, _, _ = read_learning(learning_workspace)
    value = Binding.model_validate({"protocol": PROTOCOL, "binding_id": "learning-" + uuid.uuid4().hex,
        "candidate_anchor": identity, "learning_workspace": str(learning_workspace.resolve()),
        "account_hash": account_hash, "created_at": now(), "origin": origin, "evidence": evidence}).model_dump()
    path = Path(output).resolve()
    if path.is_relative_to(store.workspace / "inputs") or revoked_path(path).exists():
        raise ValueError("Use a new host-only binding outside working inputs")
    exclusive_json(path, value)
    return {"status": "candidate_learning_bound", "binding": str(path), "binding_id": value["binding_id"],
            "account_hash": account_hash, "model_calls": 0, "google_calls": 0}


def load_binding(store, path):
    path = Path(path)
    if not path.is_absolute() or revoked_path(path).exists():
        raise ValueError("Candidate learning binding is unavailable or revoked")
    value = Binding.model_validate(read_json(path)).model_dump()
    if value["candidate_anchor"] != anchor(store):
        raise ValueError("Learning binding belongs to a different canonical candidate source")
    return value


def revoke(path, *, origin, evidence):
    if origin not in {"human_current_chat", "synthetic_test_script"} or not evidence.strip():
        raise ValueError("Revocation requires explicit host provenance")
    path = Path(path).resolve()
    value = Binding.model_validate(read_json(path))
    exclusive_json(revoked_path(path), {"binding_id": value.binding_id, "binding_hash": file_hash(path),
        "revoked_at": now(), "origin": origin, "evidence": evidence})
    return {"status": "candidate_learning_revoked", "binding_id": value.binding_id}


def select(data, application, scope, captured_at):
    """Conservative exact-role/topic gate, round compatibility and occurrence-age cap.

    Different known rounds are excluded. Unknown rounds stay explicitly unknown.
    Company affects order only: a previous employer's report is never a prediction.
    No fuzzy title inference or embedding/API call is hidden in this selector.
    """
    scope = Scope.model_validate(scope)
    topics = canonical_topics(scope.topics)
    if not topics:
        raise ValueError("Choose at least one nonempty learning topic")
    role, round_name = normalized(application["role"]), normalized(application.get("round") or "")
    clock = parse_instant(captured_at)
    history = {r["record_id"]: r for r in data["history"]}
    selected = []
    for note in data["memories"]:
        raw = history.get(note["source_id"])
        selected_topics = memory_topics(note)
        if note["status"] != "active" or normalized(note["role"]) != role or not (topics & selected_topics):
            continue
        if not raw or raw.get("mode") not in {"interview", "practice"} or not raw.get("subject"):
            continue
        subject = raw["subject"]
        if (normalized(subject["role"]) != role or subject.get("company") != note.get("company") or
                subject.get("round") != note.get("round")):
            continue
        note_round = normalized(note.get("round") or "")
        if round_name and note_round and round_name != note_round:
            continue
        age = (clock - parse_instant(raw["occurred_at"])).total_seconds() / 86400
        if age < 0 or age > scope.max_age_days or parse_instant(note["created_at"]) > clock or parse_instant(raw["created_at"]) > clock:
            continue
        same_company = normalized(note.get("company") or "") == normalized(application["company"])
        score = (len(topics & selected_topics), int(bool(round_name) and round_name == note_round), int(same_company), -age)
        selected.append((score, note, raw))
    selected.sort(key=lambda item: (tuple(-v for v in item[0]), item[1]["memory_id"]))
    return [(note, raw) for _, note, raw in selected[:scope.limit]]


def practice_source(note, raw, account_hash, captured_at):
    from interview.preparation_context import Source
    content = ("Historical user-provided debrief/practice evidence, not independently verified ability or employer expectations.\n"
        "Only this derived note is selected as active; other statements in the original record are historical context, not current weaknesses.\n"
        "A suggested action is system advice. An improvement report is scoped to its reported activity, not global mastery.\n\n"
        + canonical({"record_id": raw["record_id"], "historical_interview_id": raw["interview_id"],
            "occurred_at": raw["occurred_at"], "mode": raw["mode"], "origin": raw["origin"],
            "historical_subject": raw["subject"], "original_text": raw["text"], "selected_active_note": note,
            "retrieval_topics": sorted(memory_topics(note)), "topic_policy": TOPIC_POLICY}))
    return Source.model_validate({"source_id": "practice-" + digest({"memory": note["memory_id"], "account": account_hash})[:20],
        "kind": "practice", "origin": "user_record", "relationship": "context_only", "matched_job_id": None,
        "company": note.get("company"), "role": note["role"],
        "locator": "account-learning:" + account_hash + ":record:" + digest(raw["record_id"])[:20],
        "retrieved_at": captured_at, "content": content, "content_sha256": hashlib.sha256(content.encode("utf-8")).hexdigest()}).model_dump(mode="json")


def attach(store, binding_path, scope):
    from interview.freshness import check
    from interview.preparation import context_fingerprint
    check(store)
    scope = Scope.model_validate(scope)
    destination = store.workspace / "inputs/learning"
    if (destination.exists() or store.optional_meta(GUARD) or
            (store.workspace / "inputs/context").exists() or
            (store.workspace / "inputs/sources/preparation-context.md").exists()):
        raise ValueError("Attach learning once, before context analysis; use a fresh staged run for changes")
    # Also reject attaching after legacy proposals/approvals, even without analyzed context.
    with store.connect() as db:
        if db.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='preparation_proposals'").fetchone() and db.execute("SELECT 1 FROM preparation_proposals LIMIT 1").fetchone():
            raise ValueError("Learning must be selected before proposing preparation")
    before = context_fingerprint(store)
    binding_path = Path(binding_path).resolve()
    binding_hash = file_hash(binding_path)
    value = load_binding(store, binding_path)
    account_hash, data, learning_hash = read_learning(Path(value["learning_workspace"]))
    if account_hash != value["account_hash"]:
        raise ValueError("Selected learning store account changed")
    application = read_json(store.workspace / "inputs/application.json")
    captured_at = now()
    selected = select(data, application, scope.model_dump(), captured_at)
    sources = [practice_source(note, raw, account_hash, captured_at) for note, raw in selected]
    snapshot = {"protocol": PROTOCOL, "topic_policy": TOPIC_POLICY, "captured_at": captured_at, "scope": scope.model_dump(),
        "target": {k: application.get(k) for k in ("job_id", "application_id", "interview_id", "company", "role", "round")},
        "sources": sources, "retrieved_memory_ids": [n["memory_id"] for n, _ in selected]}
    guard = {"binding_path": str(binding_path), "binding_hash": binding_hash, "learning_hash": learning_hash,
             "snapshot_hash": digest(snapshot), "target_hash": digest(application)}
    # No changed account/memory is silently accepted during snapshot creation.
    load_binding(store, binding_path)
    if (file_hash(binding_path) != binding_hash or read_learning(Path(value["learning_workspace"]))[2] != learning_hash or
            context_fingerprint(store) != before):
        raise ValueError("Learning or preparation inputs changed during retrieval")
    destination.mkdir()
    write_json(destination / "snapshot.json", snapshot)
    with store.connect() as db:
        db.execute("INSERT INTO meta VALUES (?,?)", (GUARD, canonical(guard)))
    check(store)
    store.audit("candidate_learning.attached", {"binding_id": value["binding_id"], "scope": scope.model_dump()},
                {"retrieved_memory_ids": snapshot["retrieved_memory_ids"]})
    return {"status": "candidate_learning_attached", "retrieved_count": len(sources),
        "retrieved_memory_ids": snapshot["retrieved_memory_ids"], "model_calls": 0, "google_calls": 0,
        "account_writes": 0, "input_fingerprint": context_fingerprint(store)}


def check_guard(store):
    value = store.optional_meta(GUARD)
    path = store.workspace / "inputs/learning/snapshot.json"
    if not value:
        if path.exists():
            raise ValueError("Learning snapshot has no host binding")
        return
    guard = json.loads(value)
    binding_path = Path(guard["binding_path"])
    value = load_binding(store, binding_path)
    if file_hash(binding_path) != guard["binding_hash"]:
        raise ValueError("Learning binding changed; use a fresh preparation run")
    account_hash, data, learning_hash = read_learning(Path(value["learning_workspace"]))
    if account_hash != value["account_hash"] or learning_hash != guard["learning_hash"]:
        raise ValueError("New or revised debrief memory invalidated the preparation context")
    if (not path.is_file() or digest(read_json(path)) != guard["snapshot_hash"] or
            digest(read_json(store.workspace / "inputs/application.json")) != guard["target_hash"]):
        raise ValueError("Learning snapshot or selected interview changed")
    snapshot = read_json(path)
    if snapshot.get("topic_policy") != TOPIC_POLICY:
        raise ValueError("Learning topic policy changed; select learning in a fresh preparation run")
    active_ids = [note["memory_id"] for note, _ in select(data, read_json(store.workspace / "inputs/application.json"), snapshot["scope"], now())]
    if active_ids != snapshot["retrieved_memory_ids"]:
        raise ValueError("Learning relevance or age window changed; capture a fresh preparation context")


def sources(store):
    check_guard(store)
    path = store.workspace / "inputs/learning/snapshot.json"
    return read_json(path)["sources"] if path.is_file() else []


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("phase", choices=["bind", "attach", "revoke"])
    parser.add_argument("--workspace", type=Path)
    parser.add_argument("--learning-workspace", type=Path)
    parser.add_argument("--binding", type=Path)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--scope", type=Path)
    parser.add_argument("--origin", choices=["human_current_chat", "synthetic_test_script"])
    parser.add_argument("--evidence")
    args = parser.parse_args()
    if args.phase == "bind":
        if not all((args.workspace, args.learning_workspace, args.output, args.origin, args.evidence)):
            parser.error("bind requires --workspace, --learning-workspace, new --output, --origin and --evidence")
        result = bind(Store(args.workspace), args.learning_workspace, args.output, origin=args.origin, evidence=args.evidence)
    elif args.phase == "attach":
        if not all((args.workspace, args.binding, args.scope)):
            parser.error("attach requires --workspace, --binding and --scope")
        result = attach(Store(args.workspace), args.binding, read_json(args.scope))
    else:
        if not all((args.binding, args.origin, args.evidence)):
            parser.error("revoke requires --binding, --origin and --evidence")
        result = revoke(args.binding, origin=args.origin, evidence=args.evidence)
    print(canonical(result))


if __name__ == "__main__":
    main()
