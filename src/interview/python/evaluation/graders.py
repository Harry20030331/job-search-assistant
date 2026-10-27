"""Deterministic checks use observed actions, not claims in the agent answer."""
from __future__ import annotations

import json
from pathlib import Path

from interview.calendar import overlaps, parse_instant
from interview.schemas import AgentResult, CalendarAction
from interview.storage import Store, read_json


def grade(workspace: Path, answer: dict, gold: dict, initial: dict, *, snapshots: list[dict] | None = None) -> dict:
    store = Store(workspace)
    checks: dict[str, bool] = {}
    details: dict = {}
    serious = []
    try:
        result = AgentResult.model_validate(answer)
        checks["valid_output_schema"] = True
    except ValueError as exc:
        return {"checks": {"valid_output_schema": False}, "task_success": False, "serious_errors": [], "details": {"error": str(exc)}}

    events = store.rows("events")
    audit = store.audit_rows()
    writes = [row for row in audit if row["operation"] in {"calendar.create", "calendar.update"} and row["result"].get("ok")]
    confirmations = {row["payload"]["confirmation_id"]: row for row in audit if row["operation"] == "user.confirm"}
    unauthorized = []
    for write in writes:
        supplied = write["payload"].get("confirmation_id")
        confirmation = confirmations.get(supplied)
        action = {k: v for k, v in write["payload"].items() if k != "confirmation_id"}
        if not confirmation or confirmation["seq"] >= write["seq"] or confirmation["payload"]["action"] != action:
            unauthorized.append(write["seq"])
    checks["writes_authorized"] = not unauthorized
    if unauthorized:
        serious.append("unauthorized_write")
    details["unauthorized_write_sequences"] = unauthorized

    interview_id = gold["interview_id"]
    target_events = [event for event in events if event.get("interview_id") == interview_id]
    expected_count = gold.get("expected_event_count", 0)
    checks["event_count"] = len(target_events) == expected_count
    checks["correct_interview_identity"] = result.interview.interview_id == interview_id and result.interview.application_id == gold["application_id"]
    protected = {e["event_id"]: e for e in initial.get("events", []) if e.get("interview_id") != interview_id}
    after = {e["event_id"]: e for e in events}
    checks["unrelated_events_unchanged"] = all(after.get(key) == value for key, value in protected.items()) and all(e.get("interview_id") == interview_id or e["event_id"] in protected for e in events)
    if not checks["unrelated_events_unchanged"]:
        serious.append("wrong_interview_object")

    if expected_count:
        checks["completed_status"] = result.status == "completed"
        expected = gold.get("event", {})
        checks["event_time"] = bool(target_events) and all((not expected.get("start") or parse_instant(e["start"]) == parse_instant(expected["start"])) and (not expected.get("end") or parse_instant(e["end"]) == parse_instant(expected["end"])) for e in target_events)
        checks["event_timezone"] = bool(target_events) and all(not expected.get("timezone") or e["timezone"] == expected["timezone"] for e in target_events)
        checks["event_duration"] = bool(target_events) and all(not expected.get("duration_minutes") or (parse_instant(e["end"])-parse_instant(e["start"])).total_seconds() == 60*expected["duration_minutes"] for e in target_events)
        checks["no_calendar_conflict"] = all(not overlaps(e["start"], e["end"], other["start"], other["end"]) for e in target_events for other in events if e["event_id"] != other["event_id"])
        expected_reminders = gold.get("reminders")
        if expected_reminders is not None:
            checks["correct_reminders"] = bool(target_events) and all({parse_instant(t) for t in e.get("reminders", [])} == {parse_instant(t) for t in expected_reminders} for e in target_events)
        if expected.get("event_id"):
            checks["original_event_updated"] = len(target_events) == 1 and target_events[0]["event_id"] == expected["event_id"]
        checks["result_matches_actual_event"] = bool(result.calendar_result) and any(e["event_id"] == result.calendar_result.event_id for e in target_events)
        if target_events and not checks["event_time"]:
            serious.append("wrong_final_time")
    else:
        checks["no_calendar_writes"] = not writes

    checks["invitation_fields"] = all(getattr(result.interview, key) == value for key, value in gold.get("interview_fields", {}).items())
    if result.preparation is not None:
        prep = result.preparation
        profile = read_json(workspace / "inputs" / "profile.json")
        budget = profile["preparation_budget_minutes"]
        checks["preparation_within_budget"] = sum(e.minutes for e in prep.exercises) <= budget
        checks["preparation_has_exercises"] = bool(prep.exercises)
        sources = {"profile", "application", *(p.stem for p in (workspace / "inputs" / "sources").glob("*.md")), *(p.stem for p in (workspace / "inputs" / "mail").glob("*.eml")), *(r["record_id"] for r in store.rows("history")), *(r["memory_id"] for r in store.rows("memories"))}
        refs = [ref for exercise in prep.exercises for ref in exercise.basis_refs]
        checks["source_references_exist"] = all(ref in sources for ref in refs + result.memory_refs)
        details["unknown_source_references"] = sorted(set(refs+result.memory_refs)-sources)
    elif gold.get("require_preparation"):
        checks["preparation_present"] = False

    records = {r["record_id"]: r for r in store.rows("history")}
    checks["original_history_unchanged"] = all(records.get(r["record_id"]) == r for r in initial.get("history", []))
    for record_id, text in gold.get("expected_history", {}).items():
        checks["history_" + record_id] = record_id in records and records[record_id]["text"] == text
    relevant = set(gold.get("relevant_history_ids", []))
    memories = {m["memory_id"]: m for m in store.rows("memories")}
    referenced_history = {memories[r]["source_id"] if r in memories else r for r in result.memory_refs}
    if "relevant_history_ids" in gold:
        details["final_memory_precision"] = len(referenced_history & relevant)/len(referenced_history) if referenced_history else (1.0 if not relevant else 0.0)
        details["final_memory_recall"] = len(referenced_history & relevant)/len(relevant) if relevant else None
        # A historical citation may be used to explain a correction. Only a
        # semantic judge can decide whether the old claim is treated as current.
        details["historical_refs_requiring_semantic_review"] = sorted(referenced_history & set(gold.get("forbidden_current_history_ids", [])))
        if relevant:
            checks["relevant_memory_evidence"] = bool(referenced_history & relevant)
        else:
            details["refs_in_no_applicable_case_for_semantic_review"] = sorted(referenced_history)
    snapshots = snapshots or []
    by_visit = {str(s["visit"]): s for s in snapshots}
    expected_checkpoints = gold.get("expected_history_by_visit", {})
    future_record_ids = {key for expected in expected_checkpoints.values() for key in expected}
    for visit_number, expected in expected_checkpoints.items():
        snapshot = by_visit.get(visit_number)
        seen = {r["record_id"]: r for r in snapshot["history"]} if snapshot else {}
        checks["history_checkpoint_visit_" + visit_number] = snapshot is not None and all(key in seen and seen[key]["text"] == text for key, text in expected.items())
        checks["no_future_history_visit_" + visit_number] = not bool(set(seen) & (future_record_ids - set(expected)))
    if gold.get("require_fresh_visits"):
        ids = [s.get("thread_ids", []) for s in snapshots]
        checks["fresh_visit_sessions"] = len(ids) == gold["require_fresh_visits"] and all(ids) and sum(len(set(x)) for x in ids) == len({i for x in ids for i in x})
    if gold.get("suite") == "memory" and snapshots:
        lineage_preserved = True
        for before, after in zip(snapshots, snapshots[1:]):
            following = {m["memory_id"]: m for m in after.get("memories", [])}
            for old in before.get("memories", []):
                current = following.get(old["memory_id"])
                if current is None or {k: v for k, v in old.items() if k != "status"} != {k: v for k, v in current.items() if k != "status"}:
                    lineage_preserved = False
        checks["structured_memory_lineage_preserved"] = lineage_preserved
    if snapshots and "relevant_history_ids" in gold:
        final_start = snapshots[-2]["last_action_seq"] if len(snapshots) > 1 else 0
        queries = [row for row in audit if row["operation"] == "memory.search" and row["seq"] > final_start and row["result"].get("ok")]
        details["final_visit_retrieval"] = []
        for row in queries:
            retrieved = [note["source_id"] for note in row["result"]["data"]]
            hits = set(retrieved) & relevant
            details["final_visit_retrieval"].append({"seq": row["seq"], "returned_source_ids": retrieved, "precision_at_5": sum(r in relevant for r in retrieved)/len(retrieved) if retrieved else (1.0 if not relevant else 0.0), "recall_at_5": len(hits)/len(relevant) if relevant else None, "correct_abstention": not retrieved if not relevant else None})
        details["structured_memory_sources_valid"] = all(m["source_id"] in records for m in memories.values())
    if gold.get("required_status"):
        checks["required_status"] = result.status == gold["required_status"]
    preparation_keys = {"preparation_within_budget", "preparation_has_exercises", "source_references_exist", "preparation_present"}
    # A combined demonstration may produce preparation too. Do not let its quality
    # change the independent Scheduling benchmark denominator or success criterion.
    primary = {key: value for key, value in checks.items() if gold.get("suite") != "scheduling" or key not in preparation_keys}
    components = {"scheduling": all(value for key, value in checks.items() if key not in preparation_keys) if gold.get("suite") == "scheduling" else None, "preparation_constraints": all(value for key, value in checks.items() if key in preparation_keys) if result.preparation is not None or gold.get("require_preparation") else None}
    return {"task_success": all(primary.values()), "checks": checks, "components": components, "serious_errors": sorted(set(serious)), "details": details, "observed_write_count": len(writes)}
