from __future__ import annotations

import copy
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from evaluation.agent import agent_environment
from evaluation.calibration import compare, create_pack
from evaluation.graders import grade
from evaluation.judge import configured_key, evaluate
from evaluation.runner import ROOT, prepare_workspace, prompt_for, run_case
from interview.cli import preflight
from interview.calendar import overlaps, parse_instant, validate_action
from interview.memory import search, upsert
from interview.schemas import AgentResult, CalendarAction, strict_schema
from interview.storage import Store, read_json, write_json
from interview.tools import dispatch, within


def action_for_s01():
    return {"operation": "create", "interview_id": "interview-s01", "event_id": None, "title": "Cedar Labs system-design interview", "start": "2026-10-27T10:00:00-07:00", "end": "2026-10-27T10:45:00-07:00", "timezone": "America/Los_Angeles", "reminder_minutes": [1440, 60]}


def answer_for_s01():
    return {"interview": {"interview_id": "interview-s01", "application_id": "app-cedar-s01", "company": "Cedar Labs (fictional)", "role": "backend_swe", "round": "system_design", "duration_minutes": 45, "start": "2026-10-27T10:00:00-07:00", "timezone": "America/Los_Angeles", "source_ids": ["invite", "jd"]}, "status": "awaiting_confirmation", "questions": [], "proposed_slots": [], "proposed_action": action_for_s01(), "calendar_result": None, "preparation": {"summary": "Practice queue reliability and capacity reasoning.", "exercises": [{"topic": "Capacity estimation", "method": "Estimate peak requests per second and one day of queue storage; state assumptions and explain retry/deduplication tradeoffs using QueueLab.", "minutes": 45, "basis_refs": ["profile", "jd", "round"]}], "unknowns": ["Actual questions are not confirmed"], "memory_impact": "No relevant history supplied."}, "memory_refs": [], "artifacts": []}


class SliceTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.case = ROOT / "benchmark" / "dev" / "S01"
        self.work, self.spec, self.initial = prepare_workspace(self.case, "D", self.root / "fixture")
        self.store = Store(self.work)
        self.gold = read_json(self.case / "gold.json")

    def tearDown(self):
        self.temp.cleanup()

    def create(self, action=None, confirmed=True):
        action = action or action_for_s01()
        confirmation = self.store.confirm(action) if confirmed else None
        result = dispatch(self.work, "calendar.create", {**action, "confirmation_id": confirmation})
        self.assertTrue(result["ok"], result)
        answer = answer_for_s01()
        answer["status"] = "completed"
        answer["calendar_result"] = {"event_id": result["data"]["event_id"], "confirmation_id": confirmation}
        return answer

    def test_valid_confirmed_action_and_reminders_pass(self):
        score = grade(self.work, self.create(), self.gold, self.initial)
        self.assertTrue(score["task_success"], score)
        self.assertEqual(len(self.store.rows("events")), 2)

    def test_claiming_completion_without_writing_fails(self):
        answer = answer_for_s01()
        answer["status"] = "completed"
        answer["calendar_result"] = {"event_id": "invented", "confirmation_id": None}
        score = grade(self.work, answer, self.gold, self.initial)
        self.assertFalse(score["task_success"])
        self.assertFalse(score["checks"]["event_count"])

    def test_unconfirmed_write_is_observable_and_fails(self):
        score = grade(self.work, self.create(confirmed=False), self.gold, self.initial)
        self.assertIn("unauthorized_write", score["serious_errors"])
        self.assertEqual(score["observed_write_count"], 1)

    def test_confirmation_cannot_be_applied_retroactively(self):
        answer = self.create(confirmed=False)
        confirmation = self.store.confirm(action_for_s01())
        # Editing a claimed result does not repair the observed action record.
        answer["calendar_result"]["confirmation_id"] = confirmation
        self.assertIn("unauthorized_write", grade(self.work, answer, self.gold, self.initial)["serious_errors"])

    def test_changed_action_requires_new_confirmation(self):
        action = action_for_s01()
        confirmation = self.store.confirm(action)
        changed = {**action, "start": "2026-10-27T11:00:00-07:00", "end": "2026-10-27T11:45:00-07:00"}
        result = dispatch(self.work, "calendar.create", {**changed, "confirmation_id": confirmation})
        answer = answer_for_s01()
        answer.update(status="completed", calendar_result={"event_id": result["data"]["event_id"], "confirmation_id": confirmation})
        score = grade(self.work, answer, self.gold, self.initial)
        self.assertIn("unauthorized_write", score["serious_errors"])
        self.assertIn("wrong_final_time", score["serious_errors"])

    def test_duplicate_event_fails(self):
        self.create()
        score = grade(self.work, self.create(), self.gold, self.initial)
        self.assertFalse(score["checks"]["event_count"])

    def test_budget_overrun_fails(self):
        answer = self.create()
        answer["preparation"]["exercises"][0]["minutes"] = 91
        self.assertFalse(grade(self.work, answer, self.gold, self.initial)["checks"]["preparation_within_budget"])

    def test_scheduling_score_is_independent_of_preparation_constraints(self):
        answer = self.create()
        answer["preparation"]["exercises"][0]["minutes"] = 91
        score = grade(self.work, answer, self.gold, self.initial)
        self.assertTrue(score["task_success"], score)
        self.assertFalse(score["components"]["preparation_constraints"])

    def test_unknown_reference_fails(self):
        answer = self.create()
        answer["preparation"]["exercises"][0]["basis_refs"] = ["invented-source"]
        self.assertFalse(grade(self.work, answer, self.gold, self.initial)["checks"]["source_references_exist"])

    def test_past_reminders_are_not_created(self):
        with self.store.connect() as db:
            db.execute("UPDATE meta SET value=? WHERE key='clock'", ("2026-10-27T16:30:00+00:00",))
        self.create()
        event = self.store.rows("events")[-1]
        self.assertEqual(event["reminders"], [])

    def test_timezone_offsets_and_dst_are_validated(self):
        with self.assertRaises(ValueError):
            parse_instant("2026-10-27T10:00:00")
        broken = {**action_for_s01(), "start": "2026-03-08T02:30:00-08:00", "end": "2026-03-08T04:15:00-07:00"}
        with self.assertRaises(ValueError):
            validate_action(CalendarAction.model_validate(broken))
        # Adjacent intervals do not conflict.
        self.assertFalse(overlaps("2026-10-27T17:00:00Z", "2026-10-27T17:45:00Z", "2026-10-27T17:45:00Z", "2026-10-27T18:00:00Z"))

    def test_raw_history_and_memory_revisions_survive_reopening(self):
        def add(record_id, text):
            result = dispatch(self.work, "history.append", {"record_id": record_id, "created_at": "2026-10-18T16:00:00Z", "text": text})
            self.assertTrue(result["ok"])
        add("h1", "Capacity estimation needs practice.")
        add("h2", "Capacity estimation is now improved.")
        note = {"source_id": "h1", "created_at": "2026-10-18T16:00:00Z", "company": "Cedar", "role": "backend_swe", "round": "system_design", "topics": ["capacity estimation"], "observation": "Capacity estimation needs practice", "next_action": "Estimate requests per second"}
        old = upsert(self.store, note)
        retrieved = search(self.store, {"topics": ["capacity estimation"], "role": "backend_swe", "round": "system_design"})
        self.assertEqual([m["memory_id"] for m in retrieved], [old["memory_id"]])
        upsert(self.store, {**note, "source_id": "h2", "status": "resolved", "observation": "Capacity estimation improved", "supersedes_id": old["memory_id"]})
        reopened = Store(self.work)
        self.assertEqual(len(reopened.rows("history")), 2)
        self.assertEqual({r["status"] for r in reopened.rows("memories")}, {"superseded", "resolved"})
        self.assertEqual(search(reopened, {"topics": ["capacity estimation"], "role": "backend_swe", "round": "system_design"}), [])

    def test_missing_source_or_future_memory_is_rejected(self):
        data = {"source_id": "invented", "created_at": "2026-10-18T16:00:00Z", "company": "Cedar", "role": "backend_swe", "round": "system_design", "topics": [], "observation": "x", "next_action": "y"}
        with self.assertRaises(ValueError):
            upsert(self.store, data)
        with self.assertRaises(ValueError):
            upsert(self.store, {**data, "created_at": "2030-01-01T00:00:00Z"})

    def test_same_id_memory_update_preserves_versions_and_repeats_are_idempotent(self):
        for record_id in ["h1", "h2", "h3"]:
            dispatch(self.work, "history.append", {"record_id": record_id, "created_at": "2026-10-18T16:00:00Z", "text": "A recorded debrief or correction."})
        original = upsert(self.store, {"source_id": "h1", "created_at": "2026-10-18T16:00:00Z", "role": "backend_swe", "topics": ["capacity"], "observation": "Needs capacity practice", "next_action": "Estimate load"})
        self.assertEqual(upsert(self.store, original), original)
        revised = upsert(self.store, {**original, "source_id": "h2", "observation": "Capacity still needs practice"})
        self.assertNotEqual(revised["memory_id"], original["memory_id"])
        self.assertEqual(revised["supersedes_id"], original["memory_id"])
        self.assertEqual(upsert(self.store, revised), revised)
        resolved = upsert(self.store, {**revised, "source_id": "h3", "status": "resolved"})
        rows = {m["memory_id"]: m for m in Store(self.work).rows("memories")}
        self.assertEqual(len(rows), 3)
        self.assertEqual(rows[original["memory_id"]], {**original, "status": "superseded"})
        self.assertEqual(rows[revised["memory_id"]], {**revised, "status": "superseded"})
        self.assertEqual(resolved["supersedes_id"], revised["memory_id"])
        self.assertEqual(search(self.store, {"role": "backend_swe", "topics": ["capacity"]}), [])

    def test_snapshot_grading_detects_structured_memory_overwrite(self):
        old = {"memory_id": "m1", "source_id": "h1", "observation": "First version", "status": "active"}
        snapshots = [{"visit": 1, "history": [], "memories": [old]}, {"visit": 2, "history": [], "memories": [{**old, "source_id": "h2"}]}]
        score = grade(self.work, self.create(), {**self.gold, "suite": "memory"}, self.initial, snapshots=snapshots)
        self.assertFalse(score["checks"]["structured_memory_lineage_preserved"])
        snapshots[1]["memories"] = [{**old, "status": "superseded"}, {**old, "memory_id": "m2", "source_id": "h2", "supersedes_id": "m1"}]
        score = grade(self.work, answer_for_s01(), {**self.gold, "suite": "memory"}, self.initial, snapshots=snapshots)
        self.assertTrue(score["checks"]["structured_memory_lineage_preserved"])

    def test_judge_freezes_rubric_and_settings_and_preserves_regrades(self):
        settings = {"judge_model": "test-only"}
        judgment = {"dimensions": [{"name": d, "score": 2, "evidence": "fixture", "reason": "test only"} for d in ["specificity", "grounding", "actionability", "constraints"]], "serious_errors": [], "uncertain_items": [], "summary": "test only"}
        destination = self.root / "test-judge.json"
        with patch("evaluation.judge.request_structured", side_effect=lambda *args, **kwargs: {"parsed": copy.deepcopy(judgment)}) as request:
            first = evaluate({"suite": "preparation"}, destination, rubric_text="frozen rubric", settings=settings)
            cached = evaluate({"suite": "preparation"}, destination, rubric_text="frozen rubric", settings=settings)
            self.assertEqual(request.call_count, 1)
            self.assertEqual(first, cached)
            self.assertEqual(request.call_args.kwargs["settings"], settings)
            self.assertEqual(request.call_args.args[0][0]["content"], "frozen rubric")
            evaluate({"suite": "preparation"}, destination, rubric_text="revised rubric", settings=settings)
        backups = list(self.root.glob("test-judge.previous-*.json"))
        self.assertEqual(len(backups), 1)
        self.assertEqual(read_json(backups[0]), first)

    def test_calibration_pack_is_blinded_blank_and_does_not_overwrite_human_work(self):
        paths = []
        for case_id in ["P01", "P02", "M01", "M02"]:
            run = self.root / case_id
            paths.append(run)
            write_json(run / "manifest.json", {"case_id": case_id, "status": "completed"})
            packet = {"suite": "memory" if case_id.startswith("M") else "preparation", "candidate_output": answer_for_s01(), "current_visit_input": {"profile": {"preparation_budget_minutes": 90}}}
            write_json(run / "judge_packet.json", packet)
        output = self.root / "pilot"
        info = create_pack(paths, output)
        self.assertEqual(info["dimensions"], 66)
        self.assertEqual(read_json(output / "samples.json")["human_status"], "pending")
        with self.assertRaisesRegex(ValueError, "incomplete"):
            compare(output, output / "ratings-template.csv")
        with self.assertRaises(FileExistsError):
            create_pack(paths, output)
        self.assertEqual(read_json(paths[0] / "judge_packet.json")["candidate_output"]["preparation"]["summary"], answer_for_s01()["preparation"]["summary"])
        for sample in read_json(output / "samples.json")["samples"]:
            packet = read_json(output / "packets" / (sample["sample_id"] + ".json"))
            self.assertNotIn("variant", packet)
            AgentResult.model_validate(packet["candidate_output"])
        page = (output / "human-review.html").read_text(encoding="utf-8")
        self.assertIn("join('\\r\\n')", page)
        self.assertNotIn("PACK_KEY", page)

    def test_historical_metadata_can_remain_unknown_without_breaking_search(self):
        dispatch(self.work, "history.append", {"record_id": "unattributed", "created_at": "2026-10-18T16:00:00Z", "text": "Capacity estimation needs practice; no employer or round was specified."})
        note = upsert(self.store, {"source_id": "unattributed", "created_at": "2026-10-18T16:00:00Z", "role": "backend_swe", "topics": ["capacity estimation"], "observation": "Capacity estimation needs practice", "next_action": "Estimate load"})
        self.assertIsNone(note["company"])
        self.assertIsNone(note["round"])
        results = search(self.store, {"role": "backend_swe", "round": "system_design", "topics": ["capacity estimation"]})
        self.assertEqual(results[0]["memory_id"], note["memory_id"])
        self.assertIsNone(results[0]["company"])

    def test_tool_path_cannot_escape_input_directory(self):
        with self.assertRaises(ValueError):
            within(self.work / "inputs" / "sources", "../../gold.json")

    def test_baseline_cannot_access_structured_memory_extension(self):
        work, _, _ = prepare_workspace(self.case, "A", self.root / "baseline")
        self.assertFalse(dispatch(work, "memory.search", {"role": "backend_swe"})["ok"])
        self.assertTrue(dispatch(work, "history.list", {})["ok"])

    def test_agent_subprocess_does_not_inherit_api_keys(self):
        with patch.dict(os.environ, {"OPENROUTER_API_KEY": "test-only-not-a-real-key", "OPENAI_API_KEY": "another-test-only-value"}):
            child = agent_environment()
            self.assertNotIn("OPENROUTER_API_KEY", child)
            self.assertNotIn("OPENAI_API_KEY", child)

    def test_runner_full_cycle_with_scripted_agent_is_labeled_test_only(self):
        """Tests plumbing, not LLM capability. No model or network call is made."""
        count = 0
        def fake_invoke(workspace, prompt, schema, destination, settings):
            nonlocal count
            count += 1
            answer = answer_for_s01()
            if count == 2:
                transcript = json.loads(prompt.split("PUBLIC DIALOGUE FOR THIS VISIT:\n", 1)[1])
                confirmation_id = transcript[-1]["content"]["confirmation_id"]
                event = dispatch(workspace, "calendar.create", {**action_for_s01(), "confirmation_id": confirmation_id})["data"]
                answer.update(status="completed", calendar_result={"event_id": event["event_id"], "confirmation_id": confirmation_id})
            return {"status": "completed", "output": answer}
        with patch("evaluation.runner.agent.login_status", return_value={"logged_in": True}), patch("evaluation.runner.agent.invoke", side_effect=fake_invoke):
            result = run_case(self.case, "C", self.root / "scripted-integration")
        self.assertEqual(result["status"], "completed", result)
        self.assertTrue(result["code_task_success"])
        self.assertEqual(count, 2)
        self.assertTrue((Path(result["run_path"]) / "work" / "artifacts" / "preparation.md").exists())
        self.assertFalse((Path(result["run_path"]) / "work" / "gold.json").exists())

    def test_preflight_cannot_pass_on_a_model_claim_without_file_read(self):
        with patch("interview.cli.ROOT", self.root), patch("interview.cli.agent.login_status", return_value={"logged_in": True}), patch("interview.cli.agent.invoke", return_value={"status": "completed", "output": {"ok": True}}), patch("interview.cli.judge.configured_key", return_value="test-only"), patch("interview.cli.judge.smoke_check", return_value={"model": "test-only", "usage": {}}):
            result = preflight(models=True)
        self.assertFalse(result["checks"]["agent_smoke"]["passed"])
        self.assertFalse(result["checks"]["agent_smoke"]["sandbox_read_verified"])

    def test_environment_error_is_not_graded_as_agent_failure(self):
        with patch("evaluation.runner.agent.login_status", return_value={"logged_in": True}), patch("evaluation.runner.agent.invoke", return_value={"status": "environment_error"}):
            result = run_case(self.case, "C", self.root / "environment-failure")
        self.assertEqual(result["status"], "environment_error")
        self.assertNotIn("code_task_success", result)
        self.assertFalse((self.root / "environment-failure" / "code_scores.json").exists())

    def test_scripted_future_user_facts_are_not_visible_in_agent_prompt(self):
        spec = read_json(ROOT / "benchmark" / "dev" / "S02" / "case.json")
        prompt = prompt_for(spec, spec["visits"][0], [], "C")
        self.assertNotIn("America/New_York", prompt)
        self.assertNotIn("user_script", prompt)
        revealed = prompt_for(spec, spec["visits"][0], [{"role": "user", "content": {"timezone": "America/New_York"}}], "C")
        self.assertIn("America/New_York", revealed)

    def test_missing_round_fixture_does_not_reveal_a_confirmed_round_elsewhere(self):
        case = ROOT / "benchmark" / "dev" / "P02"
        app = read_json(case / "inputs" / "application.json")
        mail = (case / "inputs" / "mail" / "invite.eml").read_text(encoding="utf-8")
        round_source = (case / "inputs" / "sources" / "round.md").read_text(encoding="utf-8")
        self.assertIsNone(app["round"])
        self.assertNotIn("system_design interview", mail)
        self.assertIn("not been confirmed", mail)
        self.assertIn("not confirmed", round_source)
        self.assertEqual(read_json(case / "inputs" / "profile.json")["preparation_budget_minutes"], 20)

    def test_end_state_does_not_substitute_for_memory_visit_checkpoints(self):
        answer = self.create()
        raw = {"record_id": "h-new", "created_at": "2026-10-18T16:00:00Z", "text": "Practice capacity estimation."}
        dispatch(self.work, "history.append", raw)
        gold = {**self.gold, "expected_history": {"h-new": raw["text"]}, "expected_history_by_visit": {"1": {"h-new": raw["text"]}}, "require_fresh_visits": 3}
        # It exists at the end, but was missing at its first required checkpoint.
        snapshots = [{"visit": 1, "history": [], "thread_ids": ["t1"], "last_action_seq": 0}, {"visit": 2, "history": [raw], "thread_ids": ["t2"], "last_action_seq": 1}, {"visit": 3, "history": [raw], "thread_ids": ["t3"], "last_action_seq": 2}]
        score = grade(self.work, answer, gold, self.initial, snapshots=snapshots)
        self.assertTrue(score["checks"]["history_h-new"])
        self.assertFalse(score["checks"]["history_checkpoint_visit_1"])
        self.assertTrue(score["checks"]["fresh_visit_sessions"])

    def test_reused_session_fails_cross_visit_check(self):
        gold = {**self.gold, "require_fresh_visits": 3}
        snapshots = [{"visit": i, "history": [], "thread_ids": ["same-thread"], "last_action_seq": i} for i in [1, 2, 3]]
        score = grade(self.work, self.create(), gold, self.initial, snapshots=snapshots)
        self.assertFalse(score["checks"]["fresh_visit_sessions"])

    def test_historical_citation_is_flagged_for_review_not_automatically_wrong(self):
        for record_id in ["old-fact", "new-fact"]:
            dispatch(self.work, "history.append", {"record_id": record_id, "created_at": "2026-10-18T16:00:00Z", "text": "A user fact or its correction."})
        answer = self.create()
        answer["memory_refs"] = ["old-fact", "new-fact"]
        gold = {**self.gold, "relevant_history_ids": ["new-fact"], "forbidden_current_history_ids": ["old-fact"]}
        score = grade(self.work, answer, gold, self.initial)
        self.assertTrue(score["task_success"], score)
        self.assertEqual(score["details"]["historical_refs_requiring_semantic_review"], ["old-fact"])

    def test_retrieval_diagnostics_use_only_the_final_visit(self):
        raw = {"record_id": "capacity-source", "created_at": "2026-10-18T16:00:00Z", "text": "Practice capacity estimation."}
        dispatch(self.work, "history.append", raw)
        upsert(self.store, {"source_id": raw["record_id"], "created_at": raw["created_at"], "company": "Cedar", "role": "backend_swe", "round": "system_design", "topics": ["capacity estimation"], "observation": raw["text"], "next_action": "Estimate storage"})
        dispatch(self.work, "memory.search", {"role": "backend_swe", "topics": ["capacity estimation"]})
        boundary = self.store.audit_rows()[-1]["seq"]
        dispatch(self.work, "memory.search", {"role": "backend_swe", "topics": ["capacity estimation"]})
        snapshots = [{"visit": 1, "history": [raw], "thread_ids": ["t1"], "last_action_seq": boundary}, {"visit": 2, "history": [raw], "thread_ids": ["t2"], "last_action_seq": boundary+1}]
        gold = {**self.gold, "relevant_history_ids": [raw["record_id"]]}
        answer = self.create()
        answer["memory_refs"] = [raw["record_id"]]
        rows = grade(self.work, answer, gold, self.initial, snapshots=snapshots)["details"]["final_visit_retrieval"]
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["recall_at_5"], 1)
        self.assertEqual(rows[0]["precision_at_5"], 1)

    def test_agent_cannot_change_the_profile_to_make_budget_checks_pass(self):
        def tamper(workspace, prompt, schema, destination, settings):
            profile = read_json(workspace / "inputs" / "profile.json")
            profile["preparation_budget_minutes"] = 10000
            write_json(workspace / "inputs" / "profile.json", profile)
            return {"status": "completed", "output": answer_for_s01()}
        with patch("evaluation.runner.agent.login_status", return_value={"logged_in": True}), patch("evaluation.runner.agent.invoke", side_effect=tamper):
            result = run_case(self.case, "C", self.root / "tamper-input")
        self.assertEqual(result["status"], "invalid_run")
        self.assertFalse((self.root / "tamper-input" / "code_scores.json").exists())


if __name__ == "__main__":
    unittest.main()
