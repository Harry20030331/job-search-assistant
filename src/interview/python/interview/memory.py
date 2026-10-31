from __future__ import annotations

import json
import math
import re
import uuid
from datetime import datetime

from pydantic import Field

from interview.calendar import parse_instant
from interview.schemas import Contract
from interview.storage import Store, canonical
from interview.topics import canonical_topics, memory_topics, observation_topics


ALIASES = {"capacity": "capacity_estimation", "capacity estimation": "capacity_estimation", "system design": "system_design", "backend": "backend_swe", "ml": "ml_engineer"}


def normalized(value: str) -> str:
    return ALIASES.get(value.strip().lower(), value.strip().lower().replace(" ", "_"))


class MemoryNote(Contract):
    memory_id: str | None = None
    source_id: str
    created_at: str
    company: str | None = None
    role: str
    round: str | None = None
    topics: list[str]
    observation: str
    next_action: str
    status: str = "active"
    supersedes_id: str | None = None


def upsert(store: Store, data: dict) -> dict:
    note = MemoryNote.model_validate(data).model_dump()
    if note["status"] not in {"active", "superseded", "resolved"}:
        raise ValueError("Invalid memory status")
    if parse_instant(note["created_at"]) > parse_instant(store.meta("clock")):
        raise ValueError("Memory cannot come from the future")
    note["topics"] = sorted(observation_topics(note["topics"], note["observation"]))
    note["role"] = normalized(note["role"])
    note["memory_id"] = note["memory_id"] or "memory-" + uuid.uuid4().hex[:12]
    with store.connect() as db:
        if not db.execute("SELECT 1 FROM history WHERE record_id=?", (note["source_id"],)).fetchone():
            raise ValueError("Memory source_id must reference a raw history record")
        existing = db.execute("SELECT payload FROM memories WHERE memory_id=?", (note["memory_id"],)).fetchone()
        if existing:
            previous = json.loads(existing[0])
            if "supersedes_id" not in data:
                note["supersedes_id"] = previous.get("supersedes_id")
            if note == previous:
                return previous
            # An ordinary upsert must not erase the evidence behind a previous
            # version. Give changed content a new identity and retain the parent.
            requested_parent = data.get("supersedes_id")
            if requested_parent and requested_parent not in {previous["memory_id"], previous.get("supersedes_id")}:
                raise ValueError("Existing-memory update has a conflicting parent; use a new memory_id for a separate issue")
            note["supersedes_id"] = previous["memory_id"]
            note["memory_id"] = "memory-" + uuid.uuid4().hex[:12]
        if note["supersedes_id"]:
            if note["supersedes_id"] == note["memory_id"]:
                raise ValueError("A memory cannot supersede itself")
            old = db.execute("SELECT payload FROM memories WHERE memory_id=?", (note["supersedes_id"],)).fetchone()
            if not old:
                raise ValueError("Unknown superseded memory")
            previous = json.loads(old[0])
            previous["status"] = "superseded"
            db.execute("UPDATE memories SET payload=? WHERE memory_id=?", (canonical(previous), previous["memory_id"]))
        db.execute("INSERT OR REPLACE INTO memories VALUES (?,?)", (note["memory_id"], canonical(note)))
        db.execute("DELETE FROM memory_fts WHERE memory_id=?", (note["memory_id"],))
        text = " ".join([note["observation"], note["next_action"], note["role"], note["round"] or "", *note["topics"]])
        db.execute("INSERT INTO memory_fts VALUES (?,?)", (note["memory_id"], text))
    return note


def search(store: Store, query: dict) -> list[dict]:
    topics = canonical_topics(query.get("topics", []))
    role = normalized(query.get("role", ""))
    round_name = (query.get("round") or "").lower()
    tokens = re.findall(r"[a-z0-9_]+", " ".join([query.get("query", ""), role, *topics]).lower())[:30]
    if not tokens:
        return []
    expression = " OR ".join('"' + t + '"' for t in dict.fromkeys(tokens))
    with store.connect() as db:
        rows = db.execute("""
            SELECT m.payload, bm25(memory_fts) AS lexical
            FROM memory_fts JOIN memories m USING(memory_id)
            WHERE memory_fts MATCH ?
              AND json_extract(m.payload,'$.status')='active'
            ORDER BY lexical, memory_id
        """, (expression,)).fetchall()
        # Old FTS rows contain the original broad tag. Supplement matching notes
        # with a read-only topic view; do not rewrite their evidence or index.
        by_id = {json.loads(row[0])["memory_id"]: (json.loads(row[0]), row[1]) for row in rows}
        if topics:
            for row in db.execute("SELECT payload FROM memories WHERE json_extract(payload,'$.status')='active'"):
                note = json.loads(row[0])
                if topics & memory_topics(note):
                    by_id.setdefault(note["memory_id"], (note, 0.0))
    # Time filtering precedes candidate truncation, including in manually constructed datasets.
    now = parse_instant(store.meta("clock"))
    candidates = [(note, lexical) for note, lexical in by_id.values() if parse_instant(note["created_at"]) <= now]
    scored = []
    for note, lexical in candidates:
        existing = memory_topics(note)
        jaccard = len(topics & existing) / len(topics | existing) if topics | existing else 0
        role_match = int(bool(role) and role == normalized(note["role"]))
        if not jaccard and not role_match:
            continue
        age = max(0, (now - parse_instant(note["created_at"])).total_seconds() / 86400)
        score = 4*jaccard + 2*role_match + int(bool(round_name) and round_name == (note["round"] or "").lower()) + math.exp(-age/30)
        scored.append({**note, "retrieval_score": score, "lexical_score": lexical})
    return sorted(scored, key=lambda x: (-x["retrieval_score"], x["lexical_score"], x["memory_id"]))[:5]
