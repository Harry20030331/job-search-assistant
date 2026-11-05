# Alex five-role main trajectory

2026-11-04. Actual fresh 5 → 3 → 5 run, owned by W06. The main trajectory has completed and passed the first-action and source audits. The paired replay has also completed from the same reviewed S1 snapshot, changing only New York to Boston in the S2 user feedback. It does not reuse any earlier execution thread.

| Scene | Actual app thread |
| --- | --- |
| S1: five initial roles, then Alex selects three | `01a1a8ed-227d-7b70-8542-7049f2212afb` |
| S2: recover and prepare the previous three, then update New York preference | `01a1a8ef-8fff-7db0-bf5f-111bffa9eebc` |
| S3: five new roles; first full answer sealed before feedback | `01a1a8f1-2928-7cb0-93d0-96d92434135e` |
| Paired S2 | `01a1a8f2-136d-7c51-9b7e-9018dd144e48` |
| Paired S3 | `01a1a8f3-f5d1-79b2-a5e4-ab0997d4647e` |

S2 recovered **K11 Adobe, K22 Cedar Labs, K35 Fern AI** without receiving their names or IDs in its opening request. Adobe received an independently Chrome-observed first-page local draft; both simulated roles received distinct preparation notes and explicit no-official-form blockers. The following user turn answered the actual Phone Device Type question locally and updated full-time location permission to New York. Sources: `core://S1/T2`, `core://S2/T2`.

S3's first actual additions were **J17 Seattle, J24 New York, J42 Washington-eligible remote**; **J31 Boston and J55 Chicago** remained pending. Previous selections were preserved. The Core final reply exactly matches the actual app reply, and S3 Dreaming made zero updates. No corrective user turn was given.

- [S3 first full reply, verbatim](s3-first-answer.md).
- [Paired comparison](paired-comparison.json) and [paired first full reply](pair-s3-first-answer.md): paired S3 added J17/J31/J42 and held J24/J55. The city choice flipped without corrective prompts. Independent draft wording/coverage differs and was retained rather than normalized.
- [Main acceptance audit](main-acceptance.json): recovered jobs, sources, actual decision, exact app/Core reply checks and byte-identical duplicate-replay verification.
- `initial-input.json`, `s3-input-jobs.json`: supplied fixed materials. All roles except Adobe are explicitly simulated; first and new batch IDs are disjoint.
- `s1-*`, `s2-first-*`, `s2-*`, `s3-initial-*`, `final-*`: captured actual states, including the common reviewed S1 prefix retained for pairing.
- `thread-s1.json`, `thread-s2.json`, `thread-s3.json`: bounded app exports with actual prompts, replies and browser tool calls.
- `pair-acceptance.json`, `pair-s2-*`, `pair-final-*`, `thread-pair-*.json`: complete paired snapshots and actual app replies.
- `browser-proof.json`: independent Chrome creation and inspected browser arguments for S1 and both S2 threads; no data-entry/upload method appeared. `test-results.txt`: unchanged implementation passed 594 tests in 57 files.
- `execution-guide.md`: neutral API/browser instructions. Execution agents did not receive the trace, future user turns or scoring answers.

Read-only browser coverage is limited to Adobe's official role and first manual-application page; no Next/save, fictional data entry, upload, account or submission occurred. Exact July 2027 start compatibility and team remain unknown. No later employer questions were invented. S1's initial reply also sought LLM-team confirmation for general software roles; this extra caution is retained as actual behavior and was not made a new durable preference by the operator.

The initial S1 guide requested self-identification through a title tool. A neutral routing message supplied its authoritative create-thread ID before decisions were finalized. Subsequent sessions read `session-bindings.json`, populated from actual app creation receipts; all main source-thread IDs passed audit. This routing message was not Alex dialogue and was not inserted into Core. No substantive task or scoring hint was supplied.

A preceding small Chrome pair is retained in [chrome-rerun](../chrome-rerun/README.md). It selected the expected locations but failed the source-thread binding audit; it is not substituted for this fresh main run. Original evidence was not rewritten.

To reproduce, initialize a new `/tmp` root from `initial-input.json`, supply each current task from the updated [operator trace](../../../../docs/alex-memory-trace.md) to a new projectless local Codex thread using the neutral guide, and write its actual create-thread ID into the root's session-bindings map before open. Stop each scene only after Core archival and local Codex Dreaming. Preserve the S1 files before branching. Add `s3-input-jobs.json` through `add-jobs` only before S3. The report and acceptance files are operator-only; never expose them or future turns to execution threads.

## Verification and replay

Both main and paired audits resolved every archived Core source to its actual thread ID, compared all eight distinct final replies with app exports, checked first actual decisions and shortlist deltas, and replayed every append, close, review receipt and decision without changing store bytes. Both S3 reviews made zero preference updates. The first batch and new batch are disjoint. Main and pair share exactly the same S1 Core/review and the same five new jobs/order. S2 opening and S3 request are identical; the S2 user feedback differs only by New York/Boston. Generated S2 drafts differ (main initially eight answered fields; pair fifteen fields including unknowns), so this is not a claim that all generated task-state bytes were identical.

Run `node --import tsx src/cli/sessionMemoryCli.ts <command> --root <absolute-isolated-root> --input <absolute-envelope.json>` from the repository with the bundled Node bin on PATH. To replay the pair, copy `s1-memory.json` and `s1-local-tasks.json` to their normal names in two new `/tmp` roots, copy only the S1 binding/receipt, and create new S2/S3 chats using the neutral guide and current user words from the relevant Core snapshots. Record each real creation ID in `session-bindings.json`. Supply each next dialogue turn only after the actual reply. Use the domain `add-jobs` operation with the same `s3-input-jobs.json` before each fresh S3. Keep all evaluator reports and future turns out of execution contexts.

Code checks: TypeScript, 57 Vitest files / 594 tests, fixed UI v60, boundary verification, distribution scan and whitespace checks passed. This run changed evidence/docs only; the tested implementation is unchanged. No commit or push was made. This remains a single paired local pilot with read-only first-page employer coverage, not the full multi-strategy/repeated study.
