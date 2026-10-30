"""Run one development case in a fresh workspace; no gold enters the agent prompt."""
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import sys
import time
import uuid
from pathlib import Path

from evaluation import agent, judge
from evaluation.graders import grade
from interview.schemas import AgentResult, strict_schema
from interview.storage import Store, canonical, read_json, write_json

ROOT = Path(__file__).resolve().parents[1]


def source_hashes(workspace: Path) -> dict:
    paths = [*workspace.glob("interview/*.py"), *[p for p in (workspace / "inputs").rglob("*") if p.is_file()], *workspace.glob(".agents/skills/*/SKILL.md"), workspace / "TOOL_GUIDE.md", workspace / "TASK.md", workspace / "EXTENSIONS.md", workspace / "agent.schema.json"]
    return {str(p.relative_to(workspace)): hashlib.sha256(p.read_bytes()).hexdigest() for p in paths}


def implementation_hashes() -> dict:
    paths = [*ROOT.glob("interview/*.py"), *ROOT.glob("evaluation/*.py"), *ROOT.glob("evaluation/rubrics/*.md"), ROOT / "evaluation/tool_guide.md", ROOT / "skills/interview-coordinator/SKILL.md", ROOT / "configs/midpoint.toml"]
    return {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(paths)}


def prepare_workspace(case: Path, group: str, run: Path) -> tuple[Path, dict, dict]:
    if group not in {"A", "B", "C", "D"}:
        raise ValueError("Unknown experimental group")
    spec = read_json(case / "case.json")
    initial = read_json(case / "initial_state.json")
    workspace = run / "work"
    workspace.mkdir(parents=True, exist_ok=False)
    shutil.copytree(case / "inputs", workspace / "inputs")
    shutil.copytree(ROOT / "interview", workspace / "interview", ignore=shutil.ignore_patterns("__pycache__"))
    shutil.copyfile(ROOT / "evaluation" / "tool_guide.md", workspace / "TOOL_GUIDE.md")
    write_json(workspace / "agent.schema.json", strict_schema(AgentResult))
    Store(workspace).initialize(initial, group)
    if group != "A":
        skill = workspace / ".agents" / "skills" / "interview-coordinator"
        skill.mkdir(parents=True)
        shutil.copyfile(ROOT / "skills" / "interview-coordinator" / "SKILL.md", skill / "SKILL.md")
    extensions = []
    if group in {"C", "D"}:
        extensions.append("Use workflow.load/save/check for explicit interview state. Persist scheduling and preparation substates. Before calendar changes, check the exact confirmed action, conflicts and duplicate identity; only execute a ready action. Save the resulting event_id and outstanding items.")
    if group == "D":
        extensions.append("After history.append, structure the debrief with memory.upsert using raw record_id as source. Preserve revisions with supersedes_id and resolved status; never rewrite the original user facts. Historical company and round describe the original debrief, not the upcoming application: use null when the debrief does not establish them. Do not copy the current application's company into an unattributed past interview. Keep distinct issues separate when their status differs. At a later visit, retrieve relevant valid experience with memory.search and use its evidence to adjust the plan. Raw history remains available for verification.")
    (workspace / "EXTENSIONS.md").write_text("\n\n".join(extensions) or "No workflow or structured-memory extension in this group. Raw history is available.", encoding="utf-8")
    (workspace / "TASK.md").write_text("# Tool runtime\n\nPython executable: " + str(Path(sys.executable).resolve()) + "\n\nRead TOOL_GUIDE.md for operation payloads. Return the requested JSON output contract.\n", encoding="utf-8")
    return workspace, spec, initial


def prompt_for(spec: dict, visit: dict, transcript: list[dict], group: str) -> str:
    common = "You are an interview coordination assistant. Complete the user's task using the local tools and supplied evidence. Respect user constraints; clarify critical unknowns. Obtain explicit confirmation before calendar changes, and do not invent user or company facts. Read TASK.md and TOOL_GUIDE.md for runtime and input contracts. Do not inspect parent directories, evaluator files, credentials, or unrelated personal configuration. Do not alter tool source, database directly, or host confirmation records. Use the scenario clock, not the machine clock. Preserve user-provided debriefs through the history tool when asked. Return the complete structured result.\n"
    if group != "A":
        common += "Use the interview-coordinator skill in .agents/skills/interview-coordinator/SKILL.md and read EXTENSIONS.md.\n"
    # The host's future replies are evaluator state, not facts already known to
    # the agent. In particular, never reveal a missing timezone or confirmation.
    public_visit = {key: visit[key] for key in ("clock", "message") if key in visit}
    return common + "\nPUBLIC TASK AND CURRENT VISIT:\n" + canonical({"task": spec["task"], "visit": public_visit}) + "\nPUBLIC DIALOGUE FOR THIS VISIT:\n" + canonical(transcript)


