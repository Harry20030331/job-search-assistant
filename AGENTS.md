# Applications Instructions

These instructions apply throughout this repository.

## Job-seeker welcome and setup

In a fresh conversation, treat a standalone greeting (for example, "Hi", "Hello"), "Start", "Get started", or a request to begin job-search setup as the onboarding entry point. Read `docs/welcome.md` and `skills/matching/SKILL.md`, run `npm start` in a persistent terminal session, then visibly open its returned `workspace_url` (`welcome_url` compatibility alias) in Codex's in-app Browser. Keep that tab available. First use opens source-first Profile setup; a remembered confirmed real user opens Status directly. Recovery and isolated fictional examples stay on the website; do not ask users to choose candidates repeatedly in chat or type commands/JSON. Do not greet repeatedly or hijack explicit development requests.

The website is the primary interaction surface: Profile & preferences, Status / Shortlist, Review, and Interview preparation share the selected workspace. Keep UI text in English unless explicitly requested otherwise. Opening the folder alone does not select a candidate, save facts or authorize research. Welcome does not load fictional data. The user must confirm new intake before saving; the example is always isolated and must never be submitted to an employer.

Use the selected canonical inputs and existing Matching/domain interfaces. Website search requests authorize research only; Apply authorizes preparation only; content approval and final Submit are separate. Keep the website and connected Codex chat running. For a delivered task, claim its saved ID once, with `--workspace <selected-directory>` where needed. Never claim that a saved request or local restart proves completed research or live ATS continuity. For source documents or LinkedIn, follow `docs/linkedin-import.md` and the source-reading workflow; never fabricate inaccessible facts. See `docs/welcome.md` for supported editor inputs and current limitations.

Collaborate directly on `main`. Sync the latest remote state before editing or pushing, resolve conflicts without overwriting others, and run the checks relevant to the change before pushing. The author owns validation and integration; no pull request is required. Complete edits and tests, then stop for the user's own review. Do not commit or push unless the user explicitly authorizes it. Coordinate shared-interface changes with the affected module owner. Keep documentation, UI text, examples, comments and test descriptions in English. External-language recognition patterns and intentional non-English rejection probes may use Unicode escapes; do not translate away their behavior. Use fictional fixtures only. Never copy personal histories or credentials.

## Active authorities

- Read [structure](docs/structure.md) when navigating or reorganizing the directory, and [commands](docs/commands.md) for runnable entrypoints. The course extraction excludes the source system's private archive.

- Read [workflow-contract](docs/workflow-contract.md) for preparation, review, authorization, submission evidence and recovery. It consolidates the user decisions through 2026-10-15; older dated instructions and ADR wording are historical where superseded.
- Read [candidate-inputs](docs/candidate-inputs.md) for factual ownership and input loading. Candidate facts and preferences belong in their canonical data sources, not ATS skills.
- Read [ui-contract](docs/ui-contract.md) before UI updates. Its active versioned renderer, interactions and baseline remain fixed; preserve historical manifests. Change data through documented domain APIs and `npm run data`; use stable IDs, never row numbers. Do not rewrite entire existing tracker/review files or rebaseline the UI to bypass a check. Explicit user-directed UI changes follow the contract's controlled successor process.

## Execution boundaries

- Codex's in-app Browser is the only page executor. No Chrome profile dependency, extension, Simplify, alternate browser engine, hidden ATS API or retired executor.
- Candidate scope is configured in the selected preferences file. Example data is fictional and is for local development, fixtures and offline evaluation. Never submit it to an employer. Legacy China code is inert compatibility code, not an active workflow.
- Job directions are open configured values and do not require a resume to shortlist. Every new application needs an explicit configured resume profile; never infer it from the job direction or silently switch its approved PDF. See `docs/job-directions.md`.
- Current discovery is New Grad only, with SimplifyJobs/New-Grad-Positions as the sole lead repository. Use its PM section for Product Management and corresponding sections for other configured directions; verify linked employer pages. Do not default to open web search or expand sources to fill a quota. See `docs/job-discovery.md`.
- Daily job updates follow `docs/job-refresh.md`: selected confirmed real workspaces update every 24 hours, catch up once when overdue, and keep manual refresh. All triggers share one active request. Only an actual completed current-context round advances freshness; automatic matching never authorizes Apply or Submit.
- For Matching, read `skills/matching/SKILL.md` and the stage it routes to: `skills/matching/intake/SKILL.md`, `skills/matching/discovery/SKILL.md`, or `skills/matching/feedback/SKILL.md`. For discovery, also read `docs/job-discovery.md`. Use the job-library interfaces; discovery does not authorize applying or submitting.
- For filling, use `skills/submission/SKILL.md` and the applicable ATS module. Deterministic approved facts are automatic; genuinely unknown facts become review questions. Do not invent personal history.
- For interview scheduling, preparation or debriefs, read `skills/interview/SKILL.md` and only the relevant mode reference. Reuse canonical candidate/opportunity inputs; keep interview state separate from evaluator outputs. Follow `docs/interview-storage.md` for ownership and paths. Calendar confirmation and preparation-plan acceptance are separate from application authorization.
- Keep working answers and exact approval state in `data/drafts/`. After verified success is saved in `data/opportunities.json`, working drafts may be pruned. Keep a short source/reference and timestamp; permanent screenshots, raw mail and daily ledgers are not required.
- Approve means local content accepted, awaiting execution. It does not authorize submission. Follow the workflow contract for separate, explicit execution authorization and live verification; never manufacture a website approval.
- Restore the existing local service with `npm run review:resume`. Fresh, isolated storage uses `npm run runtime:init -- --dir <new-directory>`. Neither operation proves live ATS continuity or authorizes submission.

- Website messages with saved task IDs use the existing-chat workflow in `docs/commands.md`. Claim through `src/cli/chatTaskCli.ts`; never replay an already claimed task. Demo tasks remain fictional local rehearsals even when delivered to a real Codex chat.

## Maintenance

Keep shared operational policy in the workflow contract and platform-specific techniques in the narrowest skill. Record a dated maintenance note for rule changes; do not append contradictory "latest" blocks throughout the repository. Run tests, boundary checks and `npm run ui:check` for relevant repairs. Preserve real records and evidence when validating with synthetic inputs.

## Course ownership

Hannah Guan owns Matching; Yuming Feng owns Submission and integration; Erica Zhao owns Interview Coordination. The shared opportunity record is the handoff. Coordinate shared schema changes with affected owners. Interview has a development Python implementation and a read-only shared-input handoff; see `docs/interview.md` for verified scope and remaining integration work. Candidate facts and resume paths belong to selected inputs, never skills.

Use `npm run review` to open the current candidate workspace; absent data loads the default fictional case. Use `npm run example:load` to explicitly replace the current state from a saved example. Stop Review and other writers before switching cases. Preserve the prior state in the ignored local backup returned by the loader. Never merge two candidates or copy working data back to examples automatically. Read `docs/demo.md` only when running the optional fictional submission exercise.
