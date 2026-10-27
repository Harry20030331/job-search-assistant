"""Stage-aware semantic judge and evidence checks, separate from historical rubrics."""
from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Literal

from pydantic import Field, model_validator

from evaluation import judge
from interview.schemas import Contract, strict_schema
from interview.storage import canonical, digest, read_json, write_json

DIMENSIONS = ["evidence_fidelity", "role_round_focus", "coverage", "level_depth", "actionability", "workload_feasibility"]
RUBRIC = Path(__file__).resolve().parent / "rubrics/preparation-semantic-v1.1.md"


class SemanticScore(Contract):
    name: Literal["evidence_fidelity", "role_round_focus", "coverage", "level_depth", "actionability", "workload_feasibility"]
    score: int = Field(ge=0, le=2)
    output_evidence_ids: list[str] = Field(description="Select O-prefixed keys from evidence_catalog.output; do not write excerpts or invent IDs.")
    source_evidence_ids: list[str] = Field(description="Select E-prefixed keys from evidence_catalog.sources; virtual policy/approval evidence is explicitly listed there.")
    reason: str = Field(min_length=1)


class SeriousError(Contract):
    category: Literal["fabrication", "wrong_identity", "incorrect_guidance", "unsupported_certainty", "other"]
    output_evidence_ids: list[str] = Field(min_length=1)
    reason: str = Field(min_length=1)


class PreparationJudgment(Contract):
    dimensions: list[SemanticScore] = Field(min_length=6, max_length=6)
    serious_errors: list[SeriousError]
    uncertain_items: list[str]
    summary: str = Field(min_length=1)

    @model_validator(mode="after")
    def unique_dimensions(self):
        if {d.name for d in self.dimensions} != set(DIMENSIONS):
            raise ValueError("Return every semantic dimension exactly once")
        return self


def source_texts(packet):
    return {**{s["source_id"]: s["content"] for s in packet["request"]["sources"]},
            "preparation-policy": canonical(packet["preparation_policy"]),
            "approved-plan": canonical(packet["approved_proposal"]) if packet.get("approved_proposal") else ""}


def validate_judgment(packet, value):
    judgment = PreparationJudgment.model_validate(value)
    catalog = packet["evidence_catalog"]
    for item in [*judgment.dimensions, *judgment.serious_errors]:
        if not item.reason.strip():
            raise ValueError("Semantic judgment requires an actual reason")
        for identity in item.output_evidence_ids:
            if identity not in catalog["output"]:
                raise ValueError("Judge selected an unavailable output evidence ID")
        if isinstance(item, SemanticScore):
            if item.score == 2 and not item.output_evidence_ids:
                raise ValueError("Positive semantic scores require output evidence")
            for identity in item.source_evidence_ids:
                if identity not in catalog["sources"]:
                    raise ValueError("Judge selected an unavailable source evidence ID")
    return judgment


def add_evidence_catalog(packet):
    def chunks(text, limit=1000):
        # Stable non-overlapping spans, not model-authored quotations or fuzzy matches.
        pieces = []
        for paragraph in text.split("\n\n"):
            while len(paragraph) > limit:
                cut = paragraph.rfind(" ", 0, limit)
                cut = cut if cut > 0 else limit
                pieces.append(paragraph[:cut])
                paragraph = paragraph[cut:]
            if paragraph.strip():
                pieces.append(paragraph)
        return pieces
    output = {"O" + str(i).zfill(3): quote for i, quote in enumerate(chunks(packet["output_text"]), 1)}
    sources = {}
    for source_id, text in source_texts(packet).items():
        for quote in chunks(text):
            sources["E" + str(len(sources)+1).zfill(3)] = {"source_id": source_id, "quote": quote}
    packet["evidence_catalog"] = {"output": output, "sources": sources}
    return packet


def resolve_evidence(packet, judgment):
    catalog = packet["evidence_catalog"]
    value = judgment.model_dump()
    for item in [*value["dimensions"], *value["serious_errors"]]:
        item["output_evidence"] = [catalog["output"][identity] for identity in item["output_evidence_ids"]]
        if "source_evidence_ids" in item:
            item["source_evidence"] = [catalog["sources"][identity] for identity in item["source_evidence_ids"]]
    return value


def judgment_schema(packet):
    schema = strict_schema(PreparationJudgment)
    for name in ("SemanticScore", "SeriousError"):
        schema["$defs"][name]["properties"]["output_evidence_ids"]["items"]["enum"] = sorted(packet["evidence_catalog"]["output"])
    schema["$defs"]["SemanticScore"]["properties"]["source_evidence_ids"]["items"]["enum"] = sorted(packet["evidence_catalog"]["sources"])
    return schema


def evaluate(packet, destination, *, rubric, settings, request_fn=judge.request_structured):
    schema = judgment_schema(packet)
    fingerprint = digest({"packet": packet, "rubric": rubric, "settings": settings, "schema": schema})
    destination = Path(destination)
    if destination.exists():
        prior = read_json(destination)
        if prior.get("fingerprint") != fingerprint:
            raise ValueError("Judge inputs changed; use a new frozen review pack")
        validate_judgment(packet, prior["judgment"])
        return prior
    if destination.with_suffix(".invalid.json").exists():
        raise ValueError("Invalid first judge response retained; no automatic regrading")
    result = request_fn([{"role": "system", "content": rubric}, {"role": "user", "content": canonical(packet)}], schema, settings=settings)
    destination.parent.mkdir(parents=True, exist_ok=True)
    try:
        judgment = validate_judgment(packet, result["parsed"])
    except (ValueError, KeyError, TypeError) as exc:
        invalid = destination.with_suffix(".invalid.json")
        if not invalid.exists():
            write_json(invalid, {"fingerprint": fingerprint, "status": "invalid_judge", "response": result, "error": str(exc)})
        raise
    record = {**result, "fingerprint": fingerprint, "rubric_sha256": hashlib.sha256(rubric.encode()).hexdigest(),
              "judgment": judgment.model_dump(), "resolved_judgment": resolve_evidence(packet, judgment), "human_calibrated": False}
    with destination.open("x", encoding="utf-8") as stream:
        stream.write(canonical(record) + "\n")
    return record
