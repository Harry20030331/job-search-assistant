# Application UI contract — version 29

Website-led application workflow, requested by the user on 2026-10-30. This is the current versioned Status and Review interface. Routine recruiting work changes data through the interfaces below, never the renderer, layout, CSS, interaction script, or display rules.

Integration, 2026-10-30: The user requested integration of all team modules. V29 preserves the v28 application layouts and actions, the open direction labels, and Interview question rendering, while sharing navigation with Home, Interviews and account settings. Review keeps its own Submit action and Status its Apply action. Historical Matching v2 and Interview v2–v4 manifests are retained under descriptive filenames to avoid collisions with Application versions. This integration does not claim live employer or Google-account verification.

## Fixed presentation

- Preserve `/status/us`, `/status` and `/review`. Status shares Review’s compact header, warm palette, rounded cards and pinned action styling, with a horizontal, clickable five-stage timeline and stacked metadata in narrow windows. Keep equal-width stages above a line ending in an arrow; the selected stage has a dark pill. On narrow screens, scroll the timeline horizontally within its own region instead of wrapping the stages. Review uses a centered, fluid split layout with a sticky application sidebar on wide screens and a native application picker at 700px and below. Keep the warm palette, distinct question cards, red required marks and pinned submission control. Long answers expand to their content and reflow with window width. The picker and sidebar use the same stable application IDs and order; both are locked during saves.
- English-only interface and new review display text. Chat language is independent.
- No region selector, China entry, or replacement All applications selector.
- Status stages: Shortlisted → Preparing → In Review → Submitting → Submitted → Interviewing → Offer. Preparing and Submitting are task-derived display states; the shared opportunity schema is unchanged. In Review is shown only when a draft exists and preparation is no longer active. Jobs without ready drafts stay Shortlisted. Only active preparation shows Preparing; a blocked or interrupted preparation adds the small hint Apply again to prepare. Task errors stay in task history rather than becoming a lifecycle stage. Retrying preserves the application identity.
- Internal `submitted` and `confirmed` both display as Submitted; website/email evidence stays independent internally.
- Legacy labels remain LLM, REC, LOB. Other job directions render as escaped text in the same Status field. Tracked Status rows use the job direction; application/Review categories remain the explicitly bound resume profile. See [direction/resume interface](job-directions.md).
- Closed and `hiddenFromStatus` records stay in local storage and do not appear in the active view.
- Status filtered lists start at 01. Review uses the same application order as Status, restricted to its visible review items, without sidebar numbers. The sidebar, compact picker and next-pending navigation share that order. Legacy persisted queue positions remain stored for compatibility but do not control display. Updates always use jobId/applicationId.
- Review contains actionable drafts/questions and content-approved items marked Reviewed on a separate line beneath the location, in dark orange. Submitted/consumed records and legacy submission approvals do not reappear as pending review.
- Show the actual question directly; omit process commentary. Required choices, short inputs and long questions have a red asterisk beside their label, with an accessible required label. Optional questions use a small hint that they may be left blank.
- Simple choices are clickable and saved automatically. Short factual answers use single-line inputs and save on leaving the field or pressing Enter. Long questions and generated answers use editable text areas (up to 16,000 characters). Edits are revision-bound and save on leaving the field; Enter inserts a new line in long answers.
- Mark short factual questions with `inputType: "short-text"` (at most 300 characters, no newlines). A failed save restores the prior answer. Saved local answers may be approved before live-form synchronization; synchronization is required before execution can submit.
- One application-level Approve content control, independent of live ATS/CV readiness but disabled while required answers are missing, edits are unsaved, or a save has failed. Blank optional questions do not block approval. Successful saves recompute availability from saved content; clearing a required answer disables it again. Saving temporarily disables controls. A successful content approval stays visible and read-only with a compact Reviewed label. Preserve the shared Status order after approval; automatically select the next pending item, wrapping to earlier pending items if needed. If none remain, stay on the just-reviewed item.
- Content approval binds the exact local snapshot and desired revision with `decision.scope: "content-only"`. It does not authorize execution/submission; the user starts a selected batch separately. Live verification gates remain on execution. Approved applications automatically join the submission batch; there are no Review selection checkboxes. Edit answers generates a new snapshot, removes the item from the batch, and requires fresh approval. The final Submit applications count comes from saved approvals rather than browser selection state.
- Status provides checkboxes and Apply for shortlisted jobs and failed preparations without a ready draft. Tracked rows are read-only with no repeated Review answers links. The navigation has a compact Review (N) count of pending, visible review items; approved items do not contribute to this attention count. The Apply bar is hidden when there are no shortlisted jobs or another lifecycle filter is selected. Only Review has the final pinned Submit applications (N) control. Failed preparation can be retried with Apply from Shortlisted. The final control submits the approved batch only when explicitly clicked. Already running or completed requests are excluded from its count. These actions create durable requests for one executor (the configured existing chat or background runner); Task history stays internal. Display current application stages and concise actionable errors, with no Activity panel or technical event log. The HTTP server has no direct ATS client. Data publication never grants execution authorization.
- The default Demo mode contacts no employers; its footer label is omitted at the user’s request. A successful rehearsal is grouped under Submitted and labeled Submitted in Status at the user’s request. It leaves active Review without changing the stored opportunity to Submitted or deleting its saved draft. After the entire batch requested from a Review tab completes successfully, that tab opens `/status/us?stage=submitted`; retain the pending request across reloads. Blocked/interrupted batches remain in Review, and unsaved edits or active saves defer navigation. Completion applies only to the same snapshot and revision. Reopened content returns to Review. Verified real submissions leave Review and display the evidence-backed lifecycle. Failed submissions remain in Review. The optional Codex adapter fails visibly when disconnected or configured with fixtures. Requests bind the page’s configured mode so a stale Demo page cannot trigger live execution.

