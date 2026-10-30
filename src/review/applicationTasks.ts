import { randomUUID, createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { z } from "zod";
import { acquireFileLock } from "../recordLock.js";
import { readJobLibrary } from "../jobs/jobLibrary.js";
import { createApplication, readApplicationTracker } from "../tracker.js";
import { consumeWebsiteContent, initializeReviewOrder, publishReviewItem, readReviewBatch, type ReviewItem } from "./reviewStore.js";

const selectionSchema = z.object({
  applicationId: z.string().min(1), snapshotId: z.string().min(1), revision: z.number().int().nonnegative()
}).strict();
export const taskRequestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("prepare"), requestId: z.string().uuid(), mode: z.enum(["demo", "codex"]), jobIds: z.array(z.string().min(1)).min(1).max(25) }).strict(),
  z.object({ action: z.literal("submit"), requestId: z.string().uuid(), mode: z.enum(["demo", "codex"]), selections: z.array(selectionSchema).min(1).max(25) }).strict()
]);
export type TaskRequest = z.infer<typeof taskRequestSchema>;
const targetSchema = selectionSchema.extend({ applicationId: z.string(), snapshotId: z.string(), jobId: z.string(), company: z.string(), title: z.string(), contentHash: z.string() });
const taskSchema = z.object({
  id: z.string().uuid(), requestId: z.string().uuid(), action: z.enum(["prepare", "submit"]),
  mode: z.enum(["demo", "codex"]), target: targetSchema,
  state: z.enum(["queued", "running", "needs_review", "completed", "demo_complete", "blocked", "interrupted"]),
  message: z.string(), createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
  attemptedAt: z.string().datetime().optional(),
  chatDelivery: z.object({ threadId: z.string().uuid(), state: z.enum(["pending", "sending", "sent", "failed"]), messageId: z.string().optional() }).optional()
});
const documentSchema = z.object({ version: z.literal(1), tasks: z.array(taskSchema) }).strict();
export type ApplicationTask = z.infer<typeof taskSchema>;
export interface TaskPaths { reviewPath: string; trackerPath: string; jobsPath: string; taskPath: string }
export interface ChatTaskDispatcher { threadId: string; send(tasks: ApplicationTask[]): Promise<string> }
export type TaskExecutor = (task: ApplicationTask, paths: TaskPaths, signal: AbortSignal) => Promise<string>;
export function reviewContentHash(item: ReviewItem): string {
  return createHash("sha256").update(JSON.stringify({
    company: item.company, title: item.title, officialUrl: item.officialUrl, applicationUrl: item.applicationUrl,
    category: item.category, cvFilename: item.cv.filename, answers: item.answers, questions: item.questions, consents: item.consents
  })).digest("hex");
}

