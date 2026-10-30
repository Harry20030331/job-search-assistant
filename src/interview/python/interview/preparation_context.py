"""Evidence-bound preparation context. No inference, browsing or approvals happen here."""
from __future__ import annotations

import argparse
import hashlib
from datetime import datetime
from pathlib import Path
from typing import Literal
from urllib.parse import urlparse

from pydantic import Field, model_validator

from interview.schemas import Contract
from interview.storage import canonical, digest, read_json, write_json

PROTOCOL = "preparation-context-v1"
VALIDATION_VERSION = "preparation-context-checks-v1.1"
Topic = Literal["ml_modeling", "ml_evaluation", "experimentation", "product_metrics", "sql", "coding",
                "system_design", "project_ownership", "collaboration", "leadership", "motivation",
                "self_introduction", "why_company", "why_role", "interviewer_questions"]


class Identity(Contract):
    job_id: str = Field(min_length=1)
    application_id: str | None
    interview_id: str = Field(min_length=1)
    company: str = Field(min_length=1)
    role: str = Field(min_length=1)


class Source(Contract):
    source_id: str = Field(pattern=r"^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$")
    kind: Literal["invitation", "jd", "company", "candidate", "preferences", "interview_report", "practice"]
    origin: Literal["canonical", "official", "public_report", "user_record"]
    relationship: Literal["exact_role", "same_company_analogue", "other_company_analogue", "unrelated_role", "context_only"]
    matched_job_id: str | None
    company: str | None
    role: str | None
    locator: str = Field(min_length=1)
    retrieved_at: datetime
    content: str = Field(min_length=1, max_length=100000)
    content_sha256: str = Field(pattern=r"^[a-f0-9]{64}$")

    @model_validator(mode="after")
    def validate_capture(self):
        if self.retrieved_at.utcoffset() is None:
            raise ValueError("Source capture needs a timezone-aware timestamp")
        if hashlib.sha256(self.content.encode("utf-8")).hexdigest() != self.content_sha256:
            raise ValueError("Source content hash does not match")
        if self.origin in {"official", "public_report"}:
            parsed = urlparse(self.locator)
            if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
                raise ValueError("Web evidence requires an HTTPS source URL without credentials")
        if self.kind == "interview_report" and self.origin != "public_report":
            raise ValueError("Interview reports must retain public-report attribution")
        if self.kind == "candidate" and self.origin != "canonical":
            raise ValueError("Candidate facts must come from canonical input")
        if self.kind == "jd" and self.relationship == "context_only":
            raise ValueError("A JD must identify its exact or analogue relationship")
        if self.kind != "jd" and self.relationship in {"same_company_analogue", "other_company_analogue", "unrelated_role"}:
            raise ValueError("Role-comparison relationships are reserved for JD evidence")
        return self


class ResearchUsage(Contract):
    search_queries: int = Field(ge=0)
    opened_pages: int = Field(ge=0)
    max_search_queries: int = Field(ge=0, le=20)
    max_opened_pages: int = Field(ge=0, le=30)

    @model_validator(mode="after")
    def within_budget(self):
        if self.search_queries > self.max_search_queries or self.opened_pages > self.max_opened_pages:
            raise ValueError("Declared research usage exceeds the configured budget")
        return self


class ContextRequest(Contract):
    protocol: Literal["preparation-context-v1"]
    identity: Identity
    association: Literal["verified", "unresolved"]
    budget_minutes: int = Field(ge=3, le=480)
    sources: list[Source] = Field(min_length=2)
    research: ResearchUsage

    @model_validator(mode="after")
    def source_identity(self):
        if len({s.source_id for s in self.sources}) != len(self.sources):
            raise ValueError("Duplicate source IDs")
        if not {"candidate", "invitation"}.issubset({s.kind for s in self.sources}):
            raise ValueError("Canonical candidate and invitation evidence are required")
        for source in self.sources:
            if source.relationship == "exact_role":
                if source.matched_job_id != self.identity.job_id:
                    raise ValueError("Exact-role evidence must bind the selected stable job ID")
                if source.company != self.identity.company:
                    raise ValueError("Exact-role evidence company differs from selected identity")
            if source.relationship == "same_company_analogue" and source.company != self.identity.company:
                raise ValueError("Same-company analogue has a different company")
            if source.relationship == "other_company_analogue" and (not source.company or source.company == self.identity.company):
                raise ValueError("Other-company analogue needs a distinct company")
            if source.relationship.endswith("analogue") and (not source.role or source.matched_job_id == self.identity.job_id):
                raise ValueError("Analogue needs its own role and cannot bind the selected job")
        return self


class Reference(Contract):
    source_id: str = Field(min_length=1)
    quote: str = Field(min_length=1)


