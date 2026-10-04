# Job Search Assistant

A personal job-search assistant built on the Codex harness. It handles research, repetitive form filling, and interview coordination so users can focus on choosing opportunities, preparing, and interviewing.

**Status:** Initial project scaffold. Module implementations and evaluation runners are under development.

## Modules and ownership

Each owner builds the complete module pipeline and its evaluation: cases, metrics, graders, baseline comparisons, and failure analysis.

| Module | Owner | Scope |
| --- | --- | --- |
| [Job Matching](modules/job-matching/) | Hannah Guan | Find and analyze suitable jobs; refine recommendations with user feedback. |
| [Application Support](modules/application/) | Yuming Feng | Fill and check applications; resolve missing information with the user; submit when authorized. |
| [Interview Coordination](modules/interview/) | Erica Zhao | Turn recruiting emails into preparation briefs and scheduling options; save and reuse reflections. |

Yuming also coordinates the shared repository and module integration. Users provide truthful profiles and preferences, select opportunities, resolve unknowns, and confirm consequential actions.

## Contribution and evaluation

Our contribution is domain skills, workflow logic, supporting tools, and structured state/memory on top of Codex. We evaluate the benefit over basic task instructions using the same Codex model, tools, resources, and cases.

| Module | Test data | Success criteria |
| --- | --- | --- |
| Job Matching | Historical jobs, profiles, preferences | Relevant matches and evidence-based analysis. |
| Application Support | Different forms; complete and incomplete profiles | Correct, complete filling; unknown facts are not guessed. |
| Interview Coordination | Recruiting emails, application context, research, calendars, reflections | Accurate briefs, valid scheduling, and reliable record reuse. |

Use documented data sources, normal and edge cases, separate development and held-out tests, and resettable test environments. Report module quality, failures, user effort, time, and cost. Reflection effectiveness and proactive outreach are secondary to the three core workflows.

## Delivery

Users clone this repository and open it in Codex, then configure their own tools, connections, and permissions. Module owners will document supported setup and execution steps as implementations land.

Keep real profiles, resumes, emails, calendars, credentials, and personal memory **outside this repository**, including its Git history. Only fictional examples belong here.

## Layout

- `modules/`: independently developed workflows and evaluations.
- `shared/`: agreed interfaces and reusable utilities.
- `examples/`: fictional fixtures and configuration examples.
- [AGENTS.md](AGENTS.md): concise contributor and agent instructions.
