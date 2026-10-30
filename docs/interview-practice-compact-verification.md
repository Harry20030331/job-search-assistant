# Compact practice verification

Date: 2026-10-26. The user requested concise Scenario / Task / Follow-ups questions, Method / Sample answer answers, and readable paragraph/bullet rendering. This is a local implementation change, not completed team review or a measured model-quality improvement.

## Implementation

The page now uses those five headings. Supplied facts and examples sit inside Scenario; constraints sit under Task. Answer content remains collapsed until Show answer is expanded. Method uses steps, while the additive `sample_answer` field supplies a distinct spoken response or worked answer. Existing stored packs without that field remain readable with a labeled answer outline. Reference reasoning, scoring anchors and self-checks stay in stored materials for evaluation. Exact proposal approval, budget and freshness checks are unchanged.

The small formatter escapes source content, supports paragraphs/bullets, inline code, fenced code and pipe tables, and rejects raw HTML by rendering it as text. Signatures are separated from prose; long signatures break at parameter boundaries without splitting nested generic types. Each worked input/output example occupies its own row. No general Markdown engine or new dependency was added.

## Actual generation

The existing isolated fictional preview now holds three newly generated compact packs. Previous material rows, failed outputs and historical benchmark artifacts remain intact. Private attempts are under parent-workspace `runs/practice-concise-20261026/`:

| Attempt | Result | Seconds |
| --- | --- | --- |
| DS | Material ready | 38.531 |
| SWE | Material ready | 42.656 |
| Recruiter first attempt | Validation failed: exercise minutes did not sum to the approved section budget; no accepted write | 30.141 |
| Recruiter budget retry | Material ready after clarifying rehearsal versus spoken-answer duration | 30.781 |

All accepted packs contain distinct sample answers. DS scenarios are 50-63 words and sample answers 43-104 words; SWE scenarios are 45-59 words and sample answers 28-165 words. Personal responses preserve explicit placeholders for unknown motivations, decisions and outcomes. These observations are development checks, not blinded ratings or held-out comparisons. No OpenRouter generation or external Google write was used.

## Checks

- TypeScript typecheck passed.
- Targeted rendering, server, workbench, account and CLI checks: 87 passed.
- Targeted Python practice, context-preparation and dashboard checks: 25 passed.
- Browser inspection verified the coding contract, separated examples, three question parts and independently revealed Method/Sample answer, plus narrow-screen containment. Temporary viewport overrides were reset.
- The controlled UI v3 successor preserves v1/v2 manifests. Structural boundaries, distribution privacy/language scan and whitespace checks passed.

The whole repository suite was not rerun for this presentation change. The preceding v2 report's 37 Windows/POSIX compatibility failures remain unresolved; this note does not claim a green whole-repository result. Current screenshots are private parent-workspace `runs/practice-concise-20261026/` artifacts.