## Fixed data entry points

| Change | Interface | Ownership |
| --- | --- | --- |
| Discover or update a job | `npm run jobs -- ...` / `upsertJob`, `setJobStatus`, `closeJob` | Job library; no application status fabrication |
| Create an application | `createApplication` in `src/tracker.ts` | Validated stable application identity |
| Hide/restore an application in Status | `npm run data -- --input command.json`, operation `status.visibility` | Only `hiddenFromStatus`; retain all evidence/history |
| Initialize review order | `npm run data -- --input command.json`, operation `review.start` with `reviewPath`; also run at normal Review startup | Assign missing positions once; preserve existing positions and decisions |
| Publish or replace a review item | Same command, operation `review.publish` | One pending snapshot, preserving other applications |
| Choose an option / edit an answer / approve | Existing `/api/review/generated-answer`, `/api/review/reopen`, `/api/review/content-approval`, `/api/review/text`, `/api/review/answer`, `/api/review/open`, `/api/review/viewed`, `/api/review/decision` routes | Existing user-facing review controls and gates |
| Request preparation or selected submission | `/api/tasks`, `ApplicationTaskService` | Exact IDs and revisions, idempotent requests, one runner |
| Synchronize approved answers | `verifyDesiredStateApplied`, then existing exact-application submission workflow | Requires real ATS verification |
| Record success / email / recruiting progress | Existing tracker evidence functions and `npm run lifecycle -- ...` | Evidence-based lifecycle, independent email state |

The JSON command envelope is versioned and strict. Unknown fields (including arbitrary HTML, CSS, script, layout or controls) are rejected. Paths are local project data, not employer URLs. This command does not browse or submit applications.

Visibility example:

```json
{"version":1,"operation":"status.visibility","trackerPath":"data/opportunities.json","applicationId":"exact-id","visible":false}
```

Review publication example (the item must be a complete validated `ReviewItem`, not the abbreviated description below):

```text
version: 1
operation: review.publish
reviewPath: data/drafts
item: complete ReviewItem with a NEW snapshotId and decision.state = pending
expected: { snapshotId: previously read ID, revision: previous desiredState.revision or null, decision: previously read decision state }
```

Use `expected: null` only to add a previously absent application. Replacement requires the current snapshot/revision/decision, rejects conflicts, and never inherits opened/viewed/approved state. Consumed history cannot be replaced. A changed desired revision requires real-form synchronization under the existing workflow. Publication rejects Chinese display text rather than silently translating approved content.

