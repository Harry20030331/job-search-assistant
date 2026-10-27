"""Consume one durable inbox handoff into a fresh, unapproved live proposal run."""
from pathlib import Path

from interview.agent_runtime import invoke
from evaluation.live import prepare
from interview.calendar import parse_instant
from interview.google_adapter import credential_path
from interview.schemas import AgentResult
from interview.storage import Store, canonical, read_json, write_json
from interview.freshness import attach as attach_source, check as check_source


def propose_handoff(store, config_path, config, run: Path, settings, *, handoff_id=None, invoke_fn=invoke):
    run, config_path = Path(run).resolve(), Path(config_path).resolve()
    if run.exists():
        raise FileExistsError("Use a new proposal run; previous runs are preserved")
    handoff = store.claim_handoff(handoff_id)
    if not handoff:
        return {"status": "no_pending_handoff"}
    key, token = handoff["handoff_id"], handoff["dispatch_token"]
    if handoff["route"] not in {"scheduling_review", "availability_review", "reschedule_review"}:
        store.finish_handoff(key, token, "needs_review", {"reason": "No automatic proposal executor for this route"})
        return {"status": "needs_review", "route": handoff["route"]}
    try:
        private_config = config_path.parent / "handoffs" / key / "config.json"
        data = config.model_dump()
        data.update(gmail_messages={"incoming": handoff["message_id"]},
                    token_file=str(credential_path(config_path, config.token_file)),
                    client_file=str(credential_path(config_path, config.client_file)))
        if private_config.exists():
            if read_json(private_config) != data:
                raise ValueError("Existing immutable handoff configuration differs")
        else:
            write_json(private_config, data)
        work = prepare(private_config.resolve(), run.resolve())
        if handoff.get("source_revision") is not None and handoff["source_revision"] != store.thread_snapshot(handoff["thread_id"])["revision"]:
            raise ValueError("Newer mail superseded this handoff before proposal generation")
        attach_source(Store(work), store, handoff["thread_id"])
        if handoff.get("interview_id"):
            application = read_json(work / "inputs/application.json")
            application["interview_id"] = handoff["interview_id"]
            if handoff.get("existing_workspace"):
                prior_application = read_json(Path(handoff["existing_workspace"]) / "inputs/application.json")
                if prior_application["interview_id"] != handoff["interview_id"]:
                    raise ValueError("Prior workspace and handoff interview identities disagree")
                application["application_id"] = prior_application["application_id"]
            write_json(work / "inputs/application.json", application)
        prompt = ("Read TASK.md, TOOL_GUIDE.md, EXTENSIONS.md and the interview-coordinator skill. This is an incoming-mail queue handoff for route "
                  + handoff["route"] + ". Read the actual allowlisted mail with mail.read and the current context with context.get. Check the live test calendar. "
                  "Do not create or update events: this fresh workspace has no host confirmation. Do not send mail. "
                  "For an unchanged invitation already represented by the same interview ID and exact time, report completed with that existing event ID, confirmation_id=null and proposed_action=null; do not propose a duplicate. "
                  "Otherwise, propose a create/update action only when all required scheduling facts and target identity are known; ask for missing facts or availability as appropriate. "
                  "A reschedule updates the known original event ID. Preserve source_ids from the actual mail. Preparation is null here: this node checks scheduling only. Return AgentResult JSON.")
        (run / "handoff-prompt.txt").write_text(prompt, encoding="utf-8")
        write_json(run / "settings.json", settings)
        write_json(run / "source-handoff.json", {k: v for k, v in handoff.items() if k != "dispatch_token"})
        result = invoke_fn(work, prompt, work / "agent.schema.json", run / "proposal", settings, google_network=True)
        if result["status"] != "completed":
            store.finish_handoff(key, token, "blocked", {"reason": "proposal_invocation_" + result["status"], "run": str(run)})
            return {"status": "blocked", "reason": "proposal_invocation_" + result["status"]}
        accepted = AgentResult.model_validate(result["output"])
        work_store = Store(work)
        check_source(work_store)
        actions = work_store.audit_rows()
        writes = [a for a in actions if a["operation"] in {"calendar.create", "calendar.update", "google.calendar.write_attempt"}]
        reads = [a for a in actions if a["operation"] == "mail.read" and a["result"].get("ok")]
        calendar_reads = [a for a in actions if a["operation"] == "calendar.list" and a["result"].get("ok")]
        if writes or not reads or not calendar_reads or not accepted.interview.source_ids or accepted.preparation is not None:
            raise ValueError("Proposal-only operation or evidence contract failed")
        application = read_json(work / "inputs/application.json")
        if accepted.interview.interview_id != application["interview_id"] or accepted.interview.application_id != application["application_id"]:
            raise ValueError("Proposal returned a different interview identity")
        if not set(accepted.interview.source_ids) <= {source["source_id"] for a in reads for source in a["result"]["data"]}:
            raise ValueError("Proposal cited mail that was not actually read")
        state = "awaiting_user"
        if accepted.status == "completed":
            events = [e for a in calendar_reads for e in a["result"]["data"]]
            existing = [e for e in events if accepted.calendar_result is not None and e["event_id"] == accepted.calendar_result.event_id and e["interview_id"] == application["interview_id"]]
            if not existing or accepted.proposed_action is not None or accepted.calendar_result.confirmation_id is not None:
                raise ValueError("Completion requires an observed existing event, without a new action/approval")
            if accepted.interview.start is None or not any(
                parse_instant(event["start"]) == parse_instant(accepted.interview.start)
                and event["timezone"] == accepted.interview.timezone
                and accepted.interview.duration_minutes is not None
                and (parse_instant(event["end"]) - parse_instant(event["start"])).total_seconds() == 60 * accepted.interview.duration_minutes
                for event in existing):
                raise ValueError("Claimed existing-event time, timezone and duration must match observed state")
            state = "checked_existing"
        elif accepted.status == "blocked":
            state = "blocked"
        elif accepted.status not in {"awaiting_confirmation", "needs_input"}:
            raise ValueError("Unexpected proposal status")
        if accepted.status == "awaiting_confirmation":
            if accepted.proposed_action is None or accepted.proposed_action.interview_id != application["interview_id"]:
                raise ValueError("Awaiting confirmation requires an action for the same interview")
            if handoff["route"] == "reschedule_review" and accepted.proposed_action.operation != "update":
                raise ValueError("Rescheduling must propose updating the original event")
        if accepted.status == "needs_input" and not accepted.questions:
            raise ValueError("Missing information requires a concrete question")
        write_json(run / "accepted.json", accepted.model_dump())
        outcome = {"status": state, "agent_status": accepted.status, "source_mail_read": True,
                   "handoff_id": key,
                   "calendar_read": True, "calendar_write_attempts": len(writes),
                   "existing_event_reused": state == "checked_existing", "run": str(run)}
        store.finish_handoff(key, token, state, outcome)
        write_json(run / "verification.json", outcome)
        return outcome
    except Exception:
        store.finish_handoff(key, token, "blocked", {"reason": "proposal_setup_or_validation_failed", "run": str(run)})
        # Preserve private diagnostics/output; never print raw API/token/mail errors.
        return {"status": "blocked", "reason": "proposal_setup_or_validation_failed"}
