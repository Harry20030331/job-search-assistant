# Evidence enrichment: protocol and live integration observations

Date: 2026-10-26. These are development checks of `interview-enrichment-v1`, not a frozen research benchmark or automatic end-to-end email workflow.

## Offline protocol checks

All eight fictional scripted scenarios passed the identity/selection/budget/canonical-state checks: exact official JD, closed exact JD, same-company analogue, other-company analogue, no usable result, conflicting requisition, wrong-role near match and injected text. The first run is retained as `enrichment-protocol-v1-20261026`; the final implementation-snapshot run is `enrichment-protocol-v1-verified-20261026`. The latter records dataset/implementation hashes and runtime versions.

There were zero model, live-browser or Google calls in these checks. Scripted host decisions are supplied by the runner; this is not 8/8 agent retrieval success. The injection case verifies that source instructions do not execute or mutate identity in the code layer, not that an LLM cannot be influenced. Independent semantic role-matching, missing-evidence and live-site robustness tests remain necessary.

## Separate public-page integration

The private `enrichment-live-20261026` run combines an explicitly fictional candidate/invitation with a separately selected public requisition. It does not reuse the user's real invitation, assert that a new requisition matches an older interview, create an application or alter Gmail/Calendar data.

Two actual in-app Browser sources were captured as selected visible excerpts, not complete archived pages:

- [Selected Quora new-grad ML requisition](https://jobs.ashbyhq.com/quora/40659fe7-545e-4b08-b6d7-2567b18b9ed3), bound by exact URL and visible company/title.
- [Official company page](https://careers.quora.com/company), on the careers host linked by the selected requisition.

The active Codex chat executed the reserved search and browser actions, constructed their receipts and used the Python state API. Session usage was one search and two page capture/read actions. Preflight selection involved one additional public search and one requisition preview; those are recorded outside session counters. One reserved JD read reused the already-open tab without reloading. These are bounded session counters, not an assertion that the entire development turn used only those actions.

The final request has an exact-role JD and official company context with source URLs, timestamps, content hashes and relationship labels. Search snippets contributed leads only. The host verified the official careers scope from the visible employer link; scope/ownership provenance remains a host assertion, not a cryptographic proof. No secondary browser engine, HTTP page fetcher or hidden ATS endpoint was used.

## First downstream failure and explicit new protocol

The first real Codex context call completed under `context-analysis-node-v1.1` but failed the existing citation validator. Its first candidate link mixed a literal candidate fact with a possible JD connection and labeled the whole statement confirmed while citing both candidate and JD. The validator correctly rejected it. Raw output, prompt, source token and error remain in the run's `analysis/` directory.

The common prompt for both context methods was clarified in `context-analysis-node-v1.2`: confirmed literal candidate facts cite candidate sources only; proposed candidate-to-role/company fit is inferred and cites both anchors. The validator and source inputs were unchanged. A separately retained call under `analysis-contract-v1.2/` passed, using exactly the same request token. This is a developer prompt correction and supplemental run, not a rerun silently replacing a failure or evidence of a method gain.

The validated context was attached to the same fictional work using existing identity/fingerprint checks. A real Codex proposal call then passed under the existing preparation protocol and awaits exact plan acceptance. It allocated 8 minutes to introduction/motivation, 7 to a bounded project story, 20 to evaluation/experimentation/failure analysis, 7 to a qualified design discussion and 3 to interviewer questions. The design block is suggested practice from the JD, not an employer-confirmed interview topic. Motivation, specific round topics and unprovided candidate skills stay unknown. No approval or full materials were fabricated.

| Invocation | Protocol | Result | Input tokens | Output tokens | Seconds |
| --- | --- | --- | ---: | ---: | ---: |
| First context | v1.1 | Retained validation failure | 15,732 | 2,114 | 26.891 |
| Explicit supplemental context | v1.2 | Context ready | 15,798 | 2,376 | 26.688 |
| Proposal | preparation v1.1 | Awaiting plan approval | 17,288 | 1,750 | 23.843 |

All three invocations used Codex CLI 0.163.0 and the configured `gpt-6-luna`/high settings with zero command calls inside the inline model node. No OpenRouter/external-judge request occurred. Subscription dollar cost is unavailable, not zero. The proposal's semantic quality has developer inspection only; mechanical validity does not establish usefulness or realistic workload.

## Verification and remaining limits

The final Python suite passed 194 tests, including 12 enrichment tests and a new OAuth rejection regression. Type checking, boundary/distribution checks, fixed UI contract, whitespace checks and interview skill validation passed. Actual Python 3.12.14/Pydantic 2.14.1 remains different from the declared Pydantic 2.13.5 lock; no exact-lock reproduction is claimed. The full upstream TypeScript suite was not rerun; its existing Windows writer-test issue remains separate.

An earlier full run failed an existing OAuth CSRF/origin test with Windows connection abort 10053. The handler rejected a POST before consuming its body; closing a connection with unread bytes can reset it instead of delivering the 403. The handler now reads only a bounded, framed body with a three-second socket timeout before the existing Host/Origin/session/CSRF decisions. Chunked/ambiguous lengths are rejected. Six targeted OAuth tests and the final full suite passed, including repeated invalid-origin requests that must not start OAuth. This addresses a plausible transport cause; it does not prove all host-software/network aborts are eliminated.

Research requires an active Codex chat with available search and in-app Browser tools. It is not a portable unattended Python search daemon, global research quota, verified employer-ownership oracle, formal retrieval benchmark or complete inbox-to-application integration. Reports/receipts are available for review; historical failures, pending approvals and earlier experimental scores remain unchanged.

See [workflow and receipt contract](interview-enrichment.md). Next work remains broader natural-output evaluation, source-scoped debrief reuse and the separate account/canonical-candidate/lifecycle integration.
