# Context-aware preparation workflow

Maintenance date: 2026-10-25. Implemented opt-in flow, protocol `context-preparation-node-v1.1`. This connects captured/analyzed context to a reviewable plan and exact-approved materials. The historical `interview:prepare` entry and experimental A/B/C/D instructions remain unchanged.

## Behavior and contracts

`interview/context_preparation.py` owns capture, attachment, working snapshots and context-bound plan validation. `interview/context_preparation_flow.py` makes bounded model calls with inline evidence. Both use the existing preparation proposal/approval/material tables and host approval API. No new application tracker, shared schema or product page is introduced.

The proposal binds the exact interview, analyzed context hash, preparation-policy hash and current budget. It has 1-6 sections with minutes, purpose, focus topics, depth, rationale, deliverable and references. A six-area ledger accounts for self introduction, why company, why role, behavioral/project stories, role/round practice and interviewer questions. Included areas link actual sections; deferred areas carry a reason and no extra time. Every section belongs to included coverage. Minutes are summed once per section, even when a block covers multiple areas.

The default configurable policy requires brief self introduction, why-company and why-role preparation across rounds. These can share a short block; they are not guaranteed interview questions. Missing personal motivation calls for reflection prompts and truthful placeholders, not invented beliefs or automatic deferral. An explicit user preference can change the required areas. Required coverage is a common task constraint for both baseline and guided planning, not a method contribution.

The captured source context remains authoritative for facts. Role requirements and this round's topics stay distinct. A modeling JD cannot override an invitation focused on experimentation/product metrics; a technical JD cannot turn an HR screen into a coding exercise. Expected depth follows actual scope/level evidence, allowing bounded early-career design when stated. Unknowns remain visible.

Full materials require acceptance of the exact latest proposal hash/version and current input fingerprint. Materials match every section ID and minute allocation and include suggested practice prompts, steps, answer structure and self-checks. Calendar approval cannot substitute for plan approval. Source, budget, policy, priority, history or proposal changes invalidate stale acceptance. No silent content repair or automatic model retry is performed.

These are mechanical boundaries, not proof of realistic workload, truthful reasoning or good preparation. Semantic evaluation must inspect the actual content rather than reward a completed coverage ledger.

## Shared-input path

Start with the existing canonical handoff's selected `work` directory. Candidate/profile and opportunity inputs remain owned by their original modules. Use absolute paths for all cross-module flags:

```text
npm run interview:context-preparation -- capture --workspace <canonical-stage>/work --output <new-capture> --association verified --enrichment <captured-evidence.json>
npm run interview:context-analyze -- --request <new-capture>/request.json --output <new-isolated-analysis-output>
npm run interview:context-preparation -- inspect --workspace <canonical-stage>/work
npm run interview:context-preparation -- attach --workspace <canonical-stage>/work --context <analysis-output>/validated/preparation-context.json --expected-fingerprint <current-inspect-fingerprint>
npm run interview:context-prepare -- proposal --workspace <canonical-stage>/work --output <new-isolated-proposal-output>
```

`capture` reuses the canonical candidate/invitation snapshots, selected IDs, budget, preferences and confirmed profile priorities. It does not search the web or assert that explicit job selection proves mail identity. Association defaults to unresolved; select verified only after actually establishing the link. Enrichment is optional, with strict shape `{sources: Source[], research: ResearchUsage}` from the [context contract](interview-context-contract.md). It cannot replace candidate, invitation or preferences. Source-tier labels and retrieval counters require honest host capture; their syntax does not prove provenance.

Attachment checks candidate and invitation content, selected job/application/interview/company/role, current preferences/priorities, budget, source freshness and optimistic fingerprint before adding an exclusive `inputs/context/` directory. It does not replace canonical facts or shared opportunity state. Qualified model context is not independent verification; inspect its uncertainty before using it. A model result awaiting clarification should be resolved rather than treated as ready merely because an envelope exists.

For a standalone fictional/development context, `stage` creates a new working snapshot and empty local operational store:

```text
npm run interview:context-preparation -- stage --context <validated-context.json> --output <new-working-run>
```

This path retains captured evidence; it does not establish live freshness against canonical files or inherit Google/account learning state. It is not a second authoritative candidate/application store. Prefer capture/attach from the canonical handoff for ordinary use. One context is attached per run; changed context/budget needs a fresh stage. Same-context plan revisions create a new proposal version.

## Approval and materials

Display `proposal.md` in chat. Only after actual acceptance of that exact version:

```text
npm run interview:approve -- --workspace <work> --proposal <proposal-output>/accepted.json --decision accept --origin human_current_chat --evidence <actual-acceptance-reference> --output <new-approval-file>
npm run interview:context-prepare -- materials --workspace <work> --approval-id <returned-approval-id> --output <new-isolated-material-output>
```

The existing approval command is reused. Synthetic test decisions use `synthetic_test_script`, never human provenance. `--policy <json>` on context `stage` or `attach` records an explicitly selected policy with `required_areas`, `origin` (`default`, `user_instruction`, `synthetic_test_script`) and `reason`. Example fields describe actual configured choices, not authority to invent a user instruction. Policy is stored separately from analyzed evidence and bound into the new proposal. Historical proposals without the current policy hash must be proposed and accepted again before this new flow generates materials.

Node outputs must be outside Git/AGENTS/.agents instruction ancestors; business state can stay in the selected candidate workspace. The actor receives identical inline original sources and analyzed context for a given planning comparison, with a read-only sandbox and no authorized tools. Input mutation, command use, unknown source IDs, stale approval, wrong context and invalid coverage are retained as failures.

## Development comparison

`simple-instruction-v1` and `context-balanced-v1` share schemas, source/context access, coverage policy, settings and approval checks. The latter adds explicit adaptation guidance. This is a planning-node instruction contrast under supplied analysis, not an end-to-end baseline or measured benefit from retrieval/memory.

```text
npm run interview:context-preparation-pilot -- --context <frozen-context-1> --context <frozen-context-2> --output <new-isolated-pilot>
```

The pilot stages fresh business state per case/method, uses a predeclared alternating order and keeps first attempts. An optional `--synthetic-material-audit-interview <id> --synthetic-material-audit-method context-balanced-v1` declares exactly one fictional acceptance/materials audit before seeing outputs. It is not real-user authorization or a paired comparison of material quality. Semantic quality remains pending until independently evaluated.

The optional [bounded enrichment session](interview-enrichment.md) now collects JD/company evidence through the active Codex chat's search tool and in-app Browser and exports this flow's request format. Before enrichment/capture, [candidate-bound learning](interview-learning.md) can add explicitly selected account practice sources with source/status/freshness guards. [Workbench publication](interview-workbench.md) now links verified shared applications before staging and shows the selected run on a read-only interview detail page. Continuous inbox orchestration remains integration work; shared navigation and Google connection entry are implemented in the v2 workbench. The first development outputs cannot be treated as held out after inspecting them or revising the common coverage policy.
