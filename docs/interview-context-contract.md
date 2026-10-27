# Preparation context development contract

Maintenance date: 2026-10-25. Implemented foundation and opt-in model analysis for the [context-aware plan](interview-context-plan.md), protocol `preparation-context-v1`. Existing preparation prompts, shared opportunity records, Google scheduling and workflow-v1 experiments are unchanged.

## Implemented files and boundaries

- `src/interview/python/interview/preparation_context.py`: typed request, evidence and analysis; mechanical validation; exclusive frozen artifact creation and integrity checks.
- `src/interview/python/interview/context_flow.py`: bounded model analysis with inline evidence, simple-instruction and guided methods, exact request binding, first-output retention and human-readable results.
- `src/interview/python/benchmark/context-v1/`: original 12 fictional, supplied-evidence development stories and provisional expectations, preserved unchanged.
- `src/interview/python/benchmark/context-v1.1/`: active reviewed version; C05 revised and the other eleven cases kept by the user on 2026-10-25. Public requests are byte-identical to v1; review decisions and parent hash are retained in `review.json`.
- `src/interview/python/evaluation/context_cases.py`: dataset validation and a snapshot-bound case review export. It makes no model or network calls.
- `src/interview/python/evaluation/context_pilot.py`: an explicitly selected paired-method development pilot; snapshots labels outside actor inputs and retains failures without retries.
- `src/interview/python/tests/test_preparation_context.py`: negative evidence, stale-context, artifact and approval-boundary checks.

Source documents retain captured content, UTF-8 SHA-256, timezone-aware timestamp, locator, origin, role relationship and selected stable job binding. A local hash verifies captured bytes, not truth, freshness on the live web or that a URL belongs to an employer. Source origin and mail association are host assertions that require evidence verification upstream. Declared research counts are checked against caps here. The separate [enrichment session](interview-enrichment.md) now reserves bounded search/browser actions and records their receipts; observed tool execution remains the active host's responsibility.

Validation maintenance: `preparation-context-checks-v1.1` permits all-supporting focus lists when no primary ranking is established, and inferred candidate-to-role/company links with both a canonical candidate anchor and supporting context. Confirmed candidate facts still cite only candidate sources. These changes address overly restrictive mechanics exposed during the first developer pilot, rather than establishing an agent improvement. New envelopes record the validation version; legacy envelopes without it retain v1 rules. Unknown claims still require null values, and practice learning/public interview reports remain distinct from resume/invitation facts. Field descriptions expose these meanings in the common schema for both model methods.

An analysis binds the entire request token, so changes to budget, identity, evidence or metadata invalidate it. References must quote captured text exactly. Analogue and public-report sources cannot confirm selected-employer claims. Unrelated-role evidence cannot establish role expectations. Exact JD evidence cannot be silently replaced with an analogue; missing JDs and uncertain level/round remain visible. Unresolved association requires a clarification question.

Role focus and round focus are separate lists. Each can carry multiple primary/supporting topics and evidence-based inferred or confirmed claims. Seniority, candidate links, company facts, attributed report themes, practice learning, unknowns and questions have distinct fields. A matching quote alone does not establish that an interpretation follows from it: relevance, priority, truthful inference and adequate coverage remain semantic evaluation questions.

## Commands

Use the Python setup in [Interview](interview.md), then run from the repository root. Cross-module paths should be absolute.

```text
npm run interview:context -- schema
npm run interview:context -- request --request <absolute-request.json>
npm run interview:context -- freeze --request <absolute-request.json> --analysis <absolute-analysis.json> --output <absolute-new-directory>
npm run interview:context -- check --context <absolute-directory>/preparation-context.json
npm run interview:context-cases -- check
npm run interview:context-cases -- export --output <absolute-new-private-review-directory>
npm run interview:context-analyze -- --request <absolute-request.json> --output <absolute-new-isolated-directory>
npm run interview:context-analyze -- --request <absolute-request.json> --output <absolute-new-isolated-directory> --method simple-instruction-v1
npm run interview:context-pilot -- --output <absolute-new-isolated-directory> --case C05 --case C08
```

`request` returns the token to bind in a model-authored analysis; it does not infer focus or seniority. `freeze` accepts a separately supplied analysis and writes a single envelope containing request, analysis and context hash, refusing existing directories. `check` verifies that envelope and its mechanical evidence rules. These operations do not authorize a plan or generate a candidate answer.

