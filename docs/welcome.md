# Start the website

Open this repository as the primary folder in a Codex project and send `Start` (or `Hi` / `Get started`). Codex reads `AGENTS.md`, starts `npm start` in a persistent terminal session, and visibly opens the printed `workspace_url` (`welcome_url` alias) in the in-app Browser. Users do not need to type terminal commands or supply JSON.

The first message is the trigger. Opening a folder alone does not run a model turn, select a candidate, save facts or authorize research. Explicit development requests are not onboarding.

## Single-user entry and four shared pages

On first launch, confirm your profile from LinkedIn, pasted text, or a PDF. CareerOS writes your profile to the repository’s `data/profile/candidate.json` and reopens your Status page on later launches. Try example opens Alex’s pilot shortlist. Select jobs, choose Apply to review prepared answers, then approve the snapshot to see Submitted and open an interview. These steps navigate preset pages. My workspace returns to the personal workspace.

Profile remains available for later edits and multiple approved PDF versions. Initial setup still opens Profile once; returning visits open Status. The explicit `/welcome`, `/existing` and `/example` routes remain compatibility/recovery/demo surfaces. Fictional examples never replace a remembered real user and never become the automatic startup target. No unconfirmed source preview is persisted as a user selection.

The selected workspace has four main pages:

1. **Profile & preferences:** confirm background, skills, education and experience; save search feedback; upload and explicitly approve a PDF under a new resume-profile key; see daily New Grad update status or refresh manually; all matching uses SimplifyJobs/New-Grad-Positions followed by official-page verification. Open web search is outside the current scope.
2. **Status / Shortlist:** inspect saved matches and their per-job Resume tags, then select jobs and click Apply. Jev chooses the approved PDF during Matching; there is no batch-level resume picker. Unmatched, uncertain or stale routing blocks live preparation until the inputs are corrected and Matching is refreshed.
3. **Review:** edit drafts, resolve missing facts, approve content, then separately click Submit applications for the exact approved batch.
4. **Interview preparation:** paste invitations, give availability, request plan changes and share debriefs through the webpage request form; read results or follow-up questions there. Existing exact-plan approval and practice views remain in place. Calendar writes require confirmation of the exact proposed action in a subsequent request.

All four use the same canonical candidate, preference, resume and opportunity records. Google account connection remains a supporting settings page. Existing application/interview authorization and evidence gates still apply. Resume approval is optional for search and required before application preparation. Uploading a new PDF never replaces an existing approved mapping.

## Agent connection and recovery

When launched from Codex with `CODEX_THREAD_ID`, startup binds selected workspaces to that existing chat using the installed `codex queue --resume` command. `CODEX_CLI_PATH` can explicitly select its executable. Application tasks use the existing claim/finish protocol, with `--workspace <selected-directory>` for isolated workspaces. Search requests send only a fixed workflow instruction and a reference to saved canonical inputs. Failed or uncertain delivery is shown honestly and is never silently replayed.

Keep the website process and the owning Codex chat available. The user works on the website; Codex performs research and employer-page work through its in-app Browser. A saved or delivered request does not establish completed research, live-form continuity or employer submission. Live application controls stay offline without the connected chat; they do not start a substitute agent. When the connection is unavailable, restore it in Codex and report the blocker instead of substituting a separate agent.

A linked schema-version-3 profile remains read-only in the basic editor to preserve its independently owned shared sources. Such sources need a scoped Codex update. The three source methods use the connected existing Codex chat for reading and extraction, with single-claim, revision-bound preview requests staged under ignored `local/intakes/`. LinkedIn requires visible source observations; PDF content must actually be read. Inaccessible or incomplete sources produce an honest webpage message and a correction/alternative-source option. Uploading or supplying a source does not establish extraction success, candidate confirmation or resume approval.

## Maintenance — 2026-10-31

The user requested website interaction, a Welcome entry on `Start`, four main pages and direct collaboration on main without a PR. This replaces the chat-first onboarding default. The historical `matching -- welcome`, intake and workspace commands remain compatible utilities. No global Codex settings or zero-message hooks are installed.

## Source-first intake — 2026-10-31

The user rejected the long upfront candidate form and requested LinkedIn link, pasted text or PDF as the three initial choices. UI v32 replaces the initial form with one selected source input, then a readable extracted preview and a short preference confirmation. Candidate records are not initialized while source reading or correction is pending. Changes stay uncommitted for the user's own review.

## Daily updates — 2026-10-31

After selection, a confirmed real workspace checks for an initial/overdue matching round in the background and then every 24 hours while the local service runs. Reopening catches up; manual Refresh jobs stays available on Status and Profile. All triggers share one durable active request. Failed or uncertain work cannot advance the successful timestamp. Fictional examples pause automatic research. Source scope, details and local-process limitations are in [daily updates](job-refresh.md). Welcome and unconfirmed intake still run no matching.

## Maintenance — 2026-11-01

The user requested a single-user product: initial Profile setup followed by direct Status entry on later opens. This supersedes the recurring candidate-choice entry. They also requested moving resume selection into Matching, with per-job Resume tags and different approved PDFs within one Apply batch. Active selection is a private pointer, not a duplicate candidate or job store; examples remain isolated. The Morandi presentation and exact resume handoff are recorded in UI v40 and [job directions](job-directions.md).


Maintenance — 2026-11-01: New-profile confirmation and Profile preferences now offer explicit flexible direction/location options. Users need not enumerate target job titles. Save/confirmation records the chosen scope; Jev later evaluates actual role responsibilities against the confirmed background. Saving preferences does not run discovery or change application authorization.
