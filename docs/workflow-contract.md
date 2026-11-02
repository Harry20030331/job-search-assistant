# Active Workflow Contract

Normative operational policy for this repository, updated on 2026-10-30. Repository entry instructions point here; ATS skills add platform techniques. `CONTEXT.md` defines terms. Historical plans, pressure-test records and superseded ADR clauses are evidence, not competing current instructions.

## Scope and inputs

As of 2026-10-31, a first greeting or Start in a new job-seeker chat starts `npm start` and visibly opens its candidate-free Welcome website. Selection, confirmed manual intake, profile/preferences, shortlist, application review and interview preparation are website interactions around one selected workspace. See [welcome](welcome.md). This supersedes the chat-first setup default; opening a folder alone still does not run a turn or authorize candidate selection, writes or research. Explicit development requests retain their normal workflow.

The website lists saved searches with counts and diagnostics before selection. Only explicit selection opens that workspace; new intake creates fresh isolated canonical records, and the fictional example never becomes the user's identity. Source documents and LinkedIn still require actual reading/visible observations and fact confirmation; unsupported or inaccessible fields remain unknown. The basic editor does not rewrite linked shared v3 sources. Website research requests use the connected existing Codex chat, and delivery is distinct from research completion. Profile/preference changes require fresh assessment; application authorization and live verification remain separate.

As requested on 2026-10-31, selecting a confirmed real workspace authorizes daily New Grad discovery/matching and a single overdue catch-up after 24 hours, with manual refresh available. Only the configured SimplifyJobs repository supplies leads. This authorizes no application preparation, submission, account action or calendar write. Timers, open-page checks and manual clicks share one durable request, and only a completed current-context round advances freshness. See [daily updates](job-refresh.md).

Discovery may begin from confirmed search inputs without an approved resume PDF. The Matching intake creates a new isolated workspace and records explicit categories in its preferences. An empty resume manifest permits search only; application preparation still requires complete applicable inputs, a mapped approved PDF and preflight. Interactive Matching takes saved website profile input and feedback, with source-reading compatibility through Codex chat; see [chat intake](matching-chat.md). This discovery/application distinction was clarified on 2026-10-25.

Use Codex's in-app Browser for page actions. Load fresh candidate facts and preferences and the explicit category's approved CV through [candidate-inputs](candidate-inputs.md). Canonical facts override ATS parser output. Resolve family and close-friend employment questions from the personal-connections list and explicit unlisted-company policy in [candidate-inputs](candidate-inputs.md), rather than repeatedly asking about each employer. Preflight validates the official HTTPS URL, category mapping and PDF hash; visibly verify the uploaded filename in the actual form.

Job directions are open user-configured values in the selected preferences; the historical `category` job field now denotes that direction. Application resume profiles are explicit keys selected by Jev during Matching from the approved-PDF manifest, displayed per job in Status and pinned by key/hash on Apply, stored separately as `application.resumeCategory` and projected as the existing Submission `category` parameter. Legacy `llm`, `recommendation`, and `robotics` applications remain readable without rewriting. Geographic scope comes from preferences. See [direction/resume interface](job-directions.md), clarified 2026-10-29. Candidate-specific screening and writing preferences live in `data/preferences.md`; scoped confirmed personal answers live in `data/candidate.json`. Neither belongs in generic ATS skills.

## Optimistic batch execution

1. Validate shared inputs once; invalid shared facts or CV configuration stop the batch. Park item-local invalid URLs, unknown categories or unavailable roles and continue valid siblings.
2. Resolve reusable facts and derived employment-history answers under the Review routing table in [candidate-inputs](candidate-inputs.md). Collect a repeated profile gap once and reuse the resulting fact across the batch. Fill verified canonical facts, exact-meaning approved answers and authorized consents. Match the complete question: relationship, timeframe, jurisdiction, qualifiers and choices. Similar keywords do not establish equivalence.
3. Re-observe after parsing, rerendering, validation, navigation, upload or conditional fields. A visually selected control is not proof that an ATS accepted or saved its value.
4. Execute one live form at a time by default. Parallel agents require explicit authorization and exclusive application/tab ownership; never edit the same form or record concurrently.
5. Consolidate unknown facts and generated answers in Review. Interrupt only for a user-only identity/security action when no independent work can proceed. Never fabricate a fact, exercise URL or open-source contribution.
6. Keep working questions, answers and meaningful friction in `data/drafts/`; persist the final outcome on the same opportunity. Omit routine clicks, raw DOM, raw email bodies, passwords and OTPs.

## Review and approval

The fixed [UI contract](ui-contract.md) owns presentation and data interfaces. The website is the primary interaction surface: select jobs, request preparation, edit answers, approve content, and request selected submissions. The background agent applies answers to employer forms through the in-app Browser. The HTTP server queues work; it has no direct ATS client.

