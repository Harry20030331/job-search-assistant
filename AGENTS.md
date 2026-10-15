# Applications Instructions

These instructions apply throughout this repository.

Work on a feature branch and use a pull request for team review. Keep repository content in English. Use fictional fixtures only. Never copy personal histories or credentials.

## Active authorities

- Read [structure](docs/structure.md) when navigating or reorganizing the directory, and [commands](docs/commands.md) for runnable entrypoints. The course extraction excludes the source system's private archive.

- Read [workflow-contract](docs/workflow-contract.md) for preparation, review, authorization, submission evidence and recovery. It consolidates the user decisions through 2026-10-15; older dated instructions and ADR wording are historical where superseded.
- Read [candidate-inputs](docs/candidate-inputs.md) for factual ownership and input loading. Candidate facts and preferences belong in their canonical data sources, not ATS skills.
- Read [ui-contract](docs/ui-contract.md) before Status/Review updates. Its v1 renderer, interactions and baseline remain fixed. Change data through documented domain APIs and `npm run data`; use stable IDs, never row numbers. Do not rewrite entire existing tracker/review files or rebaseline the UI to bypass a check.

## Execution boundaries

- Codex's in-app Browser is the only page executor. No Chrome profile dependency, extension, Simplify, alternate browser engine, hidden ATS API or retired executor.
- Candidate scope is configured in the selected preferences file. Example data is fictional and must only be used with the local demo. Never submit it to an employer. Legacy China code is inert compatibility code, not an active workflow.
- Every new application needs an explicit configured category. Never infer or silently switch the category or mapped approved PDF.
- For discovery, read `skills/matching/SKILL.md` and `docs/job-discovery.md`. Use the job-library interfaces; discovery does not authorize applying or submitting.
- For filling, use `skills/submission/SKILL.md` and the applicable ATS module. Deterministic approved facts are automatic; genuinely unknown facts become review questions. Do not invent personal history.
- Keep working answers and exact approval state in `data/drafts/`. After verified success is saved in `data/opportunities.json`, working drafts may be pruned. Keep a short source/reference and timestamp; permanent screenshots, raw mail and daily ledgers are not required.
- Explicit acceptance of the exact current application in chat is valid approval and submission authorization under the workflow contract. Apply and verify agreed edits before submitting; do not manufacture a website event or demand a duplicate click.
- Restore the existing local service with `npm run review:resume`. Fresh, isolated storage uses `npm run runtime:init -- --dir <new-directory>`. Neither operation proves live ATS continuity or authorizes submission.

## Maintenance

Keep shared operational policy in the workflow contract and platform-specific techniques in the narrowest skill. Record a dated maintenance note for rule changes; do not append contradictory "latest" blocks throughout the repository. Run tests, boundary checks and `npm run ui:check` for relevant repairs. Preserve real records and evidence when validating with synthetic inputs.

## Course ownership

Hannah Guan owns Matching; Yuming Feng owns Submission and integration; Erica Zhao owns Interview Coordination. The shared opportunity record is the handoff. Coordinate shared schema changes with affected owners. Interview implementation is pending; do not claim it exists. Candidate facts and resume paths belong to selected inputs, never skills.

Read `docs/demo.md` before using synthetic fixtures. The demo uses a separate loopback form and temporary runtime, with no employer actions.