def render_preparation(workspace: Path, answer: AgentResult):
    if answer.preparation is None:
        return
    prep = answer.preparation
    write_json(workspace / "artifacts" / "preparation.json", prep.model_dump())
    lines = ["# Interview preparation", "", prep.summary, ""]
    for exercise in prep.exercises:
        lines.extend([f"## {exercise.topic} ({exercise.minutes} min)", "", exercise.method, "", "Sources: " + ", ".join(exercise.basis_refs), ""])
    lines.extend(["## Uncertainties", "", *["- " + u for u in prep.unknowns], "", "## Prior experience", "", prep.memory_impact])
    (workspace / "artifacts" / "preparation.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def user_reply(result: AgentResult, script: dict, store: Store, asked: set[str]) -> tuple[dict, int]:
    if result.status == "awaiting_confirmation":
        if result.proposed_action is None:
            raise ValueError("awaiting_confirmation requires an exact proposed_action")
        if script.get("confirm", True):
            action = result.proposed_action.model_dump()
            confirmation_id = store.confirm(action)
            return {"role": "user", "content": {"confirmed": True, "confirmation_id": confirmation_id, "exact_action": action}}, 0
        return {"role": "user", "content": {"confirmed": False, "instruction": "Do not write the calendar."}}, 0
    facts = script.get("facts", {})
    answers, repeated = {}, 0
    for question in result.questions:
        if question.field not in facts:
            raise LookupError("environment_gap: no scripted fact for " + question.field)
        repeated += int(question.field in asked)
        asked.add(question.field)
        answers[question.field] = facts[question.field]
    if not answers:
        raise ValueError("needs_input requires at least one question")
    return {"role": "user", "content": answers}, repeated


def build_judge_packet(workspace: Path, spec: dict, answer: dict, gold: dict, transcripts: list[dict]) -> dict:
    store = Store(workspace)
    sources = {p.stem: p.read_text(encoding="utf-8") for p in (workspace / "inputs" / "sources").glob("*.md")}
    return {"suite": spec["suite"], "current_visit_input": {"task": spec["task"], "profile": read_json(workspace / "inputs" / "profile.json"), "application": read_json(workspace / "inputs" / "application.json"), "public_dialogue": transcripts}, "sources": sources, "raw_history": store.rows("history"), "candidate_output": answer, "observed_actions": store.audit_rows(), "rubric_notes": gold.get("rubric_notes", [])}


def run_case(case: Path, group: str, run: Path, *, with_judge=False) -> dict:
    case = case.resolve()
    run = run.resolve()
    run.mkdir(parents=True, exist_ok=False)
    settings = judge.config()
    spec_snapshot = read_json(case / "case.json")
    gold = read_json(case / "gold.json")
    write_json(run / "case_snapshot.json", spec_snapshot)
    write_json(run / "gold_snapshot.json", gold)
    manifest = {"case_id": spec_snapshot["case_id"], "group": group, "status": "starting", "model": settings["agent_model"], "case_sha256": hashlib.sha256(canonical({p.relative_to(case).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest() for p in case.rglob("*") if p.is_file()}).encode()).hexdigest(), "run_path": str(run)}
    implementation = implementation_hashes()
    write_json(run / "implementation_hashes.json", implementation)
    write_json(run / "settings_snapshot.json", settings)
    for relative in implementation:
        destination = run / "implementation_snapshot" / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / relative, destination)
    manifest["implementation_sha256"] = hashlib.sha256(canonical(implementation).encode()).hexdigest()
    write_json(run / "manifest.json", manifest)
    status = agent.login_status()
    if not status["logged_in"]:
        manifest.update({"status": "access_blocked", "error": status["reason"]})
        write_json(run / "manifest.json", manifest)
        return manifest
    workspace, spec, initial = prepare_workspace(case, group, run)
    write_json(run / "initial_state_snapshot.json", initial)
    frozen = source_hashes(workspace)
    write_json(run / "source_hashes.json", frozen)
    store = Store(workspace)
    all_transcripts = []
    snapshots = []
    repeated_questions = 0
    last = None
    started = time.monotonic()
    try:
        for visit_number, visit in enumerate(spec["visits"], 1):
            if visit.get("clock"):
                with store.connect() as db:
                    db.execute("UPDATE meta SET value=? WHERE key='clock'", (visit["clock"],))
            transcript = []
            thread_ids = []
            asked: set[str] = set()
            for response_number in range(1, settings["max_responses_per_visit"]+1):
                invocation_dir = run / f"visit-{visit_number}" / f"response-{response_number}"
                observed = agent.invoke(workspace, prompt_for(spec, visit, transcript, group), workspace / "agent.schema.json", invocation_dir, settings)
                if observed.get("thread_id"):
                    thread_ids.append(observed["thread_id"])
                if source_hashes(workspace) != frozen:
                    raise RuntimeError("invalid_run: immutable inputs, tool source or runtime contract was modified")
                if observed["status"] != "completed":
                    manifest.update({"status": observed["status"], "error": "See invocation logs"})
                    raise InterruptedError
                last = AgentResult.model_validate(observed["output"])
                transcript.append({"role": "assistant", "content": last.model_dump()})
                write_json(run / f"visit-{visit_number}" / "public_dialogue.json", transcript)
                if last.status in {"completed", "blocked"}:
                    break
                reply, repeated = user_reply(last, visit.get("user_script", spec.get("user_script", {})), store, asked)
                repeated_questions += repeated
                transcript.append(reply)
                write_json(run / f"visit-{visit_number}" / "public_dialogue.json", transcript)
            else:
                manifest.update({"status": "budget_exceeded", "error": "Visit exceeded response limit"})
                raise InterruptedError
            all_transcripts.append({"visit": visit_number, "input": {key: visit[key] for key in ("clock", "message") if key in visit}, "dialogue": transcript})
            audit = store.audit_rows()
            snapshot = {"visit": visit_number, "clock": store.meta("clock"), "thread_ids": thread_ids, "last_action_seq": audit[-1]["seq"] if audit else 0, "history": store.rows("history"), "memories": store.rows("memories"), "workflow": store.rows("workflow"), "events": store.rows("events")}
            snapshots.append(snapshot)
            write_json(run / f"visit-{visit_number}" / "state_snapshot.json", snapshot)
            write_json(run / "public_dialogue.json", all_transcripts)
            write_json(run / "visit_snapshots.json", snapshots)
        if last is None:
            raise ValueError("Case has no visits")
        answer = last.model_dump()
        write_json(run / "final.json", answer)
        write_json(run / "public_dialogue.json", all_transcripts)
        render_preparation(workspace, last)
        scores = grade(workspace, answer, gold, initial, snapshots=snapshots)
        write_json(run / "code_scores.json", scores)
        packet = build_judge_packet(workspace, spec, answer, gold, all_transcripts)
        write_json(run / "judge_packet.json", packet)
        manifest.update({"status": "completed", "code_task_success": scores["task_success"], "repeated_questions": repeated_questions})
        if with_judge and last.preparation:
            try:
                rubric = (run / "implementation_snapshot" / "evaluation" / "rubrics" / "quality.md").read_text(encoding="utf-8")
                judge.evaluate(packet, run / "judge.json", rubric_text=rubric, settings=settings)
                manifest["judge_status"] = "completed"
            except (judge.JudgeAccessError, ValueError) as exc:
                manifest.update({"judge_status": "access_blocked" if isinstance(exc, judge.JudgeAccessError) else "invalid_judge", "judge_error": str(exc)})
    except InterruptedError:
        pass
    except LookupError as exc:
        manifest.update({"status": "environment_gap", "error": str(exc)})
    except (ValueError, RuntimeError) as exc:
        manifest.update({"status": "invalid_output" if isinstance(exc, ValueError) else "invalid_run", "error": str(exc)})
    manifest["seconds"] = round(time.monotonic()-started, 3)
    write_json(run / "manifest.json", manifest)
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--split", choices=["dev", "midpoint", "demo"], default="dev")
    parser.add_argument("--group", choices=["A", "B", "C", "D"], default="A")
    parser.add_argument("--case", default="S01")
    parser.add_argument("--output", type=Path)
    parser.add_argument("--judge", action="store_true")
    args = parser.parse_args()
    case = ROOT / "benchmark" / args.split / args.case
    if not case.is_dir():
        parser.error("Case does not exist: " + str(case))
    run = args.output or ROOT / "runs" / args.split / (args.case + "-" + args.group + "-" + uuid.uuid4().hex[:8])
    result = run_case(case, args.group, run, with_judge=args.judge)
    print(canonical(result))
    return 0 if result["status"] == "completed" else 2


if __name__ == "__main__":
    raise SystemExit(main())
