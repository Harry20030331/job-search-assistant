"""Offline inbox delivery/recovery contracts, not evidence of live Gmail success."""
import base64
import copy
import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

from interview.google_adapter import GoogleAccessError
from interview.inbox import GmailInbox, InboxStore, ManualReview, normalize_message
from interview.inbox_worker import poll_once, process_next
from interview.triage import TriageNode


class HTTPFailure(Exception):
    def __init__(self, status):
        self.resp = SimpleNamespace(status=status)
        super().__init__("private transport content must not appear in public output")


class Request:
    def __init__(self, fn): self.fn = fn
    def execute(self, num_retries=0):
        assert num_retries == 0
        return copy.deepcopy(self.fn())


def resource(message_id, *, thread="thread-1", date=100, body="We invite you to a technical interview.", html=False, labels=None):
    raw = ("Subject: Fictional interview\r\nMessage-ID: <" + message_id + "@example.invalid>\r\nContent-Type: text/" + ("html" if html else "plain") + "; charset=utf-8\r\n\r\n" + body).encode()
    return {"id": message_id, "threadId": thread, "internalDate": str(date), "labelIds": ["INBOX"] if labels is None else labels,
            "raw": base64.urlsafe_b64encode(raw).decode().rstrip("=")}


class FakeGmail:
    def __init__(self):
        self.email, self.history_id = "test@example.invalid", "100"
        self.list_pages = {None: {"messages": [{"id": "a", "threadId": "thread-1"}]}}
        self.history_pages = {None: {"historyId": "110", "history": []}}
        self.resources = {"a": resource("a")}
        self.list_calls, self.read_calls, self.history_calls = [], [], []
        self.current_resource = None

    def users(self): return self
    def messages(self): self.current_resource = "messages"; return self
    def history(self): self.current_resource = "history"; return self
    def threads(self): self.current_resource = "threads"; return self
    def getProfile(self, **kwargs): return Request(lambda: {"emailAddress": self.email, "historyId": self.history_id})

    def list(self, **kwargs):
        kind = self.current_resource
        def fn():
            target = self.history_pages if kind == "history" else self.list_pages
            (self.history_calls if kind == "history" else self.list_calls).append(kwargs)
            value = target[kwargs.get("pageToken")]
            if isinstance(value, Exception): raise value
            return value
        return Request(fn)

    def get(self, **kwargs):
        kind = self.current_resource
        def fn():
            if kind == "threads":
                return {"id": kwargs["id"], "messages": [{"id": k} for k, r in self.resources.items() if not isinstance(r, Exception) and r["threadId"] == kwargs["id"]]}
            self.read_calls.append(kwargs["id"])
            value = self.resources.get(kwargs["id"], HTTPFailure(404))
            if isinstance(value, Exception): raise value
            return value
        return Request(fn)


class InboxTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.time = [1000.0]
        self.store = InboxStore(self.root / "inbox.sqlite3", "test@example.invalid", now=lambda: self.time[0])
        self.gmail = FakeGmail()
        self.inbox = GmailInbox(self.store, self.gmail)

    def tearDown(self): self.temp.cleanup()

    def classifier(self, category="invitation", interview_id=None):
        def classify(mail, destination, settings):
            latest = next(m for m in mail.messages if m.source_id == mail.latest_source_id)
            return TriageNode.model_validate({"status": "ready", "questions": [], "triage": {
                "latest_source_id": latest.source_id, "category": category, "interview_id": interview_id,
                "evidence": [{"source_id": latest.source_id, "quote": latest.body}], "unknowns": [], "rationale": "Scripted test only"}})
        return classify

    def process(self, **kwargs):
        return process_next(self.inbox, self.root / "attempts", {}, **kwargs)

    def test_bootstrap_pagination_anchor_precedes_listing_and_restart_deduplicates(self):
        self.gmail.list_pages = {None: {"messages": [{"id": "a"}], "nextPageToken": "p2"}, "p2": {"messages": [{"id": "a"}, {"id": "b"}]}}
        result = self.inbox.sync()
        self.assertEqual((result["new_jobs"], result["pages"], self.store.cursor()), (2, 2, "100"))
        restarted = InboxStore(self.store.path, self.store.account, now=lambda: self.time[0])
        self.gmail.history_pages = {None: {"historyId": "150", "history": [{"messagesAdded": [{"message": {"id": "b"}}, {"message": {"id": "c"}}]}]}}
        result = GmailInbox(restarted, self.gmail).sync()
        self.assertEqual((result["new_jobs"], restarted.cursor(), self.store.counts()["jobs"]["pending"]), (1, "150", 3))
        self.assertEqual(self.gmail.history_calls[0]["startHistoryId"], "100")

    def test_incomplete_scan_preserves_queued_ids_but_never_commits_cursor(self):
        self.gmail.list_pages[None]["nextPageToken"] = "p2"
        self.gmail.list_pages["p2"] = HTTPFailure(503)
        with self.assertRaises(GoogleAccessError): self.inbox.sync()
        self.assertIsNone(self.store.cursor())
        self.assertEqual(self.store.counts()["jobs"], {"pending": 1})
        self.gmail.list_pages["p2"] = {"messages": [{"id": "b"}]}
        self.assertEqual(self.inbox.sync()["new_jobs"], 1)

    def test_history_pages_are_all_durable_before_cursor_and_specific_changes_deduplicate(self):
        self.store.advance(None, "90")
        self.gmail.history_pages = {
            None: {"historyId": "200", "history": [{"messagesAdded": [{"message": {"id": "a"}}]}], "nextPageToken": "p2"},
            "p2": HTTPFailure(503)}
        with self.assertRaises(GoogleAccessError): self.inbox.sync()
        self.assertEqual(self.store.cursor(), "90")
        self.gmail.history_pages["p2"] = {"historyId": "210", "history": [{"messages": [{"id": "should-not-enqueue"}], "labelsAdded": [{"message": {"id": "a"}}, {"message": {"id": "b"}}]}]}
        self.assertEqual(self.inbox.sync()["new_jobs"], 1)
        self.assertEqual(self.store.cursor(), "210")
        self.assertEqual(self.store.counts()["jobs"]["pending"], 2)

    def test_expired_cursor_404_recovers_but_auth_failure_does_not_reset(self):
        self.store.advance(None, "90")
        self.gmail.history_pages[None] = HTTPFailure(401)
        with self.assertRaises(GoogleAccessError): self.inbox.sync()
        self.assertEqual(self.store.cursor(), "90")
        self.gmail.history_pages[None] = HTTPFailure(404)
        result = self.inbox.sync()
        self.assertEqual((result["mode"], self.store.cursor()), ("expired_cursor_recovery", "100"))

    def test_page_limit_cursor_cas_and_backward_cursor_protection(self):
        self.gmail.list_pages[None]["nextPageToken"] = "p2"
        with self.assertRaises(GoogleAccessError): GmailInbox(self.store, self.gmail, max_pages=1).sync()
        self.assertIsNone(self.store.cursor())
        self.store.advance(None, "100")
        with self.assertRaises(GoogleAccessError): self.store.advance(None, "110")
        with self.assertRaises(GoogleAccessError): self.store.advance("100", "99")
        self.assertEqual(self.store.cursor(), "100")

    def test_wrong_live_account_and_wrong_local_account_cannot_read_mail(self):
        self.gmail.email = "different@example.invalid"
        with self.assertRaises(GoogleAccessError): self.inbox.sync()
        self.assertEqual((self.gmail.list_calls, self.gmail.read_calls), ([], []))
        with self.assertRaises(GoogleAccessError): InboxStore(self.store.path, "different@example.invalid")
        self.assertIsNone(self.store.cursor())

    def test_worker_lease_recovery_rejects_stale_writer_and_caps_abandoned_attempts(self):
        self.store.enqueue([{"id": "a"}])
        first = self.store.claim(lease_seconds=10)
        self.assertIsNone(self.store.claim())
        self.time[0] += 11
        second = self.store.claim(lease_seconds=10)
        with self.assertRaises(ValueError): self.store.complete(first, "stale", {})
        self.time[0] += 11
        third = self.store.claim(lease_seconds=10)
        self.assertEqual((second["attempts"], third["attempts"]), (2, 3))
        self.time[0] += 11
        self.assertIsNone(self.store.claim())
        self.assertEqual(self.store.counts()["jobs"], {"failed": 1})

    def test_transient_classifier_error_retries_with_backoff_without_handoff(self):
        self.inbox.sync()
        def fail(*args): raise GoogleAccessError("do not expose raw error")
        self.assertEqual(self.process(classify_fn=fail)["status"], "pending")
        self.assertEqual(self.process(classify_fn=fail)["status"], "no_eligible_job")
        self.time[0] += 21
        self.assertEqual(self.process(classify_fn=self.classifier())["status"], "triaged")
        self.assertEqual(self.store.counts()["handoffs"], 1)

    def test_thread_binding_fills_missing_association_but_preserves_raw_prediction(self):
        self.inbox.sync()
        self.store.bind("thread-1", "interview-existing", "/trusted/live/work")
        result = self.process(classify_fn=self.classifier("reschedule"))
        self.assertEqual(result["route"], "reschedule_review")
        with self.store.connect() as db:
            saved = json.loads(db.execute("SELECT result FROM jobs").fetchone()[0])
            handoff = json.loads(db.execute("SELECT payload FROM handoffs").fetchone()[0])
        self.assertIsNone(saved["raw_triage"]["interview_id"])
        self.assertEqual(saved["effective_triage"]["interview_id"], "interview-existing")
        self.assertFalse(handoff["calendar_write_authorized"])
        self.assertFalse(handoff["full_preparation_authorized"])
        self.assertEqual(self.process(classify_fn=self.classifier())["status"], "no_eligible_job")
        self.assertEqual(self.store.counts()["handoffs"], 1)

    def test_ambiguous_thread_and_no_binding_go_to_review(self):
        self.inbox.sync()
        for name in ["interview-one", "interview-two"]: self.store.bind("thread-1", name)
        self.assertEqual(self.process(classify_fn=self.classifier("cancellation"))["route"], "needs_review")

    def test_future_replies_are_not_exposed_to_earlier_job(self):
        self.gmail.resources.update({"old": resource("old", date=50), "future": resource("future", date=150, body="Private future correction")})
        self.inbox.sync()
        observed = []
        def classify(mail, *args):
            observed.extend(m.source_id for m in mail.messages)
            return self.classifier()(mail, *args)
        self.process(classify_fn=classify)
        self.assertEqual(set(observed), {"a", "old"})

    def test_html_only_is_textual_and_assets_scripts_and_attachments_not_fetched(self):
        message = normalize_message(resource("a", html=True, body="<html><head><style>secret</style></head><body><p>Interview invitation</p><script>send_mail()</script><img src='https://example.invalid/tracker'></body></html>"))
        self.assertIn("Interview invitation", message["body"])
        self.assertNotIn("send_mail", message["body"])
        self.assertNotIn("secret", message["body"])
        self.assertNotIn("tracker", message["body"])

    def test_deleted_mail_excluded_labels_and_later_label_reentry(self):
        self.inbox.sync()
        self.gmail.resources["a"]["labelIds"] = ["TRASH"]
        def must_not_call(*args): self.fail("Excluded mail must not reach the classifier")
        self.assertEqual(self.process(classify_fn=must_not_call)["status"], "skipped")
        self.gmail.resources["a"]["labelIds"] = ["INBOX"]
        self.store.enqueue([{"id": "a"}])
        self.assertEqual(self.process(classify_fn=self.classifier())["status"], "triaged")
        self.store.enqueue([{"id": "deleted"}])
        self.assertEqual(self.process(classify_fn=must_not_call)["status"], "gone")

    def test_ordinary_mail_has_no_handoff_and_oversized_mail_has_manual_handoff(self):
        self.inbox.sync()
        self.assertFalse(self.process(classify_fn=self.classifier("ordinary"))["handoff_queued"])
        self.gmail.resources["large"] = resource("large", body="x" * 60_001)
        self.store.enqueue([{"id": "large"}])
        self.assertEqual(self.process(classify_fn=self.classifier())["status"], "needs_review")
        self.assertEqual(self.store.counts()["handoffs"], 1)

    def test_failed_handoff_transaction_does_not_acknowledge_job(self):
        self.store.enqueue([{"id": "a"}])
        job = self.store.claim()
        with self.store.connect() as db:
            db.execute("CREATE TRIGGER reject_handoff BEFORE INSERT ON handoffs BEGIN SELECT RAISE(ABORT, 'test failure'); END")
        with self.assertRaises(Exception): self.store.complete(job, "key", {}, {"handoff_id": "key"})
        with self.store.connect() as db:
            self.assertEqual(db.execute("SELECT state FROM jobs").fetchone()[0], "processing")
            self.assertEqual(db.execute("SELECT count(*) FROM classifications").fetchone()[0], 0)

    def test_same_message_content_mutation_is_not_silently_overwritten(self):
        original = normalize_message(resource("a"))
        self.store.cache_message(original)
        changed = normalize_message(resource("a", body="A changed invitation"))
        with self.assertRaises(ManualReview): self.store.cache_message(changed)

    def test_reformatted_quote_is_rejected_not_silently_repaired(self):
        self.gmail.resources["a"] = resource("a", body="*Date:* November 3\r\n*Time:* 10 AM")
        self.inbox.sync()
        def classify(mail, *args):
            node = self.classifier()(mail, *args)
            node.triage.evidence[0].quote = "Date: November 3\nTime: 10 AM"
            return node
        self.assertEqual(self.process(classify_fn=classify)["status"], "pending")
        with self.store.connect() as db:
            self.assertEqual(db.execute("SELECT error_code FROM jobs").fetchone()[0], "triage_contract_failed")
            self.assertEqual(db.execute("SELECT count(*) FROM handoffs").fetchone()[0], 0)

    def test_missing_date_and_multiple_interviews_do_not_create_automatic_proposals(self):
        broken = resource("a")
        broken.pop("internalDate")
        with self.assertRaises(ManualReview): normalize_message(broken)
        self.inbox.sync()
        self.store.bind("thread-1", "one")
        self.store.bind("thread-1", "two")
        self.assertEqual(self.process(classify_fn=self.classifier("invitation"))["route"], "needs_review")

    def test_handoff_dispatch_crash_is_reclaimable_and_old_dispatch_cannot_finish(self):
        self.inbox.sync()
        self.process(classify_fn=self.classifier())
        first = self.store.claim_handoff()
        self.assertIsNone(self.store.claim_handoff())
        self.time[0] += 901
        second = self.store.claim_handoff()
        self.assertEqual(second["dispatch_attempts"], 2)
        with self.assertRaises(ValueError):
            self.store.finish_handoff(first["handoff_id"], first["dispatch_token"], "checked_existing", {})
        self.store.finish_handoff(second["handoff_id"], second["dispatch_token"], "checked_existing", {})

    def test_poll_cycle_discovers_new_arrival_and_dispatches_once_after_restart(self):
        def dispatch():
            handoff = self.store.claim_handoff()
            if not handoff:
                return {"status": "no_pending_handoff"}
            self.store.finish_handoff(handoff["handoff_id"], handoff["dispatch_token"], "awaiting_user", {})
            return {"status": "awaiting_user"}
        first = poll_once(self.inbox, self.root / "attempts", {}, classify_fn=self.classifier(), dispatch_fn=dispatch)
        self.assertEqual(first["proposals"][0]["status"], "awaiting_user")
        self.gmail.resources["new"] = resource("new", thread="new-thread", date=200)
        self.gmail.history_pages[None] = {"historyId": "120", "history": [{"messagesAdded": [{"message": {"id": "new"}}]}]}
        self.inbox = GmailInbox(InboxStore(self.store.path, self.store.account, now=lambda: self.time[0]), self.gmail)
        second = poll_once(self.inbox, self.root / "attempts", {}, classify_fn=self.classifier(), dispatch_fn=dispatch)
        self.assertEqual(second["sync"]["new_jobs"], 1)
        self.assertEqual(second["classification"][0]["category"], "invitation")
        third = poll_once(self.inbox, self.root / "attempts", {}, classify_fn=self.classifier(), dispatch_fn=dispatch)
        self.assertEqual(third["classification"][0]["status"], "no_eligible_job")
        self.assertEqual(third["proposals"][0]["status"], "no_pending_handoff")


if __name__ == "__main__":
    unittest.main()
