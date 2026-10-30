# Interview storage contract

Maintenance date: 2026-10-25. Skills describe behavior; the selected candidate owns facts; domain code owns persisted state. This contract organizes existing storage without migrating private data or changing the shared opportunity schema.

## Ownership

| Data | Authoritative location | Rules |
| --- | --- | --- |
| Candidate facts and preferences | Selected `candidate.json` and `preferences.md`, including v3 shared sources | Read through the shared loader; interview snapshots never become a second profile |
| Jobs and applications | Selected `opportunities.json` | Stable job/application IDs; updates use existing shared domain APIs |
| Local preparation run | Explicit output directory containing `handoff.json` and `work/state.sqlite3` | Sources, proposals, approvals and materials belong to this run; do not overwrite an existing run |
| Shared interview view registry | Selected candidate runtime's `interviews/registry.json` | Stable round/job/application IDs, provenance, revision and a workspace pointer; company/role/lifecycle hydrate from opportunities and approvals stay in the business run |
| Account inbox state | Module-local `.google-local/users/<account-hash>/inbox.sqlite3` | Account-bound cursor, queue, deduplication, thread revisions and handoffs |
| Account debrief and memory | Same account directory's `learning/state.sqlite3` | Preserve original history; derived memory has source links, revisions and statuses |
| Google connection | Module-local ignored `.google-local/client.json` and per-account connection/config/token files | Host-only; never copy credentials into agent workspaces or shareable fixtures |
| Experiments and scores | Module-local ignored `runs/`, or explicitly selected external output | Separate resettable cases from ordinary candidate state; no evaluator gold in agent inputs |
| Evidence research session | Explicit new research directory with `binding.json`, `base/` and `session.sqlite3` | Canonical fingerprint/policy binding, reserved actions and immutable first receipts; exports existing context request without changing application state |

These are implemented stores, not a claim of automatic linkage between them. A staged canonical-candidate preparation run starts without account history. The opt-in [candidate learning binding](interview-learning.md) now establishes an explicit source/account link and selects scoped read-only practice evidence before context capture. Its private immutable binding and revocation sidecar stay host-only; `work/inputs/learning/snapshot.json` contains only selected source-linked observations. Cross-path unattended orchestration remains pending.

## New business run placement

For ordinary candidate work, choose an output under the selected candidate workspace, separate from application drafts:

```text
<candidate-workspace>/
  candidate.json
  preferences.md
  opportunities.json
  interviews/
    <opaque-interview-key>/
      <new-run-id>/
        handoff.json             Frozen provenance, never canonical job state
        work/
          inputs/                Read-only working snapshots
          state.sqlite3          Proposal, approval, material and tool state
          actions.jsonl          Actual local operations when invoked
        proposal-v1/             Node output and displayed proposal
        approval-v1.json         Exact human acceptance provenance
        materials-v1/            Matching materials and execution record
```

This is a placement convention supplied through existing `--output` flags, not a new automatic initializer or migration. Use opaque filesystem-safe keys; the real job/application/interview IDs remain inside the handoff. With the default candidate workspace, this sits under ignored `data/interviews/`. Keep application `drafts/` separate: Submission's cleanup must not remove interview state. Do not create business output inside committed `examples/` or `skills/`.

Existing private development runs stay where they are. Do not move databases while a process is using them. To resume, select the same `work` directory; do not initialize over it or copy an approval to a new context. Source changes require a fresh handoff/proposal; current version guards reject stale acceptance. Separate candidates and accounts are never merged implicitly.

## Business state versus research memory

The opt-in [context preparation path](interview-context-preparation.md) adds `work/inputs/context/preparation-context.json` and `preparation-policy.json`. These are bound snapshots, not new canonical profiles. It reuses existing proposal/approval/material tables; plan hashes also bind context and policy. Actor node logs and human-readable outputs have explicit separate output directories outside project-instruction ancestors. Captured standalone contexts do not inherit account learning or live source guards; ordinary use should capture/attach from the selected canonical handoff.

Inbox cursors, event IDs and pending approvals are operational state. Original debriefs and source-linked derived observations support cross-session preparation; they are not model weights or independently verified ability ratings. SQLite FTS5 retrieves stored observations. Keeping these stores does not establish that memory improves agent performance; compare relevant matched tasks separately.

The local benchmark calendar is simulated. Live Google Calendar remains authoritative for actual events; local IDs/audits do not replace read-back. Preparation-plan acceptance, calendar confirmation and application submission authorization are distinct records.

## Retention and inspection

Use `npm run interview:local -- inspect --workspace <absolute-work>` for explicit local inspection, or the documented tool API through `npm run interview:tools`. Outputs may include private user facts; keep them local. No cleanup/retention daemon is implemented. Do not prune raw debriefs or overwrite historical evidence during routine preparation, and do not publish raw mail or connection state as evaluation artifacts.
