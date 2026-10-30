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

A private runtime has `data/opportunities.json`, `data/drafts/<job-id>.json` and `data/discovery-state.json`. The default development workspace stores its copied candidate inputs beside those records in `data/`. Explicitly selected candidate, preference and resume paths may also be external. There is no required CV directory or symlink.

| Data | Owner and lifetime |
| --- | --- |
| Candidate | Facts and scoped confirmed answers; user maintained |
| Preferences | Screening and writing preferences; user maintained |
| Resumes | Category to approved PDF path/hash; user maintained |
| Opportunities | One durable identity and lifecycle per role; Matching and Submission share it |
| Drafts | Temporary working answers, questions, snapshot and approval; removable after verified success |
| Discovery state | Completed-scan checkpoints; no duplicate job list |

Opportunity availability and application stage are distinct. Closing a posting does not erase submission evidence. Stable IDs bind records; visible row numbers are temporary. Drafts hydrate role headers from opportunities. An identity/CV/URL change invalidates old bindings. Domain interfaces use file locks, atomic writes and expected revisions.

The source workflow's private archive and runtime are excluded. Inert regional and credential helper code remains for compatibility and test coverage, with no configured accounts, private data or active commands. It is not needed to start the workbench. Tests may use synthetic legacy storage to validate recovery; normal startup uses opportunities and per-job drafts.

See [commands](commands.md), [candidate inputs](candidate-inputs.md), [UI contract](ui-contract.md), and [workflow contract](workflow-contract.md).

Ignored `local/search-workspaces.json` indexes known workspace paths only; it is not a second job store. Matching intake and fictional workspace creation register paths for resume discovery. See [saved searches](workspaces.md).

## Example and local workspace

`examples/` contains saved fictional state. `data/` is the current working state. `npm run review` opens existing data; when data is absent, it supplies the default Alex case. `npm run example:load` replaces current data with the default example; `--from <directory>` selects another bundle, and `--dir <workspace>` selects the destination workspace. Stop Review and other writers before loading.

The loader validates a staged copy before switching. It preserves previous data under ignored `local/example-backups/` and reports that path. It copies candidate facts, preferences and all manifest-referenced PDFs, plus optional opportunity, draft and discovery records. If progress files are omitted, those stores start empty. It never merges two candidates. Examples remain unchanged as working data evolves.

`src/` contains application behavior, including initialization. `scripts/` contains development checks; it does not store candidate state. `src/demo/` is an optional fixed submission test with a simulated employer, separate from normal workbench startup. The current web UI contains Status and Review, not a candidate editor or workspace switcher.

The full directory tree and startup/loading commands are maintained in the repository README. The candidate bundle is copied as a unit; its README is documentation, not runtime input. Progress is loaded from the selected example when provided, otherwise starts empty, and then accumulates around that candidate. Working data is not a log of the examples directory. Deliberately improving the shareable fictional baseline is a separate reviewed change.
