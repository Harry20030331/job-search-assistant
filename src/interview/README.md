# Interview module map

The combined agent enters through [the interview skill](../../skills/interview/SKILL.md). Developer setup and commands live in [Interview](../../docs/interview.md); data ownership lives in [the storage contract](../../docs/interview-storage.md).

| Layer | Implementation | Purpose |
| --- | --- | --- |
| Chat workflow | `skills/interview/SKILL.md` and mode references | Route scheduling, preparation and debrief requests; obtain actual user decisions |
| Shared input adapter | `handoff.ts`, `../cli/interviewCli.ts` | Read canonical candidate/opportunity inputs and create source-bound workspaces |
| Business execution | `python/interview/` | Tool API, Google backend, inbox, proposal/material/debrief nodes and shared model invocation |
| Persistence | `python/interview/storage.py`, `inbox.py`, `memory.py`, `preparation.py`, `debrief.py` | SQLite records, source links, versions, approvals and retrieval |
| Evaluation | `python/evaluation/`, `python/benchmark/` | Original baseline groups, independent grading/judge, calibration and synthetic cases |

`npm run interview:tools -- call <operation> --workspace <absolute-work> --input <absolute-json>` invokes the business API. `npm run interview:local -- inspect --workspace <absolute-work>` reads a selected local workspace. Preparation executes through `interview:prepare`; research execution uses `interview:eval`. The Python wrappers use the explicit `INTERVIEW_PYTHON` environment when supplied.

The opt-in context path uses `context_preparation.py` for canonical capture/attachment and source-bound state, and `context_preparation_flow.py` for adapted proposal/material nodes. `interview:context-prepare` is distinct from historical preparation. See [context workflow](../../docs/interview-context-preparation.md) and [actual developer pilot](../../docs/interview-context-preparation-pilot.md).

`python/interview/enrichment.py` adds session-bound search/browser actions and evidence receipts. The current Codex chat performs page research; the Python module has no page-fetching transport or external-model dependency. It exports the existing context-request format. See [evidence enrichment](../../docs/interview-enrichment.md).

Business preparation/debrief nodes now live in `python/interview/`. Their former `evaluation.*` imports and the shared Codex runtime import remain as compatibility entries; no historical scores are regenerated. Shared inbox-development scaffolding still reuses some evaluation helpers. This packaging is not a custom agent loop, an automatic account/candidate binding, or evidence of a measured improvement.
