"""Host-only bounded Gmail sync/classification. No background monitoring enabled."""
from __future__ import annotations

import argparse
import hashlib
import json
import time
import uuid
from pathlib import Path

from interview.google_adapter import GoogleAccessError, execute_request, load_config, services
from interview.inbox import GmailInbox, InboxStore
from interview.storage import Store, canonical, read_json, write_json


def selected_user(user_key):
    if len(user_key) != 64 or any(c not in "0123456789abcdef" for c in user_key):
        raise GoogleAccessError("Invalid selected user key")
    directory = Path(".google-local/users") / user_key
    metadata = read_json(directory / "connection.json")
    if hashlib.sha256(metadata["account"].casefold().encode()).hexdigest() != user_key:
        raise GoogleAccessError("Connection account and selected user key disagree")
    config_path = directory / "demo-config.json"
    config = load_config(config_path)
    if config.expected_account.casefold() != metadata["account"].casefold():
        raise GoogleAccessError("Demo configuration and selected account disagree")
    return directory, config_path, config


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("phase", choices=["sync", "classify", "status", "import-live", "propose", "poll"])
    parser.add_argument("--user-key", required=True)
    parser.add_argument("--limit", type=int, default=1)
    parser.add_argument("--message-id")
    parser.add_argument("--live-run", type=Path)
    parser.add_argument("--handoff-id")
    parser.add_argument("--attempts", type=Path, default=Path("runs/inbox-classification"))
    parser.add_argument("--report", type=Path)
    parser.add_argument("--cycles", type=int, default=1)
    parser.add_argument("--interval", type=int, default=60)
    args = parser.parse_args()
    if not 1 <= args.limit <= 20:
        parser.error("limit must be between 1 and 20")
    if not 1 <= args.cycles <= 1440 or args.interval < 1:
        parser.error("cycles must be 1..1440 and interval must be positive")
    try:
        directory, config_path, config = selected_user(args.user_key)
        store = InboxStore(directory / "inbox.sqlite3", config.expected_account)
        if args.phase == "status":
            result = store.counts()
        else:
            gmail, _ = services(config_path, config)
            inbox = GmailInbox(store, gmail)
            if args.phase == "sync":
                result = inbox.sync()
            elif args.phase == "import-live":
                if args.live_run is None:
                    parser.error("import-live requires --live-run")
                inbox.profile()
                work = args.live_run.resolve() / "work"
                prior = Store(work)
                prior_config = load_config(Path(prior.meta("google_config")))
                if prior.meta("backend") != "google" or prior_config.expected_account.casefold() != store.account or prior_config.binding() != prior.meta("google_binding") or prior_config.calendar_id != config.calendar_id:
                    raise GoogleAccessError("Existing workspace does not match this account/calendar binding")
                if len(prior_config.gmail_messages) != 1:
                    raise GoogleAccessError("Import requires one unambiguous message in the existing live workspace")
                message_id = next(iter(prior_config.gmail_messages.values()))
                resource = execute_request(gmail.users().messages().get(userId="me", id=message_id, format="metadata", metadataHeaders=["Message-ID"]))
                if resource.get("id") != message_id or not resource.get("threadId"):
                    raise GoogleAccessError("Google message identity could not be verified")
                application = read_json(work / "inputs/application.json")
                store.bind(resource["threadId"], application["interview_id"], str(work))
                result = {"binding_imported": True, "account_verified": True, "google_writes": 0}
            elif args.phase in {"propose", "poll"}:
                from interview.settings import load_settings as agent_settings
                from interview.inbox_handoff import propose_handoff
                from interview.inbox_worker import poll_once
                if args.phase == "propose" and args.live_run is None:
                    parser.error("propose requires a new --live-run output directory")
                inbox.profile()
                settings = agent_settings()
                if args.phase == "propose":
                    result = propose_handoff(store, config_path, config, args.live_run, settings, handoff_id=args.handoff_id)
                else:
                    cycles = []
                    def dispatch():
                        output = args.attempts.parent / "inbox-proposals" / uuid.uuid4().hex
                        proposal = propose_handoff(store, config_path, config, output, settings, handoff_id=args.handoff_id)
                        if proposal["status"] in {"checked_existing", "awaiting_user"}:
                            from interview.coordinator import preparation_for_handoff
                            proposal["preparation"] = preparation_for_handoff(store, handoff_id=proposal["handoff_id"])
                        return proposal
                    for cycle in range(args.cycles):
                        result = poll_once(inbox, args.attempts, settings, limit=args.limit, message_id=args.message_id, dispatch_fn=dispatch)
                        cycles.append(result)
                        print(canonical({"cycle": cycle + 1, "jobs": result["jobs"], "handoffs": result["handoffs"]}), flush=True)
                        if args.report:
                            write_json(args.report, {"cycles": cycles})
                        if cycle + 1 < args.cycles:
                            time.sleep(args.interval)
                    result = {"cycles": cycles}
            else:
                from interview.settings import load_settings as agent_settings
                from interview.inbox_worker import process_next
                settings = agent_settings()
                results = []
                for _ in range(args.limit):
                    item = process_next(inbox, args.attempts, settings, message_id=args.message_id)
                    results.append(item)
                    if item["status"] == "no_eligible_job":
                        break
                result = {"results": results, **store.counts()}
        if args.report:
            # Report counts/status only; mail bodies, headers and credentials stay private.
            write_json(args.report, result)
        print(canonical(result))
    except (GoogleAccessError, ValueError, OSError):
        print(json.dumps({"status": "blocked", "reason": "Inbox operation failed; inspect selected local account, connectivity and private run diagnostics. No automatic writes were performed."}))
        raise SystemExit(1) from None


if __name__ == "__main__":
    main()
