"""Reproducible virtual-mail integration checks and optional real Codex triage."""
from __future__ import annotations

import argparse
import base64
import copy
import hashlib
import json
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

from evaluation.virtual_services import VirtualMailbox, VirtualCalendar
from interview.context_flow import isolated_output
from interview.google_adapter import GoogleAccessError, GoogleAdapter, GoogleConfig, GoogleHTTPError
from interview.inbox import GmailInbox, InboxStore
from interview.inbox_worker import codex_classifier, process_next
from interview.schemas import CalendarAction
from interview.settings import load_settings
from interview.storage import Store, canonical, digest, read_json, write_json
from interview.triage import TriageNode

ROOT = Path(__file__).resolve().parents[1]


def scripted_classifier(case):
    def classify(mail, destination, settings):
        latest = next(message for message in mail.messages if message.source_id == mail.latest_source_id)
        return TriageNode.model_validate({"status": "ready", "questions": [], "triage": {
            "latest_source_id": latest.source_id, "category": case["category"],
            "interview_id": case["bindings"][0] if len(case["bindings"]) == 1 else None,
            "evidence": [{"source_id": latest.source_id, "quote": latest.body.splitlines()[0]}],
            "unknowns": [], "rationale": "Evaluator scripted response for infrastructure verification only."}})
    return classify


def mail_case(case, output, *, live=False, settings=None):
    output.mkdir(parents=True, exist_ok=False)
    address = case["id"].lower() + "@virtual.example.invalid"
    mailbox = VirtualMailbox(address)
    if case.get("prior"): mailbox.deliver("prior", case["prior"], subject=case["subject"])
    mailbox.deliver("latest", case["body"], subject=case["subject"], html=case.get("html", False))
    for key, resource in mailbox.messages_by_id.items():
        raw = resource["raw"]
        (output / (key + ".eml")).write_bytes(base64.urlsafe_b64decode(raw + "=" * (-len(raw) % 4)))
    store = InboxStore(output / "inbox.sqlite3", address)
    for interview in case["bindings"]: store.bind("thread-1", interview)
    inbox = GmailInbox(store, mailbox)
    sync = inbox.sync()
    started = time.monotonic()
    result = process_next(inbox, output / "attempts", settings or {}, message_id="latest",
                          classify_fn=codex_classifier if live else scripted_classifier(case))
    with store.connect() as db:
        row = db.execute("SELECT result,error_code FROM jobs WHERE message_id='latest'").fetchone()
        accepted = json.loads(row[0]) if row[0] else None
        handoffs = [json.loads(r[0]) for r in db.execute("SELECT payload FROM handoffs WHERE message_id='latest'")]
    predicted = accepted["effective_triage"] if accepted else None
    checks = {"valid_classification": predicted is not None,
        "category": bool(predicted and predicted["category"] == case["category"]),
        "route": result.get("route") == case["route"],
        "association": bool(predicted and predicted["interview_id"] == (case["bindings"][0] if len(case["bindings"]) == 1 else None)),
        "no_implicit_calendar_or_preparation_permission": all(not h.get("calendar_write_authorized") and not h.get("full_preparation_authorized") for h in handoffs),
        "no_mail_mutation": all(call["operation"] in {"profile", "messages.get", "messages.list", "history.list", "threads.get"} for call in mailbox.calls)}
    if case.get("html") and accepted:
        context, _ = inbox.context("latest")
        body = context["input"]["messages"][-1]["body"]
        checks["html_assets_and_scripts_not_exposed"] = all(fragment not in body for fragment in ("untrusted_tracking", "tracking.example.invalid", ".hidden"))
    # Re-delivery, new host instance and another history scan must not process a
    # completed message twice. Other old-thread jobs can remain deliberately queued.
    before = store.counts()
    mailbox.deliver("latest", case["body"])
    restarted = GmailInbox(InboxStore(store.path, address), mailbox)
    repeated = restarted.sync()
    duplicate = process_next(restarted, output / "duplicate-attempts", {}, message_id="latest",
                             classify_fn=lambda *args: (_ for _ in ()).throw(AssertionError("Duplicate classifier call")))
    checks["duplicate_delivery_and_restart"] = repeated["new_jobs"] == 0 and duplicate["status"] == "no_eligible_job" and store.counts() == before
    invocations = [read_json(path) for path in output.glob("attempts/*/response/invocation.json")]
    invocation = [{key: value.get(key) for key in ("status", "seconds", "usage", "model", "cli_version", "thread_id", "shell_command_count")} for value in invocations]
    record = {"case_id": case["id"], "mode": "real_codex_virtual_transport" if live else "scripted_infrastructure_only",
        "status": result["status"], "passed": all(checks.values()), "checks": checks,
        "expected_category": case["category"], "predicted_category": predicted["category"] if predicted else None,
        "raw_model_interview_id": accepted["raw_triage"]["interview_id"] if accepted else None,
        "effective_interview_id": predicted["interview_id"] if predicted else None, "expected_route": case["route"],
        "route": result.get("route"), "safe_error_code": row[1], "seconds": round(time.monotonic()-started, 3),
        "model_calls": len(invocations), "invocations": invocation, "real_google_calls": 0, "quality_judge_calls": 0,
        "manual_follow_up": case["route"] in {"cancellation_review", "logistics_review", "needs_review"}}
    write_json(output / "result.json", record)
    write_json(output / "virtual-transport.json", {"sync": sync, "resources": mailbox.messages_by_id, "calls": mailbox.calls})
    return record


