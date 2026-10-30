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
- **Existing search:** use the workspace already explicitly selected in the conversation, or ask which workspace to resume. Explain the active candidate and saved constraints before continuing. Do not guess an identity from `data/` or silently load the default fictional candidate.
- **Fictional example:** clearly identify the repository's Alex fixture, use an isolated copy for a fresh demo, and ask whether to run a real public search or the scripted offline mechanics demonstration. Never submit fictional data to an employer.

Then follow [Interactive Matching](matching-chat.md). Explain the product surfaces once: "Share your background and feedback here; the webpage shows your saved shortlist." Open the correct workspace's results page after publishing. Keep presentation interactions in English, including feedback explanations and pending conditions, unless explicitly asked otherwise.

## Startup-hook boundary

Codex's official `SessionStart` hook can add model context. Its `systemMessage` is surfaced as a warning, not a normal assistant welcome. It does not establish that opening an empty desktop chat will run a model turn. This implementation intentionally uses the first user message as the trigger and does not install hooks or change global Codex settings.

References: [Projects and primary folders](https://learn.chatgpt.com/docs/projects), [AGENTS.md discovery](https://learn.chatgpt.com/docs/agent-configuration/agents-md), [SessionStart hooks](https://learn.chatgpt.com/docs/hooks).

## Maintenance note — 2026-10-29

Added English greeting routing through `AGENTS.md` and a read-only canonical welcome command. No zero-message startup, default candidate selection, candidate-data writes, browsing or submission occurs at welcome time. Development requests continue to use the normal repository workflow. The existing Status/Review interface is unchanged.
