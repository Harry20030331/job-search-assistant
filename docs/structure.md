# Structure and ownership

Skills describe work; data holds inputs and progress; source code validates updates and renders the fixed interface.

```text
skills/matching/
skills/submission/          ATS modules are nested here
src/                       logic, CLI, UI and colocated tests
scripts/                   verification
examples/                  fictional inputs only
docs/                      current contracts
```

A private runtime has `data/opportunities.json`, `data/drafts/<job-id>.json` and `data/discovery-state.json`. Candidate, preferences and resumes may be external; the demo copies the fictional inputs into its private data directory. There is no required CV directory or symlink.

| Data | Owner and lifetime |
| --- | --- |
| Candidate | Facts and scoped confirmed answers; user maintained |
| Preferences | Screening and writing preferences; user maintained |
| Resumes | Category to approved PDF path/hash; user maintained |
| Opportunities | One durable identity and lifecycle per role; Matching and Submission share it |
| Drafts | Temporary working answers, questions, snapshot and approval; removable after verified success |
| Discovery state | Completed-scan checkpoints; no duplicate job list |

Opportunity availability and application stage are distinct. Closing a posting does not erase submission evidence. Stable IDs bind records; visible row numbers are temporary. Drafts hydrate role headers from opportunities. An identity/CV/URL change invalidates old bindings. Domain interfaces use file locks, atomic writes and expected revisions.

The source workflow's private archive and runtime are excluded. Inert regional and credential helper code remains for compatibility and test coverage, with no configured accounts, private data or active commands. It is not needed to start the course demo. Tests may use synthetic legacy storage to validate recovery; normal startup uses opportunities and per-job drafts.

See [commands](commands.md), [candidate inputs](candidate-inputs.md), [UI contract](ui-contract.md), and [workflow contract](workflow-contract.md).
