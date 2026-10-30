"""Account-bound durable incoming-mail discovery. Google operations are read-only."""
from __future__ import annotations

import base64
import json
import sqlite3
import time
import uuid
from contextlib import contextmanager
from email import policy
from email.parser import BytesParser
from html.parser import HTMLParser
from pathlib import Path

from interview.google_adapter import GoogleAccessError, GoogleHTTPError, execute_request
from interview.storage import canonical, digest


EXCLUDED_LABELS = {"SENT", "DRAFT", "SPAM", "TRASH"}


class ManualReview(ValueError):
    pass


class PlainHTML(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts, self.hidden = [], 0

    def handle_starttag(self, tag, attrs):
        if tag in {"script", "style", "head"}:
            self.hidden += 1
        if tag in {"p", "br", "div", "li"} and not self.hidden:
            self.parts.append("\n")

    def handle_endtag(self, tag):
        if tag in {"script", "style", "head"} and self.hidden:
            self.hidden -= 1

    def handle_data(self, data):
        if not self.hidden:
            self.parts.append(data)


def normalize_message(resource):
    """Decode text locally; never fetch HTML assets or attachments."""
    if not resource.get("id") or not resource.get("threadId"):
        raise ManualReview("missing_message_identity")
    if not str(resource.get("internalDate", "")).isdigit():
        raise ManualReview("missing_or_invalid_message_date")
    encoded = resource.get("raw", "")
    if len(encoded) > 4_000_000:
        raise ManualReview("message_too_large")
    try:
        raw = base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4))
        message = BytesParser(policy=policy.default).parsebytes(raw)
        body = message.get_body(preferencelist=("plain", "html"))
        if body is None:
            raise ManualReview("unsupported_text_body")
        text = body.get_content()
        if not isinstance(text, str) or not text.strip():
            raise ManualReview("unsupported_text_body")
        if body.get_content_type() == "text/html":
            parser = PlainHTML()
            parser.feed(text)
            text = "".join(parser.parts).strip()
        if not text.strip() or len(text) > 60_000:
            raise ManualReview("unsupported_or_oversized_text_body")
        return {"source_id": resource["id"], "thread_id": resource["threadId"],
                "internal_ms": int(resource.get("internalDate", 0)),
                "subject": str(message.get("Subject", "")), "body": text,
                "content_hash": digest({"raw": encoded}), "labels": resource.get("labelIds", [])}
    except ManualReview:
        raise
    except Exception:
        raise ManualReview("message_decode_failed") from None


