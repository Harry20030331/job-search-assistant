# Application commands

Run these commands from the repository root. For directory ownership see [structure](structure.md); for authorization see [workflow-contract](workflow-contract.md). These commands manage local records unless the description explicitly says otherwise. Browser filling is performed by Codex in response to website tasks when its optional runner is configured.

- `npm run example:shortlist` / `npm run example:review`: restore one of the two checkpoints for the shared Alex case, then start Review and open `/status/us` or `/review`. Stop the website first; current data is backed up and the private chat connection is retained.
- `npm run example:load`: default to Shortlist; use `--snapshot shortlist|review` to select. Replace the working state from the default fictional example. Add `-- --from <example-directory> --dir <existing-workspace>` to select source and destination. Stop Review and other writers first. The prior data is backed up locally; the command prints its path.
- `npm run data -- --input <local-command.json>`: versioned Status visibility and Review publication; see the UI contract for schemas.
- `npm run ui:check`: verify the current integrated UI baseline.
- `npm run matching -- welcome`: print the English first-contact message without reading or changing candidate data. New project chats route `Hi` or `Start` to this welcome; see [welcome](welcome.md).
- `npm run matching -- sources`: show the English invitation to share a LinkedIn URL, PDF/DOCX/TXT/Markdown document, pasted text, or a combination of sources.
- `npm run matching -- linkedin-preview --input <observations.json>`: validate and preview visible facts from the designated profile without saving. Optional `--workspace <existing-directory>` reports conflicts; see [LinkedIn intake](linkedin-import.md).
- `npm run matching -- example --workspace <new-directory>`: copy and register the fictional inputs without running the scripted demo, then serve/open this workspace before live research.
- `npm run matching -- workspaces`: discover and summarize saved results before asking which to resume; see [workspaces](workspaces.md).
- `npm run matching -- remember --workspace <existing-directory>`: index an explicitly selected existing search locally.
- `npm run matching -- serve --workspace <existing-directory>`: start the chosen website on an available loopback port; keep the session alive and open its Status URL before research.
- `npm run matching -- intake --workspace <new-directory> --input <confirmed-intake.json>`: initialize confirmed search inputs without a resume; see [chat intake](matching-chat.md). The directory must not exist. Other Matching commands accept `--workspace <directory>` as a shortcut for all four canonical input paths.
- `npm run matching -- context`: read selected candidate inputs and the current Matching context token.
- `npm run matching -- feedback --input <command.json>`: save explicit preference feedback with a version check; a new screening round is required.
- `npm run matching -- publish --input <round.json>`: atomically publish a complete evidence-bearing screening round. See [Matching](matching.md) for schemas and selected input flags.
- `npm run matching:demo -- --dir <new-directory>`: isolated fictional two-round recommendation/feedback demonstration; does not replace current data.

- `npm run preflight -- --url <https-url> --category <configured-resume-key>`: validate one active US Application input. The category flag is the approved resume-profile key, not the job direction; historical keys remain compatible.
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

## Interview commands

`npm run interview:virtual-tests -- --output <new-private-absolute-directory>` runs the virtual mailbox/calendar infrastructure suite without Google or model calls. Add `--live-classifier` for actual Codex classification of the synthetic messages; repeat `--case VM01` to select cases. See [virtual testing](interview-virtual-testing.md) for scope, outputs and interpretation.

`npm run interview:notifications -- pending|ack --runtime-dir <absolute-selected-runtime>` reads pending chat follow-ups or records delivery with `--id`. Pending excludes fictional scenarios unless `--include-synthetic` is explicitly supplied. Register a candidate-scoped thread heartbeat for actual chat delivery; this CLI does not send a message itself. See [website approval and reminders](interview-web-actions.md).

`npm run interview:enrich -- start|next|record|finish` runs bounded evidence research in the current Codex chat. The active search tool and in-app Browser execute its reserved actions; Python stores receipts and exports a context request without fetching pages or calling another LLM. `npm run interview:enrichment-checks -- --output <new-private-directory>` runs eight offline protocol scenarios, not a model retrieval benchmark. See [enrichment protocol](interview-enrichment.md).

`npm run interview:learning -- bind|attach|revoke` explicitly connects a selected canonical candidate source to an existing account learning store, retrieves scoped active practice evidence read-only before context capture, or revokes a binding. It makes no Google/model calls. See [candidate learning](interview-learning.md) for provenance, scope and required absolute-path flags.

`npm run interview:track -- link|publish|inspect --runtime-dir <absolute-candidate-runtime>` connects verified rounds to existing applications and publishes an explicitly selected fresh preparation run to `/interviews` on the existing Review server. Link requires a strict `--input` payload with provenance/current revision. Publish requires `--interview-id`, `--workspace` and `--expected-revision`. Use optional `--profile` for external/v3 candidate sources. `npm run interview:demo -- --output <new-absolute-directory> --port 8767` creates and serves three authored fictional UI scenarios without model/Google calls. See [the workbench](interview-workbench.md); lifecycle publication must precede canonical preparation staging.

