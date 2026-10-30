"""Evidence-backed mail classification; routing proposes reviews, never writes."""
from __future__ import annotations

from typing import Literal

from pydantic import Field

from interview.schemas import Contract


Category = Literal["ordinary", "recruitment_update", "invitation", "availability_request",
                   "reschedule", "cancellation", "logistics_update", "unclear"]
ACTIONABLE = {"invitation", "availability_request", "reschedule", "cancellation", "logistics_update"}


class Message(Contract):
    source_id: str
    subject: str
    body: str


class KnownInterview(Contract):
    interview_id: str
    thread_source_ids: list[str]


class MailInput(Contract):
    latest_source_id: str
    messages: list[Message] = Field(min_length=1)
    known_interviews: list[KnownInterview]


class Evidence(Contract):
    source_id: str
    quote: str = Field(min_length=1)


class Triage(Contract):
    latest_source_id: str
    category: Category
    interview_id: str | None
    evidence: list[Evidence] = Field(min_length=1)
    unknowns: list[str]
    rationale: str


class TriageNode(Contract):
    status: Literal["ready", "blocked", "needs_input"]
    triage: Triage | None
    questions: list[str]


def validate_input(data: dict) -> MailInput:
    mail = MailInput.model_validate(data)
    ids = [m.source_id for m in mail.messages]
    if len(set(ids)) != len(ids) or mail.latest_source_id not in ids:
        raise ValueError("Message IDs must be unique and include the latest message")
    interview_ids = [i.interview_id for i in mail.known_interviews]
    if len(set(interview_ids)) != len(interview_ids):
        raise ValueError("Interview IDs must be unique")
    return mail


def validate_triage(data: dict, mail: MailInput) -> Triage:
    result = Triage.model_validate(data)
    messages = {m.source_id: m for m in mail.messages}
    if result.latest_source_id != mail.latest_source_id:
        raise ValueError("Triage must target the latest message")
    if not any(e.source_id == mail.latest_source_id for e in result.evidence):
        raise ValueError("Evidence must include the latest message, not only old thread text")
    for evidence in result.evidence:
        message = messages.get(evidence.source_id)
        if not message or evidence.quote not in message.subject + "\n" + message.body:
            raise ValueError("Evidence must be an exact quote from its supplied message")
    linked = {i.interview_id for i in mail.known_interviews if set(i.thread_source_ids) & messages.keys()}
    if result.interview_id is not None and (len(linked) != 1 or result.interview_id not in linked):
        raise ValueError("Interview association requires an unambiguous supplied thread link")
    return result


def route(result: Triage) -> str:
    """A route is a pending downstream review, never permission to mutate Google."""
    if result.category == "ordinary":
        return "ignore"
    if result.category == "recruitment_update":
        return "record_only"
    if result.category == "unclear":
        return "needs_review"
    if result.category in {"reschedule", "cancellation", "logistics_update"} and result.interview_id is None:
        return "needs_review"
    return {"invitation": "scheduling_review", "availability_request": "availability_review",
            "reschedule": "reschedule_review", "cancellation": "cancellation_review",
            "logistics_update": "logistics_review"}[result.category]
