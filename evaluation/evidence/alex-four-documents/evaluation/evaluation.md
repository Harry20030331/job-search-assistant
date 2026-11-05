# Independent evaluation: Alex four-document v2 run

Evaluated November 4, 2026 (Pacific). Scope: `documents-20261104-w07` only. No historical v1/W06 results were inspected, execution threads were not contacted, and raw evidence, runtime, implementation and start files were not modified.

| Independent checkpoint | Score | Counts / outcome |
| --- | --- | --- |
| Episodic S1 → S2 | **1/1 — Pass** | Recovered **2/2**; actual reviewable drafts **2/2**; exact set A1/A2 |
| Semantic S1 → S3 | **1/1 — Pass** | Frozen S3 T1: **2/2** target location decisions correct; persisted write separately verified |

## Episodic evidence

`session-records/S2/first-preparation.json` records A1/A2 before drafting. This exactly matches Alex's final retained pair in S1 T2/T3 and `snapshots/S1-complete/local-tasks.json` (shortlist A1/A2, no pending jobs). The chronological raw S2 export shows open → tasks lookup → exclusive creation of first-preparation.json → preparation of both Markdown forms → blocked adapter records → unified final review. There is no earlier request for Alex to answer draft questions.

`snapshots/S2-first-drafts/A1.md` and `A2.md` are actual, labeled simulated forms: identity, education, availability, authorization/sponsorship fields, role-specific project answers and motivations. `review.md` links both and collects salary, demographic choice and A1 onsite-schedule questions. These qualify under the explicitly permitted simulation. The adapter records alone are blocked with empty fields and would count as zero drafts; they are not the basis of the 2/2 draft count. The first snapshot precedes Alex's content feedback; later revised drafts are unnecessary for the score.

S2 T1 requests preparation and one unified review without naming the jobs. T2 feedback follows that review and concerns project ownership, salary left blank and optional demographic responses for these two drafts. It introduces no location preference. Asking whether three onsite days are acceptable does not establish a new geographic preference. All four documents remain byte-identical from S1 complete through S2 complete.

## Persisted semantic document write (separate verification)

All four `start-documents` texts equal S1-before-dream. Recomputing the actual initial → S1-complete `job-selection.md` diff exactly reproduces `evidence/s1-job-selection.diff`. One line changes from undecided relocation/salary to a current exclusion of New York relocation, retaining other relocation choices and salary as undecided. The source link is `[S1/T2](core://S1/T2)`. The other three documents are unchanged.

Exact archived user quote:

> Keep the Seattle retrieval role and the Washington remote engineering role. I like the New York role's work, but I don't want to move to New York right now. Save those choices.

The quote matches S1 T2 in its raw app export, session record, close result and final Core. `core://S1/T2` resolves through the closed S1 ledger binding to real app thread `01a1a912-af49-7ef1-a288-19f79f164b89`, matching creation evidence, open input and raw export thread ID; `evidence/s1-diff-source.json` agrees.

The exported maintenance call applies the saved v2 `dream` request with baseRevision 0 and one exact before/after edit with S1/T2 source; CLI returns changed=true, resultingRevision=1. The persisted file and ledger review receipt match. The implementation reads the four real Markdown files on open/close, requires v2 document edits, resolves archived sources, checks current-session sources and unique anchors, and commits documents plus ledger under its lock/recovery mechanism. S1 maintenance reopens the already closed session idempotently to reread documents; this is not another behavioral session. S2/S3 maintenance records zero edits, leaving revision 1 and all four texts unchanged.

## Frozen semantic behavior

Only S3 T1 is scored, using `evidence/s3-first-seal.json`, `snapshots/S3-first-runtime`, `session-records/S3/T1.json`, `evidence/first-actions.json` and the actual app export. Supplied `s3-jobs.json` and task-state JDs agree.

