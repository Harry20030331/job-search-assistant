"""Bounded research receipts for the current Codex chat; never fetches web pages."""
from __future__ import annotations

import argparse
import hashlib
import ipaddress
import json
import re
import sqlite3
from contextlib import closing, contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from pydantic import Field, model_validator

from interview.context_preparation import Enrichment, capture_request
from interview.freshness import check
from interview.preparation import context_fingerprint
from interview.preparation_context import ContextRequest, Source
from interview.schemas import Contract
from interview.storage import Store, canonical, digest, read_json, write_json

PROTOCOL = "interview-enrichment-v1"
TRACKING = {"utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "gh_src"}


def web_url(value):
    parsed = urlsplit(value)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password or parsed.port not in {None, 443}:
        raise ValueError("Research requires public HTTPS URLs without credentials or custom ports")
    host = parsed.hostname.lower()
    try:
        ipaddress.ip_address(host)
        numeric_address = True
    except ValueError:
        numeric_address = False
    if host == "localhost" or host.endswith((".localhost", ".local")) or numeric_address:
        raise ValueError("Research URLs must not address local network services")
    return urlunsplit(("https", parsed.netloc.lower(), parsed.path or "/",
                       urlencode([(k, v) for k, v in parse_qsl(parsed.query, keep_blank_values=True) if k not in TRACKING]), ""))


class OfficialScope(Contract):
    company: str = Field(min_length=1)
    url: str
    include_subpaths: bool = False
    verification_ref: str = Field(min_length=1, description="Actual host verification of employer ownership; not a search snippet or domain-name guess.")

    @model_validator(mode="after")
    def valid(self):
        self.url = web_url(self.url)
        return self


class ResearchPolicy(Contract):
    max_search_queries: int = Field(default=6, ge=0, le=6)
    max_opened_pages: int = Field(default=8, ge=0, le=8)
    official_scopes: list[OfficialScope] = Field(default_factory=list)
    include_public_reports: bool = False
    analogue_query: str | None = None


class Lead(Contract):
    url: str
    title: str = Field(min_length=1, max_length=500)
    snippet: str = Field(default="", max_length=2000)


class Decision(Contract):
    kind: Literal["exact_jd", "same_company_analogue", "other_company_analogue", "company", "interview_report", "reject"]
    company: str | None = None
    role: str | None = None
    company_quote: str = ""
    role_quote: str = ""
    content_quote: str = ""
    rationale: str = Field(min_length=1)
    limitations: list[str] = Field(default_factory=list)
    selected_requisition: str | None = None
    requisition_quote: str = ""
    availability: Literal["unknown", "open", "closed"] = "unknown"
    availability_quote: str = ""


class Receipt(Contract):
    action_id: str
    executor: Literal["search_tool", "codex_in_app_browser", "offline_fixture"]
    observation_ref: str = Field(min_length=1)
    status: Literal["ok", "unavailable", "blocked"]
    results: list[Lead] = Field(default_factory=list, max_length=5)
    final_url: str | None = None
    captured_at: datetime
    title: str = Field(default="", max_length=1000)
    text: str = Field(default="", max_length=100000)
    decision: Decision | None = None

    @model_validator(mode="after")
    def timestamp(self):
        if self.captured_at.utcoffset() is None:
            raise ValueError("Capture timestamps must include a timezone")
        if self.captured_at > datetime.now(timezone.utc):
            raise ValueError("Capture cannot be from the future")
        return self


def normalized(value):
    return " ".join(re.findall(r"\w+", value.casefold()))


def trusted(policy, url, company):
    target = urlsplit(web_url(url))
    for scope in policy.official_scopes:
        root = urlsplit(scope.url)
        if normalized(scope.company) != normalized(company) or root.netloc != target.netloc:
            continue
        if target.geturl() == root.geturl():
            return True
        # Never trust all employers on a shared ATS domain from one requisition.
        if (scope.include_subpaths and not root.query and
                (target.path == root.path or target.path.startswith(root.path.rstrip("/") + "/"))):
            return True
    return False


@contextmanager
def session(path):
    root = Path(path).resolve()
    db = sqlite3.connect("file:" + (root / "session.sqlite3").as_posix() + "?mode=rw", uri=True, timeout=10)
    try:
        db.execute("BEGIN IMMEDIATE")
        value = read_json(root / "binding.json")
        store = Store(Path(value["workspace"]))
        check(store)
        if context_fingerprint(store) != value["input_fingerprint"]:
            raise ValueError("Candidate/opportunity/invitation changed; start fresh research")
        state = json.loads(db.execute("SELECT payload FROM state WHERE id=1").fetchone()[0])
        if digest({"request": state["request"], "policy": state["policy"], "canonical_url": state["canonical_url"],
                   "requisition": state["requisition"], "mode": state["mode"]}) != value["research_binding"]:
            raise ValueError("Research identity or policy changed")
        yield state, db
        check(store)
        if context_fingerprint(store) != value["input_fingerprint"]:
            raise ValueError("Canonical inputs changed during research operation")
        db.execute("UPDATE state SET payload=? WHERE id=1", (canonical(state),))
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def start(workspace, output, *, policy=None, association="unresolved", requisition=None, seed=None, mode="live"):
    if mode not in {"live", "offline_fixture"}:
        raise ValueError("Unknown research executor mode")
    store, root = Store(Path(workspace)), Path(output).resolve()
    if root == store.workspace or root.is_relative_to(store.workspace / "inputs"):
        raise ValueError("Research output must not modify canonical working inputs")
    check(store)
    before = context_fingerprint(store)
    application = read_json(store.workspace / "inputs/application.json")
    policy = ResearchPolicy.model_validate(policy or {}).model_dump(mode="json")
    canonical_url = web_url(application["official_url"]) if application.get("official_url") else None
    if canonical_url:
        policy["official_scopes"].append({"company": application["company"], "url": canonical_url, "include_subpaths": False,
                                          "verification_ref": "Selected canonical opportunity official_url; exact URL only"})
    root.mkdir(parents=True, exist_ok=False)
    capture_request(store, root / "base", association=association, enrichment=seed)
    request = read_json(root / "base/request.json")
    sources = [s for s in request["sources"] if s["kind"] not in {"candidate", "invitation", "preferences", "practice"}]
    if any(s["relationship"] == "exact_role" and normalized(s["role"] or "") != normalized(application["role"]) for s in sources):
        raise ValueError("Reused exact JD role differs from canonical identity")
    state = {"protocol": PROTOCOL, "request": request, "policy": policy, "canonical_url": canonical_url,
             "requisition": requisition, "mode": mode, "sources": sources, "pending": None, "counter": 0,
             "search_queries": 0, "opened_pages": 0, "urls_done": [], "queries_done": [], "leads": [],
             "decisions": [], "finished": False}
    binding = {"workspace": str(store.workspace), "input_fingerprint": before,
               "research_binding": digest({key: state[key] for key in ("request", "policy", "canonical_url", "requisition", "mode")}),
               "seed_reuse_count": len(sources), "seed_usage": request["research"],
               "provenance_limit": "Official ownership, semantic relevance and truthful browser observations remain host assertions, not proven by strings/hashes."}
    write_json(root / "binding.json", binding)
    with closing(sqlite3.connect(root / "session.sqlite3")) as db, db:
        db.execute("CREATE TABLE state(id INTEGER PRIMARY KEY CHECK(id=1),payload TEXT NOT NULL)")
        db.execute("CREATE TABLE receipts(action_id TEXT PRIMARY KEY,sha256 TEXT NOT NULL,payload TEXT NOT NULL,result TEXT NOT NULL)")
        db.execute("INSERT INTO state VALUES (1,?)", (canonical(state),))
    if context_fingerprint(store) != before:
        raise ValueError("Canonical inputs changed during research initialization")
    return {"status": "research_ready", "session": str(root), "seed_reuse_count": len(sources), "model_calls": 0}


def next_action(root):
    with session(root) as (state, _):
        if state["finished"]:
            return {"status": "finished"}
        if state["pending"]:
            return state["pending"]
        policy = ResearchPolicy.model_validate(state["policy"])
        identity = state["request"]["identity"]
        has_exact = any(s["kind"] == "jd" and s["relationship"] == "exact_role" for s in state["sources"])
        has_company = any(s["kind"] == "company" for s in state["sources"])
        has_report = any(s["kind"] == "interview_report" for s in state["sources"])
        if has_exact and has_company and (not policy.include_public_reports or has_report):
            return {"status": "ready_to_finish", "reason": "Exact JD and company context available"}
        action = None
        if state["opened_pages"] < policy.max_opened_pages:
            if state["canonical_url"] and state["canonical_url"] not in state["urls_done"] and not has_exact:
                action = {"kind": "open", "url": state["canonical_url"], "purpose": "exact_jd"}
            else:
                lead = next((v for v in state["leads"] if v["url"] not in state["urls_done"] and
                             (not has_exact or v["purpose"] in {"company", "interview_report"})), None)
                if lead:
                    action = {"kind": "open", "url": lead["url"], "purpose": lead["purpose"]}
        company, role = identity["company"], identity["role"]
        queries = [("exact_jd", f'"{company}" "{role}" job description'),
                   ("exact_jd", f'"{company}" "{state["requisition"] or role}" careers requirements'),
                   ("same_company_analogue", policy.analogue_query or f'"{company}" "{role}" similar role responsibilities'),
                   ("other_company_analogue", f'"{role}" official careers responsibilities'),
                   ("company", f'"{company}" official company product values')]
        if policy.include_public_reports:
            queries.append(("interview_report", f'"{company}" "{role}" interview experience'))
        if action is None and state["search_queries"] < policy.max_search_queries:
            query = next(((purpose, text) for purpose, text in queries if text not in state["queries_done"] and
                          (not has_exact or purpose in {"company", "interview_report"}) and
                          (purpose != "company" or not has_company) and (purpose != "interview_report" or not has_report)), None)
            if query and state["opened_pages"] < policy.max_opened_pages:
                action = {"kind": "search", "query": query[1], "purpose": query[0]}
        if action is None:
            return {"status": "ready_to_finish", "reason": "Research actions or budget exhausted; retain missing evidence"}
        state["counter"] += 1
        action["action_id"] = "research-" + str(state["counter"])
        action["executor"] = "search_tool" if action["kind"] == "search" else "codex_in_app_browser"
        action["untrusted_evidence"] = True
        if action["kind"] == "search":
            state["search_queries"] += 1
            state["queries_done"].append(action["query"])
        else:
            state["opened_pages"] += 1
            state["urls_done"].append(action["url"])
        state["pending"] = action
        return action


def assess(state, receipt):
    decision = receipt.decision
    if decision is None or decision.kind == "reject":
        return None, "No selected evidence; page remains a research observation"
    if not receipt.text.strip() or not receipt.final_url or not decision.company:
        raise ValueError("Selected evidence needs captured text, final URL and company")
    url = web_url(receipt.final_url)
    identity = state["request"]["identity"]
    policy = ResearchPolicy.model_validate(state["policy"])
    for quote in (decision.company_quote, decision.content_quote):
        if not quote.strip() or quote not in receipt.text:
            raise ValueError("Company and content quotes must be exact captured excerpts")
    if " " + normalized(decision.company) + " " not in " " + normalized(decision.company_quote) + " ":
        raise ValueError("Company attribution is not supported by its quote")
    if decision.kind != "interview_report" and not trusted(policy, url, decision.company):
        raise ValueError("Official employer ownership is not in the host-verified URL scopes")
    kind, relation, origin = "jd", decision.kind, "official"
    if decision.kind in {"company", "interview_report"}:
        kind, relation = decision.kind, "context_only"
        if normalized(decision.company) != normalized(identity["company"]):
            raise ValueError("Company brief/report concerns another employer")
        origin = "public_report" if kind == "interview_report" else "official"
        if kind == "interview_report" and (not policy.include_public_reports or not decision.limitations):
            raise ValueError("Reports need opt-in and explicit anecdotal/date/role limitations")
    else:
        if not decision.role or not decision.role_quote or decision.role_quote not in receipt.text:
            raise ValueError("JD role needs a captured identity quote")
        if normalized(decision.role) != normalized(decision.role_quote):
            raise ValueError("Role attribution is not supported by its quote")
        if decision.kind == "exact_jd":
            selected_url = url == state["canonical_url"]
            selected_req = (state["requisition"] and decision.selected_requisition == state["requisition"] and
                            decision.requisition_quote in receipt.text and
                            re.search(r"(?<![a-zA-Z0-9])" + re.escape(state["requisition"]) + r"(?![a-zA-Z0-9])", decision.requisition_quote))
            if (normalized(decision.company) != normalized(identity["company"]) or
                    normalized(decision.role) != normalized(identity["role"]) or not (selected_url or selected_req)):
                raise ValueError("Exact JD needs canonical URL/requisition and matching employer/role; title similarity is insufficient")
            relation = "exact_role"
        else:
            same = normalized(decision.company) == normalized(identity["company"])
            if same != (decision.kind == "same_company_analogue") or not decision.limitations:
                raise ValueError("Analogue relationship needs correct employer comparison and explicit differences/limits")
        if decision.availability != "unknown" and (not decision.availability_quote or decision.availability_quote not in receipt.text):
            raise ValueError("Open/closed observation needs a captured quote; connection failure is not closure")
    source = Source.model_validate({"source_id": "research_" + digest({"url": url, "content": receipt.text, "kind": kind})[:16],
        "kind": kind, "origin": origin, "relationship": relation,
        "matched_job_id": identity["job_id"] if relation == "exact_role" else None,
        "company": decision.company, "role": decision.role, "locator": url,
        "retrieved_at": receipt.captured_at, "content": receipt.text,
        "content_sha256": hashlib.sha256(receipt.text.encode("utf-8")).hexdigest()})
    return source.model_dump(mode="json"), decision.rationale


def record(root, data):
    receipt = Receipt.model_validate(data)
    with session(root) as (state, db):
        old = db.execute("SELECT sha256,result FROM receipts WHERE action_id=?", (receipt.action_id,)).fetchone()
        if old:
            if old[0] != digest(data):
                raise ValueError("Cannot replace a first research receipt")
            return json.loads(old[1])
        action = state["pending"]
        if state["finished"] or not action or action["action_id"] != receipt.action_id:
            raise ValueError("Receipt does not belong to the pending research action")
        if receipt.executor == "offline_fixture" and state["mode"] != "offline_fixture":
            raise ValueError("Offline fixtures cannot masquerade as live browser research")
        if receipt.executor != "offline_fixture" and receipt.executor != action["executor"]:
            raise ValueError("Search snippets cannot substitute for browser page capture")
        result = {"action_id": receipt.action_id, "status": receipt.status, "source_id": None}
        if receipt.status == "ok":
            if action["kind"] == "search":
                if receipt.text or receipt.decision is not None:
                    raise ValueError("Search results are leads only, never source evidence")
                for lead in receipt.results[:2]:
                    try:
                        url = web_url(lead.url)
                    except ValueError:
                        continue
                    state["leads"].append({"url": url, "purpose": action["purpose"], "title": lead.title})
            else:
                if receipt.results:
                    raise ValueError("Page capture must not inject search leads")
                try:
                    source, reason = assess(state, receipt)
                    if source and source["source_id"] not in {s["source_id"] for s in state["sources"]}:
                        state["sources"].append(source)
                    result.update(status="accepted" if source else "rejected", source_id=source["source_id"] if source else None, reason=reason)
                except ValueError as exc:
                    result.update(status="rejected", reason=str(exc))
                state["decisions"].append({**result, "requested_url": action["url"], "final_url": receipt.final_url,
                                           "decision": receipt.decision.model_dump() if receipt.decision else None})
        elif receipt.decision is not None:
            raise ValueError("An unavailable/blocked page cannot establish JD identity or closure")
        db.execute("INSERT INTO receipts VALUES (?,?,?,?)", (receipt.action_id, digest(data), canonical(data), canonical(result)))
        state["pending"] = None
        return result


def finish(root):
    with session(root) as (state, _):
        if state["pending"]:
            raise ValueError("Record the pending action, including failures, before finishing")
        policy = ResearchPolicy.model_validate(state["policy"])
        exact = [s for s in state["sources"] if s["kind"] == "jd" and s["relationship"] == "exact_role"]
        same = [s for s in state["sources"] if s["relationship"] == "same_company_analogue"]
        other = [s for s in state["sources"] if s["relationship"] == "other_company_analogue"]
        selected = exact or same or other
        sources = selected + [s for s in state["sources"] if s["kind"] in {"company", "interview_report"}]
        enrichment = Enrichment.model_validate({"sources": sources, "research": {
            "search_queries": state["search_queries"], "opened_pages": state["opened_pages"],
            "max_search_queries": policy.max_search_queries, "max_opened_pages": policy.max_opened_pages}}).model_dump(mode="json")
        request = ContextRequest.model_validate({**state["request"], "sources":
            [s for s in state["request"]["sources"] if s["kind"] in {"candidate", "invitation", "preferences", "practice"}] + sources,
            "research": enrichment["research"]})
        summary = {"status": "exact" if exact else "analogue" if selected else "missing", "mode": state["mode"],
                   "selected_source_ids": [s["source_id"] for s in sources], "research": enrichment["research"],
                   "limitations": ["Captured text is untrusted evidence. Host source labels/ownership/relevance require review.",
                                   "No application state or calendar event is changed. Search failures do not establish job closure."],
                   "decisions": state["decisions"], "seed_reuse_count": len(state["request"]["sources"]) -
                     len([s for s in state["request"]["sources"] if s["kind"] in {"candidate", "invitation", "preferences", "practice"}])}
        for filename, value in (("enrichment.json", enrichment), ("request.json", request.model_dump(mode="json")), ("summary.json", summary)):
            path = Path(root) / filename
            if path.exists() and read_json(path) != value:
                raise ValueError("Refusing to overwrite finished research")
            if not path.exists():
                write_json(path, value)
        state["finished"] = True
        return summary


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("phase", choices=["start", "next", "record", "finish"])
    parser.add_argument("--workspace", type=Path)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--session", type=Path)
    parser.add_argument("--input", type=Path)
    parser.add_argument("--policy", type=Path)
    parser.add_argument("--seed", type=Path)
    parser.add_argument("--association", choices=["verified", "unresolved"], default="unresolved")
    parser.add_argument("--requisition")
    parser.add_argument("--mode", choices=["live", "offline_fixture"], default="live")
    args = parser.parse_args()
    if args.phase == "start":
        if args.workspace is None or args.output is None:
            parser.error("start requires --workspace and a new --output")
        result = start(args.workspace, args.output, policy=read_json(args.policy) if args.policy else None,
                       association=args.association, requisition=args.requisition,
                       seed=read_json(args.seed) if args.seed else None, mode=args.mode)
    else:
        if args.session is None:
            parser.error("next/record/finish requires --session")
        if args.phase == "record" and args.input is None:
            parser.error("record requires --input")
        result = next_action(args.session) if args.phase == "next" else record(args.session, read_json(args.input)) if args.phase == "record" else finish(args.session)
    print(canonical(result))


if __name__ == "__main__":
    main()
