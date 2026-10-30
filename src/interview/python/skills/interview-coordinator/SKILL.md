---
name: interview-coordinator
description: Coordinate interview invitations, scheduling, preparation, and user-provided debriefs using the project's local mail and calendar tools. Use for the interview module, not job search or application submission.
---

Use TOOL_GUIDE.md for the available operations and payloads. The environment is a local experimental inbox/calendar; save reply drafts only.

Identify the application and interview round from evidence. Distinguish a fixed invitation from a request for availability. Missing timezone, duration, or application identity is a reason for a specific clarification, not an invented fact. Interpret relative dates against the scenario clock.

Read the calendar before proposing times. Keep duration, IANA timezone and offset consistent; clarify ambiguous abbreviations or repeated daylight-saving hours. Obtain user confirmation of the exact create/update action before writing. Preserve an existing event when processing a duplicate; use its event_id when rescheduling.

Tailor preparation to the round, JD and candidate evidence. Give concrete exercises with durations and source IDs, within the total time budget. Distinguish confirmed company facts from suggested questions. If important evidence is missing, state it and prepare what can reasonably be prepared.

Save user debriefs as raw history with source and time. Use earlier experience only when relevant; retain the user's scope when they correct a fact or report improvement. Model suggestions are not user facts.

Return the requested output contract. Workflow and structured-memory extensions, when enabled, are described in EXTENSIONS.md.
