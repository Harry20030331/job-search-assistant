# Preparation semantic pilot: submitted ratings

Date: 2026-10-26. Protocol: `preparation-semantic-v1.1`. This records the first submitted six-dimension ratings for the five policy-v1.1 development artifacts. It is separate from the historical four-dimension workflow pilot and from the five invalid free-quote v1 judge responses.

## Import and provenance

The user returned a five-column CSV (`sample_id`, `dimension`, `score`, `evidence`, `reason`) in the project chat after being asked to rate the current pack. All 30 unique sample/dimension pairs match this pack exactly; scores, evidence and reasons are complete. The strict comparison command initially rejected the CSV because pack fingerprint and rater alias were absent.

A separate explicit import adapter preserved the original bytes, added only the verified pack fingerprint and the host-assigned submission alias `user-submission-20261026`, and checked that all five original fields remained identical after a CSV round trip. The ordinary strict comparator then accepted the bound copy. Its original validation rules were unchanged. This alias identifies a submission, not a verified person; human authorship, independent rating and absence of prior judge exposure have not been independently established.

Original SHA-256: `6ec8132addb281d4458170b4dd098bc31e8ff92470f1779e1d3ae0e0e8ed8490`.

Pack fingerprint: `6a98c82e155f2ee846f1c9c633647b8029cf088a63b87f10705b01097f1b284f`.

Private receipts are under `preparation-semantic-v1.1-review-20261025/human-review-import-20261026/<original-sha256>/`: unchanged original, bound ratings, import provenance and comparison. The comparator also retains its usual content-addressed comparison receipt. No model call, output regeneration, score change or rubric revision occurred during import/analysis. Frozen manifests and earlier pending-status execution receipts remain historical snapshots; this report records the later submission.

## Observed agreement

There are five artifacts from two source stories: four proposals (two per method) and one predeclared guided-method materials audit. Thirty dimensions are correlated observations, not 30 independent cases.

| Dimension | Exact agreement | Mean absolute error (0-2 scale) |
| --- | ---: | ---: |
| Evidence fidelity | 5/5 | 0.00 |
| Role/round focus | 4/5 | 0.20 |
| Coverage | 5/5 | 0.00 |
| Level/depth | 5/5 | 0.00 |
| Actionability | 5/5 | 0.00 |
| Workload feasibility | 4/5 | 0.20 |
| All dimensions | 28/30 (93.3%) | 0.0667 |

The judge assigned 2 to all 30 dimensions. The submission assigned 2 to 28 dimensions and 1 to two. A constant-2 predictor would obtain the same agreement. This observed ceiling and sparse disagreement do not establish sensitivity to poor work, reliable severity grading or a validated judge. Do not combine these numbers with the old rubric's 80% agreement.

## Disagreements and source checks

Both disagreements concern sample `Q-1f6981872476`, C03/simple-instruction-v1's 20-minute recruiter/HR proposal.

1. **Role/round focus: submitted 1, judge 2.** The invitation explicitly says a recruiter/HR conversation with no planned live coding. The proposal's project-discussion section is correctly framed as conversational, which the judge recognized, but its focus labels are `coding, sql, system_design`. The exact JD supports early-career API work, testing, basic database knowledge and learning reliability; it does not establish SQL-specific or architecture assessment in this round. The submission penalizes the stronger labels despite the prose qualification. This is a meaningful label/prose inconsistency to probe, rather than evidence that the proposal actually scheduled a live coding interview.
2. **Workload feasibility: submitted 1, judge 2.** Six minutes cover API validation, tests, database familiarity and reliability learning, while three more cover availability and interviewer questions. The judge reason cites the correct 6+5+6+3 minute sum and broadly plausible blocks; the submission questions the density within those blocks. The disagreement motivates finer task-load checks, but neither label alone proves how long a candidate would need.

The C08/simple proposal's submitted evidence-fidelity note asks whether `preparation-context` is an allowed source alias. The existing shared prompt explicitly permits it, and `available_refs()` accepts the raw source IDs plus this derived-context alias. It is a valid contract reference, not an invalid raw-source ID. Its presence still does not turn derived analysis into independent evidence or authorize unsupported claims. No score was changed for this note.

Submitted ratings for C03's guided proposal/materials and both C08 proposals are all 2. There is no paired baseline materials sample, so this audit cannot compare materials methods. With only two inspected development stories, the C03 proposal difference is an observation, not a measured causal improvement or population performance estimate.

## Next experiment

Preserve these first scores. Use the two disagreements to draft explicit checks for focus-label/prose consistency and task density in a future rubric version, then freeze that version before new evaluation outputs. A rule can flag a potentially mismatched technical tag for review; it cannot infer a semantic failure from a keyword alone. Workload review should enumerate expected deliverables and rehearsal repetitions, not merely add minutes.

Add separate development challenge cases with clearly poor, partially useful and strong outputs, including inconsistent labels, overfull short blocks, unsupported certainty and weak preparation exercises. Keep controlled variants clustered by their original story. Obtain independently instructed ratings where possible; record original ratings and any later adjudication separately. Evaluate sensitivity to known defects and agreement by dimension before trusting an overall percentage. Broader frozen story comparisons and live evidence enrichment remain separate workstreams.

The current judge remains unvalidated. No prompt or production method was changed as a result of this import, and no holdout result is claimed.
