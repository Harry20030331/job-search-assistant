"""Exact website plan acceptance and durable, single-claim practice jobs."""
from __future__ import annotations

import argparse
import json
import tempfile
import threading
import uuid
from pathlib import Path

from interview.context_preparation import current_context, current_policy
from interview.preparation import context_fingerprint, schema
from interview.storage import Store, canonical, digest
from interview.practice_jobs import HEARTBEAT_SECONDS, expired, job_scope, now, public_job, renew


def job_schema(store):
    schema(store)
    with store.connect() as db:
        db.execute("BEGIN IMMEDIATE")
        db.execute("""CREATE TABLE IF NOT EXISTS web_practice_jobs(
            proposal_id TEXT NOT NULL, job_id TEXT PRIMARY KEY, approval_id TEXT NOT NULL,
            status TEXT NOT NULL, updated_at TEXT NOT NULL, output_path TEXT, error_code TEXT, heartbeat_at TEXT)""")
        if "heartbeat_at" not in {r[1] for r in db.execute("PRAGMA table_info(web_practice_jobs)")}:
            db.execute("ALTER TABLE web_practice_jobs ADD COLUMN heartbeat_at TEXT")


def decide(store, command, *, origin="human_workbench"):
    required = {"interview_id", "proposal_id", "proposal_hash", "proposal_version", "retry"}
    if set(command) != required or type(command["retry"]) is not bool or origin not in {"human_workbench", "synthetic_test_script"}:
        raise ValueError("invalid_plan_request")
    request, _, context_hash = current_context(store)
    if request.identity.interview_id != command["interview_id"]:
        raise ValueError("plan_conflict")
    fingerprint = context_fingerprint(store)
    job_schema(store)
    with store.connect() as db:
        db.execute("BEGIN IMMEDIATE")
        row = db.execute("SELECT * FROM preparation_proposals WHERE interview_id=? ORDER BY version DESC LIMIT 1", (command["interview_id"],)).fetchone()
        if not row or (row["proposal_id"], row["proposal_hash"], row["version"]) != (command["proposal_id"], command["proposal_hash"], command["proposal_version"]):
            raise ValueError("plan_conflict")
        draft = json.loads(row["payload"])
        if row["fingerprint"] != fingerprint or draft.get("context_hash") != context_hash or draft.get("policy_hash") != digest(current_policy(store).model_dump()):
            raise ValueError("plan_conflict")
        if row["status"] not in {"awaiting_plan_approval", "plan_approved", "material_ready"}:
            raise ValueError("plan_conflict")
        if row["status"] == "material_ready":
            return {"status": "material_ready", "job_id": None}
        existing = db.execute("SELECT * FROM web_practice_jobs WHERE proposal_id=? ORDER BY rowid DESC LIMIT 1", (row["proposal_id"],)).fetchone()
        if existing and (public_job(existing)["status"] != "failed" or not command["retry"]):
            return public_job(existing)
        if existing is None and command["retry"]:
            raise ValueError("plan_conflict")
        if existing and expired(existing):
            db.execute("UPDATE web_practice_jobs SET status='failed',error_code='generation_interrupted' WHERE job_id=?", (existing["job_id"],))
        approval = db.execute("SELECT approval_id FROM preparation_approvals WHERE proposal_id=? AND proposal_hash=? ORDER BY rowid DESC LIMIT 1", (row["proposal_id"], row["proposal_hash"])).fetchone()
        approval_id = approval[0] if approval and row["status"] == "plan_approved" else "prep-approval-" + uuid.uuid4().hex[:12]
        if not approval or row["status"] != "plan_approved":
            evidence = canonical({"origin": origin, "action": "approve_plan_and_generate_practice", "proposal_id": row["proposal_id"],
                "proposal_hash": row["proposal_hash"], "proposal_version": row["version"], "accepted_at": now()})
            db.execute("INSERT INTO preparation_approvals VALUES (?,?,?,?)", (approval_id, row["proposal_id"], row["proposal_hash"], evidence))
            db.execute("UPDATE preparation_proposals SET status='plan_approved' WHERE proposal_id=?", (row["proposal_id"],))
        job_id = "web-practice-" + uuid.uuid4().hex
        db.execute("INSERT INTO web_practice_jobs (proposal_id,job_id,approval_id,status,updated_at,output_path,error_code) VALUES (?,?,?,?,?,?,?)", (row["proposal_id"], job_id, approval_id, "queued", now(), None, None))
        result = public_job(db.execute("SELECT * FROM web_practice_jobs WHERE job_id=?", (job_id,)).fetchone())
    store.audit("preparation.website_requested", {"proposal_id": command["proposal_id"], "job_id": job_id}, result)
    return result


