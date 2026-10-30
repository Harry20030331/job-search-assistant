import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { createReviewBatch, readReviewBatch, selectQuestionOption, saveQuestionText } from "./reviewStore.js";
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

  test("shows local drafts independently of live readiness and hides submitted history", () => {
    const document = queue(["pending", "pending", "pending", "pending", "pending"]);
    document.applications[0]!.cv.verified = false;
    document.applications[1]!.snapshotCurrent = false;
    document.applications[2]!.validationErrors = ["Login required"];
    document.applications[3]!.questions = [{ id: "missing", prompt: "Required personal fact", required: true }];
    const html = renderReviewPage(document);
    for (const id of [1, 2, 3]) expect(html).toContain(`data-application="application-${id}"`);
    expect(html).toContain('data-application="application-5"');
    const missing = html.match(/<article class="detail" data-detail="application-4"[\s\S]*?<\/article>/)?.[0] ?? "";
    expect(missing).toContain("Required personal fact");
    expect(missing).toContain("<textarea");
    expect(missing).toContain('data-action="approve" disabled');
    document.applications[1]!.decision = { state: "stale" };
    const historical = renderReviewPage(document, "application-2", ["application-2"]);
    expect(historical).not.toContain('data-application="application-2"');
    expect(historical).not.toContain('data-detail="application-2"');
    expect(historical).not.toContain("History");

  });

  test("presents editable long answers and retains choice controls", () => {
    const document = enumeratedBatch();
    document.applications[0]!.questions.push({ id: "saved", prompt: "Evidence <link>", required: false, draftAnswer: "Saved <answer>" });
    const html = renderReviewPage(document);
    const visible = html.split("<script>")[0]!;
    expect(visible).toContain("Which U.S. person category applies to you? &lt;Choose exactly one&gt; &amp; confirm.");
    expect(visible).toContain("None of the above; I am a citizen of a different country");
    expect(visible).toMatch(/value="other-country"[^>]*checked/);
    expect(visible).toContain("Evidence &lt;link&gt;");
    expect(visible).toContain("Saved &lt;answer&gt;");
    expect(visible).toContain("<textarea");
    expect(visible).toContain('class="choice-input"');
    expect(visible).not.toContain("\u5f85\u8865\u5145");
    expect(html).toContain("/api/review/answer");
    expect(html).toContain("/api/review/text");
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
      document: { querySelectorAll: (selector: string) => selector === ".choice-input" ? [radio] : selector === ".choice-input,.queue-item,.approve,.short-answer,.long-answer" ? [radio, oldRadio, queueControl, approve] : [] },
      fetch, alert() {}, location: { href: "" }
    });
    const pendingSave = change!();
    expect(radio.disabled).toBe(true);
    expect(approve.disabled).toBe(true);
    expect(queueControl.disabled).toBe(true);
    release();
    await pendingSave;
    expect(radio.disabled).toBe(false);
    expect(approve.disabled).toBe(fail);
    expect(queueControl.disabled).toBe(false);
    expect(requests).toEqual([{ url: "/api/review/answer", body: { applicationId: item.applicationId, snapshotId: item.snapshotId, questionId: "us-person-<status>", optionId: "protected-yes", expectedRevision: 3 } }]);
    const stored = (await readReviewBatch(path)).applications[0]!;
    expect(stored.questions[0]!.selectedOptionId).toBe(fail ? "other-country" : "protected-yes");
    expect(stored.desiredState?.revision).toBe(fail ? 3 : 4);
    expect(status.textContent).toBe(fail ? "Could not save. Previous choice restored." : "Saved");
    expect(reason.textContent).toBe(fail ? "Resolve the save error to approve." : "");
    if (fail) { expect(oldRadio.checked).toBe(true); expect(radio.checked).toBe(false); }
    expect(stored.decision.state).toBe("pending");
  });

  test("renders short facts as escaped inputs and optional essays as editable drafts", () => {
    const document = batch(true);
    document.applications[0]!.questions = [
      { id: "school", prompt: "High school name", required: true, inputType: "short-text", resolution: 'School <name> "quoted"' },
      { id: "essay", prompt: "Tell us about a time you changed your mind.", required: false, resolution: "An example." }
    ];
    const visible = renderReviewPage(document).split("<script>")[0]!;
    expect(visible).toContain('class="short-answer"');
    expect(visible).toContain('aria-required="true"');
    expect(visible).toContain('value="School &lt;name&gt; &quot;quoted&quot;"');
    expect(visible).toContain("Optional · You can leave this blank.");
    expect(visible).toContain("An example.</textarea>");
    expect(visible).toContain("<textarea");
  });

  test.each([false, true])("short answer autosave preserves pending approval and rolls back failures (failure=%s)", async (fail) => {
    const document = batch(true), item = document.applications[0]!;
    item.questions = [{ id: "school", prompt: "High school name", required: true, inputType: "short-text" }];
    const path = join(await mkdtemp(join(tmpdir(), "review-short-")), "review.json");
    await createReviewBatch(path, document);
    let change!: () => Promise<void>, inputChanged!: () => void;
    const status = { textContent: "" }, reason = { textContent: "Required answers are missing" };
    const approve = { disabled: true }, queueControl = { disabled: false };
    const detail = { dataset: { detail: item.applicationId }, querySelector: (selector: string) => selector === ".save-status" ? status : selector === ".approval-reason" ? reason : approve };
    const input = { value: "", disabled: false, classList: { contains: () => false }, dataset: { question: "school" }, closest: () => detail, addEventListener: (event: string, handler: () => Promise<void>) => { if(event === "change") change=handler; if(event === "input") inputChanged=handler; } };
    let release!: () => void;
    const wait = new Promise<void>(resolve => { release=resolve; });
    runInNewContext(renderReviewPage(document).split("<script>")[1]!.split("</script>")[0]!, {
      document: { querySelectorAll: (selector: string) => selector === ".short-answer,.question-answer,.generated-answer" ? [input] : selector === ".choice-input,.queue-item,.approve,.short-answer,.long-answer" ? [input, queueControl, approve] : [] },
      fetch: async (url: string, options: { body: string }) => {
        expect(url).toBe("/api/review/text"); await wait;
        if(fail) return { ok: false, json: async () => ({}) };
        const body=JSON.parse(options.body);
        const saved=await saveQuestionText(path, body.applicationId, body.snapshotId, body.questionId, body.value);
        return { ok: true, json: async () => ({...body, value:saved.questions[0]!.draftAnswer, desiredState:saved.desiredState, missingText:!saved.questions[0]!.draftAnswer?.trim(), reviewReady:true}) };
      }, alert() {}, location:{href:""}
    });
    input.value="Example High School";
    const pending=change(); expect(input.disabled).toBe(true); expect(queueControl.disabled).toBe(true); expect(approve.disabled).toBe(true);
    release(); await pending;
    const stored=(await readReviewBatch(path)).applications[0]!;
    expect(input.value).toBe(fail ? "" : "Example High School");
    expect(stored.questions[0]!.draftAnswer).toBe(fail ? undefined : "Example High School");
    expect(stored.decision.state).toBe("pending");
    expect(approve.disabled).toBe(fail);
    expect(queueControl.disabled).toBe(false);
    expect(status.textContent).toBe(fail ? "Could not save. Previous answer restored." : "Saved");
    if (!fail) {
      input.value="Changed school"; inputChanged();
      expect(approve.disabled).toBe(true);
      input.value="Example High School"; inputChanged();
      expect(approve.disabled).toBe(false);
      input.value=""; inputChanged();
      expect(approve.disabled).toBe(true);
      await change();
      expect(approve.disabled).toBe(true);
      expect((await readReviewBatch(path)).applications[0]!.questions[0]!.draftAnswer).toBe("");
    }
  });

  test("disables Approve for missing required answers while allowing complete local content before live readiness", () => {
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
    expect(missing).toContain("Complete the required answers to approve.");
    expect(missing).not.toContain("INTERNAL SESSION DETAIL");
    item.questions[0]!.resolution = "User supplied answer";
    const sync = renderReviewPage(document).split("<script>")[0]!;
    expect(sync).not.toContain("Approve content to add this application to the submission batch.");
    expect(sync).not.toContain("Required answers are missing");
    expect(sync).not.toContain('data-action="approve" disabled');
  });

  test("renders a read-only GET and uses the content-only approval endpoint on click", () => {
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
    expect(clickHandler).toContain("fetch('/api/review/content-approval'");
    expect(clickHandler).not.toContain("/api/review/decision");
    expect(clickHandler).toContain("applicationId===id");
    expect(script).toContain('"snapshotId":"snapshot-1"');
  });

  test("offers the exact application link, answer editing and per-item approval", () => {
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
    expect(html).toContain("<textarea");
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

  test("queue navigation does not write audit or approval events", () => {
    const html = renderReviewPage(batch(true));
    expect(html).toContain('id="application-picker"');
    expect(html).not.toContain("/api/review/open");
    expect(html).not.toContain("/api/review/viewed");
  });

  test("compact application picker navigates by stable ID and stays locked while saving", () => {
    const handlers = new Map<string, () => void>();
    const picker = { value: "application/with spaces", disabled: false, addEventListener: (name: string, handler: () => void) => handlers.set(name, handler) };
    const location = { href: "/review" };
    const html = renderReviewPage(batch(true));
    const script = html.match(/<script>([\s\S]*?)<\/script>/)![1]!;
    runInNewContext(script, {
      document: { querySelectorAll: (selector: string) => selector === ".queue-picker" ? [picker] : [] }, location
    });
    handlers.get("change")!();
    expect(location.href).toBe("/review?application=application%2Fwith%20spaces");
    picker.disabled = true;
    picker.value = "another-application";
    handlers.get("change")!();
    expect(location.href).toBe("/review?application=application%2Fwith%20spaces");
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

  test.each([false, true, "missing"])("content approval saves only the selected item, restores failures and focuses missing answers (%s)", async outcome => {
    const document = queue(["pending", "pending"]);
    let click!: () => Promise<void>;
    const status = { textContent: "" }, location = { href: "" };
    let focused = false, highlighted = false;
    const row = { dataset: { required: "true", answered: "false" }, querySelectorAll: () => [], querySelector: () => null,
      classList: { toggle: (_name: string, value: boolean) => { highlighted = value; } }, scrollIntoView() {}, focus() { focused = true; } };
    const detail = { dataset: { detail: "application-1" }, querySelector: () => status, querySelectorAll: () => outcome === "missing" ? [row] : [] };
    const button = { disabled: false, closest: () => detail, addEventListener: (_: string, fn: () => Promise<void>) => { click = fn; } };
    const requests: unknown[] = [];
    let release!: () => void; const wait = new Promise<void>(resolve => { release = resolve; });
    runInNewContext(renderReviewPage(document).split("<script>")[1]!.split("</script>")[0]!, {
      document: { querySelectorAll: (selector: string) => selector === ".approve" || selector === ".queue-item,.approve,.choice-input,.short-answer,.long-answer" ? [button] : [] }, location,
      fetch: async (url: string, options: {body: string}) => { requests.push([url, JSON.parse(options.body)]); await wait;
        return {ok: !outcome, json: async () => ({applicationId:"application-1",snapshotId:"snapshot-1",decision:{scope:"content-only"}})}; }
    });
    const saving = click();
    if (outcome === "missing") { await saving; expect(requests).toHaveLength(0); expect(focused && highlighted).toBe(true); expect(button.disabled).toBe(false); return; }
    expect(button.disabled).toBe(true); await click(); expect(requests).toHaveLength(1);
    release(); await saving;
    expect(requests).toEqual([["/api/review/content-approval", {applicationId:"application-1",snapshotId:"snapshot-1"}]]);
    if (outcome) { expect(button.disabled).toBe(false); expect(status.textContent).toContain("Could not save approval"); expect(location.href).toBe(""); }
    else expect(location.href).toBe("/review?application=application-2");
  });

  test("keeps reviewed items in list order with a short status below the location", () => {
    const document = queue(["approved", "pending"]);
    const first = document.applications[0]!;
    first.decision = { state: "approved", scope: "content-only", decidedAt: "2026-08-07T18:03:00.000Z" };
    first.cv.verified = false; first.snapshotCurrent = false;
    const html = renderReviewPage(document, first.applicationId);
    const card = html.match(/<article class="detail" data-detail="application-1"[\s\S]*?<\/article>/)![0];
    expect(card).toContain("Reviewed</span>");
    const sidebar = html.split('<aside class="queue"')[1]!.split("</aside>")[0]!;
    expect(sidebar.indexOf('data-application="application-1"')).toBeLessThan(sidebar.indexOf('data-application="application-2"'));
    expect(sidebar).not.toContain("queue-index");
    expect(sidebar).toContain('<strong>Company 1</strong><span class="queue-role">Role 1</span><small>San Francisco, CA</small><span class="review-label"');
    expect(sidebar).toContain('>Reviewed</span>');
    expect(sidebar).not.toContain("Reviewed · Awaiting execution"); expect(card).toContain('class="approved-contents" disabled');
    expect(card).not.toContain('data-action="approve"'); expect(html).toContain('data-application="application-1"');
    expect(renderReviewPage(document, first.applicationId, [first.applicationId])).not.toContain('data-application="application-1"');
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

  test("renders a shortlisted job with its official link, verification date and Apply selection", () => {
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
    expect(html).toContain('class="job-select"');
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
    expect(rows.filter(row => row.includes('data-status="submitted"'))).toHaveLength(2);
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

  test("keeps tracked rows read-only without repeated review links", () => {
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
    expect(row).not.toContain("Review answers");
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
      company: "Example Technology",
      title: "Applied LLM Engineer",
      location: "Shanghai",
      category: "agent",
      recruiter: "Jordan Lee · Recruiting Manager",
      href: "https://www.zhipin.com/job_detail/example.html",
      status: "awaiting_review",
      dateLabel: "08-08",
      dateTime: "2026-08-08T20:01:00.000Z"
    }];
    const html = renderChinaStatusPage(rows);

    expect(html).toContain("Discovered → Ready to Contact → Awaiting Review → Contacted → Closed");
    expect(html).toContain("Example Technology · Shanghai");
    expect(html).toContain("Applied LLM Engineer");
    expect(html).toContain("Jordan Lee · Recruiting Manager");
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


test("uses Status order for the sidebar, picker and next-review sequence regardless of legacy queue positions", () => {
  const document=queue(["pending","pending","pending"]);
  document.applications[0]!.queuePosition=3;
  document.applications[1]!.queuePosition=1;
  document.applications[2]!.queuePosition=2;
  document.applications[1]!.decision={state:"approved",scope:"content-only",decidedAt:"2026-08-07T18:03:00.000Z"};
  const html=renderReviewPage(document, undefined, [], new Map(), ["application-2", "application-3", "application-1"]);
  const sidebar=html.split('<aside class="queue"')[1]!.split('</aside>')[0]!;
  expect(sidebar.indexOf('data-application="application-2"')).toBeLessThan(sidebar.indexOf('data-application="application-3"'));
  expect(sidebar.indexOf('data-application="application-3"')).toBeLessThan(sidebar.indexOf('data-application="application-1"'));
  expect(sidebar).not.toContain("queue-index");
  expect(sidebar.indexOf('value="application-2"')).toBeLessThan(sidebar.indexOf('value="application-3"'));
  expect(sidebar.indexOf('value="application-3"')).toBeLessThan(sidebar.indexOf('value="application-1"'));
  const items = JSON.parse(html.match(/const items=(.*?);const desiredStates/)![1]!);
  expect(items.map((item: { applicationId: string }) => item.applicationId)).toEqual(["application-2", "application-3", "application-1"]);
  expect(html).toContain('data-detail="application-3" >');
});
