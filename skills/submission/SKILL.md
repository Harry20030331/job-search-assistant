---
name: applying-to-jobs-safely
description: Use when filling United States or English-language employer-site or ATS job applications.
---

# Applying to Jobs Safely

Read `../../docs/workflow-contract.md` for the active preparation, review, submission and recovery contract, and `../../docs/candidate-inputs.md` for input ownership. Paths are relative to this skill. Read the applicable `ashby/`, `greenhouse/`, `lever/`, `workday/` or `long-tail/` ATS module for platform behavior; it does not create separate approval rules.

## Preparation

Run bounded preflight using fresh canonical facts, application rules and CV manifest. Every application needs an explicit approved resume-profile key from the selected manifest and an official HTTPS URL. The existing preflight/Review/lifecycle `category` means that resume key, while job `category` means direction; read [the shared adapter contract](../../docs/job-directions.md). Never infer the resume key from a PM/other direction or relabel a job to fit a CV. Upload only its mapped approved PDF and verify the visible filename. Candidate facts override ATS parsing; never infer a missing fact from a blank field or a resume parser.

For generated answers, read the full prompt, the explicit category's approved narrative evidence and the resolved current experience. Choose relevant examples for the actual responsibilities. Preserve metric scopes, titles and provenance; do not use a permanent essay template or merge different category variants into new claims. Put the draft into Review.

## Exact-Meaning Canonical Answers

Reuse a confirmed answer automatically only for an exact semantic match across the subject, relationship, timeframe, jurisdiction, qualifiers and choices. Any materially different wording or meaning remains unresolved; keywords alone are insufficient. Record the answer/source internally: exact canonical answers are execution evidence, not review questions. Do not create a recommendation badge or desired-state revision for facts already confirmed.

## Live form verification

Bind repeated controls to the complete visible question and section. Re-observe after upload, parsing, validation, navigation, conditional fields or rerendering. Verify saved values where the ATS has a save/reopen step. Distinguish an answer drafted locally, applied live, saved by the ATS and finally submitted.

Unknown personal-history, legal, sensitive or exercise facts go to the unified review surface. Simple choices, short factual inputs and long answers can be edited directly in Review and saved automatically. Never fabricate an answer to reach the end of a form. Continue other authorized preparation while one application is blocked.

## Presenting Review to the user

Before first presenting a batch, call the `review.start` data operation to initialize legacy queue metadata. Preserve that metadata during answers, approvals and recovery. The current Review UI follows Status order and has no sidebar numbers; use the UI contract for display behavior.

When presenting or resetting Review, link to the current page and explain: approve content to add it to the batch, then click **Submit applications (N)** at the bottom when ready. No return to chat is required. The second action issues a distinct, exact-content execution task. Preserve the configured execution mode and no-send boundary; a Submitted label in a demo is not evidence of a real employer submission.

## Approval and submission

Follow `../../docs/workflow-contract.md` → Final submission control. Approve accepts local content only and leaves it awaiting execution. Chat acceptance of content has the same scope unless the user explicitly asks to execute or submit. Wait for that separate execution instruction for the selected applications; preserve its actual source and exact content revision. A content-only decision alone cannot be consumed as submission authorization. A website task provides the separate execution request; use `consumeWebsiteTask` and its returned provenance as described in the workflow contract.

Apply all accepted edits to the actual form and verify the complete live state and CV before the authorized submit. For website-approved desired revisions, verify their exact live synchronization before consuming approval. Never turn a local publication into approval, impersonate a user website event, or replay an unclear submission. Save actual success evidence and reconcile receipts under the common contract.

## Working data and closeout

Read the selected profile through the loader, its approved resume manifest and the application-answer preferences. Resolve the paths from the task or [workspace layout](../../docs/structure.md#single-user-workspace). Use the exact role in the opportunity ledger; filling advances the same record, never a separate tracker. Publish working answers, unresolved questions and actual approval state through the data API to the selected draft store. The adapters hydrate role headers from the opportunity.

After observing explicit success, save its time and short official-page/email reference through the lifecycle interface. Working drafts can then be removed with `npm run drafts -- prune --path <selected-draft-store>`. A click or approval is not success. Keep unresolved and uncertain attempts recoverable. No permanent screenshot or daily ledger is required; never put passwords, OTPs, raw DOM or raw email in data.

Use truthful, resume-backed structured skills when supported. Personal links come from the resolved profile. Respect unresolved education conflicts. An absent exercise URL stays a review question, never an invented link.

## Friction-to-Skill Loop

Record symptom, cause, resolution/blocker and prevention for meaningful rework. Keep unresolved one-offs in the working draft; retain only useful outcome notes after completion. Promote reusable platform techniques to the narrowest skill after evidence and a pressure test; promote candidate answers only after confirmation, in their factual source.

## Recovery

Use the contract's three-layer diagnosis: browser connection, local review service, employer form/session. Saved answers are recovery input, not live proof. Restore deterministic content without repeating known questions; re-observe the actual ATS, retain old evidence, and establish current snapshot/authorization before submission. Never resubmit merely to obtain a receipt.

## Stable interface

Treat Review as an existing interface with a stable data contract, not as a page to regenerate for each task. Read `../../docs/ui-contract.md` for the supported ports. Publish or reset local drafts with `npm run data -- --input <command.json>` (`review.publish`) or its domain function, binding stable application IDs and expected snapshot/revision/decision. Change status through the documented job/tracker functions. Read results through `readReviewBatch` and refresh the existing page. User clicks and answer edits use the page's existing API routes; never call approval endpoints to impersonate the user.

Ordinary application preparation, profile answers, review resets and status updates do not authorize editing the renderer, HTML, CSS, client scripts, display rules or the UI baseline. Do not bypass the interface with whole-store rewrites or browser script injection. Candidate-source maintenance follows the candidate-inputs contract. Only an explicit request to change the UI design permits renderer changes; then test, visually verify, preserve the prior manifest and record a reviewed successor baseline. `npm run ui:check` detects renderer drift; it is a repository check, not an OS-level write restriction.

When presenting Review, explain that the agent supplies structured data to this interface while the user reviews there; do not rebuild the screen or repeat all its content in chat. After review, execute only a separate authorized website task or explicit selected-application chat instruction. The default website Demo mode is an offline rehearsal and contacts no employers. For the optional simulated employer exercise, read `../../docs/demo.md`.
