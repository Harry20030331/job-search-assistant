# US job discovery

Active discovery structure. Candidate-specific screening is owned by `../data/preferences.md`; execution and review follow [workflow-contract](workflow-contract.md).

## Sources and verification

Current scope (2026-10-31): **New Grad only**, using [SimplifyJobs/New-Grad-Positions](https://github.com/SimplifyJobs/New-Grad-Positions) as the sole lead repository. The user specifically provided its [Product Management section](https://github.com/SimplifyJobs/New-Grad-Positions#-product-management-new-grad-roles); use that section for PM, and the appropriate section of the same repository for other confirmed directions. Match the bounded list against current candidate inputs rather than running open-ended web searches. Do not use search engines, other aggregators, unrelated official-careers discovery, internships or experienced-role expansion by default. If a direction is absent, the repository is inaccessible, or too few jobs qualify, show the limitation instead of expanding sources.

Follow each listed official employer/application link to verify the exact requisition. Preserve `simplify-new-grad` provenance; official-page evidence supports verification rather than becoming an independent discovery source. The `speedyapply-*`, `user-provided` and `official-careers` IDs remain readable for historical records and explicit future scope changes; they are not active website discovery sources. A request's saved scope records this boundary. The Simplify repository is a lead list, not an execution tool: never install its extension or use its autofill.

Do not assume every listed role is New Grad or suitable for the candidate's graduation year. Verify full-time/entry-level eligibility, graduation window and start timing against the official role, including for repositories titled for another cohort. No graduation year or location is inferred from the repository title.

Check requisition identity, employer, role, location, full-time status, qualifications, cohort/start timing, sponsorship/citizenship constraints and application limits. Event registration or referral links can expire independently from a public job. Do not mark an employer role closed from a failed browser connection or an expired event link alone.

## Screening ownership

Read the current candidate profile and preferences each run. They own eligible locations, experience, education equivalence, start date, employer exclusions, category scope, quality exceptions and company limits. Apply only the scope and exceptions explicitly recorded in the selected preferences; no location or graduation year is a built-in candidate fact.

Job directions are user-configured open labels, including Product Management, Design, Finance or other agreed scope. Existing `llm`/`recommendation` values retain their previous meaning. The job `category` field stores direction, not a required resume mapping. Discovery never selects an application resume profile. See [direction/resume interface](job-directions.md).

## Canonical library and narrow writes

`data/opportunities.json` is the only canonical job/application store. Matching owns source, availability and screening fields; Submission owns application lifecycle.

Use the jobs CLI/domain API, not manual whole-file edits. Official requisition IDs and canonical URLs are stable identity; rendered row numbers are not. Preserve first-seen dates, source attribution and truthful verification dates. An inability to verify today does not justify overwriting an earlier observation with invented closure evidence.

Discovery may create `new` or `ready` rows; it cannot fabricate `in_progress`, `final_review` or `submitted`. Tracker ownership takes precedence for the same job. The UI contract controls the unified Shortlisted projection and hides closed/user-excluded records without deleting them. Keep screening notes internal.

## Bounded execution

Use the candidate's target batch size and per-employer limit in preferences. Stop before application execution unless separately authorized. Incremental scanning uses source-specific completed checkpoints; incomplete scans retain the prior checkpoint. A missing delta falls back to a deduplicated current-list scan, with reduced precision stated honestly.

Validate the library after narrow writes. Report meaningful additions, closures/changes and operational failures. Routine rejected leads and internal screening notes do not create new approval chores.

## Maintenance — 2026-10-31

The user restricted current discovery to New Grad roles from SimplifyJobs. This replaces the previous multi-source default without removing historical source records or changing candidate-owned directions, geography and timing.
