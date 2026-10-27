"""Materialize the six initial development cases, never a hidden test set.

Synthetic data authored with AI assistance; human rubric review remains pending.
The gold files are host-only and are not copied into agent workspaces.
"""
from __future__ import annotations

import copy
from pathlib import Path

from interview.storage import write_json

ROOT = Path(__file__).resolve().parent / "dev"


def make(case_id: str, suite: str, *, role="backend_swe", missing_timezone=False, short_budget=False, no_memory=False):
    directory = ROOT / case_id
    directory.mkdir(parents=True, exist_ok=True)
    inputs = directory / "inputs"
    (inputs / "mail").mkdir(parents=True, exist_ok=True)
    (inputs / "sources").mkdir(exist_ok=True)
    application = {"application_id": "app-cedar-"+case_id.lower(), "company": "Cedar Labs (fictional)", "role": role, "jd_source_id": "jd", "resume_version": "synthetic-v1", "interview_id": "interview-"+case_id.lower(), "round": "system_design" if role == "backend_swe" else "ml_evaluation"}
    if short_budget:
        application["round"] = None
    profile = {"source_id": "profile", "name": "Alex Example (fictional)", "timezone": "America/Los_Angeles", "preparation_budget_minutes": 20 if short_budget else 90, "projects": [{"name": "QueueLab", "description": "Built a toy task queue with retry and deduplication; compared throughput under bursty load.", "confirmed_metrics": [] if short_budget else ["Measured throughput on synthetic load; no production scale claim."]}], "availability_windows": [{"start": "2026-10-27T13:00:00+00:00", "end": "2026-10-27T23:00:00+00:00"}]}
    if role == "ml_engineer":
        profile["projects"] = [{"name": "EvalLab", "description": "Compared classifiers on a synthetic imbalanced dataset, using precision and recall.", "confirmed_metrics": []}]
    jd = "Cedar Labs is a fictional company. Backend SWE responsibilities: reliable queues, retries, idempotency, capacity estimation and explaining design tradeoffs."
    if role == "ml_engineer":
        jd = "Cedar Labs is a fictional company. ML engineer responsibilities: dataset splits, leakage prevention, imbalanced classification metrics and error analysis."
    (inputs / "sources" / "jd.md").write_text(jd+"\n", encoding="utf-8")
    round_text = "A 45-minute system-design interview. Discuss a queue service, reliability and capacity estimates. Actual questions are not confirmed."
    if role == "ml_engineer":
        round_text = "A 45-minute discussion of model evaluation and data leakage. Actual questions are not confirmed."
    if short_budget:
        round_text = "The recruiter has not confirmed the interview format. Do not assume an interview question list."
    (inputs / "sources" / "round.md").write_text(round_text+"\n", encoding="utf-8")
    time_text = "10:00 AM America/Los_Angeles (UTC-07:00)" if not missing_timezone else "10:00 AM (timezone was accidentally omitted)"
    round_label = application["round"] or "upcoming"
    email = f"From: recruiter@example.invalid\nTo: alex@example.invalid\nSubject: Cedar Labs interview {case_id}\nMessage-ID: <{case_id.lower()}@example.invalid>\nDate: Mon, 19 Oct 2026 09:00:00 -0700\nMIME-Version: 1.0\nContent-Type: text/plain; charset=utf-8\n\nWe invite you to the {round_label} interview on Tuesday, October 27, 2026 at {time_text}. It lasts 45 minutes. Application: {application['application_id']}. Please confirm before placing it on your calendar.\n"
    if short_budget:
        email += "The interview format and actual questions have not been confirmed.\n"
    (inputs / "mail" / "invite.eml").write_text(email, encoding="utf-8")
    write_json(inputs / "application.json", application)
    write_json(inputs / "profile.json", profile)
    initial = {"clock": "2026-10-19T16:00:00+00:00", "events": [{"event_id": "existing-class", "interview_id": None, "title": "Class", "start": "2026-10-27T16:00:00+00:00", "end": "2026-10-27T16:30:00+00:00", "timezone": "America/Los_Angeles"}], "history": []}
    script = {"confirm": True, "facts": {"timezone": "America/New_York"} if missing_timezone else {}}
    task = "Process the invitation: clarify critical unknowns, check the calendar, ask me to confirm the exact event, then create it with reminders and save a reply draft. Also prepare a concise interview practice plan within my time budget using the supplied sources."
    visits = [{"clock": initial["clock"], "message": "Please handle my invitation and prepare me for this interview.", "user_script": script}]
    gold = {"suite": suite, "interview_id": application["interview_id"], "application_id": application["application_id"], "expected_event_count": 1 if suite == "scheduling" else 0, "interview_fields": {"duration_minutes": 45}, "require_preparation": True, "rubric_notes": ["Only claim candidate facts found in profile; suggestions are not confirmed questions.", "Prioritize capacity estimation and queue reliability for backend, or leakage and evaluation metrics for ML."]}
    if suite == "scheduling":
        start, end, zone = ("2026-10-27T14:00:00+00:00", "2026-10-27T14:45:00+00:00", "America/New_York") if missing_timezone else ("2026-10-27T17:00:00+00:00", "2026-10-27T17:45:00+00:00", "America/Los_Angeles")
        gold["event"] = {"start": start, "end": end, "timezone": zone, "duration_minutes": 45}
        gold["reminders"] = [start.replace("27T", "26T"), start.replace("14:00", "13:00").replace("17:00", "16:00")]
    if suite == "preparation":
        task = "Generate a source-grounded preparation plan only. Do not schedule or write calendar events. If the round is unknown, state the uncertainty and provide a provisional plan using confirmed information."
        visits[0]["message"] = task
        visits[0]["user_script"]["facts"]["other"] = "The recruiter has not provided additional details. Please use confirmed information and clearly mark a provisional plan."
        if short_budget:
            gold["interview_fields"] = {"round": None}
            gold["rubric_notes"].append("Only 20 minutes available; do not invent project numbers or a confirmed round.")
    if suite == "memory":
        task = "Across separate visits, preserve my raw debriefs and use relevant current experience to prepare for a later interview. Do not write any calendar event in this task."
        initial["events"] = []
        initial["history"] = [{"record_id": "old-project", "created_at": "2026-10-01T16:00:00+00:00", "text": "In a backend project-story interview, I could not clearly distinguish my contribution from the team's."}]
        initial["history"] += [{"record_id": f"background-{i:02d}", "created_at": "2026-10-02T16:00:00+00:00", "text": f"Frontend practice note {i}: I practiced CSS spacing and color choices. This is not an ML or backend weakness."} for i in range(10)]
        first = "In the backend system-design interview I struggled with capacity estimation. I need to practice requests per second and storage estimates."
        second = "My backend project-story explanation has improved after practice. Do not treat unclear personal contribution as my current main weakness. Capacity estimation still needs work."
        if no_memory:
            first = "I practiced frontend CSS spacing. This note applies only to frontend UI interviews."
            second = "My old backend project-story issue is resolved. There is no current debrief about ML evaluation."
        visits = [
            {"clock": "2026-10-19T16:00:00+00:00", "message": "Save this raw debrief verbatim with record_id=debrief-1 and created_at=2026-10-19T16:00:00+00:00: " + first},
            {"clock": "2026-10-20T16:00:00+00:00", "message": "Save this raw update verbatim with record_id=debrief-2 and created_at=2026-10-20T16:00:00+00:00: " + second},
            {"clock": "2026-10-21T16:00:00+00:00", "message": "Prepare for the upcoming interview using JD, round and profile. Use relevant current history, respect corrections, and do not schedule anything."},
        ]
        gold["expected_history"] = {"debrief-1": first, "debrief-2": second}
        gold["expected_history_by_visit"] = {"1": {"debrief-1": first}, "2": {"debrief-1": first, "debrief-2": second}}
        gold["require_fresh_visits"] = 3
        gold["relevant_history_ids"] = [] if no_memory else ["debrief-1", "debrief-2"]
        gold["forbidden_current_history_ids"] = ["old-project"]
        gold["rubric_notes"].append("For M01, prioritize capacity estimation; do not keep treating the corrected project-story issue as current. For M02, do not force unrelated frontend/backend history into ML preparation.")
    spec = {"case_id": case_id, "suite": suite, "task": task, "visits": visits, "user_script": script, "provenance": {"kind": "synthetic_with_ai_assistance", "human_review": "pending", "development_only": True}}
    if short_budget:
        spec["provenance"]["fixture_revision"] = 2
        spec["provenance"]["revision_note"] = "Before the first P02 live run, removed the confirmed round from application and mail so missing-round evidence is consistent across sources."
    write_json(directory / "case.json", spec)
    write_json(directory / "initial_state.json", initial)
    write_json(directory / "gold.json", gold)


def main():
    make("S01", "scheduling")
    make("S02", "scheduling", missing_timezone=True)
    make("P01", "preparation")
    make("P02", "preparation", short_budget=True)
    make("M01", "memory")
    make("M02", "memory", role="ml_engineer", no_memory=True)
    print("Created six initial development cases. No midpoint holdout cases were generated.")


if __name__ == "__main__":
    main()
