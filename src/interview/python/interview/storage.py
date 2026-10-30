from __future__ import annotations

import hashlib
import json
import sqlite3
import uuid
from contextlib import contextmanager
from pathlib import Path


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def write_json(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def canonical(value) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def digest(value) -> str:
    return hashlib.sha256(canonical(value).encode()).hexdigest()


class Store:
    def __init__(self, workspace: Path):
        self.workspace = Path(workspace).resolve()
        self.path = self.workspace / "state.sqlite3"

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.path, timeout=10)
        db.row_factory = sqlite3.Row
        try:
            with db:
                yield db
        finally:
            db.close()

    def initialize(self, initial: dict, group: str = "A") -> None:
        if self.path.exists():
            raise FileExistsError("Workspace already has state; use a new run directory.")
        self.workspace.mkdir(parents=True, exist_ok=True)
        with self.connect() as db:
            db.executescript("""
                CREATE TABLE meta(key TEXT PRIMARY KEY, value TEXT NOT NULL);
                CREATE TABLE events(event_id TEXT PRIMARY KEY, payload TEXT NOT NULL);
                CREATE TABLE confirmations(confirmation_id TEXT PRIMARY KEY, action TEXT NOT NULL, created_at TEXT NOT NULL);
                CREATE TABLE audit(seq INTEGER PRIMARY KEY, operation TEXT NOT NULL, payload TEXT NOT NULL, result TEXT NOT NULL, at TEXT NOT NULL);
                CREATE TABLE history(record_id TEXT PRIMARY KEY, payload TEXT NOT NULL);
                CREATE TABLE workflow(interview_id TEXT PRIMARY KEY, payload TEXT NOT NULL);
                CREATE TABLE memories(memory_id TEXT PRIMARY KEY, payload TEXT NOT NULL);
                CREATE VIRTUAL TABLE memory_fts USING fts5(memory_id UNINDEXED, text);
            """)
            for key, value in {"clock": initial["clock"], "group": group}.items():
                db.execute("INSERT INTO meta VALUES (?,?)", (key, value))
            for event in initial.get("events", []):
                db.execute("INSERT INTO events VALUES (?,?)", (event["event_id"], canonical(event)))
            for record in initial.get("history", []):
                db.execute("INSERT INTO history VALUES (?,?)", (record["record_id"], canonical(record)))

    def meta(self, key: str) -> str:
        with self.connect() as db:
            row = db.execute("SELECT value FROM meta WHERE key=?", (key,)).fetchone()
            if row is None:
                raise ValueError(f"Unknown metadata field: {key}")
            return row[0]

    def optional_meta(self, key: str, default=None):
        with self.connect() as db:
            row = db.execute("SELECT value FROM meta WHERE key=?", (key,)).fetchone()
        return row[0] if row else default

    def rows(self, table: str) -> list[dict]:
        if table not in {"events", "history", "workflow", "memories"}:
            raise ValueError("Unknown table")
        with self.connect() as db:
            return [json.loads(row[0]) for row in db.execute(f"SELECT payload FROM {table} ORDER BY rowid")]

    def confirm(self, action: dict) -> str:
        """Only the host user simulator calls this, never the agent tool API."""
        confirmation_id = "confirm-" + uuid.uuid4().hex[:12]
        with self.connect() as db:
            db.execute("INSERT INTO confirmations VALUES (?,?,?)", (confirmation_id, canonical(action), self.meta("clock")))
        self.audit("user.confirm", {"confirmation_id": confirmation_id, "action": action}, {"ok": True})
        return confirmation_id

    def audit(self, operation: str, payload: dict, result: dict) -> None:
        at = self.meta("clock")
        with self.connect() as db:
            cursor = db.execute("INSERT INTO audit(operation,payload,result,at) VALUES (?,?,?,?)", (operation, canonical(payload), canonical(result), at))
            seq = cursor.lastrowid
        with (self.workspace / "actions.jsonl").open("a", encoding="utf-8") as stream:
            stream.write(canonical({"seq": seq, "operation": operation, "payload": payload, "result": result, "at": at}) + "\n")

    def audit_rows(self) -> list[dict]:
        with self.connect() as db:
            return [{"seq": r["seq"], "operation": r["operation"], "payload": json.loads(r["payload"]), "result": json.loads(r["result"]), "at": r["at"]} for r in db.execute("SELECT * FROM audit ORDER BY seq")]