class InboxStore:
    def __init__(self, path: Path, account: str, *, now=time.time):
        self.path, self.account, self.now = Path(path), account.strip().casefold(), now
        if not self.account or "@" not in self.account:
            raise ValueError("A verified account identity is required")
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as db:
            db.executescript("""
                CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY, value TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS jobs(
                    message_id TEXT PRIMARY KEY, thread_id TEXT, state TEXT NOT NULL DEFAULT 'pending',
                    attempts INTEGER NOT NULL DEFAULT 0, available_at REAL NOT NULL DEFAULT 0,
                    lease_token TEXT, lease_until REAL, error_code TEXT, result TEXT);
                CREATE TABLE IF NOT EXISTS messages(message_id TEXT PRIMARY KEY, payload TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS bindings(thread_id TEXT NOT NULL, interview_id TEXT NOT NULL,
                    workspace TEXT, PRIMARY KEY(thread_id, interview_id));
                CREATE TABLE IF NOT EXISTS classifications(cache_key TEXT PRIMARY KEY, payload TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS handoffs(handoff_id TEXT PRIMARY KEY, message_id TEXT NOT NULL,
                    payload TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'pending_review');
                CREATE TABLE IF NOT EXISTS thread_messages(thread_id TEXT NOT NULL,message_id TEXT NOT NULL,
                    PRIMARY KEY(thread_id,message_id));
                CREATE TABLE IF NOT EXISTS thread_revisions(thread_id TEXT PRIMARY KEY,revision INTEGER NOT NULL);
                CREATE TABLE IF NOT EXISTS preparation_sessions(interview_id TEXT PRIMARY KEY,payload TEXT NOT NULL);
            """)
            row = db.execute("SELECT value FROM meta WHERE key='account'").fetchone()
            if row and row[0] != self.account:
                raise GoogleAccessError("Inbox state belongs to a different account")
            db.execute("INSERT OR IGNORE INTO meta VALUES ('account',?)", (self.account,))
            for row in db.execute("SELECT message_id,thread_id FROM jobs WHERE thread_id IS NOT NULL").fetchall():
                self._track_thread(db, row["message_id"], row["thread_id"])

    @staticmethod
    def _track_thread(db, message_id, thread_id):
        if not thread_id:
            return
        inserted = db.execute("INSERT OR IGNORE INTO thread_messages VALUES (?,?)", (thread_id, message_id)).rowcount
        if inserted:
            db.execute("INSERT INTO thread_revisions VALUES (?,1) ON CONFLICT(thread_id) DO UPDATE SET revision=revision+1", (thread_id,))

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.path, timeout=10)
        db.row_factory = sqlite3.Row
        try:
            with db:
                yield db
        finally:
            db.close()

    def cursor(self):
        with self.connect() as db:
            row = db.execute("SELECT value FROM meta WHERE key='history_id'").fetchone()
            return row[0] if row else None

    def setting(self, key):
        with self.connect() as db:
            row = db.execute("SELECT value FROM meta WHERE key=?", (key,)).fetchone()
            return json.loads(row[0]) if row else None

    def set_preparation_config(self, data):
        with self.connect() as db:
            db.execute("INSERT OR REPLACE INTO meta VALUES ('preparation_config',?)", (canonical(data),))

    def enqueue(self, messages):
        added = 0
        with self.connect() as db:
            for message in messages:
                if not message.get("id"):
                    raise GoogleAccessError("Discovery returned a message without an ID")
                added += db.execute("INSERT OR IGNORE INTO jobs(message_id,thread_id) VALUES (?,?)",
                                    (message["id"], message.get("threadId"))).rowcount
                self._track_thread(db, message["id"], message.get("threadId"))
                added += db.execute("UPDATE jobs SET state='pending',attempts=0,available_at=0,error_code=NULL WHERE message_id=? AND state='skipped' AND error_code='excluded_labels'", (message["id"],)).rowcount
        return added

    def advance(self, previous, current):
        if not current or not str(current).isdigit():
            raise GoogleAccessError("Google returned an invalid history cursor")
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            row = db.execute("SELECT value FROM meta WHERE key='history_id'").fetchone()
            stored = row[0] if row else None
            if stored != previous:
                raise GoogleAccessError("Concurrent inbox sync changed the cursor; poll again")
            if stored is not None and int(current) < int(stored):
                raise GoogleAccessError("History cursor cannot move backwards")
            db.execute("INSERT OR REPLACE INTO meta VALUES ('history_id',?)", (str(current),))

    def claim(self, *, message_id=None, lease_seconds=900):
        now = self.now()
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            # An abandoned final attempt must not be retried without bound.
            db.execute("UPDATE jobs SET state='failed',error_code='abandoned_final_attempt',lease_token=NULL WHERE state='processing' AND lease_until<=? AND attempts>=3", (now,))
            sql = "SELECT * FROM jobs WHERE attempts<3 AND ((state='pending' AND available_at<=?) OR (state='processing' AND lease_until<=?))"
            params = [now, now]
            if message_id:
                sql += " AND message_id=?"
                params.append(message_id)
            row = db.execute(sql + " ORDER BY rowid LIMIT 1", params).fetchone()
            if not row:
                return None
            token = uuid.uuid4().hex
            db.execute("UPDATE jobs SET state='processing',attempts=attempts+1,lease_token=?,lease_until=? WHERE message_id=?", (token, now + lease_seconds, row["message_id"]))
            return {**dict(row), "lease_token": token, "attempts": row["attempts"] + 1}

    def _owned(self, db, job):
        row = db.execute("SELECT * FROM jobs WHERE message_id=?", (job["message_id"],)).fetchone()
        if not row or row["state"] != "processing" or row["lease_token"] != job["lease_token"] or row["lease_until"] <= self.now():
            raise ValueError("Stale or expired inbox lease")
        return row

    def terminal(self, job, state, code):
        if state not in {"gone", "skipped", "needs_review"}:
            raise ValueError("Unsupported terminal state")
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            self._owned(db, job)
            db.execute("UPDATE jobs SET state=?,error_code=?,lease_token=NULL WHERE message_id=?", (state, code, job["message_id"]))
            if state == "needs_review":
                handoff = {"handoff_id": digest({"account": self.account, "message_id": job["message_id"], "manual_reason": code}),
                           "message_id": job["message_id"], "route": "manual_review", "reason": code,
                           "calendar_write_authorized": False, "full_preparation_authorized": False}
                db.execute("INSERT OR IGNORE INTO handoffs(handoff_id,message_id,payload) VALUES (?,?,?)", (handoff["handoff_id"], job["message_id"], canonical(handoff)))

    def retry(self, job, code):
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            row = self._owned(db, job)
            state = "failed" if row["attempts"] >= 3 else "pending"
            db.execute("UPDATE jobs SET state=?,error_code=?,available_at=?,lease_token=NULL WHERE message_id=?", (state, code, self.now() + 10 * 2 ** row["attempts"], job["message_id"]))
            return state

    def cache_message(self, message):
        with self.connect() as db:
            old = db.execute("SELECT payload FROM messages WHERE message_id=?", (message["source_id"],)).fetchone()
            if old and json.loads(old[0])["content_hash"] != message["content_hash"]:
                raise ManualReview("message_content_changed_for_same_gmail_id")
            db.execute("INSERT OR REPLACE INTO messages VALUES (?,?)", (message["source_id"], canonical(message)))
            self._track_thread(db, message["source_id"], message["thread_id"])
            db.execute("UPDATE jobs SET thread_id=? WHERE message_id=?", (message["thread_id"], message["source_id"]))

    def thread_snapshot(self, thread_id):
        with self.connect() as db:
            row = db.execute("SELECT revision FROM thread_revisions WHERE thread_id=?", (thread_id,)).fetchone()
            return {"revision": row[0] if row else 0, "message_ids": [r[0] for r in db.execute("SELECT message_id FROM thread_messages WHERE thread_id=? ORDER BY message_id", (thread_id,))]}

    def bind(self, thread_id, interview_id, workspace=None):
        with self.connect() as db:
            db.execute("INSERT OR REPLACE INTO bindings VALUES (?,?,?)", (thread_id, interview_id, workspace))

    def bindings(self, thread_id):
        with self.connect() as db:
            return [dict(r) for r in db.execute("SELECT * FROM bindings WHERE thread_id=? ORDER BY interview_id", (thread_id,))]

    def complete(self, job, cache_key, result, handoff=None):
        # Classification, handoff and acknowledgement are one SQLite transaction.
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            self._owned(db, job)
            db.execute("INSERT OR IGNORE INTO classifications VALUES (?,?)", (cache_key, canonical(result)))
            if handoff:
                db.execute("INSERT OR IGNORE INTO handoffs(handoff_id,message_id,payload) VALUES (?,?,?)", (handoff["handoff_id"], job["message_id"], canonical(handoff)))
            db.execute("UPDATE jobs SET state='triaged',result=?,error_code=NULL,lease_token=NULL WHERE message_id=?", (canonical(result), job["message_id"]))

    def counts(self):
        with self.connect() as db:
            return {"jobs": {r[0]: r[1] for r in db.execute("SELECT state,count(*) FROM jobs GROUP BY state")},
                    "handoffs": db.execute("SELECT count(*) FROM handoffs").fetchone()[0]}

    def claim_handoff(self, handoff_id=None):
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            db.execute("UPDATE handoffs SET state='needs_review' WHERE state='proposal_running' AND json_extract(payload,'$.dispatch_lease_until')<=? AND json_extract(payload,'$.dispatch_attempts')>=3", (self.now(),))
            sql = "SELECT * FROM handoffs WHERE (state='pending_review' OR (state='proposal_running' AND json_extract(payload,'$.dispatch_lease_until')<=?))"
            params = [self.now()]
            if handoff_id:
                sql += " AND handoff_id=?"
                params.append(handoff_id)
            row = db.execute(sql + " ORDER BY rowid LIMIT 1", params).fetchone()
            if not row:
                return None
            handoff = json.loads(row["payload"])
            token = uuid.uuid4().hex
            handoff["dispatch_token"] = token
            handoff["dispatch_lease_until"] = self.now() + 900
            handoff["dispatch_attempts"] = handoff.get("dispatch_attempts", 0) + 1
            db.execute("UPDATE handoffs SET state='proposal_running',payload=? WHERE handoff_id=?", (canonical(handoff), row["handoff_id"]))
            return handoff

    def finish_handoff(self, handoff_id, token, state, outcome):
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            row = db.execute("SELECT * FROM handoffs WHERE handoff_id=?", (handoff_id,)).fetchone()
            handoff = json.loads(row["payload"]) if row else {}
            if not row or row["state"] != "proposal_running" or handoff.get("dispatch_token") != token or handoff.get("dispatch_lease_until", 0) <= self.now():
                raise ValueError("Stale handoff dispatch")
            if state not in {"awaiting_user", "checked_existing", "needs_review", "blocked"}:
                raise ValueError("Unsupported handoff outcome")
            handoff["proposal_outcome"] = outcome
            db.execute("UPDATE handoffs SET state=?,payload=? WHERE handoff_id=?", (state, canonical(handoff), handoff_id))


