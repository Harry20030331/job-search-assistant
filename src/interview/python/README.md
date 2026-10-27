# Interview Python module

Optional Python 3.12 implementation maintained by Erica Zhao. Start from the repository's [Interview guide](../../../docs/interview.md) and [evaluation status](../../../docs/interview-evaluation.md).

- `interview/`: typed tools, local SQLite state, guarded Google adapter, inbox, preparation/debrief execution nodes, shared Codex runtime and credential-free settings loading.
- `evaluation/`: original single-case A/B/C/D runner, deterministic graders, optional OpenRouter judge and calibration. Legacy `agent`, `preparation_flow` and `debrief_flow` entrypoints forward to business/runtime modules for compatibility.
- `benchmark/dev/`: six original stories and 16 separate incoming-mail examples, all fictional developer data, not a frozen holdout.
- `benchmark/workflow-v1/`: 12 current-workflow developer episodes reusing seven source context templates; pending human labels, separate from historical A/B/C/D results.
- `tests/`: unit and contract checks, including scripted/injected responses; not agent performance measurements.
- `configs/`: pinned experimental settings and a credential-free Google example.
- `skills/interview-coordinator/`: experimental skill used by historical benchmark groups; distinct from the team's chat entry skill.
- `examples/preparation-v4/`: entirely fictional two-stage preparation example.

Existing package names and module-relative roots are intentional. Keeping this boundary preserves old protocols while TypeScript owns the shared data handoff. `runs/`, `.google-local/`, `.env`, virtual environments and databases are private ignored state. Historical reports, real sample invitations, account IDs, tokens, client configurations and human ratings were not migrated.
