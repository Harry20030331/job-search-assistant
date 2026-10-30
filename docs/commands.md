# Application commands

Run these commands from the repository root. For directory ownership see [structure](structure.md); for authorization see [workflow-contract](workflow-contract.md). These commands manage local records unless the description explicitly says otherwise. Browser filling is performed separately by Codex.

- `npm run example:load`: replace the working state from the default fictional example. Add `-- --from <example-directory> --dir <existing-workspace>` to select source and destination. Stop Review and other writers first. The prior data is backed up locally; the command prints its path.
- `npm run data -- --input <local-command.json>`: versioned Status visibility and Review publication; see the UI contract for schemas.
- `npm run ui:check`: verify the frozen UI v1 baseline.
- `npm run matching -- welcome`: print the English first-contact message without reading or changing candidate data. New project chats route `Hi` or `Start` to this welcome; see [welcome](welcome.md).
- `npm run matching -- example --workspace <new-directory>`: copy and register the fictional inputs without running the scripted demo, then serve/open this workspace before live research.
- `npm run matching -- workspaces`: discover and summarize saved results before asking which to resume; see [workspaces](workspaces.md).
- `npm run matching -- remember --workspace <existing-directory>`: index an explicitly selected existing search locally.
- `npm run matching -- serve --workspace <existing-directory>`: start the chosen website on an available loopback port; keep the session alive and open its Status URL before research.
- `npm run matching -- intake --workspace <new-directory> --input <confirmed-intake.json>`: initialize confirmed search inputs without a resume; see [chat intake](matching-chat.md). The directory must not exist. Other Matching commands accept `--workspace <directory>` as a shortcut for all four canonical input paths.
- `npm run matching -- context`: read selected candidate inputs and the current Matching context token.
- `npm run matching -- feedback --input <command.json>`: save explicit preference feedback with a version check; a new screening round is required.
- `npm run matching -- publish --input <round.json>`: atomically publish a complete evidence-bearing screening round. See [Matching](matching.md) for schemas and selected input flags.
- `npm run matching:demo -- --dir <new-directory>`: isolated fictional two-round recommendation/feedback demonstration; does not replace current data.

- `npm run preflight -- --url <https-url> --category <llm|recommendation>`: validate one active US Application input. Historical robotics remains schema-compatible.
- Add `--profile <path> --manifest <path>` to either preflight mode to supply independent inputs. Relative CV paths resolve beside the manifest.
- `npm run profile -- --profile <path> --check`: validate an explicit candidate source without printing personal facts.
- `npm run preflight -- --batch <local-json-path>`: validate one bounded US Application Batch while parking item-local URL or category errors.
- `npm run jobs -- validate --path data/opportunities.json`: validate the canonical job view; `upsert`, `status` and `close` use the same path.
- `npm run discovery -- show --path data/discovery-state.json`: inspect source checkpoints.
- `npm run discovery -- complete --path data/discovery-state.json --source <source-id> --at <ISO>`: record a fully completed scan only.
- `npm run drafts -- prune --path data/drafts`: remove working drafts only after durable verified success.
- `npm run lifecycle -- confirm-batch --tracker <path> --input <path>`: atomically reconcile one local Gmail confirmation batch.
- `npm run lifecycle -- transition --tracker <path> --application-id <id> --status <closed|interviewing|offer> --at <ISO>`: record one unambiguous protected recruiting update.
- `npm run review` / `npm run review:resume`: restore the existing local review/status surface.
- `npm run runtime:init -- --dir <new-directory>`: create private empty US records; the target must not exist.
- `npm run review -- --runtime-dir <directory>`: serve an independent runtime; no China records required. The course workspace defaults to loopback port 64441.
- `npm run verify`: run type checks, synthetic tests, fixed UI and structural boundary verification.

The `confirm-batch` input file is strict JSON with this exact shape (no additional fields):

```json
{
  "checkedAt": "2026-08-17T17:00:00.000Z",
  "confirmations": [
    {
      "applicationId": "example-1",
      "receivedAt": "2026-08-17T16:59:12.000Z"
    }
  ],
  "notReceived": ["example-2"]
}
```

The preflight `--batch` file is a strict JSON array containing 1–25 items. Each item has exactly these fields; `applicationId` values must be unique:

```json
[
  {
    "applicationId": "example-1",
    "jobUrl": "https://careers.example.com/jobs/123",
    "category": "llm"
  }
]
```

The batch command emits one JSON document with `ok`, `ready`, and `parked`. Invalid item URLs or explicit categories are parked without blocking valid siblings. Duplicate IDs or invalid shared profile, manifest, or approved PDFs fail the whole batch with the fixed safe error `preflight_failed`.

Use explicit input and runtime paths for independent runs. See [candidate-inputs](candidate-inputs.md).

## Canonical storage paths

Use `data/opportunities.json` wherever a compatibility command takes `--tracker`, `--jobs`, `trackerPath` or `jobsPath`. Use `data/drafts` for `--review` or `reviewPath`. These are views of one durable job store, not additional files. Normal `review:resume` resolves them automatically.

For a newly observed success, call `markSubmitted` with the exact application ID, snapshot ID, one-time authorization marker and visible result, plus:

```json
{
  "authorization": {"source":"chat", "reference":"Exact user approval reference", "approvedAt":"2026-10-15T12:00:00Z"},
  "evidence": {"source":"official_page", "reference":"Official application URL and observed success message", "verifiedAt":"2026-10-15T12:01:00Z"}
}
```

Use actual references and times, never these illustrative values. Sources are `chat`/`website` for authorization and `official_page`/`employer_dashboard`/`email` for success. A screenshot file is not required. The website only saves choices/approval; it does not call the employer's Submit button.
