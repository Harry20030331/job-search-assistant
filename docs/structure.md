# Structure and ownership

Skills describe work; data holds inputs and progress; source code validates updates and renders the versioned interface.

```text
skills/matching/SKILL.md    Workflow entry and stage routing
  intake/SKILL.md          Candidate sources, confirmation and new intake
  discovery/SKILL.md       Official job leads and source verification
  feedback/SKILL.md        Assessment, publication and feedback loop
skills/submission/          ATS modules are nested here
skills/interview/           Interview chat instructions and boundaries
src/                       logic, CLI, UI and colocated tests
src/interview/python/      Optional Python runtime, evaluation and fictional fixtures
scripts/                   verification
examples/                  fictional inputs only
docs/                      current contracts
```

## Single-user workspace

Start CareerOS with `npm start`. After confirmation, the website saves your profile directly in the repository. Personal files under `data/`:

```text
profile/
  candidate.json                  Confirmed facts and the approved resumes array
  resumes/                        Approved PDFs referenced by candidate.json
  preferences/
    job-selection.md              Search notes, structured filters and feedback
    application-answers.md        How the user wants application questions answered
    interview-preparation.md      How the user wants to practice
sessions/
  <session-id>.json               Verbatim user/assistant turns and close receipt
opportunities/
  opportunities.json              Current snapshot of all jobs and application stages
  job-<encoded-job-id>/
    draft.json                    Working application answers and review state
    interviews/                   Staged preparation for this role
  interviews/registry.json        Cross-role interview round index, created on demand
runtime/                          Discovery checkpoints, task queues, chat binding and runner locks
```

The Profile page exposes the three preferences. Closing a recorded session runs Dreaming and links a reusable preference to the originating turn. Domain actions update the shared opportunity snapshot when the work advances. A comment about interview practice can therefore be preserved in a session, shape future preparation, and accompany progress on a particular job. The chat itself cannot mark a job submitted. Shared procedural knowledge lives in the repository's `skills/`. Runtime files belong to this workspace and are separate from the job ledger. Earlier workspaces retain their existing paths.

### Earlier workspaces and fictional examples

A flat private runtime has `data/opportunities.json`, `data/drafts/<job-id>.json` and `data/discovery-state.json`. The default development workspace stores its copied candidate inputs beside those records in `data/`. Explicitly selected candidate, preference and resume paths may also be external. There is no required CV directory or symlink.

| Data | Owner and lifetime |
| --- | --- |
| Candidate | Facts and scoped confirmed answers; user maintained |
| Preferences | Screening and writing preferences; user maintained |
| Resumes | Category to approved PDF path/hash; user maintained |
| Opportunities | One durable identity and lifecycle per role; Matching and Submission share it |
| Drafts | Temporary working answers, questions, snapshot and approval; removable after verified success |
| Application tasks | Website requests, chat delivery/claim state, exact execution authorization and runner outcomes; no duplicate lifecycle |
| Chat runner config | Optional private `data/chat-runner.json`; existing-chat UUID and local Codex executable, excluded from shared examples |
| Discovery state | Completed-scan checkpoints; no duplicate job list |

Opportunity availability and application stage are distinct. Closing a posting does not erase submission evidence. Stable IDs bind records; visible row numbers are temporary. Drafts hydrate role headers from opportunities. An identity/CV/URL change invalidates old bindings. Domain interfaces use file locks, atomic writes and expected revisions.

Interview reads the shared opportunity and resolved candidate profile through `src/interview/handoff.ts`; it does not create another authoritative job list. Business nodes live under its Python `interview/` package; old `evaluation.*` imports remain compatible. For ordinary work select `data/interviews/<opaque-key>/<new-run-id>/` or the equivalent inside an external candidate workspace through explicit output flags. Experiments retain separate ignored `runs/`. Account inbox/learning state and Google credentials retain their existing account-specific ignored locations; this is not an automatic migration. See [Interview storage](interview-storage.md) for authoritative locations and [Interview](interview.md) for commands.

The [interview workbench](interview-workbench.md) uses the same Review server's `/interviews` route and a candidate-bound `interviews/registry.json` containing IDs/revisions/provenance and run pointers. It reads preparation/debrief state through a bounded Python export. Shared lifecycle changes use the existing domain API before staging. Canonical profile/opportunity schemas and application approval behavior retain their existing contracts; shared navigation and direct-question views follow the versioned UI contract.

The source workflow's private archive and runtime are excluded. Inert regional and credential helper code remains for compatibility and test coverage, with no configured accounts, private data or active commands. It is not needed to start the workbench. Tests may use synthetic legacy storage to validate recovery; normal startup uses opportunities and per-job drafts.

See [commands](commands.md), [candidate inputs](candidate-inputs.md), [UI contract](ui-contract.md), and [workflow contract](workflow-contract.md).

The website loads the repository’s `data/` on startup. Older installations can resume their previously selected profile through their saved pointer. The website example reads the authored Alex case directly.

## Example and local workspace

`examples/` contains shared fictional candidate inputs and two progress checkpoints under `snapshots/shortlist/` and `snapshots/review/`. `data/` is the current working state. `npm run review` opens existing personal data. On first use, run `npm start` to set up a profile or try Alex separately. `npm run example:load` replaces current data with the Alex memory pilot seed; `--from <directory>` selects another bundle, and `--dir <workspace>` selects the destination workspace. Stop Review and other writers before loading.

The loader validates a staged copy before switching. It preserves previous data under ignored `local/example-backups/` and reports that path. It copies candidate facts, preferences and all manifest-referenced PDFs, plus optional opportunity, draft and discovery records. If progress files are omitted, those stores start empty. It never merges two candidates. Examples remain unchanged as working data evolves.

`src/` contains application behavior, including initialization. `scripts/` contains development checks; it does not store candidate state. `src/demo/` is an optional fixed submission test with a simulated employer, separate from normal workbench startup. The web UI contains the fixed Status/Review pages and an Interview page with exact plan acceptance and debrief reminders, with a separate Profile editor for supported user-owned inputs.

For the older application and interview integration fixtures, select a saved checkpoint with `example:shortlist` or `example:review` while the service is stopped.

The full directory tree and startup/loading commands are maintained in the repository README. The candidate bundle is copied as a unit; its README is documentation, not runtime input. Progress is loaded from the selected example when provided, otherwise starts empty, and then accumulates around that candidate. Working data is not a log of the examples directory. Deliberately improving the shareable fictional baseline is a separate reviewed change.

Snapshot loading preserves only the host-local chat routing file across resets; old task and approval history remains in the backup. A running website runner is rejected before loading. Shared checkpoints are never updated by ordinary runtime edits.


Maintenance — 2026-11-03: Working primary navigation is Profile / Status. Review and interview routes remain contextual Status tasks with return links; the Google connection route is presented as Settings under Profile. No storage ownership or directory layout changed.

Maintenance — 2026-11-04: `src/memory/` owns the opt-in [session-memory research interface](session-memory.md). The isolated research root is independent of the selected user workspace; the product adapter uses the same source-link convention.
