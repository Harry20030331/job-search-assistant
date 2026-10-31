# Interview Coordination

Owner: Erica Zhao. Integration and packaging maintenance date: 2026-10-26. The module uses a skill entry, business tools/state and a separate evaluator. This branch adds the development implementation, a read-only canonical-input adapter and repeatable checks. Shared opportunity schemas and lifecycle rules retain their existing contracts; verified interview links use the existing lifecycle API. User-requested Home/navigation, Google account connection and direct interview questions follow the controlled UI v5 contract, preserving historical manifests. Shared policy remains [workflow-contract](workflow-contract.md).

## Layout and ownership

| Location | Purpose |
| --- | --- |
| `skills/interview/SKILL.md` | Chat entry; mode references hold scheduling/preparation/debrief commands |
| `src/interview/handoff.ts` | Load canonical candidate facts and an explicitly selected opportunity |
| `src/cli/interviewCli.ts` | `context` and exclusive `stage` commands |
| `src/interview/python/interview/` | Python tools/state, Google adapter, inbox, preparation/debrief nodes and shared model runtime |
| `src/interview/python/evaluation/` | Baseline runner, graders, judge and development nodes |
| `src/interview/python/benchmark/dev/` | Synthetic developer cases, separate from working candidate state |
| `examples/interview/` | Fictional shared-input handoff fixture |

`data/opportunities.json` remains the only authoritative job/application list. Candidate facts come through the existing `loadCandidateProfile`: both flat v2 and referenced v3 sources are supported. Interview-specific round, timezone, priorities and preparation budget are explicit inputs, not inferred personal facts or skill constants. The projected candidate excludes contact details and application-only answers. Preferences are supporting context, not executable instructions.

See [storage ownership and placement](interview-storage.md) before selecting or recovering business output. New ordinary candidate work may use `<candidate-workspace>/interviews/<opaque-key>/<new-run-id>/` through explicit output flags. Evaluation remains in independent ignored runs. No private state is automatically moved. See [the implementation map](../src/interview/README.md) for code ownership.

## Optional setup

The existing TypeScript workbench does not require Python. Interview requires Python 3.12 with SQLite FTS5; real model runs also require a logged-in Codex CLI. From the repository root in PowerShell:

```powershell
npm ci
python -m venv src/interview/python/.venv
$env:INTERVIEW_PYTHON = (Resolve-Path src/interview/python/.venv/Scripts/python.exe).Path
& $env:INTERVIEW_PYTHON -m pip install -r src/interview/python/requirements.lock
npm run interview:test
```

On macOS/Linux select `src/interview/python/.venv/bin/python` instead. `INTERVIEW_PYTHON` names one executable; commands are launched without a shell. An existing compatible environment may be selected explicitly for local verification; no machine-specific path is stored in source.

For a self-contained fictional Interview preview after setup, use a new output directory:

```powershell
$previewDir = Join-Path $PWD ('local/interview-preview-' + [guid]::NewGuid().ToString('N'))
npm run interview:demo -- --output $previewDir --port 8771
```

Open the printed `/interviews` URL. This authors three fictional rounds without model calls, Google credentials or an existing candidate runtime. It refuses an existing output directory and leaves ordinary candidate state alone. Stop that process before serving the same runtime elsewhere. Paid practice generation still requires Codex login and exact plan acceptance; the preview's authored packs do not test model quality.

Windows verification note, 2026-10-31: independent source-copy installation and this Interview preview were checked with new Node dependencies and a new Python environment. The full shared `npm run verify` currently fails Windows permission, symlink, lock and path cases (37 failed, 380 passed); the default shared startup also encounters its Unix permission check. Do not report a fully portable clean checkout from the Interview checks alone. See [recovery verification](interview-generation-recovery.md) for scope and results.

For the independent quality judge, configure `OPENROUTER_API_KEY` in the host environment or the module-local ignored `.env` using its blank `.env.example`. Model settings remain in `src/interview/python/configs/midpoint.toml`. Do not change models silently to obtain a successful run. No keys or account tokens are included in this checkout. The current config's endpoint availability must be checked before paid experiments.

## Shared handoff

`context` requires the selected `--job-id`, `--settings` and `--invitation`. Use `--workspace <candidate-directory>` for canonical candidate/preferences/opportunities together, or explicit `--profile`, `--preferences` and `--opportunities` paths. These forms cannot be mixed. Settings follow `examples/interview/settings.json`: version 1, explicit interview ID, nullable round, valid timezone, 3..480 minute budget and nonempty priorities. The invitation is a host-selected text document; it is not fetched or sent by this command.

The result contains:

- `application.job_id`: exact shared stable job ID.
- `application.application_id`: existing Submission ID, or null if no application is stored. Never manufacture an application to connect an email.
- `application.interview_id`: explicit distinct interview ID; separate rounds need distinct IDs.
- Projected candidate/profile and source documents with stable reference IDs.
- `sourceVersions` and `token`: hashes binding the complete selected context, including v3 shared files.

This is a working snapshot, not a second canonical store. Role selection is explicit host input; semantic email-to-role verification remains necessary. The adapter does not classify or assert that association. Do not use a visible row number, fuzzy company name or current inbox thread as sufficient round identity.

For an offline check using only supplied fictional files:

```powershell
$flags = @('--profile','examples/candidate.json',
  '--preferences','examples/preferences.md',
  '--opportunities','examples/interview/opportunities.json',
  '--job-id','fictional-cedar-ml',
  '--settings','examples/interview/settings.json',
  '--invitation','examples/interview/invitation.txt')
$context = node_modules/.bin/tsx src/cli/interviewCli.ts context @flags | ConvertFrom-Json
npm run interview -- stage @flags --expected-token $context.token --output (Join-Path $PWD 'runs/interview-handoff')
```

