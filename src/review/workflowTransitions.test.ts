import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, expect, test } from "vitest";
import { saveOpportunities } from "../storage/opportunities.js";
import { upsertJob, readJobLibrary } from "../jobs/jobLibrary.js";
import { createApplication, readApplicationTracker } from "../tracker.js";
import { approveReviewContent, readReviewBatch, reopenReviewContent, saveQuestionText } from "./reviewStore.js";
import { ApplicationTaskService, claimChatTask, finishChatTask, demoTaskExecutor, runDemoChatTask, type TaskPaths } from "./applicationTasks.js";
import { buildStatusView } from "./statusView.js";
import { startReviewServer, type RunningReviewServer } from "./reviewServer.js";

const roots: string[] = [], services: ApplicationTaskService[] = [], servers: RunningReviewServer[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => server.close()));
  await Promise.all(services.splice(0).map(service => service.close()));
  await Promise.all(roots.splice(0).map(path => rm(path, { recursive: true, force: true })));
});
async function fixture(failPreparation = false) {
  const root = await mkdtemp(join(tmpdir(), "workflow-transitions-")); roots.push(root);
  const path = join(root, "opportunities.json"), drafts = join(root, "drafts");
  await mkdir(drafts); await saveOpportunities(path, { schemaVersion: 1, opportunities: [] });
  const job = { jobId: "transition-test", company: "Example Labs", title: "Engineer", location: "Remote, US", category: "llm" as const, officialUrl: "https://example.com/job", sources: ["user-provided" as const], firstSeen: "2026-10-30", lastVerified: "2026-10-30", status: "ready" as const, note: "Fictional" };
  await upsertJob(path, job);
  const paths: TaskPaths = { reviewPath: drafts, trackerPath: path, jobsPath: path, taskPath: join(root, "application-tasks.json") };
  const threadId = randomUUID();
  const service = new ApplicationTaskService(paths, "demo", demoTaskExecutor, { threadId, send: async () => randomUUID() }); services.push(service); await service.start();
  const server = await startReviewServer({ ...paths, port: 0, tasks: service }); servers.push(server);
  const view = async () => buildStatusView((await readApplicationTracker(path)).applications, await readJobLibrary(path), { review: await readReviewBatch(drafts), tasks: await service.list(), mode: "demo" });
  const get = async (route: string) => (await fetch(server.address + route)).text();
  const apply = () => service.enqueue({ action: "prepare", mode: "demo", requestId: randomUUID(), jobIds: [job.jobId] });
  if (failPreparation) await createApplication(path, { applicationId: "partial-application", jobId: job.jobId, company: job.company, title: job.title, location: job.location, category: job.category, ats: "long-tail", jobUrl: job.officialUrl, applicationUrl: job.officialUrl, cvFilename: "demo-resume.pdf" });
  return { root, path, paths, drafts, threadId, service, server, view, get, apply };
}
async function approve(f: Awaited<ReturnType<typeof fixture>>) {
  let item = (await readReviewBatch(f.drafts)).applications[0]!;
  item = await saveQuestionText(f.drafts, item.applicationId, item.snapshotId, "demo-motivation", "Fictional answer", 0);
  item = await saveQuestionText(f.drafts, item.applicationId, item.snapshotId, "demo-start", "June 2027", 1);
  return approveReviewContent(f.drafts, item.applicationId, item.snapshotId, 2);
}

test("canonical storage: Apply leaves the shortlist, saves a matching draft, then enters Review", async () => {
  const f = await fixture();
  expect((await f.view())[0]!.status).toBe("shortlisted");
  const [task] = await f.apply();
  expect((await f.view())[0]!.status).toBe("preparing");
  expect(await f.get("/review")).not.toContain('data-application="');
  const result = await runDemoChatTask(f.paths, task!.id, f.threadId);
  expect(result.state).toBe("needs_review");
  const draft = (await readReviewBatch(f.drafts)).applications[0]!;
  expect(draft.applicationUrl).toBe("https://example.com/job");
  expect((await f.view())[0]!.status).toBe("in_review");
  expect(await f.get("/review")).toContain(`data-application="${draft.applicationId}"`);
});

test("partial preparation without a draft stays out of Review and can be retried without creating another identity", async () => {
  const f = await fixture(true);
  expect((await f.view())[0]!.status).toBe("shortlisted");
  expect(await f.get("/status/us")).toContain('class="job-select"');
  expect(await f.get("/review")).not.toContain('data-application="partial-application"');
  const [task] = await f.apply();
  expect((await runDemoChatTask(f.paths, task!.id, f.threadId)).state).toBe("needs_review");
  expect((await readApplicationTracker(f.path)).applications.map(item => item.applicationId)).toEqual(["partial-application"]);
  expect((await f.view())[0]!.status).toBe("in_review");
});

