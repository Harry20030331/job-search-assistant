# Current-workflow baseline pipeline

Protocol: `interview-workflow-v1`. Method: `simple-instruction-v1`. Maintenance date: 2026-10-25. This is a developer pilot, not a frozen research benchmark or evidence of component effects.

## Scope and cases

The versioned dataset lives in `src/interview/python/benchmark/workflow-v1/`. Its 12 episodes exercise current module contracts:

| Cases | Module | Scenario |
| --- | --- | --- |
| W01-W03 | Mail triage | Ordinary mail, rejection after an invitation, ambiguous reschedule identity |
| W04-W06 | Scheduling | Exact confirmed event, missing timezone, declined event |
| W07-W09 | Preparation | Accept, revise budget then accept, reject without materials |
| W10-W11 | Debrief | Faithful report, source-linked correction and continued issue |
| W12 | Local lifecycle | Schedule, approved materials, practice debrief, fresh-session next proposal |

All inputs are fictional and AI-assisted. Episodes deliberately reuse source fixtures: there are seven source context templates, not 12 independent real-world stories. The five planned quality outputs share two underlying candidate/job contexts. The pilot checks execution and exposes rubric disagreements; it cannot estimate population accuracy, inter-rater reliability or a memory effect. The user kept the cases on 2026-10-25 and accepted W03's safe clarification response in a separate criterion overlay; original run files remain unchanged. See the [pilot review](interview-baseline-pilot.md) for the completed ratings and comparison. Actual reschedule execution, cancellation, duplicate delivery and broader candidate/round diversity still need expanded cases before a research freeze.

## Baseline and common infrastructure

Each node receives a short common instruction, its current task/public dialogue and the same typed output contract. It can read the local tool guide, sources and relevant raw history. The measured baseline receives no interview skill, workflow helper or structured retrieval extension. The production preparation prompt is replaced by the recorded baseline prompt, not silently used as extra instructions. The output folder must be outside Git/AGENTS/.agents ancestors so repository instructions do not contaminate the baseline.

Exact calendar confirmation, version-bound plan acceptance and tool validation are common host rules for every future comparison. Their success is infrastructure correctness, not evidence that a workflow method helps. Rejection without material generation currently measures the shared host gate, not an additional agent reasoning turn. Debrief output is structured because that is the task contract; future structured-memory comparisons need their own matched design. The baseline's later preparation sees raw history, without `memory.search`.

Future scripted facts and decisions stay evaluator-side until requested. For scheduling, the host supplies scenario facts, withholds confirmation until an exact action is presented, then follows the predeclared accept/decline script. A question combining timezone and confirmation receives only the known timezone plus a request for the complete action. The simulator is a consent/interaction fixture, not an expert who repairs wrong proposals: actual event correctness is independently graded. Preparation revisions change the profile budget only after the first proposal. Acceptances are recorded as `synthetic_test_script`, never human authorization.

## Run

Use the Python setup in [Interview](interview.md), select the logged-in CLI when needed, and run from the repository root:

```text
npm run interview:benchmark -- --run <absolute-new-experiment-directory-outside-the-checkout>
npm run interview:benchmark -- --run <absolute-new-experiment-directory-outside-the-checkout> --judge --judge-env <absolute-local-dotenv>
```

The optional dotenv is host-only and reads only `OPENROUTER_API_KEY`; it is never copied into the run. Agent child environments remove API keys. `--judge` makes additional OpenRouter calls for the prespecified available audit outputs. Baseline execution never accesses Google services. `--case W07` selects a subset and can be repeated. `--resume` requires identical method, settings, data and implementation; it retains completed/failed first attempts rather than overwriting or automatically retrying them. Partial interrupted episodes are preserved; a new implementation uses a new output directory.

The batch freezes a dataset and implementation snapshot plus configured model, reasoning effort, time/command budgets and hashes. Case execution uses the dataset snapshot. Each model invocation stores the actual prompt, public request, JSONL, version, timing and available usage. Source modification invalidates the episode. Single-episode failures are retained while the batch continues.

## Outputs and scoring

- `batch_manifest.json`, `dataset_snapshot/`, `implementation_snapshot/`: reproducible inputs and implementation, including evaluator-only gold.
- `<case>/`: actual local state/actions, model invocations, dialogue, decisions and immutable first result.
- `summary.json`, `episodes.csv`, `report.md`: module denominators, execution status, deterministic checks, failures, model calls, time and available token counts. CLI monetary cost is null when unavailable; it is never invented from subscription usage.
- `<case>/quality/*.packet.json`: source-based preparation/debrief quality packets. The next-session packet is nested under its session directory.
- `review/case-review.html`: proposed scenario/label review, with keep/revise/drop decisions and exported CSV.
- `review/human-review.html`: blinded quality pilot with common rubric and exported CSV.
- `judge-results/`, `judge-status.json`: separate uncalibrated judge outputs and reported API cost metadata; not shown on the human form.

Deterministic checks inspect actual category/association/route, event identity/time/conflicts/authorization, plan versions/budgets/material matching, raw-text preservation and revision links. They do not establish semantic quality. The independent judge and human rubric score specificity, grounding, actionability and constraints on 0-2, with debrief-specific interpretations. Suggested technical answer correctness and honest source interpretation require semantic review. Severe issues and uncertainty are retained separately. No single combined research success rate is declared by the pilot.

## Human pilot

Audit selection is fixed before seeing scores: W07 materials, W08 revised materials, W10 debrief, W11 corrected debrief and W12 next proposal. One artifact per episode yields at most five outputs and 20 dimension ratings. Unavailable outputs are recorded as missing and are not replaced with better-scoring samples. One human rater gives a first calibration diagnostic; formal evaluation should expand independent source stories and predefine a two-rater audit where feasible.

First review all 12 cases/labels and export the case CSV. Corrected labels require a new version/run; existing outputs do not become holdout data. Once labels are acceptable, rate the available five outputs without looking at judge scores and export the rating CSV. Blank/duplicate/out-of-range ratings and missing evidence are rejected, never filled automatically.

```text
npm run interview:review -- compare --batch <absolute-batch> --ratings <absolute-human-ratings.csv>
```

The comparison reports exact agreement and mean absolute error over the observed dimensions, with their clustered/paired nature explicit. It does not automatically declare the judge validated. Review material disagreements before expanding experiments. The older A/B/C/D runner and its scores remain a separate historical protocol.