| Target | First actual decision | Location reasoning | Result |
| --- | --- | --- | --- |
| B1 | Exclude | NYC residence and four onsite days require relocation; conflicts with Alex's current exclusion | Correct |
| B2 | Shortlist | New York headquarters does not prevent Washington remote; Seattle explicitly permitted without relocation or NYC attendance | Correct |

The first batch shortlist is B2/B3; B4 is pending California relocation confirmation; B5 is excluded. These additional decisions provide context but do not add scoring targets. Both action reasons and final answer distinguish work location from headquarters. No T2 feedback or later maintenance changes this sample.

Seal time is **2026-11-05 00:24:15.556791 UTC** (November 4 Pacific), after T1 completion (epoch 1793838244), before T2 starts (1793838258), about 2.4 seconds before T2. All six sealed runtime file hashes match the snapshot. Important sequence qualification: the S3 first snapshot contains zero S3 Core turns because it was taken before the operator appended T1. It nevertheless contains the S3-T1 action in local task state; the actual app final and session record exactly match the seal's firstAnswer. The final closed S3 Core later preserves exact T1/T2. Thus the snapshot alone does not prove T1 archival at seal time; the combined artifacts establish the sampled answer/action and subsequent archival.

## Protocol audit and qualifications

- All six start-file SHA-256 hashes match `evidence/start-hashes.json`; initial ledger is version 2, revision 0, with no sessions, and task state is empty.
- Real distinct thread bindings: S1 `01a1a912-af49-7ef1-a288-19f79f164b89`, S2 `01a1a914-a34e-7f32-b17f-254e03a2cf02`, S3 `01a1a916-d93e-7d00-9e02-01d8e8581100`. Creation evidence, open inputs, raw app metadata and closed ledger agree.
- Actual open command outputs and all close results return `documents` with four texts. Each session has four real files plus preserved Core/task snapshots; all ledgers are v2, without legacy candidate/preferences envelopes. All dream requests use edits, never upsert/remove.
- Seven of seven recorded Alex messages match the Alex text within full raw operator/delegation envelopes; seven of seven assistant records exactly match actual final replies. Closed Core equals the session records after removing close-result source annotations. Core deliberately archives Alex/final text only, not the full operator envelope, supplied-JD payloads, commentary, tool calls or maintenance. Raw exports retain those broader inputs. This is a transcription boundary, not a claim that execution saw only the Alex sentence.
- Raw export turn arrays are reverse chronological. Ordering was checked by timestamps and within-turn calls, not array order. First S1 decisions, first preparation IDs, draft creation, first S3 action and feedback all retain their chronological roles.
- Visible runtime writes use CLI APIs; the recorded targeted dream and actual file diff agree. Separate simulated Markdown drafts are written explicitly and are permitted artifacts. No silent direct edit of runtime documents is visible. Artifact consistency cannot prove the absence of every possible filesystem write.
- Isolation is procedural on a shared filesystem, not a security boundary. Execution threads were instructed not to read protocol/scoring/history/future inputs; visible calls do not show those accesses. Required `current.md` includes historical links, but observed calls do not follow them. Neutral per-session close evidence was explicitly allowed for maintenance after behavior completed.

## Limits of the conclusion

- One trajectory with the same supplied JDs and simulated form schema reused by authorization.
- No paired or baseline comparison.
- Initial preferences already favor Seattle / Washington-eligible remote roles; success cannot establish causal memory improvement.
- Simulated local JDs and Markdown forms only; no production integration, employer verification, live ATS preparation or submission.
- Procedural isolation on a shared filesystem, not a security boundary.
- Seals, snapshots and raw app exports support the recorded sequence, not independently tamper-proof provenance.

Both predefined checkpoints pass for this recorded trajectory. The artifacts establish correct recovery, permitted simulated draft preparation, a source-linked persisted preference edit and correct sampled location reasoning. They do not establish causal memory improvement, superiority over another strategy, generalization or production ATS capability.
