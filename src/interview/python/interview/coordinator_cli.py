"""Host entry points for profile, proposal, approved materials and debrief capture."""
import argparse
import json
import uuid
from pathlib import Path

from interview.debrief_flow import run_debrief
from interview.preparation_flow import run_node
from interview.coordinator import configure_profile, debrief_status, learning_store, preparation_for_handoff
from interview.debrief import append_raw
from interview.google_adapter import GoogleAccessError, services
from interview.inbox import GmailInbox, InboxStore
from interview.inbox_cli import selected_user
from interview.storage import canonical, read_json, write_json


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("phase", choices=["profile", "prepare", "materials", "debrief", "status"])
    parser.add_argument("--user-key", required=True)
    parser.add_argument("--profile", type=Path)
    parser.add_argument("--source", action="append", default=[], help="source_id=local_text_file")
    parser.add_argument("--handoff-id")
    parser.add_argument("--interview-id")
    parser.add_argument("--approval-id")
    parser.add_argument("--text", type=Path)
    parser.add_argument("--subject", type=Path, help="Explicit historical company/role/round; unknown values stay null")
    parser.add_argument("--record-id")
    parser.add_argument("--occurred-at")
    parser.add_argument("--mode", choices=["interview", "practice"])
    parser.add_argument("--origin", choices=["human_current_chat", "synthetic_test_script"])
    parser.add_argument("--output", type=Path)
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()
    try:
        directory, config_path, config = selected_user(args.user_key)
        inbox = InboxStore(directory / "inbox.sqlite3", config.expected_account)
        if args.phase == "profile":
            if args.profile is None:
                parser.error("profile requires --profile")
            sources = {}
            for spec in args.source:
                key, path = spec.split("=", 1)
                if key in sources:
                    parser.error("Duplicate source ID")
                sources[key] = Path(path).read_text(encoding="utf-8-sig")
            configure_profile(inbox, read_json(args.profile), sources)
            result = {"status": "profile_saved", "google_writes": 0}
        elif args.phase in {"prepare", "materials"}:
            gmail, _ = services(config_path, config)
            GmailInbox(inbox, gmail).sync()
            if args.phase == "prepare":
                kwargs = {"run_root": args.output} if args.output else {}
                result = preparation_for_handoff(inbox, handoff_id=args.handoff_id, **kwargs)
            else:
                if not args.interview_id or not args.approval_id or args.output is None:
                    parser.error("materials requires --interview-id, --approval-id and a new --output")
                with inbox.connect() as db:
                    row = db.execute("SELECT payload FROM preparation_sessions WHERE interview_id=?", (args.interview_id,)).fetchone()
                if not row:
                    raise ValueError("No preparation session for this interview")
                session = json.loads(row[0])
                node = run_node(Path(session["workspace"]), args.output.resolve(), approval_id=args.approval_id)
                result = {"status": node["status"], "output": str(args.output)}
        elif args.phase == "debrief":
            if not all([args.text, args.subject, args.record_id, args.interview_id, args.occurred_at, args.mode, args.origin]):
                parser.error("debrief requires text, explicit subject/record/interview/date/mode/origin")
            learning = learning_store(inbox)
            record = append_raw(learning, record_id=args.record_id, interview_id=args.interview_id,
                                text=args.text.read_text(encoding="utf-8-sig"), occurred_at=args.occurred_at,
                                subject=read_json(args.subject), mode=args.mode, origin=args.origin)
            output = args.output or Path("runs/debrief") / uuid.uuid4().hex
            node = run_debrief(learning, record, output)
            result = {"status": node["status"], "raw_record_saved": True, "output": str(output)}
        else:
            result = {"interviews": debrief_status(inbox)}
        if args.report:
            write_json(args.report, result)
        print(canonical(result))
    except (ValueError, OSError, GoogleAccessError):
        print(canonical({"status": "blocked", "reason": "Profile, source freshness, approval or debrief validation failed; private raw records and prior outputs are preserved."}))
        raise SystemExit(1) from None


if __name__ == "__main__":
    main()
