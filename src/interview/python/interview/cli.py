from __future__ import annotations

import argparse
import json
import shutil
import sqlite3
import subprocess
import uuid
from pathlib import Path
from zoneinfo import ZoneInfo

from evaluation import agent, judge
from evaluation.runner import prepare_workspace, run_case
from interview.schemas import Contract, strict_schema
from interview.storage import Store, canonical, write_json

ROOT = Path(__file__).resolve().parents[1]


class SmokeResult(Contract):
    ok: bool


def preflight(models=False) -> dict:
    checks = {}
    executable = agent.codex_executable()
    checks["codex_installed"] = bool(executable)
    if executable:
        version = subprocess.run([executable, "--version"], capture_output=True, text=True, timeout=20)
        checks["codex_version"] = version.stdout.strip()
    checks["cli_login"] = agent.login_status()
    checks["openrouter_key_configured"] = bool(judge.configured_key())
    with sqlite3.connect(":memory:") as db:
        db.execute("CREATE VIRTUAL TABLE probe USING fts5(text)")
    checks["sqlite_fts5"] = True
    checks["iana_timezones"] = all(ZoneInfo(zone) for zone in ["America/Los_Angeles", "America/New_York", "UTC"]) is True
    if models:
        if checks["cli_login"]["logged_in"]:
            smoke_root = ROOT / "runs" / ("preflight-" + uuid.uuid4().hex[:8])
            smoke_root.mkdir(parents=True)
            schema = smoke_root / "smoke.schema.json"
            write_json(schema, strict_schema(SmokeResult))
            marker = "read-probe-" + uuid.uuid4().hex
            write_json(smoke_root / "probe.json", {"ok": True, "marker": marker})
            response = agent.invoke(smoke_root, "Read the local probe.json using a shell command and print its content, then return a JSON object containing only its ok field. This tests actual sandboxed file access; do not browse or call other integrations.", schema, smoke_root / "agent", judge.config(), smoke=True)
            read_verified = False
            events_path = smoke_root / "agent" / "events.jsonl"
            if events_path.exists():
                for line in events_path.read_text(encoding="utf-8").splitlines():
                    try:
                        event = json.loads(line)
                    except ValueError:
                        continue
                    item = event.get("item", {})
                    if item.get("type") == "command_execution" and item.get("status") == "completed" and marker in item.get("aggregated_output", ""):
                        read_verified = True
            checks["agent_smoke"] = {"status": response["status"], "passed": response.get("output") == {"ok": True} and read_verified, "sandbox_read_verified": read_verified, "run": str(smoke_root)}
        else:
            checks["agent_smoke"] = {"status": "access_blocked", "passed": False}
        if checks["openrouter_key_configured"]:
            try:
                response = judge.smoke_check()
                write_json(ROOT / "runs" / "judge-smoke.json", response)
                checks["judge_smoke"] = {"status": "completed", "passed": True, "model": response.get("model"), "usage": response.get("usage")}
            except (judge.JudgeAccessError, ValueError) as exc:
                checks["judge_smoke"] = {"status": "access_blocked", "passed": False, "error": str(exc)}
        else:
            checks["judge_smoke"] = {"status": "access_blocked", "passed": False, "error": "Configure OPENROUTER_API_KEY in .env or process environment"}
    passed = checks["cli_login"]["logged_in"] and checks["openrouter_key_configured"]
    if models:
        passed = passed and checks["agent_smoke"]["passed"] and checks["judge_smoke"]["passed"]
    result = {"status": "ready" if passed else "access_blocked", "live_models_tested": models, "checks": checks}
    write_json(ROOT / "runs" / "preflight.json", result)
    return result


def main():
    parser = argparse.ArgumentParser(description="Local interview coordination prototype")
    sub = parser.add_subparsers(dest="command", required=True)
    pre = sub.add_parser("preflight")
    pre.add_argument("--models", action="store_true", help="Make minimal real model requests (consumes quota/credits)")
    for name in ["reset", "demo"]:
        child = sub.add_parser(name)
        child.add_argument("--case", default="benchmark/dev/S01")
        child.add_argument("--group", choices=list("ABCD"), default="C")
        child.add_argument("--output", type=Path)
        if name == "demo":
            child.add_argument("--judge", action="store_true")
    inspect = sub.add_parser("inspect")
    inspect.add_argument("--workspace", required=True, type=Path)
    args = parser.parse_args()
    if args.command == "preflight":
        result = preflight(args.models)
        print(canonical(result))
        return 0 if result["status"] == "ready" else 2
    if args.command == "inspect":
        store = Store(args.workspace)
        print(canonical({"clock": store.meta("clock"), "events": store.rows("events"), "history": store.rows("history"), "memories": store.rows("memories"), "actions": store.audit_rows()}))
        return 0
    case = Path(args.case).resolve()
    if not case.is_dir():
        parser.error("Case not found")
    run = (args.output or ROOT / "runs" / (args.command + "-" + uuid.uuid4().hex[:8])).resolve()
    if args.command == "reset":
        run.mkdir(parents=True, exist_ok=False)
        workspace, spec, initial = prepare_workspace(case, args.group, run)
        print(canonical({"workspace": str(workspace), "case_id": spec["case_id"], "group": args.group}))
        return 0
    result = run_case(case, args.group, run, with_judge=args.judge)
    print(canonical(result))
    return 0 if result["status"] == "completed" else 2


if __name__ == "__main__":
    raise SystemExit(main())