test("an unsuccessful preparation stays shortlisted and a fresh retry clears its hint without replaying history", async () => {
  const f = await fixture(true);
  expect((await f.view())[0]!.preparationNeedsRetry).toBeUndefined();
  const [first] = await f.apply();
  await claimChatTask(f.paths, first!.id, f.threadId);
  await finishChatTask(f.paths, first!.id, f.threadId, "blocked", "draft_identity_mismatch");
  expect((await f.view())[0]).toMatchObject({ status: "shortlisted", preparationNeedsRetry: true });
  const page = await f.get("/status/us");
  expect(page).toContain('class="job-select"');
  expect(page).toContain("Apply again to prepare.");
  expect(page).not.toContain("Preparation failed");
  expect(await f.get("/review")).not.toContain('data-application="partial-application"');
  await expect(runDemoChatTask(f.paths, first!.id, f.threadId)).rejects.toThrow("chat_task_unavailable");
  const [retry] = await f.apply();
  expect(retry!.id).not.toBe(first!.id);
  expect((await f.view())[0]).toMatchObject({ status: "preparing" });
  expect((await f.view())[0]!.preparationNeedsRetry).toBeUndefined();
  expect((await runDemoChatTask(f.paths, retry!.id, f.threadId)).state).toBe("needs_review");
  expect((await f.view())[0]!.status).toBe("in_review");
  expect(await f.get("/status/us")).not.toContain("Apply again to prepare.");
  expect((await f.service.list()).find(task => task.id === first!.id)?.state).toBe("blocked");
  expect((await readApplicationTracker(f.path)).applications.map(item => item.applicationId)).toEqual(["partial-application"]);
});

test("approval stays in Review; submission locks edits; completed rehearsal leaves Review without fabricated submission", async () => {
  const f = await fixture(); const [prepare] = await f.apply(); await runDemoChatTask(f.paths, prepare!.id, f.threadId);
  const draft = await approve(f);
  expect(await f.get("/review")).toContain(`data-application="${draft.applicationId}"`);
  const [submit] = await f.service.enqueue({ action: "submit", mode: "demo", requestId: randomUUID(), selections: [{ applicationId: draft.applicationId, snapshotId: draft.snapshotId, revision: 2 }] });
  expect((await f.view())[0]!.status).toBe("submitting");
  const submitting = await f.get("/review");
  expect(submitting).toContain('disabled class="reopen-content"'); expect(submitting).toContain("Submitting…");
  const before = JSON.parse(await f.get("/api/tasks")); expect(before.approvals).toEqual([]);
  await runDemoChatTask(f.paths, submit!.id, f.threadId);
  expect((await f.view())[0]!.status).toBe("rehearsal_complete");
  await expect(f.service.enqueue({ action: "submit", mode: "demo", requestId: randomUUID(), selections: [{ applicationId: draft.applicationId, snapshotId: draft.snapshotId, revision: 2 }] })).rejects.toThrow("task_target_unavailable");
  const completed = await f.get("/review");
  expect(completed).not.toContain(`data-application="${draft.applicationId}"`); expect(completed).toContain("No applications pending review");
  expect(await f.get("/status/us")).toContain('<span class="row-status">Submitted</span>');
  expect(await f.get("/status/us")).toContain('data-status="submitted"');
  expect(JSON.parse(await f.get("/api/tasks")).viewVersion).not.toBe(before.viewVersion);
  expect((await readApplicationTracker(f.path)).applications[0]!.submissionEvidence).toBeUndefined();
  expect((await readReviewBatch(f.drafts)).applications).toHaveLength(1);
  await reopenReviewContent(f.drafts, draft.applicationId, draft.snapshotId);
  expect((await f.view())[0]!.status).toBe("in_review");
  expect(await f.get("/review")).toContain(`data-application="${draft.applicationId}"`);
});


test("failed submission remains in Review with an actionable failure state", async () => {
  const f = await fixture(); const [prepare] = await f.apply(); await runDemoChatTask(f.paths, prepare!.id, f.threadId);
  const draft = await approve(f);
  const [submit] = await f.service.enqueue({ action: "submit", mode: "demo", requestId: randomUUID(), selections: [{ applicationId: draft.applicationId, snapshotId: draft.snapshotId, revision: 2 }] });
  await claimChatTask(f.paths, submit!.id, f.threadId);
  await finishChatTask(f.paths, submit!.id, f.threadId, "blocked", "Fixture validation failure");
  expect((await f.view())[0]!.status).toBe("submission_failed");
  const page = await f.get("/review");
  expect(page).toContain(`data-application="${draft.applicationId}"`);
  expect(page).toContain("Submission failed"); expect(page).not.toContain('disabled class="reopen-content"');
});
