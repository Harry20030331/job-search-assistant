# Shared application tracking and interview view

Read [the workbench contract](../../../docs/interview-workbench.md) for payloads, revisions, ownership and preview commands. Use the selected candidate runtime, canonical profile and existing job/application IDs. This mode records local recruiting progress; it grants no calendar, material-generation or application-submission approval.

After actually verifying the account, message/thread, company, exact role and round association, construct a private `interview:track link` payload. Use its real source/reference/time, or `synthetic_test_script` for an explicitly fictional exercise. Do not use title/sender similarity alone as proof. Unknown time remains null and the round stays invited. A scheduled time is not a claim that Google Calendar was written.

Link through the existing confirmed application before staging preparation. Preserve submission evidence and lifecycle rules; missing confirmation or application identity must be resolved through the owning module, not fabricated. Cancellation affects one round, not the whole application. Use a new interview ID for another round and the current registry revision for an update. Never rewrite shared opportunity or registry files ad hoc.

Then use the existing staged preparation flow and exact plan acceptance in chat or on the website. Publish the fresh work directory through `interview:track publish`, retaining the current expected registry revision. A candidate/account learning binding is a separate explicit operation. A reschedule or source change requires a fresh run/context; do not delete guards or copy prior approval. Show stale state and withhold old materials.

Open the server's `/interviews` URL for the user when requested. The page reads real business state and offers Overview, Preparation and Debrief. The Plan tab accepts the exact displayed version and queues practice. Detailed revisions, recruiting state updates and free-text debrief input stay in chat; construct tool payloads rather than asking the user to edit JSON. Use `interview:demo` in a new directory for a fictional preview; it must never overwrite current candidate data or be described as a model benchmark.


## Status recording shortcut — 2026-11-01

After a completed local Submit rehearsal, a fictional Demo workspace exposes **Simulate interview** on Status. The shortcut creates one idempotent invited round linked to the exact job/application and completed task, approved snapshot and revision. It stores `demoSubmission` provenance in the interview registry and derives Interviewing only while that proof remains current. No Gmail, Calendar, employer request or canonical submission evidence is created. Reopened content invalidates the projection. Real workspaces and live mode reject the shortcut. Reuse this round when preparing interview materials; do not relink it as a real invitation or invoke the separate authored demo checkpoint. Preparation-plan acceptance remains separate.
