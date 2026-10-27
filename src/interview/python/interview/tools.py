"""Auditable JSON tools. Intentionally uses only a local experimental calendar."""
from __future__ import annotations

import argparse
import json
import sys
import uuid
from datetime import datetime, timezone
from email import policy
from email.parser import BytesParser
from pathlib import Path

from interview import memory
from interview.calendar import apply_action, overlaps, parse_instant
from interview.schemas import CalendarAction
from interview.storage import Store, canonical, read_json, write_json


def within(root: Path, relative: str) -> Path:
    path = (root / relative).resolve()
    if not path.is_relative_to(root.resolve()):
        raise ValueError("Path must stay inside the workspace")
    return path


def dispatch(workspace: Path, operation: str, payload: dict) -> dict:
    store = Store(workspace)
    try:
        if store.optional_meta("backend", "local") == "google":
            with store.connect() as db:
                db.execute("UPDATE meta SET value=? WHERE key='clock'", (datetime.now(timezone.utc).isoformat(),))
        data = execute(store, operation, payload)
        result = {"ok": True, "data": data}
    except (ValueError, KeyError, FileNotFoundError, TypeError) as exc:
        result = {"ok": False, "error": str(exc)}
    store.audit(operation, payload, result)
    return result


def execute(store: Store, operation: str, p: dict):
    root = store.workspace
    group = store.meta("group")
    if operation.startswith("workflow.") and group not in {"C", "D"}:
        raise ValueError("Workflow extension is disabled for this group")
    if operation.startswith("memory.") and group != "D":
        raise ValueError("Structured memory extension is disabled for this group; raw history remains available")
    backend = store.optional_meta("backend", "local")
    if backend not in {"local", "google"}:
        raise ValueError("Unknown backend")
    if backend == "google" and operation in {"mail.read", "calendar.list", "calendar.create", "calendar.update", "workflow.check"}:
        from interview.google_adapter import for_store
        return for_store(store).execute(operation, p)
    if operation == "mail.read":
        mail_dir = root / "inputs" / "mail"
        messages = []
        for path in sorted(mail_dir.glob("*.eml")):
            message = BytesParser(policy=policy.default).parsebytes(path.read_bytes())
            if p.get("message_id") and p["message_id"] != message["Message-ID"]:
                continue
            body = message.get_body(preferencelist=("plain",))
            messages.append({"source_id": path.stem, "message_id": message["Message-ID"], "in_reply_to": message["In-Reply-To"], "subject": message["Subject"], "from": message["From"], "body": body.get_content() if body else message.get_content()})
        return messages
    if operation == "context.get":
        application = read_json(root / "inputs" / "application.json")
        if p.get("application_id") and p["application_id"] != application["application_id"]:
            raise ValueError("Unknown application_id")
        return {"application": application, "profile": read_json(root / "inputs" / "profile.json"), "clock": store.meta("clock"), "sources": sorted(path.stem for path in (root / "inputs" / "sources").glob("*.md"))}
    if operation == "documents.read":
        source_id = p["source_id"]
        path = within(root / "inputs" / "sources", source_id + ".md")
        return {"source_id": source_id, "text": path.read_text(encoding="utf-8")}
    if operation == "calendar.list":
        events = store.rows("events")
        if p.get("start") and p.get("end"):
            events = [event for event in events if overlaps(p["start"], p["end"], event["start"], event["end"])]
        return events
    if operation in {"calendar.create", "calendar.update"}:
        action = CalendarAction.model_validate({k: v for k, v in p.items() if k != "confirmation_id"})
        if action.operation != operation.split(".")[1]:
            raise ValueError("Operation must agree with action.operation")
        return apply_action(store, action, p.get("confirmation_id"))
    if operation == "mail.save_draft":
        draft = {"draft_id": "draft-" + uuid.uuid4().hex[:12], "in_reply_to": p["in_reply_to"], "body": p["body"]}
        write_json(root / "artifacts" / (draft["draft_id"] + ".json"), draft)
        return draft
    if operation == "history.list":
        offset = int(p.get("offset", 0))
        limit = min(20, max(1, int(p.get("limit", 20))))
        records = store.rows("history")
        return {"records": records[offset:offset+limit], "next_offset": offset+limit if offset+limit < len(records) else None}
    if operation == "history.read":
        records = [r for r in store.rows("history") if r["record_id"] == p["record_id"]]
        if not records:
            raise ValueError("Unknown history record")
        return records[0]
    if operation == "history.append":
        if parse_instant(p["created_at"]) > parse_instant(store.meta("clock")):
            raise ValueError("History cannot come from the future")
        record = {"record_id": p.get("record_id", "history-" + uuid.uuid4().hex[:12]), "created_at": p["created_at"], "text": p["text"]}
        with store.connect() as db:
            db.execute("INSERT INTO history VALUES (?,?)", (record["record_id"], canonical(record)))
        return record
    if operation == "workflow.load":
        return next((s for s in store.rows("workflow") if s["interview_id"] == p["interview_id"]), None)
    if operation == "workflow.save":
        with store.connect() as db:
            db.execute("INSERT OR REPLACE INTO workflow VALUES (?,?)", (p["interview_id"], canonical(p)))
        return p
    if operation == "workflow.check":
        action = CalendarAction.model_validate(p["action"]).model_dump()
        with store.connect() as db:
            confirmation = db.execute("SELECT action FROM confirmations WHERE confirmation_id=?", (p.get("confirmation_id"),)).fetchone()
        conflicts = [e["event_id"] for e in store.rows("events") if e["event_id"] != action["event_id"] and overlaps(action["start"], action["end"], e["start"], e["end"])]
        duplicates = [e["event_id"] for e in store.rows("events") if e.get("interview_id") == action["interview_id"] and e["event_id"] != action["event_id"]]
        matches = bool(confirmation and json.loads(confirmation[0]) == action)
        return {"confirmation_matches": matches, "conflicting_event_ids": conflicts, "duplicate_interview_ids": duplicates, "ready": matches and not conflicts and not duplicates}
    if operation == "memory.upsert":
        return memory.upsert(store, p)
    if operation == "memory.search":
        return memory.search(store, p)
    raise ValueError("Unknown operation")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["call"])
    parser.add_argument("operation")
    parser.add_argument("--input", required=True)
    parser.add_argument("--workspace", type=Path, default=Path.cwd())
    args = parser.parse_args()
    try:
        payload = json.load(sys.stdin) if args.input == "-" else read_json(Path(args.input))
        result = dispatch(args.workspace, args.operation, payload)
    except Exception as exc:
        print(canonical({"ok": False, "error": f"{type(exc).__name__}: {exc}"}))
        return 2
    print(canonical(result))
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
