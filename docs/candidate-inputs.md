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

Interactive search intake uses Codex chat: provide a designated LinkedIn profile URL, background/resume and search preferences, review the extracted summary, and let Codex run the validated [Matching intake](matching-chat.md). Users do not need to author JSON. Intake creates a fresh isolated candidate workspace with an empty resume manifest; it cannot replace existing cases. Initial search can proceed, while application preflight continues to require approved PDFs. This is search intake, not the complete application-onboarding validator.

Run `npm run review` to use the current working state, automatically supplying the default fictional candidate when data is absent. `data/candidate.json` is the editable working profile. Use `npm run example:load` to replace current state from a saved case; changes remain local and do not alter `examples/`. Stop active writers before loading; the previous state is backed up locally.

```sh
npm run runtime:init -- --dir /tmp/my-new-runtime
npm run review -- --runtime-dir /tmp/my-new-runtime
```

Initialization refuses an existing target. It creates empty opportunities, drafts and discovery state, not personal facts or approvals. Real inputs remain at the paths passed to preflight/profile. If using default commands, place user-owned input files under the ignored runtime `data/` and run commands with their explicit paths. The repository root is not a live personal installation.

Resume existing runtime records with the same `--runtime-dir`; do not reinitialize over them. A service restart does not prove an employer form survived. See [workflow contract](workflow-contract.md).

LinkedIn URL intake uses the in-app Browser and a read-only [source-backed preview](linkedin-import.md) before confirmation. Inaccessible profile fields remain unknown; the existing candidate is never overwritten by preview. Resume input is an alternative rather than a requirement for initial search.

For new setup, accept PDF/DOCX/TXT/Markdown background documents and pasted text alongside LinkedIn URLs. Users may combine sources for the same candidate. Follow the document-reading and conflict-confirmation guidance in [Interactive Matching](matching-chat.md); attachment alone does not establish successful extraction or approval as an application resume.
