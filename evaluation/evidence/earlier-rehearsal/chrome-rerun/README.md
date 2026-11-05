# Small Chrome rerun — retained failed audit

2026-11-04. Five fresh app threads actually executed one shared S1 and independent A/B S2/S3 sessions with Chrome. S1 independently read Adobe; both S2 threads used different Chrome tabs and created 15-field local drafts. The S3 first actions flipped correctly: A added Seattle/New York and held Boston; B added Seattle/Boston and held New York. No employer data entry or submission occurred.

**Overall acceptance failed:** A S3's stored Core thread ID points to the B S3 thread. Actual app threads were distinct, but source-thread metadata did not meet the traceability requirement. Raw files and thread exports are retained without changing the record. The exact cause was not established. Later runs use explicit app creation IDs in routing metadata rather than deriving them from an unscoped title call.

| Scene | Actual app ID |
| --- | --- |
| S1 | `01a1a8e9-4c59-7313-9da7-1e45494d7f11` |
| A S2 | `01a1a8ea-8cf8-7ab0-b1b1-9b2a77b8a927` |
| A S3 | `01a1a8ec-18a0-7e61-97f2-a77304d89c91` |
| B S2 | `01a1a8ea-8db1-7c92-acce-4029892d0d3c` |
| B S3 | `01a1a8ec-1950-71e1-b3ec-bdd3204683f1` |

- `acceptance.json`: failed binding audit and actual-location outcome; no overall pass claimed.
- `thread-*.json`: actual bounded app exports with current task prompts, real replies and independent Chrome calls.
- `s1-*`, `s2-a-*`, `s2-b-*`, `s3-initial-*`, `final-a-*`, `final-b-*`: retained state and per-thread browser receipts.
- `initial-input.json`, `initial-memory.json`, `s3-input-jobs.json`, `execution-guide.md`: supplied inputs and original neutral guide. Initial memory was captured after opening S1, at revision 0; it is not a pre-open byte snapshot.
- `test-results.txt`: 57 files / 594 tests passed against the unchanged implementation.

This small run preceded the user's updated 5 → 3 → 5 request. The [fresh five-role main](../five-role-main/README.md) is separately recorded; its results do not overwrite this failure.
