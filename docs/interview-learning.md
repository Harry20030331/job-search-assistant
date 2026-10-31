# Candidate-bound debrief retrieval

Maintenance date: 2026-10-26. `candidate-learning-v1` connects an explicitly selected account learning store to canonical-candidate preparation. It makes no Google or model calls, changes no shared schemas, and adds no product UI.

## Identity and ownership

The shared handoff now includes local `candidateSource` metadata: the absolute selected v2 profile path, or the shared profile path behind a v3 descriptor. Python verifies that this path is a versioned canonical source with the same identity as the selected profile. The local anchor combines that resolved path with an identity-content hash. Different job descriptors for the same v3 shared profile can reuse a binding; identical names at different paths cannot. This is a host-selected source identity, not a global person identifier. Moving sources or changing identity fields requires a new explicit binding. Experience updates need a fresh stage, but do not by themselves change this identity anchor.

The host creates an immutable binding file after establishing which account belongs to this candidate. It contains the canonical anchor, selected learning workspace, hash of that store's account identifier, time and assertion provenance. Do not infer ownership from name, sender or role. The assertion is not cryptographic proof of ownership or independently authenticated consent. User chat or a declared synthetic fixture supplies the evidence; never relabel synthetic evidence as human approval.

Bindings remain host-only local files outside actor inputs. Tokens, inbox databases and unrelated account history are not copied. A binding selects one learning store; there is no automatic discovery or merge of account stores. A separate append-only revocation sidecar invalidates every run using that binding. Replacing a link requires revoking the old binding and explicitly selecting a new one. No application, calendar or preparation approval is implied by this link.

## Commands and order

First stage the selected canonical handoff through `npm run interview -- context|stage`. Historical handoffs without `candidateSource` remain usable without memory; restage before enabling account learning. After the account has an existing learning store, the host constructs these commands using absolute private paths:

```text
npm run interview:learning -- bind --workspace <canonical-stage>/work --learning-workspace <selected-account>/learning --output <new-private-binding.json> --origin human_current_chat --evidence <actual-candidate-account-link-reference>
npm run interview:learning -- attach --workspace <canonical-stage>/work --binding <private-binding.json> --scope <private-scope.json>
```

Scope JSON, chosen from the upcoming interview's actual requirements, has this shape:

```json
{
  "topics": ["experimentation", "product_metrics"],
  "max_age_days": 180,
  "limit": 5,
  "reason": "The selected invitation explicitly focuses this round on experiment design and product metrics."
}
```

The last three fields shown are configurable; age and limit default to 180 days and 5 notes. The upcoming role and round come from the selected application snapshot, not free-form retrieval arguments. Historical debriefs must use truthful role/topic labels. Role matching remains exact after the existing role normalization; the selector does not silently equate job-title variants or infer product-versus-modeling DS from titles. Topics use the shared `memory-topics-v1` policy described below. A missed title/topic alias is a recall limitation to measure, not permission to rewrite historical evidence.

Attach learning **before** enrichment/context capture, analysis and the first proposal. Then use the existing [enrichment](interview-enrichment.md) or [capture/attach](interview-context-preparation.md) flow. Capture automatically includes the selected `practice` sources; web enrichment preserves them separately from JD/company sources and web usage counts. External enrichment cannot inject practice records. Bound canonical context attachment requires the exact selected practice-source set and contents. Standalone fictional context staging remains a captured-evidence path without live account binding.

```text
npm run interview:learning -- revoke --binding <private-binding.json> --origin human_current_chat --evidence <actual-disconnect-reference>
```

The CLI records a host assertion. The coordinating skill must obtain that actual assertion in chat; merely passing an origin string is not consent enforcement.

## Retrieval and freshness

The account database is opened read-only and read within one SQLite transaction. This adapter filters persisted observations without calling another LLM, a vector service or the older FTS retrieval API. An eligible observation must:

