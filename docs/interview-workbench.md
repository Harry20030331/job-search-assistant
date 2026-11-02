# Shared interview workbench

Maintenance date: 2026-10-30. Interview rounds now link to existing shared applications and appear at `/interviews` on the same local Review server. This is a host-orchestrated business integration with an interview page with exact plan approval and debrief reminders. No background mail daemon, Google write, shared schema migration or extra AI dependency is installed.

## Ownership and lifecycle

`opportunities.json` remains authoritative for job identity, application identity and lifecycle. The new host-only `<runtime>/interviews/registry.json` stores stable interview/job/application IDs, round state/time, association provenance, a revision and an optional absolute preparation-workspace pointer. It contains no duplicate company/role/profile facts or approval record. The page hydrates these facts from the selected shared opportunity and exports current preparation from that run's SQLite store.

An actual verified invitation can advance an existing confirmed application through `transitionApplication(..., "interviewing")`. A new optional expected-identity argument checks job/company/title/URL while holding the existing application transaction lock. A link never invents submission evidence or creates another application. Existing unconfirmed/unsuccessful applications remain subject to the shared lifecycle rules; resolve their real evidence through the owning module rather than manufacturing confirmation to enable Interview.

Cancelling a round updates only that round. It does not close the application or change another job. Existing interviewing/offer applications are not regressed. Multiple rounds can share the same application ID and have distinct interview IDs. The host supplies explicit association source/reference/time; metadata is a provenance assertion, not proof that mail was actually read. The skill remains responsible for verifying the account, thread and exact role/round.

## Publish order and commands

The host constructs the files and commands; users should not need to author JSON. Use absolute paths and stable IDs. First link the verified interview using a private payload:

```json
{
  "interviewId": "exact-round-id",
  "jobId": "existing-job-id",
  "applicationId": "existing-application-id",
  "state": "scheduled",
  "schedule": {
    "start": "2026-10-29T10:00:00-07:00",
    "end": "2026-10-29T11:00:00-07:00",
    "timezone": "America/Los_Angeles"
  },
  "association": {
    "source": "email",
    "reference": "Actual inspected message/thread reference and role-association basis",
    "verifiedAt": "2026-10-26T18:00:00Z"
  },
  "expectedRevision": null
}
```

Values above illustrate the schema; they are not evidence or authorization for a real operation. Allowed round states are `invited`, `scheduled`, `completed`, `cancelled`; `schedule` can be null except when scheduled. Provenance sources are `email`, `human_chat`, `synthetic_test_script`. Unknown time stays null. A scheduled interview time does not prove Google Calendar synchronization.

```text
npm run interview:track -- link --runtime-dir <selected-candidate-runtime> --input <actual-link.json>
```

Use `expectedRevision: null` only for a new interview. Updates require the current positive revision and cannot reassign a round to another application. Repeated stale updates fail rather than overwrite new state. A time change detaches the old preparation pointer; the previous run remains on disk. Link and shared lifecycle changes use separate locks, not a cross-file transaction: lifecycle advances first, and a failure before registry persistence can be safely retried with the same interview ID/current expected revision. Existing interviewing state is accepted without repeating the lifecycle transition.

**Advance lifecycle before staging preparation.** A canonical handoff's source guard hashes the opportunity file. Linking after staging changes that file and correctly makes the old run stale. For a batch, complete verified lifecycle updates before freezing the runs. An unrelated later opportunity update currently also invalidates this conservative whole-file guard; use a fresh handoff instead of deleting the guard.

Then run the existing `interview context|stage`, optional explicit learning binding, enrichment/context analysis, proposal, exact chat or website approval and material flow. Publish the selected fresh work directory:

```text
npm run interview:track -- publish --runtime-dir <selected-candidate-runtime> --interview-id <exact-round-id> --workspace <staged-run>/work --expected-revision <current-revision>
npm run interview:track -- inspect --runtime-dir <selected-candidate-runtime>
```

All commands accept optional `--profile <selected-profile-or-v3-descriptor>`. Without it, they select `<runtime>/candidate.json`. The registry binds that canonical source path and identity hash, so another candidate cannot inherit it merely because their name matches. Publish validates candidate anchor, job, application, interview, company and role, plus run freshness and the expected registry revision. Existing handoffs without a canonical anchor must be restaged.

## Page and authority

Start the existing server with explicit paths when needed:

```text
npm run review -- --review <runtime>/drafts --tracker <runtime>/opportunities.json --jobs <runtime>/opportunities.json --profile <selected-candidate.json> --port 8767
```

Open `/` for Home. All pages share Home, Status, Review, Interviews and Google account links. Interview detail separates Overview, Plan, Practice and Debrief. Plan is a time allocation. Practice asks direct questions with essential inputs and follow-ups; Show answer reveals Method, clarification/coverage guidance and Sample answer, including Python implementations for coding. More questions provides alternatives within the existing plan rather than extra mandatory work. Historical packs remain readable. These user-requested changes follow the controlled UI contract, preserving earlier manifests. Application approval interactions and Status projection retain their existing behavior.

`/settings/accounts` starts authorization on Google's page through `/google/connect`. The developer can explicitly pass `--google-root <private-config-directory>`; otherwise the server selects `<runtime>/.google-local`. A configured installation uses its existing desktop OAuth client in `client.json`. End users choose their account and consent without Cloud Console setup or an application password form. The loopback proxy uses PKCE, a fixed callback, one-use state, an expiring browser-bound session and same-origin/CSRF checks. The page exposes verified account metadata, never credentials. Sign-out clears the browser session without deleting or revoking saved grants. This is a local prototype connection, not production tenant authentication. Connecting does not bind a fictional candidate to a real account, select a calendar, start inbox polling or authorize writes.

