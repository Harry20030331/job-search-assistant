# Product UI redesign — v39

Maintenance date: 2026-11-01. Explicit user request: overhaul the existing product using Vercel's interface guidelines, Anthropic's frontend-design skill and 21st.dev. All work remains uncommitted on `main` for user review. Remote references were fetched before editing; `main` had no remote divergence. Pre-existing Matching/Jev changes were preserved.

## Design direction

A calm application workbench with a distinct place for navigation, selection and focused work. The entry page carries the most expressive typography and a dark primary entry; working pages prioritize real application and interview content. No invented metrics, company assets or candidate facts are introduced.

Palette: canvas `#FAFAFA`, surface `#FFFFFF`, ink `#171717`, secondary text `#666666`, navigation `#F5F5F5`, boundaries `#E5E5E5`. Existing semantic green/orange/red remain reserved for actual state, missing required content and errors. Locally bundled Inter provides a consistent type scale, with 28–38px working-page headings, 13–14px working text and secondary metadata below it.

Desktop layout: fixed navigation rail → application/interview queue → focused document. Status uses the full content width for a semantic table. At 900px the rail becomes horizontal navigation. At 700px Review becomes a native application picker followed by the document; Interview uses a horizontally scrolling interview queue. Welcome stacks its introduction and three entry options on small screens. Table, tabs and navigation scroll within their own containers.

## Changes

| Before | After |
| --- | --- |
| Crowded horizontal workspace navigation and underline-only active state | Labeled icon navigation in a desktop rail, an outlined active destination, horizontal navigation on smaller screens, and a keyboard skip link |
| Welcome title with three equal-weight entry rows | Two-column product introduction, differentiated primary New candidate action, explanatory saved-search/example entries, and a compact search/application/preparation journey |
| Several independent typography and spacing treatments | Shared type, color, spacing, focus, transition, button and disabled-state rules in `src/workbench/designSystem.ts` |
| Company and location combined in a bold line | Separate company and secondary location lines with unchanged escaped values and stable row identities |
| Underlined Status lifecycle tabs above a bare table | Segmented filters and a bounded table surface, with readable cells and local horizontal scrolling |
| Review queue and questions on an undifferentiated background | Distinct queue selection, document surface, clear role hierarchy, consistent question/answer spacing and selected choices |
| Full-width pinned action region | Action region respects the desktop rail, mobile safe area and measured bottom clearance; approval and final submission remain separate |
| Profile/account panels and Interview pages with different visual rhythms | Shared form/panel styling, consistent interview queue/detail/plan/practice treatments, and readable empty states |
| Small form text on phones | 16px editable inputs on small screens, visible keyboard focus, labeled controls, reduced-motion support and intrinsic responsive layouts |
| Assertions freezing the superseded Welcome title and combined company/location line | Existing tests now expect the requested presentation while retaining links, escaping, location normalization, stable IDs and workflow assertions |

## Reference use

- [Vercel Web Interface Guidelines](https://vercel.com/design/guidelines): keyboard focus and skip links, native semantics, local overflow, labeled icons, mobile field size, safe areas, tabular numbers and reduced motion. Existing application/plan approval gates remain authoritative where general form advice differs.
- [Anthropic frontend-design](https://github.com/anthropics/skills/tree/main/skills/frontend-design), read through its [raw skill source](https://raw.githubusercontent.com/anthropics/skills/main/skills/frontend-design/SKILL.md): product-specific hierarchy, a deliberate type scale, one expressive entry page, restrained working screens, short functional copy and screenshot critique.
- [21st.dev](https://21st.dev): component composition references for navigation, action hierarchy, choice surfaces and segmented controls. Adapted directly to the current server-rendered TypeScript interface; no React migration, component package, external font request or additional runtime dependency.
- Local `make-interfaces-feel-better` skill: proportional surfaces, subtle interactive transitions, tabular numbers, font smoothing, visible focus and minimum hit areas.

## Validation

- `npm run typecheck`: passed.
- `npm test`: **548 tests passed across 54 files**.
- Structural boundaries and distribution checks: passed.
- `npm run ui:check`: v39 successor checked after implementation and browser review; v37 and rejected v38 retained.
- `git diff --check`: passed.
- Actual in-app Browser measurements for Welcome, source intake, Status, Review, Profile and populated Interview: **320, 390, 768, 1280 and 1440px**, 30 route/width combinations. Every measurement matched the requested width, and document scroll width never exceeded the viewport. Status table and navigation can still scroll locally by design. Temporary viewport overrides were reset.
- Browser interactions: Status Offer/All filtering and empty-state recovery; LinkedIn/pasted-text/PDF panel switching; Review radio autosave, Saved feedback and required-answer gate becoming enabled; native mobile picker switching to a long-title/long-answer application; populated interview navigation and practice view. Five native answer disclosures remain present on the authored practice page.
- Preview data: isolated fictional Alex application fixture under `/private/tmp/job-ui-redesign-20261101`, and separately authored fictional interview cases under `/private/tmp/job-ui-interview-20261101`. One Review choice was saved only in the isolated application fixture. No content was approved or submitted. No new candidate was confirmed, no real records were reset, and no paid model, live discovery, employer or Google action was performed for this redesign.

The browser checks establish local rendering and the listed interactions, not live employer compatibility or matching quality. Safari/iOS hardware testing and a formal accessibility audit are outside this verification. User design acceptance remains pending.