def run(store, job_id, runner=None):
    job_schema(store)
    with store.connect() as db:
        db.execute("BEGIN IMMEDIATE")
        row = db.execute("SELECT * FROM web_practice_jobs WHERE job_id=?", (job_id,)).fetchone()
        if row is None or row["status"] != "queued" or expired(row):
            return {"status": "not_claimed"}
        started = now()
        db.execute("UPDATE web_practice_jobs SET status='running',updated_at=?,heartbeat_at=? WHERE job_id=? AND status='queued'", (started, started, job_id))
    # Model nodes retain their existing isolation contract. The opaque output is
    # outside repository instruction ancestors; its pointer stays in private state.
    stopped = threading.Event()
    def heartbeat():
        while not stopped.wait(HEARTBEAT_SECONDS):
            try:
                if not renew(store, job_id):
                    break
            except Exception:
                break  # Failure to renew must never revive an expired attempt.
    worker = threading.Thread(target=heartbeat, daemon=True)
    worker.start()
    try:
        output = Path(tempfile.mkdtemp(prefix="interview-practice-")) / "generation"
        with store.connect() as db:
            db.execute("UPDATE web_practice_jobs SET output_path=? WHERE job_id=?", (str(output), job_id))
        if runner is None:
            from interview.context_preparation_flow import run_node
            runner = run_node
        with job_scope(store, job_id):
            runner(store.workspace, output, approval_id=row["approval_id"], material_format="simulation-v2", direct_questions=True)
    except Exception:
        pass  # Keep diagnostics private and preserve a pack already committed.
    finally:
        stopped.set()
        worker.join(timeout=11)
    with store.connect() as db:
        db.execute("BEGIN IMMEDIATE")
        current = db.execute("SELECT * FROM web_practice_jobs WHERE job_id=?", (job_id,)).fetchone()
        if current["status"] == "running":
            error = "generation_interrupted" if expired(current) else "generation_failed"
            db.execute("UPDATE web_practice_jobs SET status='failed',updated_at=?,error_code=? WHERE job_id=?", (now(), error, job_id))
        result = public_job(db.execute("SELECT * FROM web_practice_jobs WHERE job_id=?", (job_id,)).fetchone())
    return result


def fail_launch(store, job_id):
    job_schema(store)
    with store.connect() as db:
        # A duplicate launch error cannot cancel another process's active claim.
        db.execute("UPDATE web_practice_jobs SET status='failed',updated_at=?,error_code='generation_unavailable' WHERE job_id=? AND status='queued'", (now(), job_id))
        row = db.execute("SELECT * FROM web_practice_jobs WHERE job_id=?", (job_id,)).fetchone()
    return public_job(row) if row else {"status": "not_found"}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["decide", "run", "fail"])
    parser.add_argument("--workspace", required=True, type=Path)
    parser.add_argument("--job-id")
    args = parser.parse_args()
    store = Store(args.workspace)
    try:
        if args.action == "decide":
            import sys
            command = json.loads(sys.stdin.read(8192))
            result = decide(store, command.pop("decision"), origin=command.pop("origin")) if set(command) == {"decision", "origin"} else {"error": "invalid_plan_request"}
        else:
            result = (run if args.action == "run" else fail_launch)(store, args.job_id)
        print(canonical(result))
    except Exception:
        print(canonical({"error": "plan_conflict"}))
        raise SystemExit(1) from None


if __name__ == "__main__":
    main()
