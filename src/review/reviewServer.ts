import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import {
  decideReview,
  markFullContentsViewed,
  markOpened,
  readReviewBatch,
  selectQuestionOption,
  saveQuestionText
} from "./reviewStore.js";
import { readApplicationTracker } from "../tracker.js";
import { readJobLibrary } from "../jobs/jobLibrary.js";
import { renderReviewPage, renderUsStatusPage } from "./reviewViews.js";
import { buildStatusView } from "./statusView.js";

export interface ReviewServerOptions {
  reviewPath: string;
  trackerPath: string;
  jobsPath: string;
  chinaJobsPath?: string;
  chinaOutreachPath?: string;
  port: number;
}

export interface RunningReviewServer {
  address: string;
  close(): Promise<void>;
}

const maximumJsonBodyBytes = 65_536;
const browserMutationPaths = new Set([
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
    ["unsupported_media_type", { status: 415, code: "unsupported_media_type" }],
    ["body_too_large", { status: 413, code: "body_too_large" }],
    ["invalid_json", { status: 400, code: "invalid_json" }],
    ["invalid_request", { status: 400, code: "invalid_request" }],
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
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    try {
      if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/review")) {
        send(response, 200, renderReviewPage(await readReviewBatch(options.reviewPath), url.searchParams.get("application") ?? undefined, (await readApplicationTracker(options.trackerPath)).applications.filter((item) => ["submitted", "confirmed", "interviewing", "offer"].includes(item.status)).map((item) => item.applicationId)), "text/html; charset=utf-8");
        return;
      }
      if (request.method === "GET" && url.pathname === "/status") {
        redirect(response, "/status/us");
        return;
      }
      if (request.method === "GET" && url.pathname === "/status/us") {
        try {
          const [tracker, jobs] = await Promise.all([
            readApplicationTracker(options.trackerPath),
            readJobLibrary(options.jobsPath)
          ]);
          send(response, 200, renderUsStatusPage(buildStatusView(tracker.applications, jobs)), "text/html; charset=utf-8");
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
      if (request.method === "POST" && url.pathname === "/api/review/text") {
        const body = await readJson(request, true);
        exactFields(body, ["applicationId", "snapshotId", "questionId", "value"]);
        if (typeof body.value !== "string") throw new Error("invalid_request");
        const item = await saveQuestionText(options.reviewPath, stringField(body, "applicationId"), stringField(body, "snapshotId"), stringField(body, "questionId"), body.value);
        const question = item.questions.find((candidate) => candidate.id === body.questionId)!;
        send(response, 200, JSON.stringify({ applicationId: item.applicationId, snapshotId: item.snapshotId, questionId: question.id, value: question.draftAnswer,
          desiredState: item.desiredState, reviewReady: item.decision.state === "pending" && item.cv.verified && item.snapshotCurrent && item.validationErrors.length === 0 && item.questions.every((q) => !q.required || Boolean(q.options ? q.selectedOptionId : (q.draftAnswer?.trim() || q.resolution)))
        }), "application/json; charset=utf-8");
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/review/answer") {
        const body = await readJson(request, true);
        exactFields(body, ["applicationId", "snapshotId", "questionId", "optionId"]);
        const applicationId = stringField(body, "applicationId");
        const snapshotId = stringField(body, "snapshotId");
        const questionId = stringField(body, "questionId");
        const optionId = stringField(body, "optionId");
        const item = await selectQuestionOption(
          options.reviewPath,
          applicationId,
          snapshotId,
          questionId,
          optionId
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
    close: () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  };
}
