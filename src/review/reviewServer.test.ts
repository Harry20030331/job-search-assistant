import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { chinaJobLibraryHeader, writeChinaJobLibrary } from "../china/jobs/chinaJobLibrary.js";
import { writeChinaOutreachTracker } from "../china/outreach/chinaOutreachTracker.js";
import { jobLibraryHeader, writeJobLibrary } from "../jobs/jobLibrary.js";
import { createReviewBatch, readReviewBatch, consumeApproval, type ReviewBatch } from "./reviewStore.js";
import { startReviewServer, type RunningReviewServer } from "./reviewServer.js";

const running: RunningReviewServer[] = [];
afterEach(async () => {
  await Promise.all(running.splice(0).map((server) => server.close()));
});

function batch(): ReviewBatch {
  return {
    schemaVersion: 1,
    batchId: "batch-1",
    createdAt: "2026-08-07T18:00:00.000Z",
    applications: [{
      applicationId: "notion-1",
      snapshotId: "snapshot-1",
      company: "Notion",
      title: "Software Engineer, Early Career (AI)",
      officialUrl: "https://jobs.ashbyhq.com/notion/1",
      ats: "ashby",
      category: "llm",
      location: "San Francisco, CA",
      cv: { filename: "example_cv_llm.pdf", verified: true },
      answers: [],
      consents: [],
      questions: [],
      validationErrors: [],
      friction: [],
      snapshotCurrent: true,
      preparedAt: "2026-08-07T18:00:00.000Z",
      decision: { state: "pending" }
    }]
  };
}

function enumeratedBatch(): ReviewBatch {
  const document = batch();
  document.applications[0]!.questions = [{
    id: "pwc-history",
    prompt: "Have you ever worked for PwC?",
    required: true,
    options: [
      { id: "yes", label: "Yes" },
      { id: "no", label: "No" }
    ],
    recommendedOptionId: "no",
    recommendationSource: "Confirmed personal fact",
    selectedOptionId: "no"
  }];
  document.applications[0]!.desiredState = { revision: 1, syncState: "pending" };
  document.applications.push({
    ...document.applications[0]!,
    applicationId: "linear-2",
    snapshotId: "snapshot-2",
    company: "Linear",
    title: "Software Engineer",
    officialUrl: "https://linear.app/careers/2",
    questions: [{
      id: "government-history",
      prompt: "Have you worked for a government employer?",
      required: true,
      options: [
        { id: "yes", label: "Yes" },
        { id: "no", label: "No" }
      ],
      selectedOptionId: "no"
    }]
  });
  return document;
}

async function fixture(
  trackerDocument: unknown = { schemaVersion: 2, applications: [] },
  reviewDocument: ReviewBatch = batch()
) {
  const directory = await mkdtemp(join(tmpdir(), "review-server-"));
  const reviewPath = join(directory, "review.local.json");
  const trackerPath = join(directory, "tracker.local.json");
  const jobsPath = join(directory, "jobs.csv");
  const chinaJobsPath = join(directory, "china-jobs.csv");
  const chinaOutreachPath = join(directory, "china-outreach.local.json");
  await createReviewBatch(reviewPath, reviewDocument);
  await writeFile(trackerPath, `${JSON.stringify(trackerDocument)}\n`, { mode: 0o600 });
  await writeFile(jobsPath, `${jobLibraryHeader}\n`, { mode: 0o600 });
  await writeFile(chinaJobsPath, `${chinaJobLibraryHeader}\n`, { mode: 0o600 });
  await writeChinaOutreachTracker(chinaOutreachPath, { schemaVersion: 1, outreach: [] });
  const server = await startReviewServer({ reviewPath, trackerPath, jobsPath, chinaJobsPath, chinaOutreachPath, port: 0 });
  running.push(server);
  return { server, reviewPath, jobsPath, chinaJobsPath, chinaOutreachPath };
}

