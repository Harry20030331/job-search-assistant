# Candidate learning integration observations

Client date: 2026-10-26. One fictional development integration, not a held-out benchmark, memory ablation or independently rated preparation result. No real account association was created.

## Setup and first attempts

Private artifacts are retained under the parent workspace's ignored `runs/candidate-learning-v1-20261026/`; the private driver is `runs/candidate-learning-pilot-20261026.py`. The manifest freezes selected/excluded note IDs, source/configuration snapshots and the two intended node calls before model execution. It records that historical reports and derived notes were authored fixture data committed through the debrief API; model extraction of a debrief was not tested by this exercise.

The driver exercised the actual TypeScript `interview context|stage` commands with a v3 candidate descriptor and shared profile/experience sources. It reused C08's fictional company/JD/invitation, with a new interview ID, 50-minute budget and explicit priorities. This remains inspected development evidence. The candidate has a classifier-comparison/error-analysis project; clinical deployment, healthcare employment and personal motivation are not established.

The fictional account contained six observations: an active success/guardrail/stop-decision gap, an active scoped primary-versus-diagnostic-metric improvement report, a different-role report, a conflicting HR-round report, a superseded randomization-unit observation and its resolved successor. The host declared a synthetic candidate/account link and selected `experimentation`/`product_metrics`, age 180 days, limit five. Read-only retrieval selected exactly the two expected active relevant notes. Capture included their original reports and derived observation provenance as `practice` sources.

| Actual first attempt | Status | Seconds | Input / output tokens | Commands |
| --- | --- | ---: | ---: | ---: |
| Context analysis, `context-guided-v1`, protocol v1.2 | `context_ready`, mechanical pass | 18.672 | 16,532 / 1,547 | 0 |
| Preparation proposal, `context-balanced-v1`, protocol v1.1 | `awaiting_plan_approval`, mechanical pass | 15.828 | 17,638 / 1,711 | 0 |

Both calls used the existing configured Codex CLI 0.163.0, `gpt-6-luna` with high reasoning. There were no automatic retries, separate AI service calls, approval decisions, full materials or Google operations. Subscription cost is unknown. Runtime manifests record Python 3.12.14/Pydantic 2.14.1 versus declared Pydantic 2.13.5; exact dependency-lock reproduction is not claimed.

## Observed reuse and limits

The analysis treated both retrieved observations as scoped self-assessment reports, explicitly withholding independently verified ability and global mastery. The proposal cited the gap in a 15-minute experiment-design/stop-decision block and the improvement report in a 15-minute product-metric block. It also allocated 10 minutes to introduction/motivation reflection, 7 to a truthful behavioral example, and 3 to candidate questions. Total allocation was 50 minutes. It followed the invitation's experimentation/product-metrics scope rather than substituting the modeling JD's model-implementation topics.

The local audit verified selected source IDs were used, original canonical and account database bytes were unchanged, no full history/memory tables were imported into the work store, and no approvals/materials were created. This audit checks identity, persistence and source access; citations alone do not prove useful or truthful reuse. Developer inspection found the guardrail rehearsal and limited improvement wording appropriate for this fixture. No independent semantic rating was collected. One analysis citation for product-metric focus quoted the invitation's exclusion of model implementation rather than its direct positive product-metric statement; the full source supports the claim, but that excerpt is weak evidence for it. The mechanical validator does not establish excerpt entailment, realistic workload or preparation quality.

There is no matched no-history/raw-history baseline here, so neither the two passes nor the adapted blocks establish a memory benefit. The selector conservatively uses exact normalized roles/topics and known-round compatibility, which can miss relevant title variants or transferable cross-round learning. It scans the account records and conservatively invalidates on any content update; scaling and selective invalidation remain open. See [the implementation contract](interview-learning.md) for scope and future comparisons.

## Verification

The complete Python contract suite passed 207 tests (194 previous plus 13 new candidate-learning tests). The targeted learning suite also passed after adding a binding-mutation assertion. Five TypeScript handoff tests, typechecking, dependency/boundary checks, the fixed UI contract, distribution privacy/language checks, skill validation and `git diff --check` passed. These are local operational checks; neither the upstream Windows file-lock limitation nor a full cross-module end-to-end study was resolved by this change. Existing reviewed benchmark labels, raw failures, semantic scores and judge-control artifacts were not overwritten.