def infrastructure(output):
    output.mkdir(parents=True)
    checks = {}
    mailbox = VirtualMailbox()
    for index in range(5): mailbox.deliver(str(index), "Fictional message " + str(index), thread="thread-" + str(index))
    inbox_store = InboxStore(output / "inbox.sqlite3", mailbox.address)
    inbox = GmailInbox(inbox_store, mailbox)
    first = inbox.sync()
    checks["bootstrap_pagination"] = first["pages"] == 3 and first["new_jobs"] == 5
    mailbox.deliver("new", "Fictional later arrival", thread="new-thread")
    checks["incremental_history"] = inbox.sync()["new_jobs"] == 1
    cursor = inbox_store.cursor()
    mailbox.failures["history.list"] = [503]
    try: inbox.sync(); checks["failed_sync_preserves_cursor"] = False
    except GoogleHTTPError: checks["failed_sync_preserves_cursor"] = inbox_store.cursor() == cursor
    mailbox.failures["history.list"] = [404]
    checks["expired_history_recovers_without_duplicates"] = inbox.sync()["mode"] == "expired_cursor_recovery" and inbox_store.counts()["jobs"].get("pending") == 6
    wrong = VirtualMailbox("other@virtual.example.invalid")
    try: GmailInbox(inbox_store, wrong).sync(); checks["wrong_account_blocked"] = False
    except GoogleAccessError: checks["wrong_account_blocked"] = not any(call["operation"] == "messages.list" for call in wrong.calls)

    now = datetime(2030, 10, 20, 12, tzinfo=timezone.utc)
    store = Store(output / "calendar-work"); store.initialize({"clock": now.isoformat()})
    calendar = VirtualCalendar()
    config = GoogleConfig(expected_account=mailbox.address, calendar_id="virtual-secondary@group.calendar.google.com", namespace="virtual-mailbox-v1")
    adapter = GoogleAdapter(store, config, mailbox, calendar, now=lambda: now)
    action = CalendarAction(operation="create", interview_id="cedar-round-1", event_id=None, title="Fictional Cedar technical interview",
        start="2030-11-01T10:00:00-07:00", end="2030-11-01T11:00:00-07:00", timezone="America/Los_Angeles", reminder_minutes=[1440,60])
    def confirm(proposed, etag=None):
        return store.confirm({"origin": "synthetic_test_script", "backend_binding": config.binding(), "action": proposed.model_dump(), "expected_etag": etag})
    try: adapter.apply("calendar.create", {**action.model_dump(), "confirmation_id": "not-confirmed"}); checks["no_unapproved_calendar_write"] = False
    except GoogleAccessError: checks["no_unapproved_calendar_write"] = not calendar.remote
    approval = confirm(action)
    created = adapter.apply("calendar.create", {**action.model_dump(), "confirmation_id": approval})
    reused = adapter.apply("calendar.create", {**action.model_dump(), "confirmation_id": approval})
    checks["single_create_readback_and_idempotency"] = created["event_id"] == reused["event_id"] and reused["idempotent_reuse"] and sum(c["operation"] == "insert" for c in calendar.calls) == 1
    checks["timezone_and_reminders"] = created["timezone"] == action.timezone and created["start"] == "2030-11-01T17:00:00+00:00" and len(created["reminders"]) == 2
    changed = action.model_copy(update={"operation": "update", "event_id": created["event_id"], "start": "2030-11-04T10:00:00-08:00", "end": "2030-11-04T11:00:00-08:00"})
    updated = adapter.apply("calendar.update", {**changed.model_dump(), "confirmation_id": confirm(changed, '"v1"')})
    checks["reschedule_same_event_across_dst"] = updated["event_id"] == created["event_id"] and updated["start"] == "2030-11-04T18:00:00+00:00" and len(calendar.remote) == 1
    raced = changed.model_copy(update={"title": "Fictional changed title"})
    calendar.concurrent_edit = True
    try: adapter.apply("calendar.update", {**raced.model_dump(), "confirmation_id": confirm(raced, '"v2"')}); checks["concurrent_edit_blocks_update"] = False
    except GoogleHTTPError as error: checks["concurrent_edit_blocks_update"] = error.status == 412 and calendar.remote[created["event_id"]]["summary"] == changed.title
    calendar.concurrent_edit = False
    busy = copy.deepcopy(calendar.remote[created["event_id"]]); busy.update(id="unrelated-busy", summary="Unrelated appointment")
    calendar.remote["unrelated-busy"] = busy
    conflict = changed.model_copy(update={"operation": "create", "event_id": None, "interview_id": "another-round"})
    writes = sum(c["operation"] == "insert" for c in calendar.calls)
    try: adapter.apply("calendar.create", {**conflict.model_dump(), "confirmation_id": confirm(conflict)}); checks["busy_conflict_blocks_create"] = False
    except GoogleAccessError: checks["busy_conflict_blocks_create"] = sum(c["operation"] == "insert" for c in calendar.calls) == writes
    checks["no_attendee_invitations"] = all(call["arguments"].get("sendUpdates") == "none" for call in calendar.calls if call["operation"] in {"insert", "patch"})
    result = {"checks": checks, "passed": all(checks.values()), "real_google_calls": 0, "model_calls": 0,
              "note": "Host-scripted actions and confirmations verify actual adapter mechanics; not model extraction or real Google transport."}
    write_json(output / "result.json", result); write_json(output / "virtual-calendar.json", {"events": calendar.remote, "calls": calendar.calls})
    return result


