# Active Workflow Contract

Normative operational policy for this repository, consolidated on 2026-10-15. Repository entry instructions point here; ATS skills add platform techniques. `CONTEXT.md` defines terms. Historical plans, pressure-test records and superseded ADR clauses are evidence, not competing current instructions.

## Scope and inputs

Discovery may begin from confirmed search inputs without an approved resume PDF. The Matching intake creates a new isolated workspace and records explicit categories in its preferences. An empty resume manifest permits search only; application preparation still requires complete applicable inputs, a mapped approved PDF and preflight. Interactive Matching takes candidate input and feedback through Codex chat; see [chat intake](matching-chat.md). This discovery/application distinction was clarified on 2026-10-25.

Use Codex's in-app Browser for page actions. Load fresh candidate facts and preferences and the explicit category's approved CV through [candidate-inputs](candidate-inputs.md). Canonical facts override ATS parser output. Preflight validates the official HTTPS URL, category mapping and PDF hash; visibly verify the uploaded filename in the actual form.

Supported category keys are `llm`, `recommendation`, and legacy `robotics`. Active categories and geographic scope come from the selected candidate preferences and resume manifest. Candidate-specific screening and writing preferences live in `data/preferences.md`; scoped confirmed personal answers live in `data/candidate.json`. Neither belongs in generic ATS skills.

## Optimistic batch execution

1. Validate shared inputs once; invalid shared facts or CV configuration stop the batch. Park item-local invalid URLs, unknown categories or unavailable roles and continue valid siblings.
2. Fill verified canonical facts, exact-meaning approved answers and authorized consents. Match the complete question: relationship, timeframe, jurisdiction, qualifiers and choices. Similar keywords do not establish equivalence.
3. Re-observe after parsing, rerendering, validation, navigation, upload or conditional fields. A visually selected control is not proof that an ATS accepted or saved its value.
4. Execute one live form at a time by default. Parallel agents require explicit authorization and exclusive application/tab ownership; never edit the same form or record concurrently.
5. Consolidate unknown facts and generated answers in Review. Interrupt only for a user-only identity/security action when no independent work can proceed. Never fabricate a fact, exercise URL or open-source contribution.
6. Keep working questions, answers and meaningful friction in `data/drafts/`; persist the final outcome on the same opportunity. Omit routine clicks, raw DOM, raw email bodies, passwords and OTPs.

## Review and approval

The fixed [UI contract](ui-contract.md) owns presentation and data interfaces. The website shows drafts/questions; the agent applies answers to the employer form. It never submits to an ATS.

- Confirmed deterministic facts are execution evidence, not extra approval questions.
- Simple enumerated questions use clickable, auto-saved choices. A failed save restores the prior selection and blocks approval. A saved choice alone is not application approval.
- Free-text additions and revisions come through chat; the website displays the resulting draft. Keep one application-level Approve action, without repeated per-answer decisions.
- Final-ready applications appear in Review. Real outstanding questions may use `reviewStage: "questions"`, with approval blocked until required facts and live verification are complete. Pure login/session blockers stay in Status.
- Approved, consumed and submitted history leaves Review. Keep minimal outcome evidence on the opportunity. Closed and explicitly hidden records stay out of active Status; internal submitted/confirmed both display as Submitted.

Approval can be the user's actual website decision **or explicit chat acceptance of the exact current application and its displayed answers**. Explicit chat acceptance also authorizes that application's submission after agreed edits are applied and verified. Do not require a redundant website click or separate submit command. Resolve a batch approval to the exact listed application IDs and revisions. Silence, selection alone, general preparation permission, or approval for another application is insufficient.

## Final submission control

Before submission, verify the exact company/role/URL, complete live form, mapped PDF, agreed content and choices, required consent, validation and authenticated session. Apply the requested final version first. A local edit or pending desired-state synchronization never proves the employer form changed.

For website-approved desired revisions, use `verifyDesiredStateApplied` after complete live verification and consume the one-time approval immediately before submission. For explicit chat approval, record the actual chat source and exact snapshot in the working draft, then persist authorization provenance with the successful outcome; do not call website-view/decision APIs to impersonate the user. The tracker records the authorized attempt and outcome through its existing domain functions. Its legacy `approvalConsumed: true` marker means the exact authorization was used once; for chat approval the stored authorization must identify the chat source rather than claim a website click. It does not establish success on its own. No data publication or recovery action grants approval.

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
