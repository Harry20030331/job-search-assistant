# Job Search Assistant

A local job-search workbench built on Codex. Develop around one candidate: load the saved example into local data once, then keep that candidate's facts, preferences and task progress in the same workspace. Codex performs the workflow; the application validates records and presents Status and Review.

```text
examples/  -- setup:example (once) -->  data/  <-- everyday work -->  Codex + skills
saved candidate baseline              current candidate           Status / Review
committed to Git                       local, persistent
```

## Start developing

Requires Node.js 22 or later and npm. Open the repository in Codex.

```sh
npm ci
npm run verify
npm run setup:example   # First use only; refuses an existing data directory.
npm run review          # Run again whenever you resume work.
```

Open the printed local URL. The workbench starts with an empty job list and review queue. The default port is 64441. No separate model API key is needed for the UI or deterministic tests; agent execution uses your configured Codex session.

The saved example is Alex Morgan, a fictional MS student seeking an entry-level applied AI/software role. Setup copies the complete candidate input bundle: facts, preferences, resume mapping and PDF. It also creates empty progress stores. It does not create a fake job or application.

## Repository and working data

```text
skills/                         Workflow instructions
  matching/                     Discovery and screening
  submission/                   Application workflow and ATS-specific skills
src/                            Application logic, CLI, UI and tests
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
```

Edit candidate facts and preferences in `data/`; use the domain commands for job/application updates. If a resume changes, update its mapping and hash. Restarting Review reuses the same data and never reloads the example. Local changes do not modify `examples/`. The current web interface has Status and Review; candidate editing uses the files. See [candidate inputs](docs/candidate-inputs.md) and [commands](docs/commands.md).

Commit reusable code, skills and deliberate improvements to the fictional baseline. Keep working data local. An example update reaches a new workspace on initialization, not an existing workspace automatically. For an independent run, use an explicitly selected external directory; see [structure](docs/structure.md).

## Team development

| Owner | Starting point | Handoff |
| --- | --- | --- |
| Hannah Guan | `skills/matching/` and jobs/discovery interfaces | Create and maintain shared opportunities with screening evidence. |
| Yuming Feng | `skills/submission/`, review and lifecycle interfaces | Advance the same opportunity through preparation, approval and verified submission. |
| Erica Zhao | Design Interview Coordination; implementation is pending | Link recruiting activity to an opportunity and agree on new interview fields before extending storage. |

Each developer can use a local copy of the same fictional candidate while keeping runtime changes independent. Work on feature branches and use PRs. Coordinate shared schema changes; do not create another authoritative job list. Read [team interfaces](docs/team-interfaces.md), the [workflow contract](docs/workflow-contract.md) and [AGENTS.md](AGENTS.md).

## Optional submission exercise

`npm run demo -- --dir /tmp/job-search-demo` creates a separate, fresh runtime with one fictional job and a loopback employer form. Follow [the walkthrough](docs/demo.md). This tests review and submission control flow; normal workbench startup does not depend on it.

The candidate is synthetic and must never be submitted to a real employer. Tests and the local exercise do not establish real-world agent accuracy; evaluation datasets, baselines and measured results remain future work. This course repository is maintained independently from the original personal system. See [extraction notes](docs/extraction.md) for scope and validation.
