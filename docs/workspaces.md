# Saved searches and their website

Normal startup restores the explicitly remembered real user directly to Status through `local/active-workspace.json`; see [single-user entry](welcome.md). The following workspace chooser and CLI procedures are recovery/compatibility tools, not a recurring step for the product user. Fictional examples never replace the active real user.

Selecting "Continue an existing search" first runs `npm run matching -- workspaces`. Codex displays an English numbered list with candidate, saved folder, total/active jobs and latest recorded job activity. The date describes stored observations, not a completed discovery scan. Same-name candidates in separate folders remain separate choices. The user selects a number rather than having to remember a path.

With no saved job records, say "No saved search results were found" and offer new setup or the fictional example. Candidate workspaces with zero jobs are reported separately as "No search results yet" and can be selected to begin searching. Missing registered folders, malformed records and unreadable locations are diagnostics, not evidence of no results. Listing never repairs, deletes, initializes or switches candidates.

## Discovery scope

- Current repository `data/opportunities.json`.
- Previously registered paths in ignored `local/search-workspaces.json`.
- Direct workspace children of ignored `local/workspaces/`.
- Direct child directories with `matching` or `job-search` in their name in the OS temporary directory and `/tmp`, to recover older demonstrations.

There is no recursive home/disk scan. Symlink children and symlink data stores are skipped; canonical paths deduplicate aliases. Each directory contributes at most 200 matching children; truncation is reported. Outside these locations a search must have been registered or be explicitly selected by the user. The OS may remove temporary workspaces; an index does not make them permanent. The `examples/` fixture is an input, not historical search results.

New Matching intake and scripted demo workspaces register automatically. For another explicitly selected existing search, Codex runs `npm run matching -- remember --workspace <existing-directory>`. The private index stores paths only, with locking and atomic writes; jobs remain canonical in each workspace. Index failures produce a warning and do not discard completed intake/demo data. The index is local to this checkout and is not committed.

## Website before searching

For a live fictional exercise, first run `npm run matching -- example --workspace <new-directory>` to create the isolated case without executing any scripted search. Do this before browsing sources.

After selecting a saved search, creating the fictional case, or confirming new intake, run:

```sh
npm run matching -- serve --workspace <existing-directory>
```

Keep the terminal session running. This validates existing records, binds an available loopback port and prints `workspace`, `statusUrl` and `reviewUrl`. It never loads examples or switches inputs. Separate workspaces receive separate available ports.

Codex visibly opens the returned Status URL before source browsing, retains that results tab, and researches in background tabs. An empty initial website is valid; explain that saved results will appear after reloading. Reload and show that same tab after every published round. Reuse the session/URL on feedback turns. If the service stops, rerun `serve` for the exact selected workspace and open its new URL. Never reuse an unrelated old localhost URL. The server command does not itself open the browser; that action belongs to the Codex workflow. Report startup failures instead of silently continuing chat-only.

## Maintenance note — 2026-10-29

Added bounded saved-search discovery, a private path index and selected-workspace website startup. Candidate/opportunity schemas and fixed Status/Review rendering are unchanged. Setup discovers choices before asking for a path, and opens the website before research rather than only after publication.
