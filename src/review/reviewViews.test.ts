import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { createReviewBatch, readReviewBatch, selectQuestionOption } from "./reviewStore.js";
import { describe, expect, test } from "vitest";
import type { ChinaStatusViewItem } from "../china/status/chinaStatusView.js";
import type { ApplicationRecord } from "../tracker.js";
import type { ReviewBatch } from "./reviewStore.js";
import { renderChinaStatusPage, renderReviewPage, renderStatusPage, renderUsStatusPage } from "./reviewViews.js";
import { buildStatusView } from "./statusView.js";

function batch(ready: boolean): ReviewBatch {
  const document: ReviewBatch = {
    schemaVersion: 1,
    batchId: "batch-1",
    createdAt: "2026-08-07T18:00:00.000Z",
    applications: [{
      applicationId: "notion-1",
      snapshotId: "snapshot-1",
      company: "Notion",
      title: "Software Engineer, Early Career (AI)",
      officialUrl: "https://jobs.ashbyhq.com/notion/1",
      applicationUrl: "https://jobs.ashbyhq.com/notion/1/application?from=review&step=final",
      ats: "ashby",
      category: "llm",
      location: "San Francisco, CA",
      cv: { filename: "example_cv_llm.pdf", verified: ready },
      answers: [
        { label: "Full name", value: "Alex Morgan", kind: "deterministic" },
        { label: "Email", value: "alex.morgan@example.com", kind: "deterministic" },
        { label: "Why Notion?", value: "Complete generated answer text.", kind: "generated" }
      ],
      consents: [{ label: "Privacy notice", value: "Accepted", required: true }],
      questions: ready ? [] : [
        { id: "exercise", prompt: "Exercise Submission URL", required: true },
        { id: "resolved", prompt: "Already answered question", required: true, resolution: "Resolved elsewhere" }
      ],
      validationErrors: ready ? [] : ["Required field unresolved"],
      friction: ["Resume parser rerendered the form"],
      snapshotCurrent: ready,
      preparedAt: "2026-08-07T18:00:00.000Z",
      openedAt: ready ? "2026-08-07T18:01:00.000Z" : undefined,
      fullContentsViewedAt: ready ? "2026-08-07T18:02:00.000Z" : undefined,
      decision: { state: "pending" }
    }]
  };
  Object.assign(document.applications[0]!.answers[0]!, {
    source: "Canonical candidate profile"
  });
  return document;
}

function queue(decisions: Array<"pending" | "approved">): ReviewBatch {
  const template = batch(true).applications[0]!;
  return {
    schemaVersion: 1,
    batchId: "queue-1",
    createdAt: "2026-08-07T18:00:00.000Z",
    applications: decisions.map((state, index) => ({
      ...structuredClone(template),
      applicationId: `application-${index + 1}`,
      snapshotId: `snapshot-${index + 1}`,
      company: `Company ${index + 1}`,
      title: `Role ${index + 1}`,
      officialUrl: `https://example.com/jobs/${index + 1}`,
      applicationUrl: `https://example.com/applications/${index + 1}`,
      decision: state === "pending"
        ? { state: "pending" as const }
        : { state: "approved" as const, decidedAt: "2026-08-07T18:03:00.000Z" }
    }))
  };
}

function enumeratedBatch(): ReviewBatch {
  const document = batch(true);
  document.applications[0]!.applicationId = "snowflake-<1>";
  document.applications[0]!.snapshotId = "snapshot-&-1";
  document.applications[0]!.title = "Software Engineer <AI> & Data";
  document.applications[0]!.questions = [
    {
      id: "us-person-<status>",
      prompt: "Which U.S. person category applies to you? <Choose exactly one> & confirm.",
      required: true,
      options: [
        { id: "protected-yes", label: "I am a U.S. citizen & protected person" },
        { id: "other-country", label: "None of the above; I am a citizen of a different country" }
      ],
      recommendedOptionId: "other-country",
      recommendationSource: "Confirmed personal fact <local>",
      selectedOptionId: "other-country"
    },
    {
      id: "pwc-history",
      prompt: "Have you ever worked for PricewaterhouseCoopers (PwC)?",
      required: true,
      options: [
        { id: "yes", label: "Yes" },
        { id: "no", label: "No" }
      ],
      recommendedOptionId: "no",
      recommendationSource: "Canonical application rule",
      selectedOptionId: "no"
    },
    {
      id: "free-form",
      prompt: "Describe any unresolved employment history.",
      required: false
    }
  ];
  document.applications[0]!.desiredState = { revision: 3, syncState: "pending" };
  return document;
}

