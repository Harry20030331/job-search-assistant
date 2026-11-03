# Application UI contract — version 60

Website-led application workflow, requested by the user on 2026-10-30. The current user-directed successor redesigns the candidate-free entry and shared workspace while preserving exact application and interview approval gates. Routine recruiting work changes data through the interfaces below, never the renderer, layout, CSS, interaction script, or display rules.

Integration, 2026-10-30: The user requested integration of all team modules. V29 preserves the v28 application layouts and actions, the open direction labels, and Interview question rendering, while sharing navigation with Home, Interviews and account settings. Review keeps its own Submit action and Status its Apply action. Historical Matching v2 and Interview v2–v4 manifests are retained under descriptive filenames to avoid collisions with Application versions. This integration does not claim live employer or Google-account verification.

## Fixed presentation

- Preserve `/status/us`, `/status` and `/review`. Version 51 extends the user's accepted Status visual language to Profile, Review, Interview preparation, Account and first-use setup: gray navigation, neutral black Inter Sans-serif typography, readable medium/semibold weights, white work surfaces and restrained orange actions/selection. Working pages share a 208px desktop rail, consistent content padding, heading hierarchy and card treatment; narrow navigation scrolls locally and Review retains its native picker below 700px. The refresh panel has pale orange fill, minimal status/guidance copy and a 15px/650 button. Status retains its existing pipeline composition and orange In review count. Initial use opens source-first Profile; remembered real users open Status. Explicit flexible direction/location preferences, per-job Resume tags, immutable application bindings and separate pinned Submit remain in force. Historical manifests are preserved.
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
- Status provides checkboxes and Apply for shortlisted jobs and failed preparations without a ready draft. Tracked rows may offer a contextual Review or Interview prep link using stable application/round IDs; content editing and approval remain on the task page. A completed fictional demo submission may show Simulate interview and then Interview prep, as described below. Primary navigation contains only Profile and Status. Review and interview preparation are contextual tasks entered through Status counts, stage actions or stable application/round links; task pages keep Status selected and return to the corresponding Status filter. Settings is reached from Profile and keeps Profile selected. The Apply bar is hidden when there are no shortlisted jobs or another lifecycle filter is selected. Only Review has the final pinned Submit applications (N) control. Failed preparation can be retried with Apply from Shortlisted. The final control submits the approved batch only when explicitly clicked. Already running or completed requests are excluded from its count. These actions create durable requests for one executor (the configured existing chat or background runner); Task history stays internal. Display current application stages and concise actionable errors, with no Activity panel or technical event log. The HTTP server has no direct ATS client. Data publication never grants execution authorization.
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

`npm run ui:check` verifies the versioned SHA-256 baseline in `ui-contract-v60.json` for the Application renderer and styles, workflow controls, Status projection, shared navigation, Interview renderer and practice formatter. It is included in `npm run verify`. Existing view and interaction tests remain the behavioral checks. Data content, counts and timestamps are intentionally not frozen.

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

## Interview action integration, version 30, 2026-10-31

The user requested merging the updated team code and retesting Interview. Preserve the v29 Application layouts, content-only approval, separate execution tasks, open job directions and configured resume bindings. Restore the Interview v5 exact-plan acceptance, asynchronous practice generation, explicit retry and independent website/chat debrief receipts. Shared headers retain their Application-specific class and render the Interview reminder region and script; shared styles include that region without changing task controls. Earlier Application v5/v29 and Interview v5 manifests are preserved separately. The active manifest at that integration was `ui-contract-v54.json`; this is a controlled integration successor, not a baseline reset to hide a failed check. Tests and actual browser verification are recorded in the team integration report. It does not establish live employer or Google actions, semantic quality or human review.

## Website entry and four-page workflow, version 31, 2026-10-31

The user explicitly requested Start opening Welcome, website interaction across Profile & preferences, Status / Shortlist, Review and Interview preparation, and New Grad-only matching from SimplifyJobs/New-Grad-Positions. Version 31 adds candidate-free Welcome/new/existing/example selection; a revision-bound v2 profile editor; canonical preference feedback; explicitly approved, immutable PDF-profile mappings; a live-preparation resume selector; and saved research/interview requests dispatched once to the connected existing Codex chat. Interview invitations, availability, plan revisions, debrief input and plain-text results/follow-up questions now have a website form. Calendar confirmation and exact-plan approval stay separate. Shared nav links Welcome back to the actual candidate-free launcher.