`npm run interview:context -- schema|request|freeze|check` exposes the opt-in evidence-bound preparation context contract. `npm run interview:context-cases -- check` validates its 12 supplied-evidence development cases; `export --output <absolute-new-private-directory>` creates a case-label review pack without model calls. See [context contracts](interview-context-contract.md) for required flags and limits. These commands do not yet generate the analysis, retrieve live JDs or alter the existing preparation workflow.

`npm run interview:context-analyze -- --request <absolute-request.json> --output <absolute-new-isolated-directory>` makes one real model call for context analysis; `--method simple-instruction-v1` selects the simple baseline instead of `context-guided-v1`. `npm run interview:context-pilot -- --output <absolute-new-isolated-directory> --case C05 --case C08` runs both methods on explicitly selected cases, retaining first attempts. These consume Codex quota, use captured evidence only and do not authorize or generate full preparation materials.

`npm run interview:context-preparation -- capture|stage|attach|inspect` binds captured context to preparation state. `npm run interview:context-prepare -- proposal|materials --workspace <absolute-work> --output <absolute-new-isolated-output>` runs the new plan/material nodes; materials additionally require the exact approval ID. `npm run interview:context-preparation-pilot` compares planning methods with fresh states. See [context-aware preparation](interview-context-preparation.md) for full flags, coverage-policy configuration, canonical handoff reuse and explicit synthetic audit boundaries.

`npm run interview:preparation-quality -- export|judge|compare` evaluates actual preparation semantics under a separate six-dimension stage-aware rubric. Export takes `--pilot` and a new `--output`; judge/compare take `--pack`, with host-only `--judge-env` or a completed `--ratings` CSV respectively. See [semantic evaluation](interview-preparation-quality.md). Human/judge scores remain uncalibrated until appropriate comparison; this does not replace historical four-dimension scores.

`npm run interview:preparation-controls -- export|judge|report` diagnoses the unchanged semantic judge on 12 authored strong/partial/severe controls from four fictional stories. Export takes a new `--output`; judge/report take `--pack`, with optional host-only `--judge-env` for paid judge calls. Labels and packets freeze before judging. See [challenge controls](interview-preparation-controls.md); developer expectations are not independently validated labels or agent performance.

`npm run interview:benchmark -- --run <absolute-new-output-outside-the-checkout>` runs the current-workflow simple-instruction developer batch and exports reports/review forms. Add `--judge --judge-env <absolute-local-dotenv>` for the independent OpenRouter audit. `npm run interview:review -- compare --batch <absolute-batch> --ratings <absolute-csv>` compares completed human scores. See [the protocol](interview-workflow-benchmark.md) for isolation, fixed sample selection, limits and resumption rules.

Add `--method source-id-catalog-v1` in a new run directory to test exact source-reference guidance and schema constraints separately from the unchanged default baseline. See [source-reference repair](interview-source-reference-fix.md); method and implementation changes cannot resume an older run.

See [Interview](interview.md) for Python setup, complete flags, the source-version token and an offline example. Run `npm run interview -- context --workspace <candidate-workspace> --job-id <stable-id> --settings <settings.json> --invitation <invitation.txt>` to inspect the read-only handoff. `stage` additionally requires `--expected-token <token> --output <new-absolute-directory>` and creates an isolated local workspace, without Google/model calls or shared-ledger writes.

`npm run interview:tools -- call <operation> --workspace <absolute-work> --input <absolute-json>` invokes the business tool API. `npm run interview:local -- inspect --workspace <absolute-work>` reads local state. See [Interview storage](interview-storage.md) for business versus experiment output paths.

`npm run interview:test` runs the Python contract suite separately from `npm run verify`. `npm run interview:eval -- --split dev --group A --case S01` invokes a real baseline model task; add `--judge` for the independent OpenRouter quality judge. This consumes quota. Other explicit entrypoints are `interview:triage`, `interview:analysis`, `interview:calibration`, `interview:prepare`, `interview:approve`, `interview:coordinator`, `interview:inbox`, `interview:connect` and `interview:google`. These Python commands run from `src/interview/python/`; supply absolute paths for cross-module inputs/outputs. No background mail monitor is installed by these changes.

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

The server's `/` is Home; `/interviews` contains Plan, Practice and Debrief; `/settings/accounts` starts Google authorization. `review` accepts developer-only `--google-root <private-config-directory>` and optional `--profile`. After exact context-plan acceptance, `npm run interview:practice -- --workspace <absolute-work> --approval-id <current-id> --output <new-absolute-output>` generates complete simulations. See [the workbench](interview-workbench.md) and [simulation contract](interview-practice.md).

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
