# Direct questions and executable answers

Date: 2026-10-26. The user requested direct interview questions, strong-answer guidance inside answers, complete code for algorithm questions and a larger Cobalt question bank. These are local development changes; team review and independent material-quality ratings remain pending.

## Actual generation and code review

The existing isolated preview now contains 8 DS, 8 SWE and 10 recruiter questions, including linked alternatives. The main plans retain their original 50, 60 and 20 minutes. Cobalt is a recruiter round with no coding; its bank covers introduction, role/company interest, collaboration, feedback/learning, ownership and candidate questions. Repeated themes are alternate prompts, not additional required sections. No different round was invented.

Private first attempts and outputs remain under parent-workspace `runs/practice-direct-20261026/`. DS completed in 65.657 seconds and recruiter in 61.094 seconds. The first SWE output incorrectly grouped story/coding exercises under intro and failed exact section-budget validation. A separately retained retry with an explicit section checklist passed in 74.750 seconds. All use existing configured Codex, zero authorized actor tools and synthetic fixture approval, not human acceptance. The new protocol is `context-direct-practice-node-v1`; historical experiment outputs were not replaced.

The SWE pack has two complete Python algorithms, initially passing six generated tests each. Independent unit-grid oracle testing (seed 329, 200 random interval cases per function plus explicit malformed-input boundaries) exposed an early return that skipped invalid busy-entry checks for an empty window in one function. Host review removed that early return, added two regression cases, rechecked both functions, and published a new material row through the existing exact-plan API. Raw model outputs remain intact; `reviewed-accepted.json` and `independent-code-review.json` record the correction, hashes and provenance. Each final function passed 210 checks (8 declared tests plus 202 independently supplied cases, including overlapping boundary cases). This is not 420 unique random tests or a proof of general correctness.

The generation gate requires executable coding answers and runs declared tests before saving. It restricts the supported Python constructs and built-ins, permits no imports/I/O/reflection and uses an isolated-interpreter subprocess with a three-second timeout. It is a bounded teaching-code checker, not a general security sandbox. Independent oracle checks and the host correction above were a separate review step, not an automatically established capability for arbitrary algorithms. Model-declared test success does not establish semantic quality.

## Verification

- Targeted TypeScript views/server/workbench/account/CLI checks: 87 passed; typecheck passed.
- Targeted Python practice/code/context/dashboard checks: 31 passed. They cover actual code execution, wrong answers, unsupported imports/I/O/reflection, mandatory code, alternative budget/section binding and source references.
- In-app Browser verified Cobalt's ten direct questions, guidance behind Show answer, the full corrected Python answer and separate problem examples. Screenshot artifacts remain private in the direct-practice run directory.
- Controlled UI v4 preserves prior manifests. Privacy/language, structural-boundary and whitespace checks passed.

The full repository suite was not rerun for this focused change; earlier Windows/POSIX compatibility failures remain unresolved. The question packs remain semantically unrated. No live Google write, real application update or new production authentication behavior was introduced.
