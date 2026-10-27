"""Explicit Google backend for integration sessions, never enabled by benchmarks.

Credentials are loaded by the host from an ignored config outside the agent work
directory. This is a trusted local prototype, not a security boundary against a
hostile shell agent. No mail-send or event-delete operation is exposed.
"""
from __future__ import annotations

import base64
import json
import re
from datetime import datetime, timedelta, timezone
from email import policy
from email.parser import BytesParser
from pathlib import Path
from zoneinfo import ZoneInfo

from pydantic import Field, field_validator

from interview.calendar import overlaps, parse_instant, validate_action
from interview.schemas import CalendarAction, Contract
from interview.storage import Store, canonical, digest, read_json
from interview.freshness import check as check_source

SCOPES = ["https://www.googleapis.com/auth/gmail.readonly", "https://www.googleapis.com/auth/calendar.events.owned"]


class GoogleAccessError(ValueError):
    """Safe diagnostic; never serialize HTTP headers, OAuth tokens or raw errors."""


class GoogleHTTPError(GoogleAccessError):
    def __init__(self, status):
        self.status = status
        super().__init__(f"Google API HTTP {status}; no automatic write retry")


class GoogleConfig(Contract):
    version: int = 1
    expected_account: str
    calendar_id: str
    namespace: str = Field(min_length=8, max_length=80)
    client_file: str = "client.json"
    token_file: str = "token.json"
    gmail_messages: dict[str, str] = Field(default_factory=dict)

    @field_validator("expected_account", "calendar_id", "namespace", "client_file", "token_file")
    @classmethod
    def nonempty(cls, value):
        if not value.strip():
            raise ValueError("Google configuration fields must not be blank")
        return value

    @field_validator("gmail_messages")
    @classmethod
    def bounded_mail(cls, value):
        if len(value) > 20 or any(not re.fullmatch(r"[a-zA-Z0-9_-]+", k) or not v for k, v in value.items()):
            raise ValueError("Allow at most 20 explicit Gmail IDs with simple source aliases")
        return value

    def binding(self):
        return digest({"version": self.version, "expected_account": self.expected_account.casefold(), "calendar_id": self.calendar_id, "namespace": self.namespace, "gmail_messages": self.gmail_messages})


def load_config(path: Path) -> GoogleConfig:
    try:
        config = GoogleConfig.model_validate(read_json(path))
    except (ValueError, TypeError):
        # A user may accidentally point this at credentials.json or token.json.
        # Pydantic's ordinary diagnostic could echo those secret input values.
        raise GoogleAccessError("Invalid Google config; use configs/google.example.json, not an OAuth credential file") from None
    if config.version != 1:
        raise GoogleAccessError("Unsupported Google config version")
    if config.calendar_id == "primary" or config.calendar_id.casefold() == config.expected_account.casefold():
        raise GoogleAccessError("Configure a dedicated secondary test calendar, not the primary calendar")
    return config


def credential_path(config_path: Path, relative: str, workspace: Path | None = None) -> Path:
    path = (config_path.parent / relative).resolve()
    if workspace is not None and path.is_relative_to(workspace.resolve()):
        raise GoogleAccessError("OAuth files must be outside the agent work directory")
    return path


def save_token(path: Path, value: str):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(value, encoding="utf-8")
    temporary.replace(path)


def google_libraries():
    try:
        import httplib2
        from google.auth.transport.requests import Request
        from google.oauth2.credentials import Credentials
        from google_auth_httplib2 import AuthorizedHttp
        from google_auth_oauthlib.flow import InstalledAppFlow
        from googleapiclient.discovery import build
    except ImportError:
        raise GoogleAccessError("Install requirements-google.lock in the project virtual environment") from None
    return httplib2, Request, Credentials, AuthorizedHttp, InstalledAppFlow, build


def services(config_path: Path, config: GoogleConfig, workspace: Path | None = None):
    httplib2, Request, Credentials, AuthorizedHttp, _, build = google_libraries()
    path = credential_path(config_path, config.token_file, workspace)
    if not path.exists():
        raise GoogleAccessError("Project OAuth token missing; run interview.google_cli auth with the TEST account")
    try:
        saved = read_json(path)
        if not set(SCOPES).issubset(set(saved.get("scopes", []))):
            raise GoogleAccessError("Project OAuth token lacks required scopes; authorize again")
        credentials = Credentials.from_authorized_user_info(saved, SCOPES)
        if not credentials.valid:
            if not credentials.refresh_token:
                raise GoogleAccessError("Project OAuth token requires interactive authorization")
            credentials.refresh(Request())
            save_token(path, credentials.to_json())
        transport = AuthorizedHttp(credentials, http=httplib2.Http(timeout=30))
        return build("gmail", "v1", http=transport, cache_discovery=False), build("calendar", "v3", http=transport, cache_discovery=False)
    except GoogleAccessError:
        raise
    except Exception:
        raise GoogleAccessError("Google authorization/client initialization failed; inspect the local account configuration") from None


