"""Account-level preparation/debrief orchestration over the existing nodes."""
from __future__ import annotations

import json
import re
import shutil
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

from interview.preparation_flow import run_node
from interview.freshness import attach, check
from interview.preparation import context_fingerprint, latest
from interview.storage import Store, canonical, digest, read_json, write_json


ROOT = Path(__file__).resolve().parents[1]


def configure_profile(inbox, profile, sources):
    if not isinstance(profile.get("preparation_budget_minutes"), int) or not 3 <= profile["preparation_budget_minutes"] <= 480:
        raise ValueError("Provide a preparation budget of 3..480 minutes")
    if not profile.get("priorities") or not isinstance(profile["priorities"], list):
        raise ValueError("Provide preparation priorities")
    if any(not re.fullmatch(r"[a-zA-Z0-9_-]+", key) or key == "invitation" or not isinstance(text, str) for key, text in sources.items()):
        raise ValueError("Profile source IDs must be simple and cannot replace invitation evidence")
    inbox.set_preparation_config({"profile": profile, "sources": sources})


def learning_store(inbox, *, clock=None):
    store = Store(inbox.path.parent / "learning")
    now = clock or datetime.now(timezone.utc).isoformat()
    if not store.path.exists():
        store.initialize({"clock": now}, "D")
        with store.connect() as db:
            db.execute("INSERT INTO meta VALUES ('account',?)", (inbox.account,))
    else:
        if store.meta("account") != inbox.account:
            raise ValueError("Learning store belongs to a different account")
        with store.connect() as db:
            db.execute("UPDATE meta SET value=? WHERE key='clock'", (now,))
    return store


def preparation_for_handoff(inbox, *, handoff_id=None, run_root=Path("runs/inbox-preparation"), node_fn=run_node):
    config = inbox.setting("preparation_config")
    if not config:
        return {"status": "needs_profile", "questions": ["What is your preparation budget, priorities and candidate/project evidence?"]}
    with inbox.connect() as db:
        sql = "SELECT * FROM handoffs WHERE state IN ('checked_existing','awaiting_user')"
        params = []
        if handoff_id:
            sql += " AND handoff_id=?"
            params.append(handoff_id)
        row = db.execute(sql + " ORDER BY rowid DESC LIMIT 1", params).fetchone()
        if not row:
            return {"status": "needs_scheduling_context"}
        handoff = json.loads(row["payload"])
    outcome = handoff.get("proposal_outcome", {})
    schedule_run = Path(outcome["run"])
    accepted = read_json(schedule_run / "accepted.json")
    if accepted["status"] == "blocked":
        return {"status": "needs_scheduling_context"}
    thread_id = handoff["thread_id"]
    snapshot = inbox.thread_snapshot(thread_id)
    if handoff.get("source_revision", snapshot["revision"]) != snapshot["revision"]:
        return {"status": "stale_source", "questions": ["Process the newer thread reply before preparing this interview."]}
    source_path = Path(handoff["source_attempt"]) / "work/input.json"
    mail = read_json(source_path)
    if set(snapshot["message_ids"]) != {m["source_id"] for m in mail["messages"]}:
        return {"status": "stale_source", "questions": ["The known thread and classified evidence differ; synchronize and review the latest reply."]}
    interview = accepted["interview"]
    interview_id = interview["interview_id"]
    learning = learning_store(inbox)
    session = run_root.resolve() / digest(inbox.account)[:16] / digest(interview_id)[:16]
    work = session / "work"
    if not work.exists():
        work.mkdir(parents=True)
        shutil.copytree(ROOT / "interview", work / "interview", ignore=shutil.ignore_patterns("__pycache__"))
        shutil.copyfile(ROOT / "evaluation/tool_guide.md", work / "TOOL_GUIDE.md")
        (work / "TASK.md").write_text("# Interview preparation\n\nPython executable: " + str(Path(sys.executable).resolve()) + "\nRead TOOL_GUIDE.md. This workspace contains candidate evidence and actual thread snapshots. No Google backend or credentials are provided; do not write events or send mail.\n", encoding="utf-8")
        Store(work).initialize({"clock": learning.meta("clock")}, "D")
    store = Store(work)
    application = {key: interview[key] for key in ["interview_id", "application_id", "company", "role", "round"]}
    application["notes"] = "Interview facts come from the actual invitation. No employer job description or actual question list was fetched."
    sources = dict(config["sources"])
    for message in mail["messages"]:
        source_id = message["source_id"]
        if not re.fullmatch(r"[a-zA-Z0-9_-]+", source_id) or source_id in {"profile", "application", "invitation"} or source_id in sources:
            raise ValueError("Mail source ID is unsafe or conflicts with candidate evidence")
        sources[source_id] = "# Mail evidence\n\nSubject: " + message["subject"] + "\n\n" + message["body"]
    sources["invitation"] = "# Actual interview thread evidence\n\n" + "\n\n".join("Source ID: " + m["source_id"] + "\nSubject: " + m["subject"] + "\n\n" + m["body"] for m in mail["messages"])
    inputs = {"profile": config["profile"], "application": application, "sources": sources,
              "history": learning.rows("history"), "memories": learning.rows("memories"), "thread": snapshot}
    archive = session / "input-snapshots" / digest(inputs)
    if not archive.exists():
        write_json(archive / "snapshot.json", inputs)
    write_json(work / "inputs/profile.json", config["profile"])
    write_json(work / "inputs/application.json", application)
    source_dir = work / "inputs/sources"
    source_dir.mkdir(parents=True, exist_ok=True)
    # Remove only obsolete source files in this generated, explicitly scoped directory.
    for path in source_dir.glob("*.md"):
        if path.stem not in sources:
            path.unlink()
    for key, text in sources.items():
        (source_dir / (key + ".md")).write_text(text, encoding="utf-8")
    with store.connect() as db:
        db.execute("UPDATE meta SET value=? WHERE key='clock'", (learning.meta("clock"),))
        for table in ["history", "memories"]:
            db.execute("DELETE FROM " + table)
        db.execute("DELETE FROM memory_fts")
        for record in inputs["history"]:
            db.execute("INSERT INTO history VALUES (?,?)", (record["record_id"], canonical(record)))
        for note in inputs["memories"]:
            db.execute("INSERT INTO memories VALUES (?,?)", (note["memory_id"], canonical(note)))
            db.execute("INSERT INTO memory_fts VALUES (?,?)", (note["memory_id"], " ".join([note["observation"], note["next_action"], note["role"], note["round"] or "", *note["topics"]])))
    attach(store, inbox, thread_id, learning=learning)
    check(store)
    prior = latest(store, interview_id)
    if prior and prior["status"] != "rejected" and prior["input_fingerprint"] == context_fingerprint(store):
        return {"status": prior["status"], "reused": True, "workspace": str(work), "proposal_id": prior["proposal_id"]}
    node_dir = session / ("proposal-v" + str(prior["version"] + 1 if prior else 1))
    if node_dir.exists():
        node_dir = session / (node_dir.name + "-attempt-" + uuid.uuid4().hex[:10])
    result = node_fn(work, node_dir)
    with inbox.connect() as db:
        db.execute("INSERT OR REPLACE INTO preparation_sessions VALUES (?,?)", (interview_id, canonical({"workspace": str(work), "handoff_id": handoff["handoff_id"], "thread_id": thread_id})))
    return {"status": result["status"], "workspace": str(work), "output": str(node_dir), "reused": False}