const tracker: ApplicationRecord[] = [{
  jobId: "notion-1",
  applicationId: "notion-1",
  company: "Notion",
  title: "Software Engineer, Early Career (AI)",
  location: "San Francisco, CA",
  ats: "ashby",
  jobUrl: "https://jobs.ashbyhq.com/notion/1",
  applicationUrl: "https://jobs.ashbyhq.com/notion/1/application?from=status&step=final",
  category: "llm",
  cvFilename: "example_cv_llm.pdf",
  status: "in_review",
  visibleResult: "not_attempted",
  gmailConfirmation: "not_checked",
  createdAt: "2026-08-07T18:00:00.000Z",
  updatedAt: "2026-08-07T18:02:00.000Z",
  finalReviewAt: "2026-08-07T18:02:00.000Z"
}];

describe("review console views", () => {
  test("uses only the application Approve button for draft-only review", () => {
    const html = renderReviewPage(batch(true)).split("<script>")[0]!;
    expect(html).toContain("Complete generated answer text.");
    expect(html).not.toContain('class="choice-input"');
    expect(html.match(/data-action="approve"/g)).toHaveLength(1);
    expect(html).not.toContain('data-action="approve" disabled');
  });

  test("shows only the CV attachment and decisions without repeating confirmed facts", () => {
    const document = batch(true);
    document.applications[0]!.questions = [{ id: "exercise", prompt: "Exercise Submission URL", required: false }];
    document.applications[0]!.openedAt = undefined;
    const html = renderReviewPage(document);
    const visibleHtml = html.split("<script>")[0]!;
    expect(visibleHtml).toContain("Complete generated answer text.");
    expect(visibleHtml).toContain("Exercise Submission URL");
    expect(visibleHtml).not.toContain("Required field unresolved");
    expect(visibleHtml).toContain('<p class="meta">CV: example_cv_llm.pdf · Verified</p>');
    expect(visibleHtml).not.toContain("Alex Morgan");
    expect(visibleHtml).not.toContain("Canonical candidate profile");
    expect(visibleHtml).not.toContain("alex.morgan@example.com");
    expect(visibleHtml).not.toContain("snapshot-1");
    expect(visibleHtml).not.toContain("Required consent");
    expect(visibleHtml).not.toContain("Privacy notice");
    expect(visibleHtml).not.toContain("Resume parser rerendered the form");
    expect(visibleHtml).not.toContain("No additional decisions needed.");
    expect(visibleHtml).not.toContain("Already answered question");
    expect(html).not.toContain('data-action="approve" disabled');
  });

  test("shows escaped CV and a compact no-decisions state while preserving internal facts", () => {
    const document = batch(true);
    const item = document.applications[0]!;
    item.cv.filename = 'CV <approved> & "final".pdf';
    item.answers = [{ label: "Name <legal>", value: '<script>alert("name")</script>', kind: "deterministic" }];
    item.consents = [{ label: "Privacy & terms", value: '<accepted "yes">', required: true }];
    item.friction = ["Upload <rerender> & checked"];
    const before = JSON.stringify(document);
    const html = renderReviewPage(document);
    const visibleHtml = html.split("<script>")[0]!;
    expect(visibleHtml).toContain("CV: CV &lt;approved&gt; &amp; &quot;final&quot;.pdf · Verified");
    expect(visibleHtml).toContain("No additional decisions needed.");
    expect(visibleHtml).not.toContain("Name &lt;legal&gt;");
    expect(visibleHtml).not.toContain("Privacy &amp; terms");
    expect(visibleHtml).not.toContain("Upload &lt;rerender&gt; &amp; checked");
    expect(visibleHtml).not.toContain('<script>alert("name")</script>');
    expect(visibleHtml).not.toContain("Submit application");
    expect(JSON.stringify(document)).toBe(before);
  });

  test("hides incomplete records and submitted history from the approval queue", () => {
    const document = queue(["pending", "pending", "pending", "pending", "pending"]);
    document.applications[0]!.cv.verified = false;
    document.applications[1]!.snapshotCurrent = false;
    document.applications[2]!.validationErrors = ["Login required"];
    document.applications[3]!.questions = [{ id: "missing", prompt: "Required personal fact", required: true }];
    const html = renderReviewPage(document);
    for (const id of [1, 2, 3]) expect(html).not.toContain(`data-application="application-${id}"`);
    expect(html).toContain('data-application="application-5"');
    const missing = html.match(/<article class="detail" data-detail="application-4"[\s\S]*?<\/article>/)?.[0] ?? "";
    expect(missing).toContain("Required personal fact");
    expect(missing).not.toContain("<textarea");
    expect(missing).toContain('data-action="approve" disabled');
    document.applications[1]!.decision = { state: "stale" };
    const historical = renderReviewPage(document, "application-2", ["application-2"]);
    expect(historical).not.toContain('data-application="application-2"');
    expect(historical).not.toContain('data-detail="application-2"');
    expect(historical).not.toContain("History");

  });

  test("presents escaped questions and saved answers without web input controls", () => {
    const document = enumeratedBatch();
    document.applications[0]!.questions.push({ id: "saved", prompt: "Evidence <link>", required: false, draftAnswer: "Saved <answer>" });
    const html = renderReviewPage(document);
    const visible = html.split("<script>")[0]!;
    expect(visible).toContain("Which U.S. person category applies to you? &lt;Choose exactly one&gt; &amp; confirm.");
    expect(visible).toContain("None of the above; I am a citizen of a different country");
    expect(visible).toMatch(/value="other-country"[^>]*checked/);
    expect(visible).toContain("Evidence &lt;link&gt;");
    expect(visible).toContain("Saved &lt;answer&gt;");
    expect(visible).not.toContain("<textarea");
    expect(visible).toContain('class="choice-input"');
    expect(visible).not.toContain("待补充");
    expect(html).toContain("/api/review/answer");
    expect(html).not.toContain("/api/review/text");
    expect(html).toContain("approval.expectedDesiredRevision=state.desiredRevision");
  });

  test.each([false, true])("choice handler persists or rolls back using a temporary review record (failure=%s)", async (fail) => {
    const document = enumeratedBatch();
    const item = document.applications[0]!;
    for (const question of item.questions) if (question.options) question.recommendationSource = "User review choice";
    const path = join(await mkdtemp(join(tmpdir(), "review-choice-")), "review.json");
    await createReviewBatch(path, document);
    let change: (() => Promise<void>) | undefined;
    const status = { textContent: "" };
    const reason = { textContent: "Required answers are missing" };
    const approve = { disabled: false, addEventListener() {} };
    const queueControl = { disabled: false, addEventListener() {} };
    const oldRadio = { disabled: false, checked: false, value: "other-country", dataset: { question: "us-person-<status>" }, addEventListener() {} };
    const detail = {
      dataset: { detail: item.applicationId },
      querySelector: (selector: string) => selector === ".save-status" ? status : selector === ".approval-reason" ? reason : approve,
      querySelectorAll: () => [radio, oldRadio]
    };
    const radio = {
      disabled: false, checked: true, value: "protected-yes", dataset: { question: "us-person-<status>" },
      closest: () => detail,
      addEventListener: (_event: string, handler: () => Promise<void>) => { change = handler; }
    };
    const requests: Array<{ url: string; body: Record<string, string> }> = [];
    let release!: () => void;
    const wait = new Promise<void>((resolve) => { release = resolve; });
    const fetch = async (url: string, options: { body: string }) => {
      const body = JSON.parse(options.body) as Record<string, string>;
      requests.push({ url, body });
      await wait;
      if (fail) return { ok: false, json: async () => ({ error: "failed" }) };
      const saved = await selectQuestionOption(path, body.applicationId!, body.snapshotId!, body.questionId!, body.optionId!);
      return { ok: true, json: async () => ({ applicationId: saved.applicationId, snapshotId: saved.snapshotId, questionId: body.questionId, selectedOptionId: body.optionId, desiredState: saved.desiredState, reviewReady: true }) };
    };
    runInNewContext(renderReviewPage(document).split("<script>")[1]!.split("</script>")[0]!, {
      document: { querySelectorAll: (selector: string) => selector === ".choice-input" ? [radio] : selector === ".choice-input,.queue-item,.approve" ? [radio, oldRadio, queueControl, approve] : [] },
      fetch, alert() {}, location: { href: "" }
    });
    const pendingSave = change!();
    expect(radio.disabled).toBe(true);
    expect(approve.disabled).toBe(true);
    expect(queueControl.disabled).toBe(true);
    release();
    await pendingSave;
    expect(radio.disabled).toBe(false);
    expect(approve.disabled).toBe(false);
    expect(queueControl.disabled).toBe(false);
    expect(requests).toEqual([{ url: "/api/review/answer", body: { applicationId: item.applicationId, snapshotId: item.snapshotId, questionId: "us-person-<status>", optionId: "protected-yes" } }]);
    const stored = (await readReviewBatch(path)).applications[0]!;
    expect(stored.questions[0]!.selectedOptionId).toBe(fail ? "other-country" : "protected-yes");
    expect(stored.desiredState?.revision).toBe(fail ? 3 : 4);
    expect(status.textContent).toBe(fail ? "Could not save. Previous choice restored." : "Saved");
    expect(reason.textContent).toBe(fail ? "Required answers are missing" : "");
    if (fail) { expect(oldRadio.checked).toBe(true); expect(radio.checked).toBe(false); }
    expect(stored.decision.state).toBe("pending");
  });

  test("keeps one disabled Approve on question-stage records with a concise current reason", () => {
    const document = batch(true);
    const item = document.applications[0]!;
    item.reviewStage = "questions";
    item.snapshotCurrent = false;
    item.decision = { state: "stale" };
    item.validationErrors = ["INTERNAL SESSION DETAIL"];
    item.questions = [{ id: "missing", prompt: "Your answer?", required: true }];
    const missing = renderReviewPage(document).split("<script>")[0]!;
    expect(missing.match(/data-action="approve"/g)).toHaveLength(1);
    expect(missing).toContain('data-action="approve" disabled');
    expect(missing).toContain("Required answers are missing");
    expect(missing).not.toContain("INTERNAL SESSION DETAIL");
    item.questions[0]!.resolution = "User supplied answer";
    const sync = renderReviewPage(document).split("<script>")[0]!;
    expect(sync).toContain("Ready to approve after form verification");
    expect(sync).not.toContain("Required answers are missing");
  });

  test("allows direct approval after a read-only GET and records viewed gates only on click", () => {
    const document = batch(true);
    delete document.applications[0]!.openedAt;
    delete document.applications[0]!.fullContentsViewedAt;
    const before = JSON.stringify(document);
    const html = renderReviewPage(document);
    expect(html).toContain('data-action="approve"');
    expect(html).not.toContain('data-action="approve" disabled');
    expect(JSON.stringify(document)).toBe(before);
    const script = html.split("<script>")[1] ?? "";
    const clickHandler = script.slice(script.indexOf("document.querySelectorAll('.approve')"));
    expect(clickHandler).toContain("complete=await post('/api/review/open',item)&&await post('/api/review/viewed',item)&&await post('/api/review/decision',approval);if(!complete)return");
    expect(clickHandler).toContain("applicationId===id");
    expect(script).toContain('"snapshotId":"snapshot-1"');
  });

  test("offers only the exact application link and per-item approval", () => {
    const html = renderReviewPage(batch(true));
    expect(html).toContain("Software Engineer, Early Career (AI)");
    expect(html).toContain("LLM");
    expect(html).toContain('href="https://jobs.ashbyhq.com/notion/1/application?from=review&amp;step=final"');
    expect(html).toContain("Open application ↗");
    expect(html).toContain('data-action="approve"');
    expect(html).not.toContain('data-action="approve" disabled');
    expect(html.match(/data-action=/g)).toHaveLength(1);
    expect(html).not.toContain('data-action="skip"');
    expect(html).not.toContain("Needs changes");
    expect(html).not.toContain("Tell Codex");
    expect(html).not.toContain("items need your attention");
    expect(html).not.toContain("Review queue");
    expect(html).not.toContain("queue-count");
    expect(html).not.toContain("queue-summary");
    expect(html).not.toContain("Batch batch-1");
    expect(html).not.toContain("<input");
    expect(html).not.toContain("<textarea");
    expect(html).not.toContain("Submit application");
  });

  test("uses the official URL fallback and escapes safe links", () => {
    const fallback = batch(true);
    delete fallback.applications[0]!.applicationUrl;
    fallback.applications[0]!.officialUrl = "https://example.com/apply?team=ai&level=entry";
    const html = renderReviewPage(fallback);
    expect(html).toContain('href="https://example.com/apply?team=ai&amp;level=entry"');

    fallback.applications[0]!.officialUrl = "https://example.com";
    expect(renderReviewPage(fallback)).toContain('class="application-link" href="https://example.com"');

    fallback.applications[0]!.officialUrl = 'javascript:alert("unsafe")';
    expect(renderReviewPage(fallback)).toContain('href="#"');
  });

  test("keeps queue entries compact and gates navigation behind open then viewed", () => {
    const html = renderReviewPage(batch(true));
    expect(html).toContain('<span class="queue-index">01</span><span><strong>Notion</strong><small>San Francisco, CA</small></span>');
    expect(html).toContain("grid-template-columns:160px 1fr");
    expect(html).toContain("await post('/api/review/open',item)");
    expect(html).toContain("await post('/api/review/viewed',item)");
    expect(html.indexOf("await post('/api/review/open',item)")).toBeLessThan(html.indexOf("await post('/api/review/viewed',item)"));
    expect(html.indexOf("await post('/api/review/viewed',item)")).toBeLessThan(html.lastIndexOf("location.href='/review?application='"));
  });

  test("prevents double actions and restores controls when a request fails", () => {
    const html = renderReviewPage(batch(true));
    expect(html).toContain("const disabledStates=new Map");
    expect(html).toContain("disabledStates.set(control,control.disabled);control.disabled=true");
    expect(html).toContain("control.disabled=disabledStates.get(control)??false;disabledStates.delete(control)");
    expect(html.match(/if\(button\.disabled\)return;setBusy\(true\)/g)).toHaveLength(2);
    expect(html.match(/finally\{if\(!complete\)setBusy\(false\)\}/g)).toHaveLength(2);
  });

  test("embeds only the exact action identity outside visible review content", () => {
    const html = renderReviewPage(batch(true));
    const [visibleHtml, actionScript] = html.split("<script>");
    expect(visibleHtml).not.toContain("snapshot-1");
    expect(actionScript).toContain('const items=[{"applicationId":"notion-1","snapshotId":"snapshot-1","decision":"pending"}];');
    expect(actionScript).not.toContain("officialUrl");
    expect(actionScript).not.toContain("Alex Morgan");
    expect(actionScript).not.toContain("alex.morgan@example.com");
  });

  test("defaults to the first pending item and never offers approval on an approved item", () => {
    const reviewQueue = queue(["approved", "pending"]);
    const defaultHtml = renderReviewPage(reviewQueue);
    expect(defaultHtml).not.toContain('data-detail="application-1"');
    expect(defaultHtml).toContain('data-detail="application-2" >');

    const approvedHtml = renderReviewPage(reviewQueue, "application-1");
    expect(approvedHtml).not.toContain('data-application="application-1"');
    expect(approvedHtml).toContain('data-detail="application-2" >');
    const approvedCard = approvedHtml.match(/<article class="detail" data-detail="application-1"[\s\S]*?<\/article>/)?.[0] ?? "";
    expect(approvedCard).not.toContain('data-action="approve"');
  });

  test("renders a button-free completion state when no pending review remains", () => {
    const html = renderReviewPage(queue(["approved", "approved"]));
    expect(html).toContain("No applications pending review");
    expect(html).not.toContain('data-action="approve"');
  });

  test("approves only the current item and advances through gates to the next pending item", () => {
    const html = renderReviewPage(queue(["pending", "pending"]), "application-1");
    const script = html.split("<script>")[1] ?? "";

    expect(script).toContain('"applicationId":"application-1","snapshotId":"snapshot-1","decision":"pending"');
    expect(script).toContain('"applicationId":"application-2","snapshotId":"snapshot-2","decision":"pending"');
    expect(script).toContain("const nextPending=");
    expect(script).toContain("await post('/api/review/open',next)");
    expect(script).toContain("await post('/api/review/viewed',next)");
    expect(script).toContain("location.href='/review?application='+encodeURIComponent(next.applicationId)");
    expect(script).toContain("location.href='/review'");
    expect(script).not.toContain("decision:'approved'});if(complete)location.reload()");
  });

  test("renders the active five-stage lifecycle above one neutral line", () => {
    const html = renderStatusPage(buildStatusView(tracker, []));
    const guide = html.match(/<section class="lifecycle-guide"[\s\S]*?<\/section>/)?.[0] ?? "";

    expect(guide).not.toBe("");
    expect(guide).toContain("Shortlisted → In Review → Submitted → Interviewing → Offer");
    expect(guide.match(/class="lifecycle-line"/g)).toHaveLength(1);
    expect(guide).not.toMatch(/\b0[1-7]\b/);
    expect(guide).not.toMatch(/active|current|partial|underline|red|warn/i);
    expect(html).not.toMatch(/\.lifecycle[^}]*var\(--warn\)/);
  });

  test("renders compact rows with exact links, company and city, role, category, status, and date", () => {
    const html = renderStatusPage(buildStatusView(tracker, []));

    expect(html).toContain('href="https://jobs.ashbyhq.com/notion/1/application?from=status&amp;step=final"');
    expect(html).toContain("01 ↗");
    expect(html).toContain("Notion · San Francisco");
    expect(html).toMatch(/Notion · San Francisco[\s\S]*Software Engineer, Early Career \(AI\)/);
    expect(html).toContain("LLM");
    expect(html).toContain("In Review");
    expect(html).toContain("08-07");
  });

  test("renders a shortlisted job with its official link and verification date but no row controls", () => {
    const html = renderStatusPage(buildStatusView([], [{
      jobId: "gm-ml-validation",
      company: "General Motors",
      title: "ML Validation Research Engineer — Early Career",
      location: "Sunnyvale, CA",
      category: "robotics",
      officialUrl: "https://example.com/jobs/gm-ml-validation?view=official",
      sources: ["speedyapply-2027-ai"],
      firstSeen: "2026-08-07",
      lastVerified: "2026-08-07",
      status: "ready",
      note: "2027 timing unconfirmed"
    }]));

    expect(html).toContain('href="https://example.com/jobs/gm-ml-validation?view=official"');
    expect(html).toContain("General Motors · Sunnyvale");
    expect(html).toContain('<span class="row-status">Shortlisted</span>');
    expect(html).toContain('<time datetime="2026-08-07T00:00:00.000Z" aria-label="Updated 08-07">08-07</time>');
    const row = html.match(/<article class="status-row"[\s\S]*?<\/article>/)?.[0] ?? "";
    expect(row).not.toContain("<button");
  });

  test("gives every application link a unique accessible name and keeps dates MM-DD for assistive text", () => {
    const applications = [
      tracker[0]!,
      {
        ...tracker[0]!,
        applicationId: "acme-2",
        company: "Acme & Partners",
        title: "Research <Engineer>",
        applicationUrl: "https://example.com/applications/2"
      }
    ];
    const html = renderStatusPage(buildStatusView(applications, []));

    expect(html).toContain('aria-label="Open application 01: Notion — Software Engineer, Early Career (AI)"');
    expect(html).toContain('aria-label="Open application 02: Acme &amp; Partners — Research &lt;Engineer&gt;"');
    expect(html.match(/aria-label="Open application /g)).toHaveLength(2);
    expect(html.match(/<time datetime="2026-08-07T18:02:00.000Z" aria-label="Updated 08-07">08-07<\/time>/g)).toHaveLength(2);
    expect(html).not.toContain('aria-label="Updated 08-07 (2026-08-07T18:02:00.000Z)"');
  });

  test("shows active tracker states and omits closed applications without altering records", () => {
    const statuses = ["in_review", "submitted", "confirmed", "interviewing", "offer", "closed"] as const;
    const labels = ["In Review", "Submitted", "Submitted", "Interviewing", "Offer", "Closed"];
    const applications = statuses.map((status, index) => ({
      ...tracker[0]!,
      jobId: `job-${index}`,
      applicationId: `application-${index}`,
      company: `Company ${index}`,
      jobUrl: `https://example.com/jobs/${index}`,
      applicationUrl: `https://example.com/applications/${index}`,
      status
    }));
    const html = renderStatusPage(buildStatusView(applications, []));
    const rows = [...html.matchAll(/<article class="status-row"[\s\S]*?<\/article>/g)].map((match) => match[0]);

    expect(rows).toHaveLength(5);
    expect(html).not.toContain('data-status="closed"');
    expect(html).not.toContain('data-status-filter="closed"');
    expect(html).toContain('<strong data-status-count>5</strong>');
    expect(applications[5]?.status).toBe("closed");
    expect(applications[2]?.status).toBe("confirmed");
    expect(html).not.toContain("Confirmed");
    expect(html.match(/data-status="submitted"/g)).toHaveLength(2);
    rows.forEach((row, index) => {
      expect(row.match(/class="row-status"/g)).toHaveLength(1);
      expect(row).toContain(`>${labels[index]}</span>`);
      for (const otherLabel of labels.filter((label) => label !== labels[index])) {
        expect(row).not.toContain(`>${otherLabel}</span>`);
      }
    });
  });

  test("uses the legacy job URL fallback and safely escapes status row content and links", () => {
    const legacy = { ...tracker[0]!, applicationUrl: undefined, jobUrl: "https://example.com/jobs/1?team=ai&level=entry" };
    expect(renderStatusPage(buildStatusView([legacy], []))).toContain('href="https://example.com/jobs/1?team=ai&amp;level=entry"');

    const unsafe = {
      ...tracker[0]!,
      company: '<script>alert("company")</script>',
      title: "Research & Development",
      location: "New York, NY",
      applicationUrl: 'javascript:alert("unsafe")'
    } as unknown as ApplicationRecord;
    const html = renderStatusPage(buildStatusView([unsafe], []));
    expect(html).toContain('href="#"');
    expect(html).toContain("&lt;script&gt;alert(&quot;company&quot;)&lt;/script&gt; · New York");
    expect(html).toContain("Research &amp; Development");
    expect(html).not.toContain('<script>alert("company")</script>');
  });

  test("normalizes each US state or territory suffix without stripping country or unknown codes", () => {
    const applications = [
      { ...tracker[0]!, applicationId: "ca", location: "San Francisco, CA" },
      { ...tracker[0]!, applicationId: "multi", location: "New York, NY / Seattle, WA" },
      { ...tracker[0]!, applicationId: "dc", location: "Washington, DC" },
      { ...tracker[0]!, applicationId: "pr", location: "San Juan, PR" },
      { ...tracker[0]!, applicationId: "as", location: "Pago Pago, AS" },
      { ...tracker[0]!, applicationId: "us", location: "Remote, US" },
      { ...tracker[0]!, applicationId: "uk", location: "London, UK" },
      { ...tracker[0]!, applicationId: "unknown", location: "Fictional, ZZ" }
    ];
    const html = renderStatusPage(buildStatusView(applications, []));

    expect(html).toContain('<div class="company-line">Notion · San Francisco</div>');
    expect(html).toContain('<div class="company-line">Notion · New York / Seattle</div>');
    expect(html).toContain('<div class="company-line">Notion · Washington</div>');
    expect(html).toContain('<div class="company-line">Notion · San Juan</div>');
    expect(html).toContain('<div class="company-line">Notion · Pago Pago</div>');
    expect(html).toContain('<div class="company-line">Notion · Remote, US</div>');
    expect(html).toContain('<div class="company-line">Notion · London, UK</div>');
    expect(html).toContain('<div class="company-line">Notion · Fictional, ZZ</div>');
  });

  test("omits evidence columns, application controls, full timestamps, and legacy lifecycle decoration", () => {
    const html = renderStatusPage(buildStatusView(tracker, []));
    const row = html.match(/<article class="status-row"[\s\S]*?<\/article>/)?.[0] ?? "";
    expect(html).not.toContain("CV");
    expect(html).not.toContain("Visible result");
    expect(html).not.toContain("Gmail confirmation");
    expect(html).not.toContain("not_checked");
    expect(html).not.toContain("not_attempted");
    expect(html).not.toContain(">2026-08-07T18:02:00.000Z<");
    expect(row).not.toContain("<button");
    expect(row).not.toContain("<input");
    expect(row).not.toContain("<select");
    expect(html).not.toContain('data-action="approve"');
    expect(html).not.toContain('data-status="all"');
  });

  test("filters by the five active lifecycle states and restores rows via Status ledger", () => {
    const html = renderStatusPage(buildStatusView(tracker, []));
    const filters = [...html.matchAll(/<button class="status-filter"/g)];

    expect(filters).toHaveLength(5);
    expect(html).toContain('data-status-filter="shortlisted"');
    expect(html).toContain('data-status-filter="in_review"');
    expect(html).not.toContain('data-status-filter="all"');
    expect(html).toContain('href="/status" aria-current="page"');
    expect(html).toContain("const show=row.dataset.status===selected");
    expect(html).toContain("row.hidden=!show");
  });

  test("omits the redundant market and all-applications selector", () => {
    const html = renderUsStatusPage(buildStatusView(tracker, []));
    expect(html).toContain('href="/status" aria-current="page"');
    expect(html).not.toContain("All applications");
    expect(html).not.toContain('<nav class="market-switch"');
    expect(html).not.toContain('href="/status/china"');
    expect(html).not.toContain(">China</a>");
  });

  test("renders the separate China lifecycle and recruiter without US evidence", () => {
    const rows: ChinaStatusViewItem[] = [{
      jobId: "boss-123",
      company: "示例科技",
      title: "大模型应用工程师",
      location: "上海",
      category: "agent",
      recruiter: "王女士 · 招聘经理",
      href: "https://www.zhipin.com/job_detail/example.html",
      status: "awaiting_review",
      dateLabel: "08-08",
      dateTime: "2026-08-08T20:01:00.000Z"
    }];
    const html = renderChinaStatusPage(rows);

    expect(html).toContain("Discovered → Ready to Contact → Awaiting Review → Contacted → Closed");
    expect(html).toContain("示例科技 · 上海");
    expect(html).toContain("大模型应用工程师");
    expect(html).toContain("王女士 · 招聘经理");
    expect(html).toContain("Awaiting Review");
    expect(html).not.toContain("Gmail confirmation");
    expect(html).not.toContain("Submitted");
    const row = html.match(/<article class="status-row china-row"[\s\S]*?<\/article>/)?.[0] ?? "";
    expect(row).not.toContain("<button");
  });

  test("renders an explicit empty China state", () => {
    const html = renderChinaStatusPage([]);
    expect(html).toContain("No BOSS Zhipin jobs tracked yet.");
    expect(html).toContain("0");
  });
});
