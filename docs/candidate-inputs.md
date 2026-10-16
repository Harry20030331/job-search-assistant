# Candidate inputs

Use one standalone `candidate.json`, one `preferences.md`, and one `resumes.json` mapping categories to PDFs. Files and PDFs may live outside this repository. The supplied example uses a fictional identity; it contains an intentionally unknown relocation answer. Open the default case with `npm run review`, or select a saved case with `npm run example:load -- --from <example-directory>`, then use the working copy:

```sh
npm run profile -- --profile data/candidate.json --check
npm run preflight -- --url https://careers.example.com/jobs/demo --category llm --profile data/candidate.json --manifest data/resumes.json
```

The profile loader accepts a flat schemaVersion 2 record, as in `examples/candidate.json`. It also supports schemaVersion 3 descriptors referencing separate profile/experience files for users who already maintain those sources. This is optional; there is no default personal directory dependency. Relative references resolve from the descriptor's directory. Preflight validates identity and resume integrity, not completeness for every employer form. Missing form facts must remain questions.

`resumes.json` is an array of category, path and SHA-256 entries. Relative PDF paths resolve beside the manifest. Only configured categories are required. A missing mapping or changed PDF fails preflight. Resume text is supporting material; canonical facts govern form answers. Prefer direct entry and correct any mandatory ATS auto-parsing. Resolve actual contradictions explicitly.

The example preferences apply only to the fictional candidate. Known answers retain their scope. A confirmed answer to one question cannot be generalized to another relationship, jurisdiction or timeframe.

## Runtime

Run `npm run review` to use the current working state, automatically supplying the default fictional candidate when data is absent. `data/candidate.json` is the editable working profile. Use `npm run example:load` to replace current state from a saved case; changes remain local and do not alter `examples/`. Stop active writers before loading; the previous state is backed up locally.

```sh
npm run runtime:init -- --dir /tmp/my-new-runtime
npm run review -- --runtime-dir /tmp/my-new-runtime
```

Initialization refuses an existing target. It creates empty opportunities, drafts and discovery state, not personal facts or approvals. Real inputs remain at the paths passed to preflight/profile. If using default commands, place user-owned input files under the ignored runtime `data/` and run commands with their explicit paths. The repository root is not a live personal installation.

Resume existing runtime records with the same `--runtime-dir`; do not reinitialize over them. A service restart does not prove an employer form survived. See [workflow contract](workflow-contract.md).
