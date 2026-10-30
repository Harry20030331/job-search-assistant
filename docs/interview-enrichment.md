# Bounded interview evidence enrichment

Maintenance date: 2026-10-26. Implemented protocol: `interview-enrichment-v1`. The active Codex chat chooses and executes research using its search tool and in-app Browser. Python supplies bounded actions, identity/evidence checks, durable receipts and a direct context-request export. It does not fetch pages, start another browser, call an external LLM or implement a replacement agent loop.

The [first execution observations](interview-enrichment-pilot.md) preserve eight offline protocol checks and a public-page-to-proposal integration, including the first downstream context validation failure and a separately versioned correction.

## Ownership and entrypoints

Business code: `src/interview/python/interview/enrichment.py`. Independent scripted protocol checks: `evaluation/enrichment_scenarios.py` and eight fictional scenarios in `benchmark/enrichment-v1/`. The operational entry routes from [preparation](../skills/interview/references/preparation.md) to the narrow [enrichment reference](../skills/interview/references/enrichment.md).

The selected canonical `work` retains candidate/opportunity ownership. Research is placed in a new explicit directory outside `work/inputs/`, with a source-bound base request, `binding.json` and `session.sqlite3`. SQLite transactions serialize action reservation and receipt insertion. Research never creates a new shared job/application record, updates availability, grants plan approval, sends mail or writes a calendar event.

The shared opportunity currently supplies an official URL and note, not full JD text. Reuse actual previous captured JD/company evidence via an optional `--seed` enrichment file; seed counts/provenance remain recorded separately from new session actions. Never convert a title, note or search snippet into a captured JD. Reused content still needs relevance/freshness review, including closed postings that remain useful preparation evidence.

## Run in the existing Codex chat

After optional Python setup, use absolute cross-module paths:

```text
npm run interview:enrich -- start --workspace <canonical-work> --output <new-research-dir> --association verified --policy <host-policy.json>
npm run interview:enrich -- next --session <research-dir>
npm run interview:enrich -- record --session <research-dir> --input <actual-receipt.json>
npm run interview:enrich -- finish --session <research-dir>
npm run interview:context-analyze -- --request <research-dir>/request.json --output <new-analysis-output>
```

The agent constructs these payloads; ordinary users do not configure JSON or a second AI account. Preserve `association=unresolved` unless the invitation/opportunity link is established. Known requisitions can be prebound with `--requisition`; a title-only search cannot establish a different recovered posting as exact.

`next` reserves one browser open/read or one search action. Repeating it before a receipt returns the same action. Failed actions still consume their reserved budget. Default/hard maximum per session: six searches and eight page captures. Search results contribute at most two queued leads per action; no snippet becomes evidence. The planner tries the selected canonical URL, exact-role searches, same-company analogues, other-company analogues, company context and optional public reports. It stops early when exact JD and company context are adequate, or honestly ends with missing evidence when actions/budget run out. `finish` can stop earlier if no action is pending; it does not certify exhaustive search.

An already-open tab can supply a reserved read without reloading. `opened_pages` counts reserved page capture attempts, not unique physical navigation requests. Preflight discovery or additional sessions must be disclosed separately; session counters are not a global lifetime or provider-billing meter.

## Host policy and authority boundary

Policy fields are `max_search_queries`, `max_opened_pages`, `official_scopes`, `include_public_reports` (default false) and optional `analogue_query`. Scope declarations contain:

```json
{
  "company": "Harbor Relay",
  "url": "https://careers.harbor.example.test/",
  "include_subpaths": true,
  "verification_ref": "Actual host observation establishing employer ownership"
}
```

This is an illustrative fictional scope, not an observation or configured account. Supply a truthful verification reference. The selected canonical official URL is allowed only as an exact URL by default; it never trusts an entire shared ATS host. Additional scopes are frozen at session start. Prefixes respect host and path boundaries; `/harbor` does not trust `/harbor-evil`. New verified scopes require an explicitly new session/policy, retaining prior research and counters in provenance rather than pretending that extra research was free.

URLs must use HTTPS without credentials, IP literals, local hostnames or custom ports. Only known tracking parameters and fragments are removed for identity comparison; requisition-bearing query parameters remain. These checks do not prove employer ownership, safe DNS resolution, page truth or absence of a phishing site. The active agent still verifies the official source using actual browser evidence. Browser permissions/policy remain authoritative; the Python module has no outbound page transport to bypass them.

