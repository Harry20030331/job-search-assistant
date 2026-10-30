# Interactive Matching in Codex

2026-10-25. The supported interaction surface is this project's Codex chat. Codex reads user messages, performs current browsing through the in-app Browser, writes validated records and explains results. Status is the saved shortlist view. There is no web button that launches an independent agent.

## Candidate information

For first-time users, the [English welcome](welcome.md) starts when they send `Hi` or `Start` in a fresh project chat. Codex is instructed to guide setup without requiring the detailed technical prompts used in the meeting walkthrough below.

The user can provide a designated LinkedIn profile URL, paste/upload a resume, or describe their background and preferences. Offer these three English choices with `npm run matching -- sources` when nothing was supplied; a resume is optional. Follow [LinkedIn import](linkedin-import.md) for browser observation, preview and confirmation. Do not re-ask for a resume after the user selected LinkedIn. They do not need to edit JSON or know the CLI. Collect only information needed for the initial search: a name/alias, education or experience, skills, role direction with an explicit category, seniority, locations and work modes, start timing, and desired batch size/company limit. Retain unknown work-authorization, relocation and other facts as unknown. Ask about them only when needed to determine eligibility. Contact details and an approved PDF are not prerequisites for discovery.

Show the extracted facts and constraints to the user for confirmation before creating a new case. User messages explicitly confirming an existing summary count; do not require a duplicate confirmation. Never import a developer's personal history from chat memory into a candidate.

The agent writes a temporary local intake command (not committed to Git), then runs:

```sh
npm run matching -- intake --workspace /tmp/new-candidate-case --input /tmp/confirmed-intake.json
npm run matching -- context --workspace /tmp/new-candidate-case
```

The target workspace must not exist. Intake creates canonical candidate/preferences files, an empty resume manifest and fresh opportunity/draft/discovery records. It never overwrites an existing candidate. The initial rules and source reference come from confirmed inputs; the example below is fictional and is not pre-approval for a real user.

```json
{
  "confirmed": true,
  "reference": "Actual user confirmation reference",
  "candidate": {
    "schemaVersion": 2,
    "fictional": true,
    "identity": {"fullName": "Casey Example"},
    "summary": "MS student with a retrieval course project",
    "skills": ["Python", "Retrieval"],
    "education": [{"degree": "MS", "endDate": "2027-06"}],
    "experiences": [],
    "availability": {"startDate": "2027-07-01", "relocation": null}
  },
  "preferences": "Entry-level applied LLM roles starting July 2027. Seattle remote or hybrid. Relocation is unknown.",
  "rules": {
    "categories": ["llm"], "workModes": ["remote", "hybrid"],
    "locations": ["Seattle, WA"], "excludedCompanies": [], "excludedJobIds": [],
    "limit": 3, "perCompany": 1
  }
}
```

For an existing candidate, first list saved searches with `npm run matching -- workspaces` and let the user select a numbered result. Only ask for a path as a fallback when discovery cannot find the intended case. Skip intake when resuming. A search-only intake does not satisfy complete application onboarding: preflight still rejects an empty approved resume manifest before filling.

## Initial search

1. Read `matching context` and the shared library; state the active candidate and scope in chat. Before source browsing, start `npm run matching -- serve --workspace <workspace>` in a persistent terminal session and open its returned `statusUrl` visibly in the in-app Browser. Reuse the conversation's existing session if available. Keep this results tab while researching external pages in background tabs; refresh it after publication. A saved URL from another workspace is not interchangeable.
2. Browse one or more supported source lists and official requisitions. Bound the search and distinguish partial sampling from a completed source scan.
3. Assess qualifications, timing and preferences against actual candidate facts. Do not invent experience, employer availability, geographic eligibility or verification dates. Ranking and prose analysis are performed by Codex on the observed material.
4. Write the current-context round to a private temporary file and run `npm run matching -- publish --workspace <workspace> --input <round.json>`. See [Matching](matching.md) for its schema. The agent constructs it; the user does not.
5. Show official links, matches, gaps and questions in chat. Accepted recommendations are `ready`; conditional research leads are `new`. Both appear under the fixed Shortlisted projection, so clearly distinguish them in the chat explanation. Rejected new leads need not enter the library. A failed page connection is not employer closure.
6. Reload the already-open Status tab for that workspace, bring it back into view and invite the user to give feedback in ordinary language here. If the local service failed, explain the failure and recover it before claiming the results are visible.

## Real feedback turn

For example, when the actual user says "Remote only; exclude Example Company", read the latest context and convert that actual instruction to a `feedback` patch with `workModes: ["remote"]` and an explicit company exclusion. Merge new exclusions with existing ones unless the user explicitly replaces or clears them. Save the concise English meaning and actual message reference, then rescreen; do not ask the user to supply structured rules. Keep unrelated location, role and timing constraints. Interpret temporary versus persistent scope explicitly when ambiguous.

After saving feedback, re-read context, re-assess all managed open shortlist records and browse for replacements if needed. A fresh token alone does not refresh the underlying analysis. `workMode: null` becomes a question when work mode is constrained; geographic uncertainty remains a question when location is constrained. Such records are retained at `new` but parked out of active Status until preference eligibility is established. Other conditional leads can remain visible at `new`, with their questions explained in chat. A rejected current recommendation is also parked at `new`; its vacancy is not marked closed. Existing applications are protected, so explain when feedback cannot change an already-started application.

Publish the new round, refresh Status, and explain the changes. If no fully eligible roles remain, say so and show the pending research questions; do not fabricate replacements. This is an actual interactive run only when the user supplies the feedback. The scripted `matching:demo` remains an offline mechanics test.

## Meeting demonstration

Use one selected fictional candidate and real public postings without applying. Show the confirmed input, first result, a new unscripted user instruction, and the changed result. Restart/read the same workspace to demonstrate persistence. Preserve a short local record of the actual source links, observation times, feedback reference and before/after decisions. Live public postings may disappear or have no eligible roles. Report that outcome honestly; keep the fixed scripted demo only as a separate fallback for storage mechanics.

## Maintenance note

Added chat intake and workspace selection on 2026-10-25. Discovery can start with an empty resume manifest; `categoriesWithoutResume` and `resumeMappingConfigured` report mapping coverage only and do not establish application readiness. Pending research leads now persist as `new`. No Status/Review baseline or shared opportunity schema changed. Complete candidate onboarding and LinkedIn import remain pending.
