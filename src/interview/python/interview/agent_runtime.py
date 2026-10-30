"""Bounded Codex CLI invocations with streamed logs and a secret-free child env."""
from __future__ import annotations

import json
import os
import queue
import shutil
import subprocess
import threading
import time
from pathlib import Path

from interview.storage import read_json, write_json


def agent_environment() -> dict:
    environment = os.environ.copy()
    for name in list(environment):
        if name.upper().endswith(("_API_KEY", "_ACCESS_TOKEN", "_SECRET", "_PASSWORD")):
            environment.pop(name, None)
    environment["PYTHONIOENCODING"] = "utf-8"
    return environment


def codex_executable() -> str | None:
    return os.environ.get("CODEX_EXECUTABLE") or shutil.which("codex")


def login_status() -> dict:
    executable = codex_executable()
    if not executable:
        return {"logged_in": False, "reason": "codex is not on PATH"}
    result = subprocess.run([executable, "login", "status"], capture_output=True, text=True, encoding="utf-8", errors="replace", env=agent_environment(), timeout=20)
    # Don't retain auth details in a public preflight report.
    return {"logged_in": result.returncode == 0, "reason": "CLI authentication available" if result.returncode == 0 else "Run codex login in your terminal", "executable": executable}


def stop_owned_process(process: subprocess.Popen) -> None:
    if os.name == "nt":
        subprocess.run(["taskkill", "/PID", str(process.pid), "/T", "/F"], capture_output=True, timeout=10)
    else:
        process.kill()


def invoke(workspace: Path, prompt: str, schema_path: Path, destination: Path, settings: dict, *, smoke=False, google_network=False) -> dict:
    executable = codex_executable()
    if not executable:
        return {"status": "access_blocked", "error": "codex executable not found"}
    destination.mkdir(parents=True, exist_ok=True)
    final_path = destination / "final.json"
    command = [executable, "exec", "--model", settings["agent_model"], "-c", 'model_reasoning_effort="' + settings["agent_reasoning_effort"] + '"', "-c", "features.apps=false", "-c", "features.plugins=false", "-c", "features.multi_agent=false", "--json", "--ephemeral", "--ignore-user-config"]
    # ignore-user-config also drops the native sandbox selection. Preserve the
    # configured safe Windows backend explicitly instead of disabling isolation.
    if os.name == "nt":
        command.extend(["-c", 'windows.sandbox="elevated"'])
    if google_network and not smoke:
        # Live integration only: retain workspace-write + automatic approval review.
        # The reproducible local benchmark never opts into outbound network access.
        command.extend(["-c", "sandbox_workspace_write.network_access=true"])
    command.extend(["--sandbox", "read-only"] if smoke else ["--approve-for-me"])
    command.extend(["--skip-git-repo-check", "--cd", str(workspace), "--output-schema", str(schema_path), "-o", str(final_path), "-"])
    version = subprocess.run([executable, "--version"], capture_output=True, text=True, encoding="utf-8", errors="replace", env=agent_environment(), timeout=20).stdout.strip()
    started = time.monotonic()
    process = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=agent_environment(), text=True, encoding="utf-8", errors="replace")
    lines: queue.Queue = queue.Queue()

    def pump(stream, name):
        try:
            for line in stream:
                lines.put((name, line))
        finally:
            lines.put((name, None))

    threads = [threading.Thread(target=pump, args=(process.stdout, "stdout"), daemon=True), threading.Thread(target=pump, args=(process.stderr, "stderr"), daemon=True)]
    for thread in threads:
        thread.start()
    process.stdin.write(prompt)
    process.stdin.close()
    ended = set()
    command_ids = set()
    usage = {}
    thread_id = None
    status = "completed"
    successful_commands = 0
    with (destination / "events.jsonl").open("w", encoding="utf-8") as output, (destination / "stderr.log").open("w", encoding="utf-8") as errors:
        while len(ended) < 2:
            if time.monotonic()-started > settings["agent_timeout_seconds"]:
                status = "timeout"
                stop_owned_process(process)
                break
            try:
                channel, line = lines.get(timeout=0.2)
            except queue.Empty:
                continue
            if line is None:
                ended.add(channel)
                continue
            if channel == "stderr":
                errors.write(line)
                continue
            output.write(line)
            output.flush()
            try:
                event = json.loads(line)
            except json.JSONDecodeError:
                continue
            if event.get("type") == "turn.completed":
                usage = event.get("usage", {})
            if event.get("type") == "thread.started":
                thread_id = event.get("thread_id")
            item = event.get("item", {})
            if event.get("type") == "item.completed" and item.get("type") == "command_execution" and item.get("exit_code") == 0:
                successful_commands += 1
            if event.get("type") == "item.started" and item.get("type") == "command_execution":
                command_ids.add(item.get("id"))
                if len(command_ids) > settings["max_shell_commands_per_response"]:
                    status = "budget_exceeded"
                    stop_owned_process(process)
                    break
    try:
        process.wait(timeout=10)
    except subprocess.TimeoutExpired:
        stop_owned_process(process)
        process.wait(timeout=10)
    if status == "completed" and (process.returncode != 0 or not final_path.exists()):
        status = "agent_error"
    manifest = {"status": status, "exit_code": process.returncode, "seconds": round(time.monotonic()-started, 3), "usage": usage, "shell_command_count": len(command_ids), "successful_shell_command_count": successful_commands, "model": settings["agent_model"], "thread_id": thread_id, "cli_version": version, "google_network_requested": google_network and not smoke, "command": command[:-1] + ["<stdin>"]}
    if status == "completed":
        try:
            manifest["output"] = read_json(final_path)
        except (ValueError, OSError):
            manifest["status"] = "invalid_output"
    stderr = (destination / "stderr.log").read_text(encoding="utf-8")
    if (manifest.get("output", {}).get("status") == "blocked" or (command_ids and not successful_commands)):
        if any(marker in stderr.lower() for marker in ["blocked by policy", "sandbox setup", "helper_unknown_error", "setup refresh had errors"]):
            manifest["status"] = "environment_error"
            manifest["error"] = "Native command execution was blocked by policy or sandbox setup. Preserve sandbox boundaries and fix the runtime configuration."
    write_json(destination / "invocation.json", manifest)
    return manifest
