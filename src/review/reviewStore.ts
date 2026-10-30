import { isDraftDirectory, readDrafts, saveDrafts, withDraftLock } from "../storage/drafts.js";
import { randomUUID } from "node:crypto";
import { chmod, readFile, realpath, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { z } from "zod";
import { acquireFileLock } from "../recordLock.js";
import { categories } from "../preflight.js";

const timestamp = z.string().datetime();
const liveSnapshotIdentity = z.string().regex(/^sha256:[0-9a-f]{64}$/i);
const answerSchema = z.object({
  label: z.string().min(1),
  value: z.string(),
  kind: z.enum(["deterministic", "generated"]),
  edited: z.literal(true).optional(),
  source: z.string().min(1).optional()
}).strict().refine(answer => !answer.edited || answer.kind === "generated", "only generated answers can be edited");
const consentSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
  required: z.boolean()
}).strict();
const reviewChoiceSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1)
}).strict();
const questionSchema = z.object({
  id: z.string().min(1),
  prompt: z.string().min(1),
  required: z.boolean(),
  resolution: z.string().min(1).optional(),
  draftAnswer: z.string().max(16000).optional(),
  inputType: z.literal("short-text").optional(),
  options: z.array(reviewChoiceSchema).min(1).optional(),
  recommendedOptionId: z.string().min(1).optional(),
  recommendationSource: z.string().min(1).optional(),
  selectedOptionId: z.string().min(1).optional()
}).strict().superRefine((question, context) => {
  const optionIds = new Set<string>();
  for (const option of question.options ?? []) {
    if (optionIds.has(option.id)) {
      context.addIssue({ code: "custom", message: "duplicate option id" });
    }
    optionIds.add(option.id);
  }
  if (!question.options && (
    question.recommendedOptionId ||
    question.recommendationSource ||
    question.selectedOptionId
  )) {
    context.addIssue({ code: "custom", message: "enumerated metadata requires options" });
  }
  if (question.inputType && question.options) {
    context.addIssue({ code: "custom", message: "short text cannot have options" });
  }
  if (question.inputType && (question.draftAnswer?.length ?? 0) > 300) {
    context.addIssue({ code: "custom", message: "short text exceeds 300 characters" });
  }
  if (question.options && (question.resolution || question.draftAnswer !== undefined)) {
    context.addIssue({ code: "custom", message: "enumerated question cannot have a resolution" });
  }
  if (question.recommendedOptionId && !optionIds.has(question.recommendedOptionId)) {
    context.addIssue({ code: "custom", message: "unknown recommended option" });
  }
  if (question.selectedOptionId && !optionIds.has(question.selectedOptionId)) {
    context.addIssue({ code: "custom", message: "unknown selected option" });
  }
});

function isCanonicalReviewSource(source: string | undefined): boolean {
  return source?.startsWith("Canonical ") ?? false;
}

