# Job directions and approved resume routing

Updated 2026-11-01. This shared interface separates ordinary job shortlisting from application preparation. Matching owns directions and screening; Submission owns application resume binding, Review and lifecycle. Changes require the updated shared adapter code before teams exchange general-direction records. No runtime records are rewritten by this change.

## Direction is not a resume choice

The historical `JobRecord.category` / opportunity `category` field now accepts an open, nonempty direction label up to 120 characters, with control characters rejected. Examples include `Product Management`, `Design`, `Finance`, `Customer Success`, and existing `llm`/`recommendation` values. Matching policy `categories` and assessment `category` refer to those job directions. There is no fixed occupational enum to extend for each new role. Direction comparison ignores case; aliases still need consistent user-confirmed interpretation.

A job can be saved as `new` or `ready` without any resume manifest mapping. An explicit one-off request to save a known role uses the existing jobs upsert interface at `new`; it need not broaden ongoing search preferences or wait for a whole matching round. Pending eligibility remains a `new` research lead. User acceptance of a conditional shortlist does not waive factual questions or authorize submission. Unknown directions are not relabeled as LLM, and ordinary app usage must not ask users to approve schema/code changes.

## Explicit application binding

`resumes.json` contains approved attachment profiles. Its `category` is a profile key matching `[a-z][a-z0-9_-]{0,63}`, for example `pm_general`, independent of the job direction. New configured keys need no source-code enum change. PDF path resolution, duplicate-map checks, file/hash validation and batch preflight behavior are retained.

During Matching, Jev selects a configured approved resume from its actual professional text. Status shows the per-job recommendation. On Apply, resolve that saved key/hash for each job and run existing preflight:

```text
runPreflight({ category: "pm_general", jobUrl, profilePath, manifestPath })
createApplication(path, { ...exactJobIdentity, category: checked.category, cvFilename, ...applicationFields })
```

The existing Submission `category` argument/result keeps its meaning as the selected CV profile. Use the actual checked PDF's filename and verify its upload later. Never derive this key from a job direction, silently choose another resume, or treat shortlisting as preflight. An unavailable profile blocks preparation, not saving the job. The compatibility error `unsupported_category` in preflight means a malformed/unconfigured nonlegacy resume key; it no longer declares an occupational category globally unsupported. Existing missing legacy mappings still return `approved_cv_not_configured`.

Canonical storage is now:

```json
{
  "category": "Product Management",
  "resumeRecommendation": {
    "profileKey": "pm_general",
    "sha256": "<exact approved PDF digest>",
    "status": "matched",
    "confidence": 0.9,
    "contextToken": "<current matching context>",
    "evaluatedAt": "<ISO timestamp>"
  },
  "application": {
    "resumeCategory": "pm_general"
  }
}
```

This is an abbreviated interface illustration, not a complete valid opportunity. `mergeApplications` writes the binding when an application is created. `projectApplications` hides the storage-only `resumeCategory` field and exposes it as the existing `ApplicationRecord.category`. Draft headers and identity hashes continue to come from that application projection. Once an application exists, normal updates cannot change its bound resume profile or role identity. Existing approval, synchronization, evidence and one-time authorization requirements remain in force.

## Legacy and mixed data

- Existing application records without `resumeCategory` may inherit their historical `llm`, `recommendation` or `robotics` value for read compatibility. Reading does not rewrite records or approvals.
- A new/general-direction application missing its resume binding is invalid; no route is guessed. New application writes always persist an explicit binding.
- Existing `createApplication`, preflight, Review and lifecycle signatures remain usable. Standalone application trackers still use `category` as their CV key. Canonical adapters handle the direction difference; legacy CSV recovery retains its previous equality checks.
- Mixed LLM and PM applications in one store are supported. Matching cannot overwrite started applications. Success evidence, hidden state and draft snapshot checks retain their existing controls.
- Teams must pull the updated shared readers/writers before reading new general-direction data. Older binaries with the occupational enum cannot read those new records; this is not a promise of forward compatibility with unupdated code.

