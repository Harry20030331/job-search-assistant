# Workbench v2 verification

Date: 2026-10-26. Local implementation; team review, merge and independent material-quality ratings are pending. This supersedes current UI observations in the preserved [v1 note](interview-workbench-verification.md).

## Requested behavior and browser observations

The user reported missing Harbor preparation, context-free practice and missing homepage/account navigation. An isolated `local/interview-preview-v2-20261026` preserves the original preview directory. Initialization creates authored fictional plans and simulation packs for all three cases, using explicitly synthetic approval provenance. Harbor includes a reconstructed 60-minute SWE plan and its debrief. This is not evidence of historical human approval.

The in-app Browser verified Home, Status, Review, Interviews and Google account navigation on one server; Harbor Plan/Practice; the generated DS scenario with assignment, counts, observation window, decision and follow-ups; and the distinction between Plan and Practice. Answer guides are collapsed initially. Status still shows the three stable applications as Interviewing. At a 390 x 844 responsive viewport, Home's document and scroll widths were both 375 pixels; the temporary viewport override was reset. Final service uses port 8767 with the v2 runtime. Screenshots are private artifacts under the parent workspace's `runs/interview-ui-v2-20261026/`.

Google account status displayed Ready to connect. Clicking Connect Google reached Google's account chooser for this application with Gmail read-only and owned-calendar event scopes, PKCE and the fixed loopback callback. The human still chooses the account and grants consent. No real mailbox import or calendar write was performed in this exercise. The existing developer client is explicitly selected from a private directory; credentials were neither copied into fixtures nor rendered. Local session sign-out preserves the saved provider grant. Mocked tests exercise callback replay, state/browser isolation, CSRF, origin checks and fixed authorization destinations. They do not prove a fresh successful provider callback before human consent.

## Actual Codex generation

Private artifacts remain under parent-workspace `runs/practice-v2-live-20261026/`:

| Attempt | Observed result |
| --- | --- |
| `ds` | First attempt timed out at 300.188 seconds after a transport disconnect (Windows 10054); no accepted material |
| `ds-network-retry` | Separate identical retry, material ready, 47.532 seconds, 16,958 input / 5,174 output tokens |
| `swe` | Material ready, 57.250 seconds, 16,941 input / 4,961 output tokens |

Both successful calls used the existing configured Codex model, one CLI invocation and zero shell commands each. The accepted packs are stored in the corresponding preview business runs and displayed by the page. OpenRouter was not called. Original failed artifacts and authored initialization provenance remain separate.

Mechanical gates passed, semantic quality remains `pending_unrated`. Inspection found DS customer-level randomization and aggregate appointment counts with repeated-customer uncertainty, plus correct 72%/75% point estimates. SWE supplied a function contract and worked boundary examples, although its size limit remained implicit and the variable-duration reservation conflict rule needs a clearer persistence constraint in a future quality revision. These are development observations, not an independent rating, a held-out comparison or proof that the new format meets every quality dimension. Do not transfer old baseline scores to v2.

## Automated checks

| Check | Actual result |
| --- | --- |
| Python unittest discovery | 222 passed |
| Full TypeScript suite, four workers | 370 passed, 37 failed, zero pending; 407 total |
| Targeted application views/server/workbench/account/CLI checks | 84 passed |
| TypeScript typecheck | Passed |
| Structural boundaries and distribution scan | Passed |

The nine new Python tests cover all-three-case completeness, exact budgets, approval gating, new protocol generation and OAuth isolation/security. Four new TypeScript tests cover shared navigation, account rendering, safe unconfigured routes, cross-origin rejection and explicit developer configuration. Full-suite failures remain in existing Windows/POSIX permission, recovery, symlink, lock-helper and path-fixture categories; none were skipped or weakened. JSON results are private `runs/interview-ui-v2-20261026/typescript-results.json`. The historical v1 report remains intact.

The user-directed v2 UI manifest preserves v1 and freezes the reviewed implementation differences. It records local implementation verification, not completed user/team approval. Automated tests do not establish model quality, unattended inbox operation or production authentication.