def execute_request(request):
    try:
        return request.execute(num_retries=0)
    except Exception as exc:
        status = getattr(getattr(exc, "resp", None), "status", None)
        if status is not None:
            raise GoogleHTTPError(status) from None
        raise GoogleAccessError("Google request failed; its result may be unknown. Read back the same event ID before retrying a write") from None


class GoogleAdapter:
    def __init__(self, store: Store, config: GoogleConfig, gmail, calendar, *, now=None):
        self.store, self.config = store, config
        self.gmail, self.calendar = gmail, calendar
        self.now = now or (lambda: datetime.now(timezone.utc))
        self.account_verified = False

    def verify_account(self):
        if not self.account_verified:
            profile = execute_request(self.gmail.users().getProfile(userId="me"))
            if profile.get("emailAddress", "").casefold() != self.config.expected_account.casefold():
                raise GoogleAccessError("Authorized Google account does not match the configured TEST account")
            self.account_verified = True

    def read_mail(self, payload):
        self.verify_account()
        result = []
        for alias, gmail_id in self.config.gmail_messages.items():
            # An arbitrary ID cannot escape the host's explicit message allowlist.
            if payload.get("gmail_id") and payload["gmail_id"] != gmail_id:
                continue
            raw = execute_request(self.gmail.users().messages().get(userId="me", id=gmail_id, format="raw"))
            encoded = raw["raw"]
            message = BytesParser(policy=policy.default).parsebytes(base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4)))
            if payload.get("message_id") and payload["message_id"] not in {gmail_id, message["Message-ID"]}:
                continue
            body = message.get_body(preferencelist=("plain", "html"))
            content = body.get_content() if body else message.get_content()
            if not isinstance(content, str):
                content = "[No supported text body]"
            result.append({"source_id": alias, "gmail_id": gmail_id, "thread_id": raw.get("threadId"), "message_id": message["Message-ID"], "in_reply_to": message["In-Reply-To"], "subject": message["Subject"], "from": message["From"], "body": content})
        return result

    def event_resource(self, event_id, *, optional=False):
        self.verify_account()
        try:
            return execute_request(self.calendar.events().get(calendarId=self.config.calendar_id, eventId=event_id))
        except GoogleHTTPError as exc:
            if optional and exc.status == 404:
                return None
            raise

    def normalize(self, event, default_zone):
        zone = event.get("start", {}).get("timeZone") or default_zone
        def instant(part):
            if "dateTime" in part:
                return parse_instant(part["dateTime"]).isoformat()
            return datetime.fromisoformat(part["date"]).replace(tzinfo=ZoneInfo(zone)).astimezone(timezone.utc).isoformat()
        private = event.get("extendedProperties", {}).get("private", {})
        owned = private.get("ic_project") == "cs329z" and private.get("ic_namespace") == self.config.namespace
        return {"event_id": event["id"], "title": event.get("summary", ""), "start": instant(event["start"]), "end": instant(event["end"]), "timezone": zone, "interview_id": private.get("ic_interview") if owned else None, "etag": event.get("etag"), "all_day": "date" in event["start"], "transparent": event.get("transparency") == "transparent"}

    def list_events(self, payload):
        self.verify_account()
        start, end = payload.get("start"), payload.get("end")
        if bool(start) != bool(end):
            raise GoogleAccessError("Provide both start and end for a calendar window")
        if not start:
            start, end = self.now().isoformat(), (self.now() + timedelta(days=90)).isoformat()
        if parse_instant(end) <= parse_instant(start):
            raise GoogleAccessError("Calendar window must end after it starts")
        kwargs = {"calendarId": self.config.calendar_id, "timeMin": start, "timeMax": end, "singleEvents": True, "showDeleted": False, "maxResults": 250}
        events = []
        for _ in range(10):
            page = execute_request(self.calendar.events().list(**kwargs))
            zone = page.get("timeZone", "UTC")
            for event in page.get("items", []):
                if event.get("status") != "cancelled":
                    normalized = self.normalize(event, zone)
                    events.append(normalized)
            if not page.get("nextPageToken"):
                # Only cache a complete read; don't pretend a truncated list is complete.
                with self.store.connect() as db:
                    for event in events:
                        db.execute("INSERT OR REPLACE INTO events VALUES (?,?)", (event["event_id"], canonical(event)))
                return events
            kwargs["pageToken"] = page["nextPageToken"]
        raise GoogleAccessError("Calendar read exceeded pagination limit; narrow the window")

    def expected_body(self, action):
        reminders = sorted({m for m in action.reminder_minutes if parse_instant(action.start) - timedelta(minutes=m) > self.now()})
        if len(reminders) > 5 or any(m > 40320 for m in reminders):
            raise GoogleAccessError("Google Calendar supports at most five overrides, each no more than four weeks")
        return {"summary": action.title, "start": {"dateTime": action.start, "timeZone": action.timezone}, "end": {"dateTime": action.end, "timeZone": action.timezone}, "reminders": {"useDefault": False, "overrides": [{"method": "popup", "minutes": m} for m in reminders]}, "extendedProperties": {"private": {"ic_project": "cs329z", "ic_namespace": self.config.namespace, "ic_interview": action.interview_id, "ic_action_sha256": digest(action.model_dump())}}}

    def belongs_to_session(self, event, interview_id):
        private = event.get("extendedProperties", {}).get("private", {})
        return private.get("ic_project") == "cs329z" and private.get("ic_namespace") == self.config.namespace and private.get("ic_interview") == interview_id and not event.get("attendees") and not event.get("recurrence") and not event.get("recurringEventId") and event.get("status") != "cancelled"

    def body_matches(self, event, action, body):
        if not self.belongs_to_session(event, action.interview_id):
            return False
        if event.get("summary") != action.title:
            return False
        if any("dateTime" not in event.get(k, {}) or parse_instant(event[k]["dateTime"]) != parse_instant(getattr(action, k)) or event[k].get("timeZone") != action.timezone for k in ["start", "end"]):
            return False
        reminders = event.get("reminders", {})
        wanted = body["reminders"]
        key = lambda r: (r["method"], r["minutes"])
        return reminders.get("useDefault") is False and sorted(reminders.get("overrides", []), key=key) == sorted(wanted["overrides"], key=key) and event.get("extendedProperties", {}).get("private", {}).get("ic_action_sha256") == digest(action.model_dump())

    def event_id(self, action):
        # IDs use base32hex-compatible characters. One interview has one stable ID.
        return action.event_id or "c329" + digest({"namespace": self.config.namespace, "interview": action.interview_id})[:40]

    def validate_confirmation(self, action, confirmation_id):
        with self.store.connect() as db:
            row = db.execute("SELECT action,created_at FROM confirmations WHERE confirmation_id=?", (confirmation_id,)).fetchone()
        if not row:
            raise GoogleAccessError("Live calendar write requires host confirmation")
        self.verify_account()
        envelope = json.loads(row[0])
        try:
            guard_hash = check_source(self.store, gmail=self.gmail, execute=execute_request)
        except ValueError:
            raise GoogleAccessError("Inbox evidence changed; review the calendar proposal again") from None
        if envelope.get("inbox_guard_hash") != guard_hash:
            raise GoogleAccessError("Confirmation belongs to an older inbox revision")
        if envelope.get("backend_binding") != self.config.binding() or envelope.get("action") != action.model_dump():
            raise GoogleAccessError("Confirmation does not match the action and Google backend")
        age = (self.now() - parse_instant(row[1])).total_seconds()
        if not 0 <= age <= 900:
            raise GoogleAccessError("Live confirmation expired; review the exact action again")
        return envelope

    def check(self, payload):
        action = CalendarAction.model_validate(payload["action"])
        validate_action(action)
        reasons = []
        envelope = None
        try:
            envelope = self.validate_confirmation(action, payload.get("confirmation_id"))
        except GoogleAccessError as exc:
            reasons.append(str(exc))
        if (action.operation == "create") != (action.event_id is None):
            reasons.append("Create needs null event_id; update needs an existing event_id")
        if parse_instant(action.start) <= self.now():
            reasons.append("Live event must start in the future")
        current = self.event_resource(self.event_id(action), optional=True)
        matches = bool(current and self.body_matches(current, action, self.expected_body(action)))
        if current and not self.belongs_to_session(current, action.interview_id):
            reasons.append("Event is outside the project session/interview or has attendees/recurrence")
        if action.operation == "create" and current and not matches:
            reasons.append("Interview event already exists with different content")
        if action.operation == "update" and not matches and (not current or not envelope or not envelope.get("expected_etag") or current.get("etag") != envelope["expected_etag"]):
            reasons.append("Event changed or was not read before confirmation")
        events = self.list_events({"start": action.start, "end": action.end})
        conflicts = [e["event_id"] for e in events if e["event_id"] != self.event_id(action) and not e["transparent"] and overlaps(action.start, action.end, e["start"], e["end"])]
        duplicates = [e["event_id"] for e in events if e["interview_id"] == action.interview_id and e["event_id"] != self.event_id(action)]
        return {"confirmation_matches": envelope is not None, "conflicting_event_ids": conflicts, "duplicate_interview_ids": duplicates, "ready": not reasons and not conflicts and not duplicates, "reasons": reasons}

    def apply(self, operation, payload):
        action = CalendarAction.model_validate({k: v for k, v in payload.items() if k != "confirmation_id"})
        if operation != "calendar." + action.operation:
            raise GoogleAccessError("Operation disagrees with calendar action")
        validate_action(action)
        if (action.operation == "create") != (action.event_id is None):
            raise GoogleAccessError("Create needs null event_id; update needs an existing event_id")
        envelope = self.validate_confirmation(action, payload.get("confirmation_id"))
        if parse_instant(action.start) <= self.now():
            raise GoogleAccessError("Live event must start in the future")
        body = self.expected_body(action)
        event_id = self.event_id(action)
        current = self.event_resource(event_id, optional=True)
        if current and self.body_matches(current, action, body):
            return self.finish(current, action, payload["confirmation_id"], reused=True)
        if current and not self.belongs_to_session(current, action.interview_id):
            raise GoogleAccessError("Cannot modify an event outside this project session/interview or with attendees/recurrence")
        if action.operation == "create" and current:
            raise GoogleAccessError("Interview event already exists with different content; propose an update")
        if action.operation == "update" and (not current or not envelope.get("expected_etag") or current.get("etag") != envelope["expected_etag"]):
            raise GoogleAccessError("Event changed or was not read before confirmation; read it and obtain a new confirmation")
        checked = self.check({"action": action.model_dump(), "confirmation_id": payload["confirmation_id"]})
        if not checked["ready"]:
            raise GoogleAccessError("Live calendar check failed: conflict, duplicate, or stale confirmation")
        events = self.calendar.events()
        if action.operation == "create":
            request = events.insert(calendarId=self.config.calendar_id, body={"id": event_id, **body}, sendUpdates="none")
        else:
            request = events.patch(calendarId=self.config.calendar_id, eventId=event_id, body=body, sendUpdates="none")
            request.headers["If-Match"] = envelope["expected_etag"]
        self.store.audit("google.calendar.write_attempt", {"operation": action.operation, "event_id": event_id, "action_sha256": digest(action.model_dump())}, {"phase": "before_request"})
        try:
            execute_request(request)
        except GoogleHTTPError as exc:
            # Concurrent creates can race; inspect the same ID without another write.
            if action.operation != "create" or exc.status != 409:
                raise
        persisted = self.event_resource(event_id)
        if not self.body_matches(persisted, action, body):
            raise GoogleAccessError("Write may have committed but read-back differs; inspect the same event ID before any new action")
        return self.finish(persisted, action, payload["confirmation_id"], reused=False)

    def finish(self, event, action, confirmation_id, *, reused):
        normalized = {**self.normalize(event, action.timezone), "confirmation_id": confirmation_id, "reminders": [(parse_instant(action.start) - timedelta(minutes=r["minutes"])).isoformat() for r in event.get("reminders", {}).get("overrides", [])], "idempotent_reuse": reused, "backend": "google"}
        with self.store.connect() as db:
            db.execute("INSERT OR REPLACE INTO events VALUES (?,?)", (event["id"], canonical(normalized)))
        return normalized

    def execute(self, operation, payload):
        if operation == "mail.read":
            return self.read_mail(payload)
        if operation == "calendar.list":
            return self.list_events(payload)
        if operation in {"calendar.create", "calendar.update"}:
            return self.apply(operation, payload)
        if operation == "workflow.check":
            return self.check(payload)
        raise GoogleAccessError("Unsupported Google operation")


def for_store(store: Store):
    path = Path(store.meta("google_config"))
    config = load_config(path)
    if config.binding() != store.meta("google_binding"):
        raise GoogleAccessError("Google config changed; initialize a new integration session")
    gmail, calendar = services(path, config, store.workspace)
    return GoogleAdapter(store, config, gmail, calendar)


def confirm_live(store: Store, action: CalendarAction, config: GoogleConfig):
    """Host-only approval helper; not registered as an agent tool."""
    validate_action(action)
    guard_hash = check_source(store)
    if config.binding() != store.meta("google_binding"):
        raise GoogleAccessError("Google config changed; initialize a new integration session")
    cached = next((e for e in store.rows("events") if e["event_id"] == action.event_id), None)
    if action.operation == "update" and not (cached and cached.get("etag")):
        raise GoogleAccessError("Read the live event before confirming its update")
    now = datetime.now(timezone.utc).isoformat()
    with store.connect() as db:
        db.execute("UPDATE meta SET value=? WHERE key='clock'", (now,))
    envelope = {"backend_binding": config.binding(), "action": action.model_dump(), "expected_etag": cached.get("etag") if cached else None}
    if guard_hash:
        envelope["inbox_guard_hash"] = guard_hash
    return store.confirm(envelope)
