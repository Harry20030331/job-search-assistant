# Matching feedback loop

Implemented 2026-10-25. This is a Codex-driven workflow with deterministic publication and feedback controls, not a standalone model, crawler, scheduler or validated matching algorithm. Hannah owns this module. The existing opportunity schema and fixed UI are unchanged.

## Responsibilities

Codex starts at [the Matching workflow](../skills/matching/SKILL.md), then reads only the needed child: [candidate intake](../skills/matching/intake/SKILL.md), [job discovery](../skills/matching/discovery/SKILL.md), or [matching and feedback](../skills/matching/feedback/SKILL.md). Intake confirms inputs, discovery observes official roles, and assessment compares required versus preferred qualifications. It produces ranked assessments with candidate and job evidence, gaps and unresolved questions. No keyword score substitutes for this judgment.

The Matching CLI binds those assessments to a hash of the resolved candidate, complete preferences and resume manifest. It enforces confirmed job-direction, work-mode, location, company/job exclusions and shortlist limits. It publishes accepted roles atomically through the existing job/storage domain functions. It never creates an application, approves a draft or submits anything.

## Run against selected inputs

Context, feedback and publish commands accept `--profile`, `--preferences`, `--manifest`, and `--opportunities`. Defaults are the corresponding files in `data/`. Use `--workspace <directory>` to select all four canonical paths together. For ordinary-language intake and real feedback turns, follow [Interactive Matching](matching-chat.md). Always pass the same selected paths throughout a session. Command inputs and reports are private temporary artifacts, not a second canonical job library. `context` prints candidate facts for the local agent; do not publish its output.

1. `npm run matching -- context`: read facts, full preferences, manifest, structured policy and `token`. Also read current opportunities. Confirm ambiguous preference scope before storing a policy. Full application-onboarding validation is still separate and pending.
2. `npm run matching -- feedback --input <command.json>`: initialize or patch the policy from an actual user instruction. Store a concise English representation and real chat/source reference; never invent user feedback. Existing preferences may supply the initial rules when unambiguous. The feedback command preserves prose, records history inside `preferences.md`, checks the expected token, and requires a new screening round. It does not immediately change Status.
3. Re-read context and assess all currently managed open shortlist records plus new leads. `npm run matching -- publish --input <round.json>` checks the token and publishes the complete round. Present the report in chat: recommendations, evidence, gaps, questions, changes and protected records. Refresh Status. Do not present only the webpage: its fixed renderer intentionally omits screening explanations.

### Preference command

```json
{
  "expectedToken": "<token returned by context>",
  "initialRules": {
    "categories": ["llm"],
    "workModes": ["remote", "hybrid"],
    "locations": ["Seattle, WA"],
    "excludedCompanies": [],
    "excludedJobIds": [],
    "limit": 5,
    "perCompany": 2
  },
  "feedback": {
    "id": "unique-feedback-id",
    "text": "Concise representation of the actual instruction",
    "reference": "Actual user message or selected preference source",
    "at": "2026-10-25T12:00:00.000Z",
    "patch": {}
  }
}
```

`initialRules` is required only for the first command and forbidden thereafter. A subsequent feedback command omits it and supplies only changed fields in `patch`, for example `{"workModes":["remote"]}`. Arrays replace that field; omitted fields remain unchanged. Empty exclusions restore eligibility. Use actual timestamps and references, not the illustrative values above. The policy block is canonical preference data, not candidate facts or an ATS skill.

V1 feedback is persistent for this selected candidate workspace until superseded. For a one-round exception, use an isolated workspace or explicitly restore the prior constraints afterward; do not silently turn temporary feedback into a lasting preference. Text-only feedback may use an empty patch: Codex must then re-assess the prose. A fresh token is a version guard, not proof of semantic understanding. New feedback takes precedence for the explicitly changed dimensions; unrelated original prose constraints still apply.

