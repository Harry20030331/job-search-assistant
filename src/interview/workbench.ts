import { resolveInterviewPython } from "./pythonRuntime.mjs";
import { writePrivateFile as writeFile } from "../storage/privateFiles.js";
import { spawn } from "node:child_process";
import { mkdir, readFile, rename } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { acquireFileLock } from "../recordLock.js";
import { loadCandidateProfile } from "../profile.js";
import { readOpportunities, type Opportunity } from "../storage/opportunities.js";
import { projectApplications } from "../storage/opportunities.js";
import { transitionApplication } from "../tracker.js";
import { sha256 } from "./handoff.js";

const id = z.string().trim().min(1).max(200);
const anchorSchema = z.object({ profile_path: z.string().min(1), identity_hash: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
const provenanceSchema = z.object({ source: z.enum(["email", "human_chat", "synthetic_test_script"]), reference: z.string().trim().min(1).max(2000), verifiedAt: z.string().datetime({ offset: true }) }).strict();
const scheduleSchema = z.object({ start: z.string().datetime({ offset: true }), end: z.string().datetime({ offset: true }),
  timezone: z.string().refine(value => { try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; } })
}).strict().refine(value => Date.parse(value.end) > Date.parse(value.start), "invalid_interview_interval");
const recordSchema = z.object({ interviewId: id, jobId: id, applicationId: id,
  state: z.enum(["invited", "scheduled", "completed", "cancelled"]), schedule: scheduleSchema.nullable(), association: provenanceSchema,
  expectedRevision: z.number().int().positive().nullable()
}).strict().refine(value => value.state !== "scheduled" || value.schedule !== null, "scheduled_time_required");
const entrySchema = z.object({ interviewId: id, jobId: id, applicationId: id,
  state: z.enum(["invited", "scheduled", "completed", "cancelled"]), schedule: scheduleSchema.nullable(), association: provenanceSchema,
  revision: z.number().int().positive(), workspace: z.string().nullable(), updatedAt: z.string().datetime({ offset: true })
}).strict();
const registrySchema = z.object({ schemaVersion: z.literal(1), candidateAnchor: anchorSchema, entries: z.array(entrySchema) }).strict();
const draftSchema = z.object({ budget_minutes: z.number().int().positive(), priorities: z.array(z.string()),
  sections: z.array(z.object({ section_id: z.string(), topic: z.string(), minutes: z.number().positive(), objective: z.string(),
    basis_refs: z.array(z.string()), rationale: z.string().optional(), deliverable: z.string().optional(), depth: z.string().optional(), focus_topics: z.array(z.string()).optional() }).passthrough()),
  unknowns: z.array(z.string()), coverage: z.array(z.object({ area: z.string(), disposition: z.string(), reason: z.string(), section_ids: z.array(z.string()) })).optional()
}).passthrough();
const legacyExerciseSchema = z.object({ kind: z.literal("suggested_practice"), prompt: z.string(), steps: z.array(z.string()),
  answer_points: z.array(z.string()), self_check: z.array(z.string()), basis_refs: z.array(z.string()) }).strict();
const simulationExerciseSchema = legacyExerciseSchema.extend({ exercise_type: z.enum(["case", "coding", "design", "behavioral", "introduction", "motivation", "questions"]),
  scenario: z.string().min(100), artifacts: z.array(z.object({ label: z.string(), format: z.enum(["text", "table", "code"]), content: z.string() }).strict()).min(1),
  constraints: z.array(z.string()).min(2), follow_ups: z.array(z.string()).min(2), timebox_minutes: z.number().int().positive(),
  sample_answer: z.array(z.string()).min(1).max(6).nullable().optional(),
  question_title: z.string().nullable().optional(), question_details: z.array(z.object({ label: z.string(), format: z.enum(["text", "table", "code"]), content: z.string() }).strict()).nullable().optional(),
  clarifying_questions: z.array(z.string()).nullable().optional(), answer_coverage: z.array(z.string()).nullable().optional(), plan_section_id: z.string().nullable().optional(),
  solution: z.object({ language: z.literal("python"), function_name: z.string(), code: z.string(), complexity: z.string(),
    tests: z.array(z.object({ arguments_json: z.string(), expected_json: z.string(), expected_error: z.enum(["ValueError", "TypeError"]).nullable() }).strict()) }).strict().nullable().optional(),
  rubric: z.array(z.object({ criterion: z.string(), strong_answer: z.string(), common_mistake: z.string() }).strict()).min(3) }).strict();
const snapshotSchema = z.object({ schemaVersion: z.literal(1), candidateAnchor: anchorSchema,
  application: z.object({ job_id: id, application_id: id.nullable(), interview_id: id, company: id, role: id }).passthrough(),
  freshness: z.enum(["current", "stale"]),
  generation: z.object({ job_id: id, status: z.enum(["queued", "running", "ready", "failed"]), updated_at: z.string(), error_code: z.string().nullable() }).strict().nullable().optional(),
  proposal: z.object({ proposal_id: id, version: z.number().int().positive(), draft: draftSchema,
    proposal_hash: id, status: z.string() }).strict().nullable(),
  materials: z.object({ material_format: z.literal("simulation-v2").optional(), question_bank: z.array(simulationExerciseSchema).optional(), sections: z.array(z.object({ section_id: z.string(), minutes: z.number(),
    exercises: z.array(z.union([simulationExerciseSchema, legacyExerciseSchema])) }).strict()), unknowns: z.array(z.string()) }).passthrough()
    .superRefine((pack, context) => { if (pack.material_format === "simulation-v2" && pack.sections.some(s => s.exercises.some(e => !("scenario" in e)))) context.addIssue({ code: z.ZodIssueCode.custom, message: "Incomplete simulation practice pack" }); }).nullable(),
  debriefs: z.array(z.object({ record_id: id, occurred_at: z.string(), mode: z.string(), text: z.string(),
    observations: z.array(z.object({ observation: z.string(), next_action: z.string(), status: z.string() }).passthrough()) }).passthrough())
}).strict();
type Registry = z.infer<typeof registrySchema>;
export type InterviewSnapshot = z.infer<typeof snapshotSchema>;
export interface InterviewBoardItem {
  entry: Registry["entries"][number];
  company: string; role: string; location: string; officialUrl: string; applicationStage: string;
  snapshot: InterviewSnapshot | null; problem: string | null;
}
export interface WorkbenchPaths { trackerPath: string; profilePath: string; interviewPath?: string }
const pythonRoot = resolve(dirname(fileURLToPath(import.meta.url)), "python");

function stable(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(stable).join(",") + "]";
  if (value && typeof value === "object") return "{" + Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => JSON.stringify(key) + ":" + stable(item)).join(",") + "}";
  return JSON.stringify(value);
}
export async function candidateAnchor(profilePath: string) {
  profilePath = resolve(profilePath);
  const candidate = await loadCandidateProfile(profilePath);
  const shared = candidate.schemaVersion === 3 ? z.object({ sharedSources: z.object({ profile: z.string() }) }).parse(candidate._meta).sharedSources : null;
  return { profile_path: shared ? resolve(dirname(profilePath), shared.profile) : profilePath, identity_hash: sha256(stable(candidate.identity)) };
}
function registryPath(paths: WorkbenchPaths) { return join(resolve(paths.interviewPath ?? join(dirname(paths.trackerPath), "interviews")), "registry.json"); }
async function registry(paths: WorkbenchPaths): Promise<Registry> {
  const anchor = await candidateAnchor(paths.profilePath);
  let value: Registry;
  try { value = registrySchema.parse(JSON.parse(await readFile(registryPath(paths), "utf8"))); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return { schemaVersion: 1, candidateAnchor: anchor, entries: [] }; throw error; }
  if (stable(value.candidateAnchor) !== stable(anchor)) throw new Error("interview_candidate_changed");
  if (new Set(value.entries.map(entry => entry.interviewId)).size !== value.entries.length) throw new Error("duplicate_interview_identity");
  return value;
}
async function mutate<T>(paths: WorkbenchPaths, change: (value: Registry) => Promise<T>): Promise<T> {
  const path = registryPath(paths);
  await mkdir(dirname(path), { recursive: true });
  const unlock = await acquireFileLock(path);
  try {
    const value = await registry(paths);
    const result = await change(value);
    if (stable(await candidateAnchor(paths.profilePath)) !== stable(value.candidateAnchor)) throw new Error("interview_candidate_changed");
    const temporary = join(dirname(path), "." + randomUUID() + ".tmp");
    await writeFile(temporary, JSON.stringify(registrySchema.parse(value), null, 2) + "\n", { mode: 0o600 });
    await rename(temporary, path);
    return result;
  } finally { await unlock(); }
}
function matchJob(jobs: Opportunity[], jobId: string, applicationId: string) {
  const job = jobs.find(item => item.jobId === jobId);
  if (!job?.application || job.application.applicationId !== applicationId) throw new Error("interview_application_not_found");
  return job;
}

