# Designated LinkedIn profile intake

The handoff's LinkedIn input is an explicit supported choice alongside resume and manual input. Codex performs browser reading and language extraction; the mapper validates source identity, shapes visible facts, tracks evidence and produces a read-only preview. It is not a hidden LinkedIn API, crawler, or standalone extraction model.

## English interaction

The default New candidate website offers LinkedIn link, pasted text and PDF upload. A saved source request is claimed once through `intake:request`; publish the source-backed preview to that same webpage, or block with the actual access problem. No candidate is created before the user confirms the displayed preview and preferences. For explicitly supplied chat input, the `matching -- sources` compatibility invitation still accepts links, documents, pasted text or combined sources. Read already supplied material before asking for more.

If the user selects LinkedIn, ask "Please share the LinkedIn profile URL you would like me to use. I will import the visible information and ask you to confirm it before saving." A user-provided profile URL is the designated source; do not search for a different person with the same name. The initial search needs no resume PDF. An approved PDF remains necessary before employer-form preparation.

## Observe, preview, confirm

1. Open the exact profile in Codex's in-app Browser. Inspect visible education, experience and skills; use normal page controls to expand sections when available. A search snippet, login wall or blank page is not the profile. Do not infer permission to bypass authentication or challenges.
2. Record only observed facts with short section/evidence references and the actual time. Do not guess dates, graduation status, experience duration, contact details, work authorization or preferences. An unseen section is unknown, not an empty employment history. A visible empty state and an explicit user answer of "none" are different from an unavailable section.
3. Write a private temporary observation file and run `npm run matching -- linkedin-preview --input <observations.json>`. Add `--workspace <existing-directory>` only to compare against an existing selected candidate. The command does not browse or write a profile. It rejects a different observed profile or a non-profile source URL. Conflicts with existing canonical facts are listed; nothing is overwritten or merged automatically.
4. Show an English summary of proposed facts, uncertainties, conflicts and missing search inputs. Ask for corrections and confirmation. Missing preferences are collected from the user, not inferred from profile location or employment. Missing fields for complete application onboarding still follow `evaluation.md`; do not call this preview a complete onboarding check.
5. For a NEW candidate only, after actual confirmation, pass the reviewed proposal plus explicitly supplied missing facts and preferences to the existing `matching intake` command in a fresh workspace. `confirmed: true` refers to the real user's approval of those facts. Intake records the confirmation reference with import provenance. Unknown education/experience sections can remain omitted if at least one useful background section is present; do not substitute invented empty arrays. Existing-candidate updates need an explicit separately scoped correction workflow; preview offers no overwrite command.
6. Start/open the selected workspace's website before source browsing, then continue normal Matching.

## Observation input

The agent constructs this JSON after reading the page. The user is not expected to author JSON. This example is fictional; it is not an actual LinkedIn observation.

```json
{
  "sourceUrl": "https://www.linkedin.com/in/fictional-casey/",
  "observedUrl": "https://www.linkedin.com/in/fictional-casey/",
  "observedAt": "2026-10-29T12:00:00.000Z",
  "access": "visible",
  "sections": {
    "fullName": {"value": "Casey Example", "evidence": "Fictional profile header"},
    "headline": {"value": "Software engineer working on retrieval prototypes", "evidence": "Fictional profile headline"},
    "education": [{"value": {"institution": "Example Institute", "degree": "MS"}, "evidence": "Fictional education section"}],
    "skills": [{"value": "Python", "evidence": "Fictional skills section"}]
  }
}
```

Optional experience values use canonical keys `employer`, `title`, `location`, `employmentType`, `startDate`, `endDate`, `description`. The first two are required for an observed experience record. Optional education values use `institution`, `degree`, `field`, `startDate`, `endDate`, `status`; only institution is mandatory. Dates remain as observed strings. No missing field is automatically filled. Present a normalized interpretation for user confirmation if needed. Do not fabricate a narrative from an absent headline.

The preview's evidence requirements establish input structure, not evidence truth. Codex must actually observe the designated page. All previews and actual profile information stay local; committed tests contain fictional observations only.

## Login walls and unavailable profiles

Set `access` to `login_required` or `unavailable` with an empty `sections` object and the actual observed URL. The mapper refuses purported extracted facts on these paths. It returns an English fallback: paste the profile text, provide a LinkedIn export/resume, or enter details manually. The user may choose to make the profile accessible through normal login if supported; credentials and challenges follow tool requirements. If the user provides copied/exported content, identify that as user-supplied material rather than claiming a live profile read. Never force a resume upload.

## Maintenance note — 2026-10-29

Added the LinkedIn source choice, URL-bound source-backed read-only preview and confirmed new-candidate provenance under existing `_meta`. Search intake preserves omitted unknown history fields. No candidate schema version, opportunity source enum, ATS behavior or fixed UI renderer changed. Full application completeness validation and a live LinkedIn import evaluation remain pending. Profile import is separate from discovering jobs on LinkedIn.

Maintenance, 2026-10-31: LinkedIn intake is now connected to the website source chooser and revision-bound preview flow. Initial LinkedIn candidate facts must match the validated visible observation. A blocked import cannot publish purported extracted facts. Corrections remain user-supplied information, separate from observations.
