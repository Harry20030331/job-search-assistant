---
name: applying-through-long-tail-ats
description: Use when a job application uses an unfamiliar, custom, or less-common ATS rather than Greenhouse, Ashby, Lever, or Workday.
---

# Applying Through Long-Tail ATS

Read `../SKILL.md` and `../../../docs/workflow-contract.md` before operating this ATS. They own canonical inputs, explicit category/CV routing, approved answers, review, submission and recovery. This module adds platform-specific techniques.

## Component-Level Technique

Treat the unfamiliar application as a sequence of visible components, not as a known vendor template. Observe the current step, read each full label and surrounding section, fill supported facts, verify the component, then advance. Never extrapolate hidden steps or assume controls behave like another ATS.

A cookie banner or privacy modal may cover fields or buttons. Read its choices and select the least expansive option that permits the application; reject optional advertising or tracking where offered. Re-observe the page after the overlay closes.

After exact final-submit authorization under the common skill, a custom ATS may reveal a consent flow only after the Submit control is activated. Treat every newly visible modal as a new component: answer only from canonical consent rules, re-observe after `Continue`, and follow a second opt-out confirmation when present. Do not report success merely because the modal closed; require a visible success result, submitted dashboard state, or exact confirmation email.

Custom multi-step flows may rerender after uploads, validation, conditional questions, or navigation. Re-observe after every such event. Bind repeated Yes/No choices to their complete questions. Never guess unknown sensitive, legal, identity, security, personal-history, credential, or exercise facts; add them to review.

## SmartRecruiters and Custom Controls

After resume parsing, classify every experience and education record as complete, incomplete, or complementary against the canonical profile and fixed CV before deleting anything. Keep a complete canonical record first; remove an incomplete duplicate only after the retained record visibly contains all canonical fields. Complementary records remain separate when they represent different real experience or education.

Bind every custom radio, checkbox, or combobox to the complete visible question and its own choices; never target repeated choices by index, DOM order, or screen coordinates. If the in-app Browser cannot produce a question-bound handle, leave that field unresolved and record ATS-specific friction.

Commit education and experience dates through the actual date component, save the record, then reopen the saved record and verify the persisted date. Do not trust transient input text or a collapsed record summary as persistence evidence.

Accept required terms, truthful certifications, and authorized required processing consent. Reject optional marketing, talent-community, SMS, affiliate, promotional, and unrelated data-sharing consent.

## Navigation and Stop Boundary

`Next`, `Continue`, or `Save and continue` normally advances a component, but its meaning must be read from the current visible context. `Next` is not automatically Submit, and a final action may appear without a dedicated Review page. Before every progression action, verify current values; before the final action, stop.

Report the explicit category, PDF filename, steps completed, unresolved questions, generated answers, and exact visible final action. Stop at that final control, then follow `../../../docs/workflow-contract.md` → `Final submission control`; this skill grants no separate submission authority.

## Scenario Self-Check

If a cookie banner hides a three-step custom form and step two rerenders after upload, dismiss only necessary cookies, re-observe after each transition and upload, use Next when nonfinal, and stop at the final submission control.


Final submission permission and authorization sources are defined only by the common workflow contract. These checks do not require a second approval after exact user acceptance.
