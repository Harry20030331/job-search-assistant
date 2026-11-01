import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, expect, test } from "vitest";
import { ApplicationTaskService, consumeWebsiteTask, demoTaskExecutor, claimChatTask, finishChatTask, runDemoChatTask, type ChatTaskDispatcher, type TaskExecutor, type TaskPaths } from "./applicationTasks.js";
import { approveReviewContent, createReviewBatch, publishReviewItem, readReviewBatch, reopenReviewContent, saveGeneratedAnswer, saveQuestionText } from "./reviewStore.js";
import { writeJobLibrary } from "../jobs/jobLibrary.js";
import { readApplicationTracker, markSubmitted } from "../tracker.js";
import { startReviewServer, type RunningReviewServer } from "./reviewServer.js";

const directories: string[] = [], services: ApplicationTaskService[] = [], servers: RunningReviewServer[] = [];
afterEach(async () => {
  await Promise.all(services.splice(0).map(s => s.close()));
  await Promise.all(servers.splice(0).map(s => s.close()));
  await Promise.all(directories.splice(0).map(d => rm(d, { recursive: true, force: true })));
});
async function fixture(mode: "demo" | "codex" = "demo", executor: TaskExecutor = demoTaskExecutor, chat?: ChatTaskDispatcher) {
  const directory = await mkdtemp(join(tmpdir(), "website-workflow-")); directories.push(directory);
  const paths: TaskPaths = { reviewPath: join(directory, "review.json"), trackerPath: join(directory, "tracker.json"), jobsPath: join(directory, "jobs.csv"), taskPath: join(directory, "tasks.json") };
  await writeFile(paths.trackerPath, JSON.stringify({ schemaVersion: 2, applications: [] }));
  await createReviewBatch(paths.reviewPath, { schemaVersion: 1, batchId: "website-test", createdAt: new Date().toISOString(), applications: [] });
  await writeJobLibrary(paths.jobsPath, [{ jobId: "example-1", company: "Example", title: "Engineer", location: "Remote, US", category: "llm", officialUrl: "https://example.com/job/1", sources: ["user-provided"], firstSeen: "2026-10-01", lastVerified: "2026-10-30", status: "ready", note: "Fictional test" }]);
  const service = new ApplicationTaskService(paths, mode, executor, chat); services.push(service); await service.start();
  const prepare = () => service.enqueue({ action: "prepare", mode, requestId: randomUUID(), jobIds: ["example-1"] });
  return { paths, service, prepare };
}
async function ready(f: Awaited<ReturnType<typeof fixture>>) {
  await f.prepare(); await f.service.idle();
  let item = (await readReviewBatch(f.paths.reviewPath)).applications[0]!;
  item = await saveQuestionText(f.paths.reviewPath, item.applicationId, item.snapshotId, "demo-motivation", "A fictional long answer.\nWith another paragraph.", 0);
  item = await saveQuestionText(f.paths.reviewPath, item.applicationId, item.snapshotId, "demo-start", "June 2027", 1);
  item = await approveReviewContent(f.paths.reviewPath, item.applicationId, item.snapshotId, 2);
  return { applicationId: item.applicationId, snapshotId: item.snapshotId, revision: 2 };
}

test("failed startup releases ownership and cannot later close a replacement runner", async () => {
  const f = await fixture(); await f.service.close();
  await writeFile(f.paths.taskPath, "invalid");
  const failed = new ApplicationTaskService(f.paths, "demo", demoTaskExecutor);
  await expect(failed.start()).rejects.toThrow();
  await expect(readFile(`${f.paths.taskPath}.runner.lock`)).rejects.toThrow();
  await writeFile(f.paths.taskPath, JSON.stringify({version: 1, tasks: []}));
  const replacement = new ApplicationTaskService(f.paths, "demo", demoTaskExecutor); services.push(replacement);
  await replacement.start(); await failed.close();
  const third = new ApplicationTaskService(f.paths, "demo", demoTaskExecutor);
  await expect(third.start()).rejects.toThrow("application_runner_already_running");
});

