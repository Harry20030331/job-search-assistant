# Fictional candidate example

Alex Morgan is an MS student seeking an entry-level applied AI/software role in July 2027. The profile includes a completed BS, an internship, part-time research, two projects, skill-depth limits, availability and explicit unknowns. The chronology and claims are internally consistent; institutions, employers, dates and achievements are synthetic. Contact and portfolio URLs use reserved example domains.

`candidate.json` is the source of candidate facts. `preferences.md` owns goals and screening choices. `resumes.json` maps the `llm` category to the accompanying PDF, which is a concise subset of those facts. Relocation, compensation and employer-specific relationships remain unanswered. Do not treat invented candidate metrics as this project's evaluation results.

Copy these inputs once into a new private runtime before editing them. Runtime edits must not alter this baseline or be overwritten on restart. Run `npm run setup:example` once to seed local `data/` with these inputs and empty records. It refuses existing data. Run `npm run review` to resume that workspace; restarting never copies examples. An external existing workspace can be seeded with `npm run setup:example -- --dir <workspace>` and served with `npm run review -- --runtime-dir <workspace>`.

Use the identity only in local fixtures or offline evaluation. Never send it to a real employer.
