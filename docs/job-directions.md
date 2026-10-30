# Job directions and approved resume routing

2026-10-29. This shared interface separates ordinary job shortlisting from application preparation. Matching owns directions and screening; Submission owns application resume binding, Review and lifecycle. Changes require the updated shared adapter code before teams exchange general-direction records. No runtime records are rewritten by this change.

## Direction is not a resume choice

The historical `JobRecord.category` / opportunity `category` field now accepts an open, nonempty direction label up to 120 characters, with control characters rejected. Examples include `Product Management`, `Design`, `Finance`, `Customer Success`, and existing `llm`/`recommendation` values. Matching policy `categories` and assessment `category` refer to those job directions. There is no fixed occupational enum to extend for each new role. Direction comparison ignores case; aliases still need consistent user-confirmed interpretation.

A job can be saved as `new` or `ready` without any resume manifest mapping. An explicit one-off request to save a known role uses the existing jobs upsert interface at `new`; it need not broaden ongoing search preferences or wait for a whole matching round. Pending eligibility remains a `new` research lead. User acceptance of a conditional shortlist does not waive factual questions or authorize submission. Unknown directions are not relabeled as LLM, and ordinary app usage must not ask users to approve schema/code changes.

## Explicit application binding

`resumes.json` contains approved attachment profiles. Its `category` is a profile key matching `[a-z][a-z0-9_-]{0,63}`, for example `pm_general`, independent of the job direction. New configured keys need no source-code enum change. PDF path resolution, duplicate-map checks, file/hash validation and batch preflight behavior are retained.

Before preparation, explicitly select a configured profile and run existing preflight:

```text
runPreflight({ category: "pm_general", jobUrl, profilePath, manifestPath })
createApplication(path, { ...exactJobIdentity, category: checked.category, cvFilename, ...applicationFields })
```

The existing Submission `category` argument/result keeps its meaning as the selected CV profile. Use the actual checked PDF's filename and verify its upload later. Never derive this key from a job direction, silently choose another resume, or treat shortlisting as preflight. An unavailable profile blocks preparation, not saving the job. The compatibility error `unsupported_category` in preflight means a malformed/unconfigured nonlegacy resume key; it no longer declares an occupational category globally unsupported. Existing missing legacy mappings still return `approved_cv_not_configured`.

Canonical storage is now:

```json
{
  "category": "Product Management",
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

Status uses the job direction even after application creation. Review continues to show the bound resume-profile category. Legacy labels LLM/REC/LOB remain unchanged; other labels are escaped text. User-requested UI v2 changes only this label fallback and tracked-row projection. Layout, navigation, filters and approval interactions remain fixed; `ui-contract-v1.json` is preserved and `ui-contract-v2.json` is active.

## Integration validation

Synthetic checks cover general-direction intake/feedback with an empty manifest, conditional PM shortlisting, arbitrary configured CV profiles through preflight/Review/submission, mixed old/new directions, immutable bindings, read-only legacy compatibility, missing-bind rejection and label escaping. Original Submission and UI interaction suites remain regression checks. This validates local interfaces; it is not an employer submission or a job-matching accuracy study.