No application/interview lifecycle schema, submission evidence requirement, exact content approval, plan/version binding or one-time execution gate is relaxed. Historical source IDs stay readable, while the active website research request records the New Grad/Simplify-only source boundary. Uncertain delivery is visible and is not replayed. Existing linked v3 sources remain read-only in the basic editor, and source extraction is not claimed by the manual intake form or approved-PDF upload.

The historical v30 manifest is preserved. The active manifest is `ui-contract-v31.json`, covering the existing surfaces and the new launch/profile/interview-request renderers. This controlled successor follows the user's layout/interaction request. Actual in-app Browser verification covered Welcome, isolated example selection, new fictional intake, saved-workspace resume, profile/preference saves, all four shared-page links and the interview request form. Automated checks cover source boundaries, isolated storage, concurrency, exact resume selection, origin/body validation, single delivery/claim and plain-text replies. These checks do not establish a completed live matching round, Google operation, generated-content quality or real employer submission.

## Source-first New candidate, version 32, 2026-10-31

The user requested replacing the long upfront intake form with three friendly methods: a designated LinkedIn profile link, pasted/copied text, or PDF upload. Version 32 introduces an accessible three-tab source chooser, one focused input panel, PDF selection/drop feedback, reading status, a plain-text-safe profile preview, free-text corrections and a separate short preference/confirmation step. A background PDF is not an approved application resume. Existing Profile, Status, Review and Interview renderers retain v31 behavior.

Source-reading requests remain candidate-free under ignored `local/intakes/`, with an exact owning chat, source hash, single claim and revision checks. LinkedIn requires validated visible observations; inaccessible profiles cannot publish extracted facts, and initial displayed facts must match those observations. The agent reads actual PDF/text material before publishing a preview. Candidate creation happens only after the user confirms the displayed revision and supplies search preferences. Source failure or missing facts returns a webpage explanation with correction/alternative-source options. No discovery, employer application or submission is authorized by intake.

The original v31 manifest is preserved. The working successor is `ui-contract-v32.json`; user review is pending, and no commit or push is authorized. Browser checks cover all three source panels, keyboard-compatible controls, fictional pasted-text staging/preview/confirmation and PDF file selection/staging. The reading dispatch was simulated in isolated browser QA; these checks do not establish successful live LinkedIn access, general PDF extraction accuracy or a completed job-matching round. Automated tests cover provenance, preview/confirmation boundaries, stale corrections, duplicate handling and source/body/origin validation.

## Daily matching and update status, version 33, 2026-10-31

The user requested one daily New Grad matching update, background catch-up when opening after more than 24 hours, and an explicit manual refresh. Version 33 adds shared update controls to Status and Profile: last successful timestamp, new-to-shortlist count, next due check, pending/blocker state and Refresh jobs. The existing source-first intake and application/interview controls retain their behavior. The source link remains SimplifyJobs only. Automatic timers run only for selected confirmed real workspaces served through Welcome; fictional examples are paused. Local-service shutdown is handled by one overdue check after return, not replaying each missed day.

All triggers share a durable workspace reservation; freshness requires a completed current-context round with an actual evidence reference. Delivery, failure, missing completion metadata and stale inputs cannot fabricate a successful update. The Status renderer's existing safe-refresh and selection guards remain in place; Profile polling updates only the update panel. No application or calendar action is automated by this change.

The v32 manifest is preserved. The working successor is `ui-contract-v33.json`, including the new shared update-panel renderer. User review remains pending; no commit or push is authorized. Automated checks use simulated time and fictional storage/delivery to cover daily boundaries, timer operation without a page, restart/catch-up, duplicate suppression, failure backoff, uncertain delivery, stale input and saved counts. Browser verification used an isolated fictional overdue round and an explicit manual refresh, preserving the previous timestamp while queued. These checks do not prove a live repository scan or employer verification.

## Normal-start fictional rehearsal, version 34, 2026-10-31

The user requested configuring Interview under ordinary website startup and validating the existing fictional example across the full local workflow. Version 34 makes demo preparation/submission execute locally even with a connected chat and records demo mode in Interview requests, their history and host instructions. Existing page layouts, exact draft/plan approval, source freshness and application identity gates remain unchanged. The project Python environment is resolved separately from candidate storage.

The v33 manifest is preserved. The successor is `ui-contract-v34.json`; no commit or push is authorized. Actual browser checks, model attempts and automated results are recorded in [current integration](interview-current-integration.md). The fictional checkpoint is authored evidence, while fresh model output is separately recorded. No live employer or Google operation is established.

## Minimal productivity interface, version 35, 2026-10-31