const revision = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const desiredStateSchema = z.discriminatedUnion("syncState", [
  z.object({ revision, syncState: z.literal("pending") }).strict(),
  z.object({
    revision,
    syncState: z.literal("verified"),
    verifiedAt: timestamp,
    verifiedLiveSnapshotId: liveSnapshotIdentity
  }).strict()
]);
const decisionSchema = z.discriminatedUnion("state", [
  z.object({ state: z.literal("pending") }).strict(),
  z.object({
    state: z.literal("approved"),
    scope: z.literal("content-only").optional(),
    decidedAt: timestamp,
    desiredRevision: revision.optional()
  }).strict(),
  z.object({ state: z.literal("skipped"), decidedAt: timestamp }).strict(),
  z.object({ state: z.literal("stale") }).strict(),
  z.object({
    state: z.literal("consumed"),
    decidedAt: timestamp,
    consumedAt: timestamp,
    desiredRevision: revision.optional()
  }).strict()
]);
const reviewItemSchema = z.object({
  applicationId: z.string().min(1),
  snapshotId: z.string().min(1),
  company: z.string().min(1),
  title: z.string().min(1),
  officialUrl: z.string().url().startsWith("https://"),
  applicationUrl: z.string().url().startsWith("https://").optional(),
  ats: z.enum(["greenhouse", "ashby", "workday", "lever", "long-tail"]),
  category: z.enum(categories),
  location: z.string().min(1),
  cv: z.object({ filename: z.string().min(1), verified: z.boolean() }).strict(),
  answers: z.array(answerSchema),
  consents: z.array(consentSchema),
  questions: z.array(questionSchema),
  validationErrors: z.array(z.string().min(1)),
  friction: z.array(z.string().min(1)),
  snapshotCurrent: z.boolean(),
  reviewStage: z.enum(["final", "questions"]).optional(),
  queuePosition: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional(),
  preparedAt: timestamp,
  openedAt: timestamp.optional(),
  fullContentsViewedAt: timestamp.optional(),
  decision: decisionSchema,
  desiredState: desiredStateSchema.optional()
}).strict().superRefine((item, context) => {
  const questionIds = new Set<string>();
  for (const question of item.questions) {
    if (questionIds.has(question.id)) {
      context.addIssue({ code: "custom", message: "duplicate question id" });
    }
    questionIds.add(question.id);
  }
  if (
    item.decision.state === "pending" &&
    item.questions.some((question) => isCanonicalReviewSource(question.recommendationSource))
  ) {
    context.addIssue({
      code: "custom",
      message: "canonical answers are execution evidence, not review questions"
    });
  }
  const hasSelectedEnumeratedAnswer = item.answers.some(answer => answer.edited) || item.questions.some((question) =>
    Boolean(question.options && question.selectedOptionId) || question.draftAnswer !== undefined
  );
  if (hasSelectedEnumeratedAnswer !== Boolean(item.desiredState)) {
    context.addIssue({ code: "custom", message: "selected answers and desired state are not coupled" });
  }
  if (item.decision.state === "approved" || item.decision.state === "consumed") {
    const expectedRevision = item.desiredState?.revision;
    if (item.decision.desiredRevision !== expectedRevision) {
      context.addIssue({ code: "custom", message: "desired revision is not approval-bound" });
    }
  }
  if (
    item.desiredState?.syncState === "verified" &&
    item.decision.state !== "approved" &&
    item.decision.state !== "consumed"
  ) {
    context.addIssue({ code: "custom", message: "verified desired state is not approved" });
  }
  if (
    item.decision.state === "consumed" &&
    item.desiredState?.syncState === "pending"
  ) {
    context.addIssue({ code: "custom", message: "consumed desired state is not verified" });
  }
  if (
    item.desiredState?.syncState === "verified" &&
    item.desiredState.verifiedLiveSnapshotId.toLowerCase() === item.snapshotId.toLowerCase()
  ) {
    context.addIssue({ code: "custom", message: "verified live snapshot is not distinct" });
  }
  if (
    item.decision.state === "consumed" &&
    Date.parse(item.decision.consumedAt) < Date.parse(item.decision.decidedAt)
  ) {
    context.addIssue({ code: "custom", message: "consumption predates approval" });
  }
  if (
    item.desiredState?.syncState === "verified" &&
    (item.decision.state === "approved" || item.decision.state === "consumed") &&
    Date.parse(item.desiredState.verifiedAt) < Date.parse(item.decision.decidedAt)
  ) {
    context.addIssue({ code: "custom", message: "verification predates approval" });
  }
  if (
    item.decision.state === "consumed" &&
    item.desiredState?.syncState === "verified" &&
    Date.parse(item.decision.consumedAt) < Date.parse(item.desiredState.verifiedAt)
  ) {
    context.addIssue({ code: "custom", message: "consumption predates verification" });
  }
  const auditTimes = [
    item.preparedAt,
    item.openedAt,
    item.fullContentsViewedAt,
    "decidedAt" in item.decision ? item.decision.decidedAt : undefined
  ].filter((value): value is string => value !== undefined);
  for (let index = 1; index < auditTimes.length; index += 1) {
    if (Date.parse(auditTimes[index]!) < Date.parse(auditTimes[index - 1]!)) {
      context.addIssue({ code: "custom", message: "review audit chronology is invalid" });
      break;
    }
  }
});
const reviewBatchSchema = z.object({
  schemaVersion: z.literal(1),
  batchId: z.string().min(1),
  createdAt: timestamp,
  applications: z.array(reviewItemSchema)
}).strict();

export type ReviewBatch = z.infer<typeof reviewBatchSchema>;
export type ReviewItem = z.infer<typeof reviewItemSchema>;
export type ReviewChoice = z.infer<typeof reviewChoiceSchema>;
export type DesiredState = z.infer<typeof desiredStateSchema>;

