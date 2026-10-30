# Course extraction - 2026-10-15

This snapshot was selectively extracted from the locally maintained application system after its Matching/Submission and unified-opportunity restructuring. The source had uncommitted changes; this is a content snapshot, not a claim to reproduce a source Git commit. Career remains independently maintained; there is no synchronization back from this repository.

Included: domain logic, fixed Status/Review UI, active workflow skills, narrow data APIs, tests and current operating contracts. Excluded: actual candidate data, resumes, opportunities, draft answers, screenshots, email evidence, archives, device configuration and credentials. Personal test identities were replaced with fictional values. Historical decision documents were omitted to avoid conflicting instructions.

The UI renderer and status projection retain the source v1 hashes. Course-specific demo code lives separately. Existing production URL validation remains HTTPS-only; a local demo form uses a documented fixture mapping without weakening real URL checks.

The fictional demo checks installation, input portability, review choices, live synchronization and durable result recording. Deterministic tests do not measure agent success rates. No course evaluation results or performance improvements are claimed. The browser walkthrough is a smoke test, not a held-out benchmark.

For real use, supply your own facts and approved resume and use the documented workflow. The course package has no personal account connections. Optional legacy helpers are inert and have no saved account configuration.

## Validation on 2026-10-15

- Clean dependency installation and TypeScript checks; 373 deterministic tests in 27 files passed.
- Frozen UI v1 hashes, workflow boundaries and distribution-content checks passed.
- The Codex in-app Browser walkthrough filled the fictional candidate, uploaded the fixture PDF, requested review with an unknown answer, approved the selected answer, synchronized it to the form and recorded a local simulated submission. Status displayed Submitted; the working draft was pruned after recording approval and receipt references.
- The fictional PDF was inspected as rendered and as extracted text. Candidate inputs, real application history and device files are absent from the distribution. Team ownership names are intentional. The pattern scan is a supplement to file review, not proof against every possible secret.
- The development test dependency was updated to Vitest 4; npm audit reported zero vulnerabilities at verification time.

## Example workbench refinement - 2026-10-15

The default development flow is a single ignored `data/`, loaded from a saved example and reused on ordinary Review restarts. The original initialize-only entrypoint has been superseded by the reloadable state loader described below. The fixed fake-employer scenario remains optional. Alex Liu now has a coherent education/work timeline, detailed ownership, skill limits, preferences and intentionally unanswered fields; the resume is derived from those fictional facts. The broader workbench architecture remains deliberately small, with no profile editor or multi-workspace selector.

Legacy report output and example text were translated to English. Compatibility patterns retain external-language recognition via Unicode escapes, and negative language tests retain their original meaning. English aliases are recognized by the inert regional classifier.

Validation after refinement: 375 deterministic tests in 28 files, type checks, UI baseline, boundary checks and the distribution language/privacy scan passed. The revised one-page PDF was rendered and inspected. A fresh local workspace contains copied inputs and zero opportunities; ordinary restarts preserve local edits. The normal course workspace uses port 64441 to avoid the original system's default port.

## Reloadable example states - 2026-10-15

The user clarified that loading is a repeatable state switch, not a first-use setup. `example:load` now replaces working data from a selected bundle, including optional saved progress; it validates the staged copy and preserves previous data locally. Resume filenames come from the manifest. Ordinary Review startup supplies the default Alex case only if data is absent. The repository does not track private working data or backups.

Validation: 378 tests passed, including repeated loading, switching candidate/resume names, loading saved progress, retaining backups, rejecting invalid snapshots and preserving current state on failure. Type checks, UI baseline and distribution/boundary checks passed.
