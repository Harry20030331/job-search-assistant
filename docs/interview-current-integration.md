# Current Interview integration verification

Maintenance date: 2026-10-31 (America/Los_Angeles). Scope: current uncommitted source, normal website startup and the existing fictional Alex Liu example. No code was committed or pushed. `main` and `origin/main` had no commit divergence after fetch. No real employer, Gmail or Google Calendar actions were taken.

## Normal startup is configured

`npm run interview:setup` installs pinned core and optional Google SDK dependencies into the ignored project-local `src/interview/python/.venv`. Every TypeScript/Python bridge and the npm Python runner uses one resolver: explicit `INTERVIEW_PYTHON`, otherwise the project environment, otherwise the platform Python command. Resolution is independent of candidate working directories. `npm run interview:check` verifies Python and exact core versions; ordinary `npm start` reports readiness without requiring an override.

On this installation, setup and the default check succeeded with Python 3.12.12, all pinned core dependencies and Google SDKs. Default `npm run interview:test` passed 275 tests. Both initial ordinary startup and a later ordinary restart reported `interview_runtime=ready`. This replaces the earlier audit's missing-default-runtime limitation. Setup does not log into Codex or connect Google; real model operations still require Codex login.

## Observed fictional journey

The in-app Browser selected the shipped fictional example through normal Welcome. The isolated workspace was `local/workspaces/example-001cb860-14ca-4ed5-b995-0afb01cd1305`; the canonical real candidate state was not replaced. This is a local rehearsal, not evidence of a live matching round or employer submission.

| Step | Observed result |
| --- | --- |
| Welcome → Profile → Status | Exact shipped Alex Liu profile and five saved public-role fixtures loaded. Automatic job updates remained paused for the fictional example. |
| Select Nooks + Adobe → Apply | Both local demo preparation tasks reached `needs_review` even with a connected chat. Demo tasks now use the local executor rather than waiting for live task dispatch. |
| Review → save answers → approve → Submit | The two actual browser-driven local submit tasks reached `demo_complete`. Unknown required answers blocked approval until saved. No employer forms were opened. |
| Submission → Interview | The guarded `demo:alex:interviews` checkpoint required those exact completed tasks and current approved drafts. It authored synthetic receipts/invitations and staged three rounds on the same application IDs. The other three roles were preserved. This checkpoint is deliberately synthetic, not observed recruiting evidence. |
| Context → Plan | The existing configured model produced a source-bound context and 60-minute plan for Adobe technical. Missing JD, company facts and interviewer identity remained unknown. The host used existing tools to attach/publish it; the user-facing plan appeared on the shared website. |
| Website approval → Practice | The actual Plan button saved an exact-version decision with `synthetic_test_script` origin and queued generation. The first material attempt failed validation; explicit website retry succeeded with eight displayed questions (four planned and four alternatives). The existing model and validator were unchanged. |
| Website debrief → saved result | The completed Adobe screen received a debrief through the actual website form. The owning chat claimed it once, saved the exact text with synthetic origin, ran model extraction through the domain flow, published that round and returned a website completion reply. Original text, self-assessment and suggested practice were displayed separately. |
| Ordinary restart → Continue existing search | The same saved workspace resumed through Welcome. All three rounds, the generated Practice and saved Debrief remained available. No temporary Python override or reinitialization was used. |

This validates a host-orchestrated local product journey. Backend staging/context/proposal/publication remains work performed by the connected Codex host using existing tools, while user input and exact approval are on the website. A fresh fictional example does not automatically manufacture later invitations or approved materials. The two other rounds are staged, without a generated plan or practice pack. Real Google scheduling and real ATS continuity were not part of this rehearsal.

## Model attempts and content checks

The configured `gpt-6-luna` with high reasoning was retained. Five actual model invocations occurred: context analysis (11.406 s), plan (15.133 s), first materials (56.519 s, rejected), explicit material retry (50.296 s, accepted) and debrief (8.571 s). There were no automatic retries or judge calls. Token/cost totals are not an independently verified billing statement.

The first material output incorrectly claimed `count_pairs([1,1,3,4],5) == 4` for distinct index pairs; the answer is 2. The executable-answer validator rejected the pack, and the website retained approval with an explicit retry button. Its failure record remains saved. No invalid material was published or hand-edited into acceptance.

The retry passed mechanical/source/version checks and rendered its questions and expanded coding guide. Both coding solutions additionally passed 200 deterministic random finite-score cases and two additional boundary/type cases each, alongside their declared tests: 208 and 206 checks respectively. These checks are bounded examples, not a proof of all-input correctness or a semantic-quality evaluation. Several alternatives reuse the main question's topic; usefulness/diversity still needs human review. Unknown employer facts remain explicit and simulated questions are not presented as actual employer questions.

Local diagnostic artifacts are under `/private/tmp/alex-normal-start-demo/`; the durable business state and job failure/approval history remain in the isolated workspace. The temporary model invocation directories are referenced by the saved generation jobs and are not source-controlled demo assets.

## Automated verification

- Full `npm run verify`: **533 TypeScript tests across 53 files**, type checks, controlled UI v34, boundary and distribution checks passed.
- Default `npm run interview:test`: **275 Python tests passed**, with the persistent project environment and no override.
- `npm run interview:virtual-tests -- --output <new-directory>`: **10/10** synthetic mailbox scenarios, zero model calls and zero real Google calls. The first invocation without its required output argument exited with usage; the correctly specified run passed.
- Runtime resolver tests cover explicit overrides, project selection, platform fallback and independence from candidate directories. Regressions cover local demo execution with a connected chat and demo-only Interview request instructions.

## Remaining integration limits

Google SDKs are installed, but real OAuth, Gmail reading, calendar writes/conflict checks and read-back have not been exercised here. Live use needs this installation's OAuth client, account binding and dedicated owned secondary calendar. A platform Gmail connector does not configure the project's backend. Continuous unattended inbox orchestration is not installed; email sending and attendee invitations are not implemented.

The existing exact application/plan approval, source freshness, stable IDs and one-time request claims remain in force. Demo requests now store mode and instruct the host to stay local; older saved requests without a mode remain readable. Default environment readiness is verified on this macOS installation; the historical Windows limitations in the team report were not re-evaluated. Formal model quality and real external integration remain separate from this successful local rehearsal.
