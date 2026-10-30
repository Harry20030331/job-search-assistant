# Start the English setup conversation

## Open the project in Codex

Use a local project with this repository as its primary folder. If the project is already in the sidebar, select it and start a new chat within that project. Otherwise create/add a local project and select the `job-search-assistant` folder through the folder picker. In clients exposing Edit project, use Edit project > Add folder and make this repository the primary folder. Do not rely on dropping a folder into a message as an attachment: an attachment is not a documented substitute for selecting the primary working directory.

Codex discovers `AGENTS.md` from the primary folder. That entry file routes the first greeting to the setup flow. Merely opening the project does not create an assistant response. Send:

```text
Hi
```

`Start` or `Get started` works too. No technical activation prompt is needed. This routing is a project instruction executed by Codex on the first message; its live behavior depends on the client loading the project instructions. It is not a separate always-running onboarding service. If the welcome does not appear, check that the repository is the primary folder, then send `Start job-search setup using AGENTS.md`.

## First response

Read the canonical message with `npm run matching -- welcome` and show its English text in chat, without CLI output framing. This command is read-only and works before candidate data exists. Do not run intake, initialize storage, start a search or switch cases just because the user greeted the assistant.

After the user chooses:

- **New candidate:** ask, "Please share your resume or briefly describe your education, experience, and main skills. What roles and locations are you targeting, and when could you start?" Read any supplied information first and ask only what is missing. Then clarify work modes, the explicit supported role category and search limits as needed. Translate technical category keys into understandable role descriptions. Summarize the extracted facts and preferences in English for confirmation before initializing a new workspace.
- **Existing search:** first run `npm run matching -- workspaces`. Present the discovered searches as a numbered English list with candidate name, saved folder, total/active job counts and last recorded job activity. Ask the user to choose a number; do not first demand a name or path. Identify empty workspaces as "No search results yet". If there are no results, say "No saved search results were found" and offer new setup or the fictional example. Surface scan errors and missing registered folders separately; they are not proof that no records exist. A path is an optional fallback for a workspace outside the bounded discovery scope. Do not silently choose an identity. After selection, read its current context and constraints.
- **Fictional example:** clearly identify the repository's Alex fixture, ask whether to run a real public search or the scripted offline mechanics demonstration. For live research, first run `npm run matching -- example --workspace <new-directory>` to copy and register the fictional inputs, then start and open its website BEFORE browsing any sources. Do not defer workspace creation or web startup until after research. Never submit fictional data to an employer.

Then follow [Interactive Matching](matching-chat.md). Explain the product surfaces once: "Share your background and feedback here; the webpage shows your saved shortlist." Before browsing job sources, run `npm run matching -- serve --workspace <selected-workspace>` in a persistent terminal session, open the returned `statusUrl` in a visible in-app Browser tab, and keep it available as the results tab. This starts the fixed website even when the selected workspace has no jobs yet. Reuse that session/URL during the conversation; do not start another server for each feedback turn. Research external sources in background tabs. After each publication, reload the results tab and return focus to it. Do not use a different workspace's old localhost URL or replace the results tab with a source listing. Report a startup failure explicitly instead of silently continuing chat-only. Keep presentation interactions in English, including feedback explanations and pending conditions, unless explicitly asked otherwise.

## Startup-hook boundary

Codex's official `SessionStart` hook can add model context. Its `systemMessage` is surfaced as a warning, not a normal assistant welcome. It does not establish that opening an empty desktop chat will run a model turn. This implementation intentionally uses the first user message as the trigger and does not install hooks or change global Codex settings.

References: [Projects and primary folders](https://learn.chatgpt.com/docs/projects), [AGENTS.md discovery](https://learn.chatgpt.com/docs/agent-configuration/agents-md), [SessionStart hooks](https://learn.chatgpt.com/docs/hooks).

## Maintenance note — 2026-10-29

Added English greeting routing through `AGENTS.md` and a read-only canonical welcome command. No zero-message startup, default candidate selection, candidate-data writes, browsing or submission occurs at welcome time. Development requests continue to use the normal repository workflow. The existing Status/Review interface is unchanged.

Saved-search discovery and selected-workspace web startup were added on 2026-10-29. See [workspace discovery](workspaces.md) for scan scope, the private index and recovery behavior.
