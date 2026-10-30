# Preparation mode

Read the selected canonical candidate and opportunity through `npm run interview -- context`. Required input flags are `--settings`, `--invitation`, `--job-id` and either `--workspace` or explicit canonical paths. The full command contract and fictional example are in `../../../docs/interview.md`. Create the settings/payload from actual user instructions; ask only for missing budget, priorities or critical interview facts. Never substitute the shipped fictional example for a real candidate.

Verify the selected mail-to-role association. Retain unknown round details and employer question lists. Display source-based uncertainty instead of filling missing facts with generic assumptions.

For the context-aware preparation path, read [the context workflow](../../../docs/interview-context-preparation.md). Reuse existing captured JD/company sources; when evidence is missing, run [bounded evidence enrichment](enrichment.md) in this Codex chat before context analysis. It records the selected canonical handoff plus actually observed JD/company evidence, analyzes role/round/level, and attaches a versioned context before `interview:context-prepare`. Preserve explicit uncertainty for analogue JDs and unspecified hiring-manager topics. Account for common introduction/motivation, behavioral, role/round and interviewer-question preparation within the budget; follow the selected coverage policy rather than inventing personal motivations. Both paths use the same exact host plan acceptance. The commands below remain the historical preparation path; do not silently substitute prompts in an evaluation.

When relevant debrief history exists, use [candidate learning](../../../docs/interview-learning.md) before enrichment/capture only after explicitly establishing the selected candidate/account relationship. Retain the supplied practice sources through analysis and planning. Unbound runs start without that account's history; do not guess the link or treat a self-report as a resume fact or global ability rating.

Stage with the exact current token and a new output directory selected under the storage contract:

```text
npm run interview -- stage <same-context-flags> --expected-token <token> --output <absolute-new-run>
npm run interview:prepare -- proposal --workspace <absolute-new-run>/work --output <absolute-new-run>/proposal-v1
```

The second command invokes the model. Present `proposal.md` in chat and wait for actual acceptance of that exact version. A requested edit creates a revised proposal; prior acceptance does not transfer. When accepted:

```text
npm run interview:approve -- --workspace <run>/work --proposal <proposal-dir>/accepted.json --decision accept --origin human_current_chat --evidence <actual-approval-reference> --output <new-approval-file>
npm run interview:prepare -- materials --workspace <run>/work --approval-id <returned-id> --output <new-material-dir>
```

All paths in these Python commands must be absolute. Never fabricate human approval or treat a synthetic test decision as one. Changed canonical inputs, relevant history or proposal version require a fresh current proposal. Read generated materials before delivery; separate suggested practice from confirmed employer questions and candidate achievements.

For ordinary context-aware preparation, use `npm run interview:practice -- --workspace <absolute-run>/work --approval-id <actual-current-id> --output <new-absolute-output>` after exact plan acceptance. Read [simulation requirements](../../../docs/interview-practice.md). Ask the question directly with only essential inputs/examples and follow-ups. Put clarification guidance and strong-answer coverage under Method, followed by a distinct Sample answer. Coding answers need runnable Python, complexity and executable tests; cross-check examples independently before delivery. Keep personal facts truthful and missing details explicit. A larger question bank supplies alternatives within existing section budgets, never extra mandatory work or an invented interview round. Historical evaluation entrypoints retain their earlier format/protocol. Publish the fresh run; Plan and Practice remain separate views.
