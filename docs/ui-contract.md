# Application UI contract — version 5

The original baseline was established 2026-10-15. On 2026-10-26 the user requested shared navigation and complete practice cases (v2), then a concise question/answer presentation (v3). V4 implemented the subsequent explicit request for direct interview questions, optional question banks and complete coding answers. Clarification and strong-answer guidance are inside Method; runnable code is inside Sample answer. Code signatures, examples, prose and tables receive escaped semantic formatting. Preserve all prior manifests as historical evidence. On 2026-10-30 the user requested exact website plan approval before full practice and post-interview reminders (v5). Routine recruiting work still changes data through the interfaces below, never the renderer or interactions.

## Fixed presentation

- Preserve `/status/us`, `/status` and `/review`, their content and approval behavior. Shared navigation now links Home (`/`), Status, Review, Interviews and Google account (`/settings/accounts`). Root now renders Home instead of Review.
- English-only interface and new review display text. Chat language is independent.
- No region selector, China entry, or replacement All applications selector.
- Status stages: Shortlisted → In Review → Submitted → Interviewing → Offer.
- Internal `submitted` and `confirmed` both display as Submitted; website/email evidence stays independent internally.
- Category labels: LLM, REC, LOB. Stored category values and approved CV routing do not change.
- Closed and `hiddenFromStatus` records stay in local storage and do not appear in the active view.
- Each filtered list starts at 01. Display numbers are temporary, never record identity; all updates use jobId/applicationId.
- Review contains current actionable drafts/questions only. Submitted/approved history does not reappear as pending review.
- Simple choices are clickable and saved automatically. Free-text corrections come through chat; the page displays answers without text-entry controls.
- One application-level Approve control. Its visibility, required-answer gating, save errors and live-form verification remain unchanged.
- No direct ATS submission from the review website. Data publication cannot approve an application, consume approval, or submit externally.

## Fixed data entry points

| Change | Interface | Ownership |
| --- | --- | --- |
| Discover or update a job | `npm run jobs -- ...` / `upsertJob`, `setJobStatus`, `closeJob` | Job library; no application status fabrication |
| Create an application | `createApplication` in `src/tracker.ts` | Validated stable application identity |
| Hide/restore an application in Status | `npm run data -- --input command.json`, operation `status.visibility` | Only `hiddenFromStatus`; retain all evidence/history |
| Publish or replace a review item | Same command, operation `review.publish` | One pending snapshot, preserving other applications |
| Choose an option / approve | Existing `/api/review/answer`, `/api/review/open`, `/api/review/viewed`, `/api/review/decision` routes | Existing user-facing review controls and gates |
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

`npm run ui:check` verifies the active SHA-256 baseline in `ui-contract-v5.json`, including shared navigation, application renderer, Status projection, Interview renderer and practice text formatter. It is included in `npm run verify`. View and interaction tests remain behavioral checks. Data content, counts and timestamps are intentionally not frozen. The manifest records implementation verification, not completed team review or a merge.

A baseline failure is a signal to inspect the change, not a reason to regenerate hashes. Only explicit user direction to change layout/interaction can authorize a new UI version. For such a change: describe the requested difference, implement it narrowly, run tests, verify the real page, preserve the prior manifest, and record a reviewed successor baseline. Routine data requests never authorize changing this baseline.

This is a repository guard, not an operating-system security boundary. It prevents accidental drift when checks are run; it does not claim files are technically uneditable. Keep credentials, candidate facts and private records out of the baseline.

## Interview and account views, 2026-10-26

The same server serves `/interviews`, described in [the workbench contract](interview-workbench.md), with Overview, Plan, Practice and Debrief. Practice asks questions directly with necessary inputs and follow-ups; Method and Sample answer are revealed on demand. More questions offers plan-bound alternatives. Rubric/reference notes and self-checks remain internal. New round state uses a revisioned registry linked to stable application IDs and existing lifecycle functions. The account page starts Google OAuth and offers local session sign-out; tokens are never rendered. Connecting does not approve a calendar write, start unattended inbox processing or merge candidate history. Interview plans may be accepted on the Plan tab or in chat; detailed revisions stay in chat. Calendar actions retain their separate confirmation. Earlier observations remain in [v1](interview-workbench-verification.md) and [v2 verification](interview-workbench-v2-verification.md); the earlier compact presentation is [v3](interview-practice-compact-verification.md) and current verification is [v4](interview-practice-direct-verification.md).

## Plan approval and reminders, 2026-10-30

The Plan tab now accepts the exact displayed proposal ID/version/hash and registry revision, then queues one Codex direct-practice job. A changed plan needs fresh approval. Busy, failed and ready states are visible; retries are explicit. The common header displays end-time debrief reminders on every workbench page and supports a durable Dismiss action. Detailed changes and original debrief reports stay in Codex chat. The Completed filter includes scheduled rounds whose end instant elapsed without fabricating attendance or changing the shared application. See [website actions](interview-web-actions.md). These scoped interview controls do not authorize calendar or application actions. V5 additionally freezes `src/interview/browserActions.ts`; earlier manifests remain unchanged.
