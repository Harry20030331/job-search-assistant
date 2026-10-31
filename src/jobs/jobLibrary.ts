import { writePrivateFile as writeFile } from "../storage/privateFiles.js";
import { isOpportunityPath, readOpportunities, projectJobs, mergeJobs, transactOpportunities } from "../storage/opportunities.js";
import { randomUUID } from "node:crypto";
import { chmod, readFile, rename } from "node:fs/promises";
import { dirname, join } from "node:path";
import { z } from "zod";
import { jobDirectionSchema } from "../classification.js";
import { jobSources } from "./sources.js";

export const jobLibraryHeader = "job_id,company,title,location,category,official_url,sources,first_seen,last_verified,status,note";
export const jobStatuses = ["new", "ready", "in_progress", "final_review", "submitted", "closed"] as const;
const applicationOwnedStatuses = new Set<string>(["in_progress", "final_review", "submitted"]);
const sourceNames = jobSources;

const recordSchema = z.object({
  jobId: z.string().min(1),
  company: z.string().min(1),
  title: z.string().min(1),
  location: z.string().min(1),
  category: jobDirectionSchema,
  officialUrl: z.string().url().startsWith("https://"),
  sources: z.array(z.enum(sourceNames)).min(1),
  firstSeen: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  lastVerified: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(jobStatuses),
  note: z.string().refine((value) => !/[\r\n]/.test(value))
}).strict();

export type JobRecord = z.infer<typeof recordSchema>;
export type NewJobRecord = Omit<JobRecord, "status" | "sources"> & {
  status?: "new" | "ready";
  sources: readonly (typeof sourceNames)[number][];
};

const columns = jobLibraryHeader.split(",");

export function normalizeOfficialUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("invalid_job_record");
  }
  if (url.protocol !== "https:") throw new Error("invalid_job_record");

  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    const normalized = key.toLowerCase();
    if (normalized.startsWith("utm_") || ["ref", "source", "lever-source", "gh_src"].includes(normalized)) {
      url.searchParams.delete(key);
    }
  }
  url.searchParams.sort();
  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.slice(0, -1);
  }
  return url.toString();
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let afterQuote = false;

  const finishField = () => {
    row.push(field);
    field = "";
    afterQuote = false;
  };
  const finishRow = () => {
    finishField();
    rows.push(row);
    row = [];
  };

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]!;
    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
          afterQuote = true;
        }
      } else {
        field += character;
      }
      continue;
    }

    if (afterQuote && character !== "," && character !== "\r" && character !== "\n") {
      throw new Error("invalid_job_library");
    }
    if (character === '"') {
      if (field.length > 0 || afterQuote) throw new Error("invalid_job_library");
      quoted = true;
    } else if (character === ",") {
      finishField();
    } else if (character === "\n") {
      finishRow();
    } else if (character === "\r") {
      if (text[index + 1] === "\n") index += 1;
      finishRow();
    } else {
      field += character;
    }
  }

  if (quoted) throw new Error("invalid_job_library");
  if (field.length > 0 || row.length > 0 || afterQuote) finishRow();
  return rows;
}

function csvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

function serializeRecord(record: JobRecord): string {
  return [
    record.jobId,
    record.company,
    record.title,
    record.location,
    record.category,
    record.officialUrl,
    [...new Set(record.sources)].sort().join("|"),
    record.firstSeen,
    record.lastVerified,
    record.status,
    record.note
  ].map(csvField).join(",");
}

function validateRecord(value: unknown, errorName: string): JobRecord {
  const result = recordSchema.safeParse(value);
  if (!result.success) throw new Error(errorName);
  return result.data;
}

export async function readJobLibrary(path: string): Promise<JobRecord[]> {
  if (isOpportunityPath(path)) return projectJobs(await readOpportunities(path)).map(record => validateRecord(record, "invalid_job_library"));
  let rows: string[][];
  try {
    rows = parseCsv(await readFile(path, "utf8"));
  } catch (error) {
    if (error instanceof Error && error.message === "invalid_job_library") throw error;
    throw new Error("invalid_job_library");
  }
  if (rows.length === 0 || rows[0]!.length !== columns.length || rows[0]!.some((value, index) => value !== columns[index])) {
    throw new Error("invalid_job_library");
  }

  return rows.slice(1).map((values) => {
    if (values.length !== columns.length) throw new Error("invalid_job_library");
    return validateRecord({
      jobId: values[0],
      company: values[1],
      title: values[2],
      location: values[3],
      category: values[4],
      officialUrl: values[5],
      sources: values[6]!.split("|"),
      firstSeen: values[7],
      lastVerified: values[8],
      status: values[9],
      note: values[10]
    }, "invalid_job_library");
  });
}

