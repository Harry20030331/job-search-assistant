"""Meaningful provenance, routing and evaluation boundaries; no model calls."""
import copy
import tempfile
import unittest
from pathlib import Path

from evaluation.mail_triage import grade, run_case, summarize
from interview.storage import read_json
from interview.triage import Triage, route, validate_input, validate_triage


CASES = Path(__file__).resolve().parents[1] / "benchmark/dev/mail-triage"


def prediction(mail, category="invitation", interview_id=None):
    latest = next(m for m in mail.messages if m.source_id == mail.latest_source_id)
    return {"latest_source_id": mail.latest_source_id, "category": category, "interview_id": interview_id,
            "evidence": [{"source_id": latest.source_id, "quote": latest.body}], "unknowns": [], "rationale": "test fixture"}


class MailTriageTests(unittest.TestCase):
    def test_old_thread_evidence_cannot_replace_latest_evidence(self):
        mail = validate_input(read_json(CASES / "T04/input.json"))
        p = prediction(mail, "recruitment_update")
        p["evidence"] = [{"source_id": "old-invite", "quote": mail.messages[0].body}]
        with self.assertRaises(ValueError):
            validate_triage(p, mail)

    def test_fabricated_quotes_wrong_message_and_invented_interview_rejected(self):
        mail = validate_input(read_json(CASES / "T05/input.json"))
        for mutation in [{"evidence": [{"source_id": "latest", "quote": "You passed the interview"}]},
                         {"latest_source_id": "old-invite"}, {"interview_id": "guessed-from-company"}]:
            p = prediction(mail)
            p.update(mutation)
            with self.assertRaises(ValueError):
                validate_triage(p, mail)

    def test_ambiguous_thread_cannot_choose_one_interview(self):
        mail = validate_input(read_json(CASES / "T16/input.json"))
        with self.assertRaises(ValueError):
            validate_triage(prediction(mail, "reschedule", "interview-northstar-backend"), mail)
        p = validate_triage(prediction(mail, "reschedule"), mail)
        self.assertEqual(route(p), "needs_review")

    def test_missing_identity_never_routes_to_an_existing_event_change(self):
        mail = validate_input(read_json(CASES / "T10/input.json"))
        for category in ["reschedule", "cancellation", "logistics_update"]:
            self.assertEqual(route(Triage.model_validate(prediction(mail, category))), "needs_review")

    def test_duplicate_message_ids_rejected(self):
        data = read_json(CASES / "T05/input.json")
        data["messages"].append(copy.deepcopy(data["messages"][0]))
        with self.assertRaises(ValueError):
            validate_input(data)

    def test_failure_coverage_and_ambiguous_gold_are_explicit(self):
        records = [{"status": "environment_error"}]
        for case_id in ["T05", "T14"]:
            mail = validate_input(read_json(CASES / case_id / "input.json"))
            gold = read_json(CASES / case_id / "gold.json")
            records.append({"status": "completed", "scores": grade(Triage.model_validate(prediction(mail, gold["category"])), gold)})
        summary = summarize(records)
        self.assertEqual((summary["attempted"], summary["valid_predictions"], summary["case_success_count"]), (3, 2, 2))
        self.assertEqual(summary["actionable_detection_valid_outputs_only"]["ambiguous_gold_excluded"], 1)

    def test_blocked_node_remains_unscored_and_gets_no_accepted_output(self):
        def blocked(*args):
            return {"status": "completed", "output": {"status": "blocked", "triage": None, "questions": ["Input read failed"]}}
        with tempfile.TemporaryDirectory() as tmp:
            dest = Path(tmp) / "run"
            result = run_case(CASES / "T05", dest, {}, invoke_fn=blocked)
            self.assertEqual(result["status"], "blocked")
            self.assertNotIn("scores", result)
            self.assertFalse((dest / "accepted.json").exists())

    def test_all_development_labels_have_reachable_nonmutating_routes(self):
        categories = set()
        for case in sorted(CASES.glob("T*")):
            mail = validate_input(read_json(case / "input.json"))
            gold = read_json(case / "gold.json")
            categories.add(gold["category"])
            p = validate_triage(prediction(mail, gold["category"], gold["interview_id"]), mail)
            self.assertTrue(grade(p, gold)["passed"])
            self.assertNotIn(route(p), {"create", "update", "delete", "send", "generate_materials"})
        self.assertEqual(len(categories), 8)


if __name__ == "__main__":
    unittest.main()
