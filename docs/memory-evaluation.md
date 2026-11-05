# Evaluation protocol: Building and scoring job-search traces

Start with [Alex’s three-session case](../evaluation/cases/alex/scenario.md). A case is ready when someone else can replay its user turns in independent threads and a second person can score the first action from saved evidence. This protocol evaluates the [four memory strategies](memory-study.md). The [application-form evaluation](evaluation.md) covers a separate task.

## Build sessions before assembling a trace

A **turn** is one user message and its visible assistant reply, including any intervening work. A **session** has one user goal and a verifiable stopping point. A **trace** interleaves sessions for one candidate while preserving each job’s causal order. A **checkpoint** scores a natural turn inside that trace.

| Session type | Example goal | Observable outcome |
| --- | --- | --- |
| Screening | Decide which roles to keep and explain exclusions. | Job IDs, decisions and reasons. |
| Application | Prepare the jobs kept last time. | Drafts for the right IDs and unresolved questions collected for review. |
| Interview preparation | Use a prior debrief to prepare for the next round. | A practice question or exercise targeting the earlier difficulty. |
| Interview debrief | Record what happened and identify what to practise. | A source-backed observation that a later task can use. |

1. Write the candidate’s initial facts and preferences. Choose a change the agent will learn only through interaction, including its scope. Draft the target action and acceptable alternatives before writing the dialogue.
2. Write each job’s sessions in causal order. Give the simulated user natural opening requests and follow-up feedback. Interleave other jobs between cause and test. Keep future user messages and the expected answers outside the execution workspace.
3. Pick natural turns where history should change the first action. Freeze the prompt, preceding history, job-site state, expected action, acceptable clarification, source turn and evidence to inspect. For example, Alex’s rubric accepts a New York–headquartered role that allows work from Seattle and excludes a role that requires relocation to New York.
4. Freeze job descriptions and simulated application fields with stable IDs. Record source URL and revision for sampled listings; label authored details. The proposed pool is about 200 shared jobs. Sources considered include the [full-time index](https://github.com/SimplifyJobs/New-Grad-Positions) and [internship index](https://github.com/SimplifyJobs/Summer2027-Internships).

**Planned scale:** 10 fictional candidates, one trace each, 10–15 sessions per trace, about 5–10 turns per session and 5 scored checkpoints per trace. This gives 100–150 sessions and 50 distinct checkpoints. Four strategies × three independent repetitions yield 600 planned checkpoint judgments over those same 50 cases. Measure actual history length; the design has no minimum context-window requirement.

## Run and grade

| Role | Responsibility |
| --- | --- |
| User simulator / controller | Deliver only the next user message, wait for the actual reply, then give the scripted follow-up. Open a fresh execution thread at each session boundary. |
| Execution agent | Use the fixed Codex model, skills and tools. Read and write only the selected run’s data. Close the session once its task ends. |
| Independent evaluator | Receive the frozen rubric and sampled reply or artifact without the strategy name. Return pass/fail, one reason and an evidence pointer. Keep verdicts outside the conversation. |

For each repetition, copy the case’s initial `data/` into a fresh run. Hold the model, permissions, job ledger, tools, user history and environment fixed at a comparison point. Build the strategy’s memory from the same prefix. Score a checkpoint on a branch so corrections, evaluator messages and branch actions cannot change the next comparison. Record which raw tool returns were retained or truncated for the raw-trace strategy.

Save one session JSON under the run’s `data/sessions/`. Put scores and only the necessary evidence under the sibling `results/`. Reference the original reply by session and turn; capture a draft or ledger at the checkpoint if later work will change it. Record the strategy, repetition, case, checkpoint, validity, verdict, reason, evidence pointer and token usage. Mark missing usage or environmental blocks explicitly.

**Check the judge before scoring runs.** In an earlier interview pilot, the judge gave full marks on all 30 ratings. A follow-up with deliberately flawed responses tested whether the judge could detect specific errors. [Pilot observations](interview-preparation-quality-pilot.md) · [Judge controls](interview-preparation-controls-pilot.md)

For Alex S3, give the judge two replies in shuffled order with the same rubric and evidence. Both exclude B1 because it requires living in New York. One shortlists B2 because Alex can work from Seattle; the other excludes B2 solely because its headquarters is in New York. Expect a pass for the first decision pair and a fail for the second. Check that the judge cites the relocation preference and B2’s remote-work terms. Resolve any discrepancy before scoring the runs, and report this check separately from the agent’s results. [Alex checkpoint rubric](../evaluation/cases/alex/checkpoints.json)

**Primary metric.** Score the agent’s first eligible answer or action before user correction. A correct clarification can pass when evidence is insufficient. For each repetition, divide passed checkpoints by valid checkpoints, report the denominator and blocked count, then average the three repetition rates. Report input/output tokens separately for writing and maintenance and for reading and answering. Show paired differences on the same checkpoints and keep candidate IDs visible when summarizing failures.

Use one main table with a row per strategy and columns for first-action pass rate and token usage. Examine earlier and later checkpoints within the same traces to study growth. Two optional comparisons isolate reading behavior: full Core versus on-demand Core where both fit, and identical consolidated preferences with versus without source access. For failures, trace the user evidence through the stored memory, retrieved material and action. If the right evidence reached the agent, inspect execution, task design or judge interpretation before attributing the error to memory.

## First team handoff

| Workstream | First deliverable | Acceptance check |
| --- | --- | --- |
| Method and integration | Freeze the shared memory interface, session lifecycle and case/run paths. Use the source-linked implementation as the reference. | A new thread can resolve a source turn and resume a selected job using only its run’s data. |
| Comparison strategies | Implement raw trace, Core and session summary + Core behind that interface. Document the input each retains. | Replay Alex from identical initial copies. Verify the baseline preference files stay byte-identical and the runner records usage. |
| Data and evaluation | Author one additional trace, its simulated site states, private checkpoint rubrics and an independent scoring pass. | Another teammate can run it from the case files, score the first action, and locate the original evidence without seeing the answer key in the execution thread. |

Scale to the planned dataset after this second case passes a blind replay. The next reportable comparison needs all four strategies on the same frozen checkpoints and three repetitions. Individual owners, the final simulator and judge configurations, and handling of environment failures in the main table should be agreed before that run.
