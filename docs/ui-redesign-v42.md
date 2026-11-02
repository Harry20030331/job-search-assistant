# Status composition v42

Maintenance date: 2026-11-01. Explicit user direction: redesign the whole Status composition, retaining Sans-serif, with emphasis on layout, type hierarchy and whitespace. No commit or push authorized.

| Before | After |
| --- | --- |
| Full-height navy rail dominated the page | Status-only 208px white rail and quiet selected navigation |
| Title and detached shown-count | Title, short description and three application overview counts |
| Large bordered update card | Slim update strip with existing refresh behavior and explanations |
| Floating filter buttons above a separate table | One pipeline surface with heading, shown-count, underline filters and table |
| Similar visual weight for row fields | Clear company/role hierarchy, quieter location/direction/resume/date |

The composition is isolated in `src/review/statusLayout.ts` under `body.status-workspace`. Review, Profile, Interview and Account retain their prior layouts. Overview counts use the same visible non-closed Status projection and status grouping as the table. They describe the whole pipeline while the shown-count describes the active filter. No candidate, task, resume, opportunity or interview data is rewritten by this change.

All text retains Inter / Arial / sans-serif. Existing per-job Resume tags, shortlist checkboxes, Apply, separate final Submit, local demo interview button, error handling, stable identity and filtered numbering remain intact. Orange is retained in active-filter underlines and the interview count.

Validation: 576 tests across 56 files passed; TypeScript, boundary and distribution checks passed. Actual in-app Browser inspection covered the final desktop and 390px layouts. Measured document width matched viewport at 320, 390, 768, 1024 and 1440px; the wide table and navigation scroll locally. Interviewing filter showed one row, count 1 and ordinal 01; Offer filter showed count 0 and its empty message. Final visible font audit returned only Inter / Arial / sans-serif. Temporary viewport override was reset. No live employer, Google or model calls were made.

Screenshots: `beyondautofill-status-v42.png` and `beyondautofill-status-v42-mobile.png` in the task visualization directory. Visual acceptance remains for user review. v41 and earlier manifests are preserved.
