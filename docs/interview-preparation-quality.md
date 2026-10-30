# Stage-aware preparation quality evaluation

Maintenance date: 2026-10-26. Implemented developer evaluation, protocol `preparation-semantic-v1.1`. It is separate from the historical four-dimension workflow rubric and does not relabel old scores. A callable judge and a working audit form do not establish a validated semantic evaluator.

## Success criteria

The evaluator scores actual preparation content against the original captured candidate/invitation/JD/company sources, current stage, preparation policy and budget. Supplied context analysis is model-derived organization, not independent ground truth. These six 0-2 dimensions are reported separately:

| Dimension | What success means |
| --- | --- |
| Evidence fidelity | Truthful candidate/company/role claims, honest uncertainty and correct attribution; no invented motivation/impact or actual-question guarantees |
| Role/round focus | Activities and emphasis match this round while using relevant role context; role responsibilities and current-round instructions stay distinct |
| Coverage | Required areas have substantive content; optional inclusions/deferrals are justified rather than nominal ledger labels |
| Level/depth | Scope, difficulty and ownership fit supported seniority and round; unknown level is explicit rather than borrowed from an analogue |
| Actionability | Proposal has concrete objectives/deliverables; materials have usable prompts, steps, answer structure and self-checks |
| Workload feasibility | Actual tasks plausibly fit each block and total time; exact minute sums alone do not establish feasibility |

The [frozen rubric](../src/interview/python/evaluation/rubrics/preparation-semantic-v1.1.md) has explicit anchors for 0 (materially incorrect/absent/unusable), 1 (partially useful) and 2 (well supported/useful). Proposal actionability does not require full questions, worked answers or checklists before acceptance. Materials are evaluated against their supplied approved plan. Honest reflection prompts can be appropriate when personal motivation is unknown. Required core coverage is a shared task policy, not an algorithmic gain.

Serious fabrication, wrong identity, incorrect guidance and unsupported certainty are recorded separately. Document quality does not prove actual external actions or authorization violations; operational evidence remains the code runner's responsibility. No threshold or aggregate score is treated as task success or a causal improvement.

## Pack and judge implementation

- `evaluation/preparation_quality.py`: independent six-dimension schema, bounded evidence IDs, validated judge results and immutable caches.
- `evaluation/preparation_quality_review.py`: complete artifact selection, normalized method-hidden packets, rater-specific forms, integrity validation and human/judge comparison.
- `evaluation/rubrics/preparation-semantic-v1*.md`: versioned reporting instructions and stage-specific scoring anchors.

Export selects every scheduled first proposal payload and only the materials audit declared in the planning manifest. Raw semantic artifacts remain eligible when host contract validation failed. Absent payloads are recorded as missing, never replaced with a better output or given an invented zero. The pack snapshots its rubric, schema, judge settings, exporter/judge implementation and source hashes. Its fingerprint binds actual outputs, selection, private mapping and artifact/story denominators.

Judge and human packets hide method/model metadata and random binding IDs while preserving source identities needed for factual assessment. The private index retains the mapping for later analysis. Previously inspected examples may be recognizable, so metadata hiding is not proof of independent blinding. Original pipeline results and human decisions stay separate.

The first v1 development judge used free-form exact quotes. All five responses were retained as invalid because at least one quotation was paraphrased or assigned to the wrong source. Those are judge-format failures, not agent task failures or zero semantic scores. The v1.1 reporting revision uses deterministic O-prefixed output spans and E-prefixed source spans, including explicit policy/approval sources. Per-packet JSON-schema enums constrain judge selections; code resolves IDs to captured text. The semantic scoring anchors are unchanged, with a regression check for that invariant.

An existing valid result is reused only for the same packet/rubric/settings/schema fingerprint. Invalid first responses are retained without automatic model repair; changed protocols use new review packs. The API request/configuration and returned usage are retained without serializing keys. Evidence IDs establish verifiable anchors, not that a judge's reasoning is correct; human calibration remains necessary.

## Commands and artifacts

After optional Python setup, from the repository root:

```text
npm run interview:preparation-quality -- export --pilot <absolute-planning-pilot> --output <absolute-new-review-directory>
npm run interview:preparation-quality -- judge --pack <absolute-review-directory> --judge-env <absolute-host-dotenv>
npm run interview:preparation-quality -- compare --pack <absolute-review-directory> --ratings <absolute-human-csv>
```

Export and comparison make no model/network calls. Judge uses the configured OpenRouter model/provider, reads only `OPENROUTER_API_KEY` from an optional host dotenv, and consumes API credits. No platform connector credentials or candidate-account tokens are inherited. The actor's prior model choices are absent from the judge packet. Judge scores and private mappings are not embedded in the human page.

`human-review.html` presents the sources, derived analysis, stage, task policy and actual artifact. Enter a rater alias, choose Load rater, score each dimension, and record evidence plus a reason. The human form uses ordinary excerpts/omission notes; JSON/evidence-ID instructions are for the automated judge. Each rater has a separate local save namespace bound to the actual pack fingerprint. No score is prefilled. Exported CSV rows contain pack fingerprint, rater alias, sample, dimension, score, evidence and reason.

The comparison rejects wrong-pack, blank, duplicate, out-of-range, mixed-rater and incomplete submissions. It verifies unchanged judge outputs, saves the original CSV under its content hash and reports exact agreement/MAE per dimension plus actual disagreements. It never edits ratings, regenerates outputs, makes judge calls or marks the judge calibrated automatically. Repeated independent raters can use separate aliases/files; alias separation alone does not establish distinct people or independence.

## Current developer audit and limits

The current export contains all four policy-v1.1 C03/C08 proposals and the predeclared C03 guided materials artifact: five artifacts, 30 dimensions, two source stories. These dimensions and repeated outputs are correlated; five artifacts are not five independent cases. The rubric was written after developer inspection. The first [submitted-rating comparison](interview-preparation-quality-pilot.md) is now available: 28/30 exact agreement and MAE 0.0667. All judge scores are 2; a constant-2 predictor obtains the same agreement. Rater independence and human authorship are not independently established, and the judge remains unvalidated. New six-dimension agreement cannot inherit the old four-dimension pilot's 80% agreement.

A separate [challenge-controls protocol](interview-preparation-controls.md) now tests the unchanged judge on authored strong, partial and severe artifacts. Its developer-expected anchors and new source stories remain distinct from natural agent outputs and submitted human ratings. No earlier score or rubric is rewritten.

The original free-quote pack and responses remain private under `preparation-semantic-v1-review-20261025`; the new ID-based pack is `preparation-semantic-v1.1-review-20261025`. All five new OpenRouter responses passed the reporting/evidence contract and are stored as `scored_uncalibrated`. This is judge execution success, not five successful agent tasks. The human form contains none of those scores. Neither pack becomes held out. The returned CSV omitted pack/rater columns; a separately recorded host binding preserved every rating field before strict comparison. Broader independent calibration remains pending; frozen historical manifests are not rewritten.

OpenRouter returned USD 0.448210 usage cost for the five rejected v1 responses and USD 0.430685 for the five v1.1 responses. Separate execution receipts retain token/cost totals and protocol status; unsuccessful judge-format responses still incur cost. The final Python suite passed 174 tests, including 11 new semantic-evaluation tests. Type checking, boundary/distribution checks and the fixed UI contract passed. An earlier Windows loopback connection abort in an existing OAuth test did not recur in its isolated module or the final full suite; no security check was weakened. The full upstream TypeScript suite was not rerun, and its existing Windows writer-test limitation remains.

Browser automation rejected opening the local file URL under its protocol policy. The form's JavaScript syntax and backend validation/cache/comparison behavior were checked, but direct browser interaction/save-switch verification was not completed. No alternate browser engine or transport workaround was used. Users can open the exported local artifact themselves; do not claim visually verified browser behavior.

For research evaluation, freeze the rubric and reviewed cases before collecting held-out method outputs. Expand independent authored stories across role/round/level/evidence conditions, preselect a stratified audit, and use two independently instructed raters where feasible. The current project plan proposes 24 new test stories and a 12-story two-rater audit, subject to observed variance/resources; these are targets, not a completed sample or a power guarantee. Report disagreement and missingness by dimension, cluster repeated runs by story, and keep development corrections separate from confirmatory results.