Location strings are explicit allowed locations compared case-insensitively, not a geocoder. The agent must normalize observed eligibility to the same labels (for example, Washington eligibility to a confirmed Seattle location), with evidence. "Remote" alone does not establish geographic eligibility. Unknown work mode or required location yields `needs_confirmation`, not a fabricated fact. Policy categories are open job directions selected in the preferences, not resume keys. Discovery permits an empty resume manifest; context reports available resume-profile keys without guessing a mapping. Approved resume mapping and PDF integrity remain preflight responsibilities before application execution.

### Assessment round

```json
{
  "version": 1,
  "contextToken": "<fresh context token>",
  "assessments": [{
    "jobId": "fictional-role-1",
    "company": "Example Company",
    "title": "Graduate Retrieval Engineer",
    "location": "Seattle, WA",
    "category": "llm",
    "officialUrl": "https://jobs.example.com/role-1",
    "sources": ["user-provided"],
    "firstSeen": "2026-10-25",
    "lastVerified": "2026-10-25",
    "workMode": "remote",
    "eligibleLocations": ["Seattle, WA"],
    "decision": "recommend",
    "match": ["Candidate retrieval project aligns with the role"],
    "gaps": ["Production experience is limited"],
    "questions": [],
    "candidateEvidence": ["candidate.json: experiences.example-labs"],
    "jobEvidence": ["Supplied fictional brief: retrieval, 0-2 years, Washington remote eligible"]
  }]
}
```

The supplied array order is the agent's ranking, not a computed similarity score. `decision` is `recommend`, `needs_confirmation`, or `reject`. Evidence strings must reference actual observed material; the schema cannot verify their truth. Questions prevent publication as recommended even if the agent selected `recommend`. Eligible records beyond the total/per-employer limits become `deferred`. Uncertain leads are stored as `new` research records with questions. Rejected and deferred new leads are returned in the report without creating jobs. Keep any working input needed for later reconsideration locally or rediscover those leads; it is not canonical application state.

Existing managed shortlist records must be covered in the next round, preventing a partial rescreen from silently leaving outdated recommendations active. Roles removed by current user-preference screening are parked at `new` and use the existing `user-excluded:` note convention, retaining open availability, stable identity and first-seen history. A later recommendation restores visibility. This convention covers preference-based rescreening and shortlist limits; it never means the employer closed the role. Actual official closure still uses the jobs `close` operation. Closed or Submission-owned records are protected and reported separately, without mutation or automatic reopening. Applying feedback never cancels an application in progress.

## Isolated two-round demonstration

```sh
npm run matching:demo -- --dir /tmp/matching-demo-new
```

The directory must not exist. The demo copies the fictional example into it, publishes two initial roles, then processes a scripted remote-only/company-exclusion instruction. The final shortlist contains a different remote role. It writes `matching-demo-report.json` with before/after decisions and evidence. No current workspace or employer is modified. These are scripted observations and feedback; the demo verifies mechanics, not live search or model quality.

To inspect its final Status while another service uses port 64441:

```sh
npm run review -- --review /tmp/matching-demo-new/data/drafts --tracker /tmp/matching-demo-new/data/opportunities.json --jobs /tmp/matching-demo-new/data/opportunities.json --port 64442
```

Open `http://127.0.0.1:64442/status/us`. The normal workspace remains on its original port. Use a different fresh directory for each repeatable demo.

## Maintenance note — 2026-10-25

Added Matching context/version binding, canonical preference feedback, transactional shortlist publication and an isolated scripted demo. No new source IDs, opportunity fields, application authorization rules or UI baseline changes. Search intake and actual chat feedback are covered by the follow-up in [Interactive Matching](matching-chat.md). Full application onboarding, LinkedIn import, automatic scheduling and empirical matching evaluation remain outside this change.

Skill structure maintenance — 2026-10-29: split the existing Matching instructions into one stable entry point and three linked stage skills. Shared policy remains in the workflow contract; CLI commands, canonical state and the fixed UI are unchanged. Feedback can return to discovery for replacements and then resume assessment/publication.
