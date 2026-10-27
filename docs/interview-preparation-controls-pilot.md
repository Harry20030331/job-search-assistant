# Preparation judge controls: development results

Date: 2026-10-26. Protocol: `preparation-quality-controls-v1`; unchanged semantic rubric `preparation-semantic-v1.1`. All 12 OpenRouter responses completed and passed the evidence/reporting contract. The judge was `anthropic/claude-opus-4.7`, provider `anthropic`, under the preceding pilot's frozen settings. No agent model was called, and no agent/judge prompt or expected label was tuned during this run.

## Results against developer expectations

| Target/story | Expected strong / partial / severe | Observed strong / partial / severe |
| --- | --- | --- |
| Round focus / QC01 | 2 / 1 / 0 | 2 / 1 / 0 |
| Workload feasibility / QC02 | 2 / 1 / 0 | 2 / 1 / 0 |
| Evidence fidelity / QC03 | 2 / 1 / 0 | 2 / 0 / 0 |
| Material actionability / QC04 | 2 / 1 / 0 | 2 / 1 / 0 |

- Exact target-anchor match: 11/12 (91.7%). A constant-2 predictor matches 4/12 (33.3%). These are matches to developer expectations, not human-validated accuracy.
- Intended defect detection (target score below 2): 8/8; intended severe outputs scored 0: 4/4.
- Intended strong controls retained target score 2: 4/4; no serious-error flags on these four.
- Strict strong > partial > severe ordering: three of four stories; the evidence story ties partial and severe at 0.
- The fabricated-impact/exact-question-guarantee case received both predeclared fabrication and unsupported-certainty flags. This is one case, not a broad recall estimate.

All six dimension vectors and reasons are retained; only the predeclared target has a scored developer anchor. Four source stories and correlated variants do not provide 12 independent tasks or 72 independent quality judgments. Coverage, seniority/depth and technical correctness have no isolated target probe in this version.

## What the results establish

The unchanged judge can assign lower scores when deliberately supplied clear defects. It recognized coding/SQL/design tags inconsistent with qualified HR prose, short-block overload, time repetitions impossible by construction, fabricated candidate impact and generic materials without usable exercises. Thus the earlier natural-output pilot's all-2 vector does not establish that the judge always predicts 2.

This does not resolve the earlier two natural-output disagreements. The controls use clearer, deliberately constructed defects and different text; there was one call per artifact. Sensitivity to wording, stochastic variability, subtle natural defects and actual user preparation time remains unmeasured. The 91.7% and earlier 93.3% figures have different denominators and reference labels and must not be treated as a before/after improvement.

## Preserved severity disagreement

Sample `Q-2cb9d058f5e3`, QC03/`minor_unsupported_fact`, contains otherwise grounded practice material but asserts that Cedar Analytics is known for weekly learning lunches. The original fictional company source supplies values and says social activities are undocumented.

The frozen developer expectation was evidence fidelity 1 for a minor unsupported claim. The judge assigned 0 and flagged fabrication. Its reason describes the assertion as contradicting the source. The source actually establishes lack of support, not proof that lunches do not occur. Whether this isolated noncentral assertion warrants 0 or 1 depends on the rubric's materiality boundary and needs independent review. Neither the developer label nor the judge becomes adjudicated truth from this result. Both original labels and the first response are preserved.

Do not silently change the expected label to produce 12/12 or automatically soften the judge. A future rubric can clarify minor unsupported facts versus material fabrication, with explicit examples, but must be separately versioned and evaluated on new cases. These controls then remain development data.

## Execution and reproducibility

Frozen pack fingerprint: `5f0e570a172f0b16c3b457b94a16d31c88d17f4f369a89e64f4238d8e1277d00`.

The first private directory, `preparation-quality-controls-v1-20261026`, retains two network-failure receipts, an interrupted execution and a diagnostic report with zero scored outputs and missing scores represented as null. The interruption may have left a transport attempt without a completed receipt; no zero-cost or no-charge inference is made from absent usage.

The separate directory `preparation-quality-controls-v1-network-retry-20261026` reran with network-enabled execution permissions. It has exactly the same frozen pack fingerprint and identical review-page bytes. All 12 responses in that run were valid and retained; no scored response was replaced. API usage for those 12 responses was 76,777 prompt tokens, 11,028 completion tokens and USD 0.659585 as reported by OpenRouter. Initial failed transport usage was unavailable and is not added as an invented zero. No Google, calendar, email, shared application or ordinary candidate state was accessed or changed.

Verification: 181 Python tests passed, including seven new controls-mechanics tests. Type checking, structural boundaries, distribution scan, fixed UI contract and whitespace checks passed. The human review script passed a static syntax check; identical page hashes bind that check across the network retry. Browser interaction/visual/persistence verification was not performed under the existing local-file navigation policy. The full upstream TypeScript test suite was not rerun; its existing Windows writer-test limitation remains separate.

Actual runtime remains Python 3.12.14/Pydantic 2.14.1, differing from the declared Pydantic 2.13.5 lock. Runtime and input/implementation hashes are recorded; do not call this an exact lock reproduction. The human review form remains blank, and no independent human calibration or held-out performance is claimed.

See [protocol and commands](interview-preparation-controls.md). The next evaluation work is independent review of the severity boundary and new natural outputs under a frozen rubric, including coverage/depth/correctness defects. These observations alone do not justify a method-win claim or a different agent harness.
