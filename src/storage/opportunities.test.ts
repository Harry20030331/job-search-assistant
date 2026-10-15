import { mkdtemp, mkdir, readFile, rm, writeFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { upsertJob, closeJob, readJobLibrary } from "../jobs/jobLibrary.js";
import { createApplication, markSubmitted, readApplicationTracker, setStatusVisibility, migrateApplicationTracker } from "../tracker.js";
import { createReviewBatch, readReviewBatch, selectQuestionOption, consumeApproval, publishReviewItem, type ReviewItem } from "../review/reviewStore.js";
import { readOpportunities, saveOpportunities } from "./opportunities.js";
import { pruneSubmittedDrafts } from "./drafts.js";
import { convertLegacy } from "./migration.js";
import { startReviewServer } from "../review/reviewServer.js";
import { completeScan, readDiscovery } from "./discovery.js";
const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(path => rm(path, { recursive: true, force: true }))); });
async function setup() {
  const root = await mkdtemp(join(tmpdir(), "opportunities-")); roots.push(root);
  const path = join(root, "opportunities.json"), drafts = join(root, "drafts");
  await mkdir(drafts, { mode: 0o700 });
  await saveOpportunities(path, { schemaVersion: 1, opportunities: [] });
  const job = { jobId: "job/one", company: "Example", title: "Software Engineer", location: "San Francisco", category: "llm" as const,
    officialUrl: "https://example.com/jobs/one", sources: ["user-provided" as const], firstSeen: "2026-10-14", lastVerified: "2026-10-14", note: "", status: "ready" as const };
  await upsertJob(path, job);
  await createApplication(path, { jobId: job.jobId, applicationId: "application-one", company: job.company, title: job.title,
    location: job.location, category: job.category, ats: "ashby", jobUrl: job.officialUrl, applicationUrl: job.officialUrl + "/apply", cvFilename: "approved.pdf" }, "2026-10-14T00:00:00Z");
  const item: ReviewItem = { applicationId: "application-one", company: job.company, title: job.title, location: job.location,
    category: job.category, ats: "ashby", officialUrl: job.officialUrl, applicationUrl: job.officialUrl + "/apply", cv: { filename: "approved.pdf", verified: true },
    snapshotId: "snapshot-one", snapshotCurrent: true, answers: [], consents: [], questions: [{ id: "choice", prompt: "Example?", required: true, options: [{ id: "yes", label: "Yes" }, { id: "no", label: "No" }] }],
    validationErrors: [], friction: [], preparedAt: "2026-10-14T01:00:00Z", decision: { state: "pending" } };
  await createReviewBatch(drafts, { schemaVersion: 1, batchId: "test", createdAt: item.preparedAt, applications: [item] });
  return { root, path, drafts, job, item };
}
test("matching and submission share identity and preserve submitted status when a vacancy closes", async () => {
  const { path, job } = await setup();
  await markSubmitted(path, "application-one", { applicationId: "application-one", snapshotId: "snapshot-one", approvalConsumed: true, visibleResult: "submitted", authorization: { source: "chat", reference: "Test user approval", approvedAt: "2026-10-14T02:00:00Z" }, evidence: { source: "official_page", reference: "Application received", verifiedAt: "2026-10-15T00:00:00Z" } }, "2026-10-15T00:00:00Z");
  await closeJob(path, job.jobId, "2026-10-15", "Official role closed");
  expect((await readApplicationTracker(path)).applications[0]!.status).toBe("submitted");
  const stored = (await readOpportunities(path)).opportunities[0]!;
  expect(stored.stage).toBe("submitted"); expect(stored.availability).toBe("closed");
  expect(stored.application).not.toHaveProperty("company"); expect(stored.application).not.toHaveProperty("status");
  expect((await readJobLibrary(path))[0]!.status).toBe("closed");
});
test("concurrent matching, visibility and draft writes preserve all changes", async () => {
  const { path, job, drafts } = await setup();
  await Promise.all([
    upsertJob(path, { ...job, note: "new evidence" }),
    setStatusVisibility(path, "application-one", false),
    selectQuestionOption(drafts, "application-one", "snapshot-one", "choice", "yes")
  ]);
  const item = (await readOpportunities(path)).opportunities[0]!;
  expect(item.note).toBe("new evidence"); expect(item.application?.hiddenFromStatus).toBe(true);
  expect((await readReviewBatch(drafts)).applications[0]!.questions[0]!.selectedOptionId).toBe("yes");
  const names = await readdir(drafts);
  expect(names).toEqual(["job%2Fone.json"]);
  const raw = JSON.parse(await readFile(join(drafts, names[0]!), "utf8"));
  expect(raw).not.toHaveProperty("company"); expect(raw).not.toHaveProperty("applicationId");
});
test("cleanup retains unsubmitted drafts and removes working answers only after durable success", async () => {
  const { path, drafts } = await setup();
  expect(await pruneSubmittedDrafts(drafts)).toEqual([]);
  await markSubmitted(path, "application-one", { applicationId: "application-one", snapshotId: "snapshot-one", approvalConsumed: true, visibleResult: "submitted", authorization: { source: "chat", reference: "Test user approval", approvedAt: "2026-10-14T02:00:00Z" }, evidence: { source: "official_page", reference: "Application received", verifiedAt: "2026-10-15T00:00:00Z" } }, "2026-10-15T00:00:00Z");
  expect(await pruneSubmittedDrafts(drafts)).toEqual(["job/one"]);
  expect((await readReviewBatch(drafts)).applications).toEqual([]);
  expect((await readOpportunities(path)).opportunities[0]!.application?.submittedAt).toBe("2026-10-15T00:00:00Z");
});
test("rejects identity replacement after an application has started", async () => {
  const { path, job } = await setup();
  const before = await readFile(path, "utf8");
  await expect(upsertJob(path, { ...job, title: "Different job" })).rejects.toThrow("opportunity_identity_mismatch");
  expect(await readFile(path, "utf8")).toBe(before);
});
test("migration preserves orphaned applications, success evidence and hidden state", async () => {
  const { path } = await setup();
  await setStatusVisibility(path, "application-one", false);
  const records = (await readApplicationTracker(path)).applications;
  const migrated = convertLegacy([], records);
  expect(migrated.opportunities).toHaveLength(1);
  expect(migrated.opportunities[0]!.application?.hiddenFromStatus).toBe(true);
  expect(migrated.opportunities[0]!.stage).toBe("in_review");
});
test("only completed scans advance checkpoints and unrelated sources survive concurrent updates", async () => {
  const { root } = await setup(); const path = join(root, "discovery-state.json");
  await writeFile(path, JSON.stringify({ version: 1, sources: {} }));
  await expect(completeScan(path, "one", "2026-10-15T00:00:00Z", false)).rejects.toThrow();
  expect((await readDiscovery(path)).sources).toEqual({});
  await Promise.all([completeScan(path, "one", "2026-10-15T00:00:00Z", true), completeScan(path, "two", "2026-10-15T01:00:00Z", true)]);
  expect(Object.keys((await readDiscovery(path)).sources).sort()).toEqual(["one", "two"]);
  await expect(completeScan(path, "one", "2026-10-14T00:00:00Z", true)).rejects.toThrow("checkpoint_cannot_regress");
});

