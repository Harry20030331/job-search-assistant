# Team update and Interview integration verification

Date: 2026-10-31. The user requested merging the updated team repository with the current Interview work and retesting Interview. Upstream input: `8fbd50e` (Matching, Application and Interview integration). The local Interview checkpoint is `1b5b31f`; merge commit `a2e31a2` retains both histories. The updated repository policy uses direct collaboration on `main`.

## Integration changes

Preserve the updated Matching intake, open job directions and explicit application resume binding. Preserve Application's content-only approval, separate preparation/submission tasks, Status actions, Review editing and saved example checkpoints. Interview keeps exact current-plan acceptance, one asynchronous practice attempt, explicit failure recovery, source guards, candidate-bound memory and independent website/chat debrief receipts. Application approval never becomes Interview or Calendar approval.

Resolve the shared header by retaining its `status-top` / `review-top` parameter and adding the Interview reminder region and script. Add only the Interview reminder/plan styles to the shared Application styles. Application renderers, workflow browser script and practice formatter retain their upstream content. Historical Application v5/v29 and Interview v5 manifests remain separate; the controlled integration successor is UI v30. LF attributes cover all frozen files.

Vitest now selects `src/**/*.test.ts`. Its previous unrestricted discovery included an ignored local verification copy, running historical tests alongside current source. This selection removes private/runtime copies from the denominator without skipping any current-source test. New interface tests cover an open Product Analytics direction with a distinct `analytics_general` resume profile, a read-only handoff and both Application header variants retaining Interview reminders.

## Results

| Check | Result |
| --- | --- |
| Complete offline Interview Python suite | 274 passed |
| Interview, workbench and related Application UI/task tests | 155 passed |
| Current-source complete TypeScript suite on Windows | 443 passed, 52 failed; 495 total |
| Unmodified upstream `8fbd50e` on the same Windows host/dependencies | 431 passed, 55 failed; 486 total |
| Newly failing test names against upstream | None; all 52 failures also failed upstream |
| Virtual mailbox scripted scenarios | 10/10 passed; zero model calls |
| Virtual transport/calendar infrastructure | 12/12 passed; no Google calls |
| Type checking, UI v30, boundaries, distribution and whitespace | Passed |

The three upstream-only failures were timing-sensitive tests; the different counts are not evidence of fixing them. The current 52 failures remain unresolved shared Windows issues, including Unix permission assumptions, symlink privileges, POSIX helper executables, fake executable launching and path fixtures. The default shared startup still encounters `unsafe_recovery_file_permissions` in `src/review/reviewRecovery.ts:27`. No security check was disabled and `npm run verify` is not claimed green.

## Actual website and model check

Create a new isolated fictional preview, revise its recruiter proposal through the domain API, then click the actual Plan-tab approval button. The registry records `synthetic_test_script`, not a real human's preparation decision. One configured `gpt-6-luna` Codex invocation completed in 45.344 seconds using CLI 0.163.0, with zero actor shell commands. Its first attempt produced eight direct questions, including plan-bound alternatives and no coding for the recruiter round. Main sections retain exactly 7, 8 and 5 minutes. One durable job is ready, the current proposal is v2, and source freshness is current. Browser inspection confirmed Method and Sample answer expansion.

The browser also verified the updated Status layout with visible elapsed-interview reminders. Screenshots and the node's original inputs/output/invocation logs are retained in the private development `runs/team-merge-20261031/`, alongside machine-readable test reports, an upstream source archive and the merge checkpoint patch. UI v30 records author verification, not independent human review. Semantic quality remains `pending_unrated`; this single fictional integration case is not a held-out success rate.

There were no real Gmail/Calendar calls, employer submissions, external AI-provider calls or changes to the selected candidate/heartbeat binding. Existing private runtimes were not migrated or merged. New preview services use explicit isolated paths and no Google configuration. A future user still needs their own account/candidate binding; continuous inbox orchestration and evaluation-set/judge calibration remain separate unfinished work.
