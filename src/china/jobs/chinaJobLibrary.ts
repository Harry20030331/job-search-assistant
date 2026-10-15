import { randomUUID } from "node:crypto";
import { chmod, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { z } from "zod";

export const chinaJobLibraryHeader = "job_id,company,title,location,category,boss_url,recruiter_name,recruiter_title,first_seen,last_verified,status,note";
export const chinaJobCategories = ["agent", "robotics"] as const;
export const chinaJobStatuses = ["discovered", "ready_to_contact", "awaiting_review", "contacted", "closed"] as const;

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const bossUrl = z.string().url().refine((value) => {
  const hostname = new URL(value).hostname.toLowerCase();
  return hostname === "zhipin.com" || hostname.endsWith(".zhipin.com");
});
const chinaJobSchema = z.object({
  jobId: z.string().min(1),
  company: z.string().min(1),
  title: z.string().min(1),
  location: z.string().min(1),
  category: z.enum(chinaJobCategories),
  bossUrl,
  recruiterName: z.string(),
  recruiterTitle: z.string(),
  firstSeen: date,
  lastVerified: date,
  status: z.enum(chinaJobStatuses),
  note: z.string().refine((value) => !/[\r\n]/.test(value))
}).strict().refine((record) => record.lastVerified >= record.firstSeen);

export type ChinaJobRecord = z.infer<typeof chinaJobSchema>;

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]!;
    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else quoted = false;
      } else field += character;
    } else if (character === '"') {
      if (field) throw new Error("invalid_china_job_library");
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += character;
  }
  if (quoted) throw new Error("invalid_china_job_library");
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function csvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

function validateRecords(records: unknown[]): ChinaJobRecord[] {
  const parsed = records.map((record) => {
    const result = chinaJobSchema.safeParse(record);
    if (!result.success) throw new Error("invalid_china_job_library");
    return result.data;
  });
  const jobIds = new Set<string>();
  const urls = new Set<string>();
  for (const record of parsed) {
    if (jobIds.has(record.jobId) || urls.has(record.bossUrl)) throw new Error("duplicate_china_job");
    jobIds.add(record.jobId);
    urls.add(record.bossUrl);
  }
  return parsed;
}

export async function readChinaJobLibrary(path: string): Promise<ChinaJobRecord[]> {
  let rows: string[][];
  try {
    rows = parseCsv(await readFile(path, "utf8"));
  } catch (error) {
    if (error instanceof Error && error.message === "invalid_china_job_library") throw error;
    throw new Error("invalid_china_job_library");
  }
  const columns = chinaJobLibraryHeader.split(",");
  if (!rows[0] || rows[0].length !== columns.length || rows[0].some((value, index) => value !== columns[index])) {
    throw new Error("invalid_china_job_library");
  }
  const records = rows.slice(1).map((values) => {
    if (values.length !== columns.length) throw new Error("invalid_china_job_library");
    return {
      jobId: values[0], company: values[1], title: values[2], location: values[3], category: values[4],
      bossUrl: values[5], recruiterName: values[6], recruiterTitle: values[7], firstSeen: values[8],
      lastVerified: values[9], status: values[10], note: values[11]
    };
  });
  return validateRecords(records);
}

export async function writeChinaJobLibrary(path: string, records: ChinaJobRecord[]): Promise<void> {
  const validated = validateRecords(records);
  const lines = validated.map((record) => [
    record.jobId, record.company, record.title, record.location, record.category, record.bossUrl,
    record.recruiterName, record.recruiterTitle, record.firstSeen, record.lastVerified, record.status, record.note
  ].map(csvField).join(","));
  const content = `${chinaJobLibraryHeader}\n${lines.join("\n")}${lines.length ? "\n" : ""}`;
  const temporary = join(dirname(path), `.${randomUUID()}.tmp`);
  await writeFile(temporary, content, { encoding: "utf8", mode: 0o600 });
  await rename(temporary, path);
  await chmod(path, 0o600);
}
