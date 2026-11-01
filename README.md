# Job Search Assistant

Send **Start** in a Codex project chat to open Welcome. Continue on the website through **Profile & preferences → Status / Shortlist → Review → Interview preparation**. New candidate starts with a LinkedIn link, pasted text or PDF, followed by a profile preview for confirmation. Selected real workspaces check New Grad listings daily, catch up when overdue, and offer manual refresh. See [website setup](docs/welcome.md) and [daily updates](docs/job-refresh.md).

A local job-search workbench built on Codex. Develop around one candidate: load a saved example into local data, then keep that candidate's facts, preferences and task progress in the same workspace. Codex performs the workflow; the application validates records and presents the shared profile, shortlist, application review and interview workflow.

See the [project documentation index](docs/README.md) for evaluation, team handoffs and operating contracts.

```text
examples/  -- example:load -->  data/  <-- everyday work -->  Codex + skills
saved candidate states        current candidate           Status / Review
committed to Git               local, persistent
```

## Start developing

For the job-seeker experience, open this repository as the primary folder of a local Codex project, start a new chat inside it, and send **Start** (or **Hi**). Codex starts the local service and visibly opens the English Welcome website for setup. Opening the folder alone does not start a conversation. See [the welcome walkthrough](docs/welcome.md); development instructions follow below.

Requires Node.js 22 or later and npm. macOS uses `/usr/bin/shlock`; Windows uses the native lock adapter. The website can be viewed in a browser on other devices.

```sh
npm ci
npm run verify
npm run review          # Open the current working state.
```

Open the printed local URL. The workbench starts with five saved real-job references in Shortlisted and an empty review queue. The default port is 64441. No separate model API key is needed for the UI or deterministic tests; agent execution uses your configured Codex session.

The default working case is Alex Liu, a fictional MS student seeking an entry-level applied AI/software role. A checkout without local data loads this default automatically. Existing data is preserved on ordinary startup.

For recording and teammate reproduction, use the [two saved checkpoints](examples/README.md): Shortlist contains the five original jobs; Review contains their captured role-specific questions and saved drafts. The generic demo Apply runner does not restore those drafts. Load `example:review` explicitly to reproduce the recorded Review sample.

For an isolated five-role recording with Interview handoff, use [the Alex Liu demo](docs/alex-case-demo.md): `npm run demo:alex -- --dir <new-directory> --snapshot review --port 8774`. It preserves the original examples and never submits fictional applications to employers.

To reset to the saved Alex state or switch cases, stop Review and other writers, then load an example:

```sh
npm run example:shortlist                         # Five jobs, no drafts.
npm run example:review                            # Same five jobs, pending review drafts.
npm run example:load                              # Default: Shortlist.
npm run example:load -- --from /path/to/example    # Load another saved case.
npm run review
```

Loading replaces the whole working state rather than merging candidates. The previous data is retained under ignored `local/example-backups/`; the command prints its path. Invalid examples leave current data unchanged. A bundle contains candidate facts, preferences, a relative resume mapping and its PDFs, plus optional opportunities, drafts and discovery checkpoints. Omitted progress starts empty. The repository ships one case with two checkpoints. Shared candidate inputs live at the example root; `snapshots/shortlist` and `snapshots/review` contain only their progress. Loading a checkpoint clears prior task/approval history from the working state, backs it up, and preserves this machine’s private chat connection. It does not start tasks or open employer pages. The loader also accepts standalone bundles without checkpoints.

## Repository and working data

```text
skills/                         Workflow instructions
  matching/                     Discovery and screening
  submission/                   Application workflow and ATS-specific skills
  interview/                    Interview chat entry and module boundaries
src/                            Application logic, CLI, UI and tests
  interview/                    Shared-input adapter and isolated Python module
  demo/                         Optional fictional employer-form test
scripts/                        Development verification checks
docs/                           Contracts, interfaces and operating instructions
examples/                       Saved fictional candidate input bundle
  candidate.json                Facts, experience and scoped answers
  preferences.md                Goals and screening/writing preferences
  resumes.json                  Resume paths and integrity hashes
  alex-liu-resume.pdf            Resume consistent with the candidate
  snapshots/shortlist/           Five saved postings, all ready to select
  snapshots/review/              Same jobs with five unapproved drafts

data/                           Generated locally; ignored by Git
  candidate.json                Current working candidate
  preferences.md                Current working preferences
  resumes.json                  Current resume mapping
  alex-liu-resume.pdf            Initial working resume copy
  opportunities.json            Shared job and application progress
  drafts/                       Working answers, questions and approvals
  discovery-state.json          Completed discovery checkpoints
  interviews/                   Explicitly selected interview business runs; separate from experiments
```

