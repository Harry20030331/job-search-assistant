import { randomUUID } from "node:crypto";
import { chmod, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { z } from "zod";

export const inboundDirections = ["agent", "robotics", "unclassified"] as const;
export const inboundCompanyTiers = ["big_tech", "top_ai_startup", "top_robotics", "other"] as const;
export const inboundStatuses = ["interested", "needs_clarification", "not_interested", "replied", "closed"] as const;
export const inboundNextActions = ["prepare_reply", "ask_clarifying_question", "none", "wait"] as const;

const timestamp = z.string().datetime();
const contactSchema = z.object({
  contactId: z.string().min(1),
  recruiterName: z.string().min(1),
  company: z.string().min(1),
  recruiterTitle: z.string().min(1),
  messageSummary: z.string().min(1),
  direction: z.enum(inboundDirections),
  companyTier: z.enum(inboundCompanyTiers),
  status: z.enum(inboundStatuses),
  reason: z.string().min(1),
  nextAction: z.enum(inboundNextActions),
  firstSeenAt: timestamp,
  lastActivityAt: timestamp,
  relatedJobId: z.string().min(1).optional(),
  replyDraft: z.string().min(1).optional(),
  approvedSnapshotId: z.string().min(1).optional(),
  repliedAt: timestamp.optional()
}).strict().superRefine((contact, context) => {
  if (contact.lastActivityAt < contact.firstSeenAt) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "invalid_chronology", path: ["lastActivityAt"] });
  }
  if (contact.status === "replied" && (!contact.replyDraft || !contact.approvedSnapshotId || !contact.repliedAt)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "reply_evidence_required", path: ["status"] });
  }
});

const trackerSchema = z.object({
  schemaVersion: z.literal(1),
  contacts: z.array(contactSchema)
}).strict().superRefine((document, context) => {
  const contactIds = new Set<string>();
  document.contacts.forEach((contact, index) => {
    if (contactIds.has(contact.contactId)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "duplicate_contact", path: ["contacts", index] });
    }
    contactIds.add(contact.contactId);
  });
});

export type InboundHrContact = z.infer<typeof contactSchema>;
export type InboundHrTracker = z.infer<typeof trackerSchema>;

function validate(value: unknown): InboundHrTracker {
  const result = trackerSchema.safeParse(value);
  if (!result.success) throw new Error("invalid_inbound_hr_tracker");
  return result.data;
}

export async function readInboundHrTracker(path: string): Promise<InboundHrTracker> {
  try {
    return validate(JSON.parse(await readFile(path, "utf8")));
  } catch (error) {
    if (error instanceof Error && error.message === "invalid_inbound_hr_tracker") throw error;
    throw new Error("invalid_inbound_hr_tracker");
  }
}

export async function writeInboundHrTracker(path: string, document: InboundHrTracker): Promise<void> {
  const validated = validate(document);
  const temporary = join(dirname(path), `.${randomUUID()}.tmp`);
  await writeFile(temporary, `${JSON.stringify(validated, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  await rename(temporary, path);
  await chmod(path, 0o600);
}