function trackerRecord(overrides: Record<string, unknown> = {}) {
  return {
    jobId: "legacy-job",
    applicationId: "legacy-application",
    company: "Legacy Co",
    title: "Migration Engineer",
    location: "Washington, DC",
    ats: "lever",
    jobUrl: "https://example.com/jobs/legacy",
    category: "robotics",
    cvFilename: "example_cv_robotics.pdf",
    status: "final_review",
    visibleResult: "not_attempted",
    gmailConfirmation: "not_checked",
    createdAt: "2026-08-07T18:00:00.000Z",
    updatedAt: "2026-08-07T18:02:00.000Z",
    ...overrides
  };
}

async function rawPostBeforeRequestEnd(
  address: string,
  path: string,
  headers: Record<string, string>,
  firstChunk?: Buffer
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, address);
    const request = httpRequest(url, { method: "POST", headers });
    const timeout = setTimeout(() => {
      request.destroy();
      reject(new Error("server_waited_for_request_end"));
    }, 2_000);
    request.on("response", (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      response.on("end", () => {
        clearTimeout(timeout);
        request.destroy();
        resolve({
          status: response.statusCode ?? 0,
          body: Buffer.concat(chunks).toString("utf8")
        });
      });
    });
    request.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    request.flushHeaders();
    if (firstChunk) request.write(firstChunk);
  });
}

async function rawPost(
  address: string,
  path: string,
  headers: Record<string, string>,
  body: string
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const request = httpRequest(new URL(path, address), { method: "POST", headers }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      response.on("end", () => resolve({
        status: response.statusCode ?? 0,
        body: Buffer.concat(chunks).toString("utf8")
      }));
    });
    request.on("error", reject);
    request.end(body);
  });
}

