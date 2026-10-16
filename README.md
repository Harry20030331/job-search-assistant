# Job Search Assistant

A local job-search assistant built on the Codex harness. Matching and Submission share one opportunity record; Codex operates the browser, while the local application validates records and presents Status and Review.

This is a one-time, independently maintained extraction of an existing application workflow. The course distribution uses fictional inputs. Live employer workflows still require the user's own candidate facts, resume, browser access and authorization.

## Quick start

Requires Node.js 22 or later and npm. Open this repository in Codex for agent-driven browser work.

```sh
npm ci
npm run verify
npm run setup:example
npm run review
```

`setup:example` copies the fictional inputs into a new local `data/` with empty records. Run it once. `review` starts the existing Status/Review workbench and preserves local edits across restarts; it never recopies examples. Keep `data/` out of Git. Candidate facts are currently edited in `data/candidate.json`; there is no candidate editor in the web UI yet.

For an optional end-to-end submission test, run `npm run demo -- --dir /tmp/job-search-demo` with a new directory and follow [the walkthrough](docs/demo.md). This separate fixture adds one fictional job and a loopback employer form. It is not required for normal startup. No model API key is needed for the local UI or deterministic tests; agent execution uses the user's configured Codex session.

## Layout

- `skills/matching/`: job discovery and screening; Hannah Guan owns further development.
- `skills/submission/`: application preparation, review and ATS techniques; Yuming Feng owns this workflow and integration.
- `src/`: record management, validation, local UI, CLI adapters and tests.
- `docs/`: operating contracts, setup, ownership and extraction notes.
- `examples/`: a fictional candidate, preferences and resume.
- `scripts/`: distribution and interface checks.
- Runtime `data/`: created locally, ignored by Git; facts, preferences, resume mappings, opportunities, drafts and discovery state.

Erica Zhao owns Interview Coordination. That workflow is not implemented in this extraction. See [team interfaces](docs/team-interfaces.md) before extending the common data model.

## Personal use and privacy

Candidate and resume inputs can live outside the repository. Start with [candidate inputs](docs/candidate-inputs.md), [commands](docs/commands.md), the [workflow contract](docs/workflow-contract.md) and [AGENTS.md](AGENTS.md). Keep personal inputs, runtime records and credentials outside version control. The example identity is fictional and must never be sent to real employers.

## Evidence and evaluation

The inherited tests validate deterministic storage, approval, synchronization and recovery behavior. The demo validates a synthetic local workflow. Neither establishes real-world agent accuracy or improvement over a baseline. Evaluation datasets, baselines and measured results remain future work. [Extraction notes](docs/extraction.md) describe scope and limitations.