## Receipt contract

Every receipt includes `action_id`, `executor`, `observation_ref`, timezone-aware `captured_at` and `status` (`ok`, `unavailable` or `blocked`). The first receipt is immutable and identical replay is idempotent. Future timestamps, mismatched actions and replacement receipts are rejected.

- Search receipt: `executor=search_tool`, actual `results` of `{url,title,snippet?}`; no source text or evidence decision. Capture the real query result reference.
- Page receipt: `executor=codex_in_app_browser`, actual `final_url`, optional title, visible `text` or explicitly identified bounded excerpts, and optional `decision`. Do not label hidden page state, API output or a search-engine copy as browser text.
- Failure receipt: actual failed executor/observation, with no evidence/closure decision. A connection failure is not evidence of closure.
- `offline_fixture` executor is permitted only in explicitly initialized `--mode offline_fixture` sessions. This is simulated protocol testing, never live capture.

Decision fields: `kind` (`exact_jd`, `same_company_analogue`, `other_company_analogue`, `company`, `interview_report`, `reject`), `company`, nullable `role`, exact `company_quote`, `role_quote`, `content_quote`, `rationale`, `limitations`, optional `selected_requisition`/`requisition_quote`, and `availability`/`availability_quote`. The role quote is the exact title span, rather than a paragraph containing a different role. Company and substantive content quotes must occur in the captured text. An availability claim needs a captured quote and still does not change the canonical record.

Exact selection requires the canonical URL or prebound requisition, matching employer/title, verified official scope and source quotes. Recovered title similarity is insufficient. Same/other-company analogue decisions must use the correct employer relationship and explicit differences/limitations; they never bind the analogue to the selected job ID. Those guardrails do not perform semantic role-family comparison automatically. Reports require opt-in and anecdotal/date/role limitations and remain `public_report`, not employer-confirmed instructions.

Invalid evidence decisions are preserved as rejected observations without a selected source. Failed actions and all original texts remain in the session database. Source origin, source relevance, honest observations and semantic inferences are host assertions, not established merely by quote matching, URL prefixes or hashes. Retrieved instructions remain data; no webpage text changes policy, identities or approval state.

## Export and preparation integration

`finish` prioritizes retained exact evidence, then same-company analogue, then other-company analogue, while retaining company/report sources. It exports `enrichment.json`, `request.json` and `summary.json`, preserving rejected observations and limitations in the audit. Relationship labels and captured text are passed to the existing context request; decision-specific notes remain in the summary for host review. Missing evidence is represented as missing, without an invented JD or level.

Feed `request.json` directly to the existing context analysis node. For ordinary canonical use, attach the validated context to the original work using the existing optimistic fingerprint checks, then generate a proposal. A standalone fictional context can instead use existing `context-preparation stage`; it does not establish shared/account integration. No materials are generated before exact plan acceptance. Source/identity/budget changes invalidate research and later proposal approvals.

Context-analysis node protocol v1.2 clarifies an already-enforced distinction for both methods: literal confirmed candidate facts cite only canonical candidate sources; candidate-to-JD/company fit is inferred with both anchors. This follows a retained v1.1 live-integration validation failure. It changes the common prompt, not the evidence validator, and is not pooled with older model experiments or reported as a method improvement.

## Evaluation boundaries

```text
npm run interview:enrichment-checks -- --output <absolute-new-private-run>
```

Eight scenarios cover exact, closed exact, same/other-company analogue, no result, conflicting requisition, wrong-role near match and injected page instructions. The runner supplies scripted host decisions and frozen fictional text; it makes zero model/browser/Google calls. Checks measure protocol identity, selection, budget, persistence and canonical-state isolation. Injection text remains inert at the code layer; this does not establish model-level resistance. These are not agent retrieval success rates or human-reviewed gold labels.

Keep actual browser integration separate, recording preflight actions, session counters, exact receipts, source/implementation hashes, any model failures and approved outputs. The browser controller's tool API is supplied by the active Codex environment, not a portable standalone Python search service. Full unattended email orchestration, global research budgets, account-to-candidate memory binding and shared lifecycle/UI publication remain outside this feature.