class GmailInbox:
    def __init__(self, store, gmail, *, max_pages=100):
        if max_pages < 1:
            raise ValueError("max_pages must be positive")
        self.store, self.gmail, self.max_pages = store, gmail, max_pages

    def profile(self):
        profile = execute_request(self.gmail.users().getProfile(userId="me"))
        if profile.get("emailAddress", "").casefold() != self.store.account:
            raise GoogleAccessError("Authorized account does not match inbox state")
        return profile

    def _full_scan(self):
        # Capture before listing, so arrivals during enumeration remain in history.
        anchor = self.profile()["historyId"]
        token, added = None, 0
        for page in range(self.max_pages):
            kwargs = {"userId": "me", "maxResults": 250, "includeSpamTrash": False}
            if token:
                kwargs["pageToken"] = token
            response = execute_request(self.gmail.users().messages().list(**kwargs))
            added += self.store.enqueue(response.get("messages", []))
            token = response.get("nextPageToken")
            if not token:
                return str(anchor), added, page + 1
        raise GoogleAccessError("Mailbox scan exceeded page limit; cursor was not advanced")

    def sync(self):
        self.profile()  # Verify identity before any discovery or state transition.
        previous = self.store.cursor()
        mode, added, pages = "incremental", 0, 0
        if previous is None:
            mode = "bootstrap"
            current, added, pages = self._full_scan()
        else:
            token = None
            try:
                for page in range(self.max_pages):
                    kwargs = {"userId": "me", "startHistoryId": previous, "historyTypes": ["messageAdded", "labelAdded"], "maxResults": 250}
                    if token:
                        kwargs["pageToken"] = token
                    response = execute_request(self.gmail.users().history().list(**kwargs))
                    discovered = []
                    for record in response.get("history", []):
                        discovered.extend(change["message"] for key in ["messagesAdded", "labelsAdded"] for change in record.get(key, []))
                    added += self.store.enqueue(discovered)
                    token = response.get("nextPageToken")
                    if not token:
                        current, pages = str(response["historyId"]), page + 1
                        break
                else:
                    raise GoogleAccessError("History read exceeded page limit; cursor was not advanced")
            except GoogleHTTPError as exc:
                if exc.status != 404:
                    raise
                mode = "expired_cursor_recovery"
                current, recovered, pages = self._full_scan()
                added += recovered
        self.store.advance(previous, current)
        return {"account_verified": True, "mode": mode, "new_jobs": added, "pages": pages,
                "cursor_persisted": True, "google_writes": 0, **self.store.counts()}

    def read(self, message_id):
        resource = execute_request(self.gmail.users().messages().get(userId="me", id=message_id, format="raw"))
        if resource.get("id") != message_id:
            raise ManualReview("google_returned_wrong_message")
        return resource

    def context(self, message_id):
        self.profile()
        resource = self.read(message_id)
        if EXCLUDED_LABELS & set(resource.get("labelIds", [])):
            return None, "excluded_labels"
        latest = normalize_message(resource)
        thread = execute_request(self.gmail.users().threads().get(userId="me", id=latest["thread_id"], format="minimal"))
        if thread.get("id") != latest["thread_id"]:
            raise ManualReview("google_returned_wrong_thread")
        resources = thread.get("messages", [])
        if len(resources) > 50:
            raise ManualReview("thread_exceeds_context_limit")
        messages = {latest["source_id"]: latest}
        for item in resources:
            if item["id"] == message_id:
                continue
            try:
                item_resource = self.read(item["id"])
            except GoogleHTTPError as exc:
                if exc.status == 404:
                    raise ManualReview("thread_context_message_unavailable") from None
                raise
            if item_resource.get("threadId") != latest["thread_id"]:
                raise ManualReview("thread_context_identity_mismatch")
            # Date filtering precedes content decoding; never expose later replies.
            if (int(item_resource.get("internalDate", 0)), item["id"]) > (latest["internal_ms"], message_id):
                continue
            messages[item["id"]] = normalize_message(item_resource)
        ordered = sorted(messages.values(), key=lambda m: (m["internal_ms"], m["source_id"]))
        if sum(len(m["body"]) + len(m["subject"]) for m in ordered) > 100_000:
            raise ManualReview("thread_exceeds_text_limit")
        for message in ordered:
            self.store.cache_message(message)
        links = self.store.bindings(latest["thread_id"])
        return {"latest": latest, "links": links, "input": {"latest_source_id": message_id,
                "messages": [{key: m[key] for key in ["source_id", "subject", "body"]} for m in ordered],
                "known_interviews": [{"interview_id": link["interview_id"], "thread_source_ids": [m["source_id"] for m in ordered]} for link in links]}}, None