describe("local review server", () => {
  test("binds only to loopback and redirects the retired China entry to active applications", async () => {
    const { server } = await fixture();
    expect(server.address).toMatch(/^http:\/\/127\.0\.0\.1:/);
    const review = await (await fetch(`${server.address}/review`)).text();
    const status = await fetch(`${server.address}/status`, { redirect: "manual" });
    const us = await (await fetch(`${server.address}/status/us`)).text();
    const china = await fetch(`${server.address}/status/china`, { redirect: "manual" });
    expect(review).toContain("Software Engineer, Early Career (AI)");
    expect(review).toContain('data-action="approve"');
    expect(review).not.toContain('data-action="approve" disabled');
    expect(status.status).toBe(302);
    expect(status.headers.get("location")).toBe("/status/us");
    expect(us).toContain("Status");
    expect(us).not.toContain('href="/status/china"');
    expect(china.status).toBe(302);
    expect(china.headers.get("location")).toBe("/status/us");
    expect(us).not.toContain('data-action="approve"');
  });

  test("excludes stale submitted snapshots from review without mutations", async () => {
    const review = batch();
    review.applications[0]!.snapshotCurrent = false;
    review.applications[0]!.decision = { state: "stale" };
    const { server, reviewPath } = await fixture({ schemaVersion: 2, applications: [trackerRecord({
      applicationId: "notion-1", status: "submitted", visibleResult: "submitted",
      submittedAt: "2026-08-07T18:03:00.000Z"
    })] }, review);
    const before = await readFile(reviewPath, "utf8");
    const html = await (await fetch(`${server.address}/review?application=notion-1`)).text();
    expect(html).not.toContain("Software Engineer, Early Career (AI)");
    expect(html).not.toContain("History");
    expect(html).not.toContain('data-action="approve"');
    expect(await readFile(reviewPath, "utf8")).toBe(before);
  });

  test("persists free-text revisions and requires exact approval plus live synchronization", async () => {
    const document = batch();
    document.applications[0]!.questions = [{ id: "portfolio", prompt: "Portfolio evidence?", required: true }];
    const { server, reviewPath } = await fixture(undefined, document);
    const identity = { applicationId: "notion-1", snapshotId: "snapshot-1" };
    const post = (path: string, value: object) => fetch(`${server.address}${path}`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(value)
    });
    expect((await post("/api/review/text", { ...identity, snapshotId: "wrong", questionId: "portfolio", value: "Evidence" })).status).toBe(409);
    const saved = await post("/api/review/text", { ...identity, questionId: "portfolio", value: "Evidence <project>" });
    expect(saved.status).toBe(200);
    expect(await saved.json()).toMatchObject({ value: "Evidence <project>", desiredState: { revision: 1, syncState: "pending" }, reviewReady: true });
    await post("/api/review/open", identity);
    await post("/api/review/viewed", identity);
    expect((await post("/api/review/decision", { ...identity, decision: "approved", expectedDesiredRevision: 2 })).status).toBe(409);
    expect((await post("/api/review/decision", { ...identity, decision: "approved", expectedDesiredRevision: 1 })).status).toBe(200);
    const stored = (await readReviewBatch(reviewPath)).applications[0]!;
    expect(stored.questions[0]!.draftAnswer).toBe("Evidence <project>");
    expect(stored.decision).toMatchObject({ state: "approved", desiredRevision: 1 });
    expect(stored.desiredState?.syncState).toBe("pending");
    await expect(consumeApproval(reviewPath, "notion-1", "snapshot-1")).rejects.toThrow("desired_state_sync_required");
    expect((await post("/api/review/text", { ...identity, questionId: "portfolio", value: "Changed" })).status).toBe(400);
  });

  test("short inputs reject multiline and oversized values and clearing removes an old resolution", async () => {
    const document = batch();
    document.applications[0]!.questions = [{ id: "school", prompt: "High school name", required: true, inputType: "short-text", resolution: "Old School" }];
    const { server, reviewPath } = await fixture(undefined, document);
    const post = (value: string) => fetch(`${server.address}/api/review/text`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({applicationId:"notion-1",snapshotId:"snapshot-1",questionId:"school",value})
    });
    expect((await post("x".repeat(301))).status).toBe(400);
    expect((await post("First\nSecond")).status).toBe(400);
    const clear=await post("");
    expect(await clear.json()).toMatchObject({value:"",missingText:true,reviewReady:false,desiredState:{revision:1,syncState:"pending"}});
    const stored=(await readReviewBatch(reviewPath)).applications[0]!;
    expect(stored.questions[0]!.resolution).toBeUndefined();
    expect(stored.decision.state).toBe("pending");
  });

  test("collects explicit stale questions without granting approval or live continuity", async () => {
    const document = batch();
    Object.assign(document.applications[0]!, { reviewStage: "questions", snapshotCurrent: false, decision: { state: "stale" }, validationErrors: ["Session lost"] });
    document.applications[0]!.questions = [
      { id: "evidence", prompt: "Share evidence", required: true },
      { id: "consent", prompt: "Consent choice", required: true, options: [{ id: "yes", label: "Yes" }, { id: "no", label: "No" }] }
    ];
    const { server } = await fixture(undefined, document);
    const html = await (await fetch(`${server.address}/review`)).text();
    expect(html).not.toContain("\u5f85\u8865\u5145");
    expect(html).toContain("Share evidence");
    expect(html).toContain("<textarea");
    expect(html).toContain('data-action="approve" disabled');
    expect(html).toContain("Complete the required answers to approve.");
    expect(html).not.toContain("Session lost");
    expect(html).not.toContain("CV:");
    const response = await fetch(`${server.address}/api/review/text`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ applicationId: "notion-1", snapshotId: "snapshot-1", questionId: "evidence", value: "My evidence" }) });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ reviewReady: false, desiredState: { syncState: "pending" } });
    const choice = await fetch(`${server.address}/api/review/answer`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ applicationId: "notion-1", snapshotId: "snapshot-1", questionId: "consent", optionId: "yes" }) });
    expect(choice.status).toBe(200);
    expect(await choice.json()).toMatchObject({ selectedOptionId: "yes", reviewReady: false, desiredState: { revision: 2, syncState: "pending" } });
  });

  test("has no China mutation or send endpoint", async () => {
    const { server } = await fixture();
    for (const path of ["/api/china/jobs", "/api/china/outreach", "/api/china/send", "/api/china/upload"]) {
      expect((await fetch(`${server.address}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}"
      })).status).toBe(404);
    }
  });

  test("migrates legacy tracker states but keeps records without drafts out of Review", async () => {
    const { server } = await fixture({ schemaVersion: 2, applications: [trackerRecord()] });
    const response = await fetch(`${server.address}/status`);
    const html = await response.text();
    const row = html.match(/<tr class="status-row"[\s\S]*?<\/tr>/)?.[0] ?? "";

    expect(response.status).toBe(200);
    expect(row).toContain('<div class="company-line">Legacy Co</div><div class="row-location">Washington</div>');
    expect(row).toContain('data-status="shortlisted"');
    expect(row).not.toContain("final_review");
  });

  test("renders ready and pending jobs together as Shortlisted before tracked applications", async () => {
    const { server, jobsPath } = await fixture({ schemaVersion: 2, applications: [trackerRecord()] });
    await writeJobLibrary(jobsPath, [{
      jobId: "shortlisted-job",
      company: "Shortlist Co",
      title: "Applied AI Engineer",
      location: "New York, NY",
      category: "llm",
      officialUrl: "https://example.com/jobs/shortlisted",
      sources: ["speedyapply-2027-ai"],
      firstSeen: "2026-08-07",
      lastVerified: "2026-08-07",
      status: "ready",
      note: "2027 timing unconfirmed"
    }, {
      jobId: "unreviewed-job",
      company: "New Co",
      title: "Machine Learning Engineer",
      location: "Boston, MA",
      category: "recommendation",
      officialUrl: "https://example.com/jobs/new",
      sources: ["simplify-new-grad"],
      firstSeen: "2026-08-07",
      lastVerified: "2026-08-07",
      status: "new",
      note: ""
    }]);

    const response = await fetch(`${server.address}/status`);
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(html).toContain('<div class="company-line">Shortlist Co</div><div class="row-location">New York</div>');
    expect(html).toContain('data-status="shortlisted"');
    expect(html.indexOf("Shortlist Co")).toBeLessThan(html.indexOf("Legacy Co"));
    expect(html).toContain("New Co");
    expect(html).not.toContain("\u5f85\u4f60\u5ba1\u9605");
    expect(html).not.toContain("\u6838\u9a8c\u8bf4\u660e");
  });

  test("suppresses a ready job when the tracker owns the same exact jobId", async () => {
    const { server, jobsPath } = await fixture({ schemaVersion: 2, applications: [trackerRecord()] });
    await writeJobLibrary(jobsPath, [{
      jobId: "legacy-job",
      company: "Duplicate CSV Co",
      title: "Stale Role",
      location: "Seattle, WA",
      category: "robotics",
      officialUrl: "https://example.com/jobs/duplicate",
      sources: ["speedyapply-2027-ai"],
      firstSeen: "2026-08-07",
      lastVerified: "2026-08-07",
      status: "ready",
      note: ""
    }]);

    const html = await (await fetch(`${server.address}/status`)).text();
    expect(html).toContain("Legacy Co");
    expect(html).not.toContain("Duplicate CSV Co");
    expect(html.match(/class="status-row"/g)).toHaveLength(1);
  });

  test("fails closed without partial status output when the job library is malformed", async () => {
    const { server, jobsPath } = await fixture({ schemaVersion: 2, applications: [trackerRecord()] });
    await writeFile(jobsPath, "not,a,valid,library\n", { mode: 0o600 });

    const response = await fetch(`${server.address}/status`);
    const body = await response.text();
    expect(response.status).toBe(500);
    expect(body).toBe('{"ok":false,"error":"request_failed"}');
    expect(body).not.toContain("Legacy Co");
    expect(body).not.toContain("invalid_job_library");
  });

  test.each([
    ["status", trackerRecord({ applicationUrl: "https://example.com/applications/invalid-status", status: "ready" })],
    ["date", trackerRecord({ applicationUrl: "https://example.com/applications/invalid-date", status: "in_review", updatedAt: "08-07" })]
  ])("fails closed for a malformed v3 tracker %s", async (_field, record) => {
    const { server } = await fixture({ schemaVersion: 3, applications: [record] });
    const response = await fetch(`${server.address}/status`);
    const body = await response.text();

    expect(response.status).toBe(500);
    expect(body).toBe('{"ok":false,"error":"request_failed"}');
    expect(body).not.toContain("invalid_application_tracker");
    expect(body).not.toContain(String(record.status));
    expect(body).not.toContain(String(record.updatedAt));
  });

  test("has no submit or browser-control endpoint", async () => {
    const { server } = await fixture();
    for (const path of ["/submit", "/api/submit", "/api/browser", "/api/ats"]) {
      expect((await fetch(`${server.address}${path}`, { method: "POST" })).status).toBe(404);
    }
  });

  test("does not mutate review gates merely by loading the review page", async () => {
    const { server, reviewPath } = await fixture();
    const before = await readReviewBatch(reviewPath);
    expect((await fetch(`${server.address}/review`)).status).toBe(200);
    expect(await readReviewBatch(reviewPath)).toEqual(before);
  });

  test("does not expose a free-form resolution endpoint", async () => {
    const { server } = await fixture();
    const response = await fetch(`${server.address}/api/review/resolve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        applicationId: "notion-1",
        snapshotId: "snapshot-1",
        questionId: "exercise",
        value: "arbitrary"
      })
    });
    expect(response.status).toBe(404);
  });

  test.each([
    "/api/review/answer",
    "/api/review/open",
    "/api/review/viewed",
    "/api/review/decision"
  ])("rejects a hostile Host before every browser mutation: %s", async (path) => {
    const { server, reviewPath } = await fixture(undefined, enumeratedBatch());
    const before = await readReviewBatch(reviewPath);
    const port = new URL(server.address).port;
    const response = await rawPost(server.address, path, {
      "content-type": "application/json",
      host: `evil.example:${port}`
    }, "{}");

    expect(response.status).toBe(403);
    expect(JSON.parse(response.body)).toEqual({ ok: false, error: "invalid_request_authority" });
    expect(await readReviewBatch(reviewPath)).toEqual(before);
  });

  test("accepts matching 127.0.0.1 and localhost browser-write authorities", async () => {
    const first = await fixture(undefined, enumeratedBatch());
    const answer = {
      applicationId: "notion-1",
      snapshotId: "snapshot-1",
      questionId: "pwc-history",
      optionId: "yes"
    };
    const loopback = await fetch(`${first.server.address}/api/review/answer`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: first.server.address },
      body: JSON.stringify(answer)
    });
    expect(loopback.status).toBe(200);

    const second = await fixture(undefined, enumeratedBatch());
    const port = new URL(second.server.address).port;
    const localhost = await rawPost(second.server.address, "/api/review/answer", {
      "content-type": "application/json",
      host: `localhost:${port}`,
      origin: `http://localhost:${port}`
    }, JSON.stringify(answer));
    expect(localhost.status).toBe(200);
  });

  test.each([
    ["hostile", (port: string) => `https://evil.example:${port}`],
    ["authority-mismatched", (port: string) => `http://localhost:${port}`]
  ])("rejects a %s Origin on browser mutations", async (_case, originForPort) => {
    const { server, reviewPath } = await fixture(undefined, enumeratedBatch());
    const before = await readReviewBatch(reviewPath);
    const response = await fetch(`${server.address}/api/review/answer`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: originForPort(new URL(server.address).port)
      },
      body: JSON.stringify({
        applicationId: "notion-1",
        snapshotId: "snapshot-1",
        questionId: "pwc-history",
        optionId: "yes"
      })
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ ok: false, error: "invalid_request_origin" });
    expect(await readReviewBatch(reviewPath)).toEqual(before);
  });

  test("updates only the exact enumerated answer and returns minimal snapshot-safe state", async () => {
    const { server, reviewPath } = await fixture(undefined, enumeratedBatch());
    const response = await fetch(`${server.address}/api/review/answer`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        applicationId: "notion-1",
        snapshotId: "snapshot-1",
        questionId: "pwc-history",
        optionId: "yes"
      })
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      applicationId: "notion-1",
      snapshotId: "snapshot-1",
      questionId: "pwc-history",
      selectedOptionId: "yes",
      reviewReady: true,
      desiredState: { revision: 2, syncState: "pending" }
    });
    const stored = await readReviewBatch(reviewPath);
    expect(stored.applications[0]?.questions[0]?.selectedOptionId).toBe("yes");
    expect(stored.applications[1]?.questions[0]?.selectedOptionId).toBe("no");
  });

  test.each([
    ["missing option identity", { applicationId: "notion-1", snapshotId: "snapshot-1", questionId: "pwc-history" }, 400],
    ["extra arbitrary value", { applicationId: "notion-1", snapshotId: "snapshot-1", questionId: "pwc-history", optionId: "yes", value: "arbitrary" }, 400],
    ["unknown question", { applicationId: "notion-1", snapshotId: "snapshot-1", questionId: "missing", optionId: "yes" }, 400],
    ["unknown or free-form option", { applicationId: "notion-1", snapshotId: "snapshot-1", questionId: "pwc-history", optionId: "No" }, 400],
    ["unknown application", { applicationId: "missing", snapshotId: "snapshot-1", questionId: "pwc-history", optionId: "yes" }, 400],
    ["stale snapshot", { applicationId: "notion-1", snapshotId: "snapshot-old", questionId: "pwc-history", optionId: "yes" }, 409],
    ["cross-application snapshot", { applicationId: "notion-1", snapshotId: "snapshot-2", questionId: "pwc-history", optionId: "yes" }, 409],
    ["cross-application question", { applicationId: "notion-1", snapshotId: "snapshot-1", questionId: "government-history", optionId: "yes" }, 400]
  ])("rejects answer requests with %s", async (_case, body, status) => {
    const { server, reviewPath } = await fixture(undefined, enumeratedBatch());
    const before = await readReviewBatch(reviewPath);
    const response = await fetch(`${server.address}/api/review/answer`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });

    expect(response.status).toBe(status);
    expect(await readReviewBatch(reviewPath)).toEqual(before);
  });

  test("rejects answer changes for a non-pending decision", async () => {
    const document = enumeratedBatch();
    document.applications[0]!.openedAt = "2026-08-07T18:01:00.000Z";
    document.applications[0]!.fullContentsViewedAt = "2026-08-07T18:02:00.000Z";
    document.applications[0]!.decision = {
      state: "approved",
      decidedAt: "2026-08-07T18:03:00.000Z",
      desiredRevision: 1
    };
    const { server } = await fixture(undefined, document);
    const response = await fetch(`${server.address}/api/review/answer`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        applicationId: "notion-1",
        snapshotId: "snapshot-1",
        questionId: "pwc-history",
        optionId: "yes"
      })
    });

    expect(response.status).toBe(400);
  });

  test("enforces strict JSON content type and body size on answer changes", async () => {
    const { server } = await fixture(undefined, enumeratedBatch());
    expect((await fetch(`${server.address}/api/review/answer`, {
      method: "POST",
      headers: { "content-type": "application/json-patch+json" },
      body: "{}"
    })).status).toBe(415);
    expect((await fetch(`${server.address}/api/review/answer`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ padding: "x".repeat(70_000) })
    })).status).toBe(413);
  });

  test("rejects an oversized Content-Length before waiting for a body", async () => {
    const { server } = await fixture(undefined, enumeratedBatch());
    const response = await rawPostBeforeRequestEnd(server.address, "/api/review/answer", {
      "content-type": "application/json",
      "content-length": "65537"
    });

    expect(response).toEqual({
      status: 413,
      body: '{"ok":false,"error":"body_too_large"}'
    });
  });

  test("rejects a chunked body immediately after the first over-limit chunk", async () => {
    const { server } = await fixture(undefined, enumeratedBatch());
    const response = await rawPostBeforeRequestEnd(
      server.address,
      "/api/review/answer",
      { "content-type": "application/json", "transfer-encoding": "chunked" },
      Buffer.alloc(65_537, 0x78)
    );

    expect(response).toEqual({
      status: 413,
      body: '{"ok":false,"error":"body_too_large"}'
    });
  });

  test("maps expected client failures to stable public error codes", async () => {
    const { server } = await fixture(undefined, enumeratedBatch());
    const invalidJson = await fetch(`${server.address}/api/review/answer`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{"
    });
    expect(invalidJson.status).toBe(400);
    expect(await invalidJson.json()).toEqual({ ok: false, error: "invalid_json" });

    const unknownOption = await fetch(`${server.address}/api/review/answer`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        applicationId: "notion-1",
        snapshotId: "snapshot-1",
        questionId: "pwc-history",
        optionId: "arbitrary"
      })
    });
    expect(unknownOption.status).toBe(400);
    expect(await unknownOption.json()).toEqual({ ok: false, error: "invalid_review_answer" });
  });

  test("maps unexpected store failures to a generic 500 without leaking details", async () => {
    const { server, reviewPath } = await fixture(undefined, enumeratedBatch());
    await writeFile(reviewPath, "{corrupt private review path contents", { mode: 0o600 });
    const response = await fetch(`${server.address}/api/review/open`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ applicationId: "notion-1", snapshotId: "snapshot-1" })
    });
    const body = await response.text();

    expect(response.status).toBe(500);
    expect(body).toBe('{"ok":false,"error":"request_failed"}');
    expect(body).not.toContain("invalid_review_batch");
    expect(body).not.toContain(reviewPath);
  });

  test.each(["skipped", "rejected"])('accepts only "approved" on the website decision endpoint: %s', async (decision) => {
    const { server } = await fixture();
    const response = await fetch(`${server.address}/api/review/decision`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ applicationId: "notion-1", snapshotId: "snapshot-1", decision })
    });
    expect(response.status).toBe(400);
  });

  test("persists only exact snapshot review actions", async () => {
    const { server, reviewPath } = await fixture();
    const opened = await fetch(`${server.address}/api/review/open`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ applicationId: "notion-1", snapshotId: "snapshot-1" })
    });
    expect(opened.status).toBe(200);
    const viewed = await fetch(`${server.address}/api/review/viewed`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ applicationId: "notion-1", snapshotId: "snapshot-1" })
    });
    expect(viewed.status).toBe(200);
    const mismatch = await fetch(`${server.address}/api/review/decision`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ applicationId: "notion-1", snapshotId: "old", decision: "approved" })
    });
    expect(mismatch.status).toBe(409);
    const approved = await fetch(`${server.address}/api/review/decision`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ applicationId: "notion-1", snapshotId: "snapshot-1", decision: "approved" })
    });
    expect(approved.status).toBe(200);
    expect((await readReviewBatch(reviewPath)).applications[0]?.decision.state).toBe("approved");
  });

  test("CAS-binds desired-state approval to the revision visible in the requesting tab", async () => {
    const { server, reviewPath } = await fixture(undefined, enumeratedBatch());
    for (const path of ["/api/review/open", "/api/review/viewed"]) {
      expect((await fetch(`${server.address}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ applicationId: "notion-1", snapshotId: "snapshot-1" })
      })).status).toBe(200);
    }
    expect((await fetch(`${server.address}/api/review/answer`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        applicationId: "notion-1",
        snapshotId: "snapshot-1",
        questionId: "pwc-history",
        optionId: "yes"
      })
    })).status).toBe(200);
    const before = await readFile(reviewPath, "utf8");

    for (const body of [
      { applicationId: "notion-1", snapshotId: "snapshot-1", decision: "approved" },
      { applicationId: "notion-1", snapshotId: "snapshot-1", decision: "approved", expectedDesiredRevision: 1 }
    ]) {
      const response = await fetch(`${server.address}/api/review/decision`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({ ok: false, error: "desired_revision_mismatch" });
      expect(await readFile(reviewPath, "utf8")).toBe(before);
    }

    const approved = await fetch(`${server.address}/api/review/decision`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        applicationId: "notion-1",
        snapshotId: "snapshot-1",
        decision: "approved",
        expectedDesiredRevision: 2
      })
    });
    expect(approved.status).toBe(200);
    expect((await readReviewBatch(reviewPath)).applications[0]?.decision)
      .toMatchObject({ state: "approved", desiredRevision: 2 });
  });

  test("rejects non-json writes and oversized bodies", async () => {
    const { server } = await fixture();
    expect((await fetch(`${server.address}/api/review/open`, { method: "POST", body: "x" })).status).toBe(415);
    expect((await fetch(`${server.address}/api/review/open`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ padding: "x".repeat(70_000) })
    })).status).toBe(413);
  });
});


describe("content-only approval", () => {
  test("accepts reviewed content without live readiness, persists it, and never grants submission authority", async () => {
    const document = batch(); const item = document.applications[0]!;
    item.cv.verified = false; item.snapshotCurrent = false; item.reviewStage = "questions"; item.validationErrors = ["Live upload pending"];
    const {server, reviewPath} = await fixture(undefined, document);
    const response = await fetch(server.address + "/api/review/content-approval", {method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({applicationId:item.applicationId,snapshotId:item.snapshotId})});
    expect(response.status).toBe(200);
    const saved = (await readReviewBatch(reviewPath)).applications[0]!;
    expect(saved.decision).toMatchObject({state:"approved",scope:"content-only"}); expect(saved.snapshotCurrent).toBe(false); expect(saved.cv.verified).toBe(false);
    // Even making legacy live gates ready cannot turn content approval into execution authorization.
    saved.snapshotCurrent = true; saved.cv.verified = true; saved.validationErrors = [];
    saved.openedAt = saved.preparedAt; saved.fullContentsViewedAt = saved.preparedAt;
    await writeFile(reviewPath, JSON.stringify({ ...document, applications:[saved] }));
    await expect(consumeApproval(reviewPath,item.applicationId,item.snapshotId)).rejects.toThrow("execution_authorization_required");
  });

  test("rejects missing answers, stale revisions, changed snapshots and cross-origin approval", async () => {
    const document = batch(), item = document.applications[0]!;
    item.questions = [{id:"location",prompt:"Location?",required:true,inputType:"short-text",draftAnswer:""}]; item.desiredState={revision:1,syncState:"pending"};
    const {server, reviewPath} = await fixture(undefined, document);
    const post = (body:unknown,origin?:string) => fetch(server.address+"/api/review/content-approval",{method:"POST",headers:{"content-type":"application/json",...(origin?{origin}:{})},body:JSON.stringify(body)});
    const body={applicationId:item.applicationId,snapshotId:item.snapshotId,expectedDesiredRevision:1};
    expect((await post(body)).status).toBe(422);
    expect((await post({...body,expectedDesiredRevision:2})).status).toBe(409);
    expect((await post({...body,snapshotId:"changed"})).status).toBe(409);
    expect((await post(body,"https://example.com")).status).toBe(403);
    expect((await readReviewBatch(reviewPath)).applications[0]!.decision.state).toBe("pending");
  });
});