def run(output, *, live=False, selected=None):
    output = Path(output).resolve(); isolated_output(output); output.mkdir(parents=True, exist_ok=False)
    source = ROOT / "benchmark/virtual-mailbox-v1/cases.json"
    suite, settings = read_json(source), load_settings()
    cases = [case for case in suite["cases"] if not selected or case["id"] in selected]
    if not cases or (selected and set(selected) != {case["id"] for case in cases}): raise ValueError("Unknown virtual-mail case")
    write_json(output / "dataset.json", suite)
    names = ["evaluation/virtual_mailbox.py", "evaluation/virtual_services.py", "interview/inbox.py", "interview/inbox_worker.py", "interview/google_adapter.py", "interview/triage.py", "interview/agent_runtime.py"]
    hashes = {}
    for name in names:
        raw = (ROOT / name).read_bytes(); hashes[name] = hashlib.sha256(raw).hexdigest()
        target = output / "implementation" / name; target.parent.mkdir(parents=True, exist_ok=True); target.write_bytes(raw)
    write_json(output / "manifest.json", {"protocol": suite["protocol"], "selected": [case["id"] for case in cases], "mode": "live_classifier" if live else "scripted",
        "settings": settings, "dataset_hash": hashlib.sha256(source.read_bytes()).hexdigest(), "implementation_hashes": hashes,
        "automatic_retries": 0, "source_contexts": 1, "human_label_review": "pending", "real_google_calls": 0})
    infra = infrastructure(output / "infrastructure")
    records = []
    for case in cases:
        try: record = mail_case(case, output / case["id"], live=live, settings=settings)
        except Exception as error:
            record = {"case_id": case["id"], "status": "execution_failed", "passed": False, "safe_error_type": type(error).__name__, "model_calls": 0}
            write_json(output / case["id"] / "failure.json", record)
        records.append(record)
        summary = {"protocol": suite["protocol"], "mode": "live_classifier" if live else "scripted", "attempted": len(records),
            "passed": sum(record["passed"] for record in records), "infrastructure": infra, "records": records,
            "model_calls": sum(record["model_calls"] for record in records), "real_google_calls": 0,
            "limitations": [suite["provenance"], "Not an independent holdout or a real Gmail/OAuth test.", "Cancellation/logistics/ambiguous updates remain review routes, not automatic calendar changes.", "Calendar actions and acceptance are host-scripted; classifier quality is separate from deterministic infrastructure."]}
        write_json(output / "summary.json", summary)
        lines = ["# Virtual mailbox verification", "", f"Mode: {summary['mode']}. Mail scenarios: {summary['passed']}/{summary['attempted']} passed. Infrastructure: {sum(infra['checks'].values())}/{len(infra['checks'])} checks.", "", "| Case | Status | Category | Route | Passed |", "| --- | --- | --- | --- | --- |"]
        lines += [f"| {r['case_id']} | {r['status']} | {r.get('predicted_category')} | {r.get('route')} | {r['passed']} |" for r in records]
        lines += ["", "## Limits", "", *["- " + note for note in summary["limitations"]]]
        (output / "report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
        print(canonical({key: record.get(key) for key in ("case_id", "status", "passed", "model_calls", "seconds")}), flush=True)
    return summary


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--live-classifier", action="store_true")
    parser.add_argument("--case", action="append")
    args = parser.parse_args()
    summary = run(args.output, live=args.live_classifier, selected=args.case)
    print(canonical({key: summary[key] for key in ("attempted", "passed", "model_calls", "real_google_calls")}))
    if summary["passed"] != summary["attempted"] or not summary["infrastructure"]["passed"]:
        raise SystemExit(1)


if __name__ == "__main__": main()
