import { isOpportunityPath, readOpportunities, projectApplications, mergeApplications, transactOpportunities } from "./storage/opportunities.js";
import { randomUUID } from "node:crypto";
import { chmod, readFile, realpath, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { acquireFileLock } from "./recordLock.js";
import { z } from "zod";
import { categories, type Category } from "./preflight.js";

export const applicationStatuses = [
  "in_review",
  "submitted",
  "confirmed",
  "interviewing",
  "offer",
  "closed"
] as const;
export type ApplicationStatus = (typeof applicationStatuses)[number];

const legacyApplicationStatuses = ["new", "ready", "in_progress", "final_review", "submitted", "closed"] as const;
const atsTypes = ["greenhouse", "ashby", "workday", "lever", "long-tail"] as const;
const visibleResults = ["not_attempted", "submitted", "failed", "uncertain"] as const;
const gmailStates = ["not_checked", "confirmed", "not_received_yet", "not_applicable", "ambiguous"] as const;
const confirmationStates = ["confirmed", "ambiguous", "not_received_yet"] as const;
const submissionGmailStates = ["not_checked", "not_received_yet", "not_applicable", "ambiguous"] as const;
const httpsUrlSchema = z.string().url().startsWith("https://");

const authorizationSchema = z.object({ source: z.enum(["chat", "website"]), reference: z.string().min(1), approvedAt: z.string().datetime() }).strict();
const submissionEvidenceSchema = z.object({ source: z.enum(["official_page", "employer_dashboard", "email"]), reference: z.string().min(1), verifiedAt: z.string().datetime() }).strict();

const commonRecordShape = {
  jobId: z.string().min(1),
  applicationId: z.string().min(1),
  company: z.string().min(1),
  title: z.string().min(1),
  location: z.string().min(1),
  ats: z.enum(atsTypes),
  jobUrl: httpsUrlSchema,
  category: z.enum(categories),
  cvFilename: z.string().min(1),
  visibleResult: z.enum(visibleResults),
  gmailConfirmation: z.enum(gmailStates),
  blocker: z.string().min(1).optional(),
  hiddenFromStatus: z.boolean().optional(),
  approvedSnapshotId: z.string().min(1).optional(),
  authorization: authorizationSchema.optional(),
  submissionEvidence: submissionEvidenceSchema.optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  startedAt: z.string().datetime().optional(),
  finalReviewAt: z.string().datetime().optional(),
  submittedAt: z.string().datetime().optional(),
  confirmedAt: z.string().datetime().optional(),
  websiteConfirmation: z.object({
    reference: z.string().min(1),
    verifiedAt: z.string().datetime()
  }).strict().optional()
};

const recordObjectSchema = z.object({
  ...commonRecordShape,
  applicationUrl: httpsUrlSchema.optional(),
  status: z.enum(applicationStatuses)
}).strict();

function validateAuditEvidence(
  record: z.infer<typeof recordObjectSchema>,
  context: z.RefinementCtx
): void {
  if (["in_review", "submitted"].includes(record.status) && record.confirmedAt !== undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "confirmed_at_not_allowed", path: ["confirmedAt"] });
  }
  if (record.status === "submitted" && record.visibleResult !== "submitted") {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "submission_evidence_required", path: ["visibleResult"] });
  }
  if (record.status === "submitted" && record.gmailConfirmation === "confirmed") {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "confirmed_status_required", path: ["gmailConfirmation"] });
  }
  if (["confirmed", "interviewing", "offer"].includes(record.status)) {
    if (record.visibleResult !== "submitted") {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "submission_evidence_required", path: ["visibleResult"] });
    }
    if (record.gmailConfirmation !== "confirmed" && !record.websiteConfirmation) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "gmail_confirmation_required", path: ["gmailConfirmation"] });
    }
  }
}

const recordSchema = recordObjectSchema.superRefine(validateAuditEvidence);
const persistedRecordSchema = recordObjectSchema
  .extend({ applicationUrl: httpsUrlSchema })
  .superRefine(validateAuditEvidence);

