---
name: applying-to-jobs-safely
description: Use when filling United States or English-language employer-site or ATS job applications.
---

# Applying to Jobs Safely

Read `../../docs/workflow-contract.md` for the active preparation, review, submission and recovery contract, and `../../docs/candidate-inputs.md` for input ownership. Paths are relative to this skill. Read the applicable `ashby/`, `greenhouse/`, `lever/`, `workday/` or `long-tail/` ATS module for platform behavior; it does not create separate approval rules.

## Preparation

Run bounded preflight using fresh canonical facts, application rules and CV manifest. Every application needs an explicit active category and official HTTPS URL. Upload only its mapped approved PDF and verify the visible filename. Candidate facts override ATS parsing; never infer a missing fact from a blank field or a resume parser.

For generated answers, read the full prompt, the explicit category's approved narrative evidence and the resolved current experience. Choose relevant examples for the actual responsibilities. Preserve metric scopes, titles and provenance; do not use a permanent essay template or merge different category variants into new claims. Put the draft into Review.

## Exact-Meaning Canonical Answers

Reuse a confirmed answer automatically only for an exact semantic match across the subject, relationship, timeframe, jurisdiction, qualifiers and choices. Any materially different wording or meaning remains unresolved; keywords alone are insufficient. Record the answer/source internally: exact canonical answers are execution evidence, not review questions. Do not create a recommendation badge or desired-state revision for facts already confirmed.

## Live form verification

Bind repeated controls to the complete visible question and section. Re-observe after upload, parsing, validation, navigation, conditional fields or rerendering. Verify saved values where the ATS has a save/reopen step. Distinguish an answer drafted locally, applied live, saved by the ATS and finally submitted.

Unknown personal-history, legal, sensitive or exercise facts go to the unified review surface. Simple choices use the existing autosave controls; free-text changes come through chat. Never fabricate an answer to reach the end of a form. Continue other authorized preparation while one application is blocked.

## Approval and submission

Follow `../../docs/workflow-contract.md` → Final submission control. Explicit user acceptance of the exact current application in chat is valid approval and submission authorization; it does not require an extra website click. Preserve the actual source. An option selection alone is not approval.

Apply all accepted edits to the actual form and verify the complete live state and CV before the authorized submit. For website-approved desired revisions, verify their exact live synchronization before consuming approval. Never turn a local publication into approval, impersonate a user website event, or replay an unclear submission. Save actual success evidence and reconcile receipts under the common contract.

## Working data and closeout

Read `data/candidate.json` through the profile loader, `data/preferences.md`, and `data/resumes.json`. Use the exact role in `data/opportunities.json`; filling advances the same record, never a separate tracker. Publish working answers, unresolved questions and actual approval state through the data API to `data/drafts/`. The adapters hydrate role headers from the opportunity.

After observing explicit success, save its time and short official-page/email reference through the lifecycle interface. Working drafts can then be removed with `npm run drafts -- prune --path data/drafts`. A click or approval is not success. Keep unresolved and uncertain attempts recoverable. No permanent screenshot or daily ledger is required; never put passwords, OTPs, raw DOM or raw email in data.

Use truthful, resume-backed structured skills when supported. Personal links come from the resolved profile. Respect unresolved education conflicts. An absent exercise URL stays a review question, never an invented link.

## Friction-to-Skill Loop

Record symptom, cause, resolution/blocker and prevention for meaningful rework. Keep unresolved one-offs in the working draft; retain only useful outcome notes after completion. Promote reusable platform techniques to the narrowest skill after evidence and a pressure test; promote candidate answers only after confirmation, in their factual source.

## Recovery

Use the contract's three-layer diagnosis: browser connection, local review service, employer form/session. Saved answers are recovery input, not live proof. Restore deterministic content without repeating known questions; re-observe the actual ATS, retain old evidence, and establish current snapshot/authorization before submission. Never resubmit merely to obtain a receipt.

## Stable interface

Routine answers and status updates must use the documented data ports. Changing layout or interactions requires an explicit user request; preserve the UI baseline during data updates. For the course demo, read `../../docs/demo.md`; the demo form is the only permitted destination for fictional inputs.