Edit candidate facts and preferences in `data/`; use the domain commands for job/application updates. If a resume changes, update its mapping and hash. Restarting Review reuses existing data. Explicit example loading replaces it. Local changes do not modify `examples/`. The web interface has Home, Status, Review, Interviews and Google account connection; candidate editing uses the files. See [candidate inputs](docs/candidate-inputs.md) and [commands](docs/commands.md).

Commit reusable code, skills and deliberate improvements to the fictional baseline. Keep working data local. An example update reaches the working data when explicitly loaded; it does not synchronize automatically. For an independent run, use an explicitly selected external directory; see [structure](docs/structure.md).

## Team development

| Owner | Starting point | Handoff |
| --- | --- | --- |
| Hannah Guan | `skills/matching/` and jobs/discovery interfaces | Create and maintain shared opportunities with screening evidence. |
| Yuming Feng | `skills/submission/`, review and lifecycle interfaces | Advance the same opportunity through preparation, approval and verified submission. |
| Erica Zhao | `skills/interview/`, `src/interview/` and the [module guide](docs/interview.md) | Read canonical candidate/opportunity inputs by stable ID; own interview workspace state without extending the shared ledger. |

Each developer can use a local copy of the same fictional candidate while keeping runtime changes independent. Collaborate on `main`: sync first, resolve conflicts and run relevant checks before pushing. Each author owns integration; a separate reviewer is not required. Coordinate shared schema changes; do not create another authoritative job list. Read [team interfaces](docs/team-interfaces.md), the [workflow contract](docs/workflow-contract.md) and [AGENTS.md](AGENTS.md).

For Hannah's candidate onboarding and Matching integration, see the [handoff specification](docs/hannah-handoff.md), including LinkedIn import, required/optional fields and the opportunity JSON contract.

Interview Coordination is an optional Python 3.12 module behind the same npm command surface. `npm run interview -- context ...` reads canonical inputs; `stage` creates a fresh local preparation workspace. `interview:track` links verified rounds to existing applications and publishes their run on the same server's `/interviews` route. `interview:demo -- --output <new-directory> --port 8767` starts three authored fictional preview scenarios. `interview:practice` generates direct questions, plan-bound alternatives and executable Python answers after exact plan acceptance. Home and shared navigation expose Interviews and Google account connection. The controlled UI v30 manifest preserves earlier versions; application approval behavior and the opportunity schema retain their existing contracts. Follow [Interview setup](docs/interview.md), [workbench commands](docs/interview-workbench.md) and [evaluation status](docs/interview-evaluation.md); development fixtures are not a calibrated benchmark or unattended integration.

The [current-workflow baseline pipeline](docs/interview-workflow-benchmark.md) runs 12 fictional developer episodes through `npm run interview:benchmark`, exports per-module reports, and prepares scenario-label and blinded human-quality review forms. Its labels, quality judge and broader coverage still need review before a research freeze. The earlier A/B/C/D protocol remains separate.

## Optional submission exercise

`npm run demo -- --dir /tmp/job-search-demo` creates a separate, fresh runtime with one fictional job and a loopback employer form. Follow [the walkthrough](docs/demo.md). This tests review and submission control flow; normal workbench startup does not depend on it.

The candidate is synthetic and must never be submitted to a real employer. Tests and the local exercise do not establish real-world agent accuracy. The [evaluation framework](docs/evaluation.md) defines the planned candidate-by-form matrix, quality and cost metrics, and severe-error reporting; datasets and measured results remain future work. This course repository is maintained independently from the original personal system. See [extraction notes](docs/extraction.md) for scope and validation.

## Interview environment

Run `npm run interview:setup` once, then `npm run interview:check`. Normal `npm start` automatically uses the project-local Python environment for Interview; no per-launch override is needed. Model generation requires Codex login. Google account connection remains separate. For the existing fictional example and the verified local demo path, see [Alex demo](docs/alex-case-demo.md) and [current integration](docs/interview-current-integration.md).
