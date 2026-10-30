"""Frozen inbox-thread guards for proposals and approvals; no credential access."""
import json
import sqlite3
from pathlib import Path

from interview.storage import canonical, digest


def binding(store):
    value = store.optional_meta("inbox_guard", "")
    return json.loads(value) if value else None


def learning_digest(workspace):
    path = Path(workspace) / "state.sqlite3"
    db = sqlite3.connect("file:" + path.resolve().as_posix() + "?mode=ro", uri=True)
    try:
        return digest({name: [json.loads(r[0]) for r in db.execute("SELECT payload FROM " + name + " ORDER BY rowid")] for name in ["history", "memories"]})
    finally:
        db.close()


def attach(store, inbox, thread_id, *, learning=None):
    snapshot = inbox.thread_snapshot(thread_id)
    if not snapshot["message_ids"]:
        raise ValueError("Cannot bind a workspace to an unknown inbox thread")
    guard = {"state_path": str(inbox.path.resolve()), "account": inbox.account,
             "thread_id": thread_id, **snapshot}
    if learning is not None:
        guard.update(learning_workspace=str(learning.workspace), learning_hash=learning_digest(learning.workspace),
                     profile_hash=digest(inbox.setting("preparation_config")))
    with store.connect() as db:
        db.execute("INSERT OR REPLACE INTO meta VALUES ('inbox_guard',?)", (canonical(guard),))
    return guard


def check(store, *, gmail=None, execute=None):
    from interview.team_bridge import check_team_source
    from interview.candidate_learning import check_guard
    check_team_source(store)
    check_guard(store)
    guard = binding(store)
    if guard is None:
        return None  # Historical/offline protocols retain their original behavior.
    path = Path(guard["state_path"])
    if not path.is_absolute() or not path.exists():
        raise ValueError("Inbox source state is unavailable; review the proposal again")
    db = sqlite3.connect("file:" + path.as_posix() + "?mode=ro", uri=True)
    try:
        account = db.execute("SELECT value FROM meta WHERE key='account'").fetchone()
        revision = db.execute("SELECT revision FROM thread_revisions WHERE thread_id=?", (guard["thread_id"],)).fetchone()
        if not account or account[0] != guard["account"] or not revision or revision[0] != guard["revision"]:
            raise ValueError("New thread evidence or account change invalidated this proposal")
        if "profile_hash" in guard:
            profile = db.execute("SELECT value FROM meta WHERE key='preparation_config'").fetchone()
            if not profile or digest(json.loads(profile[0])) != guard["profile_hash"]:
                raise ValueError("Preparation preferences changed; review a new proposal")
    finally:
        db.close()
    if "learning_hash" in guard and learning_digest(guard["learning_workspace"]) != guard["learning_hash"]:
        raise ValueError("New or revised debrief memory invalidated the preparation proposal")
    if gmail is not None:
        if execute is None:
            raise ValueError("Remote freshness check requires a safe request executor")
        thread = execute(gmail.users().threads().get(userId="me", id=guard["thread_id"], format="minimal"))
        ids = sorted({m["id"] for m in thread.get("messages", [])})
        if thread.get("id") != guard["thread_id"] or ids != guard["message_ids"]:
            raise ValueError("Live Gmail thread changed; synchronize and review a new proposal")
    return digest(guard)
