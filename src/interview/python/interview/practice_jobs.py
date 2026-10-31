"""Host-only leases and publication fencing for website practice attempts."""
from __future__ import annotations

from contextlib import contextmanager
from contextvars import ContextVar
from datetime import datetime, timezone

LEASE_SECONDS = 120
HEARTBEAT_SECONDS = 15
_current_job = ContextVar("website_practice_job", default=None)


def now():
    return datetime.now(timezone.utc).isoformat()


def expired(row, at=None):
    if row["status"] not in {"queued", "running"}:
        return False
    try:
        stamp = row["heartbeat_at"] if "heartbeat_at" in row.keys() and row["heartbeat_at"] else row["updated_at"]
        updated = datetime.fromisoformat(stamp)
        current = datetime.fromisoformat(at or now())
        if updated.tzinfo is None or current.tzinfo is None:
            return True
        age = (current - updated).total_seconds()
        return age < 0 or age >= LEASE_SECONDS
    except (TypeError, ValueError):
        return True


def public_job(row):
    result = {key: row[key] for key in ("job_id", "status", "updated_at", "error_code")}
    if expired(row):
        result.update(status="failed", error_code="generation_interrupted")
    return result


def renew(store, job_id):
    with store.connect() as db:
        db.execute("BEGIN IMMEDIATE")
        row = db.execute("SELECT * FROM web_practice_jobs WHERE job_id=?", (job_id,)).fetchone()
        if row is None or row["status"] != "running" or expired(row):
            return False
        db.execute("UPDATE web_practice_jobs SET heartbeat_at=? WHERE job_id=?", (now(), job_id))
    return True


@contextmanager
def job_scope(store, job_id):
    token = _current_job.set((store.path, job_id))
    try:
        yield
    finally:
        _current_job.reset(token)


def check_job(store, db, record=None, *, publish=False):
    selected = _current_job.get()
    if selected is None:
        return  # Ordinary chat generation retains its existing approval guards.
    path, job_id = selected
    if path != store.path:
        raise ValueError("Website generation belongs to another workspace")
    row = db.execute("SELECT * FROM web_practice_jobs WHERE job_id=?", (job_id,)).fetchone()
    if row is None or row["status"] != "running" or expired(row):
        raise ValueError("Website generation attempt is no longer active")
    if record and row["proposal_id"] != record["proposal_id"]:
        raise ValueError("Website generation belongs to another proposal")
    if publish:
        # The caller holds the material transaction. A crash after commit cannot
        # leave a published pack presented as an interrupted model attempt.
        db.execute("UPDATE web_practice_jobs SET status='ready',updated_at=?,error_code=NULL WHERE job_id=?", (now(), job_id))


def check_before_model(store):
    if _current_job.get() is not None:
        with store.connect() as db:
            check_job(store, db)
