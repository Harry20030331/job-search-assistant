"""Classify queued mail and atomically deliver pending-review handoffs."""
from __future__ import annotations

import uuid
from pathlib import Path

from interview.agent_runtime import invoke
from evaluation.mail_triage import PROMPT
from interview.google_adapter import GoogleAccessError, GoogleHTTPError
from interview.inbox import ManualReview
from interview.schemas import strict_schema
from interview.storage import digest, read_json, write_json
from interview.triage import Triage, TriageNode, route, validate_input, validate_triage


LIVE_PROMPT = PROMPT + "\nThese messages are verified members of one Gmail thread, not unrelated search hits. known_interviews contains host-verified bindings to that thread. A unique such binding applies to the latest reply even if its source ID differs from earlier messages. If several interviews are bound, do not select one. Earlier messages are time-filtered; do not invent later replies. Output classification only. For evidence, use one short verbatim sentence from the latest message. Copy punctuation and Markdown characters exactly. Do not join lines, remove asterisks, or reformat date/time fields in a quote. Additional logistics can be described in the rationale without quoting reformatted text.\n"


def codex_classifier(mail, destination, settings):
    destination.mkdir(parents=True, exist_ok=False)
    work = destination / "work"
    work.mkdir()
    write_json(work / "input.json", mail.model_dump())
    schema = work / "triage.schema.json"
    write_json(schema, strict_schema(TriageNode))
    (destination / "prompt.txt").write_text(LIVE_PROMPT, encoding="utf-8")
    write_json(destination / "settings.json", settings)
    result = invoke(work.resolve(), LIVE_PROMPT, schema.resolve(), destination.resolve() / "response", settings)
    if result["status"] != "completed":
        raise GoogleAccessError("classifier_" + result["status"])
    if read_json(work / "input.json") != mail.model_dump() or not result.get("successful_shell_command_count"):
        raise ManualReview("classifier_input_integrity_or_read_check_failed")
    return TriageNode.model_validate(result["output"])


def process_next(inbox, destination: Path, settings: dict, *, message_id=None, classify_fn=codex_classifier):
    job = inbox.store.claim(message_id=message_id)
    if not job:
        return {"status": "no_eligible_job", **inbox.store.counts()}
    attempt = destination / (digest({"account": inbox.store.account, "message_id": job["message_id"]})[:16] + "-" + uuid.uuid4().hex[:10])
    try:
        context, skip_reason = inbox.context(job["message_id"])
        if skip_reason:
            inbox.store.terminal(job, "skipped", skip_reason)
            return {"status": "skipped", "reason": skip_reason}
        mail = validate_input(context["input"])
        node = classify_fn(mail, attempt, settings)
        if node.status != "ready":
            inbox.store.terminal(job, "needs_review", "classifier_" + node.status)
            return {"status": "needs_review", "reason": "classifier_" + node.status}
        if node.triage is None:
            raise ManualReview("ready_classifier_omitted_triage")
        raw = validate_triage(node.triage.model_dump(), mail)
        effective = raw.model_dump()
        links = context["links"]
        association = "model_or_unresolved"
        if len(links) == 1:
            effective["interview_id"] = links[0]["interview_id"]
            association = "host_unique_gmail_thread_binding"
        effective = Triage.model_validate(effective)
        next_route = route(effective)
        if len(links) > 1 and next_route not in {"ignore", "record_only"}:
            next_route = "needs_review"
        classifier_hash = digest({"prompt": LIVE_PROMPT, "model": settings.get("agent_model"), "effort": settings.get("agent_reasoning_effort")})
        cache_key = digest({"account": inbox.store.account, "input": mail.model_dump(), "content_hash": context["latest"]["content_hash"], "classifier_hash": classifier_hash})
        record = {"raw_triage": raw.model_dump(), "effective_triage": effective.model_dump(),
                  "association_method": association, "route": next_route,
                  "input_hash": digest(mail.model_dump()), "classifier_hash": classifier_hash,
                  "private_attempt_directory": str(attempt)}
        record["source_revision"] = inbox.store.thread_snapshot(context["latest"]["thread_id"])["revision"]
        handoff = None
        if next_route not in {"ignore", "record_only"}:
            handoff = {"handoff_id": cache_key, "message_id": job["message_id"],
                       "thread_id": context["latest"]["thread_id"], "route": next_route,
                       "interview_id": effective.interview_id,
                       "existing_workspace": links[0]["workspace"] if len(links) == 1 else None,
                       "input_hash": record["input_hash"], "source_attempt": str(attempt),
                       "source_revision": record["source_revision"],
                       "calendar_write_authorized": False, "full_preparation_authorized": False,
                       "next_step": "Review facts and existing state; downstream calendar consent and preparation acceptance remain separate.",
                       "executor_status": "manual_review_required" if next_route in {"cancellation_review", "logistics_review", "needs_review"} else "proposal_pending"}
        inbox.store.complete(job, cache_key, record, handoff)
        if attempt.exists():
            write_json(attempt / "accepted.json", record)
        return {"status": "triaged", "category": effective.category, "route": next_route,
                "association_method": association, "handoff_queued": handoff is not None,
                "google_writes": 0}
    except GoogleHTTPError as exc:
        if exc.status == 404:
            inbox.store.terminal(job, "gone", "message_or_thread_no_longer_available")
            return {"status": "gone"}
        return {"status": inbox.store.retry(job, "google_http_" + str(exc.status))}
    except ManualReview as exc:
        inbox.store.terminal(job, "needs_review", str(exc))
        return {"status": "needs_review", "reason": str(exc)}
    except GoogleAccessError:
        # Avoid serializing arbitrary transport/model errors containing mail or tokens.
        return {"status": inbox.store.retry(job, "read_or_classifier_failed")}
    except ValueError:
        return {"status": inbox.store.retry(job, "triage_contract_failed")}


def poll_once(inbox, destination, settings, *, limit=1, message_id=None, classify_fn=codex_classifier, dispatch_fn=None):
    """One foreground cycle; repeated cycles are controlled by the host CLI."""
    if not 1 <= limit <= 20:
        raise ValueError("Cycle limit must be between 1 and 20")
    sync = inbox.sync()
    results, proposals = [], []
    for _ in range(limit):
        result = process_next(inbox, destination, settings, message_id=message_id, classify_fn=classify_fn)
        results.append(result)
        if result["status"] == "no_eligible_job":
            break
    if dispatch_fn:
        # Also resumes pending handoffs left behind by an interrupted previous cycle.
        for _ in range(limit):
            proposal = dispatch_fn()
            proposals.append(proposal)
            if proposal["status"] == "no_pending_handoff":
                break
    return {"sync": sync, "classification": results, "proposals": proposals, **inbox.store.counts()}
