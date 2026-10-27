# Team interfaces

Hannah Guan owns Matching, Yuming Feng owns Submission and system integration, and Erica Zhao owns Interview Coordination. Interview has a development implementation with an explicit read-only shared-input handoff; full unattended integration and unified end-to-end evaluation remain pending.

The [Hannah handoff](hannah-handoff.md) specifies the agreed LinkedIn candidate-onboarding work, required/optional input completion, and the existing opportunity JSON interface. Import and complete onboarding validation remain to be implemented.

Matching uses the jobs API to create/update an opportunity: stable job ID, employer, role, location, canonical URL, explicit category, sources and observed availability. Submission advances that same record and owns its application, working draft and success evidence. Neither module should keep a second authoritative job list.

Interview may start from a recruiting email and link an available opportunity by stable ID. Its data and behavior must be designed with its owner before extending shared schemas. Current source identifiers and category keys are finite; adding new values requires schema and interface tests, not silently reusing another source identifier.

The executable handoff is `npm run interview -- context|stage`: the host selects `jobId`, the adapter reads `applicationId` when present (otherwise null), and explicit interview settings supply `interviewId`, round, timezone, budget and priorities. Both v2 candidate records and v3 descriptors use the existing profile loader. Source versions bind the snapshot to canonical candidate, preference, opportunity, invitation and settings files; changed inputs require a new handoff. Selection is not proof that an email matches the role. Interview must verify that association or ask before scheduling. The handoff remains read-only. The separate [workbench link/publication commands](interview-workbench.md) can now advance a verified, existing confirmed application through the shared lifecycle API and expose its selected business run on `/interviews`; link before staging so the canonical guard stays valid. They do not extend shared schemas or change application approval authority. User-requested navigation and interview presentation follow the controlled UI contract.

Use a feature branch and PR. Keep changes independent where possible, agree on shared schema changes, and maintain comparable evaluation inputs/model/tools/budgets. Do not infer teammate progress from these ownership notes.

Interview's local handoff also records the canonical candidate source path (the shared profile behind v3 descriptors). An opt-in host-only account binding uses this source identity and scoped read-only debrief snapshots; it adds no fields to shared candidate/opportunity files. It must not guess ownership from names or automatically inherit account credentials. See [candidate learning](interview-learning.md).

## First development session

1. Install dependencies and run `npm run verify`. Use `npm run review` to open your current working candidate. Load/reset a saved case with `npm run example:load` or select another using `--from <directory>`; stop active writers before switching.
2. Read `data/candidate.json` and `data/preferences.md`, then the relevant skill and workflow contract. Runtime updates stay in `data/`; share code and deliberately maintained fictional inputs through Git.
3. Hannah can exercise discovery/screening against supplied job descriptions and persist accepted opportunities. Yuming can prepare and review an application for those same records. Erica can begin with fictional recruiting invitations and define the interview handoff before extending the shared schema.
4. Use isolated fixtures for repeatable tests; everyday development data may evolve. Keep evaluation inputs/model/tools/budgets comparable when measuring module improvements.

The existing matching categories and source identifiers are finite. Adding a source/category requires updating and testing its schema rather than assigning an unrelated identifier. The existing interviewing/offer lifecycle labels do not constitute an implemented interview workflow.
