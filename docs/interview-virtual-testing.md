# Virtual mailbox and calendar verification

Maintenance date: 2026-10-30. Use a resettable local mailbox/calendar simulator to exercise Interview without provisioning more Google accounts. It runs in isolated local directories, requires no operating-system VM, Docker, SMTP service, credentials or Gmail account, and makes no real Google requests.

## What runs

`evaluation.virtual_services` implements the Gmail and Calendar resource/request interfaces consumed by the existing adapters. Mail is constructed as RFC email, encoded into Gmail-style raw resources and decoded by the actual `normalize_message` implementation. Discovery, history cursors, thread context, account checks, leases, classification validation and pending handoffs use the ordinary business code and SQLite state. Calendar creation and updates run through the actual `GoogleAdapter`, with simulated responses, exact synthetic host confirmation, conflict checks, stable event IDs, conditional updates and read-back checks. Mail remains unread in the simulator. No sending or attendee invitation operation is provided.

`benchmark/virtual-mailbox-v1/cases.json` contains ten AI-assisted fictional development cases: webinar newsletter, exact interview invitation, availability request, reschedule, cancellation, rejection after an earlier invitation, ambiguous round association, HTML logistics, missing timezone and an embedded instruction attempting to change classification/authorization. Cases reuse one employer/role context; they are not ten independent stories or a held-out dataset. Expected labels await independent human review.

There are two separate modes:

- **Scripted infrastructure:** a declared evaluator response supplies classification. This checks MIME handling, queue/routing/association, permissions and restart deduplication. Its pass count measures plumbing, not model accuracy.
- **Real Codex classifier:** the existing classifier reads normalized virtual mail, returns its own category, association and source quotes, and is checked against the same predeclared expected labels. The model gets no expected category or route. Record raw model association separately from the host's unique-thread override. These are development checks with model execution, not a calibrated quality study.

Both modes run twelve deterministic transport/calendar checks: bootstrap pagination, incremental history, failure-preserved cursor, expired history recovery, wrong-account isolation, no unapproved write, idempotent create/read-back, timezone/reminders, identity-preserving reschedule across DST, concurrent-edit rejection, busy conflict and no attendee invitations. Calendar actions themselves are supplied by a synthetic host script; their correctness does not establish model time extraction.

Cancellation, logistics and unresolved association remain pending review routes. This suite does not imply that the product automatically deletes a cancelled event or resolves an ambiguous interview. Missing-timezone invitation classification does not authorize a scheduler to invent a zone. Existing scheduler and approval tests cover those downstream gates separately.

## Commands

Use Python 3.12 with the existing module dependencies and set `INTERVIEW_PYTHON` as in [Interview setup](interview.md). The output must be new and outside repository/Git/AGENTS ancestors, preserving source isolation:

```text
npm run interview:virtual-tests -- --output <new-private-absolute-directory>
npm run interview:virtual-tests -- --output <another-new-directory> --live-classifier
```

Repeat `--case VM01` to select a subset. Scripted mode makes no model calls. Live mode consumes the configured Codex quota and requires its existing CLI login and network access; it makes no OpenRouter judge calls. No automatic classifier retry is performed by this runner: an inbox retry state is reported as a failed first attempt and remains preserved.

Each run keeps the dataset and implementation snapshots/hashes, selected IDs and model settings in a manifest, plus raw `.eml` fixtures, account-isolated inbox databases, virtual transport calls, actual Codex invocation records when used, immutable per-case results and aggregate `summary.json`/`report.md`. Failures stay in the denominator. The virtual transport does not validate Google's OAuth screens, granted scopes, actual service availability or production API quotas; retain a small separate real-account smoke test for those boundaries.

The existing `interview:benchmark -- --run <new-directory> --case W12` independently exercises the historical local agent lifecycle: scheduling, exact scripted plan acceptance, materials, attributed debrief and next-session planning. It uses a simulated clock/calendar and the historical baseline protocol, not the current website approval or direct-question format. Website approval has its own [verification](interview-web-actions-verification.md); keep these denominators and method versions separate.