The user explicitly requested existing-search selection opening Status / Shortlist and a full UI redesign based on their reference: white/black/light gray, Inter or Geist, clear navigation, compact tables, limited borders, consistent spacing and necessary copy only. V35 bundles official Inter locally, adds one shared visual-token module, replaces decorative welcome/intake copy, restyles Profile, Review, account and Interview views, and renders Status as a compact semantic table with All/lifecycle tabs. The new default applies only to existing-search resume; intake/example onboarding retains its original landing step.

Stable IDs, opportunity ordering, selection, Apply, answer saves, exact content approval, Submit, exact Plan approval and model/calendar boundaries remain intact. All restores the complete current list and preserves the existing selection guards. Browser verification uses fictional data and checks existing-search landing, filters, selection count, Review and Interview without employer actions. Responsive CSS was inspected, but the browser viewport override did not take effect, so actual phone-width rendering remains unverified. Tests retain domain assertions and update only intentionally superseded presentation expectations. The font asset is checked by digest in distribution validation, with its upstream license included.

V34 is preserved. The active successor is `ui-contract-v35.json`. Changes remain uncommitted pending user review; no commit, push or PR is authorized.

## Local reset and single status control, version 36, 2026-10-31

The user requested clearing currently saved local searches and removing the duplicate in-table status display. V36 removes the Status column and each visible row status badge, retaining the upper All/lifecycle filter tabs. Internal `data-status`, stable job/application IDs, filter counts, selection, ordering and Apply behavior remain intact. The user-authorized local reset moves active candidate data, workspaces, intake requests and the path index into a private ignored recovery backup after stopping writers; it preserves source examples and the project environment. No production or employer records are erased externally.

V35 remains preserved. The active manifest is `ui-contract-v36.json`; no commit/push is authorized. Browser verification covers the empty saved-search list and an isolated fictional table, without repopulating the saved-search index or running applications.

## Interview filter alignment, version 37, 2026-10-31

The user requested correcting the awkward three-plus-one wrapping of All, Upcoming, Completed and Cancelled in the Interview sidebar. V37 presents the same four links in a fixed two-column segmented control, with equal 40-pixel minimum height, centered labels, consistent gaps and a black selected state. URLs, filters, records and interview actions are unchanged. V36 is preserved; user review remains pending, with no commit or push authorized. Browser verification uses an empty read-only preview without creating saved candidate data.

## Welcome rollback, 2026-11-01

At the user's explicit request, the unaccepted V38 welcome redesign was reverted to the exact V37 renderer and styles. The active check remains V37. The rejected V38 manifest is retained as historical context only. The restored welcome keeps the original title, three entry cards and Home navigation; all other pages and records remain unchanged.

## Product-wide interface redesign, version 39, 2026-11-01

