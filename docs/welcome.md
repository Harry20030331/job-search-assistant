# Start the website

Open this repository as the primary folder in a Codex project and send `Start` (or `Hi` / `Get started`). Codex reads `AGENTS.md`, starts `npm start` in a persistent terminal session, and visibly opens the printed `welcome_url` in the in-app Browser. Users do not need to type terminal commands or supply JSON.

The first message is the trigger. Opening a folder alone does not run a model turn, select a candidate, save facts or authorize research. Explicit development requests are not onboarding.

## Welcome and four shared pages

Welcome is candidate-free. Choose **New candidate**, **Continue an existing search**, or **Try the fictional example** on the website. Existing searches show names, locations, counts and missing-data diagnostics. New setup creates a fresh private workspace only after the user confirms the form. The example creates a separate fictional copy and remains a local rehearsal.

The selected workspace has four main pages:

1. **Profile & preferences:** confirm background, skills, education and experience; save search feedback; upload and explicitly approve a PDF under a new resume-profile key; request New Grad matching from SimplifyJobs/New-Grad-Positions, followed by official-page verification. Open web search is outside the current scope.
2. **Status / Shortlist:** inspect saved matches, select an approved resume profile for live preparation, select jobs and click Apply.
3. **Review:** edit drafts, resolve missing facts, approve content, then separately click Submit applications for the exact approved batch.
4. **Interview preparation:** paste invitations, give availability, request plan changes and share debriefs through the webpage request form; read results or follow-up questions there. Existing exact-plan approval and practice views remain in place. Calendar writes require confirmation of the exact proposed action in a subsequent request.

All four use the same canonical candidate, preference, resume and opportunity records. Google account connection remains a supporting settings page. Existing application/interview authorization and evidence gates still apply. Resume approval is optional for search and required before application preparation. Uploading a new PDF never replaces an existing approved mapping.

## Agent connection and recovery

When launched from Codex with `CODEX_THREAD_ID`, startup binds selected workspaces to that existing chat using the installed `codex queue --resume` command. `CODEX_CLI_PATH` can explicitly select its executable. Application tasks use the existing claim/finish protocol, with `--workspace <selected-directory>` for isolated workspaces. Search requests send only a fixed workflow instruction and a reference to saved canonical inputs. Failed or uncertain delivery is shown honestly and is never silently replayed.

Keep the website process and the owning Codex chat available. The user works on the website; Codex performs research and employer-page work through its in-app Browser. A saved or delivered request does not establish completed research, live-form continuity or employer submission. Live application controls stay offline without the connected chat; they do not start a substitute agent. When the connection is unavailable, restore it in Codex and report the blocker instead of substituting a separate agent.

A linked schema-version-3 profile remains read-only in the basic editor to preserve its independently owned shared sources. Such sources need a scoped Codex update. The initial form supports manual background entry; document extraction and LinkedIn observation continue to require the existing source-reading workflow and explicit fact confirmation. Do not claim that a URL or uploaded PDF has been parsed just because it was supplied.

## Maintenance — 2026-10-31

The user requested website interaction, a Welcome entry on `Start`, four main pages and direct collaboration on main without a PR. This replaces the chat-first onboarding default. The historical `matching -- welcome`, intake and workspace commands remain compatible utilities. No global Codex settings or zero-message hooks are installed.