/** Verified recruiting evidence advances the existing application through its domain API. */
export async function linkInterview(paths: WorkbenchPaths, input: unknown) {
  const record = recordSchema.parse(input);
  if (Date.parse(record.association.verifiedAt) > Date.now()) throw new Error("future_interview_evidence");
  return mutate(paths, async value => {
    const existing = value.entries.find(entry => entry.interviewId === record.interviewId);
    if ((existing?.revision ?? null) !== record.expectedRevision) throw new Error("interview_revision_conflict");
    if (existing && (existing.jobId !== record.jobId || existing.applicationId !== record.applicationId)) throw new Error("interview_identity_changed");
    const document = await readOpportunities(paths.trackerPath);
    const job = matchJob(document.opportunities, record.jobId, record.applicationId);
    const application = projectApplications(document).applications.find(item => item.applicationId === record.applicationId)!;
    if (record.state !== "cancelled" && !["interviewing", "offer"].includes(application.status)) {
      await transitionApplication(paths.trackerPath, record.applicationId, "interviewing", {}, record.association.verifiedAt,
        { jobId: job.jobId, company: job.company, title: job.title, jobUrl: job.officialUrl });
    }
    const { expectedRevision: _, ...fields } = record;
    const scheduleChanged = existing && stable(existing.schedule) !== stable(record.schedule);
    const entry = { ...fields, revision: (existing?.revision ?? 0) + 1,
      workspace: scheduleChanged ? null : existing?.workspace ?? null, updatedAt: new Date().toISOString() };
    if (existing) value.entries[value.entries.indexOf(existing)] = entry; else value.entries.push(entry);
    return { status: "interview_linked", interviewId: entry.interviewId, revision: entry.revision };
  });
}

