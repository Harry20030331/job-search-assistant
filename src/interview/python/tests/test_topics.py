"""Topic compatibility, narrow evidence refinement and immutable legacy retrieval."""
import copy
import tempfile
import unittest
from pathlib import Path

from interview import candidate_learning
from interview.debrief import append_raw, commit
from interview.memory import search, upsert
from interview.storage import Store, canonical
from interview.topics import canonical_topics, memory_topics, observation_topics

CLOCK = "2026-10-30T18:00:00+00:00"
EXPERIMENT = "I struggled with the randomization unit and network interference."
MODEL = "I struggled to choose a hallucination metric for model evaluation."


class TopicTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.store = Store(Path(self.temp.name) / "learning")
        self.store.initialize({"clock": CLOCK, "history": []}, "D")

    def tearDown(self):
        self.temp.cleanup()

    def raw(self, key, text):
        return append_raw(self.store, record_id=key, interview_id="historical-" + key, text=text,
            occurred_at="2026-10-29T18:00:00+00:00", subject={"company": "Fictional Co", "role": "Product DS", "round": "technical"},
            mode="practice", origin="synthetic_test_script")

    def note(self, key="legacy", text=EXPERIMENT, topics=None, status="active"):
        raw = self.raw(key, text)
        value = {"memory_id": key, "source_id": key, "created_at": raw["created_at"], "company": raw["subject"]["company"],
            "role": raw["subject"]["role"], "round": raw["subject"]["round"], "topics": topics or ["evaluation"],
            "observation": text, "next_action": "Practice the reported issue.", "status": status, "supersedes_id": None}
        # A true old-format row and index, not a row already normalized by upsert.
        with self.store.connect() as db:
            db.execute("INSERT INTO memories VALUES (?,?)", (key, canonical(value)))
            db.execute("INSERT INTO memory_fts VALUES (?,?)", (key, " ".join([text, value["role"], *value["topics"]])))
        return value

    def test_write_aliases_and_broad_topics_use_the_same_evidence_limited_policy(self):
        self.assertEqual(canonical_topics(["A/B testing", "experiment-design", "ab_test"]), {"experimentation"})
        self.assertEqual(observation_topics(["evaluation"], EXPERIMENT), {"evaluation", "experimentation"})
        self.assertEqual(observation_topics(["evaluation"], MODEL), {"evaluation", "ml_evaluation"})
        self.assertEqual(observation_topics(["evaluation"], "I struggled with the product metric definition."), {"evaluation", "product_metrics"})
        self.assertEqual(observation_topics(["evaluation"], "Evaluation needs practice."), {"evaluation"})

    def test_new_upsert_and_debrief_commit_add_specific_topics_without_changing_originals(self):
        raw = self.raw("new", EXPERIMENT)
        result = commit(self.store, "new", {"summary": "Fictional report", "unknowns": [], "items": [{"topic": "evaluation", "observation": EXPERIMENT,
            "quote": EXPERIMENT, "attribution": "self_assessment", "status": "active", "supersedes_id": None, "suggested_practice": "Practice randomization."}]})
        note = self.store.rows("memories")[0]
        self.assertEqual(note["topics"], ["evaluation", "experimentation"])
        self.assertEqual(self.store.rows("history"), [raw])
        self.assertEqual(result["draft"]["items"][0]["topic"], "evaluation")
        self.raw("alias", "A separate fictional issue.")
        aliased = upsert(self.store, {"source_id": "alias", "created_at": CLOCK, "role": "Product DS", "topics": ["a/b testing"],
            "observation": "A separate fictional issue.", "next_action": "Practice."})
        self.assertEqual(aliased["topics"], ["experimentation"])

    def test_legacy_fts_miss_is_recovered_without_a_role_or_database_migration(self):
        wanted = self.note()
        before = self.store.path.read_bytes()
        self.assertEqual([n["memory_id"] for n in search(self.store, {"topics": ["experimental design"]})], [wanted["memory_id"]])
        self.assertEqual(self.store.path.read_bytes(), before)
        self.assertEqual(self.store.rows("memories")[0]["topics"], ["evaluation"])

    def test_model_evaluation_and_suggested_exercises_do_not_become_experiment_evidence(self):
        model = self.note("model", MODEL)
        advice = self.note("advice", "I struggled with evaluation.")
        advice["next_action"] = "Practice the randomization unit and network interference."
        with self.store.connect() as db:
            db.execute("UPDATE memories SET payload=? WHERE memory_id='advice'", (canonical(advice),))
        self.assertNotIn("experimentation", memory_topics(model))
        self.assertNotIn("experimentation", memory_topics(advice))
        self.assertEqual(search(self.store, {"topics": ["experimentation"]}), [])
        self.assertEqual([n["memory_id"] for n in search(self.store, {"topics": ["model evaluation"]})], ["model"])

    def test_other_sentences_in_a_raw_debrief_cannot_retag_a_selected_observation(self):
        note = self.note("mixed", MODEL + " " + EXPERIMENT)
        note["observation"] = MODEL
        with self.store.connect() as db:
            db.execute("UPDATE memories SET payload=? WHERE memory_id='mixed'", (canonical(note),))
        data = {"history": self.store.rows("history"), "memories": self.store.rows("memories")}
        application = {"company": "Fictional Co", "role": "Product DS", "round": "technical"}
        self.assertEqual(candidate_learning.select(data, application, {"topics": ["experimentation"], "reason": "Fictional scope"}, CLOCK), [])

    def test_topic_aliases_and_refinement_do_not_bypass_existing_scope_filters(self):
        wanted = self.note()
        variants = []
        for field, value in (("status", "resolved"), ("status", "superseded"), ("role", "Other Role"), ("round", "HR"),
                             ("created_at", "2099-01-01T00:00:00Z")):
            note = copy.deepcopy(wanted); note[field] = value; variants.append(note)
        old = self.raw("old", EXPERIMENT)
        note = copy.deepcopy(wanted); note.update(memory_id="old", source_id="old"); variants.append(note)
        history = self.store.rows("history"); history[-1]["occurred_at"] = "2020-01-01T00:00:00Z"
        scope = {"topics": ["a/b testing"], "reason": "Fictional scope"}
        application = {"company": "Fictional Co", "role": "Product DS", "round": "technical"}
        result = candidate_learning.select({"history": history, "memories": [wanted, *variants]}, application, scope, CLOCK)
        self.assertEqual([n["memory_id"] for n, _ in result], [wanted["memory_id"]])

    def test_specific_correction_can_resolve_a_legacy_note_without_cross_domain_revision(self):
        self.note()
        raw = self.raw("correction", "In this mock I can now explain the randomization unit.")
        item = {"topic": "A/B testing", "observation": raw["text"], "quote": raw["text"], "attribution": "self_assessment",
            "status": "resolved", "supersedes_id": "legacy", "suggested_practice": ""}
        commit(self.store, "correction", {"summary": "Scoped correction", "unknowns": [], "items": [item]})
        self.assertEqual([n["status"] for n in self.store.rows("memories")], ["superseded", "resolved"])
        self.assertEqual(search(self.store, {"topics": ["experimentation"]}), [])
        self.note("model", MODEL)
        other = self.raw("wrong", EXPERIMENT)
        item.update(observation=EXPERIMENT, quote=EXPERIMENT, supersedes_id="model", status="active")
        with self.assertRaisesRegex(ValueError, "same role and topic"):
            commit(self.store, "wrong", {"summary": "Wrong issue", "unknowns": [], "items": [item]})
        self.assertEqual(self.store.rows("memories")[-1]["status"], "active")


if __name__ == "__main__":
    unittest.main()