export async function writeJobLibrary(path: string, records: JobRecord[]): Promise<void> {
  if (isOpportunityPath(path)) {
    await transactOpportunities(path, document => mergeJobs(document, records.map(record => validateRecord(record, "invalid_job_library"))));
    return;
  }
  const validated = records.map((record) => validateRecord(record, "invalid_job_library"));
  validated.sort((left, right) => right.firstSeen.localeCompare(left.firstSeen) || left.company.localeCompare(right.company));
  const content = `${jobLibraryHeader}\n${validated.map(serializeRecord).join("\n")}${validated.length > 0 ? "\n" : ""}`;
  const temporaryPath = join(dirname(path), `.${randomUUID()}.tmp`);
  await writeFile(temporaryPath, content, { encoding: "utf8", mode: 0o600 });
  await rename(temporaryPath, path);
  await chmod(path, 0o600);
}

export function upsertRecord(records: JobRecord[], input: NewJobRecord): JobRecord {
  let normalized: JobRecord;
  try {
    normalized = validateRecord({
      ...input,
      officialUrl: normalizeOfficialUrl(input.officialUrl),
      sources: [...new Set(input.sources)].sort(),
      status: input.status ?? "new"
    }, "invalid_job_record");
  } catch {
    throw new Error("invalid_job_record");
  }

  const index = records.findIndex((record) => record.jobId === normalized.jobId || normalizeOfficialUrl(record.officialUrl) === normalized.officialUrl);
  let result = normalized;
  if (index >= 0) {
    const existing = records[index]!;
    const status = applicationOwnedStatuses.has(existing.status)
      ? existing.status
      : existing.status === "ready"
        ? "ready"
        : normalized.status;
    result = validateRecord({
      ...normalized,
      jobId: existing.jobId,
      sources: [...new Set([...existing.sources, ...normalized.sources])].sort(),
      firstSeen: existing.firstSeen < normalized.firstSeen ? existing.firstSeen : normalized.firstSeen,
      status
    }, "invalid_job_record");
    records[index] = result;
  } else {
    records.push(result);
  }
  return result;
}

function closeRecord(records: JobRecord[], jobId: string, lastVerified: string, note: string): JobRecord {
  const index = records.findIndex((record) => record.jobId === jobId);
  if (index < 0) throw new Error("job_not_found");
  const existing = records[index]!;
  let closed: JobRecord;
  try {
    closed = validateRecord({ ...existing, status: "closed", lastVerified, note }, "invalid_job_record");
  } catch {
    throw new Error("invalid_job_record");
  }
  records[index] = closed;
  return closed;
}

const allowedStatusTransitions: Record<(typeof jobStatuses)[number], readonly (typeof jobStatuses)[number][]> = {
  new: ["ready", "closed"],
  ready: ["new", "in_progress", "closed"],
  in_progress: ["final_review", "closed"],
  final_review: ["in_progress", "submitted", "closed"],
  submitted: ["closed"],
  closed: []
};

function setRecordStatus(
  records: JobRecord[],
  jobId: string,
  next: (typeof jobStatuses)[number],
  note?: string
): JobRecord {
  const index = records.findIndex((record) => record.jobId === jobId);
  if (index < 0) throw new Error("job_not_found");
  const existing = records[index]!;
  if (!allowedStatusTransitions[existing.status].includes(next)) throw new Error("invalid_status_transition");
  const updated = validateRecord({ ...existing, status: next, note: note ?? existing.note }, "invalid_job_record");
  records[index] = updated;
  return updated;
}

async function mutateJobs(path: string, change: (records: JobRecord[]) => JobRecord): Promise<JobRecord> {
  if (isOpportunityPath(path)) return transactOpportunities(path, document => {
    const records = projectJobs(document);
    const result = change(records);
    mergeJobs(document, [result]);
    return result;
  });
  const records = await readJobLibrary(path);
  const result = change(records);
  await writeJobLibrary(path, records);
  return result;
}
export function upsertJob(path: string, input: NewJobRecord): Promise<JobRecord> {
  return mutateJobs(path, records => upsertRecord(records, input));
}
export function closeJob(path: string, jobId: string, lastVerified: string, note: string): Promise<JobRecord> {
  return mutateJobs(path, records => closeRecord(records, jobId, lastVerified, note));
}
export function setJobStatus(path: string, jobId: string, next: (typeof jobStatuses)[number], note?: string): Promise<JobRecord> {
  if (isOpportunityPath(path) && applicationOwnedStatuses.has(next)) throw new Error("use_application_lifecycle");
  return mutateJobs(path, records => setRecordStatus(records, jobId, next, note));
}
