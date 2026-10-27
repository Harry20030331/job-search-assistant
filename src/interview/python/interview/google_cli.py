"""Host setup for live integration. Never run auth/confirm as an agent tool."""
from __future__ import annotations

import argparse
from datetime import datetime, timedelta, timezone
from pathlib import Path

from interview.google_adapter import SCOPES, GoogleAccessError, GoogleAdapter, confirm_live, credential_path, execute_request, google_libraries, load_config, save_token, services
from interview.schemas import CalendarAction
from interview.storage import Store, canonical, read_json, write_json


def authorize(path):
    config = load_config(path)
    httplib2, _, _, AuthorizedHttp, InstalledAppFlow, build = google_libraries()
    client = credential_path(path, config.client_file)
    if not client.exists():
        raise GoogleAccessError("Desktop OAuth client file missing; follow docs/google-setup.md")
    try:
        flow = InstalledAppFlow.from_client_secrets_file(str(client), SCOPES)
        credentials = flow.run_local_server(port=0, open_browser=True, prompt="consent", login_hint=config.expected_account)
        if not set(SCOPES).issubset(set(credentials.granted_scopes or credentials.scopes or [])):
            raise GoogleAccessError("Required scopes were not granted; no token was saved")
        transport = AuthorizedHttp(credentials, http=httplib2.Http(timeout=30))
        gmail = build("gmail", "v1", http=transport, cache_discovery=False)
        profile = execute_request(gmail.users().getProfile(userId="me"))
        if profile.get("emailAddress", "").casefold() != config.expected_account.casefold():
            raise GoogleAccessError("Wrong Google account; no token was saved. Authorize the configured TEST account")
        save_token(credential_path(path, config.token_file), credentials.to_json())
        return {"ok": True, "account_verified": True, "project_oauth_saved": True}
    except GoogleAccessError:
        raise
    except Exception:
        raise GoogleAccessError("Interactive Google authorization failed; no credentials are printed") from None


def preflight(path):
    config = load_config(path)
    gmail, calendar = services(path, config)
    # No business state is needed for an account check.
    profile = execute_request(gmail.users().getProfile(userId="me"))
    if profile.get("emailAddress", "").casefold() != config.expected_account.casefold():
        raise GoogleAccessError("Authorized Google account does not match the configured TEST account")
    now = datetime.now(timezone.utc)
    execute_request(calendar.events().list(calendarId=config.calendar_id, timeMin=now.isoformat(), timeMax=(now + timedelta(days=1)).isoformat(), maxResults=1, singleEvents=True))
    return {"ok": True, "account_verified": True, "test_calendar_readable": True, "configured_message_count": len(config.gmail_messages), "writes_performed": 0}


def find_mail(path):
    config = load_config(path)
    gmail, calendar = services(path, config)
    adapter = GoogleAdapter(None, config, gmail, calendar)
    adapter.verify_account()
    messages = execute_request(gmail.users().messages().list(userId="me", q='subject:"[CS329Z-TEST]"', maxResults=20, includeSpamTrash=False))
    return {"ok": True, "query": 'subject:"[CS329Z-TEST]"', "messages": messages.get("messages", []), "more_results": bool(messages.get("nextPageToken"))}


def initialize(path, case, output, group):
    from evaluation.runner import prepare_workspace
    config = load_config(path)
    credential_path(path, config.token_file, output / "work")
    output.mkdir(parents=True, exist_ok=False)
    work, spec, _ = prepare_workspace(case, group, output)
    # Never let a fixture .eml be mistaken for an actual Gmail read.
    for fixture_mail in (work / "inputs" / "mail").glob("*.eml"):
        fixture_mail.unlink()
    guide = work / "TOOL_GUIDE.md"
    guide.write_text(guide.read_text(encoding="utf-8").replace("Only local files and simulated events are affected.", "This integration session accesses the configured real TEST Google account and dedicated test calendar. Read LIVE_BACKEND.md before using tools."), encoding="utf-8")
    (work / "LIVE_BACKEND.md").write_text("# Real Google integration session\n\nmail.read reads only host-allowlisted Gmail IDs. calendar.list reads the dedicated test calendar (default window: now to 90 days; supply start/end to query another window). Calendar writes affect that real calendar and require host approval of the exact action, expire after 15 minutes, and are read back. Do not run google_cli auth/confirm or alter host approvals/configuration. Use the real current clock. Reply drafts stay local; no mail send or event delete tool is available.\n", encoding="utf-8")
    task = work / "TASK.md"
    task.write_text(task.read_text(encoding="utf-8") + "\nRead LIVE_BACKEND.md. This is a real Google integration session, not the local benchmark.\n", encoding="utf-8")
    for skill in work.glob(".agents/skills/*/SKILL.md"):
        skill.write_text(skill.read_text(encoding="utf-8").replace("The environment is a local experimental inbox/calendar; save reply drafts only.", "Read LIVE_BACKEND.md: this is a real TEST Google inbox/calendar session; save reply drafts locally only."), encoding="utf-8")
    now = datetime.now(timezone.utc).isoformat()
    store = Store(work)
    with store.connect() as db:
        # Fixture events must never masquerade as live Calendar data.
        db.execute("DELETE FROM events")
        db.execute("UPDATE meta SET value=? WHERE key='clock'", (now,))
        for key, value in {"backend": "google", "google_config": str(path.resolve()), "google_binding": config.binding()}.items():
            db.execute("INSERT INTO meta VALUES (?,?)", (key, value))
    manifest = {"scope": "live_google_integration_not_benchmark", "backend": "google", "case_id": spec["case_id"], "group": group, "workspace": str(work), "backend_binding": config.binding(), "writes_performed": 0}
    write_json(output / "integration_manifest.json", manifest)
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    for name in ["auth", "preflight", "find-mail", "init"]:
        command = sub.add_parser(name)
        command.add_argument("--config", type=Path, required=True)
        if name == "init":
            command.add_argument("--case", type=Path, default=Path("benchmark/dev/P01"))
            command.add_argument("--output", type=Path, required=True)
            command.add_argument("--group", choices=list("ABCD"), default="C")
    confirmation = sub.add_parser("confirm")
    confirmation.add_argument("--workspace", type=Path, required=True)
    confirmation.add_argument("--action", type=Path, required=True)
    args = parser.parse_args()
    try:
        if args.command == "confirm":
            store = Store(args.workspace)
            if store.optional_meta("backend") != "google":
                raise GoogleAccessError("This command requires an explicit Google integration workspace")
            config = load_config(Path(store.meta("google_config")))
            try:
                action = CalendarAction.model_validate(read_json(args.action))
            except ValueError:
                raise GoogleAccessError("Invalid calendar action; provide the proposed CalendarAction JSON, not OAuth credentials") from None
            confirmation_id = confirm_live(store, action, config)
            result = {"ok": True, "confirmation_id": confirmation_id, "exact_action": action.model_dump(), "expires_after_seconds": 900, "writes_performed": 0}
        elif args.command == "auth":
            result = authorize(args.config.resolve())
        elif args.command == "preflight":
            result = preflight(args.config.resolve())
        elif args.command == "find-mail":
            result = find_mail(args.config.resolve())
        else:
            result = initialize(args.config.resolve(), args.case.resolve(), args.output.resolve(), args.group)
        print(canonical(result))
        return 0
    except (ValueError, FileNotFoundError, FileExistsError, KeyError) as exc:
        print(canonical({"ok": False, "error": str(exc)}))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
