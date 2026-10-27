"""Fictional identity isolation, scoped retrieval, revisions and approval invalidation."""
import copy
import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

from interview import candidate_learning as learning
from interview.context_preparation import capture_request, verify_binding
from interview.context_preparation_flow import run_node
from interview.debrief import append_raw, commit
from interview.enrichment import start, finish
from interview.freshness import check
from interview.preparation import approve, approved_plan, context_fingerprint, submit_proposal
from interview.preparation_context import ContextRequest
from interview.storage import Store, canonical, read_json, write_json
from interview.team_bridge import stage

CLOCK = "2026-10-26T18:00:00+00:00"
SCOPE = {"topics": ["ml_evaluation"], "reason": "Fictional invitation explicitly requests model evaluation."}


class CandidateLearningTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.clock = patch.object(learning, "now", return_value=CLOCK)
        self.clock.start()
        self.store, self.bundle = self.candidate("a")
        self.account = self.account_store("account-a")
        self.binding = self.root / "bindings/a.json"
        learning.bind(self.store, self.account.workspace, self.binding, origin="synthetic_test_script", evidence="Fictional candidate A explicitly selects fictional account A.")

    def tearDown(self):
        self.clock.stop()
        self.temp.cleanup()

    def candidate(self, key):
        path = self.root / key / "candidate.json"
        profile = {"identity": {"fullName": "Same Fictional Name"}, "preparation_budget_minutes": 30, "priorities": ["Model evaluation"]}
        write_json(path, {"schemaVersion": 2, "identity": profile["identity"], "skills": ["Python"]})
        bundle = {"schemaVersion": 1, "token": "fictional", "candidateSource": {"protocol": "candidate-source-v1", "profile_path": str(path)},
            "sourceVersions": [{"path": str(path), "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}],
            "profile": profile, "application": {"job_id": "job-" + key, "application_id": None, "interview_id": "interview-" + key,
                "company": "Cedar Fictional", "role": "ML Engineer", "round": "technical"},
            "sources": {"canonical-candidate": canonical(profile["identity"]), "preferences": "Use supplied facts only.",
                "invitation": "Fictional technical interview covering model evaluation."}}
        store = Store(Path(stage(bundle, self.root / key / "run")["workspace"]))
        return store, bundle

    def account_store(self, key):
        store = Store(self.root / key / "learning")
        store.initialize({"clock": CLOCK, "history": []}, "D")
        with store.connect() as db:
            db.execute("INSERT INTO meta VALUES ('account',?)", (key + "@example.invalid",))
        return store

    def note(self, key, *, store=None, role="ML Engineer", round_name="technical", topic="ml_evaluation", status="active", parent=None, occurred="2026-10-20T12:00:00+00:00", text=None):
        store = store or self.account
        text = text or "In this fictional practice I struggled to explain data leakage."
        raw = append_raw(store, record_id=key, interview_id="historical-" + key, text=text, occurred_at=occurred,
            subject={"company": "Other Fictional", "role": role, "round": round_name}, mode="practice", origin="synthetic_test_script")
        result = commit(store, key, {"summary": "Fictional self-assessment", "items": [{"topic": topic, "observation": text,
            "quote": text, "attribution": "self_assessment", "status": status, "supersedes_id": parent,
            "suggested_practice": "Rehearse train/test leakage checks with one counterexample."}], "unknowns": []})
        return result["memory_ids"][0], raw

    def attach(self):
        return learning.attach(self.store, self.binding, SCOPE)

    def test_same_name_different_candidate_and_other_account_do_not_leak(self):
        self.note("a-only", text="Fictional A private rehearsal.")
        other = self.account_store("account-b")
        self.note("b-only", store=other, text="Fictional B private rehearsal.")
        other_candidate, _ = self.candidate("b")
        with self.assertRaisesRegex(ValueError, "different canonical candidate"):
            learning.attach(other_candidate, self.binding, SCOPE)
        result = self.attach()
        payload = canonical(learning.sources(self.store))
        self.assertEqual(result["retrieved_count"], 1)
        self.assertIn("Fictional A private rehearsal", payload)
        self.assertNotIn("Fictional B private rehearsal", payload)
        self.assertEqual(self.store.rows("history"), [])
        self.assertEqual(self.store.rows("memories"), [])
        # No account address, token path or unrelated raw record is given to the actor.
        self.assertNotIn("@example.invalid", payload)
        self.assertNotIn(str(self.account.workspace), payload)

    def test_scope_excludes_other_roles_rounds_topics_resolved_superseded_old_and_future(self):
        old, _ = self.note("superseded")
        wanted, raw = self.note("revision", parent=old, text="Only this fictional rehearsal still needs leakage work.")
        self.note("role", role="Product Data Scientist")
        self.note("round", round_name="HR")
        self.note("topic", topic="sql")
        self.note("resolved", status="resolved")
        self.note("old", occurred="2025-10-20T12:00:00+00:00")
        future, _ = self.note("future")
        with self.account.connect() as db:
            row = db.execute("SELECT payload FROM memories WHERE memory_id=?", (future,)).fetchone()
            value = json.loads(row[0]); value["created_at"] = "2027-01-01T00:00:00Z"
            db.execute("UPDATE memories SET payload=? WHERE memory_id=?", (canonical(value), future))
        result = self.attach()
        self.assertEqual(result["retrieved_memory_ids"], [wanted])
        source = learning.sources(self.store)[0]
        self.assertIn(raw["text"], source["content"])
        self.assertEqual((source["kind"], source["origin"], source["relationship"]), ("practice", "user_record", "context_only"))
        self.assertEqual(self.account.rows("history")[0]["record_id"], "superseded")

    def test_unknown_round_is_preserved_not_invented(self):
        self.note("unknown", round_name=None)
        self.attach()
        self.assertIn('"round":null', learning.sources(self.store)[0]["content"])

    def test_age_expiry_invalidates_snapshot_without_account_write(self):
        self.note("age")
        self.attach()
        with patch.object(learning, "now", return_value="2027-10-26T18:00:00Z"):
            with self.assertRaisesRegex(ValueError, "age window"):
                check(self.store)

    def test_read_only_snapshot_and_fingerprint_bind_selection(self):
        self.note("selected")
        before = hashlib.sha256(self.account.path.read_bytes()).hexdigest()
        fingerprint = context_fingerprint(self.store)
        result = self.attach()
        self.assertEqual(before, hashlib.sha256(self.account.path.read_bytes()).hexdigest())
        self.assertNotEqual(fingerprint, result["input_fingerprint"])
        self.assertEqual(result["account_writes"], 0)
        with self.assertRaisesRegex(ValueError, "once"):
            self.attach()

    def approved(self):
        self.note("initial")
        self.attach()
        record = submit_proposal(self.store, {"interview_id": self.bundle["application"]["interview_id"], "budget_minutes": 30,
            "priorities": ["Evaluation"], "sections": [{"section_id": str(i), "topic": "Evaluation", "minutes": 10,
                "objective": "Fictional rehearsal", "basis_refs": ["profile"]} for i in range(3)], "source_refs": ["profile"], "unknowns": []})
        approval = approve(self.store, record["interview_id"], record["proposal_id"], record["proposal_hash"], "synthetic_test_script: exact fictional plan")
        self.assertEqual(approved_plan(self.store, record["interview_id"], approval)["status"], "plan_approved")
        return record, approval

    def test_new_debrief_invalidates_exact_approval_and_blocks_model_call(self):
        record, approval = self.approved()
        self.note("new")
        with self.assertRaisesRegex(ValueError, "revised debrief"):
            approved_plan(self.store, record["interview_id"], approval)
        fake = Mock()
        with self.assertRaisesRegex(ValueError, "revised debrief"):
            run_node(self.store.workspace, self.root / "unused", approval_id=approval, invoke_fn=fake)
        fake.assert_not_called()

    def test_correction_resolves_old_issue_and_new_run_uses_current_version_only(self):
        original, raw = self.note("original")
        self.attach()
        self.note("correction", parent=original, status="resolved", text="In this fictional practice I can now explain the leakage check.")
        with self.assertRaises(ValueError): check(self.store)
        fresh = Store(Path(stage(self.bundle, self.root / "fresh")["workspace"]))
        result = learning.attach(fresh, self.binding, SCOPE)
        self.assertEqual(result["retrieved_count"], 0)
        self.assertEqual(self.account.rows("history")[0], raw)

    def test_revocation_invalidates_approval(self):
        record, approval = self.approved()
        learning.revoke(self.binding, origin="synthetic_test_script", evidence="Fictional user disconnects this candidate/account link.")
        with self.assertRaisesRegex(ValueError, "revoked"):
            approved_plan(self.store, record["interview_id"], approval)

    def test_replaced_account_or_tampered_snapshot_blocks(self):
        self.note("one")
        self.attach()
        with self.account.connect() as db:
            db.execute("UPDATE meta SET value='different@example.invalid' WHERE key='account'")
        with self.assertRaisesRegex(ValueError, "revised debrief"):
            check(self.store)
        with self.account.connect() as db:
            db.execute("UPDATE meta SET value='account-a@example.invalid' WHERE key='account'")
        original_binding = self.binding.read_bytes()
        binding = read_json(self.binding)
        binding["evidence"] = "Changed host assertion after snapshot creation"
        write_json(self.binding, binding)
        with self.assertRaisesRegex(ValueError, "binding changed"):
            check(self.store)
        self.binding.write_bytes(original_binding)
        path = self.store.workspace / "inputs/learning/snapshot.json"
        value = read_json(path); value["sources"][0]["content"] = "Tampered"
        write_json(path, value)
        with self.assertRaisesRegex(ValueError, "snapshot"):
            check(self.store)

    def test_capture_and_enrichment_preserve_exact_bound_practice_sources(self):
        self.note("active")
        self.attach()
        output = self.root / "capture"
        capture_request(self.store, output, association="verified")
        request = ContextRequest.model_validate(read_json(output / "request.json"))
        verify_binding(self.store, request)
        research = self.root / "research"
        start(self.store.workspace, research, association="verified", policy={"max_search_queries": 0, "max_opened_pages": 0}, mode="offline_fixture")
        summary = finish(research)
        finished = ContextRequest.model_validate(read_json(research / "request.json"))
        self.assertEqual([s.model_dump(mode="json") for s in finished.sources if s.kind == "practice"], learning.sources(self.store))
        self.assertEqual(summary["seed_reuse_count"], 0)
        self.assertEqual(read_json(research / "enrichment.json")["sources"], [])
        changed = request.model_copy(deep=True)
        changed.sources = [s for s in changed.sources if s.kind != "practice"]
        with self.assertRaisesRegex(ValueError, "explicitly bound"):
            verify_binding(self.store, changed)
        with self.assertRaisesRegex(ValueError, "must not replace"):
            capture_request(self.store, self.root / "injected", enrichment={"sources": learning.sources(self.store), "research": request.research.model_dump()})

    def test_binding_reuse_for_same_canonical_source_and_changed_experience(self):
        self.note("shared")
        bundle = copy.deepcopy(self.bundle)
        bundle["profile"]["skills"] = ["Python", "SQL"]
        bundle["application"]["job_id"] = "another-job"
        fresh = Store(Path(stage(bundle, self.root / "another-job-run")["workspace"]))
        self.assertEqual(learning.attach(fresh, self.binding, SCOPE)["retrieved_count"], 1)

    def test_legacy_stage_and_an_unbound_canonical_run_do_not_inherit_memory(self):
        capture_request(self.store, self.root / "no-learning")
        request = ContextRequest.model_validate(read_json(self.root / "no-learning/request.json"))
        self.assertFalse(any(s.kind == "practice" for s in request.sources))
        self.assertIsNone(self.store.optional_meta(learning.GUARD))
        bundle = copy.deepcopy(self.bundle); bundle.pop("candidateSource")
        legacy = Store(Path(stage(bundle, self.root / "legacy")["workspace"]))
        with self.assertRaisesRegex(ValueError, "Restage"):
            learning.bind(legacy, self.account.workspace, self.root / "unsupported.json", origin="synthetic_test_script", evidence="Fictional")

    def test_binding_is_exclusive_and_invalid_source_rejected_before_staging(self):
        with self.assertRaises(FileExistsError):
            learning.bind(self.store, self.account.workspace, self.binding, origin="synthetic_test_script", evidence="Fictional duplicate")
        bundle = copy.deepcopy(self.bundle)
        bundle["candidateSource"]["profile_path"] = str(self.root / "not-selected.json")
        with self.assertRaises(ValueError): stage(bundle, self.root / "bad-source")
        self.assertFalse((self.root / "bad-source").exists())


if __name__ == "__main__":
    unittest.main()
