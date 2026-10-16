import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { readFile, writeFile, copyFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { initializeRuntime } from "../runtime.js";
import { upsertJob } from "../jobs/jobLibrary.js";
import { createApplication, markSubmitted, readApplicationTracker } from "../tracker.js";
import { createReviewBatch, publishReviewItem, readReviewBatch, verifyDesiredStateApplied, consumeApproval, type ReviewItem } from "../review/reviewStore.js";
import { startReviewServer } from "../review/reviewServer.js";
import { pruneSubmittedDrafts } from "../storage/drafts.js";
import { runPreflight } from "../preflight.js";
import { formHtml } from "./form.js";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const jobUrl = "https://careers.example.com/jobs/demo";
const appId = "fictional-application";
const jobId = "fictional-role";
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
export async function startDemo(root: string) {
  const inputs = await initializeRuntime(root);
  for (const name of ["candidate.json", "preferences.md", "resumes.json", "alex-morgan-resume.pdf"]) {
    await copyFile(join(projectRoot, "examples", name), join(root, "data", name));
  }
  const candidate = JSON.parse(await readFile(join(root, "data/candidate.json"), "utf8"));
  if (candidate.fictional !== true) throw new Error("fictional_inputs_required");
  const checked = await runPreflight({ category: "llm", jobUrl, profilePath: join(root, "data/candidate.json"), manifestPath: join(root, "data/resumes.json") });
  const now = new Date().toISOString(), day = now.slice(0, 10);
  await upsertJob(inputs.jobsPath, { jobId, company: "Example Labs (fictional)", title: "Software Engineer - Demo", location: "Example City", category: "llm", officialUrl: jobUrl, sources: ["user-provided"], firstSeen: day, lastVerified: day, note: "Local fictional fixture only", status: "ready" });
  await createApplication(inputs.trackerPath, { applicationId: appId, jobId, company: "Example Labs (fictional)", title: "Software Engineer - Demo", location: "Example City", category: "llm", jobUrl, applicationUrl: jobUrl + "/apply", ats: "long-tail", cvFilename: "alex-morgan-resume.pdf" });
  const item: ReviewItem = { applicationId: appId, company: "Example Labs (fictional)", title: "Software Engineer - Demo", location: "Example City", category: "llm", ats: "long-tail", officialUrl: jobUrl, applicationUrl: jobUrl + "/apply", cv: { filename: "alex-morgan-resume.pdf", verified: false }, snapshotId: "fixture-unprepared", snapshotCurrent: false, reviewStage: "questions", answers: [], consents: [], questions: [{ id: "relocation", prompt: "Are you willing to relocate for this fictional role?", required: true, options: [{ id: "yes", label: "Yes" }, { id: "no", label: "No" }] }], validationErrors: [], friction: [], preparedAt: now, decision: { state: "pending" } };
  await createReviewBatch(inputs.reviewPath, { schemaVersion: 1, batchId: "fictional-demo", createdAt: now, applications: [item] });
  const review = await startReviewServer({ ...inputs, port: 0 });
  let fixturePort = 0;
  let busy = false;
  const fixture = createServer(async (req, res) => {
    const send = (status: number, body: unknown) => { res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" }); res.end(JSON.stringify(body)); };
    if (req.headers.host !== `127.0.0.1:${fixturePort}`) { send(403, { error: "invalid_host" }); return; }
    if (req.method === "GET" && req.url === "/") { res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }); res.end(formHtml(review.address)); return; }
    if (req.method !== "POST" || !["/prepare", "/submit"].includes(req.url ?? "")) { send(404, { error: "not_found" }); return; }
    if (req.headers.origin !== `http://127.0.0.1:${fixturePort}` || req.headers["content-type"] !== "application/json") { send(403, { error: "invalid_origin_or_type" }); return; }
    if (busy) { send(409, { error: "request_in_progress" }); return; }
    busy = true;
    try {
      let body = "";
      for await (const part of req) { body += part.toString(); if (body.length > 500_000) throw new Error("request_too_large"); }
      const data = JSON.parse(body);
      if (typeof data !== "object" || data === null || Object.keys(data).sort().join() !== ["name", "email", "summary", "relocation", "resumeName", "resumeBase64"].sort().join() || Object.values(data).some(v => typeof v !== "string")) throw new Error("invalid_form");
      if (data.name !== candidate.identity.fullName || data.email !== candidate.contact.email) throw new Error("candidate_facts_mismatch");
      if (!data.summary.trim() || data.summary.length > 2000) throw new Error("summary_required");
      if (data.resumeName !== "alex-morgan-resume.pdf" || hash(Buffer.from(data.resumeBase64, "base64")) !== checked.cvSha256) throw new Error("resume_mismatch");
      if (!["", "yes", "no"].includes(data.relocation)) throw new Error("invalid_relocation");
      const application = (await readApplicationTracker(inputs.trackerPath)).applications[0]!;
      if (["submitted", "confirmed"].includes(application.status)) throw new Error("already_submitted");
      const current = (await readReviewBatch(inputs.reviewPath)).applications[0]!;
      const revision = current.desiredState?.revision ?? null;
      if (req.url === "/prepare") {
        if (current.decision.state !== "pending") throw new Error("review_already_decided");
        const preparedAt = new Date().toISOString();
        await publishReviewItem(inputs.reviewPath, { ...item, snapshotId: `sha256:${hash(JSON.stringify(data) + preparedAt)}`, snapshotCurrent: true, reviewStage: "final", preparedAt, cv: { filename: data.resumeName, verified: true }, answers: [{ label: "Full name", value: data.name, kind: "deterministic", source: "Canonical fictional candidate" }, { label: "Email", value: data.email, kind: "deterministic", source: "Canonical fictional candidate" }, { label: "Why this role?", value: data.summary, kind: "generated" }], questions: current.questions }, { snapshotId: current.snapshotId, revision, decision: current.decision.state });
        send(200, { message: "Prepared. Open Review, answer relocation and approve the fictional application.", reviewUrl: review.address + "/review" });
        return;
      }
      if (current.decision.state !== "approved" || !current.desiredState) throw new Error("approval_required");
      if (current.questions[0]?.selectedOptionId !== data.relocation || !data.relocation || current.answers.find(a => a.label === "Why this role?")?.value !== data.summary) throw new Error("approved_content_mismatch");
      const liveSnapshot = `sha256:${hash(JSON.stringify(data) + new Date().toISOString())}`;
      await verifyDesiredStateApplied(inputs.reviewPath, appId, current.snapshotId, current.desiredState.revision, liveSnapshot);
      await consumeApproval(inputs.reviewPath, appId, current.snapshotId);
      // This server is the fictional employer. Its receipt is local simulation evidence only.
      const receivedAt = new Date().toISOString();
      await writeFile(join(root, "data/demo-receipt.json"), JSON.stringify({ fictional: true, applicationId: appId, receivedAt, message: "Fictional application received" }, null, 2), { flag: "wx", mode: 0o600 });
      await markSubmitted(inputs.trackerPath, appId, { applicationId: appId, snapshotId: current.snapshotId, approvalConsumed: true, visibleResult: "submitted", authorization: { source: "website", reference: "Local fictional Review approval", approvedAt: current.decision.decidedAt }, evidence: { source: "official_page", reference: "LOCAL SIMULATION ONLY: demo-receipt.json", verifiedAt: receivedAt } }, receivedAt);
      await pruneSubmittedDrafts(inputs.reviewPath);
      send(200, { message: "Fictional application received. No employer was contacted.", statusUrl: review.address + "/status/us" });
    } catch (error) { send(409, { error: error instanceof Error ? error.message : "demo_failed" }); }
    finally { busy = false; }
  });
  try { await new Promise<void>((resolve, reject) => { fixture.once("error", reject); fixture.listen(0, "127.0.0.1", resolve); }); }
  catch (error) { await review.close(); throw error; }
  const address = fixture.address(); if (!address || typeof address === "string") throw new Error("listen_failed"); fixturePort = address.port;
  return { root, reviewUrl: review.address + "/review", statusUrl: review.address + "/status/us", formUrl: `http://127.0.0.1:${fixturePort}/`, async close() { await new Promise<void>((resolve, reject) => fixture.close(error => error ? reject(error) : resolve())); await review.close(); } };
}