- Be active and source-linked to an original interview/practice debrief with a consistent historical role/company/round.
- Match the upcoming normalized role and at least one requested topic.
- Have no conflict between two known rounds. Unknown rounds remain unknown.
- Fall within the configured age window measured from the activity's occurrence, with no future record/note timestamps.

Candidates are ordered by topic overlap, exact known round, same company, recency and stable memory ID; at most five are exported. Cross-company learning can be relevant practice evidence, but never confirms what the next employer asks. Each `practice` source retains the original text, historical subject/date/mode/provenance and one selected active observation. Derived observations remain model interpretations of self-reports; suggested practice remains advice. Other text in the original record is historical context, not a renewed current weakness. No mastery or employer-outcome claim is inferred.

The work directory stores only `inputs/learning/snapshot.json`, plus a host guard in its existing SQLite metadata. It does not import the account's history/memory tables. Snapshot content, retrieval scope, selected interview, binding hash and account learning digest are bound to proposal fingerprints. The usual source check additionally rejects revoked/changed bindings, changed account identity, changed raw or derived learning, altered snapshots, and expired/reordered retrieval results. These checks run even when the canonical stage has no inbox-thread guard. Exact plan approval is therefore invalidated before a material model call when learning changes.

Any account history/memory content change conservatively invalidates the snapshot, including an unrelated new record or an empty retrieval becoming relevant. Restage, select current learning, analyze again and obtain approval of a new proposal. This avoids silently missing newly relevant evidence; a finer invalidation policy is not implemented. Database reads are linear in stored history/observations, so this is not a memory-scaling solution.

## Shared topic policy

Maintenance note, 2026-10-30: `interview/topics.py` supplies `memory-topics-v1` to debrief writes, ordinary memory writes/search and candidate-bound selection. Explicit synonyms such as `A/B testing`, `ab_test` and `experiment_design` normalize to `experimentation`. Role aliases remain a separate policy; an unknown topic is retained rather than guessed from a job title.

A generic stored `evaluation` label is refined only when that selected observation explicitly names a domain: randomization units, A/B testing or network interference support `experimentation`; product/activation/retention metric definitions support `product_metrics`; model evaluation, hallucinations or citation metrics support `ml_evaluation`. Generic evaluation is not a synonym for any of these. New debriefs refine from the exact source quote; historical retrieval uses the selected observation, never suggested practice or unrelated sentences in the raw report. Correctly scoped corrections can supersede an old alias/generic note without erasing it; explicit cross-domain revisions remain rejected.

Historical records and FTS rows are not migrated during retrieval. The returned practice evidence includes a separate `retrieval_topics` view and policy version alongside the unchanged stored note. Ordinary FTS search supplements lexical results with read-only topic matches from the explicitly selected store; this is linear work, not a memory-scaling optimization.

New learning snapshots record the topic-policy version. Snapshots created before this policy, or under a different version, are stale: create a fresh staged run, attach current learning, analyze context and obtain acceptance of a new proposal. Do not rewrite snapshot hashes or reuse an old approval. Runs without account-learning snapshots are unaffected.

The regression reproduces the three-resume DS miss: an old `evaluation` note about a randomization unit and network interference now matches an experimentation scope. Its source databases and original topic remain unchanged. A fresh explicitly bound fictional candidate/account run captures one practice source with zero model or Google calls. The result verifies recall and provenance, not a preparation-quality or interview-outcome improvement.

## Evaluation boundary

Fictional tests cover same-name candidates, two accounts, role/round/topic exclusion, status and correction handling, immutable raw history, read-only retrieval, source preservation and stale approval/model-call blocking. They validate operational boundaries, not semantic improvement. A [first actual Codex integration](interview-learning-pilot.md) also exercised capture, analysis and a source-linked proposal with two selected notes, without establishing comparative benefit. Compare memory designs later on matched tasks with the same raw-history access, model, budget and other components; include no-history and raw-history-only baselines, irrelevant history, corrections and conflicting self-reports. Score supported reuse, harmful stale reuse, retrieval precision/recall, preparation utility and latency separately. Existing development cases and judge-control results are unchanged.
