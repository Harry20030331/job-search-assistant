# Alex’s job-search case

The run starts with four separate documents for Alex, a fictional job seeker: his profile, job-selection preferences, application-answer preferences and interview-preparation preferences. He receives two batches of five jobs each. Alex first screens jobs, then prepares applications, and finally screens a new batch. We observe whether CareerOS remembers which jobs he chose and why.

## Job-search trace

The same user simulator plays Alex throughout. Each session opens a new CareerOS chat thread and can contain several turns. Each row below illustrates one turn. Alex sends a message, waits for CareerOS’s actual reply, then decides what to say next.

### S1 · Choose two of five jobs and explain the tradeoffs

| Turn | Alex’s message (example) | CareerOS’s task |
| --- | --- | --- |
| 1 | “Take a look at these five jobs. Which ones are worth applying to? Give me a brief reason for each.” | Make initial recommendations for Alex to review. |
| 2 | “Keep the Seattle retrieval role and the engineering role that lets me work remotely from Washington. I like the work at the New York job, but I don’t want to move to New York right now.” | Save the two choices and acknowledge Alex’s reason for passing on the New York role. |
| 3 | “Looking at the other two, the Staff role requires six years of experience, and I’m not there yet. I applied to the last one last week. Let’s go with the two we picked.” | Confirm the final list. At session close, review the preferences and link any update to Alex’s words in the relevant turn. |

### S2 · Recover the two jobs, prepare the applications and review them together

| Turn | Alex’s message (example) | CareerOS’s task |
| --- | --- | --- |
| 1 | “Help me prepare applications for the two jobs we kept last time.” | Recover the two jobs independently and prepare a local draft for each. Present both drafts and any outstanding questions together at review. |
| 2 | Alex responds to the actual drafts, for example, “Use my retrieval project for the project question in the first one. The second one looks good.” | Revise the corresponding answer and return the drafts to Alex for review. |

### S3 · Screen five new jobs and observe whether the preference carries over

| Turn | Alex’s message (example) | CareerOS’s task |
| --- | --- | --- |
| 1 | “Here are today’s five new jobs. Put together a shortlist and give me a brief reason for each decision.” | Produce the shortlist.[^s3] **Before Alex gives feedback, freeze the first reply and the IDs shortlisted from this batch.** |
| 2 | Alex follows up on the actual shortlist, for example, “For the one you ranked first, which responsibility is closest to my experience?” | Explain the recommendation using the job’s responsibilities and Alex’s experience. This turn takes place after the response used for scoring has been captured. |

[^s3]: This example skips job discovery. The jobs were selected by hand so that CareerOS must use Alex’s relocation preference to screen them correctly.

## Checkpoints and scoring

| Checkpoint | How the independent evaluation agent scores it |
| --- | --- |
| S1 → S2 · Remember the previous selection (episodic memory) | Compare the job IDs used in the first preparation attempt with the two IDs Alex kept. Pass if the sets match and there is a reviewable draft for each job. Record the number of jobs correctly recovered and the number of drafts completed separately to distinguish retrieval from execution. |
| S1 → S3 · Apply a preference to new jobs (semantic memory) | First compare the job-selection document before and after S1. Check the edit and its source link, and record whether the write can be verified. Then score the initial screening decision independently. Pass if the role requiring a move to New York is excluded, the role allowing remote work from Washington is shortlisted, and the reasons reflect where each job actually requires Alex to work. |

## Roles and responsibilities

| Role | Responsibility |
| --- | --- |
| User simulator (Alex) | Use the same profile across all three sessions. Send actual messages to request work, review the results and give feedback one turn at a time. |
| CareerOS | Screen jobs, prepare applications and screen new jobs in three independent local Codex chat threads. Carry work across sessions through the shared job ledger and memory. |
| Independent evaluation agent | In a separate evaluation thread, apply the predefined criteria to the frozen conversations, memory snapshots and actual artifacts. Only the evaluator sees the scoring key. |

## Recorded run

The four-document version completed one trace and passed both checkpoints. [Independent evaluation for this run](../evaluation/evidence/alex-four-documents/evaluation/evaluation.md) · [Earlier rehearsal](../evaluation/evidence/earlier-rehearsal/five-role-main/README.md)

### How job progress carries across sessions

| Session and original conversation | Starting state | Actions and end state |
| --- | --- | --- |
| [S1 · Screen jobs, 3 turns](../evaluation/evidence/alex-four-documents/core/S1.json) | Five jobs to screen, A1–A5. | In turn 1, the initial selection was A1, A2 and A5. A3 awaited confirmation and A4 was excluded. In turn 2, Alex selected A1 and A2 and ruled out A3 because it required relocation. In turn 3, he explained that he had applied to A5 the previous week. Only A1 and A2 remained. [End-of-session list](../evaluation/evidence/alex-four-documents/snapshots/S1-complete/local-tasks.json) |
| [S2 · Prepare applications, 2 turns](../evaluation/evidence/alex-four-documents/core/S2.json) | A new thread recovered A1 and A2 from the previous session’s list. | CareerOS prepared a simulated draft for each role, revised them after Alex’s feedback and returned both for a single review. Both application-draft records were marked `blocked` because only simulated job descriptions were available and the employer forms were not connected. **Actual applications submitted: 0.** [End-of-session record](../evaluation/evidence/alex-four-documents/snapshots/S2-complete/local-tasks.json) · [Review of both drafts](../evaluation/evidence/alex-four-documents/local-drafts/review.md) |
| [S3 · Screen another batch, 2 turns](../evaluation/evidence/alex-four-documents/core/S3.json) | The original list retained A1 and A2. Five new jobs, B1–B5, were supplied. | The first reply added B2 and B3, held B4 for confirmation and excluded B1 and B5. The cumulative shortlist was A1, A2, B2 and B3. [First screening list](../evaluation/evidence/alex-four-documents/snapshots/S3-first-runtime/local-tasks.json) |

### How a preference changed later screening decisions

Across the three sessions, one long-term preference changed. In S1 turn 2, Alex explained why he passed on the New York role. At the end of S1, CareerOS wrote that reason into `job-selection.md`. The preference carried over to the next screening in S3.

**S1, turn 2 · Alex’s exact words**

> Keep the Seattle retrieval role and the Washington remote engineering role. I like the New York role's work, but I don't want to move to New York right now. Save those choices.

| Job-selection preference | Exact wording in the file |
| --- | --- |
| [Before the edit · v0](../evaluation/evidence/alex-four-documents/snapshots/S1-before-dream/job-selection.md) | Salary target and relocation willingness are undecided. Do not insert a numeric salary or assume willingness to relocate. |
| [At S1 close · v1](../evaluation/evidence/alex-four-documents/snapshots/S1-complete/job-selection.md) | New York relocation is currently excluded: Alex does not want to move to New York right now. Other relocation choices and salary target remain undecided. Do not insert a numeric salary or assume willingness to relocate. [S1/T2](core://S1/T2) |