test("a mode change interrupts old chat work and cannot reuse its request ID", async () => {
  const chat = {threadId: randomUUID(), send: async () => randomUUID()};
  const f = await fixture("demo", demoTaskExecutor, chat);
  const [task] = await f.prepare(); await f.service.close();
  const changed = new ApplicationTaskService(f.paths, "codex", demoTaskExecutor, chat); services.push(changed);
  await changed.start();
  expect((await changed.list())[0]!.state).toBe("interrupted");
  await expect(changed.enqueue({action: "prepare", mode: "codex", requestId: task!.requestId, jobIds: ["example-1"]})).rejects.toThrow("invalid_request");
  await expect(claimChatTask(f.paths, task!.id, chat.threadId)).rejects.toThrow("chat_task_unavailable");
});

test("website preparation, long-answer editing, approval and submission rehearsal persist without claiming employer success", async () => {
  const f = await fixture();
  const selection = await ready(f);
  const request = { action: "submit", mode: "demo", requestId: randomUUID(), selections: [selection] };
  const first = await f.service.enqueue(request); await f.service.idle();
  expect((await f.service.list()).map(t => t.state)).toEqual(["needs_review", "demo_complete"]);
  expect((await f.service.enqueue(request))[0]!.id).toBe(first[0]!.id);
  expect((await f.service.list())).toHaveLength(2);
  const record = (await readApplicationTracker(f.paths.trackerPath)).applications[0]!;
  expect(record.status).toBe("in_review"); expect(record.submissionEvidence).toBeUndefined();
  expect((await readReviewBatch(f.paths.reviewPath)).applications[0]!.decision.state).toBe("approved");
});

test("rejects stale revisions, duplicate selections, changed modes and mixed invalid batches atomically", async () => {
  const f = await fixture(); const selection = await ready(f);
  for (const request of [
    { action: "submit", mode: "demo", selections: [{ ...selection, revision: 1 }] },
    { action: "submit", mode: "demo", selections: [selection, selection] },
    { action: "submit", mode: "codex", selections: [selection] },
    { action: "submit", mode: "demo", selections: [selection, { ...selection, applicationId: "missing" }] }
  ]) await expect(f.service.enqueue({ ...request, requestId: randomUUID() })).rejects.toThrow();
  expect(await f.service.list()).toHaveLength(1);
});

test("edits to approved content invalidate old selections and need fresh approval", async () => {
  const f = await fixture(); const selection = await ready(f);
  const reopened = await reopenReviewContent(f.paths.reviewPath, selection.applicationId, selection.snapshotId);
  expect(reopened.snapshotId).not.toBe(selection.snapshotId);
  expect(reopened.decision.state).toBe("pending");
  await expect(f.service.enqueue({ action: "submit", mode: "demo", requestId: randomUUID(), selections: [selection] })).rejects.toThrow("task_target_unavailable");
});

test("generated-answer edits are revision-bound and cannot change deterministic facts", async () => {
  const f = await fixture(); await f.prepare(); await f.service.idle();
  const item = (await readReviewBatch(f.paths.reviewPath)).applications[0]!;
  item.answers = [{ label: "Motivation", value: "Draft", kind: "generated" }, { label: "Name", value: "Fictional Candidate", kind: "deterministic" }];
  const old = item.snapshotId; item.snapshotId = randomUUID();
  await publishReviewItem(f.paths.reviewPath, item, { snapshotId: old, revision: null, decision: "pending" });
  const edited = await saveGeneratedAnswer(f.paths.reviewPath, item.applicationId, item.snapshotId, 0, "Edited\nparagraph", 0);
  expect(edited.desiredState?.revision).toBe(1);
  await expect(saveGeneratedAnswer(f.paths.reviewPath, item.applicationId, item.snapshotId, 0, "Stale overwrite", 0)).rejects.toThrow("desired_revision_mismatch");
  await expect(saveGeneratedAnswer(f.paths.reviewPath, item.applicationId, item.snapshotId, 1, "Fake", 1)).rejects.toThrow("invalid_question_resolution");
  await expect(saveQuestionText(f.paths.reviewPath, item.applicationId, item.snapshotId, "demo-start", "Old tab", 0)).rejects.toThrow("desired_revision_mismatch");
});

