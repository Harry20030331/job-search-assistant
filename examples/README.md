# Alex Liu: one case, two checkpoints

One fictional candidate, one resume, and the same five public job references: Nooks, Adobe, Western Digital, Scale AI and Palantir. The shared contact address uses example.com. No private email, demographic override, local path, chat configuration, approval or execution history is included.

These are the canonical recording and teammate-reproduction checkpoints, not disposable runtime data. Preserve the captured role-specific questions and saved draft answers in Review; do not replace them with generic demo questions or copy generated runtime questions back into this example.

## Shared inputs

- `candidate.json`: fictional education, experience, skills and explicit unknowns.
- `preferences.md`: search scope and writing constraints.
- `resumes.json` and `alex-liu-resume.pdf`: one matching resume and integrity hash.
- `snapshots/shortlist/`: five saved jobs, all Shortlisted; no application records or drafts.
- `snapshots/review/`: the same jobs with five pending local drafts; existing role-specific questions and long answers, no preselected choices or approvals.

The saved postings and questions come from the original five-role exercise on 2026-10-15. Availability and current form contents are not revalidated by loading them. Scale AI retains its graduation-cohort caveat; Western Digital was a hiring-pool posting. They are platform examples, not a claim that every role perfectly matches this candidate. Adobe currently has no extra review question; its card remains available for content approval. Other cards contain the captured role-specific questions. The checkpoint is a local editing state, not proof that an employer form is currently filled or ready to submit.

| Role | Saved Review content |
| --- | --- |
| Nooks | San Francisco office attendance choice |
| Adobe | No additional review questions; application available for approval |
| Western Digital | Hiring-team message draft and preferred US locations |
| Scale AI | Graduation-cohort fit check and relocation choice |
| Palantir | FDSE motivation and three-numbers drafts, high-school facts, relocation, travel, and optional changed-mind response |

Unanswered questions stay unanswered. Loading Review does not approve the content.

## Load a checkpoint

Stop Review and other data writers first. From the repository root:

```sh
npm run example:shortlist
npm run review
# Open /status/us
```

Or, after stopping Review again:

```sh
npm run example:review
npm run review
# Open /review
```

`npm run example:load` defaults to Shortlist. Its `--snapshot shortlist|review` option selects explicitly; `--dir <workspace>` loads into another local workspace. `--from <bundle>` still supports standalone bundles. A fresh checkout automatically loads Shortlist; restarting an existing workspace preserves its progress.

For a recording, show Shortlist, stop the service, load Review, and restart it. Open `/review` without an old `?application=demo-...` query. The same five jobs then display the saved questions and drafts. These commands work without the original author's chat connection. The existing Apply button's generic demo runner is a separate rehearsal path and does not restore this checkpoint; use the checkpoint commands to reproduce this sample. Button triggers and runner behavior are unchanged.

Each load replaces working data as a unit, saves the prior data under ignored `local/example-backups/`, and prints the backup and entry path. Private `data/chat-runner.json` is preserved from that machine, never supplied by the example. Tasks are not copied or replayed. Editing or approving the working copy does not change these saved checkpoints.

Candidate inputs are fictional. Never submit them to a real employer. The default demo runner is a deterministic local rehearsal; these checkpoints do not enable live execution or establish ATS continuity.
