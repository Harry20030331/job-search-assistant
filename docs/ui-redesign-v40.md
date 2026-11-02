# UI v40: focused color, single-user entry and per-job resumes

Maintenance date: 2026-11-01. The user requested a Morandi palette, one-user startup and moving resume selection into Matching. They then clarified that only pale pink, pale blue and purple should remain. All changes stay uncommitted on `main` for review; earlier unrelated Matching/Jev work is preserved.

## Presentation

| Before | After |
| --- | --- |
| Black/white working surfaces followed by an unaccepted five-color draft | A three-color palette: pale pink `#D4B9B9`, pale blue `#A8B6C4`, muted purple `#C2B2C2`, with neutral surfaces and dark readable text |
| Green active navigation and sand update panel | Soft blue navigation, pale pink update panel, consistent purple active states and primary actions |
| Profile-dependent five-color resume tags | One purple resume-tag treatment; unresolved routes use a softer pink treatment |
| Repeated Welcome/candidate choice and a separate Home destination | Source-first Profile setup once, then direct Status on root visits and restarts; brand navigation opens Status |
| One selected resume for an entire preparation batch | Resume column on Status and an independently resolved key/hash for each job on Apply |

The actual application, review, interview and account surfaces share the same three-color system. Required-field and error semantics remain visible; colors do not replace text. Native controls, focus rings, reduced motion, local table/navigation scrolling, mobile input sizes, safe-area clearance and the separate pinned Submit action remain in place.

## Startup and resume ownership

`local/active-workspace.json` is a private path pointer to the explicitly confirmed/resumed real workspace, not a second profile or job store. Missing remembered data opens a recovery screen without creating or switching candidates. Fictional examples cannot overwrite the pointer. Existing source confirmation and candidate-scoped chat routing remain in force.

The source-reading host supplies actual professional PDF text and exact manifest hashes to the version-2 Matching request. Jev returns the resume Choice; the publisher validates its configured options and saves the current key/hash/confidence/state. Missing evidence blocks publication rather than generating a guess. No suitable/uncertain/no-resume states do not reject an otherwise matching job, but cannot automatically authorize an attachment. Uploading another resume changes the context and requires a new matching round.

Submission resolves each job's saved current route on Apply, preflights the PDF and pins its digest. A mixed batch can use different resumes. Queued work verifies its pinned version again before a runner or chat can process it. A started application keeps its existing attachment binding; Matching cannot replace it. Approve content and final Submit retain their exact-content authorization gates. See [the shared interface](job-directions.md).

## Validation

- Type checking, structural boundaries, distribution checks and whitespace checks passed.
- The complete suite passed 569 tests across 55 TypeScript files, including 21 added behavior cases for the startup/resume extension.
- UI v40 is a controlled successor after explicit user design direction; v39 and all earlier manifests are retained.
- In-app Browser measurements covered initial setup, Status, Review, Profile and Interview at 320, 390, 768, 1280 and 1440px. All 25 route/width combinations matched the requested width and had no document-wide horizontal overflow. Temporary viewport overrides were reset.
- Browser inspection verifies the final three-color presentation, Resume column, Status filtering, initial source setup and responsive Review. Automated HTTP tests verify direct Status return after restart, fictional-example isolation, mixed-resume Apply batches and actionable changed-PDF conflicts.
- Tests use isolated fictional data and intercepted provider-shaped answers. No additional paid Jev request, real-candidate matching, employer action, approval, submission or Google operation was performed for this change. These checks do not establish model resume-selection accuracy or live ATS compatibility.

User review remains pending; there is no commit or push.