class Claim(Contract):
    value: str | None = Field(description="Use null for an unknown claim. State supported facts or clearly qualified hypotheses only for confirmed/inferred claims.")
    assessment: Literal["confirmed", "inferred", "unknown"]
    reason: str = Field(min_length=1)
    refs: list[Reference]

    @model_validator(mode="after")
    def support(self):
        if self.assessment == "unknown":
            if self.value is not None:
                raise ValueError("Unknown claim must not assert a value")
        elif not self.value or not self.value.strip() or not self.refs:
            raise ValueError("Confirmed/inferred claims need a value and evidence")
        return self


class Focus(Contract):
    topic: Topic
    priority: Literal["primary", "supporting"] = Field(description="Preparation emphasis, not evidence certainty. All topics may be supporting when no primary focus is established.")
    basis: Claim = Field(description="A supported confirmed or inferred claim. Do not place unknown claims in focus; leave the list empty and use unknowns instead.")


class JDSelection(Contract):
    status: Literal["exact", "analogue", "missing"]
    source_ids: list[str]
    reason: str = Field(min_length=1)
    limitations: list[str]


class ContextAnalysis(Contract):
    request_token: str = Field(pattern=r"^[a-f0-9]{64}$")
    jd: JDSelection
    role_focus: list[Focus]
    seniority: Claim
    round_label: Claim
    round_focus: list[Focus]
    candidate_links: list[Claim] = Field(description="Canonical candidate facts, or inferred links to role/company evidence. Inferred links need a candidate anchor; confirmed candidate facts cite only candidate sources.")
    company_brief: list[Claim]
    reported_themes: list[Claim] = Field(description="Only inferred practice themes from public interview_report sources; not confirmed invitation topics. Empty when no relevant reports exist.")
    learning: list[Claim] = Field(description="Only source-linked user practice/debrief reports from practice sources, never resume facts. Empty when no relevant practice reports exist.")
    unknowns: list[str]
    questions: list[str]


def request_token(request: ContextRequest) -> str:
    return digest(request.model_dump(mode="json"))


def validate_analysis(request: ContextRequest, analysis: ContextAnalysis, *, validation_version=VALIDATION_VERSION) -> None:
    """Check mechanical evidence boundaries; semantic relevance still needs review."""
    if validation_version not in {"preparation-context-checks-v1", VALIDATION_VERSION}:
        raise ValueError("Unsupported context validation version")
    if analysis.request_token != request_token(request):
        raise ValueError("Context request changed; regenerate the analysis")
    sources = {s.source_id: s for s in request.sources}
    for group in (analysis.role_focus, analysis.round_focus):
        if len({f.topic for f in group}) != len(group):
            raise ValueError("Duplicate focus topics")
        if validation_version == "preparation-context-checks-v1" and group and not any(f.priority == "primary" for f in group):
            raise ValueError("Focus list needs a primary topic")
        if any(f.basis.assessment == "unknown" for f in group):
            raise ValueError("Unsupported focus belongs in unknowns")
    claims = [analysis.seniority, analysis.round_label, *[f.basis for f in analysis.role_focus],
              *[f.basis for f in analysis.round_focus], *analysis.candidate_links, *analysis.company_brief,
              *analysis.reported_themes, *analysis.learning]
    for claim in claims:
        for ref in claim.refs:
            if ref.source_id not in sources or not ref.quote.strip() or ref.quote not in sources[ref.source_id].content:
                raise ValueError("Reference is unavailable or quote is absent from the captured source")
        if claim.assessment == "confirmed" and any(
            sources[r.source_id].relationship.endswith("analogue") or sources[r.source_id].origin == "public_report"
            for r in claim.refs
        ):
            raise ValueError("Analogue/report evidence cannot confirm a selected-employer claim")
        if claim.assessment != "unknown" and any(sources[r.source_id].relationship == "unrelated_role" for r in claim.refs):
            raise ValueError("Unrelated-role evidence cannot establish selected-role expectations")
    for claim, kinds in ((analysis.seniority, {"jd", "invitation"}), (analysis.round_label, {"invitation"})):
        if claim.assessment == "confirmed" and any(
            sources[r.source_id].kind not in kinds or sources[r.source_id].relationship != "exact_role" for r in claim.refs
        ):
            raise ValueError("Confirmed level/round requires direct selected-role evidence")
    for claim in analysis.candidate_links:
        kinds = {sources[r.source_id].kind for r in claim.refs}
        if validation_version == "preparation-context-checks-v1" or claim.assessment == "confirmed":
            if kinds - {"candidate"}:
                raise ValueError("Confirmed candidate facts must reference only canonical candidate evidence")
        elif claim.assessment == "inferred" and ("candidate" not in kinds or kinds - {"candidate", "jd", "company", "invitation"}):
            raise ValueError("Inferred candidate links need a canonical candidate anchor and relevant role/company evidence")
    for claim in analysis.company_brief:
        if any(sources[r.source_id].kind != "company" or sources[r.source_id].company != request.identity.company for r in claim.refs):
            raise ValueError("Company brief needs evidence about the selected company")
    for claim in analysis.reported_themes:
        if claim.assessment != "inferred" or not all(sources[r.source_id].kind == "interview_report" for r in claim.refs):
            raise ValueError("Reported themes are inferred practice guidance from attributed reports")
    for claim in analysis.learning:
        if any(sources[r.source_id].kind != "practice" for r in claim.refs):
            raise ValueError("Learning must retain original practice/report provenance")
    selected = [sources.get(sid) for sid in analysis.jd.source_ids]
    if len(set(analysis.jd.source_ids)) != len(selected) or any(s is None or s.kind != "jd" for s in selected):
        raise ValueError("JD selection must reference unique JD documents")
    exact = [s for s in request.sources if s.kind == "jd" and s.relationship == "exact_role"]
    if analysis.jd.status == "exact":
        if not selected or any(s.relationship != "exact_role" for s in selected):
            raise ValueError("An analogue cannot be presented as the exact JD")
    elif analysis.jd.status == "analogue":
        if exact or not selected or any(not s.relationship.endswith("analogue") for s in selected) or not analysis.jd.limitations:
            raise ValueError("Analogue fallback requires missing exact JD and explicit limitations")
    elif selected or any(s.kind == "jd" and s.relationship != "unrelated_role" for s in request.sources):
        raise ValueError("Missing JD cannot hide available JD evidence")
    if (analysis.jd.status != "exact" or request.association == "unresolved" or
            analysis.seniority.assessment == "unknown" or analysis.round_label.assessment == "unknown") and not analysis.unknowns:
        raise ValueError("Missing or uncertain context must remain visible")
    if request.association == "unresolved" and not analysis.questions:
        raise ValueError("Unresolved interview association requires clarification")


