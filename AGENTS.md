# Applications Instructions

These instructions apply throughout this repository.

## Job-seeker welcome and setup

In a fresh conversation, treat a standalone greeting (for example, "Hi", "Hello"), "Start", "Get started", or a request to begin job-search setup as the onboarding entry point. Read `docs/welcome.md` and `skills/matching/SKILL.md`, then display the English welcome from `npm run matching -- welcome` and ask the user to choose a new candidate, an existing search, or the fictional example. Do not require a long activation prompt, JSON, or terminal commands from the user. Keep the welcome, setup questions, confirmation summary, search explanations and feedback interaction in English unless the user explicitly requests another language. Do not greet repeatedly in an ongoing session or hijack code, review, debugging, architecture or other explicit development requests.

The greeting routes the first user message; it is not a background task or a zero-message startup hook. Merely opening a folder does not establish candidate selection, consent to save facts, or permission to search. Never load the fictional example as the user's real identity. Follow the workflow contract for confirmed intake and search execution.

For a new candidate, accept a LinkedIn profile URL, PDF/DOCX/TXT/Markdown background document, pasted text, or combined sources using `npm run matching -- sources`; follow `docs/linkedin-import.md` for the designated LinkedIn source. Never require a resume for initial search or fabricate facts from an inaccessible profile.

For "Continue an existing search", first run `npm run matching -- workspaces` and present the numbered saved results and locations; do not make the user remember a path. After selecting/creating the workspace, start `npm run matching -- serve --workspace <directory>` and visibly open its returned Status URL before source browsing. Keep this results tab available, research in background tabs, and reload the results after each round. See `docs/workspaces.md` for discovery limits and missing-data handling.

Work on a feature branch and use a pull request for team review. Keep documentation, UI text, examples, comments and test descriptions in English. External-language recognition patterns and intentional non-English rejection probes may use Unicode escapes; do not translate away their behavior. Use fictional fixtures only. Never copy personal histories or credentials.

## Active authorities

- Read [structure](docs/structure.md) when navigating or reorganizing the directory, and [commands](docs/commands.md) for runnable entrypoints. The course extraction excludes the source system's private archive.

- Read [workflow-contract](docs/workflow-contract.md) for preparation, review, authorization, submission evidence and recovery. It consolidates the user decisions through 2026-10-15; older dated instructions and ADR wording are historical where superseded.
- Read [candidate-inputs](docs/candidate-inputs.md) for factual ownership and input loading. Candidate facts and preferences belong in their canonical data sources, not ATS skills.
- Read [ui-contract](docs/ui-contract.md) before Status/Review updates. Its v1 renderer, interactions and baseline remain fixed. Change data through documented domain APIs and `npm run data`; use stable IDs, never row numbers. Do not rewrite entire existing tracker/review files or rebaseline the UI to bypass a check.

## Execution boundaries

- Codex's in-app Browser is the only page executor. No Chrome profile dependency, extension, Simplify, alternate browser engine, hidden ATS API or retired executor.
- Candidate scope is configured in the selected preferences file. Example data is fictional and is for local development, fixtures and offline evaluation. Never submit it to an employer. Legacy China code is inert compatibility code, not an active workflow.
- Every new application needs an explicit configured category. Never infer or silently switch the category or mapped approved PDF.
- For Matching, read `skills/matching/SKILL.md` and the stage it routes to: `skills/matching/intake/SKILL.md`, `skills/matching/discovery/SKILL.md`, or `skills/matching/feedback/SKILL.md`. For discovery, also read `docs/job-discovery.md`. Use the job-library interfaces; discovery does not authorize applying or submitting.
- For filling, use `skills/submission/SKILL.md` and the applicable ATS module. Deterministic approved facts are automatic; genuinely unknown facts become review questions. Do not invent personal history.
- Keep working answers and exact approval state in `data/drafts/`. After verified success is saved in `data/opportunities.json`, working drafts may be pruned. Keep a short source/reference and timestamp; permanent screenshots, raw mail and daily ledgers are not required.
- Explicit acceptance of the exact current application in chat is valid approval and submission authorization under the workflow contract. Apply and verify agreed edits before submitting; do not manufacture a website event or demand a duplicate click.
- Restore the existing local service with `npm run review:resume`. Fresh, isolated storage uses `npm run runtime:init -- --dir <new-directory>`. Neither operation proves live ATS continuity or authorizes submission.

## Maintenance

Keep shared operational policy in the workflow contract and platform-specific techniques in the narrowest skill. Record a dated maintenance note for rule changes; do not append contradictory "latest" blocks throughout the repository. Run tests, boundary checks and `npm run ui:check` for relevant repairs. Preserve real records and evidence when validating with synthetic inputs.

## Course ownership

Hannah Guan owns Matching; Yuming Feng owns Submission and integration; Erica Zhao owns Interview Coordination. The shared opportunity record is the handoff. Coordinate shared schema changes with affected owners. Interview implementation is pending; do not claim it exists. Candidate facts and resume paths belong to selected inputs, never skills.

Use `npm run review` to open the current candidate workspace; absent data loads the default fictional case. Use `npm run example:load` to explicitly replace the current state from a saved example. Stop Review and other writers before switching cases. Preserve the prior state in the ignored local backup returned by the loader. Never merge two candidates or copy working data back to examples automatically. Read `docs/demo.md` only when running the optional fictional submission exercise.
