# Job Search Assistant

A local job-search workbench built on Codex. Develop around one candidate: load a saved example into local data, then keep that candidate's facts, preferences and task progress in the same workspace. Codex performs the workflow; the application validates records and presents Status and Review.

See the [project documentation index](docs/README.md) for evaluation, team handoffs and operating contracts.

```text
examples/  -- example:load -->  data/  <-- everyday work -->  Codex + skills
saved candidate states        current candidate           Status / Review
committed to Git               local, persistent
```

## Start developing

Requires Node.js 22 or later and npm. Open the repository in Codex.

```sh
npm ci
npm run verify
npm run review          # Open the current working state.
```

Open the printed local URL. The workbench starts with an empty job list and review queue. The default port is 64441. No separate model API key is needed for the UI or deterministic tests; agent execution uses your configured Codex session.

The default working case is Alex Morgan, a fictional MS student seeking an entry-level applied AI/software role. A checkout without local data loads this default automatically. Existing data is preserved on ordinary startup.

To reset to the saved Alex state or switch cases, stop Review and other writers, then load an example:

```sh
npm run example:load                              # Load the saved Alex state.
npm run example:load -- --from /path/to/example    # Load another saved case.
npm run review
```

Loading replaces the whole working state rather than merging candidates. The previous data is retained under ignored `local/example-backups/`; the command prints its path. Invalid examples leave current data unchanged. A bundle contains candidate facts, preferences, a relative resume mapping and its PDFs, plus optional opportunities, drafts and discovery checkpoints. Omitted progress starts empty. The repository currently ships one example; the loader accepts other bundles without code changes.

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
  alex-morgan-resume.pdf         Resume consistent with the candidate

data/                           Generated locally; ignored by Git
  candidate.json                Current working candidate
  preferences.md                Current working preferences
  resumes.json                  Current resume mapping
  alex-morgan-resume.pdf         Initial working resume copy
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

Each developer can use a local copy of the same fictional candidate while keeping runtime changes independent. Work on feature branches and use PRs. Coordinate shared schema changes; do not create another authoritative job list. Read [team interfaces](docs/team-interfaces.md), the [workflow contract](docs/workflow-contract.md) and [AGENTS.md](AGENTS.md).

For Hannah's candidate onboarding and Matching integration, see the [handoff specification](docs/hannah-handoff.md), including LinkedIn import, required/optional fields and the opportunity JSON contract.

Interview Coordination is an optional Python 3.12 module behind the same npm command surface. `npm run interview -- context ...` reads canonical inputs; `stage` creates a fresh local preparation workspace. `interview:track` links verified rounds to existing applications and publishes their run on the same server's `/interviews` route. `interview:demo -- --output <new-directory> --port 8767` starts three authored fictional preview scenarios. `interview:practice` generates direct questions, plan-bound alternatives and executable Python answers after exact plan acceptance. Home and shared navigation expose Interviews and Google account connection. The controlled UI v5 manifest preserves earlier versions; application approval behavior and the opportunity schema retain their existing contracts. Follow [Interview setup](docs/interview.md), [workbench commands](docs/interview-workbench.md) and [evaluation status](docs/interview-evaluation.md); development fixtures are not a calibrated benchmark or unattended integration.

The [current-workflow baseline pipeline](docs/interview-workflow-benchmark.md) runs 12 fictional developer episodes through `npm run interview:benchmark`, exports per-module reports, and prepares scenario-label and blinded human-quality review forms. Its labels, quality judge and broader coverage still need review before a research freeze. The earlier A/B/C/D protocol remains separate.

## Optional submission exercise

`npm run demo -- --dir /tmp/job-search-demo` creates a separate, fresh runtime with one fictional job and a loopback employer form. Follow [the walkthrough](docs/demo.md). This tests review and submission control flow; normal workbench startup does not depend on it.

The candidate is synthetic and must never be submitted to a real employer. Tests and the local exercise do not establish real-world agent accuracy. The [evaluation framework](docs/evaluation.md) defines the planned candidate-by-form matrix, quality and cost metrics, and severe-error reporting; datasets and measured results remain future work. This course repository is maintained independently from the original personal system. See [extraction notes](docs/extraction.md) for scope and validation.
