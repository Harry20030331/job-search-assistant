---
name: matching-jobs-and-feedback
description: Assess and rank job leads, publish a shortlist and apply actual user feedback to subsequent matching rounds.
---

# Matching and Feedback

Read [the Matching entry point](../SKILL.md) for shared scope and website handling. Use the existing schemas/commands in [Matching](../../../docs/matching.md) and the actual interaction steps in [chat intake](../../../docs/matching-chat.md). This stage evaluates observations and updates recommendations; it does not independently operate employer applications.

The default user surface is now the [Welcome website](../../../docs/welcome.md). Reuse its confirmed canonical profile and saved preference feedback; do not require users to repeat those answers in chat. The source-reading/chat steps remain compatibility routes for unsupported inputs, not a replacement for the website.

## Assess current evidence

Read fresh `matching context`, canonical jobs and the complete preference prose, including saved structured constraints and text feedback. Compare observed requirements with canonical candidate facts: experience scope, degree/equivalence, skill depth, locations, employment type, timing, authorization conditions and application limits. Preserve explicit exceptions and distinguish required from preferred qualifications. Select a source-backed direction consistent with the current search scope. Empty categories/locations mean explicit flexibility; current structured scope overrides historical direction/location preferences. With flexible directions, evaluate actual job responsibilities against documented background without requesting manually enumerated job titles. Job `category` is an open direction label, not an approved resume profile; do not infer an application resume from it.

Prepare the supplied leads with source-backed match reasons, gaps, questions and actual JD text/reference. Production publication must use TypeSafe Jev through `matching publish`; do not call the lower-level deterministic domain writer to substitute Codex-only matching. Run `matching provider-status` first. Missing configuration or provider failures must return an actionable website blocker, never a successful Jev claim. Read [Jev matching](../../../docs/matching-jev.md) for the exact version-2 contract. Separate `recommend`, `needs_confirmation` and `reject`; the code may defer eligible roles outside the configured shortlist/company limits. Do not manufacture qualifications or a score as evidence of fit. A supplied job description can support analysis but cannot prove current official-page availability. Return to [discovery](../discovery/SKILL.md) for missing, stale or contradictory employer evidence. Return personal-fact gaps to [intake](../intake/SKILL.md) without guessing answers.

## Explicit shortlist requests

When the user explicitly asks to save a particular known role, use the existing jobs CLI/domain API to save it as `new`, including its actual direction and outstanding conditions. This does not require a resume mapping, all eligibility questions answered, a full recommendation round, or code/schema approval. Preserve the canonical role identity and source evidence. A one-off saved role outside the ongoing search scope does not silently broaden that scope. Do not fabricate missing employer identity/URL facts or overwrite an existing application. Distinguish a user-saved conditional lead from an assessed ready recommendation.

## Apply actual feedback

Interpret the user's actual instruction, preserving unrelated constraints. Ask only when scope is ambiguous, such as a one-round exception versus a lasting preference. Use a stable job exclusion for one role rather than generalizing it to a whole employer. Merge new exclusions with existing ones unless the user explicitly replaces/clears them.

Construct a narrow `matching feedback` patch with the current expected token, concise English meaning, real source reference and actual timestamp. Keep facts in the candidate source and preferences in the selected `preferences.md`; neither belongs in this skill. Never invent a feedback message or count a scripted demonstration as a real user interaction.

Re-read context after saving feedback. Re-assess every managed open shortlist role against the changed constraints; an updated token alone does not refresh old reasoning. Invoke discovery for re-verification and replacement leads as needed, then return here for publication. If no fully eligible roles remain, say so instead of fabricating replacements.

## Publish and close the round

Read every current approved PDF in the selected manifest and construct `resumeEvidence` entries with its category, exact sha256 and actually read professional text (omit contact headers; never invent extraction). An empty manifest remains searchable; missing or unreadable evidence for an existing PDF blocks publication. Jev owns the per-job resume choice, including none/uncertain, and the publisher saves its key/hash/context. Never infer a route from job direction or resume name. Construct a complete version-2 current-context input with `jobDescription` and `jobDescriptionReference` for each actual observed JD, then call `matching publish`. Jev decisions and deterministic rules own the final result; preserve genuine prior unknowns and rejections rather than laundering them through a positive score. Retain all managed open shortlist roles in the round so changed preferences cannot leave stale recommendations active. Canonical publication protects closed and Submission-owned records; explain protected cases rather than bypassing those guards. Narrow standalone availability updates belong to the existing job-library interfaces with evidence.

Known facts are automatic execution inputs; unknown work mode or geographic eligibility must not be treated as confirmed. Explain that recommendations are `ready`, conditional research leads are `new`, and preference-ineligible/uncertain records can be parked without pretending the vacancy closed. The fixed Shortlisted view does not establish complete eligibility or application approval.

Validate the library after writes. Reload and visibly return to the selected workspace's existing Status tab. In English, show official links, concrete matches/gaps, genuine questions and what changed since the prior round. Preserve internal screening notes and keep routine rejected leads out of the user approval queue. Invite feedback without restarting onboarding.

Only a completed source scan with every inspected disposition handled may advance its discovery checkpoint. Retain incomplete checkpoints and unresolved attempts. Report the scope and operational failures honestly; this round's persistence is not evidence of empirical matching accuracy or live ATS continuity.
