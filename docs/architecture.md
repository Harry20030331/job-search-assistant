# Applications Architecture

The local system separates candidate inputs, deterministic record management and Browser execution. Active behavior is defined in [`docs/workflow-contract.md`](workflow-contract.md); [candidate-inputs](candidate-inputs.md) describes physical input ownership.

## Active topology

`/status/us` projects `data/opportunities.json` through compatibility view models. `/review` presents actionable drafts and decisions. The UI is English-only and versioned under [ui-contract](ui-contract.md). Closed/hidden rows are retained in storage; submitted and confirmed share one visible Submitted stage. There is no market selector. `/status/china` redirects to `/status/us`; retained China modules and data are historical and are not startup dependencies.

## Dependency direction

1. External candidate facts and approved PDFs, plus job-specific local rules, supply inputs. `src/profile.ts` composes shared facts in memory; it writes no duplicate profile.
2. `src/` owns preflight, validated records, expected-revision checks, file locks, lifecycle evidence and narrow CLI adapters.
3. `skills/` directs Codex's in-app Browser; runtime modules do not become another browser executor.
4. Per-role drafts hold working answers and decisions. Opportunities hold the durable lifecycle and minimal success provenance.
5. The local server projects records and receives website actions. `ApplicationTaskService` persists and serializes preparation/submission requests. The default executor rehearses locally; the optional Codex executor uses the configured in-app Browser. The server has no direct ATS client.
6. `application-tasks.json` records request state and exact authorization references. Actual lifecycle and success evidence remain on the existing opportunity. A runner exit code or claimed success cannot advance that lifecycle.

The fixed renderer is separate from the sanctioned data interface. Ordinary job/status/answer updates use domain APIs plus `npm run data`, preserving siblings and consumed history. A website approval and its live synchronization remain separate states. Explicit chat approval is recorded as chat evidence under the operational contract, not fabricated as a website event.

## Initialization and recovery

`initializeRuntime` creates new empty storage exclusively; it refuses an existing directory. `resolveRecoveryInputs` validates saved US records, private permissions and cross-record identity before restoring the local surface. Both leave live ATS state unverified. A local service restart and a lost employer session are different recovery cases.

Candidate inputs are explicitly selected. The fictional distribution has no default personal source and no required CV directory. Explicit profile/manifest paths and an independent runtime directory allow synthetic validation without those personal dependencies. Manifest-relative CV paths resolve from the manifest's directory. No input is parsed from a PDF into canonical facts automatically.

## Verification and exclusions

Tests live beside their modules as `src/**/*.test.ts` and exercise schemas, locking, approval/synchronization, lifecycle evidence, CLI boundaries and synthetic empty-runtime startup. `ui:check` guards the unchanged renderer baseline. `verify-boundaries.mjs` checks active structural policy without requiring real candidate data or historical validation packs; the distribution check inspects tracked artifacts independently of personal runtime data.

There is no extension, Chrome-profile dependency, generic form scanner, browser replay engine, automatic CV editor, CAPTCHA bypass, undocumented ATS client or persistent inbox monitor. Credentials and raw mail never enter application records. This course extraction is independently maintained.

## Directory ownership

[structure.md](structure.md) is the detailed physical map; [commands.md](commands.md) owns runnable usage examples. No private archive was included in this extraction.


### Existing-chat dispatch

`chatTaskBridge.ts` optionally delivers a saved website batch to the configured existing Codex chat using the installed `codex queue` command. The website supplies only strict task selections; the thread and executable come from ignored runtime config. The chat, not an additional CLI agent, claims work through `chatTaskCli.ts`. `applicationTasks.ts` owns delivery state, atomic claims and evidence-checked completion. Queue acceptance is separate from task completion. No scheduler, browser injection or recurring model polling is involved.

`liveCandidate.ts` checks fresh composed candidate inputs before live startup and execution, including tasks claimed by the existing chat. Fictional markers and reserved contact domains block live work; this does not replace preflight, browser verification or the exact submission authorization. macOS uses `shlock` record locks; Windows uses the native exclusive-file lock adapter. Linux hosting is not validated.
