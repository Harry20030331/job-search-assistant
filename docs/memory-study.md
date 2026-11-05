# CS329Z · Research framework for agent memory in job search

2026-11-04 | Internal discussion outline.

## Framework at a glance

| Section | Central question |
| --- | --- |
| 1. Introduction | Which job-search decisions depend on information the user shared earlier? |
| 2. Related Work | Which memory methods and evaluation designs inform this study? |
| 3. Environment & Data | Where does the agent run, and where is it tested? Where do the data come from, and at what scale? |
| 4. Methods | How does the agent organize, read and maintain the core conversations and preference files? |
| 5. Results | Which tasks and metrics distinguish the strategies? What do the experiments show, and where do failures occur? |
| 6. Discussion / Conclusion | To which job-search tasks and interaction histories do the conclusions apply? |

## 1. Introduction · Why study memory in job search?

**Over the course of a job search, how much processing does an agent need to do on the interaction history to act correctly before the user reminds it?** We compare the quality of the resulting actions and token use across memory strategies.

| Challenge | What it means in a job-search conversation |
| --- | --- |
| Long-term, multi-session dependencies | Recommending a job today may require combining location, employment type and work arrangements discussed in different sessions. |
| Changing preferences and goals | A user may broaden the location criteria for full-time roles while keeping a remote-work requirement for internships. New information may revise only part of an earlier rule. |
| Selective consolidation | When the user asks for a shorter application answer, the agent must consider the wording, the question’s length limit and previous feedback to decide which future tasks the request applies to. |

The study covers facts, preferences, goals and experiences accumulated through job-search conversations. The execution model and job-search skills are fixed.

## 2. Related Work

Deferred.

## 3. Environment & Data

### 3.1 Environment · Runtime and test environment

**Runtime.** CareerOS is a local job-search workspace that runs on Codex. Codex uses skills for screening jobs, filling out applications and preparing for interviews. Each stage shares the candidate profile, preferences and job progress. Through the website, users screen roles, review application drafts, supply missing information and move on to interview preparation.

**Test environment.** We plan to build a simulated job-search website with about 200 shared jobs for 10 candidates. Each job has a stable ID, a detail page and a simulated application form. Each candidate maintains a shortlist, application progress, interview materials and debrief records. At each checkpoint, runs branch from the same website snapshot. We assess the resulting list, form fields, simulated receipt or interview materials.

Comparisons hold the Codex model, job-search skills and tool permissions fixed. Cross-session checkpoints begin in independent threads. Each strategy can access only the history its design permits.

### 3.2 Data · Sources, construction and target scale

The first version targets the following scale.

| Data item | Per candidate | Dataset target |
| --- | --- | --- |
| Candidate profile | 1 profile | 10 fictional candidates, 10 profiles |
| Job-search trace | 1 trace | 10 distinct, continuous traces |
| Task session | 10–15 sessions per trace | 100–150 sessions |
| Interaction turn | About 5–10 turns per session, or 50–150 per candidate | About 500–1,500 turns |
| Evaluation probe | 5 probes distributed along the trace | 50 probes |

**Trace construction.** Start from the candidate’s predefined profile. Within each job-search thread, design tasks that follow causally from one another. Develop each task into a session with an opening goal and a verifiable outcome. A session contains several turns. One turn consists of a user message and an assistant response, and may involve multiple tool calls. Every strategy receives the same initial profile. Subsequent changes emerge through interaction.

| Session type | Why the user starts it | How to verify its outcome |
| --- | --- | --- |
| Job screening | Decide which roles in a batch are worth pursuing. | Inspect the shortlist, exclusions, roles awaiting confirmation and the reasons for each decision. |
| Application | Advance selected applications to a specified stage. | Depending on the goal, inspect the forms ready for review, explicit blockers or submission receipts. |
| Interview preparation | Prepare for a particular interview. | Inspect the requested materials or a practice session and its feedback. |
| Interview debrief | Reconstruct what happened and decide what to practise next. | Check the actual questions, answers and feedback, then examine the basis for the next practice focus. |

