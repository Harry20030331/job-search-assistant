---
name: discovering-us-graduate-jobs
description: Coordinate candidate setup, job discovery, matching and feedback for the local job-search workspace.
---

# Matching Workflow

This is the Matching entry point. Keep this path and skill name stable for existing callers. Run the workflow in the current Codex chat; load only the child skill needed for the current stage. These are instructions for one agent, not a request to launch additional agents.

## Shared contract

Read [workflow-contract](../../docs/workflow-contract.md) and [candidate-inputs](../../docs/candidate-inputs.md). They own execution boundaries, factual ownership and authorization. The selected workspace's canonical files hold candidate facts, preferences and progress; no candidate-specific qualifications or answers belong in skills. Shared jobs stay in `data/opportunities.json`; no second authoritative shortlist. Read [job directions and resume routing](../../docs/job-directions.md): directions are open labels, while application resume profiles are separately selected manifest keys. Shortlisting does not require a CV.

Use Codex's in-app Browser for page actions. Discovery and feedback do not authorize an application, account registration, CV upload to an employer or submission. Submission begins separately through `../submission/SKILL.md` with its applicable ATS module. Keep existing UI rendering and interactions behind [ui-contract](../../docs/ui-contract.md); data changes use domain interfaces and stable IDs.

Keep job-seeker guidance and explanations in English unless explicitly asked otherwise. The website is the primary input surface; use confirmed canonical inputs and saved website requests. Users may also supply ordinary language, links or files; the agent constructs command inputs. Explicit development requests retain their normal workflow rather than triggering setup.

## Route the current request

| Request or state | Read next | Expected handoff |
| --- | --- | --- |
| New candidate, LinkedIn URL, resume/document, pasted background, or missing search-critical facts | [Candidate intake](intake/SKILL.md) | Confirmed new workspace, or explicit unresolved inputs; never overwrite an existing candidate |
| Find jobs, expand the pool, verify a lead, or refresh current postings | [Job discovery](discovery/SKILL.md) | Source-backed official-role observations and verification failures for assessment |
| Analyze/rank supplied jobs, publish a shortlist, or process user feedback | [Matching and feedback](feedback/SKILL.md) | Current-context assessments, saved feedback, validated job updates and a before/after explanation |

A fresh `Hi` or `Start` follows [welcome](../../docs/welcome.md): run `npm start`, visibly open its `welcome_url`, and let the user choose and confirm inputs on the website. Do not repeat welcome on an ongoing feedback turn. A greeting alone selects no candidate and triggers no intake or browsing.

For a resume request without a selected workspace, run `npm run matching -- workspaces` first. Present discovered searches as numbered choices with names, locations and counts; distinguish empty results, missing workspaces and read failures. Ask for a path only as a recovery option. Use existing selected inputs directly without re-confirming known facts. For a fresh fictional live exercise, use `npm run matching -- example --workspace <new-directory>`; the scripted offline demo is a distinct choice. Details: [workspaces](../../docs/workspaces.md).

## Keep the website part of the workflow

After workspace selection or confirmed intake, and before external browsing, run `npm run matching -- serve --workspace <selected-directory>` in a persistent terminal session. Visibly open its returned Status URL and retain that results tab. Reuse the session/URL for later turns, browse external pages in background tabs, and reload/show results after each publication. Report and recover a startup failure rather than silently continuing chat-only. Neither listing nor serving selects another candidate or initializes missing records.

## Sequence and return points

- **First search:** intake if needed -> select/open workspace -> discovery -> assessment/publication -> show results and invite real feedback.
- **Feedback:** matching/feedback reads fresh context and saves the actual instruction -> discovery when re-verification or replacement leads are needed -> matching/feedback re-assesses and publishes -> refresh the same results tab.
- **Provided job descriptions:** route directly to assessment; do not claim live website verification from a supplied document alone.
- **Missing candidate facts:** return to intake only for genuine factual gaps. Employer conditions are research work. Existing-candidate corrections remain explicitly scoped; intake's new-workspace writer is not an overwrite mechanism.

Children hand off observations or existing canonical records, not fabricated completion states. Re-read context after candidate/preference changes; an updated token is not a substitute for re-assessment. Preserve source-specific checkpoints until the entire scan and inspected dispositions are complete. The child skills and existing [Matching commands](../../docs/matching.md) define the details.
