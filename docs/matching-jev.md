# TypeSafe Jev in Matching

Maintenance date: 2026-11-01. Owner: Matching. User explicitly requested using Jev. Application/Interview authorizations remain unchanged. The user-requested resume-routing extension adds optional canonical opportunity recommendation metadata; see [shared routing](job-directions.md).

## Production path

Website refresh or an overdue daily check saves one request for the connected Codex chat. After claiming it, the host checks `npm run matching -- provider-status`. Codex verifies leads from the configured SimplifyJobs repository and official employer pages and prepares the actual JD text, factual evidence, provisional decision and unresolved conditions. It calls the existing `matching publish` command with a version-2 round. That command now always invokes `publishJevMatchingRound`, then the existing deterministic storage gate. Missing configuration or provider errors block the update. There is no silent Codex-only production fallback.

Jev is a server-side HTTP dependency, not a browser executor, crawler, embedding index or replacement for the Codex host. The adapter uses the fixed official `https://api.typesafe.ai/v1/systemone` endpoint with redirects disabled. No runtime SDK dependency or MCP server was introduced. Install instructions for an optional agent skill are separate from this runtime integration.

## Setup and input

Set `TYPESAFE_API_KEY` in the host environment or project-root ignored `.env`. The environment wins over the local file. `TYPESAFE_MODEL` defaults to `jev-latest`; the resolved model is recorded per result. Configuration is read from this source installation, never a candidate-supplied `.env`. `.env.example` contains only blank/public configuration. `provider-status` reports configuration without making a paid call; `liveCheck: not_performed` describes that health check, not historical run status. Normal startup reports `matching_provider=typesafe` and whether a key is configured.

The production round has `version: 2`, the current `contextToken`, and the existing assessment fields for each role, plus:

- `jobDescription`: actual supplied/observed JD text, 100–50,000 characters; no invented requirements.
- `jobDescriptionReference`: original source/page/document reference, 1–2,000 characters.

A round contains 1–100 roles and must cover all managed open shortlist records. Provided-document analysis is allowed, but supplied text cannot prove live official-page availability. Host verification and original source references remain necessary. A model receipt does not prove employer availability or authorize Apply/Submit.

## Decisions and rules

Each role gets one request with four eligibility/ranking questions and a conditional resume-choice question:

| Question | Type | Use |
| --- | --- | --- |
| New Grad/seniority compatibility | Choice: eligible, ineligible, unknown | Distinguish established eligibility, an explicit conflict and missing evidence. |
| Mandatory qualification coverage | Choice: satisfied, gap, unknown | Missing mention is unknown, not an established negative; preferences are not mandatory requirements. |
| Direction alignment | Score: 0–3 | Rank evidenced role relevance. |
| Relevant documented experience | Score: 0–3 | Rank supported personal contribution; no inferred production ownership. |
| Approved resume to use, when configured | Choice: one option per supplied PDF plus none | Select from actual professional resume text; return the profile key and bind its exact approved digest. |

Code combines the two ranking scores with equal weights and sorts before the existing shortlist/company limits. The operational confidence threshold is 0.7 for all four answers. A confident explicit conflict can reject a lead; uncertain or unknown results become `needs_confirmation`. Prior explicit rejections, missing facts and questions cannot be erased by positive scores. Deterministic direction/location/work-mode/exclusion rules and protected applications still take precedence. Numeric experience/date comparisons remain host-normalized checks; Jev is told not to infer arithmetic from overlapping dates.

The weights, threshold and rubric are versioned initial defaults, not empirically validated calibration. Score is not hiring probability. Legacy/open direction labels are passed with the complete preference prose; ambiguous shorthand can lower confidence. Do not invent a label interpretation or lower a threshold just to make a test case pass.

## Privacy, failure and evidence

Only the canonical professional summary, skills, education, experiences, projects and publications are selected for the candidate payload, alongside preference prose, configured directions and the JD. Identity/contact objects, resume paths and application-only answers are omitted. Resume-routing state adds source-read professional resume text and profile keys; the host must omit contact headers from that text. This is a top-level projection, not a general personal-data redactor: free-text professional/preference fields may still contain unnecessary personal details. Review/minimize those before using real candidates. Keys are never included in model state, reports or website replies.

Before requests, the adapter validates version, JD presence, current context, duplicate identities/URLs, known identity changes, observed-date ordering and round completeness. It sends roles sequentially with a 20-second timeout and no automatic retries. A provider error stops further requests and publishes no partial shortlist. Invalid answers, out-of-range/nonfinite values and invalid probability totals are rejected. Errors expose only safe local codes, never upstream bodies. Explicit retry can incur additional charges and must not be described as replaying cached results.

