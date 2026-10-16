# Fictional candidate example

Alex Morgan is an MS student seeking an entry-level applied AI/software role in July 2027. The profile includes a completed BS, an internship, part-time research, two projects, skill-depth limits, availability and explicit unknowns. The chronology and claims are internally consistent; institutions, employers, dates and achievements are synthetic. Contact and portfolio URLs use reserved example domains.

`candidate.json` is the source of candidate facts. `preferences.md` owns goals and screening choices. `resumes.json` maps the `llm` category to the accompanying PDF, which is a concise subset of those facts. Relocation, compensation and employer-specific relationships remain unanswered. Do not treat invented candidate metrics as this project's evaluation results.

Load these inputs into the current working data with `npm run example:load`. Ordinary `npm run review` reuses data; if there is no data, it supplies this default case automatically. To load another saved case, use `npm run example:load -- --from <example-directory>`; `--dir <workspace>` selects an external destination. Stop Review and other writers before switching. The loader preserves the previous state under the destination's ignored `local/example-backups/` and prints that path.

An example bundle contains `candidate.json` with `fictional: true`, `preferences.md`, `resumes.json`, and every PDF referenced by relative paths in the manifest. Resume filenames are not fixed. It may also contain `opportunities.json`, `drafts/` and `discovery-state.json` to represent a later workflow state. Omitted progress starts empty. All records in a shared example must be synthetic and refer to that candidate. Documentation is not copied into working data. This repository currently includes the Alex bundle; additional bundles can be loaded by path.

Loading replaces current state as a whole. Editing the loaded candidate or progressing applications changes only local `data/`; saving a revised shared example is a separate deliberate change.

Use the identity only in local fixtures or offline evaluation. Never send it to a real employer.
