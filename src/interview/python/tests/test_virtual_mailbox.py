"""Negative controls ensure virtual verification does not manufacture model success."""
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from evaluation.virtual_mailbox import ROOT, mail_case, scripted_classifier
from evaluation.virtual_services import VirtualMailbox
from interview.inbox import GmailInbox, InboxStore
from interview.storage import read_json


class VirtualVerificationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.root = Path(self.temp.name)
        self.case = read_json(ROOT / "benchmark/virtual-mailbox-v1/cases.json")["cases"][1]

    def tearDown(self): self.temp.cleanup()

    def test_wrong_prediction_is_retained_as_failure_without_gold_in_model_input(self):
        def incorrect(mail, destination, settings):
            self.assertEqual(set(mail.model_dump()), {"messages", "latest_source_id", "known_interviews"})
            self.assertNotIn("expected_category", str(mail.model_dump()))
            return scripted_classifier({**self.case, "category": "ordinary"})(mail, destination, settings)
        with patch("evaluation.virtual_mailbox.codex_classifier", side_effect=incorrect):
            result = mail_case(self.case, self.root / "wrong", live=True)
        self.assertFalse(result["passed"])
        self.assertFalse(result["checks"]["category"])
        self.assertEqual(result["predicted_category"], "ordinary")
        self.assertTrue((self.root / "wrong/result.json").exists())

    def test_invalid_evidence_is_not_repaired_or_retried_into_success(self):
        calls = []
        def invalid(mail, destination, settings):
            calls.append(1)
            node = scripted_classifier(self.case)(mail, destination, settings)
            node.triage.evidence[0].quote = "This quotation never appeared in the mail."
            return node
        with patch("evaluation.virtual_mailbox.codex_classifier", side_effect=invalid):
            result = mail_case(self.case, self.root / "invalid", live=True)
        self.assertFalse(result["passed"])
        self.assertFalse(result["checks"]["valid_classification"])
        self.assertEqual(len(calls), 1)
        self.assertEqual(result["status"], "pending")
        self.assertEqual(result["safe_error_code"], "triage_contract_failed")

    def test_virtual_resources_are_copied_and_unread_labels_are_preserved(self):
        mailbox = VirtualMailbox()
        mailbox.deliver("message", "Fictional interview invitation")
        inbox = GmailInbox(InboxStore(self.root / "inbox.sqlite3", mailbox.address), mailbox)
        inbox.sync(); inbox.context("message")
        observed = mailbox.users().messages().get(id="message").execute()
        observed["labelIds"].remove("UNREAD")
        self.assertIn("UNREAD", mailbox.messages_by_id["message"]["labelIds"])
        self.assertFalse(mailbox.deliver("message", "Duplicate transport delivery"))