Successful evaluation batches write private `data/matching-evaluations/<round-id>.json` receipts with context/input hashes, source reference, requested/resolved model, answers, scores and available token usage. They contain no API key or copied full profile/JD. Receipts attest evaluation only; the unchanged domain transaction independently checks freshness and protects existing applications before publication. A later context/publication failure may leave an evaluation receipt without a published round. No persistent matching cache or vector index is installed.

The raw version-1 `publishMatchingRound` function remains available for explicit offline fixtures, storage tests and historical mechanics demonstrations. It is not the production CLI path. `matching:demo` and the saved example checkpoints do not claim Jev model output.

## Verification and observed live scope

One authorized real TypeSafe request used a newly isolated, fully fictional candidate and an authored fictional graduate-retrieval JD. No real candidate, employer page, email, calendar or application was involved. `jev-latest` resolved to `jev-1.14.0`. The full provider-to-domain round returned successfully, wrote its evaluation receipt and saved a conditional `new` opportunity. It returned `needs_confirmation`: level eligibility was confident, while mandatory-qualification and direction judgments were below the threshold. This result was preserved without changing the rubric or making another paid request.

The response reported 1,459 input tokens and 106 output tokens. Observed local round duration was 0.194 seconds; this one observation is not a throughput, billing or matching-quality benchmark. Diagnostic artifacts are in `/private/tmp/jev-smoke-HqWFss/`, outside saved workspace discovery. No further live provider calls were made for regression testing.

Offline tests use fictional fixtures and intercepted HTTP responses. They cover the public CLI's mandatory Jev path, answer-driven ranking before limits, private-field projection, unknown/low-confidence handling, confirmed conflicts, deterministic exclusions, missing credentials, invalid responses, HTTP failures/timeouts, complete rounds and source changes during inference. Mocks prove integration behavior, not provider accuracy. Final verification passed 548 TypeScript tests across 54 files, type checking, UI v37, boundaries and distribution checks. An initial boundary check ran before this referenced document was created and failed on that missing link; the completed-tree rerun passed. Formal matching quality and real-candidate runs remain separate work.

## Primary references

- [Official System One API](https://docs.typesafe.ai/api/system-one)
- [Choice](https://docs.typesafe.ai/primitives/choice) and [Score](https://docs.typesafe.ai/primitives/score)
- [Coding-agent integration boundary](https://docs.typesafe.ai/introduction/coding-agents)
- [Known Jev 1.13 limitations](https://docs.typesafe.ai/model-jaggedness/jev-1.13) are version-specific guidance, not a claim about measured 1.14 accuracy.

## Resume-choice extension — 2026-11-01

Rubric `matching-jev-v2` adds `resumeEvidence` to the version-2 publication envelope, covering every configured PDF with its category, exact sha256 and source-read professional text. Coverage, duplicate keys and current PDF bytes are checked before requests; bytes are checked again after inference. Missing evidence is a blocker rather than an invitation to invent a description. With no resumes configured, no choice question is sent and the opportunity records `no_resumes` while retaining ordinary matching eligibility.

The additional `selectedResume` Choice returns `resume:<profile-key>` or `none`, confidence and the exact probability-key set. The adapter rejects invalid options, malformed distributions or a choice inconsistent with the distribution. Confident selections become `matched`; lower confidence becomes `needs_review`; confident none becomes `no_match`. Selection status does not turn a qualified job into a rejection or grant permission to apply. Each result/receipt carries `resumeRecommendation`; the complete structure and Submission handoff are documented in [shared routing](job-directions.md).

This extension was tested with intercepted provider-shaped responses and fictional PDFs, including two different resume choices in one batch, no-fit/low-confidence results, incomplete evidence, malformed choices, stale inputs, PDF mutation during inference and changes after queueing. No additional paid Jev request or real-candidate run was made for this extension. Prior live observations above apply to the four-question rubric only and do not establish new resume-selection accuracy.


## Flexible search scope — 2026-11-01

Rubric `matching-jev-v3` sends current structured direction/location/work-mode scope as `currentSearchScope`. Empty category/location filters are explicit flexibility, not unknown facts. Current scope overrides historical preference prose for those dimensions. With flexible directions, Jev scores the actual responsibilities against documented candidate background without requiring user-authored target titles. Role names and direction labels still come from source-backed job observations; this does not add a separate pre-search title generator. Resume routing is unchanged. No fresh evaluation or paid provider call is implied by a preference save.
