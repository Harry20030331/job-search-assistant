# Memory study team handoff

## Before Midway

| Owner | Deliverable |
| --- | --- |
| Yuming | Prepare the CareerOS GitHub repository   |
| Erica | Write the midway report. |
| Hannah | Produce the product demo video. |

All three deliverables are due for team review by **8:00 p.m. Pacific on November 5, 2026**. Review them together, then submit the following day, **November 6**.

## After Midway

### Yuming — Agent memory

**Focus:** Give all four strategies the same interface to CareerOS.

- Specify how to open a session, record each turn, close the session and retrieve earlier evidence.
- Maintain Source-Linked Preference Memory as the reference implementation.
- Document how a new Codex thread resumes from the same run data.

**Deliverable:** A documented memory interface and a working reference strategy that Erica can plug into the evaluator and Hannah can use to implement the baselines.

### Erica — Evaluation system

**Focus:** Build the evaluation system the team will use to compare memory strategies.

- Build a resettable virtual job site with about 200 listings.
- Create 10 fictional candidate profiles with résumés and one trace per candidate, using the [Alex case](alex-memory-trace.md) as a reference.
- Connect the simulator, CareerOS and an independent judge so each case runs across sessions and each checkpoint scores the agent’s first action.

**Deliverable:** An evaluator with case files and a run command. A teammate can select a case and strategy, run the full trace and inspect the evidence for each score.

### Hannah — Baselines and results

**Focus:** Measure how the memory strategy affects the agent’s first action and token usage under identical conditions.

- Implement Raw trace, Core interaction, and Session summary + Core behind Yuming’s interface.
- Run all four strategies three times each on the frozen cases.
- Analyze failed checkpoints and report the main failure modes.

**Deliverable:** Three runnable baseline adapters, one comparison table reporting first-action pass rate and token usage, and a failure analysis linked to scored examples.