- Confirmed deterministic facts are execution evidence, not extra approval questions.
- Simple enumerated questions use clickable, auto-saved choices. A failed save restores the prior selection and blocks approval. A saved choice alone is not application approval.
- Long-answer questions and generated drafts are editable text areas on the page. Short facts and choices save automatically. All edits increment the desired revision, and stale-page writes are rejected. Deterministic canonical facts remain source-owned. Keep one application-level Approve action, without repeated per-answer decisions.
- Local content can be reviewed before live filling or CV verification. Approve stays disabled until required answers are present and saved, with a short explanation beside the control. Unsaved edits and failed saves keep it disabled; optional blanks do not. Save errors and content/version conflicts prevent acceptance. Pure execution blockers stay in Status.
- Content-approved items remain read-only in their initialized Review position with the short dark-orange label Reviewed beneath the location; their meaning is reviewed, awaiting execution. Clicking Approve advances to the next pending item without reordering or renumbering the queue. Legacy submission approvals, consumed and submitted history leave Review. Keep minimal outcome evidence on the opportunity. Closed and explicitly hidden records stay out of active Status; internal submitted/confirmed both display as Submitted.

Clicking Approve records acceptance of the exact local content snapshot/revision with `decision.scope: "content-only"`. It does not start a background job or authorize submission. Explicit chat acceptance of content has the same scope unless the user also explicitly asks to execute/submit. The user may approve any subset. Each approval automatically adds its current revision to the submission batch. The user then clicks **Submit applications (N)** at the bottom of Review. This creates separate durable execution tasks bound to exact application IDs, snapshots, revisions and content hashes. Preparation and content approval alone never issue execution authorization. `consumeApproval` still rejects content-only decisions; the task runner must use `consumeWebsiteTask` immediately before its one authorized submission attempt. Preserve live verification and no-send fixture rules.

Changes to accepted content require fresh acceptance of affected content. A lost browser connection does not by itself mean the user changed their accepted answers. Execution still requires observing and verifying the actual employer form. Routine selections and general preparation permission remain insufficient for submission.

Use `review.start` to preserve legacy queue metadata when presenting a new batch. The current UI displays Review in the same order as Status, filtered to actionable drafts, without sidebar numbers. Do not rewrite queue metadata to change the display; the UI contract owns visible ordering.

When presenting Review, link to the current page and explain its two separate actions: **Approve content**, then **Submit applications**. Users do not need to return to chat to trigger execution. **Edit answers** reopens a reviewed item with a new snapshot, removing it from the submission batch and requiring fresh content approval. Submitted history cannot be reopened.

Maintenance, 2026-10-15: User explicitly chose reviewed/awaiting-execution semantics for Approve, superseding the earlier rule that content acceptance alone authorized submission.

## Final submission control

Before submission, verify the exact company/role/URL, complete live form, mapped PDF, agreed content and choices, required consent, validation and authenticated session. Apply the requested final version first. A local edit or pending desired-state synchronization never proves the employer form changed.

For a website execution task, re-read and match its exact approved content, then call `consumeWebsiteTask(paths, taskId, verification)` immediately before submission. Supply the actual live snapshot hash, verified CV filename, verification time and explicit content/validation results. It reserves the attempt durably before consuming the matching content approval; a crash between writes fails closed. The returned authorization has source `website` and reference `website-task:<id>`. The task is complete only when matching submission evidence has been saved. Legacy website approvals retain their existing verification path. For explicit chat approval, record the actual chat source and exact snapshot in the working draft, then persist authorization provenance with the successful outcome; do not call website-view/decision APIs to impersonate the user. The tracker records the authorized attempt and outcome through its existing domain functions. Its legacy `approvalConsumed: true` marker means the exact authorization was used once; for chat approval the stored authorization must identify the chat source rather than claim a website click. It does not establish success on its own. No data publication or recovery action grants approval.

Submit once, then inspect the result. New unknown facts, materially changed terms/content or unclear authorization require review. Retain consumed authorization while the outcome is unresolved; after verified success retain its minimal provenance on the opportunity. Never blindly double-click, replay a consumed approval or resubmit an uncertain outcome. A definite validation rejection requires diagnosis and fresh live verification before any further attempt; do not treat it as success. When a correction would change the accepted answer, obtain approval for that correction.

## Submission evidence and closeout

An explicit official success page, submitted employer-dashboard state or matching receipt establishes success. Record a short source/reference and real verification time. Permanent screenshot storage is optional. Canonical `markSubmitted` requires `authorization` (source, reference, approvedAt) and `evidence` (source, reference, verifiedAt), bound to the exact application/snapshot. `markWebsiteConfirmed` / lifecycle `confirm-website` remains available for adding website proof to a previously recorded success. A click, spinner or filled draft is not success. Never resubmit merely to obtain a missing screenshot or email.

