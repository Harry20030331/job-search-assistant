# Status-centered navigation v57

Maintenance date: 2026-11-03. User relayed teammate feedback: two primary destinations (Profile and Status); Review and Interview preparation extend Status; account connection belongs in settings. The user explicitly requested name candidates before any rename. Branding therefore remains BeyondAutofill and its current icon until a name is selected. No commit or push authorized.

| Before | After |
| --- | --- |
| Five persistent navigation destinations | Profile and Status only |
| Review entered as a separate destination | Status count/stage/job entries, Status remains selected, Back to Status restores In Review |
| Interview preparation entered as a separate destination | Exact round or application entry from Status, opening Plan and returning to Interviewing |
| Account in primary navigation | Settings link on Profile, Settings page and Back to Profile |

Lifecycle tabs remain filters rather than unexpectedly abandoning the pipeline. Actionable In review and Interviewing counts open the corresponding task view directly. Selected task stages expose a clear task action, and rows use exact application IDs or linked round IDs. No task shortcut appears on zero-count summaries. Existing standalone URLs are retained for bookmarks/recovery. Interview application scope filters rounds and request targets to that application and never falls through to another job's round. Review and interview content/approval/execution logic, including the team's v55 automatic local-demo Plan dispatch and v56 waiting message, remain unchanged.

591 tests across 56 files passed. TypeScript, ownership/dependency boundaries and distribution checks passed. In-app Browser followed Status -> In Review -> Review -> Back to Status (four rows restored), Interviewing -> exact Adobe Plan -> Back to Status, and Profile -> Settings -> Back to Profile. At 320, 390, 768 and 1280px across five routes (20 combinations), primary navigation contained exactly two links and document width matched the viewport. Desktop Status/task screenshots inspected; viewport override reset. No preference save, application approval/submission, simulated-interview trigger, message dispatch or model call occurred during navigation checks.

Regression testing also exposed a pre-existing race in missing-chat connection creation: an exclusive destination file could be read before its JSON write finished. The repair writes a private temporary file completely, then hard-links it into place without overwriting an existing connection. Concurrent creation and preserved-binding tests pass; cleanup removes only the temporary link.

Screenshots: `beyondautofill-status-hub-v57.png` and `beyondautofill-review-context-v57.png` in the task visualization directory. Earlier v56 and all historical manifests are preserved. Visual acceptance remains for user review.

Naming candidates for discussion, not implemented: Rolevia (role + via, spanning the job-search journey), Rolelane (an organized application track), NextRole (direct and easy to understand). Proposed direction: select a name first, then design its mark/wordmark consistently rather than repeatedly changing an isolated icon.
