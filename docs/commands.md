# Application commands

Run these commands from the repository root. For directory ownership see [structure](structure.md); for authorization see [workflow-contract](workflow-contract.md). These commands manage local records unless the description explicitly says otherwise. Browser filling is performed by Codex in response to website tasks when its optional runner is configured.

- `npm run example:shortlist` / `npm run example:review`: restore one of the two checkpoints for the shared Alex case, then start Review and open `/status/us` or `/review`. Stop the website first; current data is backed up and the private chat connection is retained.
- `npm run example:load`: default to Shortlist; use `--snapshot shortlist|review` to select. Replace the working state from the default fictional example. Add `-- --from <example-directory> --dir <existing-workspace>` to select source and destination. Stop Review and other writers first. The prior data is backed up locally; the command prints its path.
- `npm run data -- --input <local-command.json>`: versioned Status visibility and Review publication; see the UI contract for schemas.
- `npm run ui:check`: verify the current versioned UI baseline.

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

Use actual references and times, never these illustrative values. Sources are `chat`/`website` for authorization and `official_page`/`employer_dashboard`/`email` for success. A screenshot file is not required. The website records separate content approval and execution requests. The configured agent, after live verification and one-time authorization consumption, operates the employer form.

## Website-led application workflow

`npm run review` defaults to `APPLICATION_RUNNER=demo`. In Status, select shortlisted jobs and click **Apply** below the list. That tab opens Review when the first draft in the requested batch is ready; remaining drafts join as preparation completes. In Review, edit long answers, facts and choices, then click **Approve content**. Approvals automatically increase **Submit applications (N)** at the bottom of Review. Click that final button to start the approved batch; there are no Review selection checkboxes. Demo mode runs only a local rehearsal and never marks an employer submission successful. Status shows progress and a pending Review count; tracked rows have no selection or review controls. Task history remains internal; current stages appear on the application rows. Retry failed preparation using Apply from Shortlisted.

The optional live adapter is selected with `APPLICATION_RUNNER=codex npm run review` in an independently configured, non-fixture repository runtime. It uses the installed authenticated [Codex CLI non-interactive mode](https://developers.openai.com/codex/noninteractive) and configured in-app Browser connection. `CODEX_CLI_PATH` may identify the executable. Candidate data remains under that runtime; do not import the personal Career folder. Live operation has not been validated by the local rehearsal. CLI, login or browser failures are retained in task records; the application shows its failure state and the agent reports the actionable blocker.

The browser posts strict JSON to `/api/tasks` with `mode`, a UUID `requestId`, and either `{action: "prepare", jobIds: [...]}` or `{action: "submit", selections: [{applicationId, snapshotId, revision}, ...]}`. Never call this endpoint to impersonate a user. Worker-side `consumeWebsiteTask` in `src/review/applicationTasks.ts` validates and reserves a live execution request once and returns its website authorization provenance. Read `/api/tasks` for task state. Restarts interrupt claimed or inline work; delivered, unclaimed chat tasks survive only for the same configured chat and execution mode. Reconcile interrupted submission outcomes first.


### Existing-chat connection

A private `data/chat-runner.json` config connects both website buttons to one existing Codex chat:

```json
{"version":1,"threadId":"<existing-chat-UUID>","executable":"<absolute-path-to-codex>"}
```

The host's installed CLI must support `codex queue --thread <id> --message <text>`. The server sends one message per batch, preserving the current chat's model and tools. An idle chat can receive the queued turn; a busy chat receives it after its current work. This is event-driven and creates no recurring automation. The hosting Mac, Codex app/server and website service must be running. This private config survives website restarts and is not included in GitHub or example data. Removing it restores the inline runner on the next restart.

Delivery and execution are separate: a successful queue receipt does not mean an application was processed. Tasks remain queued until the configured chat atomically claims them. Duplicate HTTP retries do not resend messages, and duplicate chat messages cannot claim a task twice. Delivered, unclaimed chat tasks survive a website restart for the same target chat and execution mode; interrupted or uncertain work is never automatically replayed.

The agent runs these from the repository with its available Node runtime (`node --import tsx`), keeping `CODEX_THREAD_ID` unchanged:

- `src/cli/chatTaskCli.ts run-demo --task <id>`: claim and perform only the fictional local rehearsal, then save the checked outcome.
- `src/cli/chatTaskCli.ts claim --task <id>`: claim a live task once and return its exact saved inputs and paths.
- `src/cli/chatTaskCli.ts finish --task <id> --outcome completed`: finish only after review artifacts or real submission evidence pass validation.
- `src/cli/chatTaskCli.ts finish --task <id> --outcome blocked --message <reason>`: record a blocker without claiming success.

The connection does not switch execution mode: the course workspace still defaults to demo, with no employer submissions. Live browser work remains unverified. Never manufacture button requests to test the connection against current application data; use isolated fixtures or an actual user click.

Stage transitions are projected from saved drafts and tasks. A partial application with no draft remains Shortlisted and is eligible for Apply. A blocked/interrupted preparation shows a small retry hint; details remain in task history. Reuse its identity. Active requests show Preparing or Submitting; completed exact-snapshot rehearsals leave active Review and appear under Submitted in Status. The website refreshes changed stages when no edits, saves or shortlist selections are pending.
