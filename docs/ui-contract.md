# Application UI contract — version 2

Version 2, requested 2026-10-29 to support open job directions independently of application resume routing. The original `ui-contract-v1.json` is preserved. Only direction-label fallback/escaping and the tracked-row direction projection changed; the existing layout and interactions remain fixed. This is the current Status and Review interface. Routine recruiting work changes data through the interfaces below, never the renderer, layout, CSS, interaction script, or display rules.

## Fixed presentation

- Preserve `/status/us`, `/status` and `/review`, existing layout and navigation.
- English-only interface and new review display text. Chat language is independent.
- No region selector, China entry, or replacement All applications selector.
- Status stages: Shortlisted → In Review → Submitted → Interviewing → Offer.
- Internal `submitted` and `confirmed` both display as Submitted; website/email evidence stays independent internally.
- Legacy labels remain LLM, REC, LOB. Other job directions render as escaped text in the same Status field. Tracked Status rows use the job direction; application/Review categories remain the explicitly bound resume profile. See [direction/resume interface](job-directions.md).
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

`npm run ui:check` verifies the versioned SHA-256 baseline in `ui-contract-v2.json` for the renderer (including CSS/client interactions) and Status projection. It is included in `npm run verify`. Existing view and interaction tests remain the behavioral checks. Data content, counts and timestamps are intentionally not frozen.

A baseline failure is a signal to inspect the change, not a reason to regenerate hashes. Only explicit user direction to change layout/interaction can authorize a new UI version. For such a change: describe the requested difference, implement it narrowly, run tests, verify the real page, preserve the prior manifest, and record a reviewed successor baseline. Routine data requests never authorize changing this baseline.

This is a repository guard, not an operating-system security boundary. It prevents accidental drift when checks are run; it does not claim files are technically uneditable. Keep credentials, candidate facts and private records out of the baseline.
