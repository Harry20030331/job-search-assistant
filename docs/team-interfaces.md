# Team interfaces

Hannah Guan owns Matching, Yuming Feng owns Submission and system integration, and Erica Zhao owns Interview Coordination. The existing Matching skill is a starting implementation; Interview is pending. No placeholder skill claims a working implementation.

Matching uses the jobs API to create/update an opportunity: stable job ID, employer, role, location, canonical URL, explicit category, sources and observed availability. Submission advances that same record and owns its application, working draft and success evidence. Neither module should keep a second authoritative job list.

Interview may start from a recruiting email and link an available opportunity by stable ID. Its data and behavior must be designed with its owner before extending shared schemas. Current source identifiers and category keys are finite; adding new values requires schema and interface tests, not silently reusing another source identifier.

Use a feature branch and PR. Keep changes independent where possible, agree on shared schema changes, and maintain comparable evaluation inputs/model/tools/budgets. Do not infer teammate progress from these ownership notes.

## First development session

1. Install dependencies and run `npm run verify`. Initialize your own working candidate with `npm run setup:example`; use `npm run review` for later sessions.
2. Read `data/candidate.json` and `data/preferences.md`, then the relevant skill and workflow contract. Runtime updates stay in `data/`; share code and deliberately maintained fictional inputs through Git.
3. Hannah can exercise discovery/screening against supplied job descriptions and persist accepted opportunities. Yuming can prepare and review an application for those same records. Erica can begin with fictional recruiting invitations and define the interview handoff before extending the shared schema.
4. Use isolated fixtures for repeatable tests; everyday development data may evolve. Keep evaluation inputs/model/tools/budgets comparable when measuring module improvements.

The existing matching categories and source identifiers are finite. Adding a source/category requires updating and testing its schema rather than assigning an unrelated identifier. The existing interviewing/offer lifecycle labels do not constitute an implemented interview workflow.
