import { createHash } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import {
  decideReview,
  approveReviewContent,
  markFullContentsViewed,
  markOpened,
  readReviewBatch,
  selectQuestionOption,
  saveQuestionText,
  saveGeneratedAnswer,
  reopenReviewContent
} from "./reviewStore.js";
import { readApplicationTracker } from "../tracker.js";
import { readJobLibrary } from "../jobs/jobLibrary.js";
import { renderReviewPage, renderUsStatusPage } from "./reviewViews.js";
import { buildStatusView } from "./statusView.js";
import { dirname, join } from "node:path";
import { readInterviewBoard } from "../interview/workbench.js";
import { renderInterviewPage } from "../interview/interviewView.js";
import { renderHomePage, renderAccountPage } from "../workbench/views.js";
import { GoogleBridge, googleRoutes } from "../interview/googleBridge.js";
import type { ApplicationTaskService } from "./applicationTasks.js";
import { withWorkflowControls } from "./workflowViews.js";

export interface ReviewServerOptions {
  reviewPath: string;
  trackerPath: string;
  jobsPath: string;
  chinaJobsPath?: string;
  chinaOutreachPath?: string;
  port: number;
  profilePath?: string;
  googleRoot?: string;
  tasks?: ApplicationTaskService;
}

export interface RunningReviewServer {
  address: string;
  close(): Promise<void>;
}

const maximumJsonBodyBytes = 65_536;
const browserMutationPaths = new Set([
  "/api/tasks",
  "/api/review/generated-answer",
  "/api/review/reopen",
  "/api/review/content-approval",
  "/api/review/answer",
  "/api/review/text",
  "/api/review/open",
  "/api/review/viewed",
  "/api/review/decision"
]);

function send(response: ServerResponse, status: number, body: string, contentType = "text/plain; charset=utf-8") {
  response.writeHead(status, {
    "content-type": contentType,
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "content-security-policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
  });
  response.end(body);
}

function redirect(response: ServerResponse, location: string): void {
  response.writeHead(302, {
    location,
    "cache-control": "no-store",
    "x-content-type-options": "nosniff"
  });
  response.end();
}

function discardRequestBody(request: IncomingMessage): void {
  request.once("error", () => undefined);
  request.resume();
}

async function readJson(
  request: IncomingMessage,
  strictContentType = false
): Promise<Record<string, unknown>> {
  const contentLength = request.headers["content-length"];
  if (contentLength !== undefined) {
    if (Array.isArray(contentLength) || !/^(0|[1-9][0-9]*)$/.test(contentLength)) {
      throw new Error("invalid_request");
    }
    if (BigInt(contentLength) > BigInt(maximumJsonBodyBytes)) {
      discardRequestBody(request);
      throw new Error("body_too_large");
    }
  }
  const contentType = request.headers["content-type"]?.trim() ?? "";
  const supported = strictContentType
    ? /^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(contentType)
    : contentType.toLowerCase().startsWith("application/json");
  if (!supported) {
    discardRequestBody(request);
    throw new Error("unsupported_media_type");
  }
  const payload = await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    const cleanup = () => {
      request.off("data", onData);
      request.off("end", onEnd);
      request.off("error", onError);
      request.off("aborted", onAborted);
    };
    const fail = (error: Error, drain = false) => {
      cleanup();
      if (drain) discardRequestBody(request);
      reject(error);
    };
    const onData = (chunk: Buffer | string) => {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += bytes.length;
      if (size > maximumJsonBodyBytes) {
        fail(new Error("body_too_large"), true);
        return;
      }
      chunks.push(bytes);
    };
    const onEnd = () => {
      cleanup();
      resolve(Buffer.concat(chunks));
    };
    const onError = (error: Error) => fail(error);
    const onAborted = () => fail(new Error("request_aborted"));
    request.on("data", onData);
    request.once("end", onEnd);
    request.once("error", onError);
    request.once("aborted", onAborted);
  });
  try {
    const value: unknown = JSON.parse(payload.toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value as Record<string, unknown>;
  } catch {
    throw new Error("invalid_json");
  }
}