For real OAuth, start the service in an execution environment allowed to reach Google. A browser can sign in successfully while a network-restricted backend cannot exchange the code. When launched through Codex's restricted shell, request the normal network-enabled tool execution approval for this explicit local service; do not disable TLS or change OAuth protections. The server remains loopback-only. On 2026-10-26 the restricted launch reproduced Windows network error 10013 against Google's public token endpoint; the approved network-enabled launch reached it and a subsequent human authorization produced Connected with Gmail account verification. See [connection troubleshooting](interview-google-connection-verification.md).

The interview page has narrowly scoped plan-approval and notification-dismissal endpoints, with strict Origin/CSRF checks; no calendar write or arbitrary-file download route is exposed. See [website actions](interview-web-actions.md). Plans display their actual version, budget and status. Full materials are read only from the exact current approved proposal; stale sources/history, a new proposal or an unavailable/changed run suppress material access. Historical outlines can remain visible with a refresh notice. Users may approve the exact current plan on the Plan tab to queue practice generation. Detailed revisions stay in Codex chat. Interview approval cannot authorize an application or calendar operation.

Debriefs display original reports separately from derived observations and suggested practice. Raw reports can appear before model extraction completes. Retrieval requires this interview ID and compatible historical role/company/round. Account-level reports are read only when an explicit candidate/account binding is present and still active; other interviews/accounts are not discovered or merged. A new account debrief may invalidate the old preparation snapshot while remaining visible as a scoped report. Revocation withholds account reports. Local business reports remain owned by their selected run.

## Fictional preview

```text
npm run interview:demo -- --output <new-absolute-directory> --port 8767
```

Run `npm run interview:setup` once; website bridges automatically select the project environment. An explicitly configured `INTERVIEW_PYTHON` remains supported. The parent must exist; initialization refuses an existing target and never resets the working candidate. It creates three fictional scenarios: a 50-minute DS plan, a 20-minute recruiter plan, and Harbor's completed SWE round with a reconstructed 60-minute plan plus debrief. All three get authored simulation-v2 packs with declared synthetic acceptance; Harbor's reconstruction does not assert historical human approval. Initialization uses actual business APIs with zero model or Google calls. Later explicitly run generation is separate and does not inherit that zero-call claim. The private manifest and synthetic approval files preserve provenance. These fixtures are a UI exercise, not an agent benchmark or human acceptance. Restart with explicit `review` paths; do not reinitialize over them. See [simulation generation](interview-practice.md).

## Windows and verification limits

Windows now selects a native atomic exclusive-create lock with a per-acquisition token and bounded waiting. POSIX keeps the existing `shlock` implementation. Concurrent processes are serialized; a changed owner is never silently removed. Abandoned Windows locks deliberately fail closed. Stop all writers and establish that the recorded process is gone before any manual lock recovery; this change adds no automatic stale-lock reaper. Windows ACLs and POSIX mode bits are not interchangeable, and the existing recovery checks are not bypassed.

Opportunity-path detection now recognizes both path separators, so native Windows absolute paths reach the canonical opportunity adapter. Tests cover lifecycle preservation, expected identity/revision, cancellation, rescheduling, candidate isolation, stale publication, HTML escaping, read-only routes, native cross-process locking and exact preparation/debrief export. Desktop and narrow-screen behavior were checked in the in-app Browser. See [local verification observations](interview-workbench-verification.md) for actual results and unresolved full-repository Windows failures.


## Status recording shortcut — 2026-11-01

After a completed local Submit rehearsal, a fictional Demo workspace exposes **Simulate interview** on Status. The shortcut creates one idempotent invited round linked to the exact job/application and completed task, approved snapshot and revision. It stores `demoSubmission` provenance in the interview registry and derives Interviewing only while that proof remains current. No Gmail, Calendar, employer request or canonical submission evidence is created. Reopened content invalidates the projection. Real workspaces and live mode reject the shortcut. Reuse this round when preparing interview materials; do not relink it as a real invitation or invoke the separate authored demo checkpoint. Preparation-plan acceptance remains separate.

Maintenance — 2026-11-02: At the user's request, **Simulate interview** also saves and dispatches one preparation request to the connected owning Codex chat, then opens that round's Plan tab. The fictional default is a 60-minute preparation budget with general early-career priorities; round/date/interviewer details remain unknown. The chat stages the canonical handoff, analyzes captured fixture context, generates and publishes a Plan, and returns its outcome through the existing request history. No live evidence research, mail or calendar call is authorized. Plan generation precedes approval; Practice still requires exact current-plan acceptance. Requests use the completed demo task UUID, so concurrent/repeated clicks share a single delivery and never replay uncertain delivery. Existing preparation workspaces are preserved. Missing chat configuration blocks the click before creating a round; another active request blocks a new simulation. Delivery uncertainty remains visible in request history. Completion refreshes the interview page when the request form has no unsaved edits. Older invitation-only rounds can use the same handoff once to start preparation.

Verification — 2026-11-02: The currently selected fictional Nooks round was continued through this same handoff. The owning chat claimed the saved request once, staged canonical inputs, ran one context analysis and one proposal call, and published a current 60-minute version-1 Plan awaiting acceptance. The actual in-app Browser displayed that Plan and its approval button; no Practice material or approval was created. Unknown JD, round, date, interviewer and personal motivation remained explicit. The service was restored on its existing local port with the same saved workspace. Targeted tests passed 51/51, covering delivery, duplicate clicks, disconnected/uncertain delivery and refresh with unsaved input. The full suite at that checkpoint passed 586/587; the pre-existing unmodified `chatTaskBridge.test.ts` concurrent-configuration test still failed with an empty JSON read. Type checking, UI v55, boundaries and distribution checks passed separately. These observations are a fictional integration check, not semantic-quality or live Google verification.
