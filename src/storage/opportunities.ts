import { resumeRecommendationSchema } from "../matching/resumeRecommendation.js";
import { writePrivateFile as writeFile } from "./privateFiles.js";
import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { chmod, readFile, realpath, rename } from "node:fs/promises";
import { dirname, join } from "node:path";
import { z } from "zod";
import { acquireFileLock } from "../recordLock.js";
import type { JobRecord } from "../jobs/jobLibrary.js";
import { validateApplicationRecords, type ApplicationRecord } from "../tracker.js";
import { isLegacyResumeCategory, jobDirectionSchema, resumeCategorySchema, type ResumeCategory } from "../classification.js";
import { jobSources } from "../jobs/sources.js";

const stages = ["new", "ready", "in_review", "submitted", "interviewing", "offer", "closed"] as const;
type ApplicationData = Omit<ApplicationRecord, "jobId" | "company" | "title" | "location" | "category" | "jobUrl" | "status"> & { resumeCategory?: ResumeCategory };
export type Opportunity = Omit<JobRecord, "status"> & {
  availability: "open" | "closed" | "unknown";
  stage: typeof stages[number];
  application?: ApplicationData;
};
export interface Opportunities { schemaVersion: 1; opportunities: Opportunity[] }
const schema = z.object({
  schemaVersion: z.literal(1),
  opportunities: z.array(z.object({
    jobId: z.string().min(1), company: z.string().min(1), title: z.string().min(1), location: z.string().min(1),
    category: jobDirectionSchema, officialUrl: z.string().url().startsWith("https://"),
    sources: z.array(z.enum(jobSources)).min(1),
    firstSeen: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), lastVerified: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    note: z.string(), availability: z.enum(["open", "closed", "unknown"]), stage: z.enum(stages),
    resumeRecommendation: resumeRecommendationSchema.optional(),
    application: z.record(z.unknown()).optional()
  }).strict())
}).strict();
export function parseOpportunities(value: unknown): Opportunities {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new Error("invalid_opportunities");
  const result = parsed.data as Opportunities;
  const jobs = new Set<string>(), urls = new Set<string>(), applications = new Set<string>();
  for (const item of result.opportunities) {
    if (jobs.has(item.jobId) || urls.has(item.officialUrl)) throw new Error("duplicate_opportunity");
    jobs.add(item.jobId); urls.add(item.officialUrl);
    if (item.application) {
      for (const key of ["jobId", "company", "title", "location", "category", "jobUrl", "status"]) {
        if (key in item.application) throw new Error("duplicated_opportunity_identity");
      }
      if (!item.application.applicationId || applications.has(item.application.applicationId)) throw new Error("duplicate_application");
      applications.add(item.application.applicationId);
      if (["new", "ready"].includes(item.stage)) throw new Error("invalid_opportunity_stage");
    } else if (!["new", "ready", "closed"].includes(item.stage)) throw new Error("application_required");
    if (["submitted", "interviewing", "offer"].includes(item.stage) &&
      (!(item.application?.submittedAt || item.application?.confirmedAt) || item.application?.visibleResult !== "submitted")) throw new Error("submission_evidence_required");
  }
  validateApplicationRecords(projectApplications(result));
  return result;
}
export function isOpportunityPath(path: string): boolean { return path.replaceAll("\\", "/").split("/").at(-1) === "opportunities.json"; }
export async function readOpportunities(path: string): Promise<Opportunities> {
  return parseOpportunities(JSON.parse(await readFile(path, "utf8")));
}
export async function saveOpportunities(path: string, document: Opportunities): Promise<void> {
  const content = JSON.stringify(parseOpportunities(document), null, 2) + "\n";
  const temporary = join(dirname(path), `.${randomUUID()}.tmp`);
  await writeFile(temporary, content, { mode: 0o600 });
  await rename(temporary, path); await chmod(path, 0o600);
}
// One queue and one cross-process lock shared by matching and submission writers.
const queues = new Map<string, Promise<void>>();
export async function transactOpportunities<T>(path: string, change: (document: Opportunities) => T | Promise<T>): Promise<T> {
  const key = await realpath(path);
  const previous = queues.get(key) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const tail = previous.catch(() => undefined).then(() => gate);
  queues.set(key, tail); await previous.catch(() => undefined);
  let unlock: (() => Promise<void>) | undefined;
  try {
    unlock = await acquireFileLock(key);
    const document = await readOpportunities(key);
    const before = JSON.stringify(document);
    const result = await change(document);
    if (JSON.stringify(document) !== before) await saveOpportunities(key, document);
    return result;
  } finally { try { await unlock?.(); } finally { release(); if (queues.get(key) === tail) queues.delete(key); } }
}
export function projectJobs(document: Opportunities): JobRecord[] {
  return document.opportunities.map(({ availability, stage, application, ...job }) => ({
    ...job,
    status: availability === "closed" ? "closed" : stage === "in_review" ? (application?.finalReviewAt ? "final_review" : "in_progress") :
      ["submitted", "interviewing", "offer"].includes(stage) ? "submitted" : stage as "new" | "ready" | "closed"
  }));
}
export function projectApplications(document: Opportunities): { schemaVersion: 3; applications: ApplicationRecord[] } {
  return { schemaVersion: 3, applications: document.opportunities.filter(item => item.application).map(item => {
    const { resumeCategory: _resumeCategory, ...application } = item.application!;
    return { ...application, jobId: item.jobId, company: item.company, title: item.title, location: item.location,
      category: applicationResumeCategory(item), jobUrl: item.officialUrl,
      status: item.stage === "submitted" && (item.application?.confirmedAt || item.application?.gmailConfirmation === "confirmed" || item.application?.websiteConfirmation) ? "confirmed" : item.stage as ApplicationRecord["status"] };
  }) };
}
function applicationResumeCategory(item: Opportunity): ResumeCategory {
  const bound = item.application?.resumeCategory;
  if (bound !== undefined) return resumeCategorySchema.parse(bound);
  if (isLegacyResumeCategory(item.category)) return item.category;
  throw new Error("application_resume_category_required");
}
export function mergeApplications(document: Opportunities, records: ApplicationRecord[]): void {
  for (const record of records) {
    const item = document.opportunities.find(item => item.jobId === record.jobId);
    if (!item) throw new Error("job_not_found");
    const { jobId, company, title, location, category, jobUrl, status, ...application } = record;
    if (company !== item.company || title !== item.title || location !== item.location || jobUrl !== item.officialUrl) throw new Error("opportunity_identity_mismatch");
    if (item.application && category !== applicationResumeCategory(item)) throw new Error("opportunity_identity_mismatch");
    // Projected siblings must not acquire a resume binding during an unrelated update.
    const previous = projectApplications({ schemaVersion: 1, opportunities: [item] }).applications[0];
    if (previous && isDeepStrictEqual(previous, record)) continue;
    item.stage = status === "confirmed" ? "submitted" : status;
    item.application = { ...application, resumeCategory: resumeCategorySchema.parse(category) };
  }
}
export function mergeJobs(document: Opportunities, records: JobRecord[]): void {
  for (const record of records) {
    const existing = document.opportunities.find(item => item.jobId === record.jobId);
    const { status, ...job } = record;
    if (existing) {
      if (existing.application && ["company", "title", "location", "category", "officialUrl"].some(key => job[key as keyof typeof job] !== existing[key as keyof Opportunity])) throw new Error("opportunity_identity_mismatch");
      Object.assign(existing, job);
      existing.availability = status === "closed" ? "closed" : "open";
      if (!existing.application) {
        if (!["new", "ready", "closed"].includes(status)) throw new Error("application_required");
        existing.stage = status as "new" | "ready" | "closed";
      }
    } else {
      if (!["new", "ready", "closed"].includes(status)) throw new Error("application_required");
      document.opportunities.push({ ...job, availability: status === "closed" ? "closed" : "open", stage: status as "new" | "ready" | "closed" });
    }
  }
}