function stringField(value: Record<string, unknown>, key: string): string {
  const field = value[key];
  if (typeof field !== "string" || !field) throw new Error("invalid_request");
  return field;
}

function exactFields(value: Record<string, unknown>, expected: readonly string[]): void {
  const actual = Object.keys(value).sort();
  const required = [...expected].sort();
  if (actual.length !== required.length || actual.some((key, index) => key !== required[index])) {
    throw new Error("invalid_request");
  }
}

function assertBrowserMutationAuthority(request: IncomingMessage, port: number): void {
  const authority = request.headers.host ?? "";
  const match = /^(127\.0\.0\.1|localhost):([1-9][0-9]{0,4})$/i.exec(authority);
  if (!match || match[2] !== String(port)) throw new Error("invalid_request_authority");
  const origin = request.headers.origin;
  if (origin === undefined) return;
  if (Array.isArray(origin)) throw new Error("invalid_request_origin");
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    throw new Error("invalid_request_origin");
  }
  if (
    parsed.protocol !== "http:" ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash ||
    parsed.hostname.toLowerCase() !== match[1]!.toLowerCase() ||
    parsed.port !== match[2]
  ) {
    throw new Error("invalid_request_origin");
  }
}

function publicError(error: unknown): { status: number; code: string } {
  const message = error instanceof Error ? error.message : "";
  const expected = new Map<string, { status: number; code: string }>([
    ["task_target_unavailable", { status: 409, code: "task_target_unavailable" }],
    ["task_already_active", { status: 409, code: "task_already_active" }],
    ["submission_outcome_unresolved", { status: 409, code: "submission_outcome_unresolved" }],
    ["runner_unavailable", { status: 503, code: "runner_unavailable" }],
    ["unsupported_media_type", { status: 415, code: "unsupported_media_type" }],
    ["body_too_large", { status: 413, code: "body_too_large" }],
    ["invalid_json", { status: 400, code: "invalid_json" }],
    ["invalid_request", { status: 400, code: "invalid_request" }],
    ["invalid_question_resolution", { status: 400, code: "invalid_review_answer" }],
    ["invalid_request_authority", { status: 403, code: "invalid_request_authority" }],
    ["invalid_request_origin", { status: 403, code: "invalid_request_origin" }],
    ["review_application_not_found", { status: 400, code: "invalid_review_target" }],
    ["review_question_not_found", { status: 400, code: "invalid_review_answer" }],
    ["review_question_option_not_found", { status: 400, code: "invalid_review_answer" }],
    ["review_snapshot_mismatch", { status: 409, code: "review_snapshot_mismatch" }],
    ["review_snapshot_replacement_required", { status: 409, code: "review_snapshot_mismatch" }],
    ["desired_revision_mismatch", { status: 409, code: "desired_revision_mismatch" }],
    ["approval_not_available", { status: 400, code: "action_not_available" }],
    ["review_gate_incomplete", { status: 422, code: "review_gate_incomplete" }],
    ["invalid_open_timestamp", { status: 400, code: "invalid_request" }],
    ["invalid_open_chronology", { status: 400, code: "invalid_request" }],
    ["invalid_full_view_timestamp", { status: 400, code: "invalid_request" }],
    ["invalid_full_view_chronology", { status: 400, code: "invalid_request" }],
    ["invalid_decision_timestamp", { status: 400, code: "invalid_request" }],
    ["invalid_decision_chronology", { status: 400, code: "invalid_request" }]
  ]);
  return expected.get(message) ?? { status: 500, code: "request_failed" };
}

