# Context analysis node: development observations

Date: 2026-10-25. Selected stories: reviewed context-v1.1 C05 and C08. Model: configured `gpt-6-luna`, high effort, Codex CLI 0.163.0. These are two selected fictional development stories, not a held-out benchmark or evidence of a method effect.

## Implemented execution

`npm run interview:context-analyze` now makes a bounded real model invocation for a captured request. Both `simple-instruction-v1` and `context-guided-v1` receive identical public evidence and a common output contract. The latter adds structured reasoning instructions. This compares instructions at a context-analysis node; it is not a custom agent loop or a measured memory/workflow contribution.

The runner preserves prompts, schemas, settings, source and implementation snapshots, invocation logs, timing/tokens, first output and mechanical validation. A successful node provides a frozen context envelope and readable `context.md`. Missing noncritical context can remain unknown; unresolved interview identity requires clarification. No plan acceptance, full materials, calendar operation or mail operation occurs here.

## Retained runs

The initial private run is named `context-node-pilot-20261025`; the separate revised-contract run is `context-node-contract-v1.1-pilot-20261025`. Each attempted the same four case/method combinations in a predeclared alternating order. All eight CLI invocations completed in distinct sessions and made zero command calls. No retries replaced any output. The implementation snapshot is identical within each run; the changed contracts across runs are not pooled.

| Case and method | Initial contract | Revised contract v1.1 |
| --- | --- | --- |
| C05 simple instruction | Validation failed | Context ready |
| C05 guided | Validation failed: required primary topic | Context ready |
| C08 guided | Context ready | Context ready |
| C08 simple instruction | Validation failed | Validation failed: non-null unknown value |

The initial C05 guided analysis preserved analogue limitations, unknown level and unspecified hiring-manager scope, but all inferred role themes were supporting. The old mechanical rule incorrectly forced a primary ranking even when evidence did not establish one. Validation v1.1 permits all-supporting lists. It also permits inferred candidate-to-role links with a canonical candidate anchor and supporting role/company evidence, while retaining stricter references for confirmed candidate facts. Common schema descriptions now explain unknown values, report themes and practice learning to both methods. Legacy frozen envelopes retain their original rules; initial run results remain unchanged.

## Qualitative developer inspection

In the revised run, both C05 outputs keep the JD as an analogue, leave seniority unknown, confirm only the hiring-manager label and retain the unknown topic scope. The guided output also offers qualified role-focus hypotheses and an inferred candidate/role link. Empty round focus is acceptable under the user's C05 amendment.

Both revised C08 outputs distinguish the modeling role from the explicit experimentation/product-metrics focus of this round. The simple output is rejected for using descriptive text rather than null in an `unknown` claim. That is an output-contract error, not evidence that it misunderstood the interview. Future semantic evaluation must not collapse representation failures and interpretation failures into one quality score.

These observations are assistant/developer inspection, not independent human ratings or calibrated judge scores. All semantic quality fields remain `pending_unrated`. Three mechanically valid outputs in the revised run do not establish three semantically successful tasks or a quality advantage for guided instructions.

## Usage and verification

Initial run: 59,570 input tokens, 6,849 output tokens, 68.593 summed invocation seconds. Revised run: 60,218 input tokens, 6,406 output tokens, 59.453 summed seconds. Subscription dollar cost is unavailable and remains null. No OpenRouter judge or live Google/browser service was called.

The revised manifest records actual Python 3.12.14 and Pydantic 2.14.1; the declared lock uses Pydantic 2.13.5. This used the existing development environment, not an exact lock-file reproduction. The original run lacked that runtime receipt; do not silently backfill its frozen manifest. The revised node now snapshots the dependency lock and records runtime versions for future comparisons.

The final Python suite passed 149 tests, including model-output isolation, retained failures, legacy validation compatibility, unknown-scope ranking, source binding and approval freshness. Type checking, distribution, structural boundaries and fixed UI checks also passed. These checks measure implementation behavior, not agent task quality. The known upstream Windows writer-test failures remain outside this targeted validation.

Next: explicitly attach qualified context to a new preparation flow, preserve historical baseline prompts, and evaluate whether it produces an appropriately balanced proposal and approved materials. Live JD research and semantic quality calibration remain separate work.