test("serializes work and rejects a second active request for the same job", async () => {
  let release!: () => void; const wait = new Promise<void>(r => { release = r; });
  const f = await fixture("demo", async (...args) => { await wait; return demoTaskExecutor(...args); });
  await f.prepare();
  await expect(f.prepare()).rejects.toThrow("task_already_active");
  release(); await f.service.idle();
  expect((await f.service.list())[0]!.state).toBe("needs_review");
});

test("a runner's claim of submission success is insufficient without evidence and a consumed attempt", async () => {
  const f = await fixture("codex", async (task, paths, signal) => task.action === "prepare" ? demoTaskExecutor(task, paths, signal) : "Submitted successfully");
  const selection = await ready(f);
  await f.service.enqueue({ action: "submit", mode: "codex", requestId: randomUUID(), selections: [selection] }); await f.service.idle();
  expect((await f.service.list())[1]!.state).toBe("blocked");
  expect((await readApplicationTracker(f.paths.trackerPath)).applications[0]!.status).toBe("in_review");
});

test("live execution consumes an exact website authorization once and requires saved outcome evidence", async () => {
  const f = await fixture("codex", async (task, paths, signal) => {
    if (task.action === "prepare") return demoTaskExecutor(task, paths, signal);
    const item = (await readReviewBatch(paths.reviewPath)).applications[0]!;
    const verification = { liveSnapshotId: `sha256:${"a".repeat(64)}`, cvFilename: item.cv.filename, verifiedAt: new Date().toISOString(), contentMatches: true as const, validationPassed: true as const };
    const authorization = await consumeWebsiteTask(paths, task.id, verification);
    await expect(consumeWebsiteTask(paths, task.id, verification)).rejects.toThrow("execution_authorization_unavailable");
    await markSubmitted(paths.trackerPath, item.applicationId, { applicationId: item.applicationId, snapshotId: item.snapshotId, approvalConsumed: true, visibleResult: "submitted", authorization,
      evidence: { source: "official_page", reference: "https://example.com/local-test-confirmation", verifiedAt: new Date().toISOString() } });
    return "Verified";
  });
  const selection = await ready(f);
  await f.service.enqueue({ action: "submit", mode: "codex", requestId: randomUUID(), selections: [selection] }); await f.service.idle();
  expect((await f.service.list())[1]!.state).toBe("completed");
  expect((await readReviewBatch(f.paths.reviewPath)).applications[0]!.decision.state).toBe("consumed");
});

test("restart never automatically replays queued or running work", async () => {
  const f = await fixture(); await f.prepare(); await f.service.idle(); await f.service.close();
  const document = JSON.parse(await readFile(f.paths.taskPath, "utf8")); document.tasks[0].state = "running";
  await writeFile(f.paths.taskPath, JSON.stringify(document));
  let calls = 0;
  const resumed = new ApplicationTaskService(f.paths, "demo", async () => { calls++; return ""; }); services.push(resumed); await resumed.start();
  expect((await resumed.list())[0]!.state).toBe("interrupted"); expect(calls).toBe(0);
});

