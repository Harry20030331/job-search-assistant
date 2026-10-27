"""Create versioned fictional development episodes; never overwrite reviewed cases."""
import copy
import shutil
from pathlib import Path

from interview.storage import read_json, write_json

ROOT = Path(__file__).resolve().parents[1]


def create(destination=None):
    target = destination or ROOT / "benchmark/workflow-v1"
    target.mkdir(parents=True, exist_ok=False)
    definitions = [
        ("W01", "triage", "Ordinary mail must not trigger scheduling", "T01", {}),
        ("W02", "triage", "A rejection reply is not a new invitation", "T04", {}),
        ("W03", "triage", "Ambiguous interview identity requires review", "T16", {}),
        ("W04", "scheduling", "Confirmed invitation creates one exact event", "S01", {"confirm": True, "facts": {}}),
        ("W05", "scheduling", "Missing timezone must be clarified", "S02", {"confirm": True, "facts": {"timezone": "America/New_York"}}),
        ("W06", "scheduling", "Declined calendar action leaves state unchanged", "S01", {"confirm": False, "facts": {}}),
        ("W07", "preparation", "Accept current proposal before materials", "P01", {"decision": "accept"}),
        ("W08", "preparation", "Budget revision requires a replacement proposal", "P01", {"decision": "revise", "new_budget": 20}),
        ("W09", "preparation", "Rejected proposal produces no full materials", "P02", {"decision": "reject"}),
        ("W10", "debrief", "Preserve user report and separate practice suggestions", "P01", {}),
        ("W11", "debrief", "A correction resolves only the reported issue", "P01", {}),
        ("W12", "lifecycle", "Invitation to next-session preparation", "S01", {"confirm": True, "facts": {}, "decision": "accept"}),
    ]
    manifest = {"protocol": "interview-workflow-v1", "split": "developer-pilot", "human_review": "pending",
                "provenance": "AI-assisted fictional developer scenarios; not held-out or independent human labels", "cases": []}
    for case_id, module, title, source_id, script in definitions:
        case = target / case_id
        case.mkdir()
        spec = {"case_id": case_id, "suite": module, "title": title, "user_script": script,
                "public_task": "Handle this fictional interview task using the supplied evidence. Keep unknown facts explicit.",
                "provenance": {"fictional": True, "human_review": "pending", "development_only": True}}
        if module == "triage":
            source = ROOT / "benchmark/dev/mail-triage" / source_id
            shutil.copyfile(source / "input.json", case / "input.json")
            gold = read_json(source / "gold.json")
        else:
            source = ROOT / "benchmark/dev" / source_id
            shutil.copytree(source / "inputs", case / "inputs")
            initial = read_json(source / "initial_state.json")
            initial["history"] = []
            write_json(case / "initial_state.json", initial)
            gold = copy.deepcopy(read_json(source / "gold.json"))
            gold["require_preparation"] = False
            spec["public_task"] = {"scheduling": "Read the invitation, check the calendar, clarify missing critical details and request confirmation before the exact event. Use reminders of 1440 and 60 minutes. Do not prepare interview materials in this phase.",
                "preparation": "Prepare for the supplied interview within the candidate's budget. First propose a sourced outline and wait for my decision before full practice materials.",
                "debrief": "Record the supplied interview/practice debrief faithfully. Separate reported facts and self-assessment from suggested practice.",
                "lifecycle": "Handle the supplied interview invitation, then prepare after my plan decision, record my practice debrief and prepare for the next session."}[module]
            if case_id == "W06":
                gold["expected_event_count"] = 0
                gold.pop("event", None)
                gold.pop("reminders", None)
            if module in {"debrief", "lifecycle"}:
                spec["debriefs"] = [{"record_id": case_id + "-report", "interview_id": "fictional-past-practice", "occurred_at": "2026-10-17T16:00:00+00:00",
                    "mode": "practice", "origin": "synthetic_test_script", "subject": {"company": None, "role": "backend_swe", "round": None},
                    "text": "In practice I could not explain why retrying a task can duplicate its effects. I also lost the structure of my QueueLab project story. No interviewer feedback was provided."}]
                gold["expected_topics"] = ["idempotency", "project_story"]
                if case_id == "W11":
                    spec["debriefs"].append({**spec["debriefs"][0], "record_id": case_id + "-correction", "occurred_at": "2026-10-18T16:00:00+00:00",
                        "text": "In today's practice I explained duplicate task effects and idempotency correctly. I still lost the structure of my QueueLab project story. This is my own assessment, not interviewer feedback."})
                    gold["expect_resolution"] = True
            gold["rubric_notes"] = ["Only supplied fictional candidate facts are evidence.", "Suggested exercises are not employer-confirmed questions.", "A self-report does not establish objective ability or interviewer feedback."]
        write_json(case / "case.json", spec)
        write_json(case / "gold.json", gold)
        manifest["cases"].append({"case_id": case_id, "module": module, "title": title})
    write_json(target / "manifest.json", manifest)
    return target


if __name__ == "__main__":
    print(create())
