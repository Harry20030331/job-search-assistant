# Exact source references in preparation

Maintenance date: 2026-10-30. The W12 virtual lifecycle baseline produced `invite: <s01@example.invalid>` where the actual source ID was `invite`. Its next-session plan was correctly rejected. This change helps the model produce valid references while preserving strict host validation and the original failure.

## Implementation

Preparation generation now receives a canonical source-ID catalog. The output JSON schema restricts every `source_refs` and nested `basis_refs` item to the currently available IDs. Mail headers, URLs, filenames and descriptive labels cannot replace those aliases. The host still rejects invalid references; no output string is normalized, repaired or silently accepted.

For tool-reading preparation, catalog metadata identifies the actual read interface: reserved `profile`/`application` come from `context.get`, Markdown evidence from `documents.read`, mail from `mail.read`, and raw reports from `history.read`. The local mail reader filters its optional `message_id` by the mail header, not the source alias, so the catalog uses an unfiltered read of the explicitly selected run's mail and selects the returned `source_id`. Structured memory access remains restricted to group D. Catalog membership comes from current business state, not evaluator gold. IDs alone do not establish that a citation is semantically appropriate.

Missing optional preparation priorities are not treated as a missing candidate profile. When budget and interview context are available, the model may suggest evidence-grounded focus and must label it as a suggestion rather than an established personal preference. It must still ask for genuinely missing critical facts.

Current inline context-aware plans and direct-practice materials use the same enum restriction with the captured request's source IDs. Their evidence remains inline: the prompt does not instruct those nodes to call tools. Manifests record `source_reference_contract: source-id-catalog-v1`, the source-reference policy revision and implementation hashes. Tool-reading production preparation additionally saves `source-reference-contract.json` with the actual catalog. Policy revision 3 includes correct reader mapping.

## Baseline preservation and experiments

`simple-instruction-v1` explicitly selects `reference_mode=legacy`, preserving its earlier preparation prompt/schema and omitting the extra catalog. A separately named `source-id-catalog-v1` workflow method enables the intervention. Run it in a new directory:

```text
npm run interview:benchmark -- --run <new-private-absolute-directory> --case W12 --method source-id-catalog-v1
```

The earlier baseline remains 0/1 for the retained W12 trial. The first complete catalog-method trial passed W12's scheduling, approval/material binding, debrief and next-session proposal checks in 246.922 seconds over six Codex invocations. This was the initial catalog/schema revision; later reader metadata and optional-priority clarification were separately checked at the failed production node. Do not describe it as a full lifecycle rerun of every later policy revision or as evidence of a general effect size.

The first production-path probe returned `needs_input`: it attempted to read reserved `profile` through `documents.read` and treated absent optional priorities as critical. That attempt remains preserved. After adding reader guidance, the same failed-state production node produced a valid version-2 plan in 33.281 seconds. A final policy-revision-3 probe and regression results are recorded in the private repair report. Original baseline files and first attempts are retained; no real Google operation or real-user acceptance was involved. All probes use fictional evidence, and the new plans await actual acceptance before materials.

Tests verify enums across proposal and material reference fields, actual catalog read operations, invalid-output rejection without repair, and the explicit legacy baseline opt-out. The same code does not rate semantic quality or prove that every source choice is relevant.

Final verification: the policy-revision-3 production probe generated a valid next-session plan in 41.515 seconds; every reference belongs to the supplied catalog and the original failed workspace is unchanged. The complete Python regression suite passed 248 tests. UI contract, TypeScript type checking, boundary/distribution scans and whitespace checks passed. Private evidence is retained under `source-id-catalog-final-recheck-20261030`, alongside the earlier probe and full workflow runs. The plan remains awaiting acceptance; no materials were generated or real-user approval fabricated by this probe.
