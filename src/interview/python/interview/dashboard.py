"""Read-only export of one explicitly selected business run for the shared workbench."""
from __future__ import annotations

import argparse
import json
import sqlite3
from contextlib import closing
from pathlib import Path

from interview.freshness import check
from interview.memory import normalized
from interview.preparation import context_fingerprint
from interview.storage import Store, canonical, read_json


def export(workspace):
    store = Store(Path(workspace))
    before = context_fingerprint(store)
    application = read_json(store.workspace / "inputs/application.json")
    def matches(raw):
        subject = raw.get("subject", {})
        return (raw.get("mode") in {"interview", "practice"} and
                raw.get("interview_id") == application["interview_id"] and
                normalized(subject.get("role", "")) == normalized(application["role"]) and
                subject.get("company") in {None, application["company"]} and
                (not subject.get("round") or not application.get("round") or
                 normalized(subject["round"]) == normalized(application["round"])))
    freshness = "current"
    try:
        check(store)
    except (ValueError, OSError, sqlite3.Error):
        freshness = "stale"
    with closing(sqlite3.connect(store.path.as_uri() + "?mode=ro", uri=True)) as db:
        db.execute("BEGIN")
        tables = {r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        identity = db.execute("SELECT value FROM meta WHERE key='candidate_anchor'").fetchone()
        if not identity:
            raise ValueError("Publish a canonical candidate run with a source anchor")
        proposal, materials, debriefs = None, None, []
        if "preparation_proposals" in tables:
            row = db.execute("SELECT proposal_id,version,payload,fingerprint,proposal_hash,status FROM preparation_proposals WHERE interview_id=? ORDER BY version DESC LIMIT 1", (application["interview_id"],)).fetchone()
            if row:
                proposal = {"proposal_id": row[0], "version": row[1], "draft": json.loads(row[2]),
                    "proposal_hash": row[4], "status": row[5]}
                if row[3] != context_fingerprint(store):
                    freshness = "stale"
                if freshness == "current" and row[5] in {"plan_approved", "material_ready"} and {"preparation_materials", "preparation_approvals"} <= tables:
                    material = db.execute("SELECT m.payload FROM preparation_materials m JOIN preparation_approvals a ON a.approval_id=m.approval_id WHERE m.proposal_id=? AND a.proposal_id=? AND a.proposal_hash=? ORDER BY m.rowid DESC LIMIT 1", (row[0], row[0], row[4])).fetchone()
                    if material:
                        materials = json.loads(material[0])
        if "history" in tables:
            for payload, in db.execute("SELECT payload FROM history WHERE json_extract(payload,'$.interview_id')=? ORDER BY rowid DESC", (application["interview_id"],)):
                raw = json.loads(payload)
                if not matches(raw):
                    continue
                notes = [json.loads(r[0]) for r in db.execute("SELECT payload FROM memories WHERE json_extract(payload,'$.source_id')=?", (raw["record_id"],))]
                debriefs.append({**raw, "observations": notes})
                if len(debriefs) == 3:
                    break
        learning_guard = db.execute("SELECT value FROM meta WHERE key='candidate_learning_guard'").fetchone()
        local_debrief_ids = {r["record_id"] for r in debriefs}
        if learning_guard:
            from interview.candidate_learning import load_binding, read_learning
            try:
                value = load_binding(store, Path(json.loads(learning_guard[0])["binding_path"]))
                account, data, _ = read_learning(Path(value["learning_workspace"]))
                if account != value["account_hash"]:
                    raise ValueError("Learning account changed")
                matched = [r for r in data["history"] if matches(r)]
                for raw in sorted(matched, key=lambda r: r["occurred_at"], reverse=True)[:3]:
                    if raw["record_id"] not in {r["record_id"] for r in debriefs}:
                        debriefs.append({**raw, "observations": [n for n in data["memories"] if n["source_id"] == raw["record_id"]]})
            except (ValueError, OSError, sqlite3.Error):
                freshness = "stale"  # Revoked/changed accounts expose no account debriefs.
        result = {"schemaVersion": 1, "candidateAnchor": json.loads(identity[0]), "application": application,
            "freshness": freshness, "proposal": proposal, "materials": materials, "debriefs": debriefs}
    # Reject concurrent changes rather than exporting an inconsistent approval/material state.
    try:
        check(store)
        if context_fingerprint(store) != before:
            raise ValueError("Working inputs changed during export")
    except (ValueError, OSError, sqlite3.Error):
        result.update(freshness="stale", materials=None)
    if learning_guard:
        try:
            value = load_binding(store, Path(json.loads(learning_guard[0])["binding_path"]))
            if read_learning(Path(value["learning_workspace"]))[0] != value["account_hash"]:
                raise ValueError("Learning account changed")
        except (ValueError, OSError, sqlite3.Error):
            result["debriefs"] = [r for r in result["debriefs"] if r["record_id"] in local_debrief_ids]
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workspace", required=True, type=Path)
    args = parser.parse_args()
    try:
        print(canonical(export(args.workspace)))
    except (ValueError, OSError, KeyError, TypeError, sqlite3.Error):
        raise SystemExit("interview_dashboard_export_failed") from None


if __name__ == "__main__":
    main()
