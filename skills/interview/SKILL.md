---
name: coordinating-interviews
description: Coordinate interview invitations, schedule proposals, preparation and user-provided debriefs for a selected candidate and shared opportunity. Use after recruiting activity, not for job discovery or application submission.
---

# Interview Coordination

Follow `../../docs/workflow-contract.md` and `../../docs/candidate-inputs.md`. Use this chat for user input and confirmation; construct tool payloads for the user. Candidate facts belong in the selected canonical sources. Read `../../docs/interview-storage.md` when choosing or recovering a workspace.

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
