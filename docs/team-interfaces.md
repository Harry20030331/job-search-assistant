# Team interfaces

Hannah Guan owns Matching, Yuming Feng owns Submission and system integration, and Erica Zhao owns Interview Coordination. The Matching entry skill routes to candidate intake, job discovery, and matching/feedback child skills; Interview is pending. No placeholder skill claims a working implementation.

The [Hannah handoff](hannah-handoff.md) specifies the agreed LinkedIn candidate-onboarding work, required/optional input completion, and the existing opportunity JSON interface. Source preview and confirmed new-candidate search intake are implemented; live LinkedIn validation and complete application-onboarding validation remain pending.

Matching uses the jobs API to create/update an opportunity: stable job ID, employer, role, location, canonical URL, explicit job direction (the legacy job `category` field), sources and observed availability. Submission advances that same record and owns its application, working draft and success evidence. Neither module should keep a second authoritative job list.

Interview may start from a recruiting email and link an available opportunity by stable ID. Its data and behavior must be designed with its owner before extending shared schemas. Job directions are open values. Application resume keys come from the selected manifest; the `createApplication`/Review/lifecycle `category` parameter remains the resume key. The canonical adapter stores it in `application.resumeCategory` without changing the job direction. Source IDs remain finite and include `official-careers`; do not reuse an unrelated source ID. See [shared direction/resume contract](job-directions.md) for Yuming's integration review.

Use a feature branch and PR. Keep changes independent where possible, agree on shared schema changes, and maintain comparable evaluation inputs/model/tools/budgets. Do not infer teammate progress from these ownership notes.

## First development session

1. Install dependencies and run `npm run verify`. Use `npm run review` to open your current working candidate. Load/reset a saved case with `npm run example:load` or select another using `--from <directory>`; stop active writers before switching.
2. Read `data/candidate.json` and `data/preferences.md`, then the relevant skill and workflow contract. Runtime updates stay in `data/`; share code and deliberately maintained fictional inputs through Git.
3. Hannah can exercise discovery/screening against supplied job descriptions and persist accepted opportunities. Yuming can prepare and review an application for those same records. Erica can begin with fictional recruiting invitations and define the interview handoff before extending the shared schema.
4. Use isolated fixtures for repeatable tests; everyday development data may evolve. Keep evaluation inputs/model/tools/budgets comparable when measuring module improvements.

Adding a job direction or configured resume profile requires no schema change. Source identifiers remain a finite shared interface and require schema/interface tests when extended. The existing interviewing/offer lifecycle labels do not constitute an implemented interview workflow.
