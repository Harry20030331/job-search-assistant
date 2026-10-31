# Virtual testing development results

Date: 2026-10-30. Model: configured `gpt-6-luna` / high, Codex CLI 0.163.0. No real Google requests or OpenRouter judge requests were made. These are fictional development checks; labels await independent human review.

| Check | Result | Scope |
| --- | --- | --- |
| Virtual Gmail/Calendar infrastructure | 12/12 checks | Actual adapters with scripted transport responses and host actions |
| Scripted mail scenarios | 10/10 | Classification supplied by evaluator; not model accuracy |
| Real Codex mail classification/routing | 10/10 scenarios | Invitations, availability, changes, cancellation, rejection, ambiguity, HTML, missing zone and embedded instructions |
| Raw model interview association | 10/10 | Before the host's unique-thread override |
| Historical W12 agent lifecycle | 0/1 | Final next-session proposal failed source-reference validation |
| Existing Python regression | 239 passed | Complete suite before adding the new evaluator controls |
| New evaluator negative controls | 3 passed | Wrong prediction, invalid evidence and virtual unread-state isolation |
| Related TypeScript regression | 60 passed | Interview workbench/reminders, Review server and shared views |

The ten mail cases share one employer/role context and were run as disjoint batches of six and four, each preserving its first attempt. They are not ten independent job stories or an independent holdout. All ten used their own virtual mailbox/database and the ordinary MIME parser, inbox sync/worker, triage validator and route handler. Together the ten classifier invocations took 107.297 seconds summed model invocation time, with a median of 11.258 seconds. Virtual calendar actions were host-scripted and do not measure model schedule extraction. Infrastructure checks repeated across batches are still twelve distinct checks, not thirty-six independent tests.

## Retained lifecycle failure

W12 used the existing `simple-instruction-v1` local baseline, simulated clock/calendar and historical outline preparation format. It executed scheduling, an accepted preparation proposal/material pack and debrief extraction, then failed on next-session planning. The model returned source ID `invite: <s01@example.invalid>` instead of the available `invite`. Exact source validation rejected it with `Proposal references unavailable or inactive sources`. The six model invocations took 236.265 seconds for the episode. The result remains 0/1 end-to-end success; no output was repaired or substituted and no guard was relaxed.

The canonical source-ID catalog has subsequently been implemented and separately verified; see [the repair record](interview-source-reference-fix.md). The original result above remains unchanged. Current context-aware direct-question preparation and website approval have a separate [integration verification](interview-web-actions-verification.md); W12 should not be represented as a run of that newer method. Cancellation/logistics/ambiguous mail remains pending review rather than automatic calendar deletion or editing. OAuth consent, actual Gmail/Calendar transport and production quotas still belong in a small separate real-account smoke test.

## Reproduce

Use [the virtual-testing commands](interview-virtual-testing.md). Private originals are preserved in the developer's ignored run directories:

- `virtual-mailbox-v1-scripted-20261030`
- `virtual-mailbox-v1-codex-20261030`
- `virtual-mailbox-v1-codex-remaining-20261030`
- `virtual-mailbox-lifecycle-W12-20261030`
- `virtual-testing-review-20261030`

Their manifests, `.eml` fixtures, snapshots, actual model events, SQLite state and first-attempt results support the numbers above. Monetary cost is unavailable and is not inferred from subscription usage. No credentials or real user mail/history are included in the committed fixtures or this report.
