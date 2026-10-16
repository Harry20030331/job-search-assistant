import { randomUUID } from "node:crypto";
import { chmod, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { z } from "zod";
import { chinaJobCategories } from "../jobs/chinaJobLibrary.js";

export const chinaOutreachStatuses = ["draft", "awaiting_review", "contacted", "closed"] as const;
const timestamp = z.string().datetime();
const outreachSchema = z.object({
  outreachId: z.string().min(1),
  jobId: z.string().min(1),
  recruiterName: z.string().min(1),
  category: z.enum(chinaJobCategories),
  cvFilename: z.string().min(1),
  message: z.string().min(1),
  status: z.enum(chinaOutreachStatuses),
  approvedSnapshotId: z.string().min(1).optional(),
  createdAt: timestamp,
  updatedAt: timestamp,
  sentAt: timestamp.optional()
}).strict().superRefine((record, context) => {
  if (record.updatedAt < record.createdAt) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "invalid_chronology", path: ["updatedAt"] });
  }
  if (record.sentAt && (record.sentAt < record.createdAt || record.sentAt > record.updatedAt)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "invalid_chronology", path: ["sentAt"] });
  }
  if (record.status === "contacted" && (!record.approvedSnapshotId || !record.sentAt)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "contact_evidence_required", path: ["status"] });
  }
});

const trackerSchema = z.object({
  schemaVersion: z.literal(1),
  outreach: z.array(outreachSchema)
}).strict().superRefine((document, context) => {
  const outreachIds = new Set<string>();
  const jobIds = new Set<string>();
  document.outreach.forEach((record, index) => {
    if (outreachIds.has(record.outreachId) || jobIds.has(record.jobId)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "duplicate_china_outreach", path: ["outreach", index] });
    }
    outreachIds.add(record.outreachId);
    jobIds.add(record.jobId);
  });
});

export type ChinaOutreachRecord = z.infer<typeof outreachSchema>;
export type ChinaOutreachTracker = z.infer<typeof trackerSchema>;

function validate(value: unknown): ChinaOutreachTracker {
  const result = trackerSchema.safeParse(value);
  if (!result.success) {
    const duplicate = result.error.issues.some((issue) => issue.message === "duplicate_china_outreach");
    throw new Error(duplicate ? "duplicate_china_outreach" : "invalid_china_outreach_tracker");
  }
  return result.data;
}

export async function readChinaOutreachTracker(path: string): Promise<ChinaOutreachTracker> {
  try {
    return validate(JSON.parse(await readFile(path, "utf8")));
  } catch (error) {
    if (error instanceof Error && ["duplicate_china_outreach", "invalid_china_outreach_tracker"].includes(error.message)) throw error;
    throw new Error("invalid_china_outreach_tracker");
  }
}

export async function writeChinaOutreachTracker(path: string, document: ChinaOutreachTracker): Promise<void> {
  const validated = validate(document);
  const temporary = join(dirname(path), `.${randomUUID()}.tmp`);
  await writeFile(temporary, `${JSON.stringify(validated, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  await rename(temporary, path);
  await chmod(path, 0o600);
}