function validateDocumentUniqueness(
  document: { applications: Array<z.infer<typeof recordObjectSchema>> },
  context: z.RefinementCtx
): void {
  for (const field of ["jobId", "applicationId", "jobUrl", "applicationUrl"] as const) {
    const seen = new Set<string>();
    document.applications.forEach((record, index) => {
      const value = record[field];
      if (value === undefined) return;
      if (seen.has(value)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `duplicate_${field}`,
          path: ["applications", index, field]
        });
      }
      seen.add(value);
    });
  }
}

const transientDocumentSchema = z.object({
  schemaVersion: z.literal(3),
  applications: z.array(recordSchema)
}).strict().superRefine(validateDocumentUniqueness);
const persistedDocumentSchema = z.object({
  schemaVersion: z.literal(3),
  applications: z.array(persistedRecordSchema)
}).strict().superRefine(validateDocumentUniqueness);
const legacyRecordSchema = z.object({
  ...commonRecordShape,
  status: z.enum(legacyApplicationStatuses)
}).strict();
const legacyDocumentSchema = z.object({
  schemaVersion: z.literal(2),
  applications: z.array(legacyRecordSchema)
}).strict();
const newApplicationSchema = z.object({
  jobId: commonRecordShape.jobId,
  applicationId: commonRecordShape.applicationId,
  company: commonRecordShape.company,
  title: commonRecordShape.title,
  location: commonRecordShape.location,
  ats: commonRecordShape.ats,
  jobUrl: commonRecordShape.jobUrl,
  applicationUrl: httpsUrlSchema,
  category: commonRecordShape.category,
  cvFilename: commonRecordShape.cvFilename
}).strict();
const transitionUpdatesSchema = z.object({
  blocker: z.string().min(1).optional()
}).strict();
const submissionSchema = z.object({
  applicationId: z.string().min(1),
  snapshotId: z.string().min(1),
  approvalConsumed: z.literal(true),
  visibleResult: z.literal("submitted"),
  gmailConfirmation: z.enum(submissionGmailStates).optional(),
  authorization: authorizationSchema.optional(),
  evidence: submissionEvidenceSchema.optional()
}).strict();
const confirmationBatchSchema = z.object({
  checkedAt: z.string().datetime(),
  confirmations: z.array(z.object({
    applicationId: z.string().min(1),
    receivedAt: z.string().datetime()
  }).strict()),
  notReceived: z.array(z.string().min(1))
}).strict().superRefine((batch, context) => {
  const seen = new Set<string>();
  for (const [index, confirmation] of batch.confirmations.entries()) {
    if (seen.has(confirmation.applicationId)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "duplicate_application_id",
        path: ["confirmations", index, "applicationId"]
      });
    }
    seen.add(confirmation.applicationId);
  }
  for (const [index, applicationId] of batch.notReceived.entries()) {
    if (seen.has(applicationId)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "duplicate_application_id",
        path: ["notReceived", index]
      });
    }
    seen.add(applicationId);
  }
});
export type ApplicationRecord = z.infer<typeof recordSchema>;
interface ApplicationTracker {
  schemaVersion: 3;
  applications: ApplicationRecord[];
}
type LegacyRecord = z.infer<typeof legacyRecordSchema>;

const mutationQueues = new Map<string, Promise<void>>();

export interface NewApplication {
  jobId: string;
  applicationId: string;
  company: string;
  title: string;
  location: string;
  ats: (typeof atsTypes)[number];
  jobUrl: string;
  applicationUrl: string;
  category: Category;
  cvFilename: string;
}

function migrateLegacyStatus(record: LegacyRecord): ApplicationStatus {
  if (record.status === "closed") return "closed";
  if (record.status === "submitted") {
    return record.gmailConfirmation === "confirmed" ? "confirmed" : "submitted";
  }
  return "in_review";
}

