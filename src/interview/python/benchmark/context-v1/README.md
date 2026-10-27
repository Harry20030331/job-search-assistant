# Context-v1 development stories

Protocol: `preparation-context-v1`. Twelve AI-assisted fictional contexts, with new provisional labels pending human review. They are separate from the existing workflow-v1 batch and are not held out.

`request.json` is public evidence. `case.json` is the public task. `gold.json` is evaluator-only and must not be included in a model workspace. No model results are included. These supplied-evidence tasks do not test live browser retrieval or approved preparation-material generation.

Run `npm run interview:context-cases -- check` from the repository root after Python setup. Export to a new private directory with `npm run interview:context-cases -- export --output <absolute-directory>` for keep/revise/drop review. Use absolute cross-module paths. See `docs/interview-context-contract.md` for source rules, commands and coverage.

The generator `benchmark/create_context_cases.py` refuses existing destinations. Preserve reviewed snapshots rather than regenerating them in place. Later revisions need their own version; existing outputs do not become research holdout data.