function desiredStateCoupled(item: ReviewItem): boolean {
  const hasSelectedEnumeratedAnswer = item.answers.some(answer => answer.edited) || item.questions.some((question) =>
    Boolean(question.options && question.selectedOptionId) || question.draftAnswer !== undefined
  );
  return hasSelectedEnumeratedAnswer === Boolean(item.desiredState);
}

function assertDesiredStateCoupled(item: ReviewItem): void {
  if (!desiredStateCoupled(item)) throw new Error("desired_state_inconsistent");
}

function assertQuestionShapes(item: ReviewItem): void {
  if (item.questions.some((question) => question.options && question.resolution)) {
    throw new Error("invalid_question_resolution");
  }
}

const mutationQueues = new Map<string, Promise<void>>();

function parseBatch(value: unknown): ReviewBatch {
  const parsed = reviewBatchSchema.safeParse(value);
  if (!parsed.success) throw new Error("invalid_review_batch");
  const identities = new Set<string>();
  const queuePositions = new Set<number>();
  const reviewSnapshotIds = new Set(
    parsed.data.applications.map((item) => item.snapshotId.toLowerCase())
  );
  const verifiedLiveSnapshotIds = new Set<string>();
  for (const item of parsed.data.applications) {
    if (identities.has(item.applicationId)) throw new Error("invalid_review_batch");
    identities.add(item.applicationId);
    if (item.queuePosition !== undefined) {
      if (queuePositions.has(item.queuePosition)) throw new Error("invalid_review_batch");
      queuePositions.add(item.queuePosition);
    }
    if (item.desiredState?.syncState === "verified") {
      const liveSnapshotId = item.desiredState.verifiedLiveSnapshotId.toLowerCase();
      if (reviewSnapshotIds.has(liveSnapshotId)) throw new Error("invalid_review_batch");
      if (verifiedLiveSnapshotIds.has(liveSnapshotId)) throw new Error("invalid_review_batch");
      verifiedLiveSnapshotIds.add(liveSnapshotId);
    }
  }
  return parsed.data;
}

