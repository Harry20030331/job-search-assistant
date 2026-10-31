# Team interfaces

Hannah Guan owns Matching, Yuming Feng owns Submission and system integration, and Erica Zhao owns Interview Coordination. Interview has a development implementation with an explicit read-only shared-input handoff; full unattended integration and unified end-to-end evaluation remain pending.

The [Hannah handoff](hannah-handoff.md) specifies the agreed LinkedIn candidate-onboarding work, required/optional input completion, and the existing opportunity JSON interface. Source preview and confirmed new-candidate search intake are implemented; live LinkedIn validation and complete application-onboarding validation remain pending.

Matching uses the jobs API to create/update an opportunity: stable job ID, employer, role, location, canonical URL, explicit job direction (the legacy job `category` field), sources and observed availability. Submission advances that same record and owns its application, working draft and success evidence. Neither module should keep a second authoritative job list.

Interview may start from a recruiting email and link an available opportunity by stable ID. Its data and behavior must be designed with its owner before extending shared schemas. Job directions are open values. Application resume keys come from the selected manifest; the `createApplication`/Review/lifecycle `category` parameter remains the resume key. The canonical adapter stores it in `application.resumeCategory` without changing the job direction. Source IDs remain finite and include `official-careers`; do not reuse an unrelated source ID. See [shared direction/resume contract](job-directions.md) for Yuming's integration review.

The executable handoff is `npm run interview -- context|stage`: the host selects `jobId`, the adapter reads `applicationId` when present (otherwise null), and explicit interview settings supply `interviewId`, round, timezone, budget and priorities. Both v2 candidate records and v3 descriptors use the existing profile loader. Source versions bind the snapshot to canonical candidate, preference, opportunity, invitation and settings files; changed inputs require a new handoff. Selection is not proof that an email matches the role. Interview must verify that association or ask before scheduling. The handoff remains read-only. The separate [workbench link/publication commands](interview-workbench.md) can now advance a verified, existing confirmed application through the shared lifecycle API and expose its selected business run on `/interviews`; link before staging so the canonical guard stays valid. They do not extend shared schemas or change application approval authority. User-requested navigation and interview presentation follow the controlled UI contract.

Collaborate directly on `main`. Sync the latest remote state before editing or pushing, resolve conflicts without overwriting others, and run the checks relevant to the change before pushing. The author owns validation and integration; no separate reviewer or pull request is required. Coordinate shared-interface changes with the affected module owner. Maintain comparable evaluation inputs/model/tools/budgets. Do not infer teammate progress from these ownership notes.

Maintenance, 2026-10-30: The user requested direct collaboration on main with author-owned checks and integration, replacing the previous mandatory branch/review workflow.

Interview's local handoff also records the canonical candidate source path (the shared profile behind v3 descriptors). An opt-in host-only account binding uses this source identity and scoped read-only debrief snapshots; it adds no fields to shared candidate/opportunity files. It must not guess ownership from names or automatically inherit account credentials. See [candidate learning](interview-learning.md).

## First development session

1. Install dependencies and run `npm run verify`. Use `npm run review` to open your current working candidate. Load/reset a saved case with `npm run example:load` or select another using `--from <directory>`; stop active writers before switching.
2. Read `data/candidate.json` and `data/preferences.md`, then the relevant skill and workflow contract. Runtime updates stay in `data/`; share code and deliberately maintained fictional inputs through Git.
3. Hannah can exercise discovery/screening against supplied job descriptions and persist accepted opportunities. Yuming can prepare and review an application for those same records. Erica can begin with fictional recruiting invitations and define the interview handoff before extending the shared schema.
4. Use isolated fixtures for repeatable tests; everyday development data may evolve. Keep evaluation inputs/model/tools/budgets comparable when measuring module improvements.

Adding a job direction or configured resume profile requires no schema change. Source identifiers remain a finite shared interface and require schema/interface tests when extended. The existing interviewing/offer lifecycle labels do not constitute an implemented interview workflow.

## Integration verification — 2026-10-30

Matching setup and open job directions, website-led Application, and Interview Coordination are integrated on main. The integration preserves direction/resume separation, avoids rewriting untouched legacy applications, retains the five-job Shortlist/Review checkpoints, and connects shared navigation without changing the separate Apply/Submit actions.

On macOS: 486 TypeScript tests passed; typecheck, UI v29, boundary, distribution and whitespace checks passed. Python discovery ran 232 tests: 231 passed and one optional Google SDK discovery test was skipped because the SDK is not installed. Home, Status, Review, Interviews and account routes returned HTTP 200 in an isolated fixture workspace. Browser visual inspection was unavailable due to disabled local browser access. No live employer submission, real Google-account operation or Windows verification was performed during integration.

The [2026-10-31 Interview update](interview-team-merge.md) preserves this Application workflow while integrating plan approval, practice recovery, memory and reminders under UI v30. It records Windows upstream-versus-merged regressions, browser verification and one actual fictional Codex practice generation. The full shared Windows suite remains failing; its results are separate from the earlier macOS verification.
