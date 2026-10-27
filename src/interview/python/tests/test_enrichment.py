"""Research identity, resumability and evidence isolation; no real network/model calls."""
import copy
import sqlite3
import tempfile
import unittest
from contextlib import closing
from pathlib import Path

from evaluation.enrichment_scenarios import COMPANY, DATASET, ROLE, URL, fixture_workspace, page, policy, run_case
from interview.enrichment import finish, next_action, record, start, trusted, ResearchPolicy, web_url
from interview.preparation_context import ContextRequest
from interview.storage import read_json, write_json


class EnrichmentTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.store = fixture_workspace(self.root / "candidate")
        self.research = self.root / "research"
        start(self.store.workspace, self.research, policy=policy(), association="verified", requisition="HR-42", mode="offline_fixture")

    def tearDown(self):
        self.temp.cleanup()

    def test_eight_scripted_scenarios_keep_canonical_identity_and_budgets(self):
        for scenario in read_json(DATASET)["scenarios"]:
            with self.subTest(case=scenario["case_id"]):
                result = run_case(scenario, self.root / scenario["case_id"])
                self.assertTrue(result["protocol_checks_passed"], result)
                self.assertEqual((result["model_calls"], result["live_browser_calls"]), (0, 0))

    def test_action_reservation_and_first_receipt_are_resumable_idempotent(self):
        action = next_action(self.research)
        self.assertEqual(next_action(self.research), action)
        receipt = page(action, "exact")
        result = record(self.research, receipt)
        self.assertEqual(result["status"], "accepted")
        self.assertEqual(record(self.research, receipt), result)
        changed = copy.deepcopy(receipt)
        changed["observation_ref"] = "changed observation"
        with self.assertRaisesRegex(ValueError, "replace a first"):
            record(self.research, changed)
        summary = finish(self.research)
        self.assertEqual(summary["research"]["opened_pages"], 1)
        self.assertEqual(finish(self.research), summary)
        self.assertEqual(next_action(self.research), {"status": "finished"})

    def test_pending_failure_must_be_recorded_before_finish(self):
        action = next_action(self.research)
        with self.assertRaisesRegex(ValueError, "pending action"):
            finish(self.research)
        receipt = page(action, "exact")
        receipt["status"] = "unavailable"
        with self.assertRaisesRegex(ValueError, "closure"):
            record(self.research, receipt)
        receipt.pop("decision")
        record(self.research, receipt)
        self.assertEqual(finish(self.research)["status"], "missing")

    def test_zero_budget_produces_honest_missing_evidence(self):
        other = self.root / "zero"
        start(self.store.workspace, other, policy={"max_search_queries": 0, "max_opened_pages": 0}, mode="offline_fixture")
        self.assertEqual(next_action(other)["status"], "ready_to_finish")
        result = finish(other)
        self.assertEqual(result["status"], "missing")
        self.assertEqual(result["research"]["opened_pages"], 0)
        self.assertEqual(result["research"]["search_queries"], 0)

    def test_unsafe_urls_and_shared_ats_scope_confusion_are_rejected(self):
        for url in ("file:///tmp/page", "http://example.test/a", "https://user:password@example.test/a", "https://127.0.0.1/", "https://[::1]/", "https://10.0.0.1/", "https://host.local/", "https://example.test:8766/"):
            with self.subTest(url=url), self.assertRaises(ValueError):
                web_url(url)
        scopes = ResearchPolicy.model_validate({"official_scopes": [{"company": COMPANY, "url": "https://jobs.ats.example.test/harbor",
            "include_subpaths": True, "verification_ref": "Fixture exact employer board"}]})
        self.assertTrue(trusted(scopes, "https://jobs.ats.example.test/harbor/jobs/42", COMPANY))
        self.assertFalse(trusted(scopes, "https://jobs.ats.example.test/harbor-evil/jobs/42", COMPANY))
        self.assertFalse(trusted(scopes, "https://jobs.ats.example.test/cedar/jobs/42", COMPANY))
        self.assertFalse(trusted(scopes, "https://jobs.ats.example.test/harbor/jobs/42", "Cedar Dispatch"))

    def test_redirect_or_role_similarity_cannot_establish_exact_identity(self):
        action = next_action(self.research)
        receipt = page(action, "exact")
        receipt["final_url"] = "https://careers.harbor.example.test/jobs/other"
        outcome = record(self.research, receipt)
        self.assertEqual(outcome["status"], "rejected")
        self.assertIn("canonical URL/requisition", outcome["reason"])
        self.assertEqual(finish(self.research)["status"], "missing")

    def test_search_snippet_cannot_become_a_source(self):
        action = next_action(self.research)
        failed = page(action, "exact")
        failed.update(status="blocked", decision=None)
        record(self.research, failed)
        search = next_action(self.research)
        self.assertEqual(search["kind"], "search")
        fake_source = page({**search, "url": URL}, "exact")
        with self.assertRaisesRegex(ValueError, "Search results are leads"):
            record(self.research, fake_source)
        source_only = {"action_id": search["action_id"], "executor": "offline_fixture", "observation_ref": "fixture search",
                       "captured_at": failed["captured_at"], "status": "ok", "results": [{"url": URL, "title": ROLE, "snippet": "Unverified search lead"}]}
        record(self.research, source_only)
        self.assertEqual(finish(self.research)["status"], "missing")

    def test_live_mode_rejects_offline_receipts_and_wrong_executor(self):
        live = self.root / "live"
        start(self.store.workspace, live, policy=policy())
        action = next_action(live)
        receipt = page(action, "exact")
        with self.assertRaisesRegex(ValueError, "masquerade"):
            record(live, receipt)
        receipt["executor"] = "search_tool"
        with self.assertRaisesRegex(ValueError, "browser page capture"):
            record(live, receipt)

    def test_receipt_quotes_and_official_company_scope_are_enforced(self):
        action = next_action(self.research)
        receipt = page(action, "exact")
        receipt["decision"]["content_quote"] = "Not on the captured page"
        outcome = record(self.research, receipt)
        self.assertEqual(outcome["status"], "rejected")
        with closing(sqlite3.connect(self.research / "session.sqlite3")) as db:
            raw = db.execute("SELECT payload FROM receipts").fetchone()[0]
        self.assertIn("Not on the captured page", raw)
        self.assertEqual(finish(self.research)["status"], "missing")

    def test_changed_canonical_input_invalidates_pending_research(self):
        next_action(self.research)
        path = self.store.workspace / "inputs/application.json"
        application = read_json(path)
        application["role"] = "Another Role"
        write_json(path, application)
        with self.assertRaisesRegex(ValueError, "changed"):
            next_action(self.research)

    def test_reuse_captured_exact_jd_and_company_avoids_new_research(self):
        scenario = read_json(DATASET)["scenarios"][0]
        result_root = self.root / "reuse-source"
        run_case(scenario, result_root)
        seed = read_json(result_root / "research/enrichment.json")
        other = self.root / "reuse"
        start(self.store.workspace, other, policy=policy(), seed=seed, association="verified", mode="offline_fixture")
        self.assertEqual(next_action(other)["status"], "ready_to_finish")
        summary = finish(other)
        self.assertEqual(summary["seed_reuse_count"], 2)
        self.assertEqual((summary["research"]["search_queries"], summary["research"]["opened_pages"]), (0, 0))
        request = ContextRequest.model_validate(read_json(other / "request.json"))
        self.assertEqual(request.identity.job_id, "fictional-harbor-42")

    def test_analogue_requires_relationship_limits_and_keeps_selected_job(self):
        action = next_action(self.research)
        receipt = page(action, "same_company_analogue")
        receipt["decision"]["limitations"] = []
        self.assertEqual(record(self.research, receipt)["status"], "rejected")
        self.assertEqual(finish(self.research)["status"], "missing")


if __name__ == "__main__":
    unittest.main()