async function save(path: string, batch: ReviewBatch): Promise<void> {
  const validated = parseBatch(batch);
  if (isDraftDirectory(path)) return saveDrafts(path, validated);
  const temporary = join(dirname(path), `.${randomUUID()}.tmp`);
  await writeFile(temporary, `${JSON.stringify(validated, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  await rename(temporary, path);
  await chmod(path, 0o600);
}

export async function readReviewBatch(path: string): Promise<ReviewBatch> {
  try {
    return parseBatch(isDraftDirectory(path) ? await readDrafts(path) : JSON.parse(await readFile(path, "utf8")));
  } catch (error) {
    if (error instanceof Error && error.message === "invalid_review_batch") throw error;
    throw new Error("invalid_review_batch");
  }
}

export async function createReviewBatch(path: string, batch: ReviewBatch): Promise<void> {
  if (isDraftDirectory(path)) return withDraftLock(path, () => save(path, batch));
  await save(path, batch);
}

function exactItem(batch: ReviewBatch, applicationId: string, snapshotId: string): ReviewItem {
  const item = batch.applications.find((candidate) => candidate.applicationId === applicationId);
  if (!item) throw new Error("review_application_not_found");
  if (item.snapshotId !== snapshotId || !item.snapshotCurrent) throw new Error("review_snapshot_mismatch");
  return item;
}

type TransactionResult<T> = { changed: boolean; result: T };

async function transact<T>(
  path: string,
  change: (batch: ReviewBatch) => TransactionResult<T>
): Promise<T> {
  if (isDraftDirectory(path)) return withDraftLock(path, async () => {
    const batch = await readReviewBatch(path);
    const transaction = change(batch);
    if (transaction.changed) await save(path, batch);
    return transaction.result;
  });
  const key = await realpath(path);
  const previous = mutationQueues.get(key) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = previous.catch(() => undefined).then(() => gate);
  mutationQueues.set(key, tail);
  await previous.catch(() => undefined);
  let releaseFileLock: (() => Promise<void>) | undefined;
  try {
    releaseFileLock = await acquireFileLock(key);
    const batch = await readReviewBatch(key);
    const transaction = change(batch);
    if (transaction.changed) await save(key, batch);
    return transaction.result;
  } finally {
    try { if (releaseFileLock) await releaseFileLock(); } finally {
      release();
      if (mutationQueues.get(key) === tail) mutationQueues.delete(key);
    }
  }
}

async function mutate(
  path: string,
  applicationId: string,
  snapshotId: string,
  change: (item: ReviewItem) => boolean
): Promise<ReviewItem> {
  return transact(path, (batch) => {
    const item = exactItem(batch, applicationId, snapshotId);
    return { changed: change(item), result: item };
  });
}

export async function setReviewApplicationUrl(
  path: string,
  applicationId: string,
  snapshotId: string,
  applicationUrl: string
): Promise<ReviewItem> {
  const parsedUrl = z.string().url().startsWith("https://").parse(applicationUrl);
  return mutate(path, applicationId, snapshotId, (item) => {
    if (item.applicationUrl === parsedUrl) return false;
    if (
      item.decision.state !== "pending" ||
      item.openedAt ||
      item.fullContentsViewedAt
    ) throw new Error("review_snapshot_replacement_required");
    item.applicationUrl = parsedUrl;
    return true;
  });
}

export async function markOpened(
  path: string,
  applicationId: string,
  snapshotId: string,
  now = new Date().toISOString()
): Promise<ReviewItem> {
  return mutate(path, applicationId, snapshotId, (item) => {
    if (item.openedAt) return false;
    if (item.decision.state !== "pending") throw new Error("approval_not_available");
    const openedAt = timestamp.safeParse(now);
    if (!openedAt.success) throw new Error("invalid_opened_timestamp");
    if (Date.parse(openedAt.data) < Date.parse(item.preparedAt)) {
      throw new Error("invalid_opened_chronology");
    }
    item.openedAt = openedAt.data;
    return true;
  });
}

export async function markFullContentsViewed(
  path: string,
  applicationId: string,
  snapshotId: string,
  now = new Date().toISOString()
): Promise<ReviewItem> {
  return mutate(path, applicationId, snapshotId, (item) => {
    if (item.fullContentsViewedAt) return false;
    if (item.decision.state !== "pending") throw new Error("approval_not_available");
    if (!item.openedAt) throw new Error("review_gate_incomplete");
    const fullContentsViewedAt = timestamp.safeParse(now);
    if (!fullContentsViewedAt.success) throw new Error("invalid_full_view_timestamp");
    if (Date.parse(fullContentsViewedAt.data) < Date.parse(item.openedAt)) {
      throw new Error("invalid_full_view_chronology");
    }
    item.fullContentsViewedAt = fullContentsViewedAt.data;
    return true;
  });
}

export async function resolveQuestion(
  path: string,
  applicationId: string,
  snapshotId: string,
  questionId: string,
  value: string
): Promise<ReviewItem> {
  if (!value.trim()) throw new Error("invalid_question_resolution");
  return mutate(path, applicationId, snapshotId, (item) => {
    if (item.decision.state !== "pending") throw new Error("approval_not_available");
    if (item.openedAt || item.fullContentsViewedAt) throw new Error("review_snapshot_replacement_required");
    const question = item.questions.find((candidate) => candidate.id === questionId);
    if (!question) throw new Error("review_question_not_found");
    if (question.options) throw new Error("invalid_question_resolution");
    const resolution = value.trim();
    if (question.resolution === resolution) return false;
    question.resolution = resolution;
    item.snapshotCurrent = false;
    item.decision = { state: "stale" };
    return true;
  });
}

export async function saveQuestionText(
  path: string, applicationId: string, snapshotId: string, questionId: string, value: string,
  expectedRevision?: number
): Promise<ReviewItem> {
  if (value.length > 16000) throw new Error("invalid_question_resolution");
  return transact(path, (batch) => {
    const item = batch.applications.find((candidate) => candidate.applicationId === applicationId);
    if (!item) throw new Error("review_application_not_found");
    if (expectedRevision !== undefined && expectedRevision !== (item.desiredState?.revision ?? 0)) throw new Error("desired_revision_mismatch");
    if (item.snapshotId !== snapshotId || (!item.snapshotCurrent && item.reviewStage !== "questions")) throw new Error("review_snapshot_mismatch");
    if (item.decision.state !== "pending" && !(item.reviewStage === "questions" && item.decision.state === "stale")) throw new Error("approval_not_available");
    const question = item.questions.find((candidate) => candidate.id === questionId);
    if (!question) throw new Error("review_question_not_found");
    if (question.options) throw new Error("invalid_question_resolution");
    if (question.inputType === "short-text" && (value.length > 300 || /[\r\n]/.test(value))) throw new Error("invalid_question_resolution");
    if (question.draftAnswer === value.trim()) return { changed: false, result: item };
    if ((item.desiredState?.revision ?? 0) >= Number.MAX_SAFE_INTEGER) throw new Error("desired_state_revision_overflow");
    question.draftAnswer = value.trim();
    delete question.resolution;
    item.desiredState = { revision: (item.desiredState?.revision ?? 0) + 1, syncState: "pending" };
    return { changed: true, result: item };
  });
}

/** Only generated prose can be edited here; canonical facts retain their source of truth. */
export async function saveGeneratedAnswer(
  path: string, applicationId: string, snapshotId: string, answerIndex: number,
  value: string, expectedRevision: number
): Promise<ReviewItem> {
  if (!value.trim() || value.length > 16000) throw new Error("invalid_question_resolution");
  return transact(path, batch => {
    const item = batch.applications.find(candidate => candidate.applicationId === applicationId);
    if (!item) throw new Error("review_application_not_found");
    if (item.snapshotId !== snapshotId) throw new Error("review_snapshot_mismatch");
    if (expectedRevision !== (item.desiredState?.revision ?? 0)) throw new Error("desired_revision_mismatch");
    if (item.decision.state !== "pending" && !(item.reviewStage === "questions" && item.decision.state === "stale")) throw new Error("approval_not_available");
    const answer = item.answers[answerIndex];
    if (!Number.isSafeInteger(answerIndex) || !answer || answer.kind !== "generated") throw new Error("invalid_question_resolution");
    if (answer.value === value.trim()) return { changed: false, result: item };
    if (expectedRevision >= Number.MAX_SAFE_INTEGER) throw new Error("desired_state_revision_overflow");
    answer.value = value.trim();
    answer.edited = true;
    item.desiredState = { revision: expectedRevision + 1, syncState: "pending" };
    return { changed: true, result: item };
  });
}

/** Reopening invalidates earlier execution requests by changing the snapshot identity. */
export async function reopenReviewContent(path: string, applicationId: string, snapshotId: string): Promise<ReviewItem> {
  return transact(path, batch => {
    const item = batch.applications.find(candidate => candidate.applicationId === applicationId);
    if (!item) throw new Error("review_application_not_found");
    if (item.snapshotId !== snapshotId) throw new Error("review_snapshot_mismatch");
    if (item.decision.state !== "approved" || item.decision.scope !== "content-only") throw new Error("approval_not_available");
    item.snapshotId = `review:${randomUUID()}`;
    item.decision = { state: "pending" };
    if (item.desiredState) item.desiredState = { revision: item.desiredState.revision, syncState: "pending" };
    delete item.openedAt;
    delete item.fullContentsViewedAt;
    return { changed: true, result: item };
  });
}

export async function selectQuestionOption(
  path: string,
  applicationId: string,
  snapshotId: string,
  questionId: string,
  optionId: string,
  expectedRevision?: number
): Promise<ReviewItem> {
  return transact(path, (batch) => {
    const item = batch.applications.find((candidate) => candidate.applicationId === applicationId);
    if (!item) throw new Error("review_application_not_found");
    if (expectedRevision !== undefined && expectedRevision !== (item.desiredState?.revision ?? 0)) throw new Error("desired_revision_mismatch");
    if (item.snapshotId !== snapshotId || (!item.snapshotCurrent && item.reviewStage !== "questions")) throw new Error("review_snapshot_mismatch");
    if (item.decision.state !== "pending" && !(item.reviewStage === "questions" && item.decision.state === "stale")) throw new Error("approval_not_available");
    const question = item.questions.find((candidate) => candidate.id === questionId);
    if (!question) throw new Error("review_question_not_found");
    if (!question.options?.some((option) => option.id === optionId)) {
      throw new Error("review_question_option_not_found");
    }
    if (question.resolution) throw new Error("invalid_question_resolution");
    if (question.selectedOptionId === optionId) return { changed: false, result: item };
    if ((item.desiredState?.revision ?? 0) >= Number.MAX_SAFE_INTEGER) {
      throw new Error("desired_state_revision_overflow");
    }
    question.selectedOptionId = optionId;
    item.desiredState = {
      revision: (item.desiredState?.revision ?? 0) + 1,
      syncState: "pending"
    };
    return { changed: true, result: item };
  });
}

function gateComplete(item: ReviewItem): boolean {
  return Boolean(
    item.openedAt &&
    item.fullContentsViewedAt &&
    item.cv.verified &&
    item.snapshotCurrent &&
    item.validationErrors.length === 0 &&
    item.questions.every((question) =>
      !question.required || Boolean(
        question.options ? question.selectedOptionId : (question.draftAnswer?.trim() || question.resolution)
      )
    )
  );
}

export async function decideReview(
  path: string,
  applicationId: string,
  snapshotId: string,
  decision: "approved" | "skipped",
  now = new Date().toISOString(),
  expectedDesiredRevision?: number
): Promise<ReviewItem> {
  return mutate(path, applicationId, snapshotId, (item) => {
    assertDesiredStateCoupled(item);
    assertQuestionShapes(item);
    if (item.desiredState && expectedDesiredRevision !== item.desiredState.revision) {
      throw new Error("desired_revision_mismatch");
    }
    if (item.decision.state === decision) return false;
    if (item.decision.state !== "pending") throw new Error("approval_not_available");
    if (!item.openedAt || !item.fullContentsViewedAt) throw new Error("review_gate_incomplete");
    if (decision === "approved" && !gateComplete(item)) throw new Error("review_gate_incomplete");
    const decidedAt = timestamp.safeParse(now);
    if (!decidedAt.success) throw new Error("invalid_decision_timestamp");
    if (Date.parse(decidedAt.data) < Date.parse(item.fullContentsViewedAt)) {
      throw new Error("invalid_decision_chronology");
    }
    item.decision = decision === "approved" && item.desiredState
      ? { state: decision, decidedAt: decidedAt.data, desiredRevision: item.desiredState.revision }
      : { state: decision, decidedAt: decidedAt.data };
    return true;
  });
}

/** User accepts this local content revision; this does not authorize execution or submission. */
export async function approveReviewContent(
  path: string, applicationId: string, snapshotId: string,
  expectedDesiredRevision?: number, now = new Date().toISOString()
): Promise<ReviewItem> {
  return transact(path, batch => {
    const item = batch.applications.find(candidate => candidate.applicationId === applicationId);
    if (!item) throw new Error("review_application_not_found");
    if (item.snapshotId !== snapshotId) throw new Error("review_snapshot_mismatch");
    assertDesiredStateCoupled(item);
    if (expectedDesiredRevision !== item.desiredState?.revision) throw new Error("desired_revision_mismatch");
    if (item.decision.state === "approved" && item.decision.scope === "content-only") return { changed: false, result: item };
    if (item.decision.state !== "pending" && !(item.decision.state === "stale" && item.reviewStage === "questions")) throw new Error("approval_not_available");
    if (item.questions.some(q => q.required && !(q.options ? q.selectedOptionId : (q.draftAnswer?.trim() || q.resolution)))) throw new Error("review_gate_incomplete");
    const time = timestamp.safeParse(now);
    if (!time.success || Date.parse(now) < Date.parse(item.fullContentsViewedAt ?? item.openedAt ?? item.preparedAt)) throw new Error("invalid_decision_timestamp");
    item.decision = { state: "approved", scope: "content-only", decidedAt: now,
      ...(item.desiredState ? { desiredRevision: item.desiredState.revision } : {}) };
    return { changed: true, result: item };
  });
}

export async function verifyDesiredStateApplied(
  path: string,
  applicationId: string,
  snapshotId: string,
  desiredRevision: number,
  verifiedLiveSnapshotId: string,
  now = new Date().toISOString()
): Promise<ReviewItem> {
  return transact(path, (batch) => {
    const item = exactItem(batch, applicationId, snapshotId);
    if (item.decision.state !== "approved") throw new Error("approval_not_available");
    if (
      !revision.safeParse(desiredRevision).success ||
      !item.desiredState ||
      item.desiredState.revision !== desiredRevision ||
      item.decision.desiredRevision !== desiredRevision
    ) throw new Error("desired_state_revision_mismatch");
    const parsedLiveSnapshotId = liveSnapshotIdentity.safeParse(verifiedLiveSnapshotId);
    if (
      !parsedLiveSnapshotId.success ||
      verifiedLiveSnapshotId.toLowerCase() === snapshotId.toLowerCase()
    ) {
      throw new Error("desired_state_live_snapshot_required");
    }
    const normalizedLiveSnapshotId = verifiedLiveSnapshotId.toLowerCase();
    if (batch.applications.some((candidate) =>
      candidate.snapshotId.toLowerCase() === normalizedLiveSnapshotId
    )) throw new Error("desired_state_live_snapshot_required");
    if (batch.applications.some((candidate) =>
      candidate.applicationId !== applicationId &&
      candidate.desiredState?.syncState === "verified" &&
      candidate.desiredState.verifiedLiveSnapshotId.toLowerCase() === normalizedLiveSnapshotId
    )) throw new Error("desired_state_live_snapshot_reused");
    if (item.desiredState.syncState === "verified") {
      if (item.desiredState.verifiedLiveSnapshotId.toLowerCase() === normalizedLiveSnapshotId) {
        return { changed: false, result: item };
      }
      throw new Error("desired_state_already_verified");
    }
    const verifiedAt = timestamp.safeParse(now);
    if (!verifiedAt.success) throw new Error("invalid_verification_timestamp");
    if (Date.parse(verifiedAt.data) < Date.parse(item.decision.decidedAt)) {
      throw new Error("invalid_verification_chronology");
    }
    item.desiredState = {
      revision: desiredRevision,
      syncState: "verified",
      verifiedAt: verifiedAt.data,
      verifiedLiveSnapshotId: parsedLiveSnapshotId.data
    };
    return { changed: true, result: item };
  });
}

export async function consumeApproval(
  path: string,
  applicationId: string,
  snapshotId: string,
  now = new Date().toISOString()
): Promise<ReviewItem> {
  return mutate(path, applicationId, snapshotId, (item) => {
    assertDesiredStateCoupled(item);
    assertQuestionShapes(item);
    if (item.decision.state === "approved" && item.decision.scope === "content-only") throw new Error("execution_authorization_required");
    if (item.decision.state !== "approved" || !gateComplete(item)) throw new Error("approval_not_available");
    if (item.desiredState?.syncState === "pending") throw new Error("desired_state_sync_required");
    if (
      item.desiredState &&
      item.decision.desiredRevision !== item.desiredState.revision
    ) throw new Error("approval_not_available");
    const consumedAt = timestamp.safeParse(now);
    if (!consumedAt.success) throw new Error("invalid_consumption_timestamp");
    if (
      Date.parse(consumedAt.data) < Date.parse(item.decision.decidedAt) ||
      (
        item.desiredState?.syncState === "verified" &&
        Date.parse(consumedAt.data) < Date.parse(item.desiredState.verifiedAt)
      )
    ) throw new Error("invalid_consumption_chronology");
    item.decision = { ...item.decision, state: "consumed", consumedAt: consumedAt.data };
    return true;
  });
}

/** Called only after a durable website task has reserved its one-time execution attempt. */
export async function consumeWebsiteContent(
  path: string, applicationId: string, snapshotId: string, expectedRevision: number,
  verification: { liveSnapshotId: string; cvFilename: string; verifiedAt: string; contentMatches: true; validationPassed: true }
): Promise<ReviewItem> {
  return transact(path, batch => {
    const item = batch.applications.find(i => i.applicationId === applicationId);
    if (!item || item.snapshotId !== snapshotId) throw new Error("review_snapshot_mismatch");
    if (item.decision.state !== "approved" || item.decision.scope !== "content-only") throw new Error("approval_not_available");
    if ((item.desiredState?.revision ?? 0) !== expectedRevision) throw new Error("desired_revision_mismatch");
    if (!liveSnapshotIdentity.safeParse(verification.liveSnapshotId).success || verification.liveSnapshotId === snapshotId ||
        verification.cvFilename !== item.cv.filename || verification.contentMatches !== true || verification.validationPassed !== true ||
        !timestamp.safeParse(verification.verifiedAt).success || Date.parse(verification.verifiedAt) < Date.parse(item.decision.decidedAt) ||
        Date.parse(verification.verifiedAt) > Date.now() || Date.now() - Date.parse(verification.verifiedAt) > 60_000 ||
        item.questions.some(q => q.required && !(q.options ? q.selectedOptionId : q.draftAnswer?.trim() || q.resolution))) throw new Error("review_gate_incomplete");
    if (batch.applications.some(i => i.applicationId !== applicationId && (i.snapshotId === verification.liveSnapshotId || (i.desiredState?.syncState === "verified" && i.desiredState.verifiedLiveSnapshotId === verification.liveSnapshotId)))) throw new Error("desired_state_live_snapshot_reused");
    item.snapshotCurrent = true;
    item.cv.verified = true;
    item.validationErrors = [];
    if (item.desiredState) item.desiredState = { revision: expectedRevision, syncState: "verified", verifiedAt: verification.verifiedAt, verifiedLiveSnapshotId: verification.liveSnapshotId };
    item.decision = { state: "consumed", decidedAt: item.decision.decidedAt, consumedAt: new Date().toISOString(), ...(expectedRevision ? { desiredRevision: expectedRevision } : {}) };
    return { changed: true, result: item };
  });
}

export async function invalidateSnapshot(
  path: string,
  applicationId: string,
  currentSnapshotId: string
): Promise<ReviewItem> {
  return transact(path, (batch) => {
    const item = batch.applications.find((candidate) => candidate.applicationId === applicationId);
    if (!item) throw new Error("review_application_not_found");
    if (item.decision.state === "consumed") {
      const changed = item.snapshotCurrent;
      item.snapshotCurrent = false;
      return { changed, result: item };
    }
    const changed = Boolean(
      item.snapshotId !== currentSnapshotId ||
      item.snapshotCurrent ||
      item.openedAt ||
      item.fullContentsViewedAt ||
      item.decision.state !== "stale"
    );
    item.snapshotId = currentSnapshotId;
    item.snapshotCurrent = false;
    delete item.openedAt;
    delete item.fullContentsViewedAt;
    item.decision = { state: "stale" };
    if (item.desiredState?.syncState === "verified") {
      item.desiredState = { revision: item.desiredState.revision, syncState: "pending" };
    }
    return { changed, result: item };
  });
}

/** Assign attention-first positions once. Later calls append new items without moving existing ones. */
export async function initializeReviewOrder(path: string): Promise<ReviewBatch> {
  return transact(path, batch => {
    const unranked = batch.applications.filter(item => item.queuePosition === undefined);
    const needsJudgment = (item: ReviewItem) => item.questions.length > 0 || item.answers.some(answer => answer.kind === "generated");
    unranked.sort((a, b) => Number(needsJudgment(b)) - Number(needsJudgment(a)));
    let position = Math.max(0, ...batch.applications.map(item => item.queuePosition ?? 0));
    if (!Number.isSafeInteger(position + unranked.length)) throw new Error("review_queue_position_overflow");
    for (const item of unranked) item.queuePosition = ++position;
    return { changed: unranked.length > 0, result: batch };
  });
}

/** Publish data into the fixed Review UI; never carries approval into a new snapshot. */
export async function publishReviewItem(
  path: string,
  input: ReviewItem,
  expected: { snapshotId: string; revision: number | null; decision: ReviewItem["decision"]["state"] } | null
): Promise<ReviewItem> {
  const item = reviewItemSchema.parse(input);
  if (item.decision.state !== "pending" || item.openedAt || item.fullContentsViewedAt || item.desiredState?.syncState === "verified") {
    throw new Error("fresh_pending_snapshot_required");
  }
  const visibleText = [item.company, item.title, item.location,
    ...item.answers.filter(a => a.kind === "generated").flatMap(a => [a.label, a.value]),
    ...item.questions.flatMap(q => [q.prompt, q.draftAnswer ?? "", q.resolution ?? "", ...(q.options ?? []).map(o => o.label)]),
    ...item.validationErrors];
  if (visibleText.some(text => /\p{Script=Han}/u.test(text))) throw new Error("english_review_content_required");
  return transact(path, batch => {
    const index = batch.applications.findIndex(a => a.applicationId === item.applicationId);
    const old = batch.applications[index];
    if (!old && expected !== null) throw new Error("review_update_conflict");
    if (old) {
      if (!expected || old.snapshotId !== expected.snapshotId || (old.desiredState?.revision ?? null) !== expected.revision || old.decision.state !== expected.decision) {
        throw new Error("review_update_conflict");
      }
      if (old.decision.state === "consumed") throw new Error("submitted_history_is_immutable");
      if (old.snapshotId === item.snapshotId) throw new Error("replacement_snapshot_required");
      if (old.category !== item.category || old.officialUrl !== item.officialUrl) throw new Error("application_identity_changed");
      if (item.queuePosition !== undefined && item.queuePosition !== old.queuePosition) throw new Error("review_queue_position_immutable");
      if (old.queuePosition !== undefined) item.queuePosition = old.queuePosition;
      batch.applications[index] = item;
    } else {
      if (item.queuePosition !== undefined) throw new Error("review_queue_position_immutable");
      batch.applications.push(item);
    }
    return { changed: true, result: item };
  });
}
