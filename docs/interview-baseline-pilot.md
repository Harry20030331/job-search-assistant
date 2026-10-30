# Interview workflow baseline pilot

Date: 2026-10-25. Protocol: `interview-workflow-v1`; method: `simple-instruction-v1`; agent: configured `gpt-6-luna` with high effort through Codex CLI 0.163.0. Judge: configured `anthropic/claude-opus-4.7` on OpenRouter. These are fictional developer episodes. The user has reviewed and kept the cases with an explicit W03 acceptance amendment; they are not a frozen test set or evidence of method improvement.

## Observed primary batch

The complete primary batch is named `workflow-v1-baseline-r2-20261025` in the selected private experiment directory outside the checkout. All 12 episodes were attempted. It recorded 27 model invocations with 27 distinct sessions and 883.0 seconds summed episode time. No real Google services were used.

| Module | Attempted | Completed protocol | Passed code checks |
| --- | ---: | ---: | ---: |
| Triage | 3 | 2 | 1 |
| Scheduling | 3 | 2 | 2 |
| Preparation | 3 | 3 | 3 |
| Debrief | 2 | 2 | 2 |
| Local lifecycle | 1 | 1 | 1 |

Nine episodes passed the recorded code checks. This is **not** a nine-of-twelve semantic task-success estimate: checks include common host gates, one failure is confounded by the simulator and another depends on node-status acceptance. Quality and human label review are separate.

The lifecycle episode created the exact local event after scripted confirmation, generated accepted preparation materials, preserved a practice debrief and generated the next proposal in a new model session. Audit records show raw-history reads after the debrief was available. This demonstrates mechanics and evidence access, not that memory improved preparation quality. Structured retrieval was disabled for this baseline.

All five prespecified quality artifacts were available and scored by the independent judge. They were hidden on the human form; the submitted human ratings have now been compared below. This small comparison does not establish a validated judge. OpenRouter reported $0.22939 total cost for these five results. Completed early scores were cached and reused by the final audit. Agent monetary cost is unavailable from the subscription CLI and remains null. Recorded primary input/output tokens were 2,489,239 / 42,928, including 2,016,512 cached input tokens as reported by the CLI; these are usage metadata, not a dollar estimate.

## Retained failures and harness findings

- **W02, association omission:** the model identified a recruitment update/rejection and safe record-only route, but omitted the existing interview link. This is a concrete association failure against the proposed labels.
- **W03, state-contract mismatch:** the model correctly recognized an ambiguous reschedule, left the target null and asked which interview. The strict runner expects a ready classification node and therefore recorded failure. The user explicitly accepted this response on 2026-10-25. A separate reviewed-criterion overlay records acceptance; the frozen gold, first result and original nine passing code checks remain unchanged. The next protocol must allow this evidenced clarification state for the ambiguity case.
- **W06, simulator-confounded budget failure:** after declining an event, the original simulator told a repeated confirmation question to show an action again. This conflicted with persistent rejection and contributed to a four-response budget failure. The first result is preserved. A separate `workflow-v1-decline-supplement-20261025` run with consistent rejection completed and passed, with no event write. Its four calls and 126.672 seconds are **not pooled** into the primary batch.

An earlier partial batch stopped at W05 when the simulator did not support a combined timezone/confirmation question. It is retained with an explicit interruption note; that interruption is not attributed as an agent task failure. The correction supplies known facts while withholding authorization until an exact action is shown. Earlier smoke runs under a repository ancestor are mechanics checks only, excluded from this primary batch to avoid project-instruction contamination. All development calls remain in their separate original logs.

## Human review completed and remaining work

The primary batch's `review/` contains the original review pack:

1. `case-review.html`: 12 scenario/label decisions (keep/revise/drop) and notes; export the CSV. W03's accepted node states and the persistent rejection expectation in W06 deserve explicit review.
2. `human-review.html`: five prespecified outputs, 20 blank dimension ratings and the common rubric. Score only after case definitions are acceptable, before opening judge results. The next-session output is an outline awaiting acceptance; rubric review should distinguish outline usefulness from full-material completeness.
3. `ratings-template.csv`, `START-HERE.md`, a rubric and an output/rubric-bound pack manifest. Browser save keys include the actual outputs to prevent a later run from inheriting old ratings. The original exporter pack is archived separately; no human ratings were populated or overwritten.

The user kept all 12 cases in chat and supplied a complete CSV for all 20 quality ratings. The import verified unique sample/dimension keys, valid scores and supporting notes against pack fingerprint `fff5352ec621`. The original CSV, its SHA-256, pack binding, per-row comparison and chat-based case decisions are retained in the private batch's `human-review-import-20261025/`. Original pack metadata still records its export-time pending state; import provenance is separate. No rating was auto-filled and no model was called for this comparison.

Human ratings total 36/40. Human and judge agree on 16/20 dimensions (80%); mean absolute error is 0.20 on the 0-2 scale. Specificity and grounding each agree on 5/5, actionability on 4/5, and constraints on 2/5. These correlated dimension rows are descriptive diagnostics, not 20 independent samples.

| Output | Dimension | Human / judge | Review issue |
| --- | --- | --- | --- |
| W08 revised materials | Constraints | 1 / 2 | A five-minute block can be overloaded despite an exact 20-minute total |
| W10 debrief | Constraints | 1 / 2 | Derived items need visible source/date traceability; inspect stored links separately from display completeness |
| W11 correction | Constraints | 1 / 2 | One self-assessed practice improvement should not imply global resolution |
| W12 next proposal | Actionability | 1 / 2 | Define proposal-specific anchors; full exercises belong after acceptance |

The human notes also flag a minor W07 unit error: 960,000 messages at 2 KiB each are 1.96608 decimal GB. Preserve the submitted score and original output; record the correction rather than silently editing the artifact.

The pilot has one submitted rater's scores and shared fictional contexts. Independent authorship and blinding are not established by CSV validation. Its five outputs are not five independent real-world stories. Reviewer corrections require versioned labels/rubrics and explicit regrading/reruns; first outputs are retained. A formal benchmark still needs broader independent contexts, rescheduling/cancellation/duplicate cases, reviewed success criteria, repeated runs and a planned multi-rater audit. No automatic calibration pass or causal component gain is declared. The next scope is defined in the [context-aware preparation plan](interview-context-plan.md).

## Implementation validation

The final full Python suite passed 120 tests, including eight workflow-pipeline tests and changed-output rating isolation. The TypeScript handoff tests passed 5/5 and type checks passed. UI v1, structural boundary and distribution checks passed. The unchanged upstream's previously recorded Windows failures remain separate from these module checks. See [the executable protocol](interview-workflow-benchmark.md) for reproduction and limits.
