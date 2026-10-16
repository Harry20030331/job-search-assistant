# US job discovery

Active discovery structure. Candidate-specific screening is owned by `../data/preferences.md`; execution and review follow [workflow-contract](workflow-contract.md).

## Sources and verification

Default sources are `SimplifyJobs/New-Grad-Positions`, `speedyapply/2027-AI-College-Jobs`, and `speedyapply/2027-SWE-College-Jobs`. Explicit task instructions may add sources such as career-fair companies, referrals or Frontier Lab careers pages. Listings supply leads; the specific official employer page establishes availability and requirements.

Check requisition identity, employer, role, location, full-time status, qualifications, cohort/start timing, sponsorship/citizenship constraints and application limits. Event registration or referral links can expire independently from a public job. Do not mark an employer role closed from a failed browser connection or an expired event link alone.

## Screening ownership

Read the current candidate profile and preferences each run. They own eligible locations, experience, education equivalence, start date, employer exclusions, category scope, quality exceptions and company limits. Apply only the scope and exceptions explicitly recorded in the selected preferences; no location or graduation year is a built-in candidate fact.

Default category meanings are `llm` for Agent/Applied LLM and supporting systems, and `recommendation` for recommendation/retrieval/search/ranking/personalization and supporting infrastructure. Historical `robotics` storage does not authorize new work. Discovery records a category; application execution never guesses or changes it.

## Canonical library and narrow writes

`data/opportunities.json` is the only canonical job/application store. Matching owns source, availability and screening fields; Submission owns application lifecycle.

Use the jobs CLI/domain API, not manual whole-file edits. Official requisition IDs and canonical URLs are stable identity; rendered row numbers are not. Preserve first-seen dates, source attribution and truthful verification dates. An inability to verify today does not justify overwriting an earlier observation with invented closure evidence.

Discovery may create `new` or `ready` rows; it cannot fabricate `in_progress`, `final_review` or `submitted`. Tracker ownership takes precedence for the same job. The UI contract controls the unified Shortlisted projection and hides closed/user-excluded records without deleting them. Keep screening notes internal.

## Bounded execution

Use the candidate's target batch size and per-employer limit in preferences. Stop before application execution unless separately authorized. Incremental scanning uses source-specific completed checkpoints; incomplete scans retain the prior checkpoint. A missing delta falls back to a deduplicated current-list scan, with reduced precision stated honestly.

Validate the library after narrow writes. Report meaningful additions, closures/changes and operational failures. Routine rejected leads and internal screening notes do not create new approval chores.
