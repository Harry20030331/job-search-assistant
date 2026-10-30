# Local tool interface

Use the Python executable stated in TASK.md. From the run workspace:
`PYTHON -m interview.tools call OPERATION --input payload.json`
Write payload.json before calling. All operations return `{ok,data}` or `{ok:false,error}` and append an audit record. Only local files and simulated events are affected. Do not change tool source, SQLite directly, confirmation records, or the run configuration. Output schemas and this protocol are identical across groups.

Common payloads:
- mail.read: `{}` or `{message_id: "<...>"}`. Returns mail source IDs and thread references.
- context.get: `{}` or `{application_id:"..."}`. Returns application, profile, clock and available source IDs.
- documents.read: `{source_id:"jd"}`. Returns the source text.
- calendar.list: `{}` or `{start:"ISO_WITH_OFFSET",end:"ISO_WITH_OFFSET"}`.
- calendar.create/calendar.update: `{operation:"create|update",interview_id:"...",event_id:null|"...",title:"...",start:"ISO_WITH_OFFSET",end:"ISO_WITH_OFFSET",timezone:"IANA",reminder_minutes:[1440,60],confirmation_id:null|"HOST_CONFIRMATION_ID"}`. Create requires null event_id; update requires an existing one. The host supplies confirmation IDs only after the user confirms. Never invent one. This experimental adapter records errors rather than auto-fixing business mistakes.
- mail.save_draft: `{in_reply_to:"<message_id>",body:"..."}`.
- history.list: `{offset:0,limit:20}`. Paginate until next_offset is null.
- history.read: `{record_id:"..."}`.
- history.append: `{record_id:"...",created_at:"ISO_WITH_OFFSET",text:"verbatim user debrief"}`.

C/D extensions:
- workflow.load: `{interview_id:"..."}`.
- workflow.save: `{interview_id:"...", ...your state fields}`.
- workflow.check: `{action:ACTION_WITHOUT_CONFIRMATION_ID,confirmation_id:"..."}`. Returns confirmation matching, conflicts and duplicates.

D extensions:
- memory.upsert: `{memory_id:null|"...",source_id:"raw_record_id",created_at:"ISO_WITH_OFFSET",company:null|"...",role:"backend_swe|ml_engineer",round:null|"...",topics:["..."],observation:"user fact",next_action:"suggestion",status:"active|resolved|superseded",supersedes_id:null|"..."}`. Upsert validates that source history exists. Company/round refer to the historical interview: leave null when the original debrief does not establish them; the upcoming application's metadata is not evidence of a past interview's company or round.
- memory.search: `{query:"...",topics:["..."],role:"...",round:"..."}`. Returns at most five valid relevant records.

Changing an existing memory with memory.upsert automatically creates a new version, returns its new memory_id and marks the old version superseded. Always use the returned ID; exact repeat upserts are idempotent. Original version content is retained.

Known topics include capacity_estimation, system_design, project_story, evaluation, coding, communication. Use consistent English tags grounded in the source; aliases include "capacity estimation" and "system design".

Use needs_input/questions for missing facts; awaiting_confirmation/proposed_action for user approval. Wait for the next user message instead of simulating approval. Fixed reminders are 1440 and 60 minutes before the start, excluding reminders already in the past. Return final structured JSON; the host exports preparation.json/.md from preparation so all groups get the same rendering.
