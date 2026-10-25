---
name: discovering-us-graduate-jobs
description: Use when discovering, screening, deduplicating, or refreshing United States graduate and full-time roles for the local job library.
---

# Discovering United States Graduate Jobs

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
