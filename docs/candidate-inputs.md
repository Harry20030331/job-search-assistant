# Candidate inputs

Use one standalone `candidate.json`, one `preferences.md`, and one `resumes.json` mapping approved resume-profile keys to PDFs. Files and PDFs may live outside this repository. The supplied example uses a fictional identity; it contains an intentionally unknown relocation answer. Open the default case with `npm run review`, or select a saved case with `npm run example:load -- --from <example-directory>`, then use the working copy:

```sh
npm run profile -- --profile data/candidate.json --check
npm run preflight -- --url https://careers.example.com/jobs/demo --category llm --profile data/candidate.json --manifest data/resumes.json
```

The profile loader accepts a flat schemaVersion 2 record, as in `examples/candidate.json`. It also supports schemaVersion 3 descriptors referencing separate profile/experience files for users who already maintain those sources. This is optional; there is no default personal directory dependency. Relative references resolve from the descriptor's directory. Preflight validates identity and resume integrity, not completeness for every employer form. Missing form facts must remain questions.

`resumes.json` is an array of category, path and SHA-256 entries. Here category is a resume-profile key such as `pm_general`, independent of job directions such as Product Management. Shortlisting needs no mapping; preflight before application does. Relative PDF paths resolve beside the manifest. Only configured categories are required. A missing mapping or changed PDF fails preflight. Resume text is supporting material; canonical facts govern form answers. Prefer direct entry and correct any mandatory ATS auto-parsing. Resolve actual contradictions explicitly.

The example preferences apply only to the fictional candidate. Known answers retain their scope. A confirmed answer to one question cannot be generalized to another relationship, jurisdiction or timeframe.

## Runtime

The default entry is now the website launched by Start; see [welcome](welcome.md). New candidate accepts a LinkedIn profile URL, pasted text or PDF, stages source reading separately, and shows a revision-bound preview for confirmation before creating a candidate. The profile editor then saves confirmed v2 fields, preserves unedited facts and rejects stale writes. Existing linked v3 sources remain independently owned. The source-reading compatibility flow still uses Codex chat: provide a designated LinkedIn profile URL, background/resume and search preferences, review the extracted summary, and let Codex run the validated [Matching intake](matching-chat.md). Users do not need to author JSON. Intake creates a fresh isolated candidate workspace with an empty resume manifest; it cannot replace existing cases. Initial search can proceed, while application preflight continues to require approved PDFs. This is search intake, not the complete application-onboarding validator.

Run `npm run review` to use the current working state, automatically supplying the default fictional candidate when data is absent. `data/candidate.json` is the editable working profile. Use `npm run example:load` to replace current state from a saved case; changes remain local and do not alter `examples/`. Stop active writers before loading; the previous state is backed up locally.

```sh
npm run runtime:init -- --dir /tmp/my-new-runtime
npm run review -- --runtime-dir /tmp/my-new-runtime
```

Initialization refuses an existing target. It creates empty opportunities, drafts and discovery state, not personal facts or approvals. Real inputs remain at the paths passed to preflight/profile. If using default commands, place user-owned input files under the ignored runtime `data/` and run commands with their explicit paths. The repository root is not a live personal installation.

Resume existing runtime records with the same `--runtime-dir`; do not reinitialize over them. A service restart does not prove an employer form survived. See [workflow contract](workflow-contract.md).

LinkedIn URL intake uses the in-app Browser and a read-only [source-backed preview](linkedin-import.md) before confirmation. Inaccessible profile fields remain unknown; the existing candidate is never overwritten by preview. Resume input is an alternative rather than a requirement for initial search.

For new setup, accept PDF/DOCX/TXT/Markdown background documents and pasted text alongside LinkedIn URLs. Users may combine sources for the same candidate. Follow the document-reading and conflict-confirmation guidance in [Interactive Matching](matching-chat.md); attachment alone does not establish successful extraction or approval as an application resume.

## Family and close-friend employment connections

Maintain `applicationFacts.personalConnections` in the selected candidate record. This is a local lookup list, not a request to investigate people online. Add people only when the candidate supplies them; real names and affiliations stay in private runtime data.

```json
{
  "entries": [],
  "unlistedCompanyAnswer": "No",
  "scope": "Family members (including parents and relatives) and close friends; current or former employment."
}
```

Each entry has `name`, `relationship`, `company`, and `employmentStatus` (`current`, `former`, or `unknown`); optional `companyAliases` and employment dates clarify matching. A fictional entry could be `{ "name": "Jordan Example", "relationship": "close_friend", "company": "Example Labs", "employmentStatus": "current", "companyAliases": [] }`. Use one entry per person/company/employment period. A readable summary is `Jordan Example (close friend): Example Labs — current`.

Before asking an employer-specific relationship question, search these entries for the employer and known aliases, then match the question's relationship and time scope. Include subsidiaries only where the question includes them and the company relationship is established. A matching current connection answers a current-employment question Yes; a former connection alone does not. If a possible match has unknown timing or ambiguous company identity, ask only for the missing detail.

The explicit `unlistedCompanyAnswer: "No"` enables automatic No for covered questions with no matching connection, including an empty list. It expresses the candidate's chosen default; it does not claim that no relative or friend has ever had a job. Missing configuration remains unknown, rather than silently giving every candidate this default. The shared Alex fixture explicitly enables it; each private runtime owns its own policy. Materially broader relationships or conflict-of-interest questions remain separate; do not reuse this answer for the candidate's own employment, referrals, business dealings or government connections.