export function exportInterview(workspace: string): Promise<InterviewSnapshot> {
  return new Promise((accept, reject) => {
    const child = spawn(resolveInterviewPython(), ["-m", "interview.dashboard", "--workspace", resolve(workspace)], {
      cwd: pythonRoot, shell: false, stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONDONTWRITEBYTECODE: "1" }
    });
    let output = "", overflow = false;
    const timer = setTimeout(() => { child.kill(); reject(new Error("interview_export_timeout")); }, 15_000);
    child.stdout.setEncoding("utf8").on("data", chunk => { output += chunk; if (output.length > 2_000_000) { overflow = true; child.kill(); } });
    child.stderr.resume();
    child.on("error", () => { clearTimeout(timer); reject(new Error("interview_python_unavailable")); });
    child.on("close", code => {
      clearTimeout(timer);
      if (code !== 0 || overflow) { reject(new Error("interview_export_failed")); return; }
      try { accept(snapshotSchema.parse(JSON.parse(output))); } catch { reject(new Error("interview_export_invalid")); }
    });
  });
}
function checkSnapshot(snapshot: InterviewSnapshot, entry: Registry["entries"][number], anchor: Registry["candidateAnchor"], job: Opportunity) {
  if (stable(snapshot.candidateAnchor) !== stable(anchor) || snapshot.application.job_id !== entry.jobId ||
      snapshot.application.application_id !== entry.applicationId || snapshot.application.interview_id !== entry.interviewId ||
      snapshot.application.company !== job.company || snapshot.application.role !== job.title) throw new Error("interview_run_identity_changed");
}
export async function publishInterview(paths: WorkbenchPaths, interviewId: string, workspace: string, expectedRevision: number,
  exporter = exportInterview) {
  return mutate(paths, async value => {
    const entry = value.entries.find(item => item.interviewId === interviewId);
    if (!entry || entry.revision !== expectedRevision) throw new Error("interview_revision_conflict");
    const job = matchJob((await readOpportunities(paths.trackerPath)).opportunities, entry.jobId, entry.applicationId);
    const snapshot = await exporter(workspace);
    checkSnapshot(snapshot, entry, value.candidateAnchor, job);
    if (snapshot.freshness !== "current") throw new Error("interview_run_stale");
    entry.workspace = resolve(workspace); entry.revision += 1; entry.updatedAt = new Date().toISOString();
    return { status: "interview_run_published", interviewId, revision: entry.revision };
  });
}
export async function readInterviewBoard(paths: WorkbenchPaths, exporter = exportInterview): Promise<InterviewBoardItem[]> {
  const value = await registry(paths);
  const jobs = (await readOpportunities(paths.trackerPath)).opportunities;
  const result: InterviewBoardItem[] = [];
  for (const entry of value.entries) {
    let job: Opportunity;
    try { job = matchJob(jobs, entry.jobId, entry.applicationId); }
    catch { continue; } // Removed/reassigned applications never hydrate another candidate's detail.
    let snapshot: InterviewSnapshot | null = null, problem: string | null = null;
    if (entry.workspace) {
      try { snapshot = await exporter(entry.workspace); checkSnapshot(snapshot, entry, value.candidateAnchor, job); }
      catch { snapshot = null; problem = "The linked preparation run is unavailable or its identity changed. Reconnect it in chat."; }
    }
    result.push({ entry, company: job.company, role: job.title, location: job.location, officialUrl: job.officialUrl,
      applicationStage: job.stage, snapshot, problem });
  }
  if (stable(await candidateAnchor(paths.profilePath)) !== stable(value.candidateAnchor)) throw new Error("interview_candidate_changed");
  return result.sort((a, b) => (a.entry.schedule?.start ?? "9999").localeCompare(b.entry.schedule?.start ?? "9999") || a.entry.interviewId.localeCompare(b.entry.interviewId));
}

/** Keep the registry's explicit recruiting state; elapsed time is a display fact. */
export function interviewEnded(item: InterviewBoardItem, now = Date.now()): boolean {
  return item.entry.state !== "cancelled" && item.entry.schedule !== null &&
    ["scheduled", "completed"].includes(item.entry.state) && Date.parse(item.entry.schedule.end) <= now;
}

export async function withInterviewRun<T>(paths: WorkbenchPaths, interviewId: string, expectedRevision: number,
  change: (item: InterviewBoardItem) => Promise<T>, exporter = exportInterview): Promise<T> {
  return mutate(paths, async () => {
    const item = (await readInterviewBoard(paths, exporter)).find(item => item.entry.interviewId === interviewId);
    if (!item || item.entry.revision !== expectedRevision || !item.entry.workspace || item.entry.state === "cancelled" ||
        !item.snapshot || item.snapshot.freshness !== "current" || item.problem) throw new Error("interview_plan_conflict");
    return change(item);
  });
}
