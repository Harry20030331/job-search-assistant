# Interview workbench verification

Historical v1 observations below are preserved. Current user-requested navigation and simulation changes are documented in [v2 verification](interview-workbench-v2-verification.md).

Date: 2026-10-26. Local feature branch only; these checks do not establish a completed team merge, unattended Gmail workflow or improved agent quality.

## Actual preview

The isolated authored preview was created at the checkout's ignored `local/interview-preview-20261026/` and served on `http://127.0.0.1:8767/interviews`. All three existing synthetic applications were advanced through the shared lifecycle API before canonical handoffs were staged. Their stable job/application IDs were preserved. The workbench published fresh run pointers and read actual proposal/approval/material/debrief tables through the bounded exporter.

The in-app Browser visibly verified:

- A 50-minute technical outline with introduction/motivation, project story, experiment design/guardrails, product metrics and interviewer questions, awaiting chat approval.
- A 20-minute recruiter outline with a declared synthetic plan acceptance; expanding practice materials displayed the actual stored prompt, steps, answer structure and self-check.
- A completed round with the unchanged original self-report, separately labeled self-assessment and suggested next practice.
- The same three applications displayed as Interviewing on the existing Status ledger.
- Desktop layout at 1280 x 900 and narrow layout at 390 x 844. The narrow page had a 375-pixel document width within its 390-pixel viewport, with horizontal card scrolling contained in the sidebar. Temporary viewport overrides were reset.

The page was reloaded after the server restarted to correct approved-plan messaging. The screenshot artifact is retained in the parent workspace's ignored `runs/interview-ui-20261026/preparation-desktop.jpg`. This preview uses authored fictional content and synthetic evidence, not a model-generated benchmark result. The preview manifest records zero model calls, Google calls or human approvals; one synthetic approval record enables the recruiter material view. No real account, candidate, application or calendar was modified.

The original Status/Review renderers, navigation and projection remain on the original v1 hashes. The new Interview page links to them on the same server; it is itself opened by its announced URL. No frozen renderer was rewritten and no baseline was refreshed.

## Tests and limitations

| Check | Actual result |
| --- | --- |
| Python suite after final debrief identity/raw-report checks | 213 passed |
| Targeted TypeScript lock/workbench/handoff/server-argument files | 18 passed |
| Full TypeScript suite, four workers | 366 passed, 37 failed, zero pending; not a green whole-repository result |
| TypeScript typecheck | Passed |
| Fixed UI contract v1 | Passed, unchanged hashes |
| Existing dependency/structural boundaries | Passed |
| Distribution privacy/language scan | Passed |
| Interview skill validation and whitespace check | Passed |

The ten new TypeScript tests (seven workbench tests and three native-lock tests) passed in the full suite. They exercise shared lifecycle updates, expected identity/revision, preservation of another application, cancellation without closing the application, reschedule invalidation, candidate/run binding, stale publication, escaping, read-only HTTP routes and independent-process lock serialization. Six new Python export tests exercise read-only behavior, current approval/material association, new-proposal isolation, raw debrief availability before extraction, historical subject compatibility, explicit account binding and revocation. Existing cases, evaluator labels and raw outputs were preserved.

The complete TypeScript JSON report is retained under the parent workspace's ignored `runs/interview-ui-20261026/typescript-results.json`. Failures involve existing POSIX permission/recovery expectations, unavailable Windows symlink privilege, `/usr/bin/shlock` and `/usr/bin/mkfifo` test helpers, and POSIX path fixtures. Those checks were not skipped or weakened. Earlier [upstream integration observations](interview-integration-check.md) independently recorded the same failure categories; the earlier 145-failure baseline is historical, and this change was not accompanied by a fresh unchanged-upstream comparison. Do not attribute the numerical difference entirely to a measured intervention or claim the full suite passed.

Windows now has a real cross-process mutation lock and native opportunity-path recognition. POSIX keeps its existing shlock behavior. Abandoned native Windows locks fail closed and require deliberate recovery; automatic stale-owner reclamation and POSIX-mode-equivalent Windows ACL validation are not implemented. The existing default recovery command may therefore still reject Windows mode bits. The tested preview service starts through the existing explicit-path server interface, without bypassing its default recovery checks. See [the workbench contract](interview-workbench.md) for exact launch/resume flags.

The new registry and shared lifecycle use separate transactions, so publication order and safe retries matter. Whole-opportunity-file freshness remains conservative. The new page is a read-only view; actual mail association, plan acceptance, source refresh and debrief input remain host-orchestrated in Codex chat. Continuous inbox routing, whole-site navigation integration and formal end-to-end evaluation remain pending.