Record the resolved answer and its candidate source as deterministic working evidence; do not repeat it as a Review question. Local resolution does not prove the answer is present on the employer website.

Maintenance, 2026-10-15: Added the user-requested personal-connections list and explicit empty-list policy, replacing per-employer repeated questions for this scope.

## Citizenship, status and military service

Keep these reusable facts in the selected candidate record, separately from work authorization and protected-veteran self-identification:

```json
{
  "citizenship": {
    "countryCodes": null,
    "usPermanentResident": null,
    "usAsyleeOrRefugee": null,
    "subsequentStatusHistory": null
  },
  "militaryService": {
    "hasServed": null,
    "serviceCountryCodes": null,
    "isVeteran": null
  }
}
```

Use ISO country codes in complete candidate-confirmed citizenship and service-country lists. `null` means unknown, not No; do not default citizenship or military history to No. `countryCodes` includes all current citizenships: a confirmed complete list containing `US` answers US citizenship Yes; one without `US` answers No. Do not infer citizenship from location, ethnicity, language, work authorization or sponsorship answers. Keep any existing protected-veteran answer in `eeo.veteranStatus`; it is not equivalent to `militaryService.isVeteran`. A confirmed `hasServed: false` supports No to a general veteran question; prior service alone does not establish the answer for every country's veteran definition.

Resolve an employer's combined US citizen/permanent resident/asylee/refugee question from its exact alternatives: a confirmed qualifying Yes suffices, but No requires all alternatives to be known false. Preserve any additional wording and scope. For country-list questions, compare the exact countries named by that employer with the confirmed citizenship list. Do not maintain a generic restricted-country boolean or infer that a mention of Cuba or Iran is a candidate fact. Questions about birthplace, residence or past nationality are separate from current citizenship.

If a form asks about subsequent citizenship, permanent residence or asylum in another country, use candidate-provided `subsequentStatusHistory` entries with `countryCode`, `status` and `effectiveDate`; unknown chronology requires clarification. Do not collect document numbers or identification scans for these ordinary Yes/No questions. Skip conditional questions when their confirmed prerequisite is false.

Once confirmed, reuse exact-scope facts across applications and remove repeated questions from Review through the domain interface. Keep provenance in the candidate record and mark local answers as awaiting live verification until observed on the employer website. User-specific facts stay out of shared examples.

Maintenance, 2026-10-15: Added reusable citizenship/status and military-service fields. Alex values remain unknown until explicitly supplied; the existing non-protected-veteran answer is preserved.

## Reusable application facts and Review routing

| Information | Canonical source | Review treatment |
| --- | --- | --- |
| GPA | `education[].gpa`: `value`, `scale`, `asOf` | Collect a missing GPA once for the applicable degree; reuse it across employers. Never merge BS and MS GPA, invent a conversion, or choose an ambiguous employer range. |
| Work authorization and sponsorship | Existing `workAuthorization` answers; `immigrationSupport.requiredNowOrFuture` for broader support including OPT/CPT/STEM OPT | Reuse matching scope. A narrow sponsorship No does not settle a broader immigration-support question. |
| Previous employment at the target company | `experiences`, employer aliases/known corporate relationships, `applicationFacts.employmentHistoryCoverage.complete` | Derive the answer; do not store a second per-company employment history. Include internships and other roles when the question does. Absence supports No only with complete coverage for the requested scope. |
| Restrictions on starting work | `applicationFacts.employmentRestrictions`: `hasRestrictions`, `details`, `asOf` | Reuse a confirmed unrestricted No; evaluate recorded restrictions against the actual role and ask only about unclear applicability. Do not decide a disputed legal interpretation automatically. |
| Outside work or business activities | `applicationFacts.outsideActivities`: `entries`, `asOf` | `null` is unknown; confirmed `[]` means none. Compare known activities with the employer's question, including expected activities where asked; review a possible conflict rather than assuming every activity conflicts. |
| Ordinary applicant privacy acknowledgement | Selected `preferences.md` | Follow an explicitly authorized preference after reading the actual notice. Do not repeatedly ask for plain acknowledgements. Keep optional marketing and other bundled authorizations separate; follow tool-required confirmation for binding agreements. |

Repeated missing facts are profile gaps, not permanent employer-by-employer decisions: collect them once, update the candidate with source/date, then resolve matching pending questions across the batch. Until answered, keep an actionable missing-fact question rather than fabricating an answer or marking the application ready. The current interface may display such a gap within a draft; it can also be corrected through Profile & preferences for fields supported by that editor.

Review retains role-specific choices (particular office days, locations, travel, compensation or eligibility exceptions), generated long answers, and genuinely unresolved facts/conflicts. Confirmed reusable facts and deterministically derived answers belong in execution evidence. Prior employer-form values and consents remain unverified until observed live.

Maintenance, 2026-10-15: Consolidated GPA, broad immigration support, employment-history coverage, restrictions and outside activities. The fictional Alex history is complete for the defined scenario. No new GPA, immigration-support, restriction or outside-activity answer has been invented. Notice acknowledgement preferences remain local and user-specific.
