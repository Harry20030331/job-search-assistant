# Interview evaluation: implemented scope and remaining work

Maintenance date: 2026-10-25. This document separates executable development infrastructure from planned research evaluation. It supplements the Submission-specific [evaluation framework](evaluation.md), without changing that module's protocol.

Business execution nodes now live in `interview/preparation_flow.py` and `interview/debrief_flow.py`, with shared invocation in `interview/agent_runtime.py`. Former `evaluation.*` imports remain compatible. This organization changes no baseline group definitions, user scripts, rubrics or historical scores. The team's operational skill and the experiment's interview skill remain distinct.

## Available now

The newer [current-workflow baseline pipeline](interview-workflow-benchmark.md) adds a versioned 12-episode developer dataset, batch execution across scheduling/two-stage preparation/debrief, retained per-episode failures, source snapshots, reports and a prespecified human/judge pilot. This is distinct from the original A/B/C/D runner below. The user reviewed the cases and supplied the first ratings; broader judge validation remains pending. Read the run's report for actual execution results rather than treating the existence of code as a successful benchmark.

The first complete batch's [observations and caveats](interview-baseline-pilot.md) record all 12 attempts, primary code results, the separate corrected-rejection supplement and the five-output human/judge comparison. All 20 supplied ratings validated; exact agreement is 80% and mean absolute error is 0.20. This is a single-rater developer diagnostic, not a validated judge. The next [context-aware preparation plan](interview-context-plan.md) defines the proposed evidence, role/round/level and expanded evaluation work.

The opt-in [context-aware preparation pilot](interview-context-preparation-pilot.md) now exercises reviewed C03/C08 supplied contexts, matched planning instructions and one predeclared synthetic-approval materials audit. It retains the initial common-coverage failure and a separate revised-policy run. Mechanical checks and developer inspection are reported separately. The subsequent semantic pipeline has five uncalibrated judge results and the submitted-rating diagnostic below; no holdout result or causal improvement is claimed.

The new [stage-aware semantic evaluator](interview-preparation-quality.md) adds six dimensions with different proposal/material anchors, constrained source citations, complete first-artifact selection and blank human review forms. The first [submitted-rating comparison](interview-preparation-quality-pilot.md) has 28/30 exact agreement across five artifacts/two stories, with disagreements on round-focus labels and workload density. All judge scores were 2; a constant-2 predictor gets the same agreement. Automatic judge responses remain separate and unvalidated. This protocol does not inherit prior workflow-rubric calibration or imply population validity.

The separate [preparation judge controls](interview-preparation-controls.md) freeze 12 developer-authored strong/partial/severe documents across four fictional source stories before scoring under the unchanged semantic rubric. They test defect detection, severity, clean retention and within-story ordering. Expected labels are not independently reviewed human gold; authored controls do not establish natural agent quality or a causal method improvement.

The [enrichment checks](interview-enrichment-pilot.md) add eight scripted offline research-protocol scenarios and a separate real-browser/public-evidence-to-Codex-proposal integration. The first context failure and new common-prompt protocol are retained separately. Scripted receipts test guards and persistence, not model retrieval accuracy; a single live integration is not population evaluation.

The Python module includes a real Codex CLI runner with fixed model/settings, fresh workspaces, recorded prompts/outputs/tool calls, input hashes, scripted user responses, deterministic graders and an optional independent OpenRouter quality judge. Experimental A/B/C/D groups preserve the original protocol:

| Group | Components |
| --- | --- |
| A | Simple instructions, common tools and raw history |
| B | A plus the experimental interview skill |
| C | B plus historical explicit workflow helpers |
| D | C plus versioned structured-memory tools |

Do not label the newer guarded two-stage preparation workflow as group C in that matrix without defining a new protocol. It has separate development nodes and approval semantics. The shared-input adapter and source freshness guard are integration infrastructure; they are not evidence of a measured method improvement.

Fixtures are six fictional developer stories (S01/S02 scheduling, P01/P02 preparation, M01/M02 multi-session memory), plus 16 separately scored fictional mail-triage cases. They are AI-assisted developer data, awaiting independent review. There is no frozen holdout or validated population estimate in this checkout. Earlier private runs and their scores were intentionally not imported or relabeled as new results.

## Commands

After [optional Python setup](interview.md), run from the repository root:

```text
npm run interview:test
npm run interview:eval -- --split dev --group A --case S01
npm run interview:eval -- --split dev --group A --case P01 --judge
npm run interview:triage -- --help
npm run interview:analysis -- --help
npm run interview:calibration -- --help
```

`interview:eval` makes actual model calls and consumes quota. `--judge` additionally makes external OpenRouter calls. Tests do neither. Python commands run from the module root; explicit cross-module paths must be absolute. Default outputs are module-local ignored `runs/`; keep reports/calibration packs private under `runs/` or a selected external directory. Never publish real mail or account configuration to satisfy reproducibility.

Each original runner task records a manifest, case and gold snapshots, implementation/input hashes, per-response JSONL, final output, actual state/action logs, code scores and judge packet/result when requested. Gold is evaluator-only. Future clarification and confirmation replies are withheld until needed. Access/environment failures are separate from task and judge failures. Memory visits use fresh model sessions with shared permitted evidence.

## Success criteria and scoring

| Module | Success | Main evaluation |
| --- | --- | --- |
| Mail triage | Correct category, interview association and safe route | Code checks against reviewed labels; report components separately |
| Scheduling | Correct identity/time/timezone/duration; exact authorization; no conflicting or duplicate event | Actual state and operation checks; severe errors separate |
| Preparation | Relevant, supported, actionable practice within budget | Code checks for contracts/references/minutes; blinded judge for semantic quality |
| Debrief and memory | Preserve raw provenance; retrieve relevant current claims; avoid obsolete/unrelated claims | Record/version/retrieval checks plus source-based semantic review |
| New two-stage interaction | Current proposal acceptance precedes matching full materials | Current-workflow batch checks versions, budgets and approval gates; semantic usefulness remains separately reviewed |

The judge uses a frozen rubric and settings and can export a common human-review form and CSV comparison. Generated calibration controls are dependent variants of source stories, not independent tasks. Human ratings were not migrated; calibration remains pending. A callable judge is not a validated judge. Unit/contract test counts are not agent success rates.

## Next evaluation milestone

1. Freeze reviewed synthetic task inputs, labels and scripted user interactions for the current full flow, including no-op/review cases, ambiguity, rescheduling, cancellation and plan revisions.
2. Define a simple-instruction baseline under exactly the same model, tools, budgets, approval rules and history access as proposed variants. Keep old and new protocols distinct.
3. Review and expand the new developer batch runner's module coverage and human labels before freezing a research test set. Historical single-case and A/B/C/D outputs remain separate from the new protocol.
4. Calibrate the quality judge against human ratings under a common rubric; predefine audit sample selection, independent story counts and disagreement handling.
5. Run and retain the first baseline batch, including failures, time and available token/cost metadata. Only then compare skill/workflow/memory variants with matched cases and appropriate uncertainty analysis.

End-to-end automatic Gmail arrival, lifecycle publication, shared-candidate history association and semantic email/round identity need separate integration cases. Live Google demonstrations do not replace the resettable local benchmark. No new baseline batch or causal improvement is claimed by file migration.
