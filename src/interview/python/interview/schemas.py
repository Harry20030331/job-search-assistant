"""Shared contracts. Grading expectations are deliberately not part of these models."""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class Contract(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Question(Contract):
    field: Literal["timezone", "duration", "application_id", "availability", "confirmation", "other"]
    question: str


class Slot(Contract):
    start: str
    end: str
    timezone: str
    rationale: str


class Interview(Contract):
    interview_id: str
    application_id: str | None
    company: str | None
    role: str | None
    round: str | None
    duration_minutes: int | None
    start: str | None
    timezone: str | None
    source_ids: list[str]


class CalendarAction(Contract):
    operation: Literal["create", "update"]
    interview_id: str
    event_id: str | None
    title: str
    start: str
    end: str
    timezone: str
    reminder_minutes: list[int]


class CalendarResult(Contract):
    event_id: str
    confirmation_id: str | None


class Exercise(Contract):
    topic: str
    method: str
    minutes: int = Field(gt=0)
    basis_refs: list[str]


class Preparation(Contract):
    summary: str
    exercises: list[Exercise] = Field(max_length=6)
    unknowns: list[str]
    memory_impact: str


class AgentResult(Contract):
    interview: Interview
    status: Literal["needs_input", "awaiting_confirmation", "completed", "blocked"]
    questions: list[Question]
    proposed_slots: list[Slot]
    proposed_action: CalendarAction | None
    calendar_result: CalendarResult | None
    preparation: Preparation | None
    memory_refs: list[str]
    artifacts: list[str]


class DimensionScore(Contract):
    name: Literal["specificity", "grounding", "actionability", "constraints", "memory_relevance", "memory_updates", "memory_impact"]
    score: int = Field(ge=0, le=2)
    evidence: str
    reason: str


class JudgeResult(Contract):
    dimensions: list[DimensionScore]
    serious_errors: list[str]
    uncertain_items: list[str]
    summary: str


def strict_schema(model: type[BaseModel]) -> dict:
    """Convert Pydantic's nullable defaults to the all-fields-required strict subset."""
    schema = model.model_json_schema()

    def visit(node):
        if isinstance(node, dict):
            node.pop("default", None)
            if node.get("type") == "object":
                node["additionalProperties"] = False
                node["required"] = list(node.get("properties", {}))
            for value in node.values():
                visit(value)
        elif isinstance(node, list):
            for value in node:
                visit(value)

    visit(schema)
    return schema
