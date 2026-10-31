# Application commands

Run these commands from the repository root. For directory ownership see [structure](structure.md); for authorization see [workflow-contract](workflow-contract.md). These commands manage local records unless the description explicitly says otherwise. Browser filling is performed separately by Codex.

- `npm run example:load`: replace the working state from the default fictional example. Add `-- --from <example-directory> --dir <existing-workspace>` to select source and destination. Stop Review and other writers first. The prior data is backed up locally; the command prints its path.
- `npm run data -- --input <local-command.json>`: versioned Status visibility and Review publication; see the UI contract for schemas.
- `npm run ui:check`: verify the active frozen UI baseline.
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

Use actual references and times, never these illustrative values. Sources are `chat`/`website` for authorization and `official_page`/`employer_dashboard`/`email` for success. A screenshot file is not required. The website only saves choices/approval; it does not call the employer's Submit button.