export async function startReviewServer(options: ReviewServerOptions): Promise<RunningReviewServer> {
  const google = new GoogleBridge(options.googleRoot ?? join(dirname(options.trackerPath), ".google-local"));
  const decorate = (html: string, version = "") => withWorkflowControls(html, options.tasks?.mode, version);
  const workflow = async () => {
    const [review, tracker, jobs, tasks] = await Promise.all([
      readReviewBatch(options.reviewPath), readApplicationTracker(options.trackerPath), readJobLibrary(options.jobsPath), options.tasks?.list() ?? []
    ]);
    const status = buildStatusView(tracker.applications, jobs, { review, tasks, mode: options.tasks?.mode });
    const states = new Map(status.filter(item => item.applicationId).map(item => [item.applicationId!, item.status]));
    const activeReview = { ...review, applications: review.applications.filter(item => {
      const state = states.get(item.applicationId);
      // Untracked legacy review batches remain readable; known records must be ready and active.
      return !tracker.applications.some(record => record.applicationId === item.applicationId) || (state !== undefined && ["in_review", "submitting", "submission_failed"].includes(state));
    }) };
    const version = createHash("sha256").update(JSON.stringify({ status: status.map(item => [item.jobId, item.status, item.preparationNeedsRetry === true]), review: activeReview.applications.map(item => [item.applicationId, item.snapshotId, item.decision.state]) })).digest("hex");
    return { review: activeReview, tracker, tasks, status, states, version };
  };
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    try {
      if (googleRoutes.has(url.pathname)) {
        const address = server.address();
        if (!address || typeof address === "string") throw new Error("request_failed");
        await google.proxy(request, response, `http://127.0.0.1:${address.port}`);
        return;
      }
      if (request.method === "GET" && url.pathname === "/settings/accounts") {
        send(response, 200, renderAccountPage(), "text/html; charset=utf-8"); return;
      }
      if (request.method === "GET" && url.pathname === "/") {
        const applications = (await readApplicationTracker(options.trackerPath)).applications;
        let interviews: Awaited<ReturnType<typeof readInterviewBoard>> = [];
        try { interviews = await readInterviewBoard({ trackerPath: options.trackerPath, profilePath: options.profilePath ?? join(dirname(options.trackerPath), "candidate.json") }); } catch { /* Candidate-free legacy runtimes still expose navigation and account setup. */ }
        send(response, 200, renderHomePage({ applications: applications.length,
          interviews: interviews.filter(i => ["invited", "scheduled"].includes(i.entry.state)).length,
          pendingPlans: interviews.filter(i => i.snapshot?.proposal?.status === "awaiting_plan_approval").length,
          practiceReady: interviews.filter(i => i.snapshot?.freshness === "current" && i.snapshot.materials).length }), "text/html; charset=utf-8"); return;
      }
      if (request.method === "GET" && url.pathname === "/interviews") {
        const items = await readInterviewBoard({ trackerPath: options.trackerPath,
          profilePath: options.profilePath ?? join(dirname(options.trackerPath), "candidate.json") });
        send(response, 200, renderInterviewPage(items, url.searchParams.get("interview") ?? undefined,
          url.searchParams.get("view") ?? "overview", url.searchParams.get("filter") ?? "all"), "text/html; charset=utf-8");
        return;
      }
      if (request.method === "GET" && url.pathname === "/review") {
        const view = await workflow();
        send(response, 200, decorate(renderReviewPage(view.review, url.searchParams.get("application") ?? undefined, [], view.states, view.status.flatMap(item => item.applicationId ? [item.applicationId] : [])), view.version), "text/html; charset=utf-8");
        return;
      }
      if (request.method === "GET" && url.pathname === "/status") {
        redirect(response, "/status/us");
        return;
      }
      if (request.method === "GET" && url.pathname === "/status/us") {
        try {
          const view = await workflow();
          send(response, 200, decorate(renderUsStatusPage(view.status), view.version), "text/html; charset=utf-8");
        } catch {
          send(response, 500, JSON.stringify({ ok: false, error: "request_failed" }), "application/json; charset=utf-8");
        }
        return;
      }
      if (request.method === "GET" && url.pathname === "/status/china") {
        redirect(response, "/status/us");
        return;
      }
      if (request.method === "POST" && browserMutationPaths.has(url.pathname)) {
        const address = server.address();
        if (!address || typeof address === "string") throw new Error("request_failed");
        assertBrowserMutationAuthority(request, address.port);
      }
      if (request.method === "GET" && url.pathname === "/api/tasks") {
        const { tasks, review, tracker, version } = await workflow();
        const approvals = review.applications.filter(item => {
          const record = tracker.applications.find(a => a.applicationId === item.applicationId);
          return item.decision.state === "approved" && item.decision.scope === "content-only" &&
            record?.status === "in_review" && !record.hiddenFromStatus && !tasks.some(task =>
              task.target.jobId === record.jobId && (
                ["queued", "running"].includes(task.state) ||
                (task.action === "submit" && task.mode === options.tasks?.mode && (
                  (task.target.snapshotId === item.snapshotId && ["completed", "demo_complete"].includes(task.state)) ||
                  (task.mode === "codex" && (task.attemptedAt || task.state === "interrupted"))
                ))
              ));
        }).map(item => ({ applicationId: item.applicationId, snapshotId: item.snapshotId, revision: item.desiredState?.revision ?? 0 }));
        const reviewCount = review.applications.filter(item => {
          const record = tracker.applications.find(a => a.applicationId === item.applicationId);
          return record?.status === "in_review" && !record.hiddenFromStatus &&
            (item.decision.state === "pending" || (item.decision.state === "stale" && item.reviewStage === "questions"));
        }).length;
        send(response, 200, JSON.stringify({ mode: options.tasks?.mode ?? "unavailable", tasks, approvals, reviewCount, viewVersion: version }), "application/json; charset=utf-8");
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/tasks") {
        if (!options.tasks) throw new Error("runner_unavailable");
        const tasks = await options.tasks.enqueue(await readJson(request, true));
        send(response, 202, JSON.stringify({ tasks }), "application/json; charset=utf-8");
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/review/reopen") {
        const body = await readJson(request, true);
        exactFields(body, ["applicationId", "snapshotId"]);
        const applicationId = stringField(body, "applicationId");
        const active = await options.tasks?.list();
        if (active?.some(t => t.target.applicationId === applicationId && ["queued", "running"].includes(t.state))) throw new Error("task_already_active");
        const item = await reopenReviewContent(options.reviewPath, applicationId, stringField(body, "snapshotId"));
        send(response, 200, JSON.stringify({ applicationId: item.applicationId }), "application/json; charset=utf-8");
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/review/generated-answer") {
        const body = await readJson(request, true);
        exactFields(body, ["applicationId", "snapshotId", "answerIndex", "value", "expectedRevision"]);
        if (typeof body.value !== "string" || !Number.isSafeInteger(body.answerIndex) || !Number.isSafeInteger(body.expectedRevision)) throw new Error("invalid_request");
        const item = await saveGeneratedAnswer(options.reviewPath, stringField(body, "applicationId"), stringField(body, "snapshotId"), body.answerIndex as number, body.value, body.expectedRevision as number);
        send(response, 200, JSON.stringify({ applicationId: item.applicationId, snapshotId: item.snapshotId, answerIndex: body.answerIndex, value: item.answers[body.answerIndex as number]!.value, desiredState: item.desiredState }), "application/json; charset=utf-8");
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/review/text") {
        const body = await readJson(request, true);
        exactFields(body, ["applicationId", "snapshotId", "questionId", "value", ...(body.expectedRevision === undefined ? [] : ["expectedRevision"])]);
        if (body.expectedRevision !== undefined && (!Number.isSafeInteger(body.expectedRevision) || (body.expectedRevision as number) < 0)) throw new Error("invalid_request");
        if (typeof body.value !== "string") throw new Error("invalid_request");
        const item = await saveQuestionText(options.reviewPath, stringField(body, "applicationId"), stringField(body, "snapshotId"), stringField(body, "questionId"), body.value, body.expectedRevision as number | undefined);
        const question = item.questions.find((candidate) => candidate.id === body.questionId)!;
        send(response, 200, JSON.stringify({ applicationId: item.applicationId, snapshotId: item.snapshotId, questionId: question.id, value: question.draftAnswer,
          missingText: item.questions.some(q => q.required && !q.options && !(q.draftAnswer?.trim() || q.resolution)),
          desiredState: item.desiredState, reviewReady: item.decision.state === "pending" && item.cv.verified && item.snapshotCurrent && item.validationErrors.length === 0 && item.questions.every((q) => !q.required || Boolean(q.options ? q.selectedOptionId : (q.draftAnswer?.trim() || q.resolution)))
        }), "application/json; charset=utf-8");
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/review/answer") {
        const body = await readJson(request, true);
        exactFields(body, ["applicationId", "snapshotId", "questionId", "optionId", ...(body.expectedRevision === undefined ? [] : ["expectedRevision"])]);
        if (body.expectedRevision !== undefined && (!Number.isSafeInteger(body.expectedRevision) || (body.expectedRevision as number) < 0)) throw new Error("invalid_request");
        const applicationId = stringField(body, "applicationId");
        const snapshotId = stringField(body, "snapshotId");
        const questionId = stringField(body, "questionId");
        const optionId = stringField(body, "optionId");
        const item = await selectQuestionOption(
          options.reviewPath,
          applicationId,
          snapshotId,
          questionId,
          optionId,
          body.expectedRevision as number | undefined
        );
        const question = item.questions.find((candidate) => candidate.id === questionId);
        if (!question?.selectedOptionId || !item.desiredState) throw new Error("request_failed");
        send(response, 200, JSON.stringify({
          applicationId: item.applicationId,
          snapshotId: item.snapshotId,
          questionId: question.id,
          selectedOptionId: question.selectedOptionId,
          reviewReady: item.decision.state === "pending" && item.cv.verified && item.snapshotCurrent && item.validationErrors.length === 0 && item.questions.every((q) => !q.required || Boolean(q.options ? q.selectedOptionId : (q.draftAnswer?.trim() || q.resolution))),
          desiredState: {
            revision: item.desiredState.revision,
            syncState: item.desiredState.syncState
          }
        }), "application/json; charset=utf-8");
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/review/content-approval") {
        const body = await readJson(request);
        exactFields(body, body.expectedDesiredRevision === undefined
          ? ["applicationId", "snapshotId"] : ["applicationId", "snapshotId", "expectedDesiredRevision"]);
        if (body.expectedDesiredRevision !== undefined && (!Number.isSafeInteger(body.expectedDesiredRevision) || (body.expectedDesiredRevision as number) < 1)) throw new Error("invalid_request");
        const item = await approveReviewContent(options.reviewPath, stringField(body, "applicationId"), stringField(body, "snapshotId"), body.expectedDesiredRevision as number | undefined);
        send(response, 200, JSON.stringify({ ok: true, applicationId: item.applicationId, snapshotId: item.snapshotId, decision: item.decision }), "application/json; charset=utf-8");
        return;
      }
      if (request.method === "POST" && browserMutationPaths.has(url.pathname)) {
        const body = await readJson(request);
        const applicationId = stringField(body, "applicationId");
        const snapshotId = stringField(body, "snapshotId");
        if (url.pathname === "/api/review/open") await markOpened(options.reviewPath, applicationId, snapshotId);
        else if (url.pathname === "/api/review/viewed") await markFullContentsViewed(options.reviewPath, applicationId, snapshotId);
        else {
          const decision = stringField(body, "decision");
          if (decision !== "approved") throw new Error("invalid_request");
          const expectedDesiredRevision = body.expectedDesiredRevision;
          exactFields(body, expectedDesiredRevision === undefined
            ? ["applicationId", "snapshotId", "decision"]
            : ["applicationId", "snapshotId", "decision", "expectedDesiredRevision"]);
          if (
            expectedDesiredRevision !== undefined &&
            (!Number.isSafeInteger(expectedDesiredRevision) || (expectedDesiredRevision as number) < 1)
          ) throw new Error("invalid_request");
          await decideReview(
            options.reviewPath,
            applicationId,
            snapshotId,
            "approved",
            undefined,
            expectedDesiredRevision as number | undefined
          );
        }
        send(response, 200, JSON.stringify({ ok: true }), "application/json; charset=utf-8");
        return;
      }
      send(response, 404, "not_found");
    } catch (error) {
      const mapped = publicError(error);
      if (mapped.status === 413) response.shouldKeepAlive = false;
      send(response, mapped.status, JSON.stringify({ ok: false, error: mapped.code }), "application/json; charset=utf-8");
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address() as AddressInfo;
  return {
    address: `http://127.0.0.1:${address.port}`,
    close: () => { google.close(); return new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
  };
}