test("changing a canonical application URL invalidates the draft binding until a fresh snapshot is published", async () => {
  const { path, drafts, item } = await setup();
  await migrateApplicationTracker(path, { "application-one": "https://example.com/jobs/one/new-application" });
  const changed = (await readReviewBatch(drafts)).applications[0]!;
  expect(changed.snapshotCurrent).toBe(false);
  await expect(consumeApproval(drafts, item.applicationId, item.snapshotId)).rejects.toThrow();
  await publishReviewItem(drafts, { ...item, applicationUrl: changed.applicationUrl, snapshotId: "replacement" }, { snapshotId: item.snapshotId, revision: null, decision: "pending" });
  expect((await readReviewBatch(drafts)).applications[0]!.snapshotCurrent).toBe(true);
});
test("canonical submission requires both real authorization and success provenance", async () => {
  const { path } = await setup();
  await expect(markSubmitted(path, "application-one", { applicationId: "application-one", snapshotId: "snapshot-one", approvalConsumed: true, visibleResult: "submitted" })).rejects.toThrow("submission_provenance_required");
  expect((await readOpportunities(path)).opportunities[0]!.stage).toBe("in_review");
});
test("unchanged HTTP review controls save and approve a canonical per-job draft without submitting it", async () => {
  const { path, drafts } = await setup();
  const server = await startReviewServer({ reviewPath: drafts, trackerPath: path, jobsPath: path, port: 0 });
  const identity = { applicationId: "application-one", snapshotId: "snapshot-one" };
  const post = (route: string, fields: object) => fetch(server.address + route, { method: "POST", headers: { "content-type": "application/json", origin: server.address }, body: JSON.stringify({ ...identity, ...fields }) });
  try {
    expect((await fetch(server.address + "/review")).status).toBe(200);
    expect((await post("/api/review/answer", { questionId: "choice", optionId: "yes" })).status).toBe(200);
    expect((await post("/api/review/open", {})).status).toBe(200);
    expect((await post("/api/review/viewed", {})).status).toBe(200);
    expect((await post("/api/review/decision", { decision: "approved", expectedDesiredRevision: 1 })).status).toBe(200);
    const item = (await readReviewBatch(drafts)).applications[0]!;
    expect(item.decision.state).toBe("approved");
    expect(item.desiredState?.syncState).toBe("pending");
    expect((await readOpportunities(path)).opportunities[0]!.stage).toBe("in_review");
    expect(await pruneSubmittedDrafts(drafts)).toEqual([]);
  } finally { await server.close(); }
});
