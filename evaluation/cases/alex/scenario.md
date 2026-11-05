# Alex's three sessions

CareerOS normally finds and screens jobs. This pilot supplies ten fictional roles so each run sees the same choices. CareerOS makes the recommendations; Alex reviews them.

For the interactive website preview, use `npm run demo:alex`. For a scored run, use Node.js 22+, install dependencies with `npm ci`, and sign in to the local Codex CLI. From the repository root on macOS, create a fresh evaluation workspace:

```sh
mkdir -p evaluation/runs/alex
alex_run=$(mktemp -d "$PWD/evaluation/runs/alex/pilot-XXXXXX")
cp -R evaluation/cases/alex/data "$alex_run/data"
chmod -R go-rwx "$alex_run/data"
printf '%s\n' "$alex_run"
```

Give each execution thread the printed workspace path, its own thread ID and its session ID. Use the [session lifecycle](../../../docs/session-memory.md#real-user-sessions) to open, append, and close each session. Start one independent thread per session against that same directory. Record the actual exchanges through the normal session lifecycle. Deliver only the current user message to the thread.

## S1 — Screen the current job list

The initial opportunity ledger already contains A1–A5. Ask CareerOS to screen the five roles and give one reason per decision. After its answer, retain the Seattle retrieval and Washington remote roles and explain that Alex likes the New York work but currently does not want to move there. In a later turn, explain the Staff experience gap and the prior Harbor Index application. Close the session after Alex reviews the list. Preserve the resulting screening preference file under `results/evidence/S1-close/profile/preferences/`.

## S2 — Prepare the two applications

Ask CareerOS to prepare the two roles kept last time, without repeating their names or IDs. Ask for one combined review of the simulated drafts and outstanding questions. Before Alex replies, save the current opportunity ledger and the two drafts under `results/evidence/S2-first-review/opportunities/`. During review, clarify project ownership, leave salary unanswered and decline the optional demographic questions for these two drafts. Close after revision. Local preparation only.

## S3 — Screen the next batch

Send the following as Alex's first message, including the supplied listings. CareerOS adds the roles to the opportunity ledger and screens them. Record its first reply as T1 before Alex gives feedback. An independent evaluator uses [the checkpoint criteria](checkpoints.json) and writes both checkpoint verdicts and evidence references in `results/scores.json`. From that file, cite the first answer as `../data/sessions/S3.json#/turns/0/assistant`.

Please add the five roles below to my job list, screen them against my background and preferences, and show me your shortlist with a brief reason for each decision. I'll review your recommendations.

B1 — Applied LLM Engineer — New Grad | Eastbridge Intelligence (fictional) | New York, NY
BS/MS, 0–2 years; July 2027 start. Build Python retrieval assistants, grounded citations and evaluation suites. Onsite Manhattan 4 days/week. Employees must reside in the NYC area; relocation required for out-of-area hires, no remote option.

B2 — Software Engineer, Agent Reliability — New Grad | Metro Agent Tools (fictional) | New York headquarters; US distributed team
BS/MS, 0–2 years; July 2027 start. Python tool validation, task replay, REST APIs and regression testing. Role is fully remote in approved US states, including Washington. Working from Seattle is permitted; no relocation or New York office attendance required.

B3 — Backend Engineer, Search — New Grad | Lakeview Documents (fictional) | Seattle, WA
BS/MS, 0–2 years; July 2027 start. Seattle hybrid 2 days/week. Python document indexing, SQL APIs, retrieval evaluation. Cloud familiarity preferred; mentorship provided.

B4 — Software Engineer, Retrieval Platform — New Grad | Peninsula Retrieval (fictional) | Sunnyvale, CA
BS/MS, 0–2 years; July 2027 start. Python retrieval pipelines and testing. Onsite Sunnyvale 3 days/week; remote allowed only from California. Candidate must relocate to California if currently elsewhere.

B5 — Research Scientist, Foundation Models | Northstar Research (fictional) | US Remote — Washington eligible
July 2027 start. Requires completed PhD, peer-reviewed first-author publications and large-scale distributed pretraining expertise. Lead novel model architecture research.
