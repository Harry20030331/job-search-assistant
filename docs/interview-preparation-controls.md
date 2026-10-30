# Preparation judge challenge controls

Maintenance date: 2026-10-26. Protocol: `preparation-quality-controls-v1`. This is a diagnostic of the unchanged `preparation-semantic-v1.1` evaluator, following a pilot in which every judge dimension received 2. It does not change agent prompts, the production workflow, earlier scores or semantic rubric anchors.

The [first execution results](interview-preparation-controls-pilot.md) retain 12 valid responses: 11/12 target-anchor matches, eight intended defects detected and one unresolved evidence-severity disagreement. These are developer-control diagnostics, not validated accuracy.

## Design and interpretation

The versioned dataset is `src/interview/python/benchmark/preparation-quality-controls-v1/suite.json`. It contains four new fictional developer-authored source stories, each with three authored outputs intended to score 2, 1 and 0 on one target dimension. There are 12 artifacts, four story clusters and one real judge call per artifact. These are artificial controls, not sampled natural agent failures or a held-out benchmark. Labels are AI-assisted developer expectations, awaiting independent review.

| Story | Stage/context | Target | Partial probe | Severe probe |
| --- | --- | --- | --- | --- |
| QC01 | Graduate backend recruiter proposal | Role/round focus | Coding/SQL/design tags conflict with qualified conversational prose | Technical drills replace an explicit HR agenda |
| QC02 | Senior backend manager proposal | Workload feasibility | Several outlines, sketches and rehearsals crowd a short block | Required real-time repetitions exceed the block by construction |
| QC03 | Junior ML technical materials | Evidence fidelity | Isolated unsupported company social-activity claim | Fabricated clinical impact, leadership, personal motivation and question guarantee |
| QC04 | Product DS manager materials | Actionability | One central block has thin generic guidance | Entire material consists of empty topic/advice lists |

Within a story the original candidate/invitation/JD/company evidence, stage, budget, required common preparation policy and synthetic approved plan are identical. Text mutations are not guaranteed to affect only one dimension; all six scores are retained, but only the declared target has an expected score. Coverage and level/depth have no isolated challenge in this version. The partial labels are deliberately more judgment-dependent than the impossible-duration/fabrication controls; disagreement must be inspected rather than silently relabeled as a judge failure.

Materials use an explicitly declared evaluator-only synthetic plan. Export does not stage business state or create actual approval. No Gmail/calendar/shared-opportunity action occurs. Source documents and candidate names are fictional, with no live retrieval or private account data.

## Frozen execution boundary

Export precedes every judge call and snapshots the suite, target labels, private sample mapping, actual judge packets, rubric, schema, whitelisted nonsecret model settings and implementation files. A manifest fingerprint binds those files and planned denominators. Execution and report verification reject modified inputs, labels, implementation or result receipts. The configured runtime version is recorded separately from the declared dependency lock.

Each call sees one opaque packet in hash order, with source facts, stage, policy, approved plan where applicable and the authored document. It never receives story/variant labels, intended scores, target dimensions, human scores or other variants. Evidence-ID constrained schema and the exact v1.1 rubric are reused. This measures evaluator behavior under that existing rubric; it is not a newly tuned judge.

Existing valid results are reused by exact packet/rubric/settings/schema fingerprint. Invalid first results and access failures are retained/reported without replacing them with better attempts. Missing results are never assigned zero. No automatic content-repair or label-adjustment loop runs. A changed protocol needs a new output pack; historical outputs are preserved.

## Commands

From the repository root, after the optional Python setup:

```text
npm run interview:preparation-controls -- export --output <absolute-new-pack>
npm run interview:preparation-controls -- judge --pack <absolute-pack> --judge-env <absolute-host-dotenv>
npm run interview:preparation-controls -- report --pack <absolute-pack>
```

Export/report are offline; judge makes paid OpenRouter requests using the same configured judge as the preceding pilot. Only `OPENROUTER_API_KEY` is loaded from the selected host dotenv; it is never copied into packets, snapshots or reports. The judge model/provider and token/timeout/retry settings are frozen. Report does not call a model.

## Report fields

- Target-anchor agreement: exact match to the 12 developer-expected target scores, with planned and actually scored denominators.
- Defect detection: target score below 2 on the eight intended partial/severe artifacts.
- Severe-zero detection: target score 0 on the four intended severe artifacts.
- Clean-two retention: target score 2 on the four intended strong artifacts, plus any serious-error flags on them.
- Strict ordering: whether each story's target scores satisfy strong > partial > severe. Ties and incomplete groups stay visible.
- Serious-category checks: whether the fabricated-impact control triggers its predeclared fabrication and unsupported-certainty categories. This one case is not a general severe-error recall estimate.
- All six dimension vectors, reasons, immutable result references, available token/cost usage and a constant-2 baseline (4/12 target matches, zero defect detection by construction).

Rates describe this small set of developer expectations. Do not call them human agreement, calibrated accuracy, natural failure prevalence or agent success. Source variants are correlated. Good performance on obvious artificial defects cannot establish sensitivity to subtle naturally occurring problems. Poor target agreement can also expose an ambiguous authored label.

## Human review and next decision

Export includes a blank method/variant-hidden `human-review.html` and a 72-row ratings template. This uses the existing human form, but the controls pack has its own manifest and report command; the historical preparation `compare` command expects its original pack format and must not be used directly on a controls pack. A future independent human comparison must explicitly validate this pack and the selected audit, preserve original ratings and distinguish developer expectations from adjudicated labels. No human scores are prefilled or inferred.

Browser automation previously rejected local file navigation. Only static JavaScript syntax checks are attempted for this export; do not claim interaction, persistence or visual verification. Users may open their own local file. No alternate page executor or transport workaround is used.

Keep this run as development data. Review disagreements before changing rubric instructions; freeze any revision before collecting new outputs. Separately add natural model outputs, independent authored stories, isolated coverage/level/correctness controls and independently instructed raters before relying on a judge for method comparisons.