def debrief_status(inbox):
    """Local pending states only; never infer performance or send a notification."""
    learning = learning_store(inbox)
    history = learning.rows("history")
    now = datetime.now(timezone.utc)
    from interview.calendar import parse_instant
    with inbox.connect() as db:
        sessions = [json.loads(r[0]) for r in db.execute("SELECT payload FROM preparation_sessions")]
    result = []
    for session in sessions:
        store = Store(Path(session["workspace"]))
        application = read_json(store.workspace / "inputs/application.json")
        interview_id = application["interview_id"]
        if any(r.get("interview_id") == interview_id and r.get("mode") == "interview" for r in history):
            result.append({"interview_id": interview_id, "status": "debrief_received"})
            continue
        try:
            check(store)
        except ValueError:
            result.append({"interview_id": interview_id, "status": "context_needs_review"})
            continue
        with inbox.connect() as db:
            row = db.execute("SELECT payload FROM handoffs WHERE handoff_id=?", (session["handoff_id"],)).fetchone()
        handoff = json.loads(row[0])
        accepted = read_json(Path(handoff["proposal_outcome"]["run"]) / "accepted.json")
        start, duration = accepted["interview"].get("start"), accepted["interview"].get("duration_minutes")
        if not start or not duration:
            state = "schedule_unknown"
        else:
            ended = now.timestamp() >= parse_instant(start).timestamp() + duration * 60
            reviewed = any(r.get("interview_id") == interview_id and r.get("mode") == "interview" for r in history)
            state = "reviewed" if reviewed else "awaiting_debrief" if ended else "upcoming"
        result.append({"interview_id": interview_id, "status": state})
    return result
