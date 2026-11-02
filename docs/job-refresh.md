# Daily New Grad updates

Requested 2026-10-31. Source scope remains [SimplifyJobs/New-Grad-Positions](https://github.com/SimplifyJobs/New-Grad-Positions), followed by exact official-employer verification. These updates discover and match jobs only; Apply, application content approval, final submission and interview/calendar approvals remain explicit actions.

## When an update runs

- Selecting a confirmed candidate through Welcome starts its update service. Legacy direct services retain manual controls for canonical workspaces and need explicit automatic-service options to run timers. An initial candidate with no matching round is due immediately. Welcome and unconfirmed intake select no candidate and run no update.
- While the local website service runs, a timer checks once per minute. A completed current-profile round becomes due again after 24 hours.
- Opening a selected workspace checks the same deadline in the background. Fresh results display immediately; an overdue or first round is queued without delaying the page. Missed days cause one catch-up round, not one replay per missed day.
- Status and Profile show last successful update, new-to-shortlist count, next automatic check and an explicit Refresh jobs button. Manual refresh can start before the automatic deadline.
- A changed profile/preference context needs a new matching round. An older context cannot be marked fresh for the new profile. Fictional examples pause automatic research; an explicit manual public-search request remains separate.

This is a local-service timer, not an operating-system scheduler or cloud job. Closing the tab alone does not stop the timer. Shutting down the process/computer does. Reopening the selected workspace catches up. The owning Codex chat and its browser/tools must be available to perform research. No global Codex automation, recurring email, login credential or account setting is installed.

## One request across all triggers

Open-page checks, timers, multiple tabs, manual clicks and other service instances reserve one durable request under the same workspace lock. Active or uncertain requests own that slot. They are not silently replayed after restart. A disconnected source/chat does not erase the old shortlist. A resolved failed round has a 24-hour automatic backoff; the user can retry manually after resolving it. An unconfirmed delivery or active interrupted chat needs diagnosis rather than an automatic second request.

The service rereads current inputs and requests source-checkpoint/delta work in the existing chat. If a complete delta is unavailable, use the existing deduplicated scan workflow and state the limitation. Do not mark a full source scan complete for a bounded or unfinished round. Existing opportunity/application IDs, approvals and submission evidence remain owned by their domain stores.

## Completion and freshness

`data/search-requests/` holds execution state, not another job list. It stores the trigger, exact context token, prior visible job IDs, claim/completion times and a short round receipt. The agent must claim once and finish only after the actual work:

```text
npm run search:request -- claim --workspace <directory> --request <id>
npm run search:request -- finish --workspace <directory> --request <id> --outcome completed --summary-file <private-JSON-file>
npm run search:request -- finish --workspace <directory> --request <id> --outcome blocked --message <brief-English-blocker>
```

The completion receipt is strict JSON: `completedRound: true`, a short actual source/round `reference`, actual `inspected` count and ISO `observedAt`. It is an agent-recorded evidence reference, not independent validation of research quality. A real completed round with zero new matches is valid. A queued message, failed source read, missing receipt or changed input context does not advance successful freshness. New-to-shortlist counts derive from saved visible stable IDs, not a number invented by the model. Historical requests without a receipt remain readable but do not establish verified current-profile freshness.

Tests use isolated fictional records, simulated clocks and a stub delivery adapter. They exercise the 24-hour boundary, restart/catch-up, a background timer without a page, cross-trigger deduplication, failure/backoff, uncertainty, stale input, truthful timestamps/counts, manual controls and origin checks. They do not establish a completed live SimplifyJobs scan or employer verification.


Maintenance — 2026-11-02: Standalone review/resume binds a missing chat connection to its hosting Codex thread and uses the canonical tracker's workspace for saved matching inputs, with the source repository retained for skill/command execution. Existing explicit chat bindings are preserved. Manual availability is reported independently as `manualEnabled` / `manualBlockedReason`; `automaticPausedReason` describes only the timer. The legacy `pausedReason` now mirrors manual blockers so older open pages show the real manual blocker. Automatic disabled does not disable a connected manual request. Standalone preview timers stay off, and Demo application execution remains inline. No binding, startup, status read or button enablement is a completed research round.
