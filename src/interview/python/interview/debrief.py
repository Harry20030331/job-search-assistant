"""Immutable user debriefs and atomic, evidence-linked derived memory."""
from __future__ import annotations

import json
from typing import Literal

from pydantic import Field

from interview.calendar import parse_instant
from interview.memory import normalized
from interview.schemas import Contract
from interview.storage import canonical, digest


class Subject(Contract):
    company: str | None
    role: str = Field(min_length=1)
    round: str | None


class DebriefItem(Contract):
    topic: str = Field(min_length=1)
    observation: str = Field(min_length=1)
    quote: str = Field(min_length=1)
    attribution: Literal["user_report", "self_assessment", "reported_feedback"]
    status: Literal["active", "resolved"]
    supersedes_id: str | None
    suggested_practice: str


class DebriefDraft(Contract):
    summary: str
    items: list[DebriefItem] = Field(max_length=6)
    unknowns: list[str]


class DebriefNode(Contract):
    status: Literal["ready", "needs_input", "blocked"]
    debrief: DebriefDraft | None
    questions: list[str]


def schema(store):
    with store.connect() as db:
        db.execute("CREATE TABLE IF NOT EXISTS debrief_results(record_id TEXT PRIMARY KEY,payload TEXT NOT NULL)")


def append_raw(store, *, record_id, interview_id, text, occurred_at, subject, mode, origin):
    subject = Subject.model_validate(subject).model_dump()
    subject["role"] = normalized(subject["role"])
    if not record_id.strip() or not interview_id.strip() or not text.strip() or len(text) > 20_000:
        raise ValueError("Debrief needs stable identities and 1..20000 characters of original text")
    if mode not in {"interview", "practice"} or origin not in {"human_current_chat", "synthetic_test_script"}:
        raise ValueError("Explicit debrief mode and host provenance are required")
    if parse_instant(occurred_at) > parse_instant(store.meta("clock")):
        raise ValueError("A completed interview/practice debrief cannot be in the future")
    record = {"record_id": record_id, "created_at": store.meta("clock"), "text": text,
              "interview_id": interview_id, "occurred_at": occurred_at, "subject": subject,
              "mode": mode, "origin": origin}
    with store.connect() as db:
        db.execute("BEGIN IMMEDIATE")
        old = db.execute("SELECT payload FROM history WHERE record_id=?", (record_id,)).fetchone()
        if old:
            previous = json.loads(old[0])
            if {k: v for k, v in record.items() if k != "created_at"} != {k: v for k, v in previous.items() if k != "created_at"}:
                raise ValueError("Raw debrief is immutable; use a new record for a correction")
            return previous
        db.execute("INSERT INTO history VALUES (?,?)", (record_id, canonical(record)))
    return record


def saved_result(store, record_id):
    schema(store)
    with store.connect() as db:
        row = db.execute("SELECT payload FROM debrief_results WHERE record_id=?", (record_id,)).fetchone()
        return json.loads(row[0]) if row else None


def commit(store, record_id, data):
    draft = DebriefDraft.model_validate(data)
    schema(store)
    with store.connect() as db:
        db.execute("BEGIN IMMEDIATE")
        existing = db.execute("SELECT payload FROM debrief_results WHERE record_id=?", (record_id,)).fetchone()
        if existing:
            return json.loads(existing[0])
        raw = db.execute("SELECT payload FROM history WHERE record_id=?", (record_id,)).fetchone()
        if not raw:
            raise ValueError("Save the original debrief before deriving memory")
        raw = json.loads(raw[0])
        subject = raw["subject"]
        parents, planned = set(), []
        for i, item in enumerate(draft.items):
            if item.quote not in raw["text"]:
                raise ValueError("Each observation requires an exact quote from this original debrief")
            topic = normalized(item.topic)
            if item.supersedes_id:
                if item.supersedes_id in parents:
                    raise ValueError("A debrief cannot revise one memory twice")
                parents.add(item.supersedes_id)
                old = db.execute("SELECT payload FROM memories WHERE memory_id=?", (item.supersedes_id,)).fetchone()
                previous = json.loads(old[0]) if old else None
                if not previous or previous["status"] == "superseded" or topic not in previous["topics"] or normalized(previous["role"]) != normalized(subject["role"]):
                    raise ValueError("Revision target must be a current memory of the same role and topic")
            note = {"memory_id": "memory-debrief-" + digest({"record": record_id, "item": i})[:16],
                    "source_id": record_id, "created_at": raw["created_at"], "company": subject["company"],
                    "role": normalized(subject["role"]), "round": subject["round"], "topics": [topic],
                    "observation": "[" + item.attribution + "] " + item.observation,
                    "next_action": "[suggested_practice] " + item.suggested_practice if item.suggested_practice else "",
                    "status": item.status, "supersedes_id": item.supersedes_id}
            planned.append(note)
        # All validation precedes updates; this transaction commits every note or none.
        for note in planned:
            if note["supersedes_id"]:
                row = db.execute("SELECT payload FROM memories WHERE memory_id=?", (note["supersedes_id"],)).fetchone()
                previous = json.loads(row[0])
                previous["status"] = "superseded"
                db.execute("UPDATE memories SET payload=? WHERE memory_id=?", (canonical(previous), previous["memory_id"]))
            db.execute("INSERT INTO memories VALUES (?,?)", (note["memory_id"], canonical(note)))
            text = " ".join([note["observation"], note["next_action"], note["role"], note["round"] or "", *note["topics"]])
            db.execute("INSERT INTO memory_fts VALUES (?,?)", (note["memory_id"], text))
        result = {"record_id": record_id, "origin": raw["origin"], "mode": raw["mode"],
                  "draft": draft.model_dump(), "memory_ids": [n["memory_id"] for n in planned]}
        db.execute("INSERT INTO debrief_results VALUES (?,?)", (record_id, canonical(result)))
    store.audit("debrief.committed", {"record_id": record_id}, {"memory_count": len(planned)})
    return result


def render(result):
    draft = result["draft"]
    lines = ["# Interview debrief", "", "Source: " + result["record_id"], "Mode: " + result["mode"], "Provenance: " + result["origin"], "", draft["summary"], ""]
    for item in draft["items"]:
        lines.extend(["## " + item["topic"], "", item["attribution"] + ": " + item["observation"],
                      "", "Original quote: " + item["quote"], "", "Status: " + item["status"],
                      "Suggested practice: " + (item["suggested_practice"] or "None"), ""])
    lines.extend(["## Unknowns", "", *["- " + u for u in draft["unknowns"]]])
    return "\n".join(lines) + "\n"
