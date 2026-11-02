# Flexible preferences v50

Maintenance date: 2026-11-01. User explicitly requested flexible job direction/location choices and no requirement to manually enumerate target job titles. No commit or push authorized.

| Before | After |
| --- | --- |
| Mandatory direction list | Explicit flexible-direction checkbox, or optional user-chosen specific directions |
| Location flexibility implied by blank text | Explicit flexible-location checkbox with clear specific-location alternative |
| Required extra preference prose | Optional feedback |
| Flexible directions rejected every candidate job | Empty category filter removes that deterministic restriction; Jev evaluates actual work/background fit |

The current structured scope is sent to Jev rubric v3 and takes priority over historical preference prose for direction/location/work mode. No separate job-title generator is claimed: the host still supplies observed role titles and direction labels; Jev evaluates those real job responsibilities and routes approved resumes. The original New Grad/source boundary, exclusions, qualification checks, limits, context token and application gates remain unchanged. Location flexibility is not relocation consent or a new work-authorization fact. Existing employment titles remain candidate facts, not search targets.

All owning adapters are updated: canonical preference/intake validation, Matching deterministic category gate, Jev payload, search-task guidance, Profile save/read behavior and source-first intake confirmation. Candidate and opportunity shapes remain unchanged. Historical records with populated filters are still supported; older clients rejecting empty category filters need the updated reader. No existing runtime preferences were saved during visual validation.

580 tests across 56 files passed, including flexible save/reload/specific round-trip, stale context, preserved facts/resumes/exclusions, no-title source-confirmed intake, real publication-gate semantics and intercepted Jev requests with explicit flexible scope. TypeScript, boundaries and distribution checks passed. In-app Browser verified both checkboxes and showed required specific fields when unchecked and hidden disabled fields when checked. Initial intake scripts compile and accept source-confirmed flexible setup. No paid Jev call, new discovery round or real employer action was performed.

Screenshot: `beyondautofill-profile-flexible-v50.png` in the task visualization directory. v49 and earlier manifests remain intact. Module owners review the updated preference semantics together.
