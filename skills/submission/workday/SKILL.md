---
name: applying-through-workday
description: Use when a job application is hosted on Workday or displays a Workday account and application flow.
---

# Applying Through Workday

Use `../SKILL.md` for browser, category/CV, generic workflow, review, submission, and recovery boundaries.

## Account and Activation

Bound stored-credential lookup to the current tenant and candidate. The exact Keychain identity is service `workday:<tenant-slug>` plus the candidate email as account. For `<tenant>.wdN.myworkdayjobs.com`, use the first hostname label as slug (for example, `tmobile` or `hp`), never a cluster label such as `wd1` or `wd5`. Use a configured tenant path only when the hostname lacks a tenant label; fail closed if ambiguous. A Keychain label is descriptive, not identity. Never use shared service `workday`: updating it can overwrite another tenant's password for the same email.

Reuse an authenticated browser session or normal browser saved-password autofill first. Only when Keychain use is explicitly requested, perform at most one exact Keychain lookup per recovery run. If it returns `filled:false`, do not repeat the lookup or infer that no employer account exists. Continue authorized registration preparation instead of treating missing stored credentials as the end of the task. Never expose secrets. Activation links are single-use. If an account exists, a consumed or expired link goes through official recovery only with required authorization; never replay it. Account creation requires user authorization; reuse authorization already given for the same employer and account rather than asking again. Never reset existing credentials based only on registration authorization.

### Registration ownership and credential storage

Registration requires task-specific authorization. For an authorized registration, prepare the official form with the canonical email, preserve the pending page, and continue application preparation after registration succeeds. An existing personal identity account must be reused; employer registration permission does not authorize replacing it.

When the candidate creates the account with the browser's Suggest Strong Password and saves it there, reuse that browser session and its normal saved-password autofill. Do not replace that password, require an additional Keychain copy, or assume browser credentials sync across devices. Use the macOS Keychain only when separately requested for credential storage, isolated by the tenant identity above, so the candidate can retrieve the credential in Keychain Access and the agent can reuse it for later sign-ins. Keep only the employer, official login URL, account email, Keychain service/account identifiers, and observed registration state in the local application ledger. Never put passwords in Markdown, profile JSON, source files, logs, screenshots, or chat. Do not claim a credential was saved or an account created without verifying that result.

Skill instructions and saved preferences do not override active browser/tool requirements. When those requirements reserve new-password entry, confirmation, and submission for the user, hand off precisely that step; do not generate or enter the credential through another tool to bypass the handoff. Preserve the registration authorization and resume automatically after the user completes the step. Any action-time acceptance of account terms remains subject to the active tool requirements, separate from application submission approval.

## Workday Form Technique

Treat parser output as provisional. After resume upload or parser-triggered rerender, reconcile experience, education, languages, phone (code and number), and fixed CV against canonical data. After unrelated rerenders, reconcile only the affected groups.

Bind repeated choices to their complete visible question, section, and choices—not shared Yes/No text or position. After an answer reveals conditional fields, re-observe that question block before filling them.

Prefer the current-date calendar action when intended. Otherwise treat dates as one labeled fact, but commit and re-locate one segment at a time; after each rerender, re-observe and re-locate the next segment before committing it. Verify all segments. Never page through years of months.

After edits, perform one final `Review` refresh, re-observe it, and verify the fixed CV, all answers, validation, authentication, and session. Then follow the common final gate.

## Quick Reference

- Identity: `workday:<tenant-slug>` + email.
- Parse: provisional; reconcile canonical facts.
- Dynamic UI: answer, re-observe block, continue.
- Dates: current-date action or one segment per rerender.
- Finish: one final Review refresh; stop at the common gate.

## Common Mistakes

- Treating label or shared `workday` service as tenant identity.
- Reusing activation links or repeating a `filled:false` lookup.
- Trusting parsed records, stale positions, or stale Review.
- Paging month-by-month across years.
