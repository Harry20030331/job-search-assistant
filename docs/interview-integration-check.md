# Interview integration verification

Date: 2026-10-25. Upstream: `Harry20030331/job-search-assistant`, commit `311f759`. Local feature branch: `erica/interview-coordination`. These are integration checks, not interview-agent quality measurements.

## Changes

- Preserve existing Python package paths under `src/interview/python/`, including typed tools, local/Google adapters, baseline/evaluation code, contracts and developer fixtures.
- Add the team's `skills/interview/` chat entry and npm commands, following English documentation and stable-ID handoff conventions.
- Project canonical candidate facts through the existing v2/v3 loader and read the selected shared opportunity through its parser. No shared schema or authoritative job list was added.
- Stage a fresh preparation workspace, retaining an existing application ID or null, explicit interview settings and input-version hashes. Changed canonical sources block subsequent preparation.
- Keep original experimental prompts distinct from the new integration skill and newer two-stage preparation protocol.
- Exclude credentials, real messages, account state, historical live runs/reports, previous approvals and human ratings. The two-stage example's invitation was replaced with a fully fictional fixture.
- Normalize Windows paths in the existing distribution scanner. Keep exact frozen UI files at LF through `.gitattributes`; original UI content and manifest hashes are unchanged.
- Package the operational skill with mode-specific scheduling, preparation and debrief references; route interview requests from AGENTS.md. Document business, account-learning and experiment storage ownership in one storage contract.
- Place preparation/debrief execution and shared model invocation under the business package, preserving former evaluation imports and CLI entrypoints. Add existing-tool API and local-inspection npm wrappers without changing task prompts, group definitions or rubrics.

## Observed checks

| Check | Observed result |
| --- | --- |
| Locked Node installation | Passed; no dependency or package-lock changes |
| `npm run typecheck` | Passed |
| New TypeScript handoff tests | 5/5 passed |
| `npm run interview:test` | 112/112 passed using an explicitly selected compatible Python environment |
| `npm run ui:check` | Passed against original v1 hashes |
| Existing structural boundary check | Passed |
| Existing distribution scan | Passed |
| Fictional TypeScript-to-Python staging | `context_ready`; zero model calls, Google writes or opportunity writes |
| Python preparation/evaluation npm entrypoints | Help commands resolved correctly |
| Full TypeScript suite | 248 passed, 145 failed; not a green full-repository verification |

The unchanged upstream was independently checked in a temporary local checkout with the same Node dependencies and Windows host: **243 passed, 145 failed**. Comparing failed test identities between upstream and the integrated checkout found **zero added failures and zero removed failures**. All five added tests passed. Existing failures include `/usr/bin/shlock` dependency, POSIX permissions/symlink/FIFO assumptions, platform path recognition and related subprocess tests. One pre-existing unhandled rejection was also reported. Those shared mechanisms were not disabled or rewritten for this module. Local JSON comparison reports remain ignored under `local/`.

The initial UI check failed because Windows checkout converted LF to CRLF; restoring exact upstream blob bytes and adding narrow EOL attributes fixed the check without changing or refreshing its baseline. The initial registry installation was blocked by the restricted environment; installing the locked packages with permitted network access succeeded.

After skill/runtime organization, the full 112-test Python suite and five TypeScript handoff tests passed again, along with TypeScript checks. Skill Creator validation and linked-reference checks passed. The new tool and inspection wrappers executed against the fictional staged workspace; the old preparation CLI and shared runtime/debrief imports remain compatible. These checks made no model or Google calls. The full-repository Windows comparison above is retained from the earlier integration run, rather than represented as a new full-suite result.

## Remaining boundaries

No live Google connection was copied or started in this checkout. Account-level Google scheduling and the shared-input preparation handoff remain separate development paths. Automatic shared-candidate/account/history binding, interview lifecycle publication and fully unified baseline evaluation are still pending. No new model benchmark, calibrated judge result or measured method improvement is claimed. See [evaluation status](interview-evaluation.md) for the next research milestone.

Those remaining boundaries describe the original 2026-10-25 check. Subsequent 2026-10-26 development added opt-in [candidate learning binding](interview-learning.md) and [host-orchestrated lifecycle/workbench publication](interview-workbench.md). Their [later test/browser observations](interview-workbench-verification.md) are separate from the preserved upstream comparison above.
