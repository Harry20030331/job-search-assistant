"""OpenRouter judge. Keys are read only here and never serialized."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from interview.schemas import JudgeResult, strict_schema
from interview.storage import canonical, read_json, write_json
from interview.settings import load_settings

ROOT = Path(__file__).resolve().parents[1]


class JudgeAccessError(RuntimeError):
    pass


def configured_key() -> str | None:
    """A project-local ignored .env overrides the inherited process environment."""
    path = ROOT / ".env"
    if path.exists():
        for line in path.read_text(encoding="utf-8-sig").splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            name, sep, value = line.removeprefix("export ").partition("=")
            if sep and name.strip() == "OPENROUTER_API_KEY":
                value = value.strip()
                if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
                    value = value[1:-1]
                return value or None
    return os.environ.get("OPENROUTER_API_KEY", "").strip() or None


def config() -> dict:
    return load_settings()


def request_structured(messages: list[dict], schema: dict, *, smoke=False, settings: dict | None = None) -> dict:
    settings = settings or config()
    key = configured_key()
    if not key:
        raise JudgeAccessError("OPENROUTER_API_KEY is not configured")
    payload = {
        "model": settings["judge_model"], "messages": messages,
        "max_tokens": 512 if smoke else settings["judge_max_tokens"],
        "provider": {"only": [settings["judge_provider"]], "allow_fallbacks": False, "require_parameters": True},
        "response_format": {"type": "json_schema", "json_schema": {"name": "judge_result", "strict": True, "schema": schema}},
    }
    attempts = []
    for attempt in range(len(settings["judge_retry_delays"]) + 1):
        started = time.monotonic()
        request = Request(settings["judge_endpoint"], data=canonical(payload).encode(), headers={"Authorization": "Bearer " + key, "Content-Type": "application/json"}, method="POST")
        try:
            with urlopen(request, timeout=settings["judge_timeout_seconds"]) as response:
                body = json.load(response)
            attempts.append({"attempt": attempt+1, "seconds": round(time.monotonic()-started, 3), "status": "ok"})
            if body.get("error"):
                raise JudgeAccessError("OpenRouter returned an API error; inspect the dashboard without exposing credentials")
            choice = body["choices"][0]
            if choice.get("finish_reason") not in {"stop", "end_turn"}:
                raise ValueError("Judge output incomplete: " + str(choice.get("finish_reason")))
            content = choice["message"].get("content")
            parsed = json.loads(content)
            return {"parsed": parsed, "model": body.get("model"), "provider": body.get("provider"), "request_id": body.get("id"), "usage": body.get("usage", {}), "attempts": attempts, "request_config": {k: v for k, v in payload.items() if k != "messages"}}
        except HTTPError as exc:
            # Do not echo request headers, API keys, or untrusted error bodies.
            attempts.append({"attempt": attempt+1, "status": "http_error", "http_status": exc.code})
            if exc.code not in {429, 500, 502, 503, 504}:
                raise JudgeAccessError(f"OpenRouter HTTP {exc.code}; check model/provider access and account credits") from None
            if attempt == len(settings["judge_retry_delays"]):
                raise JudgeAccessError(f"OpenRouter HTTP {exc.code} after bounded retries") from None
        except (URLError, TimeoutError):
            attempts.append({"attempt": attempt+1, "status": "network_error"})
            if attempt == len(settings["judge_retry_delays"]):
                raise JudgeAccessError("OpenRouter network request failed after bounded retries") from None
        time.sleep(settings["judge_retry_delays"][attempt])
    raise AssertionError("Unreachable")


def smoke_check() -> dict:
    schema = {"type": "object", "properties": {"ok": {"type": "boolean"}}, "required": ["ok"], "additionalProperties": False}
    result = request_structured([{"role": "user", "content": "Return exactly a JSON object with ok=true. This is a connectivity and schema smoke test."}], schema, smoke=True)
    if result["parsed"] != {"ok": True}:
        raise ValueError("Unexpected judge smoke result")
    return result


def evaluate(packet: dict, destination: Path, *, rubric_text: str | None = None, settings: dict | None = None) -> dict:
    rubric = rubric_text if rubric_text is not None else (ROOT / "evaluation" / "rubrics" / "quality.md").read_text(encoding="utf-8")
    settings = settings or config()
    fingerprint = hashlib.sha256(canonical({"packet": packet, "rubric": rubric, "config": settings, "schema": strict_schema(JudgeResult)}).encode()).hexdigest()
    if destination.exists():
        previous = read_json(destination)
        if previous.get("fingerprint") == fingerprint:
            return previous
        # Keep an immutable copy before an explicit regrade with changed inputs.
        old_fingerprint = previous.get("fingerprint", hashlib.sha256(destination.read_bytes()).hexdigest())
        backup = destination.with_name(destination.stem + ".previous-" + old_fingerprint[:16] + destination.suffix)
        if not backup.exists():
            backup.write_bytes(destination.read_bytes())
    messages = [{"role": "system", "content": rubric}, {"role": "user", "content": canonical(packet)}]
    result = request_structured(messages, strict_schema(JudgeResult), settings=settings)
    judgment = JudgeResult.model_validate(result["parsed"])
    required = {"specificity", "grounding", "actionability", "constraints"}
    if packet.get("suite") == "memory":
        required |= {"memory_relevance", "memory_updates", "memory_impact"}
    names = [d.name for d in judgment.dimensions]
    if set(names) != required or len(names) != len(required):
        raise ValueError("Judge did not return exactly the applicable dimensions")
    result.update({"fingerprint": fingerprint, "rubric_text": rubric, "rubric_sha256": hashlib.sha256(rubric.encode()).hexdigest(), "judgment": judgment.model_dump()})
    write_json(destination, result)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--smoke", action="store_true")
    parser.add_argument("--packet", type=Path)
    parser.add_argument("--output", type=Path, default=Path("runs/judge-smoke.json"))
    args = parser.parse_args()
    try:
        result = smoke_check() if args.smoke else evaluate(read_json(args.packet), args.output)
        if args.smoke:
            write_json(args.output, result)
        print(canonical({"ok": True, "model": result.get("model"), "provider": result.get("provider"), "usage": result.get("usage"), "output": str(args.output)}))
        return 0
    except (JudgeAccessError, ValueError, KeyError) as exc:
        write_json(args.output, {"status": "access_blocked" if isinstance(exc, JudgeAccessError) else "invalid_judge", "error": str(exc)})
        print(canonical({"ok": False, "error": str(exc), "output": str(args.output)}))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
