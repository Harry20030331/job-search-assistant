# Team interfaces

Hannah Guan owns Matching, Yuming Feng owns Submission and system integration, and Erica Zhao owns Interview Coordination. The existing Matching skill is a starting implementation; Interview is pending. No placeholder skill claims a working implementation.

Matching uses the jobs API to create/update an opportunity: stable job ID, employer, role, location, canonical URL, explicit category, sources and observed availability. Submission advances that same record and owns its application, working draft and success evidence. Neither module should keep a second authoritative job list.

Interview may start from a recruiting email and link an available opportunity by stable ID. Its data and behavior must be designed with its owner before extending shared schemas. Current source identifiers and category keys are finite; adding new values requires schema and interface tests, not silently reusing another source identifier.

Use a feature branch and PR. Keep changes independent where possible, agree on shared schema changes, and maintain comparable evaluation inputs/model/tools/budgets. Do not infer teammate progress from these ownership notes.
