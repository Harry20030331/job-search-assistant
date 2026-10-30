---
name: discovering-us-graduate-jobs
description: Use when discovering, screening, deduplicating, or refreshing United States graduate and full-time roles for the local job library.
---

# Discovering United States Graduate Jobs

## Chat entry and candidate intake

A fresh greeting or `Start` follows `../../docs/welcome.md` before intake. Use the canonical English welcome, ask whether to create a candidate, resume a selected case, or try the fictional example, and guide the next step in English. Do not greet again mid-workflow or restart setup on a feedback turn. Read the user's supplied facts before asking questions; welcome does not itself authorize initialization or browsing.

When the user asks to find jobs or start Matching, execute the workflow in this Codex chat. The user supplies ordinary language or a resume; do not ask them to author JSON, run CLI commands, or translate their own feedback. The webpage displays the saved shortlist; this chat is the input and feedback surface. Follow `../../docs/matching-chat.md` for the runnable intake and interactive walkthrough.

For a new candidate, collect a name or alias, education/experience summary, core skills, target roles and explicit categories, locations/work modes, seniority, start timing, and batch/company limits. Ask only for missing search-critical scope, in one concise question. Preserve unknowns such as relocation and sponsorship; conditional eligibility must remain explicit. Show a concise summary of extracted facts and constraints for confirmation, then call `matching intake` in a NEW workspace. Never merge a real candidate into the fictional example or overwrite another candidate. Resume mapping, contact details and full application-onboarding checks may wait until preparation.

For existing inputs selected by the user, read them directly. Do not demand a new confirmation of facts already confirmed. Report which candidate/workspace is active before searching. If no candidate has been selected, ask whether to use the fictional example or new inputs; an explicit fictional exercise may use the example immediately.

After publishing a real search, show each role's official link, match, gaps and pending conditions; distinguish recommended roles from research leads (`new`). Invite feedback in this chat. On the next feedback message, read the current workspace and context, interpret the actual instruction, save a narrow patch plus the original meaning and source reference, rescreen the current shortlist and search for replacement leads as needed. Preserve unrelated preferences. Ask only if feedback scope is ambiguous; otherwise execute it immediately. Report the before/after difference and any shortage. Never replace this interaction with a scripted demo or invent feedback to claim an interactive run succeeded.

## Inputs and boundary

Discovery produces job records, not applications or submission permission. Read `../../docs/workflow-contract.md`, `../../docs/job-discovery.md`, the resolved candidate profile, `../../data/preferences.md` and the approved CV manifest before browsing. Screening preferences and personal qualifications belong in those data sources; do not infer them from this skill.

Use Codex's in-app Browser for current listings and official employer pages. Do not substitute a crawler, hidden API, extension or another browser engine. The public SimplifyJobs repository is a source listing only, not the Simplify autofill product.

## Observe and screen

1. Validate the existing library with the jobs CLI. Use the configured sources in the discovery document, plus any sources explicitly authorized for the current task.
2. For incremental batches, read each source's own completed-scan checkpoint. If a complete delta is unavailable, inspect its current listing and deduplicate; do not pretend a partial scan was complete.
3. Treat listings as leads. Inspect the specific official requisition, employer, title, actual permitted work location, employment type, responsibilities, required versus preferred qualifications, start/graduation timing, authorization language and application limits. A generic careers-page redirect is not an open role.
4. Apply current factual screening decisions, including explicit exceptions, from the selected candidate preferences. Record unconfirmed cohort timing explicitly under the selected candidate's recall policy. Distinguish a user-excluded role from one closed by the employer. Ordinary uncertainty is research work, not a question for the candidate.
5. Select and persist exactly one active category under the authorized routing policy. Application execution must use that explicit category and mapped approved CV; it must not silently reclassify it. Never invent qualifications or relabel the candidate's degree.
6. For previously closed leads, distinguish an expired event/referral link from the official requisition. If the public role remains open, update that same role using evidence; a different requisition is a different record. Operational inability to verify is not proof of closure.

## Persist and report

For an interactive recommendation/feedback loop, use the context, feedback and publish commands in `../../docs/matching.md`. Read fresh candidate facts, the complete preference prose and the structured policy before each round. Translate only actual user feedback into a narrow patch; retain its reference and confirm ambiguous scope. Do not infer lasting preferences from a single rejected role. Use stable job exclusions for individual choices. Code handles explicit filters and publication; you still own qualification analysis, evidence truth, natural-language preferences and ranking.

After feedback, re-read and re-assess against the new context token; never merely substitute a fresh token on stale analysis. Cover every managed open shortlist role, explain changed decisions, and include new leads where necessary. Save only actual verification dates. Publish accepted roles through the Matching domain command, then show recommendations, gaps and unresolved questions in chat and refresh Status. A `needs_confirmation` result is a research/user question, not an accepted recommendation or application approval. Do not create a second canonical job list. The offline demo is scripted and does not establish real-world matching performance.

Use `npm run jobs -- upsert` / `close` for narrow validated writes. Deduplicate by official requisition ID or canonical official URL after stripping only known tracking parameters. Merge source attribution and preserve earliest first-seen dates. Discovery writes only `new` or `ready`; tracker-owned state wins and must not be overwritten.

Obey company limits and the candidate's recall policy. Keep screening notes internal. The fixed Status projection owns visibility, numbering and labels; a library record does not prove a form was opened or submitted. Validate after writes and report accepted additions, material changes and operational failures only. Advance a source checkpoint only after its scan and every inspected disposition are complete.

Preparation begins separately under the common and ATS skills. Discovery alone never registers an account, uploads a CV or submits an application.