The user explicitly requested a major redesign using [Vercel Web Interface Guidelines](https://vercel.com/design/guidelines), [Anthropic frontend-design](https://github.com/anthropics/skills/tree/main/skills/frontend-design), and [21st.dev](https://21st.dev). V39 applies a coherent navigation rail, neutral workspace surfaces, responsive page hierarchy, an entry page with differentiated choices, readable company/location rows, segmented filters, a Review document surface, and consistent Profile/account/Interview panels. It adds a keyboard skip link and retains labeled icons, visible focus, reduced-motion support, tabular numerals, local font loading and mobile input sizing. No external component or runtime dependency is added; 21st.dev serves as component-design reference adapted to the existing server-rendered stack.

The change is presentation-only: selected inputs, stable IDs, source reading/confirmation, freshness, answer saves, exact content approval, Apply, final Submit, plan acceptance and calendar authorization retain their existing domain interfaces. Existing local work on Matching/Jev is preserved. No shared schema or API change requires module-owner integration. Prior manifests, including the rejected V38 Welcome, are retained. V39 is a reviewable successor, not user acceptance; no commit or push is authorized. Detailed browser and automated validation is recorded in [UI redesign](ui-redesign-v39.md).

## Single-user startup and Matching resume routing, version 40, 2026-11-01

The user requested more color from their Morandi reference, single-user Profile onboarding with direct Status return, and Jev-owned per-job resume selection shown on Status. Their subsequent correction limits decorative colors to pale pink, pale blue and muted purple. V40 removes five-color cycling, uses one purple resume-tag treatment, remembers only an explicitly confirmed/resumed real workspace, and displays matched or unresolved Resume labels. The former batch-level resume selector is removed. Each Apply target resolves its own approved key/hash; existing application bindings, answer saves, content approval, final Submit, plan approval and calendar confirmation remain separate and unchanged.

The coordinated interface is documented in [job directions and resume routing](job-directions.md); data retains stable IDs and strict source/version guards. New behavior is tested with fictional inputs and intercepted Jev responses, including mixed-resume batches, stale files/contexts, no-fit choices, restart recovery and preservation of started bindings. Browser checks and validation are recorded in [v40 review](ui-redesign-v40.md). V39 is preserved. User design review remains pending; no commit or push is authorized.


## User-directed visual and demo successor — 2026-11-01

Version 41 replaces the earlier pastel palette and B monogram at the user's direction. See [review notes](ui-redesign-v41.md). In a fictional Demo workspace only, a current completed Submit rehearsal exposes **Simulate interview** in Status. The action validates the exact approved snapshot, revision and completed task, then idempotently creates an invited synthetic round. Status derives Interviewing from that valid link. It never changes canonical submission evidence, sends mail, or creates calendar events. Reopened content invalidates the demo projection. Real workspaces and live mode reject this action.


## Status composition successor — 2026-11-01

At the user's explicit direction, v42 restructures Status beyond palette changes. Status uses a lighter, narrower navigation rail, a title/description and application overview, a compact update strip, and a single pipeline surface containing filters and the table. Company and role typography take precedence over direction, resume and date metadata. Sans-serif remains universal; orange remains a restrained active-filter accent. Other page layouts retain v41 presentation. Stable IDs, filter numbering, per-job resume tags, Apply, final Submit and the fictional interview shortcut retain their existing behavior and authorization gates. See [v42 review notes](ui-redesign-v42.md).


## Status copy reduction — 2026-11-01

User-directed v43 removes the decorative Status eyebrow and subtitle, shared navigation caption and footer slogan. Status navigation uses a distinct neutral gray background with a white active item. Sans-serif, data, counts and controls are preserved. Typecheck and 48 relevant view/demo tests passed; the actual desktop page was visually inspected. Historical v42 remains intact.


## Status legibility — 2026-11-01

User-directed v44 increases Status type weight: title 650, company and section headings 600, body/role/metadata 500, navigation and unselected filters 550. Small 10px Status metadata is increased to 11px and secondary text darkened. Inter remains the loaded Sans-serif family. Actual browser computed styles and loaded font were verified; no document overflow at the inspected desktop size. TypeScript and UI baseline checks passed. No workflow behavior changed.


## Neutral black Status typography — 2026-11-01

User-directed v45 replaces Status blue-tinted text with neutral black `#202020`, including headings, navigation, row content, metadata, tags, counts and interview links. Gray navigation, white work surfaces, orange icon and active underline remain. Font family and weights remain v44. Browser computed-color checks and visual inspection passed; TypeScript and UI baseline checks passed. No workflow behavior changed.


## Larger Status type and orange update region — 2026-11-01

User-directed v46 increases Status font sizes across navigation, row content, metadata, filters and overview. In review count uses deep orange `#b75918`; other text remains neutral black. The refresh region uses pale orange `#fff0df` with an inset and subtle border. Overview uses aligned grid rows so wrapped mobile labels do not offset numbers. Browser checks verified colors, larger actual sizes, matching document/viewport width at 390px and aligned number tops. View tests, TypeScript, boundary and UI checks passed. Behavior and data remain unchanged.


## Minimal refresh copy — 2026-11-01

User-directed v47 removes New Grad updates, the source link and routine automatic-cadence copy from the refresh region. It retains last-update status, new-job count when available, Refresh jobs and necessary failure/paused/profile-change guidance. Daily updates and source restrictions remain operationally unchanged. Typecheck and refresh/view tests passed; actual browser inspection confirmed the minimal orange panel.


## Refresh-panel legibility — 2026-11-01

User-directed v48 sets the update-status line to 16px/650 and necessary guidance to 15px/550, both neutral black, with a 6px gap. Actual browser computed styles and visual appearance were verified. TypeScript and UI checks passed; behavior is unchanged.


## Refresh button typography — 2026-11-01

User-directed v49 sets Refresh jobs to 15px/650 at desktop and mobile widths, matching the prominence of adjacent guidance. Browser computed styles and final appearance were verified. TypeScript and UI checks passed; refresh authorization and disabled-state behavior remain unchanged.


## Explicit flexible preferences — 2026-11-01

User-directed v50 adds explicit flexible direction/location options to initial confirmation and Profile. These toggle the corresponding specific-value fields and required-state together. Job-title lists are unnecessary; additional feedback is optional. Saving normalizes checked dimensions to empty canonical filters. Jev receives authoritative current scope and uses documented background/actual responsibilities for flexible direction fit; no live matching run occurs on save. Populated existing constraints, candidate facts and resume bindings remain unchanged until explicit confirmation/save. See [v50 validation](ui-redesign-v50.md) and [direction semantics](job-directions.md).


## Shared workspace presentation — 2026-11-01

User-directed v51 carries Status styling to the other product pages through `src/workbench/workspaceTheme.ts`, included by the existing shared design system. It unifies navigation, type, spacing, work surfaces, refresh notices and orange emphasis. Review keeps its queue, inputs, required-state and exact approval controls; Interview keeps its round/plan/practice/debrief structure; Profile keeps its save confirmation and flexible options; Account keeps explicit connection actions and permission explanations. No data, task, authorization or state-transition behavior changes. See [v51 validation](ui-redesign-v51.md).


## Profile section priority — 2026-11-02

User-directed v52 puts Search preferences first, Approved resumes second and Background & skills third in DOM and reading order. Existing form IDs, independent save behavior, confirmation and resume approval remain intact. Removed redundant ordinal legend-color selectors so reordering does not change heading color. Browser verified the exact order and black titles. Profile tests, TypeScript and UI checks passed.


## Preference save validation repair — 2026-11-02

V53 fixes reported generic preference-save failures. Website feedback and canonical matching feedback both accept multiline prose up to 20,000 characters; single-line identity/reference/filter fields retain their validation. Profile exposes the length bound and actionable missing-direction/location/work-mode and length messages. A failing HTTP regression first reproduced 400 for valid multiline prose; after repair, 581 tests passed. An isolated fictional browser copy saved its existing default multiline preferences and displayed Saved. The user's current page and input were not refreshed, rewritten or submitted. TypeScript, boundary and UI checks passed.


## Manual refresh availability repair — 2026-11-02

V54 fixes a disabled Refresh jobs button in a standalone preview: the selected workspace lacked its hosting chat connection and the UI displayed an unrelated automatic-update pause. Review/resume now preserves or creates the selected workspace connection from the hosting thread without queueing work, passes the actual source repository separately, and keeps Demo applications inline. Snapshot/UI distinguish manual availability from timer state. Actual browser inspection verified an enabled button with the misleading pause removed. 584 tests, TypeScript, boundaries and UI checks passed. No actual search was requested during validation. See [repair notes](refresh-repair-v54.md).

## Maintenance — 2026-11-02 (v55)

The user requested that Simulate interview start Interview Coordination automatically. The button now dispatches a single fictional Plan request to the connected owning chat and opens that exact round’s Plan tab. Completed requests refresh the interview page only while its request form has no unsaved edits. Disconnection and active-request conflicts remain actionable; uncertain delivery is saved and never silently replayed. Practice still requires approval of the exact current Plan. Layout, application authorization and historical manifests are preserved.

## Maintenance — 2026-11-02 (v56)

At the user’s request, a missing Plan with a delivered/running preparation request for that exact interview displays “Please wait, generating preparation plan...” instead of asking the user to ask Codex. Without an active request, the empty state points to the website request form. Pending-delivery uncertainty and blocked requests do not claim that generation is running. Existing Plan content and approval behavior are unchanged. Preserve v55 as history.


## Status-centered navigation — 2026-11-03

User-directed v57 reduces primary navigation to Profile and Status. Status retains its lifecycle filters and adds direct task entries in actionable counts, matching stage actions and job rows. Review and interview pages keep Status selected and provide Back to Status, restoring the corresponding filter. Profile provides Settings; the existing Google connection route is retained with a Settings title and Back to Profile. Existing saved URLs continue to work. Application-scoped interview entry cannot select another job's round or request target. The team's v55/v56 simulated-interview dispatch and scoped Plan waiting state remain intact. Product naming/logo changes are deferred until the user selects a proposed name. See [v57 review notes](ui-redesign-v57.md).


## Product name — 2026-11-03

User-directed v58 adopts CareerOS across shared navigation, setup/welcome branding and browser titles. The existing Compass icon, Sans-serif typography, layout and workflow behavior remain unchanged. Historical manifests retain their original branding.


## Original CareerOS mark — 2026-11-03

User-directed v59 replaces the stock Compass with an original SVG: an open C orbit and an ascending arrow. The warm orange mark uses rounded strokes and remains legible at the existing 28px sidebar size. The standalone vector is src/workbench/assets/careeros-mark.svg. Naming, layout and application behavior remain unchanged.


## Frame identity — 2026-11-03

User selected Frame from three reviewed original SVG concepts. V60 applies the exact approved dark geometric C to shared workspace navigation and the standalone SVG asset. The CareerOS wordmark, layout and application behavior remain unchanged.
