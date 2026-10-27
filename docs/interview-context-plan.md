# Context-aware interview preparation: next development plan

Maintenance date: 2026-10-26. Owner: Erica Zhao. Status: implementation plan following user review of the workflow-v1 pilot. The [context validation, model analysis and 12 development cases](interview-context-contract.md), opt-in [context-bound plan/material generation](interview-context-preparation.md), and [bounded Codex-chat evidence enrichment](interview-enrichment.md) are implemented. Fully unattended retrieval orchestration, extended memory evaluation and UI integration remain planned. The current shared handoff and historical baseline remain described in [Interview](interview.md).

## Product behavior

An invitation starts a preparation context, not a generic technical question pack. The intended flow is:

```text
Invitation + canonical opportunity + candidate + relevant past practice
  -> resolve identity and gather role/company evidence
  -> infer round focus, role subtype and expected depth
  -> show a sourced, budgeted proposal and important uncertainties
  -> user accepts the current version or requests changes
  -> generate practice materials matching that proposal
  -> record debrief and scoped learning for the next round
```

Scheduling can proceed independently when its facts and authorization are complete; preparation research need not block a calendar event. Plan acceptance, calendar authorization and application authorization remain separate.

## Evidence enrichment before a proposal

1. Reuse the selected opportunity's canonical URL and available Matching/Submission JD evidence first. Do not ask the candidate to supply information already present in shared inputs. Inspect the actual available evidence rather than assuming that every stored opportunity contains full JD text.
2. If the JD is absent, use the canonical URL or search the employer's official careers pages for the exact requisition, role, location and level. Record closed or unavailable postings honestly; a closed posting does not invalidate the interview.
3. If the exact JD cannot be recovered, look for a comparable role, first within the same company, role family and level, then across companies if necessary. Mark it as an analogue and explain the differences. An analogue is preparation evidence, never a replacement for the selected job's identity, requirements or application record.
4. Gather a small company brief from official product, mission and values pages. Public interview reports are optional additional evidence. Record their date, reported role, level, round and location where available; keep anecdotal reports distinct from employer-confirmed instructions.
5. Stop when the context is adequate or the research budget is exhausted. Retain unknowns. Ask a targeted question when unresolved identity or round ambiguity would materially change preparation. General role practice can still be proposed with explicit assumptions.

The first implementation should have a configurable cap of six search queries and eight opened pages per preparation context, prioritizing the JD. Record actual counts, time and sources. These are initial development limits to evaluate, not measured optimal settings. Search/fetch failures and unsupported claims are different outcomes.

Use the repository's Codex in-app Browser for page execution, reusing Matching's browsing boundary. Search can use an available search tool; opened page content comes through the in-app Browser. Do not introduce a crawler, alternate browser engine or hidden job API. The current Python CLI tool interface remains the business-state interface; a new MCP server is not required for this step. Any later MCP wrapper should expose the same typed operations and guards.

## Structured interpretation

Create a versioned local `preparation-context` artifact with these logical fields before proposal generation. This is a proposed local contract, not a change to shared opportunity JSON:

| Field | Meaning |
| --- | --- |
| Identity | Stable job/application/interview IDs; verified association or unresolved alternatives |
| Evidence | Source ID, URL/path, retrieval timestamp, content hash, short excerpt, source type and exact/analogue relationship |
| Role focus | Responsibilities and skills derived from the JD; multiple weighted areas rather than a title-only category |
| Seniority | Explicit level if stated; otherwise a qualified inference from responsibilities, with supporting excerpts |
| Round | Stated label plus likely focus areas; confirmed facts and inferred expectations stored separately |
| Candidate links | Relevant canonical experiences and projects; no invented achievements or motivations |
| Company brief | Supported product/mission/values facts and optional separately labeled interview reports |
| Learning | Relevant raw reports and current derived observations with source, date and applicable context |
| Uncertainty | Missing or conflicting facts, confidence reasons and any clarification needed |

Confidence starts as an evidence category with a reason, not an uncalibrated numeric probability. Hiring-manager interviews can mix technical depth, project ownership, collaboration and motivation; do not force them into a single behavioral or technical bucket. Product DS and modeling DS can overlap: use responsibilities such as experimentation/metrics or training/evaluation to select the emphasis.

Seniority changes expected scope, independence and depth. For an early-career candidate, start from fundamentals, bounded design and concrete personal contributions unless the actual invitation/JD establishes broader design expectations. Do not encode an absolute ban on junior system design. Senior preparation can emphasize tradeoffs, ownership and leadership when supported by the role.