Keep website and email evidence independent. A matching receipt may supplement a verified website result; missing email does not downgrade success and does not require a separate confirmation stage. No mandatory delayed email scan is needed once explicit success is observed. When receipt checking is requested, read only matching routine receipts and mark them read only after actually reading them. Preserve protected recruiting updates' unread state; use sender/subject/snippet only when unambiguous.

After the successful outcome and its provenance are durably saved in `data/opportunities.json`, use the draft cleanup command. It removes completed working answers only, retaining unresolved attempts. Keep minimal status, known times and references; no new permanent screenshot/raw-mail/daily-ledger collection is required. The course distribution contains no personal historical evidence. Refresh Status after the batch.

## Recovery

Diagnose three separate layers:

| Failure | Recovery | What it proves |
| --- | --- | --- |
| Browser connection unavailable | Reconnect through the browser tool and observe existing tabs | Access only; no claim about saved form values |
| Local Review/Status service stopped | `npm run review:resume` against existing records | Restores the presentation and saved decisions |
| Employer tab/session/form lost | Reload canonical inputs, reopen the official role, restore answers, upload and verify the CV, inspect every field | A new observed live form; prior snapshot is not current |

A local-service restart alone does not invalidate an intact employer form. Persisted answers remain useful after a lost employer session, but approval consumption requires current live evidence. Create a replacement snapshot when continuity is lost; preserve earlier authorization as history, never silently transfer it to unverified content. Present changed/unknown content for review and follow exact-current-application authorization before submitting. Recovery never erases submitted evidence or retries a possibly completed submission.

A fresh runtime is different from recovery: `runtime:init` creates new empty storage and refuses any existing target. It does not copy personal facts, historical applications, China files, approvals or CVs. See [candidate-inputs](candidate-inputs.md) for independent input paths.

## Durable ownership

Use domain functions and the versioned data interface for job/tracker/review updates; preserve cross-process locking and expected-revision checks. Candidate facts stay in canonical sources, CVs remain approved attachments, and UI code stays behind the fixed interface boundary. Account creation and saved-password reuse follow current tool requirements; a skill cannot override them. Legacy regional helpers are not active course workflows.

## Website task runner — 2026-10-30

Only Application/Submission is changed. Matching and Interview ownership and opportunity schemas are preserved. `data/application-tasks.json` holds bounded requests and outcomes, not another application tracker. It contains no raw browser transcripts. Requests are idempotent by request ID, run one at a time, and reject simultaneous work on the same job. Restarts interrupt claimed or inline work rather than replaying it. Delivered, unclaimed tasks survive only for the same configured chat and execution mode. Failed preparation can be retried with Apply from Shortlisted. An attempted or interrupted live submission requires outcome reconciliation before another attempt.

Normal course startup uses **Demo mode**: preparation produces local fictional review questions; submission rehearses the workflow without contacting an employer, consuming live authorization, or marking the opportunity Submitted. The requested demo presentation shows completed rehearsals under Submitted; internal tasks retain demo_complete and no employer submission evidence is created. Optional `APPLICATION_RUNNER=codex` uses the installed Codex CLI and its configured in-app Browser; fixture candidate inputs are rejected. A missing CLI/login/browser connection becomes a saved task blocker, never a success. Do not import or synchronize the personal Career workspace. The live adapter must be verified with an authorized non-fixture runtime before operational use.

Maintenance, 2026-10-30: Align operational instructions with the current Status/Review UI and existing-chat dispatch. Live startup, background execution and chat claims check composed candidate inputs for fictional markers and reserved contact domains. These checks do not replace preflight or establish live ATS compatibility. Failed task-service startup releases its runner lock; requests from a different execution mode cannot be replayed.

## Matching provider — 2026-11-01

The user requested using TypeSafe Jev for job matching. Production Matching publication calls Jev on the selected canonical professional background/preferences and source-backed JD text, then uses the existing deterministic publication gate. Identity/contact fields, resume file paths and application-only facts are omitted from the provider projection; free-text preferences and professional source fields should be reviewed for unnecessary personal details. Codex retains source verification and evidence explanation, with no general-source expansion or application authorization. Unconfigured/failed provider calls cannot be silently replaced by Codex-only matching. Explicit offline fixture demos remain local and do not establish live Jev matching quality.


## Status recording shortcut — 2026-11-01

After a completed local Submit rehearsal, a fictional Demo workspace exposes **Simulate interview** on Status. The shortcut creates one idempotent invited round linked to the exact job/application and completed task, approved snapshot and revision. It stores `demoSubmission` provenance in the interview registry and derives Interviewing only while that proof remains current. No Gmail, Calendar, employer request or canonical submission evidence is created. Reopened content invalidates the projection. Real workspaces and live mode reject the shortcut. Reuse this round when preparing interview materials; do not relink it as a real invitation or invoke the separate authored demo checkpoint. Preparation-plan acceptance remains separate.
