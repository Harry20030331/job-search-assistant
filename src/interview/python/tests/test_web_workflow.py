"""Website acceptance, duplicate jobs, revision gates and recoverable failures."""
import copy
import json
import subprocess
import sys
import tempfile
import time
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from unittest.mock import Mock, patch

import test_practice
from interview.context_preparation import submit_proposal, submit_material
from interview.dashboard import export
from interview.preparation import latest
from interview.web_workflow import decide, run as execute_job, fail_launch
from interview.practice_jobs import check_before_model, job_scope, public_job, renew


def run(store, job_id, runner=None):
    # Production deliberately hides runner errors. Test assertions must still
    # escape the worker's error boundary instead of becoming expected failures.
    assertions = []
    def checked(*args, **kwargs):
        try:
            return runner(*args, **kwargs)
        except AssertionError as error:
            assertions.append(error)
            raise
    result = execute_job(store, job_id, checked if runner else None)
    if assertions:
        raise assertions[0]
    return result


class WebWorkflowTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.root = Path(self.temp.name)
        self.store = test_practice.PracticeTests.workspace(self)
        self.material = export(self.store.workspace)["materials"]
        self.proposal = submit_proposal(self.store, latest(self.store, "interview-materials")["draft"])
        self.command = {"interview_id": "interview-materials", "proposal_id": self.proposal["proposal_id"],
            "proposal_hash": self.proposal["proposal_hash"], "proposal_version": self.proposal["version"], "retry": False}

    def tearDown(self): self.temp.cleanup()

    def test_no_material_until_exact_website_acceptance(self):
        self.assertIsNone(export(self.store.workspace)["materials"])
        result = decide(self.store, self.command, origin="synthetic_test_script")
        self.assertEqual(result["status"], "queued")
        self.assertIsNone(export(self.store.workspace)["materials"])
        with self.store.connect() as db:
            evidence = json.loads(db.execute("SELECT evidence FROM preparation_approvals ORDER BY rowid DESC LIMIT 1").fetchone()[0])
        self.assertEqual(evidence["origin"], "synthetic_test_script")
        self.assertEqual(evidence["proposal_hash"], self.proposal["proposal_hash"])

    def test_duplicate_and_concurrent_acceptance_make_one_job(self):
        with ThreadPoolExecutor(max_workers=2) as executor:
            jobs = list(executor.map(lambda _: decide(self.store, self.command), range(2)))
        self.assertEqual(jobs[0]["job_id"], jobs[1]["job_id"])
        with self.store.connect() as db:
            self.assertEqual(db.execute("SELECT COUNT(*) FROM web_practice_jobs").fetchone()[0], 1)

    def test_changed_hash_version_interview_or_sources_cannot_approve(self):
        for key, wrong in (("proposal_hash", "different"), ("proposal_version", 42), ("interview_id", "another")):
            with self.assertRaises(ValueError): decide(self.store, {**self.command, key: wrong})
        (self.store.workspace / "inputs/profile.json").write_text('{"preparation_budget_minutes": 25}')
        with self.assertRaises(ValueError): decide(self.store, self.command)

    def test_revision_does_not_inherit_approval_or_old_materials(self):
        decide(self.store, self.command)
        submit_proposal(self.store, self.proposal["draft"])
        with self.assertRaises(ValueError): decide(self.store, self.command)
        self.assertIsNone(export(self.store.workspace)["materials"])

    def test_single_claim_publishes_matching_pack(self):
        job = decide(self.store, self.command)
        material = copy.deepcopy(self.material)
        material.update(proposal_id=self.proposal["proposal_id"], proposal_hash=self.proposal["proposal_hash"], proposal_version=self.proposal["version"])
        def publish(workspace, output, **kwargs):
            submit_material(self.store, kwargs["approval_id"], material, material_format="simulation-v2")
            return {"status": "material_ready"}
        runner = Mock(side_effect=publish)
        self.assertEqual(run(self.store, job["job_id"], runner)["status"], "ready")
        self.assertEqual(run(self.store, job["job_id"], runner)["status"], "not_claimed")
        self.assertEqual(runner.call_count, 1)
        self.assertIsNotNone(export(self.store.workspace)["materials"])
        self.assertEqual(decide(self.store, self.command)["status"], "material_ready")

    def test_failure_has_no_automatic_retry_and_retains_attempts(self):
        job = decide(self.store, self.command)
        runner = Mock(side_effect=RuntimeError("private content must not enter public state"))
        self.assertEqual(run(self.store, job["job_id"], runner)["error_code"], "generation_failed")
        self.assertEqual(decide(self.store, self.command)["status"], "failed")
        new = decide(self.store, {**self.command, "retry": True})
        self.assertNotEqual(new["job_id"], job["job_id"])
        with self.store.connect() as db:
            self.assertEqual(db.execute("SELECT COUNT(*) FROM web_practice_jobs").fetchone()[0], 2)
        self.assertEqual(runner.call_count, 1)

    def test_concurrent_revision_during_generation_withholds_pack(self):
        job = decide(self.store, self.command)
        material = copy.deepcopy(self.material)
        material.update(proposal_id=self.proposal["proposal_id"], proposal_hash=self.proposal["proposal_hash"], proposal_version=self.proposal["version"])
        def revise(workspace, output, **kwargs):
            submit_proposal(self.store, self.proposal["draft"])
            submit_material(self.store, kwargs["approval_id"], material, material_format="simulation-v2")
        self.assertEqual(run(self.store, job["job_id"], revise)["status"], "failed")
        self.assertIsNone(export(self.store.workspace)["materials"])

    def expire(self, job_id, status="running"):
        with self.store.connect() as db:
            db.execute("UPDATE web_practice_jobs SET status=?,updated_at=?,heartbeat_at=NULL WHERE job_id=?",
                (status, "2000-01-01T00:00:00+00:00", job_id))

    def matching_material(self):
        return {**copy.deepcopy(self.material), "proposal_id": self.proposal["proposal_id"],
            "proposal_hash": self.proposal["proposal_hash"], "proposal_version": self.proposal["version"]}

    def test_expired_queue_is_read_only_failed_and_requires_explicit_retry(self):
        job = decide(self.store, self.command)
        self.expire(job["job_id"], "queued")
        before = self.store.path.read_bytes()
        self.assertEqual(export(self.store.workspace)["generation"]["error_code"], "generation_interrupted")
        self.assertEqual(self.store.path.read_bytes(), before)
        self.assertEqual(decide(self.store, self.command)["status"], "failed")
        runner = Mock()
        self.assertEqual(run(self.store, job["job_id"], runner)["status"], "not_claimed")
        runner.assert_not_called()
        new = decide(self.store, {**self.command, "retry": True})
        self.assertNotEqual(job["job_id"], new["job_id"])
        with self.store.connect() as db:
            self.assertEqual(db.execute("SELECT status FROM web_practice_jobs WHERE job_id=?", (job["job_id"],)).fetchone()[0], "failed")
            self.assertEqual(db.execute("SELECT COUNT(*) FROM preparation_approvals WHERE proposal_id=?", (self.proposal["proposal_id"],)).fetchone()[0], 1)

    def test_live_claim_cannot_be_retried_or_cancelled_by_duplicate_launch_failure(self):
        job = decide(self.store, self.command)
        def live(workspace, output, **kwargs):
            self.assertTrue(renew(self.store, job["job_id"]))
            self.assertEqual(fail_launch(self.store, job["job_id"])["status"], "running")
            same = decide(self.store, {**self.command, "retry": True})
            self.assertEqual(same["job_id"], job["job_id"])
            self.assertEqual(same["status"], "running")
            submit_material(self.store, kwargs["approval_id"], self.matching_material(), material_format="simulation-v2")
        self.assertEqual(run(self.store, job["job_id"], live)["status"], "ready")

    def test_expired_worker_cannot_renew_invoke_or_publish(self):
        job = decide(self.store, self.command)
        def late(workspace, output, **kwargs):
            self.expire(job["job_id"])
            self.assertFalse(renew(self.store, job["job_id"]))
            with self.assertRaises(ValueError): check_before_model(self.store)
            with self.assertRaises(ValueError):
                submit_material(self.store, kwargs["approval_id"], self.matching_material(), material_format="simulation-v2")
        self.assertEqual(run(self.store, job["job_id"], late)["error_code"], "generation_interrupted")
        self.assertIsNone(export(self.store.workspace)["materials"])

    def test_real_node_rechecks_lease_before_calling_model(self):
        from interview.context_preparation_flow import run_node
        job = decide(self.store, self.command)
        invoke = Mock()
        def paused(workspace, output, **kwargs):
            self.expire(job["job_id"])
            result = run_node(workspace, output, invoke_fn=invoke, **kwargs)
            self.assertEqual(result["status"], "validation_failed")
        self.assertEqual(run(self.store, job["job_id"], paused)["status"], "failed")
        invoke.assert_not_called()

    def test_job_scope_cannot_cross_candidate_workspaces(self):
        from interview.storage import Store
        job = decide(self.store, self.command)
        with job_scope(Store(self.root / "another-candidate"), job["job_id"]):
            with self.assertRaises(ValueError): check_before_model(self.store)

    def test_old_worker_return_after_retry_cannot_publish_or_change_new_attempt(self):
        job = decide(self.store, self.command)
        def old(workspace, output, **kwargs):
            self.expire(job["job_id"])
            new = decide(self.store, {**self.command, "retry": True})
            self.new_job = new
            with self.assertRaises(ValueError):
                submit_material(self.store, kwargs["approval_id"], self.matching_material(), material_format="simulation-v2")
            return {"status": "material_ready"}  # A result string cannot bypass publication fencing.
        self.assertEqual(run(self.store, job["job_id"], old)["status"], "failed")
        self.assertEqual(export(self.store.workspace)["generation"]["job_id"], self.new_job["job_id"])
        self.assertEqual(export(self.store.workspace)["generation"]["status"], "queued")
        self.assertIsNone(export(self.store.workspace)["materials"])

    def test_commit_then_worker_failure_preserves_ready_without_duplicate_generation(self):
        job = decide(self.store, self.command)
        def committed(workspace, output, **kwargs):
            submit_material(self.store, kwargs["approval_id"], self.matching_material(), material_format="simulation-v2")
            self.assertEqual(export(self.store.workspace)["generation"]["status"], "ready")
            raise OSError("Simulated diagnostic-write failure after the material transaction")
        self.assertEqual(run(self.store, job["job_id"], committed)["status"], "ready")
        self.assertEqual(decide(self.store, {**self.command, "retry": True})["status"], "material_ready")
        self.assertEqual(fail_launch(self.store, job["job_id"])["status"], "ready")

    def test_material_transaction_rollback_also_rolls_back_job_ready(self):
        job = decide(self.store, self.command)
        with self.store.connect() as db:
            db.execute("CREATE TRIGGER reject_test_material BEFORE INSERT ON preparation_materials BEGIN SELECT RAISE(ABORT,'injected storage failure'); END")
        def publish(workspace, output, **kwargs):
            submit_material(self.store, kwargs["approval_id"], self.matching_material(), material_format="simulation-v2")
        self.assertEqual(run(self.store, job["job_id"], publish)["status"], "failed")
        self.assertIsNone(export(self.store.workspace)["materials"])

    def test_concurrent_recovery_keeps_one_new_attempt(self):
        job = decide(self.store, self.command)
        self.expire(job["job_id"])
        with ThreadPoolExecutor(max_workers=2) as executor:
            jobs = list(executor.map(lambda _: decide(self.store, {**self.command, "retry": True}), range(2)))
        self.assertEqual(jobs[0]["job_id"], jobs[1]["job_id"])
        with self.store.connect() as db:
            self.assertEqual(db.execute("SELECT COUNT(*) FROM web_practice_jobs WHERE proposal_id=?", (self.proposal["proposal_id"],)).fetchone()[0], 2)

    def test_expired_legacy_attempt_does_not_bypass_revised_plan_or_input_guard(self):
        job = decide(self.store, self.command)
        self.expire(job["job_id"])
        submit_proposal(self.store, self.proposal["draft"])
        with self.assertRaises(ValueError): decide(self.store, {**self.command, "retry": True})
        with self.store.connect() as db:
            self.assertEqual(db.execute("SELECT COUNT(*) FROM web_practice_jobs").fetchone()[0], 1)

    def test_interrupted_child_process_becomes_retryable_without_model_calls(self):
        job = decide(self.store, self.command)
        signal = self.root / "claimed.txt"
        script = """import sys, time
from pathlib import Path
from interview.storage import Store
from interview.web_workflow import run
def blocked(workspace, output, **kwargs):
    Path(sys.argv[3]).write_text('claimed', encoding='utf-8')
    time.sleep(60)
run(Store(Path(sys.argv[1])), sys.argv[2], blocked)
"""
        process = subprocess.Popen([sys.executable, "-c", script, str(self.store.workspace), job["job_id"], str(signal)],
            cwd=Path(__file__).resolve().parents[1], stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
        try:
            deadline = time.monotonic() + 15
            while not signal.exists() and process.poll() is None and time.monotonic() < deadline:
                time.sleep(0.02)
            self.assertTrue(signal.exists(), "The fictional worker must claim before interruption")
        finally:
            process.kill()
            process.communicate(timeout=10)
        self.assertEqual(export(self.store.workspace)["generation"]["status"], "running")
        self.expire(job["job_id"])
        self.assertEqual(export(self.store.workspace)["generation"]["status"], "failed")
        new = decide(self.store, {**self.command, "retry": True})
        self.assertEqual(new["status"], "queued")
        self.assertIsNone(export(self.store.workspace)["materials"])

    def test_background_heartbeat_renews_only_current_running_attempt(self):
        job = decide(self.store, self.command)
        with patch("interview.web_workflow.HEARTBEAT_SECONDS", 0.01), patch("interview.web_workflow.renew", wraps=renew) as pulse:
            def wait_for_pulse(workspace, output, **kwargs):
                deadline = time.monotonic() + 5
                while not pulse.call_count and time.monotonic() < deadline:
                    time.sleep(0.01)
                self.assertGreater(pulse.call_count, 0)
                submit_material(self.store, kwargs["approval_id"], self.matching_material(), material_format="simulation-v2")
            self.assertEqual(run(self.store, job["job_id"], wait_for_pulse)["status"], "ready")
        self.assertFalse(renew(self.store, job["job_id"]))

    def test_heartbeat_keeps_public_state_stable_for_browser_polling(self):
        job = decide(self.store, self.command)
        def running(workspace, output, **kwargs):
            before = export(self.store.workspace)["generation"]
            self.assertTrue(renew(self.store, job["job_id"]))
            self.assertEqual(export(self.store.workspace)["generation"], before)
            submit_material(self.store, kwargs["approval_id"], self.matching_material(), material_format="simulation-v2")
        self.assertEqual(run(self.store, job["job_id"], running)["status"], "ready")

    def test_additive_legacy_schema_upgrade_preserves_original_attempt(self):
        with self.store.connect() as db:
            db.execute("CREATE TABLE web_practice_jobs(proposal_id TEXT NOT NULL,job_id TEXT PRIMARY KEY,approval_id TEXT NOT NULL,status TEXT NOT NULL,updated_at TEXT NOT NULL,output_path TEXT,error_code TEXT)")
            db.execute("INSERT INTO web_practice_jobs VALUES ('legacy-plan','legacy-job','legacy-approval','running','2000-01-01T00:00:00+00:00',NULL,NULL)")
        original = self.store.path.read_bytes()
        export(self.store.workspace)  # Legacy reads do not migrate the database.
        self.assertEqual(self.store.path.read_bytes(), original)
        decide(self.store, self.command)
        with self.store.connect() as db:
            old = db.execute("SELECT * FROM web_practice_jobs WHERE job_id='legacy-job'").fetchone()
            self.assertEqual(old["status"], "running")
            self.assertEqual(old["updated_at"], "2000-01-01T00:00:00+00:00")
            self.assertIsNone(old["heartbeat_at"])

    def test_clock_boundary_and_malformed_legacy_timestamps_fail_closed(self):
        row = {"job_id": "fixture", "status": "running", "updated_at": "2026-10-30T10:00:00+00:00", "error_code": None}
        with patch("interview.practice_jobs.now", return_value="2026-10-30T10:01:59+00:00"):
            self.assertEqual(public_job(row)["status"], "running")
        with patch("interview.practice_jobs.now", return_value="2026-10-30T10:02:00+00:00"):
            self.assertEqual(public_job(row)["status"], "failed")
            for value in ("invalid", "2026-10-30T10:00:00", "2026-10-31T10:00:00+00:00"):
                self.assertEqual(public_job({**row, "updated_at": value})["status"], "failed")
