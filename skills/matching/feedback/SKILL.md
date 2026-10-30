---
name: matching-jobs-and-feedback
description: Assess and rank job leads, publish a shortlist and apply actual user feedback to subsequent matching rounds.
---

# Matching and Feedback

Read [the Matching entry point](../SKILL.md) for shared scope and website handling. Use the existing schemas/commands in [Matching](../../../docs/matching.md) and the actual interaction steps in [chat intake](../../../docs/matching-chat.md). This stage evaluates observations and updates recommendations; it does not independently operate employer applications.

## Assess current evidence

Read fresh `matching context`, canonical jobs and the complete preference prose, including saved structured constraints and text feedback. Compare observed requirements with canonical candidate facts: experience scope, degree/equivalence, skill depth, locations, employment type, timing, authorization conditions and application limits. Preserve explicit exceptions and distinguish required from preferred qualifications. Select exactly one permitted category; do not silently broaden scope or switch its resume route.

Rank the supplied leads with source-backed match reasons, gaps and questions. Separate `recommend`, `needs_confirmation` and `reject`; the code may defer eligible roles outside the configured shortlist/company limits. Do not manufacture qualifications or a score as evidence of fit. A supplied job description can support analysis but cannot prove current official-page availability. Return to [discovery](../discovery/SKILL.md) for missing, stale or contradictory employer evidence. Return personal-fact gaps to [intake](../intake/SKILL.md) without guessing answers.

## Apply actual feedback

Interpret the user's actual instruction, preserving unrelated constraints. Ask only when scope is ambiguous, such as a one-round exception versus a lasting preference. Use a stable job exclusion for one role rather than generalizing it to a whole employer. Merge new exclusions with existing ones unless the user explicitly replaces/clears them.

Construct a narrow `matching feedback` patch with the current expected token, concise English meaning, real source reference and actual timestamp. Keep facts in the candidate source and preferences in the selected `preferences.md`; neither belongs in this skill. Never invent a feedback message or count a scripted demonstration as a real user interaction.

Re-read context after saving feedback. Re-assess every managed open shortlist role against the changed constraints; an updated token alone does not refresh old reasoning. Invoke discovery for re-verification and replacement leads as needed, then return here for publication. If no fully eligible roles remain, say so instead of fabricating replacements.

## Publish and close the round

Construct a complete current-context assessment input and call `matching publish`. Retain all managed open shortlist roles in the round so changed preferences cannot leave stale recommendations active. Canonical publication protects closed and Submission-owned records; explain protected cases rather than bypassing those guards. Narrow standalone availability updates belong to the existing job-library interfaces with evidence.

Known facts are automatic execution inputs; unknown work mode or geographic eligibility must not be treated as confirmed. Explain that recommendations are `ready`, conditional research leads are `new`, and preference-ineligible/uncertain records can be parked without pretending the vacancy closed. The fixed Shortlisted view does not establish complete eligibility or application approval.

Validate the library after writes. Reload and visibly return to the selected workspace's existing Status tab. In English, show official links, concrete matches/gaps, genuine questions and what changed since the prior round. Preserve internal screening notes and keep routine rejected leads out of the user approval queue. Invite feedback without restarting onboarding.

Only a completed source scan with every inspected disposition handled may advance its discovery checkpoint. Retain incomplete checkpoints and unresolved attempts. Report the scope and operational failures honestly; this round's persistence is not evidence of empirical matching accuracy or live ATS continuity.