Tracker and review mutations use atomic file replacement, restrictive file permissions and a shared cross-process file lock. Conflicting review publication fails instead of overwriting a newer decision. `createReviewBatch` is for initial/new storage only, never a shortcut for replacing existing drafts. Canonical paths are `data/opportunities.json` for both job and tracker operations, and `data/drafts` for review operations; adapters hydrate the unchanged view models. Do not edit whole JSON/CSV files with ad hoc scripts during ordinary work.

## Verification and controlled UI changes

`npm run ui:check` verifies the versioned SHA-256 baseline in `ui-contract-v29.json` for the Application renderer and styles, workflow controls, Status projection, shared navigation, Interview renderer and practice formatter. It is included in `npm run verify`. Existing view and interaction tests remain the behavioral checks. Data content, counts and timestamps are intentionally not frozen.

A baseline failure is a signal to inspect the change, not a reason to regenerate hashes. Only explicit user direction to change layout/interaction can authorize a new UI version. For such a change: describe the requested difference, implement it narrowly, run tests, verify the real page, preserve the prior manifest, and record a reviewed successor baseline. Routine data requests never authorize changing this baseline.

This is a repository guard, not an operating-system security boundary. It prevents accidental drift when checks are run; it does not claim files are technically uneditable. Keep credentials, candidate facts and private records out of the baseline.

## Maintenance — 2026-10-15

Version 2 implements the requested direct question wording, short factual inputs, read-only long drafts, and quiet optional hints. The version 1 manifest remains as historical evidence. Existing submission and live verification gates are preserved.

Version 3, 2026-10-15: At the user’s explicit direction, separate local content acceptance from execution authorization. Keep v1 and v2 manifests as history. Approval does not depend on ATS readiness; required content, revision conflicts and save failures remain enforced.

Version 4, 2026-10-15: Preserve queue position and numbering when an item is approved. Replace the long sidebar status with Review beside the company name and advance to the next pending item. Approval still means content accepted, awaiting a separate execution instruction.

Version 5, 2026-10-15: Move the Reviewed label below the location and use dark orange to preserve company-name space. Standardized data ports remain the only routine update path; explicit UI design work is the exception.

Version 6, 2026-10-15: Initialize attention-first queue order once through `review.start`, persist positions, and preserve them during review. Ordinary publication cannot change an existing queue position. A review reset preserves ordering; creating a genuinely new batch initializes its own order.

## Maintenance — 2026-10-30

Version 7 makes the website the primary interaction surface for Yuming's Application module: preparation requests, direct long-answer editing, separate selected execution requests and durable Activity feedback. Versions 1–6 remain unchanged. The user explicitly asked to skip browser inspection after the browser tool reported that local browser access was disabled. This successor records automated server, interaction and safety checks; visual browser acceptance and live Codex/ATS operation remain unverified.

Version 8, 2026-10-30: At the user’s request, remove step headings and explanatory toolbar text. Keep a compact Demo/no-submissions label and action buttons. Hide empty Activity and empty message spacing; show detailed task messages only for blockers and interruptions. Browser inspection remains skipped at the user’s request.

Version 9, 2026-10-30: Move actions to the bottom, rename preparation to Apply, and remove Review selection checkboxes. Each content approval automatically contributes to the final submission count; execution still requires the explicit final Submit applications click.

Version 10, 2026-10-30: Pin the global Apply/Submit action bar to the viewport bottom. Reserve its measured height so scrolling content and the per-application Approve control remain accessible. Activity stays in normal document flow and does not move the pinned buttons.

Version 11, 2026-10-30: Remove the empty normal-flow footer panel and extra spacer above the pinned action bar. Match content clearance to the measured bar height, account for it in Review minimum height, and reduce bottom content padding. Preserve one compact footer with a single separator.

Version 12, 2026-10-30: Separate shortlist/progress from pending operations. Status has only shortlist selection and Apply; review editing, preparation retry and final submission remain on Review. Replace repeated row links with a compact pending Review count in navigation.

