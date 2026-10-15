# Applications Domain Context

This file is the shared vocabulary for `applications/`. Operational requirements live in `docs/workflow-contract.md`; the ADRs explain why the system has this shape.

## Application

One candidate-to-role attempt in exactly one regional pipeline. The stored US schema recognizes one explicit category (`llm`, `robotics`, or `recommendation`) for backward compatibility, but active strategy permits new Applications only for `llm` or `recommendation`. Historical China outreach records have their own vocabulary and lifecycle; China recruiting is inactive and is never translated into US Application state.

## Batch

A bounded working set of Applications for one quiet execution window. A Batch coordinates shared preflight, consolidated review, submission closeout, and status refresh while execution remains serial per Application. One parked or failed Application does not silently change or block valid siblings unless a shared Canonical Input is invalid.

## Canonical Input

Local candidate facts, application rules, and approved-CV manifests that are authoritative for deterministic execution. For the US pipeline these are `data/candidate.json`, `data/preferences.md`, and `data/resumes.json`. The candidate profile file is a v3 descriptor: resolve its shared personal-fact sources and job-specific section through `npm run profile`; it is not a standalone flat data record. Canonical Input overrides ATS parsing and never includes passwords, OTPs, or raw email bodies.

## Review Snapshot

An immutable identity for the complete observed state of one Application at a review boundary: URL, role, category, visible CV, answers and generated text, unresolved decisions, consent, validation, authentication, session, and submit readiness. A changed value or lost live state requires a replacement Review Snapshot.

## Website Approval

The decision recorded in the localhost review website for one exact Application and Review Snapshot after the user has viewed its detail, resolved required questions, and verified the fixed CV. Website Approval is snapshot-bound, non-transferable and one-time when consumed. Explicit chat acceptance is a separate valid authorization source under the workflow contract; it must never be recorded as a fabricated website event.

## Submission Evidence

The timestamped observation of a Submit attempt and its immediate outcome for one Application, including the consumed Review Snapshot and authorization reference. It proves an attempt or observed ATS result; it is not itself proof that a confirmation email arrived.

## Confirmation

Evidence that the employer or ATS acknowledged an application, from an explicit official success page/dashboard or a matching receipt. Website and email evidence remain independent with actual observation/receipt times. Both internal submitted and confirmed render as Submitted. Missing email does not undo an observed official success.

## Protected Recruiting Update

An interview invitation, assessment, information request, rejection, offer, or other material recruiting message whose unread state must be preserved. Unambiguous sender, subject, and snippet evidence may support a sanctioned lifecycle update without opening the message; ambiguous evidence is surfaced without guessing.

## Friction

Meaningful rework, failure, intervention, lost state, or uncertainty. A Friction record contains only symptom, cause, resolution or blocker, and prevention or promotion. Routine clicks, retry noise, secrets, and raw page or email content are not Friction records.

## Status Ledger

The local, durable account of Application identity, lifecycle state, timestamps, evidence, and concise Friction. `data/opportunities.json` is its only canonical store; temporary drafts supply working answers and approval state. Persisted ledger data is recovery input, never proof of current live ATS state.