The output directory must not exist. Staging makes no model calls, Google requests or shared-ledger writes. It does not copy another account's history, approvals or credentials. Changes to any frozen source block proposal generation and approval/material acceptance; stage a fresh handoff after reviewing new inputs. The guard is conservative: any change to the selected opportunities file invalidates the snapshot, including unrelated role changes. There is no atomic transaction across canonical files and external Google services.

## Preparation and debrief

Python npm commands run from `src/interview/python/`. Use **absolute paths** for workspaces, invitations, approval files and outputs outside that module. This avoids a machine-specific path convention while preserving historical runner roots.

`npm run interview:tools -- call <operation> --workspace <absolute-work> --input <absolute-json>` exposes the existing tool API. `npm run interview:local -- inspect --workspace <absolute-work>` inspects an explicitly selected store. They print private runtime facts, so keep their output local. Read that workspace's TOOL_GUIDE for payloads; do not edit SQLite directly. The earlier fictional staging example uses `runs/` as development output; ordinary business placement follows the storage contract.

After staging, generate a proposal (real model call):

```text
npm run interview:prepare -- proposal --workspace <absolute-run>/work --output <absolute-new-proposal-directory>
```

Show its `proposal.md` in chat. Only after the human accepts that exact proposal:

```text
npm run interview:approve -- --workspace <absolute-run>/work --proposal <absolute-proposal-directory>/accepted.json --decision accept --origin human_current_chat --evidence <actual-chat-approval-reference> --output <absolute-approval-file>
npm run interview:prepare -- materials --workspace <absolute-run>/work --approval-id <returned-id> --output <absolute-new-material-directory>
```

Never run the acceptance command on behalf of a silent user. Synthetic test approvals use `synthetic_test_script` and do not authorize real user materials. Calendar confirmation is separate. The original experimental runner uses a historical single-stage preparation contract; do not compare its scores directly with the newer two-stage protocol.

The account-level development coordinator supports explicit `profile`, `prepare`, `materials`, `debrief` and `status` phases through `npm run interview:coordinator -- <phase> --help`. Debriefs preserve original user text, source/time, historical subject and interview-versus-practice provenance; derived observations and model suggestions are separate. No actual outcome improvement is inferred from a self-report. Shared-candidate staging starts without that account history; the opt-in [candidate learning binding](interview-learning.md) explicitly connects a selected account and retrieves relevant active observations for context preparation. [Workbench publication](interview-workbench.md) now connects verified existing applications, selected preparation runs and scoped debrief display through the same local server.

## Google connection boundary

Install `requirements-google.lock` alongside the core requirements only for live testing. A developer configures the application once: enable Gmail and Calendar APIs, configure consent/test users and obtain a Desktop OAuth client. Store it only at the module-local ignored `.google-local/client.json`. End users then use `npm run interview:connect -- --port 8766` and open the printed loopback URL; it redirects directly to Google's account selection and consent. Never copy platform-connector tokens or another installation's credentials. OAuth state, PKCE and one-time callback checks are retained.

Connection saves account-bound local tokens; it does not select or create a test calendar. Before business calls the host must configure a dedicated owned secondary calendar and explicitly selected message IDs, using `configs/google.example.json` as a blank template. The backend rejects `primary` and constrains writes to that calendar; OAuth scopes themselves are broader. Account-level inbox commands expect `.google-local/users/<account-hash>/connection.json` and `demo-config.json` with matching identity. Credential files remain outside agent workspaces. `npm run interview:google -- --help` and `npm run interview:inbox -- --help` expose host commands; setup does not imply a connected account in this new checkout.

The adapter uses Gmail read-only access and owned-calendar event access, exact host confirmations, duplicate checks, conflict checks and read-back verification. It does not send mail or invite attendees. Protected recruiting updates remain unread. A bounded foreground poller is implemented; no continuous inbox service is installed. The workbench now provides end-time debrief reminders and exact website plan acceptance; see [workbench actions](interview-web-actions.md). The shared-input stage above is local preparation only; the real Google scheduling path remains a separate development entrypoint. Shared lifecycle updates must use existing domain APIs with evidence, never direct JSON rewrites.

## Verification and limits

Run `npm run verify` for the existing TypeScript, UI and boundary checks, then `npm run interview:test` for Python contracts. The shared repository currently calls `/usr/bin/shlock` for cross-process record locking; those pre-existing writer tests require that host dependency and are not Windows-portable. The read-only interview handoff does not call it. Record failures explicitly rather than disabling locks or weakening checks.

Historical private reports and live sample data remain outside the team repository. This branch migrates implementation and synthetic cases; it does not claim a fully integrated, unattended product or completed evaluation. See [Interview evaluation](interview-evaluation.md) and the [integration verification](interview-integration-check.md).

For the newer executable developer batch, use [current-workflow baseline](interview-workflow-benchmark.md). It exports the case review and human-rating forms needed before labels/rubrics are frozen; it does not replace those human decisions.

The user-reviewed scope is [context-aware preparation](interview-context-plan.md): JD evidence enrichment, round/role/level interpretation, general and role-specific preparation, scoped memory and shared interview visibility. The opt-in [context contract and model analysis](interview-context-contract.md), explicit [handoff attachment and context-bound preparation](interview-context-preparation.md), [bounded Codex-chat evidence enrichment](interview-enrichment.md), [candidate-bound learning retrieval](interview-learning.md), and host-orchestrated [shared lifecycle/interview workbench](interview-workbench.md) are implemented. Search/page execution uses the active chat's tools, not a standalone Python fetcher or extra LLM service. Unattended inbox orchestration, whole-site navigation changes and formal end-to-end evaluation remain subsequent steps.