Version 13, 2026-10-30: Disable content approval until all required answers are filled and saved. Unsaved edits and save failures also block approval. Backend validation remains authoritative; content approval still does not authorize submission.

Version 14, 2026-10-30: Place each application’s Approve content button directly beneath Open application in the card header. Keep the required-answer gate and save feedback with that control; remove the duplicate bottom decision area. The global Submit bar remains pinned.

Version 15, 2026-10-30: Make required questions stand out with a red asterisk, consistently across choice groups, short answers and long answers. Preserve accessible required labels and existing validation behavior.

Version 16, 2026-10-30: Remove the Demo footer label at the user’s request. Execution mode and no-send behavior remain unchanged. Keep action buttons aligned right without an empty label or extra mobile gap.

Version 17, 2026-10-30: Fix demo draft identity by preserving its application URL. Derive visible preparation/submission phases from tasks and draft readiness. Hide completed exact snapshots from active Review, preserve failed work for correction, and refresh changed stages without losing unsaved edits or shortlist selections. Rehearsals never fabricate employer submission status.

Version 18, 2026-10-30: Remove the Activity panel and its duplicate retry controls. Retain durable task records, chat dispatch, stage refreshes and concise connection/action errors.

Version 19, 2026-10-30: At the user’s request, preserve the Status design and redesign Review for different screen/window sizes. Add readable question cards, a roomier sidebar with role titles, a compact native picker in narrow windows, expanding long answers and a compact pinned submission button. Preserve saved approvals, task triggers and lifecycle transitions. Verified in the in-app Browser at 320, 390, 768, 1280 and 1440px widths, with no document overflow and no clipped long-answer content. Application switching is read-only; automated workflow checks remain in place. Live employer submission remains unverified.

Version 20, 2026-10-30: Match Review to the Status application order and remove sidebar ordinals. Apply the shared order to the narrow-window picker and next-pending navigation. Preserve legacy queue metadata, saved answers and approvals.

Version 21, 2026-10-30: At the user’s request, restyle Jobs & status to match Review and replace Jobs & progress in navigation. Use the shared compact header, rounded job cards, clear status badges and responsive stage filters. Preserve shortlist selection, Apply, shared ordering and all execution boundaries. Browser checks cover narrow and desktop layouts, filtering and selection counts without triggering a task.

Version 22, 2026-10-30: Restore the earlier horizontal stage timeline at the user’s request. Preserve direct click-to-filter interaction, equal-width stages and the arrow line. Keep the current header and job cards. Narrow windows scroll the timeline locally without widening the page.

Version 23, 2026-10-30: Remove the explanatory sentence beneath an available Approve content button. Hide empty helper space; retain required-answer, unsaved-change and save-error messages when approval is blocked.

Version 24, 2026-10-30: Shorten Jobs & status to Status in the page heading, browser title and navigation on both pages.

Version 25, 2026-10-30: Separate preparation outcome from job stage. A missing draft no longer implies preparation failure. Jobs remain Shortlisted until a draft is ready, with a retry hint only after an actual blocked/interrupted preparation. Preserve task history and require a fresh Apply request; no automatic replay. Regression coverage verifies retry after a draft identity failure, reuse of the same application and removal of the hint once preparation resumes.

Version 26, 2026-10-30: Complete the requested demo journey by grouping exact-snapshot rehearsal results under Submitted with a compact Demo label. Navigate the initiating Review tab to Submitted after its whole batch succeeds, preserving pending navigation across reloads and protecting unsaved edits. Keep real submission evidence, task dispatch and the two saved example checkpoints unchanged.

Version 27, 2026-10-30: After Apply, the initiating Status tab remembers its preparation request across reloads and opens Review as soon as the first task in that batch reaches needs_review. Remaining prepared drafts join through the existing safe refresh mechanism. Unrelated tasks cannot trigger navigation; failed or removed batches stay on Status, and new shortlist selections defer the redirect. Agent dispatch, saved example content and submission behavior are unchanged.

Version 28, 2026-10-30: At the user’s request, shorten the completed demo status label from Submitted · Demo to Submitted. This is presentation only: internal demo_complete tasks, rehearsal state, no-send execution and real-evidence requirements remain unchanged.
