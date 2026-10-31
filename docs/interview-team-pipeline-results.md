# Three-resume integration check

Maintenance date: 2026-10-30. This development run used three deliberately authored fictional profiles, three observed real job pages, a local application form, virtual Gmail/Calendar and the configured Codex CLI. All application, calendar and plan decisions and mock-practice reports were explicitly synthetic. No employer received an application and no real Google account was accessed.

| Candidate | Selected job | Budget | Final practice |
| --- | --- | --- | --- |
| Avery Chen: applied LLM/evaluation | Quora, Machine Learning Engineer New Grad | 60 minutes | 8 questions, including 2 coding questions |
| Blake Rivera: backend/platform | Quora, Software Engineer New Grad, ML Platform | 60 minutes | 8 questions, including 2 coding questions |
| Casey Patel: product DS | Pinterest, Master's University Grad Data Scientist | 45 minutes | 8 questions |

## Executed path

The root Codex session inspected the public listing and official roles in the in-app Browser. Separate model calls screened the three-by-three candidate/job matrix. Matching publication, preflight, application creation and lifecycle changes used existing domain interfaces and the same stable opportunity/application IDs.

For each candidate the in-app Browser filled the local form, uploaded the hash-verified PDF, inspected Review, supplied a synthetic required answer, approved and submitted once. A local receipt established the simulated submission. The shared record advanced to Interviewing only after the verified synthetic invitation was associated with that application.

Each invitation entered a separate virtual Gmail store. The existing inbox worker made an actual Codex classification call. A test-only inline scheduling node extracted a proposal; the existing `GoogleAdapter` checked exact synthetic confirmation, wrote to the virtual calendar and read it back. Thirteen calendar/mail assertions per candidate passed, including rejecting an unapproved write, deduplication and preserving unread state. This scheduling bridge is host test glue, not the deployed OAuth handoff dispatcher.

Canonical interview handoffs then fed context analysis, plan generation, exact plan acceptance, full direct practice and mock debrief processing. All three final workbench exports were current, candidate-isolated, material-visible and linked to the exact existing application. Explicit future-clock checks exercised end-of-interview notices without sending reminders. The development heartbeat remains bound to its original preview candidate.

## First attempts and repairs

- Initial screening immediately selected a job for one candidate. Two needed authored qualification clarifications: one turn for Avery, two for Casey. Preserve those changed-input conditions separately; this is not a matching-accuracy score.
- Application bootstrap first used an unnormalized model URL. Matching had correctly normalized it. The test driver now consumes canonical opportunity identity, preserving earlier created records.
- First context analyses failed 0/3: company claims cited JD-kind sources. Captured company excerpts from the same already-observed pages plus explicit guided source-type instructions resolved this condition. Source capture and prompt changed together, so this is not an isolated ablation.
- First practice generation passed 1/3. The other outputs grouped sections incorrectly or returned null direct-question details. The new `context-direct-practice-node-v2` schema requires non-null title/details/sample answer and exactly one exercise per main section. Historical stored simulation packs remain compatible.
- Independent diagnostics found two invalid-tail counterexamples in one original backend answer despite its generated examples passing. Whole-input-validation guidance was added. A later practice attempt used unsupported `type()` and was rejected; generation now receives the unchanged executor's allowed built-in/method list.
- Mock history correctly invalidated the backend's old preparation approval. A new model-generated v2 plan and separate exact synthetic acceptance preceded its final practice. No fingerprint or historical approval was rewritten. Other mock reports used separate learning stores; automatic cross-store memory binding remains outside this run.
- Browser review found three wording mismatches. Separate editorial copies correct label/count output wording, define citation micro-aggregation and describe two linear scans. Code, plan budgets and approvals are unchanged. Original model responses and material rows remain available; the displayed copies are not raw model-quality results.

Final diagnostic checks passed for all four final coding answers on **24 additional cases**, including invalid trailing items. Cases were authored after generation and the regenerated backend questions differ from the originals; this is a development recheck rather than an identical-question benchmark comparison.

## Evidence and interpretation

The private run is `runs/three-resume-pipeline-20261030/` in the parent development workspace, outside this checkout. It contains the three PDFs, canonical profiles and input versions, browser snapshots, prompts/schemas/invocations, local receipts, virtual service traces, proposals, approvals, practice, immutable mock reports, editorial manifests and machine-readable summaries. `report.md` links each artifact. Raw mail and candidate runtimes remain outside Git.

Recorded execution: **32 unique Codex invocations**, 981.312 summed invocation seconds; parallel calls overlap. Model/API dollar cost is unavailable. There were zero OpenRouter judge calls, real Google calls and real employer submissions.

Verification: **250 Python tests passed** after the structural repairs; the final practice/code-check prompt change additionally passed **13 related tests**. Type checking, UI contract v5, structural boundaries and distribution scan passed. Counts are not additive unique tests.

The profiles were deliberately selected after observing the roles. The application exercise used one simple local form, not three real ATS sites. Clarifications, approvals and debriefs were scripted, and host orchestration connected module entrypoints. Semantic preparation quality remains uncalibrated. These observations support module interoperability and expose failure modes; they do not establish unattended operation, held-out accuracy, preparation benefit or interview outcomes.