function migrateLegacyDocument(document: z.infer<typeof legacyDocumentSchema>): ApplicationTracker {
  return transientDocumentSchema.parse({
    schemaVersion: 3,
    applications: document.applications.map((record) => ({
      ...record,
      status: migrateLegacyStatus(record)
    }))
  });
}

function parseDocument(value: unknown): { document: ApplicationTracker; legacy: boolean } {
  const current = persistedDocumentSchema.safeParse(value);
  if (current.success) return { document: current.data, legacy: false };
  const legacy = legacyDocumentSchema.safeParse(value);
  if (!legacy.success) throw new Error("invalid_application_tracker");
  return { document: migrateLegacyDocument(legacy.data), legacy: true };
}

export function validateApplicationRecords(value: unknown): void { persistedDocumentSchema.parse(value); }

async function readParsedDocument(path: string) {
  try {
    return parseDocument(isOpportunityPath(path) ? projectApplications(await readOpportunities(path)) : JSON.parse(await readFile(path, "utf8")));
  } catch (error) {
    if (error instanceof Error && error.message === "invalid_application_tracker") throw error;
    throw new Error("invalid_application_tracker");
  }
}

export async function readApplicationTracker(path: string) {
  return (await readParsedDocument(path)).document;
}

async function save(path: string, document: ApplicationTracker) {
  const parsed = persistedDocumentSchema.safeParse(document);
  if (!parsed.success) throw new Error("invalid_application_tracker");
  const validated = parsed.data;
  const temporary = join(dirname(path), `.${randomUUID()}.tmp`);
  await writeFile(temporary, `${JSON.stringify(validated, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  await rename(temporary, path);
  await chmod(path, 0o600);
}

type TransactionResult<T> = { changed: boolean; result: T };

async function transact<T>(
  path: string,
  change: (
    document: ApplicationTracker,
    legacy: boolean
  ) => TransactionResult<T>
): Promise<T> {
  if (isOpportunityPath(path)) {
    return transactOpportunities(path, (stored) => {
      const { document } = parseDocument(projectApplications(stored));
      const transaction = change(document, false);
      if (transaction.changed) {
        const validated = persistedDocumentSchema.parse(document);
        mergeApplications(stored, validated.applications);
      }
      return transaction.result;
    });
  }
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
    const { document, legacy } = await readParsedDocument(key);
    const transaction = change(document, legacy);
    if (transaction.changed) await save(key, document);
    return transaction.result;
  } finally {
    try {
      if (releaseFileLock) await releaseFileLock();
    } finally {
      release();
      if (mutationQueues.get(key) === tail) mutationQueues.delete(key);
    }
  }
}

function exactRecord(document: ApplicationTracker, applicationId: string): ApplicationRecord {
  const record = document.applications.find((candidate) => candidate.applicationId === applicationId);
  if (!record) throw new Error("application_not_found");
  return record;
}

function requireValidLifecycleTime(value: string): number {
  if (!z.string().datetime().safeParse(value).success) throw new Error("invalid_lifecycle_time");
  return Date.parse(value);
}

function requireAtOrAfter(value: string, lowerBound: string): void {
  if (requireValidLifecycleTime(value) < requireValidLifecycleTime(lowerBound)) {
    throw new Error("invalid_lifecycle_time");
  }
}

export async function createApplication(path: string, input: NewApplication, now = new Date().toISOString()) {
  const parsed = newApplicationSchema.safeParse(input);
  if (!parsed.success) throw new Error("invalid_application_record");
  return transact(path, (document) => {
    if (document.applications.some((record) =>
      record.jobId === parsed.data.jobId ||
      record.applicationId === parsed.data.applicationId ||
      record.jobUrl === parsed.data.jobUrl ||
      record.applicationUrl === parsed.data.applicationUrl
    )) throw new Error("duplicate_job");
    const record: ApplicationRecord = {
      ...parsed.data,
      status: "in_review",
      visibleResult: "not_attempted",
      gmailConfirmation: "not_checked",
      createdAt: now,
      updatedAt: now
    };
    document.applications.push(record);
    return { changed: true, result: record };
  });
}

const allowed: Record<ApplicationStatus, ApplicationStatus[]> = {
  in_review: ["closed"],
  submitted: ["closed"],
  confirmed: ["interviewing", "closed"],
  interviewing: ["offer", "closed"],
  offer: ["closed"],
  closed: []
};

export async function transitionApplication(
  path: string,
  applicationId: string,
  next: Exclude<ApplicationStatus, "submitted" | "confirmed">,
  updates: z.input<typeof transitionUpdatesSchema> = {},
  now = new Date().toISOString(),
  expectedIdentity?: Pick<ApplicationRecord, "jobId" | "company" | "title" | "jobUrl">
) {
  const parsedUpdates = transitionUpdatesSchema.safeParse(updates);
  if (!parsedUpdates.success) throw new Error("invalid_application_record");
  return transact(path, (document) => {
    const record = exactRecord(document, applicationId);
    if (expectedIdentity && Object.entries(expectedIdentity).some(([key, value]) => record[key as keyof ApplicationRecord] !== value)) {
      throw new Error("application_identity_changed");
    }
    if (!allowed[record.status].includes(next)) throw new Error("invalid_status_transition");
    requireAtOrAfter(now, record.updatedAt);
    record.status = next;
    record.updatedAt = now;
    Object.assign(record, parsedUpdates.data);
    return { changed: true, result: record };
  });
}

export async function markSubmitted(
  path: string,
  applicationId: string,
  confirmation: z.input<typeof submissionSchema>,
  now = new Date().toISOString()
) {
  const parsed = submissionSchema.safeParse(confirmation);
  if (!parsed.success) throw new Error("website_approval_consumption_required");
  if (parsed.data.applicationId !== applicationId) throw new Error("website_approval_consumption_required");
  if (isOpportunityPath(path) && (!parsed.data.authorization || !parsed.data.evidence)) throw new Error("submission_provenance_required");
  requireValidLifecycleTime(now);
  if (parsed.data.authorization && parsed.data.evidence) {
    requireAtOrAfter(parsed.data.evidence.verifiedAt, parsed.data.authorization.approvedAt);
    requireAtOrAfter(now, parsed.data.evidence.verifiedAt);
  }
  return transact(path, (document) => {
    const record = exactRecord(document, applicationId);
    if (record.status !== "in_review") throw new Error("invalid_status_transition");
    requireAtOrAfter(now, record.updatedAt);
    record.status = "submitted";
    if (parsed.data.authorization) record.authorization = parsed.data.authorization;
    if (parsed.data.evidence) record.submissionEvidence = parsed.data.evidence;
    record.updatedAt = now;
    record.submittedAt = now;
    record.approvedSnapshotId = parsed.data.snapshotId;
    record.visibleResult = parsed.data.visibleResult;
    record.gmailConfirmation = parsed.data.gmailConfirmation ?? "not_checked";
    delete record.blocker;
    return { changed: true, result: record };
  });
}

/** Confirm an observed ATS success independently of email receipt. */
export async function setStatusVisibility(path: string, applicationId: string, visible: boolean) {
  return transact(path, (document) => {
    const record = exactRecord(document, applicationId);
    if (typeof visible !== "boolean") throw new Error("invalid_visibility");
    const changed = Boolean(record.hiddenFromStatus) !== !visible;
    record.hiddenFromStatus = !visible;
    return { changed, result: record };
  });
}

export async function markWebsiteConfirmed(
  path: string,
  applicationId: string,
  reference: string,
  now = new Date().toISOString()
) {
  if (!reference.trim()) throw new Error("website_evidence_required");
  return transact(path, (document) => {
    const record = exactRecord(document, applicationId);
    if (record.status !== "submitted" || record.visibleResult !== "submitted") {
      throw new Error("submission_evidence_required");
    }
    requireAtOrAfter(now, record.updatedAt);
    record.websiteConfirmation = { reference, verifiedAt: now };
    record.status = "confirmed";
    record.confirmedAt = now;
    record.updatedAt = now;
    return { changed: true, result: record };
  });
}

export async function markConfirmed(
  path: string,
  applicationId: string,
  gmailConfirmation: (typeof confirmationStates)[number],
  now = new Date().toISOString()
) {
  if (gmailConfirmation !== "confirmed") throw new Error("gmail_confirmation_required");
  return transact(path, (document) => {
    const record = exactRecord(document, applicationId);
    if (record.status !== "submitted") throw new Error("invalid_status_transition");
    if (!record.submittedAt) throw new Error("invalid_lifecycle_time");
    requireAtOrAfter(now, record.submittedAt);
    requireAtOrAfter(now, record.updatedAt);
    record.status = "confirmed";
    record.gmailConfirmation = "confirmed";
    record.confirmedAt = now;
    record.updatedAt = now;
    return { changed: true, result: record };
  });
}

export async function reconcileConfirmationBatch(
  path: string,
  input: z.input<typeof confirmationBatchSchema>
) {
  const parsed = confirmationBatchSchema.safeParse(input);
  if (!parsed.success) throw new Error("invalid_confirmation_batch");
  return transact(path, (document) => {
    const confirmations = parsed.data.confirmations.map((confirmation) => ({
      confirmation,
      record: exactRecord(document, confirmation.applicationId)
    }));
    const pending = parsed.data.notReceived.map((applicationId) => exactRecord(document, applicationId));
    for (const record of [...confirmations.map(({ record }) => record), ...pending]) {
      if (record.status !== "submitted" && !(record.status === "confirmed" && record.websiteConfirmation)) throw new Error("invalid_status_transition");
    }
    const checkedAt = requireValidLifecycleTime(parsed.data.checkedAt);
    for (const { confirmation, record } of confirmations) {
      if (!record.submittedAt && !record.websiteConfirmation) throw new Error("invalid_lifecycle_time");
      const receivedAt = requireValidLifecycleTime(confirmation.receivedAt);
      if (
        (!record.websiteConfirmation && receivedAt < requireValidLifecycleTime(record.submittedAt!)) ||
        receivedAt > checkedAt ||
        checkedAt < requireValidLifecycleTime(record.updatedAt)
      ) throw new Error("invalid_lifecycle_time");
    }
    for (const record of pending) {
      if (checkedAt < requireValidLifecycleTime(record.updatedAt)) throw new Error("invalid_lifecycle_time");
    }
    for (const { confirmation, record } of confirmations) {
      record.status = "confirmed";
      record.gmailConfirmation = "confirmed";
      if (!record.websiteConfirmation) record.confirmedAt = confirmation.receivedAt;
      record.updatedAt = parsed.data.checkedAt;
    }
    for (const record of pending) {
      record.gmailConfirmation = "not_received_yet";
      record.updatedAt = parsed.data.checkedAt;
    }
    return {
      changed: confirmations.length > 0 || pending.length > 0,
      result: { confirmed: confirmations.length, pending: pending.length }
    };
  });
}

export async function migrateApplicationTracker(
  path: string,
  applicationUrls: Readonly<Record<string, string>>
) {
  const parsedUrls = z.record(httpsUrlSchema).safeParse(applicationUrls);
  if (!parsedUrls.success) throw new Error("invalid_application_url");
  return transact(path, (document, legacy) => {
    let changed = legacy;
    for (const record of document.applications) {
      const applicationUrl = parsedUrls.data[record.applicationId];
      if (legacy && !applicationUrl) throw new Error("application_url_required");
      if (applicationUrl && record.applicationUrl !== applicationUrl) {
        record.applicationUrl = applicationUrl;
        changed = true;
      }
    }
    return { changed, result: document };
  });
}