test("HTTP task routes enforce origin and strict payloads, and return accepted work", async () => {
  const f = await fixture();
  const server = await startReviewServer({ ...f.paths, port: 0, tasks: f.service }); servers.push(server);
  const post = (body: unknown, origin = server.address) => fetch(server.address + "/api/tasks", { method: "POST", headers: { "content-type": "application/json", origin }, body: JSON.stringify(body) });
  const request = { action: "prepare", mode: "demo", requestId: randomUUID(), jobIds: ["example-1"] };
  expect((await post(request, "https://attacker.example")).status).toBe(403);
  expect((await post({ ...request, command: "arbitrary shell" })).status).toBe(400);
  expect((await post(request)).status).toBe(202); await f.service.idle();
  const state = await (await fetch(server.address + "/api/tasks")).json();
  expect(state.tasks[0].state).toBe("needs_review");
  expect(state.mode).toBe("demo");
  expect(await (await fetch(server.address + "/review")).text()).not.toContain("Demo · no submissions");
});

test("approvals automatically form the submission batch without executing until the final click", async () => {
  const f = await fixture();
  const server = await startReviewServer({ ...f.paths, port: 0, tasks: f.service }); servers.push(server);
  const state = async () => (await fetch(server.address + "/api/tasks")).json();
  expect((await state()).approvals).toEqual([]);
  const selected = await ready(f);
  expect((await state()).approvals).toEqual([selected]);
  expect((await state()).reviewCount).toBe(0);
  const statusHtml = await (await fetch(server.address + "/status/us")).text();
  expect(statusHtml).not.toContain('id="submit-applications"');
  expect(statusHtml).not.toContain('class="job-select"');
  expect(statusHtml).not.toContain('Review answers');
  expect(statusHtml).toContain('id="review-count"');
  expect((await state()).tasks.map((task: {action: string}) => task.action)).toEqual(["prepare"]);
  const html = await (await fetch(server.address + "/review")).text();
  expect(html).not.toContain('class="submit-select"');
  expect(html).not.toContain('id="run-selected"');
  expect(html.indexOf('id="submit-applications"')).toBeGreaterThan(html.indexOf('</main>'));
  const reopened = await reopenReviewContent(f.paths.reviewPath, selected.applicationId, selected.snapshotId);
  expect((await state()).reviewCount).toBe(1);
  expect((await state()).approvals).toEqual([]);
  await approveReviewContent(f.paths.reviewPath, reopened.applicationId, reopened.snapshotId, reopened.desiredState?.revision);
  const approved = (await state()).approvals;
  expect(approved).toHaveLength(1);
  const response = await fetch(server.address + "/api/tasks", { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "submit", mode: "demo", requestId: randomUUID(), selections: approved }) });
  expect(response.status).toBe(202); await f.service.idle();
  expect((await state()).approvals).toEqual([]);
  expect((await state()).tasks[1].state).toBe("demo_complete");
});


test("chat dispatch sends once, waits for this chat, and atomically rejects duplicate or wrong-thread execution", async () => {
  const threadId = randomUUID();
  let sent = 0, inlineRuns = 0;
  const f = await fixture("demo", async () => { inlineRuns++; return "Unexpected"; }, { threadId, send: async () => { sent++; return randomUUID(); } });
  const request = { action: "prepare", mode: "demo", requestId: randomUUID(), jobIds: ["example-1"] };
  const [task] = await f.service.enqueue(request);
  await f.service.enqueue(request); await f.service.idle();
  expect(sent).toBe(1); expect(inlineRuns).toBe(0);
  expect(task!.state).toBe("queued"); expect(task!.chatDelivery?.state).toBe("sent");
  await expect(claimChatTask(f.paths, task!.id, randomUUID())).rejects.toThrow("chat_task_unavailable");
  const results = await Promise.allSettled([runDemoChatTask(f.paths, task!.id, threadId), runDemoChatTask(f.paths, task!.id, threadId)]);
  expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
  expect((await f.service.list())[0]!.state).toBe("needs_review");
  expect((await readApplicationTracker(f.paths.trackerPath)).applications).toHaveLength(1);
});

