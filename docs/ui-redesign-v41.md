# BeyondAutofill UI successor v41

Maintenance date: 2026-11-01. User-directed successor to v40; historical manifests remain intact. Changes remain uncommitted for user review.

| Before | After |
| --- | --- |
| Pastel color blocks | Navy structure, white surfaces, blue resume tags, orange actions and selected Status filters |
| Large B tile | Small orange Lucide Compass beside the BeyondAutofill wordmark |
| Mixed small-label and practice fonts | Inter / Arial / sans-serif throughout, including headings, inputs and practice code |
| Recording required an inbox integration | Current completed fictional demo submissions expose Simulate interview, then Interview prep |

The Compass SVG was selected from the [21st.dev icon catalog](https://21st.dev/community/icons), Lucide family. Its exact SVG geometry is embedded in the shared header, without a package or remote runtime dependency. See [Lucide upstream](https://lucide.dev/icons/compass) and [preserved ISC/MIT license](lucide-license.txt). This is an open-source icon used as the product symbol, not an exclusive commissioned trademark.

The demo action validates fictional candidate, Demo mode, completed submission task, exact approved snapshot/revision/content hash, visibility and stable job/application identity. It creates an idempotent synthetic invited round in the interview registry. Status derives Interviewing while that proof stays current; opportunities and real submission evidence remain unchanged. Reopened content invalidates the projection. Existing preparation acceptance and generation gates remain intact. No email, calendar or employer request occurs.

First-use Profile setup, returning real-user Status, per-job Matching resume recommendations and immutable application resume bindings from v40 remain in force.

Validation: 576 tests across 56 files passed, TypeScript passed, dependency/ownership boundary checks and distribution checks passed. In-app Browser inspected the final Status lockup and orange stage, and computed fonts for Status, Review, Profile, Interview prep and Account were exclusively Inter / Arial / sans-serif. Final Status measured 390px viewport and 390px document width; its wide table and navigation scroll locally. Viewport override was reset. Earlier browser rehearsal completed local Submit, clicked Simulate interview and reached the linked invited round; the retained local case demonstrates derived Interviewing. No real submission, Google integration or paid matching evaluation was performed.

Preview screenshot: `beyondautofill-status-final.png` in the task visualization output directory. Product acceptance remains the user's review decision; these checks establish implementation behavior, not design approval.