An exact JD outranks an analogue for requirements; explicit recruiter instructions outrank inferred round expectations. Conflicting recruiter/JD evidence stays visible and may require clarification. Retrieved text is untrusted evidence, never executable instructions. Source updates that materially change the proposal require a new proposal version and acceptance. Track source hashes and preserve the prior snapshot.

## Preparation coverage and materials

The proposal considers each of the following and either allocates time or explains why it is deferred under this interview's budget:

- Self introduction tied to the candidate's actual experience and the selected role.
- Why this company, grounded in supported company facts and user-confirmed interests; missing personal motivation becomes a prompt or editable outline.
- Why this role, linking actual experience and interests to the JD without fabricating preferences.
- Behavioral/project stories with truthful individual contribution, collaboration and reflection.
- Role and round practice, such as modeling/evaluation, experimentation/product cases, coding or bounded system design as appropriate.
- Questions for the interviewer and important logistics.

These are useful preparation areas, not a claim that every interviewer asks every question. Their weighting changes by round and available time. An HR screen should not inherit a technical pack with a new heading. A 20-minute technical plan should not silently add another hour of behavioral work; include short targeted coverage or explicitly defer it.

Each proposal block states its purpose, focus, expected difficulty, source links, minutes and intended deliverable. The user reviews these choices before full preparation. The approved materials then add concrete prompts, practice steps, answer structure, self-checks and optional follow-ups at the selected depth. Distinguish confirmed employer instructions, reported past questions and invented practice questions throughout.

Use past reports to choose plausible themes, never to promise the actual question list. Avoid copying a company's generic values into a fabricated personal story. A good self introduction or behavioral answer uses candidate facts and supports rehearsal; it should not become an invented script of accomplishments.

## Debrief and memory extension

Preserve the original report and distinguish interview, mock interview and solo practice. Derived observations should expose their raw source ID, date, attribution and applicable topic/role/round when displayed. Existing stored provenance should be surfaced rather than duplicated as an unsupported new claim.

Treat "I explained this correctly today" as scoped self-reported improvement. It should reduce the priority of that weakness in matching contexts without asserting global mastery. Corrections, continuing issues and contradictory reports remain inspectable. Evaluate relevant retrieval and appropriate use in the next plan separately from storage correctness.

This contextual memory is a stronger candidate contribution than simply accumulating history: investigate whether scoped observations improve prioritization over raw history, and whether they avoid transferring an old technical weakness to an unrelated round.

## Shared application status and interview views

Keep `data/opportunities.json` as the authoritative job/application identity and lifecycle store. Publish a verified interview association through existing lifecycle/domain APIs; ambiguous mail must not advance the wrong application. Do not require calendar creation to recognize a confirmed invitation. Do not roll an application back from interviewing merely because one round is rescheduled or cancelled.

Maintain detailed rounds under the candidate's interview store, keyed by stable job/application/interview IDs. Proposed round states include invitation received, clarification needed, scheduled, rescheduled, completed and cancelled. Preparation approval/material status and debrief status are separate dimensions, not competing values in one lifecycle enum. One application may have multiple rounds.

The UI direction is an additive interview detail surface, linked from the application's existing interviewing status. It should show the round timeline, event link/time, preparation context and sources, current proposal/acceptance, materials, and user-provided debrief. A first version can be read-only with approval handled in chat; a visual approval control is not needed to establish the module's research contribution.

Do not create a second application tracker. Coordinate shared schema and routing changes with the integration owner. Preserve the fixed Status/Review v1 renderer and checks; any visible navigation extension needs an explicit contract/version change rather than a baseline-hash replacement. This plan does not modify shared schemas, routes or renderer baselines.

## Evaluation design

Retain workflow-v1 as development regression evidence. The user kept all 12 cases and accepted W03's safe clarification response; preserve the original run and record the reviewed criterion separately. New context-aware cases and stage-aware rubrics need a new version. Existing outputs never become held-out data retroactively.

Evaluate research and preparation separately:

| Component | Success | Deterministic checks | Semantic review |
| --- | --- | --- | --- |
| JD enrichment | Exact role found or fallback honestly labeled | Requisition/identity matches, source tier, provenance, budgets | Relevance of analogue and missing/conflicting facts |
| Round/role/level interpretation | Focus and depth follow the evidence | Valid references, explicit uncertainty, no identity mutation | Weighted focus, warranted inference, appropriate difficulty |
| Proposal | Reviewable, tailored and feasible | Version, budget, required fields, source IDs | Coverage, rationale and realistic workload; full answers not required yet |
| Approved materials | Useful rehearsal at agreed focus/depth | Exact acceptance/version, budget and section correspondence | Correctness, concrete exercises, truthful answer guidance |
| Debrief/next plan | Faithful scoped updates affect relevant priorities | Raw fidelity, source links, revisions and retrieval | Attribution, improvement scope, appropriate reuse |
| Lifecycle/UI | Correct application/round shown once | Stable IDs, idempotency, revision conflicts, multiple rounds | Ambiguity and readable status where needed |