## Sources and presentation

The new `official-careers` source identifies actual official-site observations independently of role direction. Other source IDs keep their meaning. Do not attribute a PM role found elsewhere to a technology repository.

Status keeps Direction and Resume separate. A tracked application displays its immutable bound profile, regardless of later Matching suggestions. A shortlisted job displays a current confident recommendation, or an actionable Add resume / No suitable resume / Review match / Refresh match / Not matched yet state. UI v40 uses the supplied Morandi palette and no global resume picker. No resume is required to save or inspect a lead.

`resumeRecommendation` is optional on canonical opportunities and job projections. Its strict schema is in `src/matching/resumeRecommendation.ts`. Status, Matching and Submission adapters ship together; Interview retains its existing candidate/application handoff. Legacy records remain readable without migration or inferred bindings. CSV writers reject recommendations rather than silently losing their metadata. The category of the job is still the direction; `application.resumeCategory` remains the Submission-owned attachment binding.

The production Jev request uses `resumeEvidence` for every current manifest entry: `category`, exact `sha256`, and source-backed professional `text`. The host reads actual PDFs and omits contact headers, never fabricating a summary or choosing from keys alone. The adapter checks evidence coverage, PDF signatures and hashes before any provider call and rechecks bytes after inference. Jev's conditional `selectedResume` Choice has one option per approved key plus `none`; invalid/missing/unconfigured choices abort publication. Confidence below 0.7 yields `needs_review`, not an automatic attachment. Other states are `matched`, `no_match`, and `no_resumes`. This routing judgment does not change job eligibility or authorize application work.

Apply accepts job IDs without a batch CV key. A selected real workspace resolves each current recommendation and pins `target.resumeCategory` and `target.resumeSha256`; one batch may contain different resumes. Preflight runs before saving targets, and queued work checks the exact PDF again before execution/claim. Old-context suggestions, invalid hashes and conflicting manual keys fail visibly, without partially creating a batch. Existing applications retain their saved profile on retries. Content approval, final Submit and live upload verification remain separate.

## Integration validation

Synthetic checks cover general-direction intake/feedback with an empty manifest, conditional PM shortlisting, arbitrary configured CV profiles through preflight/Review/submission, mixed old/new directions, immutable bindings, read-only legacy compatibility, missing-bind rejection and label escaping. Original Submission and UI interaction suites remain regression checks. This validates local interfaces; it is not an employer submission or a job-matching accuracy study.

Maintenance — 2026-11-01: User explicitly moved resume selection into Matching and requested a visible Resume tag on Status. This is the coordinated shared adapter change across Matching, opportunity storage, Status and Submission; no shared candidate fact schema, Interview schema or approval contract changes. All affected readers/writers are updated together for module-owner review. No commit or push is authorized.


## Explicit flexible preferences — 2026-11-01

The Profile and first-use confirmation forms offer **I’m flexible — match roles to my background** and **I’m flexible about location**. The website requires explicit flexibility before accepting an empty direction filter. Checked options normalize to empty `rules.categories` / `rules.locations`; unchecked options require specific values. Additional feedback is optional. Existing populated filters remain readable and are not rewritten until Save preferences or initial confirmation. No target job-title list is required. Existing employment titles remain canonical candidate facts.

An empty direction filter no longer rejects every job. Jev receives authoritative current scope and evaluates responsibility/background fit for flexible searches. The host derives source-backed job titles/direction labels from actual listings. Matching, location eligibility, work mode, excluded companies/jobs, shortlist limits, New Grad/source boundaries and all preparation/submission approvals remain enforced. Location flexibility never supplies relocation consent or work authorization. This coordinated change covers Matching intake, preference persistence, Jev input, website intake/Profile, and the existing publication gate; candidate and opportunity record shapes and resume bindings are unchanged. Module owners review these shared adapter semantics together.
