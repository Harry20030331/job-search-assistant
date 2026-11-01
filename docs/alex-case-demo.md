# Alex Liu five-role demo

Maintenance date: 2026-10-31. Use the original fictional profile, resume, five saved roles and role-specific review questions in `examples/`. This walkthrough preserves those files and creates separate working copies. It is an integration demonstration, not a benchmark score or evidence of employer submissions.

## Start an isolated copy

Install the README dependencies. For Interview, set `INTERVIEW_PYTHON` to the absolute executable in a Python 3.12 environment with the Interview requirements installed. The server and its child processes must inherit that setting. Actual context/planning/practice nodes also require the configured Codex CLI login and network access.

```text
npm run demo:alex -- --dir <new-absolute-workspace> --snapshot review --port 8774
```

The directory must not exist. `APPLICATION_RUNNER` must be unset or `demo`. Open the printed Review URL in Codex's in-app Browser. A separate new directory with `--snapshot shortlist --port 8775` shows the original five-role shortlist without applications. Neither command performs live research or verifies current vacancy availability; the saved public references retain their historical dates.

1. Read all five original cards: Nooks, Adobe, Western Digital, Scale AI and Palantir. Keep role-specific questions and caveats visible.
2. Verify Nooks cannot be approved until its relocation choice is answered. Choose an explicitly fictional answer for this rehearsal. Adobe has no additional required question. Approve these two cards.
3. Edit a WD answer, wait for Saved, reload and check persistence; restore the original wording. Leave its unknown required location unanswered. Keep Scale's cohort caveat and required relocation question; leave Palantir's unknown school/travel details unanswered. These three remain pending.
4. Click **Submit applications (2)** once. Verify the two saved tasks finish in `demo_complete`. This is a local task rehearsal and does not submit to either employer or independently create real submission evidence.

## Continue into Interview

The following command deliberately adds an **authored fictional post-submission checkpoint** after those two completed local tasks:

```text
npm run demo:alex:interviews -- --runtime-dir <same-absolute-workspace>
```

It requires the byte-identical canonical fictional Alex profile, all five original role IDs, exact approved snapshots and completed demo submission tasks for Adobe and Nooks. It refuses an existing interview registry. It records its source task IDs and clearly fictional receipt files, then uses lifecycle and Interview APIs to create three staged runs: a completed Adobe recruiter round, a future Adobe technical round and a future Nooks recruiter round. The other three opportunity records stay unchanged. These injected receipt/round records are not Gmail observations, employer confirmations, or proof that the task runner submitted anything.

The command writes `data/interviews/runs.json` and stages workspaces; it makes **zero model or Google calls** and does not approve plans. Fixed October/November 2026 dates are a recording fixture; select appropriate fictional dates in a new fixture when recording later.

For each future round, follow [context preparation](interview-context-preparation.md): capture the staged canonical handoff, run context analysis, attach its validated context and generate a proposal. In a deliberately missing-JD test, label captured-only evidence and retain missing JD/company facts; this does not verify normal online enrichment. Publish each run with `interview:track publish`, using `<workspace>/data` as its `--runtime-dir` and the current expected registry revision.

Open `/interviews`. Before acceptance, Practice must contain no generated pack. Read and approve the Adobe technical plan through the actual website button; verify one job becomes ready and its coding answers include executable Python and passing examples/tests. Leave Nooks awaiting acceptance to demonstrate the gate. Do not manufacture human approval; website actions on these synthetic rounds record `synthetic_test_script`.

For the completed Adobe round, save explicitly synthetic raw debrief text and source-linked observations through the debrief API, using `origin=synthetic_test_script`. Publish that separate completed workspace and verify the Debrief page. Do not describe an authored debrief as an actual interview or model-generated feedback. No account memory binding is established by this fixture.

Restart the same candidate with `npm run review -- --runtime-dir <workspace>` and use its printed URL; recovery can choose a new port. Stop the service gracefully before restarting. Windows abandoned owner locks fail closed and require verified manual recovery; do not delete arbitrary lock files or reset the candidate.

## Verification and recording scope

On 2026-10-31, the original Shortlist/Review copies, five review cards, required-answer gates, edit/save/reload, two actual local demo tasks, three linked/staged rounds and two actual Codex calls (analysis and proposal) for each future round were exercised. The four analysis/proposal invocations completed on their first attempts. The website-generated Adobe pack contains eight main/alternative questions within the approved 60 minutes. Its two coding solutions passed 19 declared/independent tests combined. Nooks remained unapproved with no materials or generation job. The completed Adobe round displayed its explicitly synthetic raw debrief and attributed observation.

The first practice attempt failed validation because it used `startswith`, outside the existing bounded Python execution subset. The actor prompt now lists callable built-ins and methods directly from the validator's allowlists; the validator was not relaxed. An explicit website retry completed in 74.734 seconds and retained the failed attempt and the same exact approval. This is a diagnosed repair plus retry, not first-attempt success. Generated semantic quality remains unrated; passing schema/source/budget checks is not a human evaluation result.

The companion Windows repair validates actual private DACLs rather than POSIX mode bits, uses native executable fake-CLI tests, Windows directory junctions for applicable path tests, and bounded sharing-violation retries for exclusive locks. Unknown/foreign/abandoned lock ownership is never automatically removed. The unchanged UI v30, boundary and distribution checks remain mandatory. Windows skips exactly three inapplicable POSIX-only probes: a FIFO and two macOS `shlock` cases; Windows lock/concurrency/security tests execute.

Run `npm run verify`, `npm run interview:test` and `npm run interview:virtual-tests` before recording. Virtual mailbox/calendar tests exercise adapters without Google accounts. This Alex recording does not establish live Gmail delivery, live ATS completion, current online job availability, end-to-end matching quality or preparation quality across candidates. Keep local runtime databases, model outputs, connection state and screenshots outside Git.

Validation for this repair: `npm run verify` passed 47 test files, 497 tests, three platform skips, typecheck, unchanged UI v30, boundaries and distribution checks. The full Python suite passed 274 tests before the final prompt-contract repair; all 14 practice-related tests passed after that repair, including its added regression case. Ten scripted virtual-mail scenarios passed with zero model/Google calls; these validate routing infrastructure, not classifier accuracy. Original `examples/` files were unchanged. Private per-attempt reports and browser screenshots remain in the selected local recording output.

## Normal-start rehearsal — 2026-10-31

Run `npm run interview:setup` once before the demo. Start normally and choose the existing fictional example on Welcome. Example application preparation and submission execute locally even when this chat is connected; they do not wait for live browser execution. Select the saved Nooks and Adobe roles, answer the required review questions, approve each exact draft and submit the local rehearsal. The guarded `demo:alex:interviews` checkpoint may then stage fictional invitations in that same isolated workspace. Reuse it once created; never replace the user's working case or treat its synthetic receipts as real submissions.

Interview requests retain the demo mode in their host prompt and require local-only handling. Share invitations, preparation requests and debriefs through the website. The connected Codex chat handles the owning domain tools and returns results to that page. Preparation still requires the exact current Plan approval before model-backed Practice generation. A failed generation is retained and needs explicit retry. Existing preauthored checkpoints and fresh model output must be described separately. This is a local product rehearsal; real employer forms, Gmail and Google Calendar are outside its scope. See the [current verification report](interview-current-integration.md) for observed results and limits.
