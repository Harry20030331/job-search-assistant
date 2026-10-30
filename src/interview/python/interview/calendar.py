from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from interview.schemas import CalendarAction
from interview.storage import Store, canonical


def parse_instant(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        raise ValueError("Explicit UTC offset required; ambiguous local times must be clarified.")
    return parsed.astimezone(timezone.utc)


def validate_action(action: CalendarAction) -> None:
    start, end = parse_instant(action.start), parse_instant(action.end)
    zone = ZoneInfo(action.timezone)
    if end <= start:
        raise ValueError("Event must end after it starts.")
    for text in (action.start, action.end):
        supplied = datetime.fromisoformat(text.replace("Z", "+00:00"))
        local = supplied.astimezone(zone)
        # UTC strings are accepted. A supplied nonzero local offset must agree with the zone.
        if supplied.utcoffset() != timedelta(0) and supplied.utcoffset() != local.utcoffset():
            raise ValueError("The supplied offset disagrees with the IANA timezone.")
    if any(minutes < 0 for minutes in action.reminder_minutes):
        raise ValueError("Reminder offsets must be nonnegative.")


def overlaps(a_start: str, a_end: str, b_start: str, b_end: str) -> bool:
    return max(parse_instant(a_start), parse_instant(b_start)) < min(parse_instant(a_end), parse_instant(b_end))


def apply_action(store: Store, action: CalendarAction, confirmation_id: str | None) -> dict:
    """Local experimental adapter: preserve mistakes rather than auto-correcting them."""
    validate_action(action)
    event_id = action.event_id
    with store.connect() as db:
        if action.operation == "update":
            if not event_id or not db.execute("SELECT 1 FROM events WHERE event_id=?", (event_id,)).fetchone():
                raise ValueError("Update requires an existing event_id.")
        else:
            if event_id is not None:
                raise ValueError("Create must not supply an event_id.")
            event_id = "event-" + uuid.uuid4().hex[:12]
        start = parse_instant(action.start)
        now = parse_instant(store.meta("clock"))
        reminders = sorted({(start - timedelta(minutes=m)).isoformat() for m in action.reminder_minutes if start - timedelta(minutes=m) > now})
        event = {**action.model_dump(), "event_id": event_id, "confirmation_id": confirmation_id, "reminders": reminders}
        db.execute("INSERT OR REPLACE INTO events VALUES (?,?)", (event_id, canonical(event)))
    return event