export async function readTasks(path: string): Promise<ApplicationTask[]> {
  try { return documentSchema.parse(JSON.parse(await readFile(path, "utf8"))).tasks; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
}
// shlock is process-scoped, so serialize callers within this process as well.
const queues = new Map<string, Promise<unknown>>();
const owners = new Set<string>();
async function changeTasks<T>(path: string, change: (tasks: ApplicationTask[]) => Promise<T> | T): Promise<T> {
  const previous = queues.get(path) ?? Promise.resolve();
  const operation = previous.catch(() => undefined).then(async () => {
    await mkdir(dirname(path), { recursive: true });
    const release = await acquireFileLock(path);
    try {
      const tasks = await readTasks(path);
      const result = await change(tasks);
      const temporary = join(dirname(path), `.tasks-${randomUUID()}.tmp`);
      await writeFile(temporary, JSON.stringify(documentSchema.parse({ version: 1, tasks }), null, 2) + "\n", { mode: 0o600 });
      await rename(temporary, path);
      return result;
    } finally { await release(); }
  });
  queues.set(path, operation);
  try { return await operation; } finally { if (queues.get(path) === operation) queues.delete(path); }
}

export async function assertTaskContent(task: ApplicationTask, paths: TaskPaths): Promise<ReviewItem> {
  const item = (await readReviewBatch(paths.reviewPath)).applications.find(i => i.applicationId === task.target.applicationId);
  if (!item || item.snapshotId !== task.target.snapshotId || (item.desiredState?.revision ?? 0) !== task.target.revision ||
      reviewContentHash(item) !== task.target.contentHash || item.decision.state !== "approved" || item.decision.scope !== "content-only") {
    throw new Error("Content changed. Review and select this application again.");
  }
  const record = (await readApplicationTracker(paths.trackerPath)).applications.find(i => i.applicationId === item.applicationId);
  if (!record || record.hiddenFromStatus || record.status !== "in_review") throw new Error("This application is no longer available for submission.");
  return item;
}

/** Reserve before consumption; a crash between files fails closed and cannot replay the attempt. */
export async function consumeWebsiteTask(paths: TaskPaths, taskId: string,
  verification: Parameters<typeof consumeWebsiteContent>[4]
): Promise<{ source: "website"; reference: string; approvedAt: string }> {
  const task = await changeTasks(paths.taskPath, async tasks => {
    const task = tasks.find(t => t.id === taskId);
    if (!task || task.mode !== "codex" || task.action !== "submit" || task.state !== "running" || task.attemptedAt) throw new Error("execution_authorization_unavailable");
    await assertTaskContent(task, paths);
    task.attemptedAt = new Date().toISOString();
    return task;
  });
  await consumeWebsiteContent(paths.reviewPath, task.target.applicationId, task.target.snapshotId, task.target.revision, verification);
  return { source: "website", reference: `website-task:${task.id}`, approvedAt: task.createdAt };
}

export class ApplicationTaskService {
  private active?: Promise<void>;
  private stopped = false;
  private controller = new AbortController();
  private releaseRunner?: () => Promise<void>;
  constructor(readonly paths: TaskPaths, readonly mode: "demo" | "codex", private execute: TaskExecutor, private chat?: ChatTaskDispatcher) {}

  async start(): Promise<void> {
    if (owners.has(this.paths.taskPath)) throw new Error("application_runner_already_running");
    owners.add(this.paths.taskPath);
    try {
      await mkdir(dirname(this.paths.taskPath), { recursive: true });
      this.releaseRunner = await acquireFileLock(`${this.paths.taskPath}.runner`);
      // Never replay a submission after a server/process interruption.
      await changeTasks(this.paths.taskPath, tasks => {
        for (const task of tasks.filter(t => ["queued", "running"].includes(t.state))) {
          if (task.state === "queued" && task.mode === this.mode && task.chatDelivery?.state === "sent" && task.chatDelivery.threadId === this.chat?.threadId) continue;
          task.state = "interrupted";
          task.message = task.action === "submit" ? "Runner interrupted. Check the employer outcome before starting another submission." : "Preparation interrupted. Select this job again to retry.";
          task.updatedAt = new Date().toISOString();
        }
      });
    } catch (error) {
      try { await this.releaseRunner?.(); }
      finally { this.releaseRunner = undefined; owners.delete(this.paths.taskPath); }
      throw error;
    }
  }
  async list(): Promise<ApplicationTask[]> { return readTasks(this.paths.taskPath); }
  async enqueue(input: unknown): Promise<ApplicationTask[]> {
    const parsed = taskRequestSchema.safeParse(input);
    if (!parsed.success || this.stopped) throw new Error("invalid_request");
    const request = parsed.data;
    if (request.mode !== this.mode) throw new Error("invalid_request");
    const created = await changeTasks(this.paths.taskPath, async tasks => {
      const duplicate = tasks.filter(t => t.requestId === request.requestId);
      if (duplicate.length) {
        const expected = request.action === "prepare" ? request.jobIds : request.selections.map(s => JSON.stringify(s));
        const actual = duplicate.map(t => request.action === "prepare" ? t.target.jobId : JSON.stringify({ applicationId: t.target.applicationId, snapshotId: t.target.snapshotId, revision: t.target.revision }));
        if (duplicate.some(t => t.action !== request.action || t.mode !== request.mode) || JSON.stringify(expected) !== JSON.stringify(actual)) throw new Error("invalid_request");
        return duplicate;
      }
      const [jobs, tracker, review] = await Promise.all([readJobLibrary(this.paths.jobsPath), readApplicationTracker(this.paths.trackerPath), readReviewBatch(this.paths.reviewPath)]);
      const targets: ApplicationTask["target"][] = [];
      if (request.action === "prepare") {
        for (const jobId of request.jobIds) {
          const record = tracker.applications.find(a => a.jobId === jobId);
          const job = jobs.find(j => j.jobId === jobId && !["closed", "submitted"].includes(j.status) && (record || ["ready", "new"].includes(j.status)) && !j.note.startsWith("user-excluded:"));
          if (!job || (record && (record.hiddenFromStatus || record.status !== "in_review"))) throw new Error("task_target_unavailable");
          const existing = review.applications.find(i => i.applicationId === record?.applicationId);
          if (existing && ["approved", "consumed"].includes(existing.decision.state)) throw new Error("task_target_unavailable");
          targets.push({ jobId, applicationId: record?.applicationId ?? "", snapshotId: "", revision: 0, contentHash: "", company: job.company, title: job.title });
        }
      } else {
        for (const selection of request.selections) {
          const item = review.applications.find(i => i.applicationId === selection.applicationId);
          const record = tracker.applications.find(a => a.applicationId === selection.applicationId);
          if (!item || !record || record.hiddenFromStatus || record.status !== "in_review" || item.decision.state !== "approved" || item.decision.scope !== "content-only" ||
              item.snapshotId !== selection.snapshotId || (item.desiredState?.revision ?? 0) !== selection.revision) throw new Error("task_target_unavailable");
          targets.push({ ...selection, jobId: record.jobId, company: item.company, title: item.title, contentHash: reviewContentHash(item) });
        }
      }
      if (new Set(targets.map(t => t.jobId)).size !== targets.length) throw new Error("invalid_request");
      if (targets.some(target => tasks.some(t => t.target.jobId === target.jobId && ["queued", "running"].includes(t.state)))) throw new Error("task_already_active");
      if (request.action === "submit" && targets.some(target => tasks.some(task => task.mode === this.mode && task.action === "submit" && ["completed", "demo_complete"].includes(task.state) && task.target.applicationId === target.applicationId && task.target.snapshotId === target.snapshotId && task.target.revision === target.revision))) throw new Error("task_target_unavailable");
      // An uncertain submission requires reconciliation; a new click must not silently replay it.
      if (request.action === "submit" && targets.some(target => tasks.some(t => t.mode === "codex" && t.action === "submit" && t.target.applicationId === target.applicationId && (t.state === "interrupted" || Boolean(t.attemptedAt))))) throw new Error("submission_outcome_unresolved");
      const now = new Date().toISOString();
      const added: ApplicationTask[] = targets.map(target => ({ id: randomUUID(), requestId: request.requestId, action: request.action, mode: this.mode, target, state: "queued", message: this.chat ? "Waiting for this chat" : "Waiting for the runner", createdAt: now, updatedAt: now,
        ...(this.chat ? { chatDelivery: { threadId: this.chat.threadId, state: "pending" as const } } : {}) }));
      tasks.push(...added);
      return added;
    });
    if (this.chat) await this.dispatchToChat(created);
    else this.kick();
    const current = await this.list();
    return created.map(task => current.find(item => item.id === task.id)!);
  }
  private async dispatchToChat(batch: ApplicationTask[]): Promise<void> {
    const pending = await changeTasks(this.paths.taskPath, tasks => {
      const selected = tasks.filter(task => batch.some(item => item.id === task.id));
      if (!selected.length || selected.some(task => task.chatDelivery?.state !== "pending")) return [];
      for (const task of selected) task.chatDelivery!.state = "sending";
      return selected;
    });
    if (!pending.length) return; // Repeated HTTP requests must not send duplicate chat messages.
    try {
      const messageId = await this.chat!.send(pending);
      await changeTasks(this.paths.taskPath, tasks => {
        for (const task of tasks.filter(item => pending.some(p => p.id === item.id))) {
          task.chatDelivery = { threadId: this.chat!.threadId, state: "sent", messageId };
          task.updatedAt = new Date().toISOString();
        }
      });
    } catch {
      await changeTasks(this.paths.taskPath, tasks => {
        for (const task of tasks.filter(item => pending.some(p => p.id === item.id))) {
          task.chatDelivery!.state = "failed";
          task.state = "blocked";
          task.message = "Could not confirm delivery to this chat. No application work started. Check the Codex connection before retrying.";
          task.updatedAt = new Date().toISOString();
        }
      });
    }
  }
  private kick(): void {
    if (this.active || this.stopped) return;
    this.active = this.drain().finally(async () => {
      this.active = undefined;
      if (!this.stopped && (await this.list()).some(t => t.state === "queued")) this.kick();
    });
    // Errors remain observable through persistent task state; avoid an unhandled rejection.
    void this.active.catch(() => undefined);
  }
  private async update(id: string, state: ApplicationTask["state"], message: string): Promise<void> {
    await changeTasks(this.paths.taskPath, tasks => {
      const task = tasks.find(t => t.id === id)!;
      Object.assign(task, { state, message: message.slice(0, 600), updatedAt: new Date().toISOString() });
    });
  }
  private async drain(): Promise<void> {
    while (!this.stopped) {
      const task = (await this.list()).find(t => t.state === "queued");
      if (!task) return;
      await this.update(task.id, "running", task.action === "prepare" ? "Preparing application for review" : this.mode === "demo" ? "Running the local submission rehearsal" : "Verifying the reviewed application before submission");
      try {
        if (task.action === "submit") await assertTaskContent(task, this.paths);
        const message = await this.execute(task, this.paths, this.controller.signal);
        if (this.stopped) throw new Error("Runner interrupted. Check the outcome before retrying.");
        const outcome = await completedTaskOutcome(task, this.paths, message);
        await this.update(task.id, outcome.state, outcome.message);
      } catch (error) {
        await this.update(task.id, this.stopped ? "interrupted" : "blocked", error instanceof Error ? error.message : "The runner stopped. Check the application before retrying.");
      }
    }
  }
  async idle(): Promise<void> { await this.active; }
  async close(): Promise<void> {
    if (this.stopped) return;
    this.stopped = true; this.controller.abort();
    try { await this.active; }
    finally {
      // A failed start may be closed after a replacement runner has acquired ownership.
      if (this.releaseRunner) {
        try { await this.releaseRunner(); }
        finally { this.releaseRunner = undefined; owners.delete(this.paths.taskPath); }
      }
    }
  }
}

async function completedTaskOutcome(task: ApplicationTask, paths: TaskPaths, message: string): Promise<{ state: ApplicationTask["state"]; message: string }> {
  if (task.action === "prepare") {
    const tracker = await readApplicationTracker(paths.trackerPath);
    const record = tracker.applications.find(a => a.jobId === task.target.jobId);
    const item = (await readReviewBatch(paths.reviewPath)).applications.find(i => i.applicationId === record?.applicationId);
    if (!item || !["pending", "stale"].includes(item.decision.state)) throw new Error(message || "Preparation stopped without a review draft.");
    return { state: "needs_review", message: "Ready for your review. Open Review to edit answers and approve content." };
  }
  if (task.mode === "demo") {
    await assertTaskContent(task, paths);
    return { state: "demo_complete", message: "Local rehearsal complete. No employer was contacted and no application was submitted." };
  }
  const record = (await readApplicationTracker(paths.trackerPath)).applications.find(a => a.applicationId === task.target.applicationId);
  const attempt = (await readTasks(paths.taskPath)).find(t => t.id === task.id);
  if (!attempt?.attemptedAt || !record?.submissionEvidence || record.authorization?.reference !== `website-task:${task.id}` || record.approvedSnapshotId !== task.target.snapshotId || record.visibleResult !== "submitted" || Date.parse(record.submissionEvidence.verifiedAt) < Date.parse(attempt.attemptedAt)) throw new Error("No verified submission outcome was saved. Check the employer before retrying.");
  return { state: "completed", message: "Submitted. Confirmation evidence has been saved." };
}

/** A queued chat message is a notification; this atomic claim is the authority to start work. */
export async function claimChatTask(paths: TaskPaths, taskId: string, threadId: string): Promise<ApplicationTask> {
  const result = await changeTasks(paths.taskPath, async tasks => {
    const task = tasks.find(item => item.id === taskId);
    if (!task || task.state !== "queued" || task.chatDelivery?.threadId !== threadId || task.chatDelivery.state !== "sent") throw new Error("chat_task_unavailable");
    try {
      if (task.action === "submit") await assertTaskContent(task, paths);
      else {
        const job = (await readJobLibrary(paths.jobsPath)).find(item => item.jobId === task.target.jobId);
        if (!job || ["closed", "submitted"].includes(job.status) || job.note.startsWith("user-excluded:")) throw new Error("The selected job is no longer available.");
        const record = (await readApplicationTracker(paths.trackerPath)).applications.find(item => item.jobId === task.target.jobId);
        if (record && (record.hiddenFromStatus || record.status !== "in_review")) throw new Error("The selected application is no longer available.");
        const draft = (await readReviewBatch(paths.reviewPath)).applications.find(item => item.applicationId === record?.applicationId);
        if (draft && ["approved", "consumed"].includes(draft.decision.state)) throw new Error("This application has already been approved.");
      }
      task.state = "running";
      task.message = "Processing in your Codex chat";
      task.updatedAt = new Date().toISOString();
      return { task };
    } catch (error) {
      task.state = "blocked";
      task.message = error instanceof Error ? error.message : "This request is no longer available.";
      task.updatedAt = new Date().toISOString();
      return { error: task.message };
    }
  });
  if (result.error) throw new Error(result.error);
  return result.task!;
}

export async function finishChatTask(paths: TaskPaths, taskId: string, threadId: string, outcome: "completed" | "blocked", message = ""): Promise<ApplicationTask> {
  const task = (await readTasks(paths.taskPath)).find(item => item.id === taskId);
  if (!task || task.state !== "running" || task.chatDelivery?.threadId !== threadId) throw new Error("chat_task_unavailable");
  const completed = outcome === "completed" ? await completedTaskOutcome(task, paths, message) : { state: "blocked" as const, message: message || "The chat needs your input." };
  return changeTasks(paths.taskPath, tasks => {
    const current = tasks.find(item => item.id === taskId)!;
    if (current.state !== "running" || current.chatDelivery?.threadId !== threadId) throw new Error("chat_task_unavailable");
    Object.assign(current, { ...completed, message: completed.message.slice(0, 600), updatedAt: new Date().toISOString() });
    return current;
  });
}

export async function runDemoChatTask(paths: TaskPaths, taskId: string, threadId: string): Promise<ApplicationTask> {
  const pending = (await readTasks(paths.taskPath)).find(task => task.id === taskId);
  if (pending?.mode !== "demo") throw new Error("demo_task_required");
  const task = await claimChatTask(paths, taskId, threadId);
  try {
    const message = await demoTaskExecutor(task, paths, new AbortController().signal);
    return await finishChatTask(paths, taskId, threadId, "completed", message);
  } catch (error) {
    return finishChatTask(paths, taskId, threadId, "blocked", error instanceof Error ? error.message : "Local rehearsal failed.");
  }
}

/** Local rehearsal only: creates editable fictional drafts and never opens employer pages. */
export const demoTaskExecutor: TaskExecutor = async (task, paths) => {
  if (task.action === "submit") return "Local rehearsal complete";
  const job = (await readJobLibrary(paths.jobsPath)).find(j => j.jobId === task.target.jobId)!;
  const tracker = await readApplicationTracker(paths.trackerPath);
  let record = tracker.applications.find(a => a.jobId === job.jobId);
  if (!record) record = await createApplication(paths.trackerPath, {
    applicationId: `demo-${randomUUID()}`, jobId: job.jobId, company: job.company, title: job.title, location: job.location,
    ats: "long-tail", jobUrl: job.officialUrl, applicationUrl: job.officialUrl, category: job.category, cvFilename: "demo-resume.pdf"
  });
  const existing = (await readReviewBatch(paths.reviewPath)).applications.find(i => i.applicationId === record!.applicationId);
  if (existing) return "Existing draft ready for review";
  await publishReviewItem(paths.reviewPath, {
    applicationId: record.applicationId, snapshotId: `demo:${randomUUID()}`, company: record.company, title: record.title,
    location: record.location, ats: record.ats, officialUrl: record.jobUrl, applicationUrl: record.applicationUrl, category: record.category,
    cv: { filename: record.cvFilename, verified: false }, answers: [], consents: [],
    questions: [{ id: "demo-motivation", prompt: "Why are you interested in this role? (Local rehearsal)", required: true },
      { id: "demo-start", prompt: "When could you start? (Local rehearsal)", required: true, inputType: "short-text" }],
    validationErrors: [], friction: ["Local rehearsal; employer form and resume have not been verified."],
    snapshotCurrent: false, reviewStage: "questions", preparedAt: new Date().toISOString(), decision: { state: "pending" }
  }, null);
  await initializeReviewOrder(paths.reviewPath);
  return "Draft ready for review";
};
