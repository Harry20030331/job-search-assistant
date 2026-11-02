---
name: coordinating-interviews
description: Coordinate interview invitations, schedule proposals, preparation and user-provided debriefs for a selected candidate and shared opportunity. Use after recruiting activity, not for job discovery or application submission.
---

# Interview Coordination

Follow `../../docs/workflow-contract.md` and `../../docs/candidate-inputs.md`. Use the Interview preparation website request form for user input, follow-up questions, availability, plan changes and debriefs. A saved website request is processed in the connected existing Codex chat; claim it once with `interview:request`, then return a plain-text result or missing-information question through its finish command. Construct tool payloads for the user. Calendar writes still require explicit confirmation of the exact displayed action, and practice generation still requires approval of the current plan/version. The chat-input route remains a compatibility option. Candidate facts belong in the selected canonical sources. Read `../../docs/interview-storage.md` when choosing or recovering a workspace.

Read the selected candidate workspace and use stable job/application IDs. The host's explicit job selection supports a handoff, but does not prove that incoming mail concerns that role or round. Verify the evidence; ambiguous identity, timezone, duration or availability requires clarification. Do not silently create another application or job list.

Choose the relevant mode and read its reference:

- New invitation, availability, rescheduling or calendar action: [scheduling](references/scheduling.md).
- Preparation proposal, plan revision or accepted full materials: [preparation](references/preparation.md).
- User debrief, reported improvement or later reuse: [debrief](references/debrief.md).
- Link a verified round to the shared application or show its plan/debrief: [tracking](references/tracking.md).
- Benchmark or method comparison: use `../../docs/interview-evaluation.md`; evaluator decisions are not real-user authorization.

Runtime operations and JSON payloads are documented in each workspace's TOOL_GUIDE and TASK. `npm run interview:tools` invokes the existing tool API; `interview:local inspect` reads an explicitly selected workspace. Operational execution lives under `src/interview/python/interview/`; independent runners, graders and judge live under `evaluation/`. Historical evaluation entrypoints remain compatible.

For preparation, show a short sourced proposal within the explicit time budget. Wait for actual acceptance of the current proposal/version before generating full exercises and answer points. Do not reuse an earlier plan approval or calendar confirmation. Label suggested questions as practice and retain unknown employer details. Save debrief text unchanged and distinguish self-assessment, reported interviewer feedback and model suggestions. The experimental benchmark skill lives separately inside the Python module so the historical A/B/C/D prompts remain identifiable.

Live Gmail/Calendar uses the separately configured project OAuth backend; platform-connector and other installations' tokens are not inherited. Preserve unread mail state. This repository ships no credentials, real mail or continuous poller. Local stage mode does not configure a live backend. Application submission approval never grants calendar or preparation approval.

For a website request marked `mode: demo`, preserve fictional provenance throughout. Do not access real Gmail, Google Calendar or employer forms. The exact saved Alex Liu case may use the guarded checkpoint in `docs/alex-case-demo.md` after the required local demo submissions; reuse existing staged runs. Synthetic plan decisions and debriefs use `synthetic_test_script`, never human authorization. Model-backed practice still waits for approval of the exact displayed Plan.


## Status recording shortcut — 2026-11-01

After a completed local Submit rehearsal, a fictional Demo workspace exposes **Simulate interview** on Status. The shortcut creates one idempotent invited round linked to the exact job/application and completed task, approved snapshot and revision. It stores `demoSubmission` provenance in the interview registry and derives Interviewing only while that proof remains current. No Gmail, Calendar, employer request or canonical submission evidence is created. Reopened content invalidates the projection. Real workspaces and live mode reject the shortcut. Reuse this round when preparing interview materials; do not relink it as a real invitation or invoke the separate authored demo checkpoint. Preparation-plan acceptance remains separate.