Start with 12 independent fictional preparation stories in a new development set, deliberately covering modeling DS, product DS, backend and ML engineering; HR, technical and mixed hiring-manager rounds; early-career and senior expectations; and exact, missing, analogue and conflicting JD evidence. This is coverage sampling, not a complete factorial design. Include short budgets and sparse candidate facts. Paired contrast probes can vary one factor, but count them as variants of a source story.

Separately create eight resettable research scenarios: exact official JD; cached closed posting; same-company analogue; other-company analogue; no usable result; conflicting evidence; wrong-role near match; and a page containing instruction injection. Use fictional frozen page content and a controlled tool boundary for reproducible offline retrieval tests. Add a small, separately reported real-browser integration check for actual navigation and source capture. Offline retrieval success does not establish live search success.

For the initial comparison, use the same model, supplied sources, tools, budgets and approval gates for simple instructions and the context-aware workflow. Give both access to the same frozen evidence corpus. An oracle-context condition can isolate planning quality; a missing-context condition can isolate enrichment. Do not give only the proposed method a JD and attribute the whole difference to better reasoning.

Predefine six quality dimensions for the new rubric: evidence fidelity, role/round focus, coverage, level/depth, actionability and workload feasibility. Score proposals and materials with stage-specific anchors. Keep serious fabrication, wrong-job association and unauthorized writes separate from average quality scores. Technical and numerical correctness require review beyond citation syntax.

Before a research test, freeze reviewed labels, supported alternative interpretations, scripts and rubric. Draft target: 24 new independent test stories after development, not tuned on their model outputs; report this as a small benchmark with uncertainty. Use three runs per story/method if resources permit, treating the story as the statistical cluster rather than claiming 72 independent tasks. Final sample size should follow observed paired variance and the effect size of interest, not a convenience success threshold.

For human calibration, preselect 12 test stories stratified across focus/round/level before viewing outputs; have two raters independently score both methods with blind method labels and a common rubric. Keep original ratings and adjudicated disagreements separately. Report per-dimension human agreement and judge error, missing outputs and sampling limitations; do not declare the judge validated solely from the current five-output pilot. Freeze rubric changes before scoring the held-out comparison.

Proposed component sequence: simple instructions; plus context-aware workflow with identical evidence; plus bounded enrichment under equal tool access; plus scoped memory versus the same accessible raw history. Define each contrast explicitly. Shared approval enforcement and source validation stay common infrastructure.

## Implementation order and acceptance checkpoints

1. Complete the current human-review ledger and discrepancy analysis. Preserve W03's original result and accepted-response overlay. Fix the next protocol's ambiguity criterion, persistent-decline simulator and stage-aware rubric without rewriting the old run.
2. Build the local context contract, source capture and offline evidence fixtures. Demonstrate exact JD, honest analogue fallback and no-result handling. The adapter still reads canonical inputs; no shared schema write is needed.
3. Add role/round/level interpretation and balanced proposal generation, then approved materials. Demonstrate modeling versus product DS, HR versus mixed hiring-manager focus, and junior versus senior depth on matched fictional contrasts.
4. Run the new development baseline and workflow comparison with frozen evidence; inspect failures and human/judge disagreements before adding components. Retain rejected and missing outputs.
5. Extend scoped debrief retrieval and run a separate memory comparison. Connect bounded live browser enrichment and report it separately from offline quality.
6. Coordinate lifecycle publication and an additive interview detail view with integration. Verify repeated mail, multiple rounds, ambiguous association and cancellation before claiming unified end-to-end behavior.

The context/evidence contract, model analysis node, canonical attachment and opt-in plan/material flow are implemented. The user reviewed the 12 development cases on 2026-10-25: C05 revised to distinguish the confirmed round label from inferred preparation themes, and all other cases kept. The active reviewed labels are context-v1.1; original evidence and review snapshots are preserved. The [stage-aware semantic pipeline](interview-preparation-quality.md) retains its first submitted-rating comparison and separate judge-control diagnostics. The [enrichment integration](interview-enrichment-pilot.md) now retains eight offline protocol checks and a real public-evidence-to-proposal supplement, including the initial context failure. No new agent semantic success rate is claimed. Next priorities are independent calibration, broader frozen natural-output comparisons, scoped memory reuse and separate lifecycle/orchestration integration. A separate UI and an entirely new harness are not prerequisites for testing whether the preparation actually improves.