Interleave sessions from different job-search threads to form one candidate trace. Preserve the order within each thread. For example, the candidate prepares for an interview for role A, fills out an application for role B, then debriefs after interviewing for A. Only tasks that follow the debrief can use it.

**Job sources.** Sample from indexes of full-time roles and internships. Record the source version, job ID and link, then verify the job description and application questions on the employer’s page. Include variation in employment type, location, work arrangement and responsibilities. Identify any details authored for the simulation. [Full-time listings](https://github.com/SimplifyJobs/New-Grad-Positions/blob/dev/.github/scripts/listings.json) · [Internship listings](https://github.com/SimplifyJobs/Summer2027-Internships/blob/dev/.github/scripts/listings.json)

**Evaluation checkpoints.** Select five natural turns along each trace. The user makes an ordinary request without prompting retrieval. All four strategies respond to the same history prefix and website state. Evaluation outcomes stay outside the main history. The following are possible probe designs.

| Memory capability | Verifiable job-search decision |
| --- | --- |
| Reuse a new fact | Fill out an application using project experience the user supplied after the initial profile was created. |
| Track a change | Use the latest location requirement to distinguish onsite full-time roles in New York from onsite internships there. |
| Apply experience across tasks | Choose a follow-up question for the next interview based on a specific difficulty identified in the previous debrief. |
| Limit the scope of local feedback | The previous answer was limited to two sentences by a word count. Give the detail requested by the new question. |
| Recognize insufficient evidence | If the user has accepted one particular New York employer, mark their willingness to pursue other New York roles as awaiting confirmation. |

Before each run, identify the source turns and acceptable outcomes for each checkpoint. Use the same rubric to score each strategy’s first response or action before the user gives feedback.

## 4. Methods

Source-Linked Preference Memory separates three kinds of knowledge: how to perform a job-search task, what happened in a particular session, and what the agent has learned about the candidate across sessions.

### 4.1 Structure · What is stored?

**Procedural memory** consists of the skills for screening jobs, preparing applications and preparing for interviews. We keep these procedures fixed across strategies and sessions. The agent uses the skill descriptions to select and load the procedure it needs for the current task.

**Episodic memory** accumulates one session at a time. Each session has its own file under `data/sessions/`. It preserves each user message and the assistant’s final reply in turn order. We call this conversation record *Core*. The opportunity ledger provides a current view of job progress, including which roles the user kept and which drafts are ready for review.

**Semantic memory** holds the candidate facts and preferences that can inform future tasks. At session close, the agent reviews the episode and distils reusable feedback into the relevant preference document, with a link to the supporting turn. Profile facts are maintained through the profile editor after user confirmation. CareerOS stores semantic memory in four files under `data/profile/`.

| File | What it records |
| --- | --- |
| `candidate.json` | Confirmed facts about the candidate’s education, projects and work experience. |
| `preferences/job-selection.md` | Criteria for shortlisting jobs, including location, work arrangement and employment type. |
| `preferences/application-answers.md` | How the user wants application answers written, including which projects to draw on and how much detail to give. |
| `preferences/interview-preparation.md` | What the user wants to practise, how to run mock interviews and what feedback to give. |

All strategies begin with identical copies of these four files. The three baselines keep those copies read-only and access later feedback through their own traces, conversations or summaries. Our method updates the preference documents across sessions. A separate initial snapshot lets us reproduce the starting state.

### 4.2 Read · How does a new task use memory?

**Semantic memory is loaded by default.** At the start of each session, CareerOS loads the current candidate profile and all three preference documents into the agent’s context.

**Episodic memory is retrieved on demand.** To check the wording or scope of a preference, the agent follows its source link to the original turn. When a task calls for other details from past interactions, the agent can search the archived conversations directly.

**Procedural memory is selected by task stage.** The agent uses the current request and workflow state to select a skill by its description, then loads that skill’s instructions.

### 4.3 Dreaming

**1. Archive the session in episodic memory.** We define a *core interaction* as one user message paired with the assistant’s final user-visible reply. As each turn completes, CareerOS records both messages verbatim and in order. At session close, it finalizes the session record in episodic memory. The session and turn IDs let the agent retrieve the original wording later.

**2. Review the archived session (Dreaming).** The agent then reads the archived turns alongside the current profile and preference documents. It asks whether the evidence warrants a change in how it should handle future tasks. It may add, revise or retract a preference in the relevant semantic document, preserving its scope and exceptions and citing the supporting turns. Feedback specific to the completed task stays in the episodic record. Every completed session has a record, even when Dreaming yields no semantic update.

Suppose the current preference is “Keep application answers concise.” Both requests below call for a longer answer to the current question. Their implications at session close differ.

| User’s words | Preference file after review |
| --- | --- |
| “For this question, expand on the project background.” | Keep the existing preference. The request for this question can be retrieved from Core. |
| “In future, when I write about project experience, I want to explain the background in more detail.” | Keep the general preference for brevity. Add an exception for project experience and link it to this turn. |

If the user volunteers more project background in several applications with no length limit, the agent can review those exchanges and decide whether to record a tendency to explain the context in project-experience answers. Cite the relevant sessions and limit the entry to that type of answer.

## 5. Results

### 5.1 Experimental Setup · Main experiment and optional comparisons

**Main experiment.** Four writing and organization strategies perform the same task at each checkpoint.

| Strategy | What it retains after each session | How it reads for the next task |
| --- | --- | --- |
| Raw trace | Core conversation, tool-call arguments and the tool outputs actually retained | Search the original records on demand. |
| Core interaction | User inputs and final assistant replies | Search the conversations on demand. |
| Session summary + Core | A separate summary of each session, linked to its original conversation | Use the summaries to locate relevant sessions and read the original turns as needed. |
| Source-Linked Preference Memory | Current preferences maintained across sessions, their scope and exceptions, and the original conversations | Load current preferences by default and consult the original turns as needed. |

**Optional comparisons.** If Core retrieval misses available evidence, compare full loading with on-demand reading at checkpoints where the full text fits. If consolidation loses an exception, start from the same preference snapshot and disable only access to the original turns at answer time. Check whether the action changes.

**Repeated runs.** Run each strategy independently three times in the main experiment and in each optional comparison undertaken. Start each run from the same initial profile and website state, rebuild memory along the same trace, and execute and score the same checkpoints. Both sides of the source-access comparison use the preference snapshot produced in that repetition.

### 5.2 Metrics · Evaluation measures

An LLM evaluator independent of the execution agent scores each checkpoint. It receives the predefined rubric and the first response or actual action outcome before the user gives a reminder, such as the shortlist after screening. The evaluator is blind to the strategy name. It returns pass or fail and a one-sentence justification under the same rubric. Open-ended tasks may admit several acceptable answers.

| Metric | How to score or measure it |
| --- | --- |
| First-action pass rate (primary) | Passed checkpoints divided by valid checkpoints. The agent may retrieve evidence on its own. An appropriate request for clarification can pass when evidence is insufficient. |
| Token use | Record input and output tokens separately for writing and maintenance and for reading and answering. Aggregate by trace. |

### 5.3 Main Results · Main experiment (pending)

For each strategy, calculate the first-action pass rate and token use separately for each run. Report the arithmetic mean of each measure across the three runs.

| Strategy | First-action pass rate | Token use |
| --- | --- | --- |
| Raw trace | — | — |
| Core interaction | — | — |
| Session summary + Core | — | — |
| Source-Linked Preference Memory | — | — |

The main table compares complete strategies. Use the corresponding optional comparison to interpret the contribution of an individual component.

### 5.4 Failure Mode Analysis

Trace a failure from the user’s original words through the memory snapshot and the content actually retrieved to the final action. When the agent had sufficient evidence and still acted incorrectly, inspect the job-search skill or the probe itself.

## 6. Discussion / Conclusion · Findings and scope

Use the results to explain which tasks benefit from organizing memory in advance and where reading the original turns suffices. Limit conclusions to the setting and sample studied. Multiple checkpoints for the same candidate belong to a single trace.