test("chat delivery failure blocks the task without falling back to an inline runner", async () => {
  let runs = 0;
  const f = await fixture("demo", async () => { runs++; return "Unexpected"; }, { threadId: randomUUID(), send: async () => { throw Error("Disconnected"); } });
  const [task] = await f.prepare(); await f.service.idle();
  expect(task!.state).toBe("blocked"); expect(task!.chatDelivery?.state).toBe("failed"); expect(runs).toBe(0);
  expect((await readApplicationTracker(f.paths.trackerPath)).applications).toHaveLength(0);
});

test("delivered queued chat tasks survive service restart, but claimed tasks never replay", async () => {
  const threadId = randomUUID(); let sends = 0;
  const chat = { threadId, send: async () => { sends++; return randomUUID(); } };
  const f = await fixture("demo", demoTaskExecutor, chat);
  const [task] = await f.prepare();
  await f.service.close();
  const restarted = new ApplicationTaskService(f.paths, "demo", demoTaskExecutor, chat); services.push(restarted); await restarted.start();
  expect((await restarted.list())[0]!.state).toBe("queued"); expect(sends).toBe(1);
  await claimChatTask(f.paths, task!.id, threadId);
  await restarted.close();
  const third = new ApplicationTaskService(f.paths, "demo", demoTaskExecutor, chat); services.push(third); await third.start();
  expect((await third.list())[0]!.state).toBe("interrupted");
  await expect(finishChatTask(f.paths, task!.id, threadId, "completed")).rejects.toThrow("chat_task_unavailable");
});

test("Submit queues the approved snapshot for chat and clearing approval blocks the later claim", async () => {
  const f = await fixture(); const selection = await ready(f); await f.service.close();
  const threadId = randomUUID();
  const chat = new ApplicationTaskService(f.paths, "demo", demoTaskExecutor, { threadId, send: async () => randomUUID() }); services.push(chat); await chat.start();
  const [task] = await chat.enqueue({ action: "submit", mode: "demo", requestId: randomUUID(), selections: [selection] });
  expect(task!.state).toBe("queued");
  await reopenReviewContent(f.paths.reviewPath, selection.applicationId, selection.snapshotId);
  await expect(runDemoChatTask(f.paths, task!.id, threadId)).rejects.toThrow("Content changed");
  expect((await chat.list()).find(item => item.id === task!.id)!.state).toBe("blocked");
  expect((await readApplicationTracker(f.paths.trackerPath)).applications[0]!.submissionEvidence).toBeUndefined();
});

test("chat submission rehearsal completes only once and preserves employer lifecycle", async () => {
  const f = await fixture(); const selection = await ready(f); await f.service.close();
  const threadId = randomUUID();
  const chat = new ApplicationTaskService(f.paths, "demo", demoTaskExecutor, { threadId, send: async () => randomUUID() }); services.push(chat); await chat.start();
  const [task] = await chat.enqueue({ action: "submit", mode: "demo", requestId: randomUUID(), selections: [selection] });
  const result = await runDemoChatTask(f.paths, task!.id, threadId);
  expect(result.state).toBe("demo_complete");
  await expect(runDemoChatTask(f.paths, task!.id, threadId)).rejects.toThrow("chat_task_unavailable");
  expect((await readApplicationTracker(f.paths.trackerPath)).applications[0]!.status).toBe("in_review");
});

test("an explicit resume profile remains bound to a preparation request across retries", async () => {
  const chat = {threadId: randomUUID(), send: async () => randomUUID()};
  const f = await fixture("codex", demoTaskExecutor, chat);
  const request = {action: "prepare", mode: "codex", requestId: randomUUID(), jobIds: ["example-1"], resumeCategory: "pm_general"};
  const [task] = await f.service.enqueue(request);
  expect(task?.target.resumeCategory).toBe("pm_general");
  expect((await f.service.enqueue(request))[0]?.id).toBe(task?.id);
  await expect(f.service.enqueue({...request, resumeCategory: "another_profile"})).rejects.toThrow("invalid_request");
});