`context-analyze` and `context-pilot` make real Codex model calls using the configured model and consume quota. They do not call an OpenRouter judge, Google services or live web search. Unlike the tool-using workflow-v1 baseline, these node methods receive the same captured request inline. Both use the same output schema and read-only runtime. The guided method adds explicit evidence/round/role reasoning instructions; this is an instruction comparison, not a new agent loop or a measured memory contribution.

Node outputs must be outside Git/AGENTS/.agents instruction ancestors. Each node records its prompt, settings, implementation snapshot/hashes, source request hash, JSON schema, invocation logs and first result. It makes one bounded invocation with no repair/retry. Actual command use violates this inline-only node protocol and is recorded as failure. Request/schema/prompt mutation also fails validation. CLI environment errors stay distinct from contract failures. Passing citation/schema checks does not establish semantic quality. A valid unresolved association remains awaiting clarification rather than becoming ready for preparation.

Node v1.1 also records actual Python/Pydantic versions and the declared lock version, making a development-environment mismatch visible instead of claiming locked reproduction. First node-v1 results remain in their original private pilot; a changed contract uses a separate pilot directory and is never pooled into the original run.

Successful analysis writes `validated/preparation-context.json` and readable `context.md`. The pilot freezes the entire selected dataset on the host, alternates a fixed method order across explicitly chosen stories, and provides per-attempt reports. Evaluator labels and review notes are not inserted in either method's prompt. No representative-sample, dollar-cost, judge-quality or causal improvement claim follows from this development pilot.

The explicit [context-aware preparation path](interview-context-preparation.md) now captures a canonical handoff, checks attachment against current IDs/candidate/invitation/preferences/budget, and generates context-bound plans and approved materials. Existing input fingerprinting invalidates earlier acceptance after context changes. Automatic live evidence retrieval remains pending. Do not silently insert new prompts or context into historical baseline groups.

## Development cases and label review

| Case | Focus | Round | Evidence condition |
| --- | --- | --- | --- |
| C01 | Early-career product DS | Technical | Exact JD; experimentation, metrics and SQL |
| C02 | Senior modeling DS | Technical | Exact JD; forecasting and evaluation |
| C03 | Graduate backend | HR | Technical role, explicit non-coding screen, 20-minute budget |
| C04 | Senior ML engineering | Hiring manager | Mixed ownership, technical decisions and motivation |
| C05 | Associate DS, unknown level | Hiring manager | Same-company different-level analogue |
| C06 | Early-career backend | Technical | Other-company analogue; explicitly bounded design |
| C07 | ML engineering, unknown level | HR | No JD; sparse candidate and motivation evidence |
| C08 | Junior modeling DS | Technical | JD and explicit current-round emphasis differ |
| C09 | Senior backend | Hiring manager | Migration ownership, tradeoffs and mentoring |
| C10 | Senior product DS | HR | Closed exact posting; active interview, 25-minute budget |
| C11 | Graduate ML engineering | Technical | Nearby principal-platform posting is unrelated |
| C12 | Graduate backend | Behavioral | Old senior-level report with injected instructions |

Each case has `case.json` and public `request.json`; `gold.json` is evaluator-only. These tasks request context analysis, not a full preparation plan. Expectations for introduction, why-company and why-role describe later planning coverage and must not penalize context outputs for omitting complete exercises. The 12 cases have distinct authored candidate/employer/invitation contexts. This is not a statistical independence claim, a complete factorial design or a holdout.

The AI-assisted labels were reviewed in chat on 2026-10-25. The active default is context-v1.1: C05 revised, all other cases kept. In C05, the invitation confirms the hiring-manager round label but not its topic scope. Role focus from the analogue and suggested round themes must be inferred. Project ownership and motivation are optional plausible preparation themes, not required employer questions; an explicit unknown scope or other supported hypotheses remain acceptable. The exact JD, level and actual round scope remain unknown. No source evidence or public task was changed.

Original context-v1 and the private review snapshot remain unchanged. Reviewed cases require complete human-decision provenance, included in the dataset fingerprint. Review exports preserve a dataset snapshot and all input hashes; the HTML has keep/revise/drop controls with CSV export. Later label edits need a new dataset/review version; the original generator refuses to overwrite its destination. No synthetic agent outputs, success scores or judge ratings are generated by dataset validation. Reviewed development labels do not make this a holdout or establish population validity.

For eventual comparisons, preserve the same evidence/tool access for the simple-instruction and structured-context methods. Score semantic interpretation separately from citation validity, then evaluate whether the accepted plan and materials use that context appropriately. See the [next evaluation design](interview-context-plan.md).

The first paired C05/C08 developer runs and their retained contract failures are recorded in [context node pilot observations](interview-context-node-pilot.md). They are not new semantic benchmark scores.