def freeze(request_data, analysis_data, output: Path):
    request = ContextRequest.model_validate(request_data)
    analysis = ContextAnalysis.model_validate(analysis_data)
    validate_analysis(request, analysis)
    payload = {"protocol": PROTOCOL, "validation_version": VALIDATION_VERSION, "request": request.model_dump(mode="json"),
               "analysis": analysis.model_dump(mode="json")}
    payload["context_hash"] = digest(payload)
    output.mkdir(parents=True, exist_ok=False)
    write_json(output / "preparation-context.json", payload)
    return {"status": "context_validated", "request_token": request_token(request),
            "context_hash": payload["context_hash"], "output": str(output), "semantic_quality": "not_scored"}


def load_context(path: Path):
    payload = read_json(path)
    expected = {"protocol", "request", "analysis", "context_hash"}
    if set(payload) not in (expected, expected | {"validation_version"}) or payload["protocol"] != PROTOCOL:
        raise ValueError("Unexpected context envelope")
    if payload["context_hash"] != digest({k: v for k, v in payload.items() if k != "context_hash"}):
        raise ValueError("Frozen context changed")
    request, analysis = ContextRequest.model_validate(payload["request"]), ContextAnalysis.model_validate(payload["analysis"])
    validate_analysis(request, analysis, validation_version=payload.get("validation_version", "preparation-context-checks-v1"))
    return request, analysis


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("phase", choices=["schema", "request", "freeze", "check"])
    parser.add_argument("--request", type=Path)
    parser.add_argument("--analysis", type=Path)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--context", type=Path)
    args = parser.parse_args()
    if args.phase == "schema":
        print(canonical({"request": ContextRequest.model_json_schema(), "analysis": ContextAnalysis.model_json_schema()}))
    elif args.phase == "check":
        if args.context is None:
            parser.error("check requires --context")
        request, _ = load_context(args.context.resolve())
        print(canonical({"status": "context_validated", "request_token": request_token(request), "semantic_quality": "not_scored"}))
    else:
        if args.request is None:
            parser.error("request/freeze requires --request")
        request = ContextRequest.model_validate(read_json(args.request.resolve()))
        if args.phase == "request":
            print(canonical({"status": "request_validated", "request_token": request_token(request)}))
        else:
            if args.analysis is None or args.output is None:
                parser.error("freeze requires --analysis and --output")
            print(canonical(freeze(request.model_dump(mode="json"), read_json(args.analysis.resolve()), args.output.resolve())))


if __name__ == "__main__":
    main()
