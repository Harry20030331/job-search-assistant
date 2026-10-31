# Interview plan approval and debrief reminders

Maintenance date: 2026-10-30. This implements the user's requested website plan approval and post-interview follow-up. Shared applications, submission authorization and Google Calendar confirmation remain separate.

## Review before practice

Publish the current proposal through `interview:track publish`, before generating materials. The Plan tab shows its version, time allocation, rationale and unknowns. **Approve plan & generate practice** accepts that exact proposal and starts one asynchronous Codex direct-practice job. Personal corrections and detailed revision requests stay in chat. A revised proposal never inherits earlier approval or displays its old pack.

The website request contains interview ID, registry revision, proposal ID/version/hash and an explicit retry flag. It cannot supply a workspace, candidate, approval provenance, output path, arbitrary prompt or model. The server resolves the candidate-bound registry, checks the selected application/run and freshness, then invokes the host-only Python action. SQLite atomically saves exact acceptance and queues the job. Normal browser decisions record `human_workbench`; fictional preview records use `synthetic_test_script`. Chat approval remains valid; an already approved plan offers Generate practice without manufacturing another human decision.

The worker uses the existing configured Codex model, direct-question format, source/policy guards and coding checks. It generates no material before approval. Duplicate or simultaneous clicks share a job, and only one worker can claim it. Queued/running/ready/failed state survives page reloads. Public errors are allowlisted; raw model errors and local paths are not returned. Failures require an explicit Retry click; attempt rows and outputs remain available privately. A revised/rejected plan during generation cannot publish a pack for the current plan.

The loopback service enforces its exact Host/Origin, JSON content type, bounded request bodies, a random server CSRF token and strict payloads. The token is read from a same-origin response; it is not a Google token or user login. This remains a single local candidate workspace, not production multi-tenant authentication. The server must have Codex CLI access and allowed network access.

### Interrupted generation recovery

Maintenance note, 2026-10-30: a running website worker renews its attempt every 15 seconds. A queued or running attempt without an update for 120 seconds is presented as failed with `generation_interrupted`, including historical rows with no worker heartbeat. Dashboard reads project that status without changing the database. A clock rollback or malformed timestamp fails closed; this local deadline requires a reasonably stable system clock.

The existing Plan-tab retry button is the only restart path. The server revalidates the current registry, proposal, sources and approval before retiring the expired attempt and creating one new queued row. Concurrent clicks share that row. The exact current approval is reused; changed or rejected plans still need their own acceptance. Original attempts, approvals and diagnostic pointers remain available. Neither polling, service restart nor lease expiry starts another model call.

An expired worker cannot renew its lease, enter the model invocation, or publish a late answer. Publication checks its attempt inside the same SQLite transaction as the material write and marks the attempt ready in that transaction. This prevents an old result from overwriting a retry, and preserves a committed pack if the worker exits before writing its diagnostic files. A duplicate launch error cannot cancel another worker's running claim. Stop old workers before upgrading: already loaded older code cannot gain the new fencing retroactively. An orphaned Codex subprocess might still finish and consume quota after a host crash; fencing prevents its stale publication but does not promise cancellation of external computation. Retry deliberately starts another attempt. See [verification and platform limits](interview-generation-recovery.md).

Generation outputs currently use an opaque system-temporary directory outside repository instruction ancestors. Its path is saved privately in `web_practice_jobs.output_path`; accepted proposals, approvals, materials and attempt states stay in the run's durable SQLite store. Copy diagnostic outputs to the private experiment directory before OS temporary-file cleanup when needed. No credentials enter the actor workspace.

## End-time follow-up

Use the explicit schedule end instant, including its UTC offset. Once elapsed, a scheduled round appears in Completed and qualifies for a reminder; this is a display projection, not proof of attendance or a successful interview, and does not mutate the registry or application stage. Unknown-time, future, cancelled and invalid-identity rounds are excluded. A saved interview debrief suppresses follow-up; a practice report does not.

All workbench pages poll the same-origin state endpoint every 30 seconds. An accessible inline reminder names the role, links its Debrief view and invites a report in Codex chat. Dismiss persists a website receipt. Reminder identity binds the interview and schedule, so rescheduling invalidates the old notice. Receipts are candidate-bound under `<runtime>/interviews/notification-receipts.json`, atomically written under the shared file lock. Chat delivery and website dismissal are independent.

For chat delivery, the host must explicitly register a Codex thread heartbeat for the selected candidate runtime. The repository does not send messages into arbitrary Codex chats. In this development chat a 15-minute heartbeat is configured through the app; it skips synthetic cases and stays quiet without new notices. Other users register their own chat/runtime binding during onboarding. Changing the selected runtime requires updating that binding. Keep the computer on and the app running for local scheduled work, as described in the [official scheduled-task documentation](https://learn.chatgpt.com/docs/automations?surface=app).

The heartbeat runs:

```text
npm run interview:notifications -- pending --runtime-dir <absolute-selected-runtime>
npm run interview:notifications -- ack --runtime-dir <same-runtime> --id <exact-notification-id>
```

Pending excludes synthetic cases by default; `--include-synthetic` is for explicit development verification. The host revalidates and acknowledges immediately before one chat reminder. Send only when the acknowledgement returns `acknowledged: true`; concurrent or repeated acknowledgement returns false. Ack-before-send suppresses duplicate reminders but cannot guarantee delivery if the host crashes between acknowledgement and the chat message. It is not an exactly-once messaging transport. No email, calendar write, inferred debrief, automatic scoring or application action is performed by a reminder.

## Verification

Python tests cover approval binding, source/plan changes, concurrent duplicate decisions, a single job claim, retained failed attempts, explicit retry and changes during generation. TypeScript tests cover end-time boundaries, offsets, cancellation, unknown time, debrief scope, rescheduling, independent receipts, escaped versioned controls, stale/cancelled gating, and HTTP Origin/CSRF/JSON protection. A fictional recruiter round was separately exercised through the actual browser button and configured Codex runtime. These are integration checks, not a new semantic benchmark or human acceptance study.
