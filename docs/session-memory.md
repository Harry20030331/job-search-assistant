# Session memory

## Real user sessions

After selecting a confirmed workspace, use `npm run session -- <command> --workspace <selected-root> --input <private-json-file>`. The connected agent manages the lifecycle at goal boundaries:

| Command | Input and outcome |
| --- | --- |
| open | `{"sessionId":"S1","threadId":"<actual-thread-id>"}`. Read the profile, preference documents and workspace paths returned. Use a fresh stable ID for each task session. |
| append | `{"sessionId":"S1","turn":{"id":"T1","user":"...","assistant":"..."}}`. Save each completed user-visible exchange verbatim. Retrying the same turn is safe. |
| close | `{"sessionId":"S1"}`. On task completion, archive the session and invoke the local Codex preference review. Retry close if review fails. |
| source | `{"source":"core://S1/T1"}`. Resolve the archived turn in this workspace. |

Closing a CareerOS task session is an explicit lifecycle event issued by the connected agent. Simply closing a desktop tab does not emit it. Only the included messages reach the archive. Keep credentials, OTPs, tool logs and private attachments out of session inputs. Profile facts and confirmed matching filters keep their existing validated editors. Dreaming revises preference prose only. Use the opportunity domain APIs for actual progress.

## Isolated research store

Maintenance — 2026-11-04. This research interface adds no automatic production writer, Matching schema change or UI changes. Each new run begins with its own copy of four current Markdown documents. Existing product state is never loaded by default. All commands require an explicit isolated root.

`src/memory/sessionMemory.ts` exposes session open, complete-turn append, close, source lookup and Core search. The strategy factory supports Source-Linked Preference Memory only; raw trace, Core interaction and summary/Core names are reserved interfaces and fail explicitly. A different strategy can implement `SessionMemory`. There is no claim of baseline evaluation.

## Current memory documents

Each isolated root has four independently stored, editable documents: `profile.md` (candidate facts), `job-selection.md`, `application-answers.md` and `interview-preparation.md`. Preserve an initial copy outside the working root for restoration. All comparison strategies use identical starting files. Only the source-linked strategy is implemented. Its session open returns the four current texts under `documents`. The separate `memory.json` ledger archives Core turns, thread bindings, revisions and review receipts. Task state belongs to the local adapter.

### Core archive convention

Archive one completed session per `core/<sessionId>.json`. Store `sessionId`, the bound `threadId`, and the ordered `turns` array. Each turn preserves `id`, verbatim `user` and final `assistant` text. The trace index references session files in order; `core://S1/T2` identifies turn T2 in S1. Document edits and task progress have separate records.

For existing v2 runs these files can be exported losslessly from the closed sessions in `memory.json`. The current CLI persists the ledger; automatic per-session file creation at close is a separate implementation step.

The session controller calls `close` once after the last completed turn. Closing archives Core, runs a read-only local Codex review and commits its receipt before the next session can open. Install and sign in to the Codex CLI, with `codex` on PATH or `CODEX_EXECUTABLE` set. If review fails, retry `close` on the same session. A completed close returns its saved receipt. For manual replay, use `archive` followed by `dream`. The reviewer proposes a targeted edit for each supported update. The exact, unique `before` text is replaced by `after`, followed by clickable Core references. For an append, use an empty `before`; for a retraction, use an empty `after` (the review receipt retains its evidence). Include existing references in the replacement or sources when they still apply. Each edit requires at least one source from this session, and all sources must resolve to archived turns. Keep task-specific feedback in Core. An empty edits array records completion with no document revision change.

Example review after archiving a fictional S1:

```json
{"sessionId":"S1","review":{"baseRevision":0,"reason":"The user clarified one relocation constraint.","edits":[{"document":"job-selection","before":"Relocation willingness is undecided.","after":"New York relocation is currently excluded. Other relocation choices are undecided.","sources":["core://S1/T2"]}]}}
```

Use the app's real thread ID for each session. Identical retries are idempotent; conflicting writes and stale reviews fail. Runtime calls serialize under the root lock. A pending multi-file review is replayed on the next API access before reads or writes. Copy the whole quiescent root for recovery. Legacy version 1 roots continue to use their original envelopes for historical replay. Start new studies from version 2. Never edit a live root by hand.

## CLI

Run from the repository: `node --import tsx src/cli/sessionMemoryCli.ts <command> --root <absolute-isolated-root> [--input <absolute-json-file>]`. Normal installations can use `npx tsx` equivalently. The root parent must exist. Initialization rejects existing roots. With the bundled desktop runtime prepend its Node bin directory to PATH.

| Command | Input JSON |
| --- | --- |
| `init` | `{documents: {profile, "job-selection", "application-answers", "interview-preparation"}, jobs: []}`; each document value is Markdown text |
| `open` | `{sessionId, threadId}` |
| `append` | `{sessionId, turn: {id, user, assistant}}`; complete actual interaction |
| `close` | `{sessionId}` |
| `archive` | `{sessionId}` (archive only, for manual replay) |
| `dream` | `{sessionId, review: {baseRevision, reason, edits: []}}` |
| `inspect` | No input; operator/debug only, includes all Core |
| `source` | `{source: "core://S1/T1"}` |
| `search` | `{query}` |
| `tasks` | No input; isolated local task state |
| `add-jobs` | `{jobs: [...]}` |
| `decide` | `{sessionId, requestId, decisions: [{jobId, disposition: "shortlist" | "confirm" | "exclude", reason}]}` |
| `draft` | `{jobId, status: "blocked" | "local-review", fields: [{question, answer, source}], blocker, observedUrl?, observedAt}` |

## Task adapter boundary

`TaskStateAdapter` is the future virtual-website seam. `LocalTaskAdapter` implements only isolated supplied-JD tasks, shortlist/pending decisions and local draft/blocker state in `local-tasks.json`. It does not publish production Matching results, call Jev, serve a website, authorize application actions or access ATS endpoints. The experimental shortlist is authoritative only inside this isolated local adapter. Production jobs remain in the existing opportunities API.

Each job has `{id, title, company, city, description, provenance, verification, officialUrl?}`. Provenance is `simulated-jd`, `unverified-saved-posting` or `browser-verified`. It is an explicit observation supplied by the operator, not independent proof. Nonempty draft fields are rejected without browser-verified provenance. Real questions must be read from the in-app Browser; fictional answers stay local. Access failure produces a blocked draft with no invented fields.

Decision request IDs preserve the first actual result. Repeating an identical request does not duplicate shortlist entries or action evidence. Reusing an ID with changed content fails. Retain first results before correction. Do not put evaluator answers, future dialogue or paired variables into the execution root. To branch an experiment, copy the fully closed/reviewed prefix to a new explicit root before either branch continues; feed identical new jobs and task requests. Use separate Codex threads for every session.

Verification: `node node_modules/vitest/vitest.mjs run src/memory/sessionMemory.test.ts`; run the repository's full verify checks before integration. No credentials, browser replacement, automatic production integration or commit is included.
