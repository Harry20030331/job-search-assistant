import { userFiles } from "../storage/userWorkspace.js";
import { resumeCategorySchema } from "../classification.js";
import { createHash, randomUUID } from "node:crypto";
import { readFile, rename, mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { z } from "zod";
import { acquireFileLock } from "../recordLock.js";
import { writePrivateFile } from "../storage/privateFiles.js";
import { matchingContext, replaceSearchNotes, searchNotesEditor, saveMatchingPreferences, withPreferences } from "../matching/matching.js";
import { workspaceMatchingPaths } from "../matching/intake.js";

const line = z.string().trim().max(2000);
export const profileFields = z.object({
  fullName: line.min(1), email: z.union([z.literal(""), z.string().email()]), phone: line,
  summary: z.string().trim().min(1).max(16000), skills: z.array(line.min(1)).min(1).max(100),
  education: z.array(z.object({ institution: line, degree: line, field: line }).strict()).max(40),
  experiences: z.array(z.object({ employer: line, title: line, description: z.string().max(16000) }).strict()).max(60)
}).strict();
const digest = (text: string) => createHash("sha256").update(text).digest("hex");
const queues = new Map<string, Promise<unknown>>();
async function locked<T>(path: string, fn: () => Promise<T>) {
  const result = (queues.get(path) ?? Promise.resolve()).catch(() => {}).then(async () => {
    const release = await acquireFileLock(path);
    try { return await fn(); } finally { await release(); }
  });
  queues.set(path, result);
  try { return await result; } finally { if (queues.get(path) === result) queues.delete(path); }
}
async function replace(path: string, value: string) {
  const temporary = join(dirname(path), `.${randomUUID()}.tmp`);
  try { await writePrivateFile(temporary, value, { flag: "wx" }); await rename(temporary, path); }
  finally { await rm(temporary, { force: true }); }
}
export async function readProfileEditor(root: string) {
  const paths = workspaceMatchingPaths(root);
  const raw = await readFile(paths.profile, "utf8");
  const context = await matchingContext(paths);
  const files = userFiles(root);
  const documents = files.grouped ? await Promise.all([files.application, files.interview].map(async file => {
    const content = await readFile(file, "utf8");
    return { content, revision: digest(content) };
  })) : undefined;
  return { ...context, searchNotes: searchNotesEditor(context.preferences), documents, profileRevision: digest(raw), editable: JSON.parse(raw).schemaVersion === 2 };
}
export async function saveProfileEditor(root: string, input: unknown) {
  const command = z.object({ revision: z.string(), confirmed: z.literal(true), fields: profileFields }).strict().parse(input);
  const path = workspaceMatchingPaths(root).profile;
  return withPreferences(workspaceMatchingPaths(root).preferences, () => locked(path, async () => {
    const raw = await readFile(path, "utf8");
    if (digest(raw) !== command.revision) throw new Error("profile_changed");
    const previous = JSON.parse(raw);
    if (previous.schemaVersion !== 2) throw new Error("shared_profile_read_only");
    // Keep all unedited facts and per-entry metadata. Removing/reordering source records is deliberately unavailable.
    if ((previous.education?.length ?? 0) > command.fields.education.length || (previous.experiences?.length ?? 0) > command.fields.experiences.length) throw new Error("invalid_request");
    const f = command.fields;
    const mergeEntries = (key: "education" | "experiences") => f[key].map((entry, i) => ({ ...previous[key]?.[i], ...entry, ...(key === "experiences" && previous[key]?.[i]?.company !== undefined ? { company: (entry as { employer?: string }).employer } : {}) }));
    const candidate = { ...previous, identity: { ...previous.identity, fullName: f.fullName },
      contact: { ...previous.contact, email: f.email, phone: f.phone }, summary: f.summary, skills: f.skills,
      education: mergeEntries("education"), experiences: mergeEntries("experiences"),
      _meta: { ...previous._meta, websiteProfileConfirmedAt: new Date().toISOString() } };
    await replace(path, JSON.stringify(candidate, null, 2) + "\n");
    return readProfileEditor(root);
  }));
}
export async function saveWebsitePreferences(root: string, input: unknown) {
  if (typeof input === "object" && input && "document" in input) {
    if (input.document === "job-selection") {
      const edit = z.object({ document: z.literal("job-selection"), revision: z.string(), content: z.string().max(20000) }).strict().parse(input);
      await replaceSearchNotes(userFiles(root), edit.revision, edit.content);
      return readProfileEditor(root);
    }
    const edit = z.object({ document: z.enum(["application", "interview"]), revision: z.string(),
      content: z.string().max(20000) }).strict().parse(input);
    const files = userFiles(root);
    if (!files.grouped) throw new Error("invalid_request");
    await withPreferences(files.preferences, async () => {
      const path = files[edit.document];
      if (digest(await readFile(path, "utf8")) !== edit.revision) throw new Error("profile_changed");
      await replace(path, edit.content);
    });
    return readProfileEditor(root);
  }
  const command = z.object({ token: z.string(), directions: z.array(line.min(1)), locations: z.array(line.min(1)),
    flexibleDirection: z.boolean().optional(), flexibleLocation: z.boolean().optional(),
    workModes: z.array(z.enum(["remote", "hybrid", "onsite"])), feedback: z.string().trim().default("") }).strict().parse(input);
  if (!command.flexibleDirection && !command.directions.length) throw new Error("preference_direction_required");
  if (command.flexibleLocation === false && !command.locations.length) throw new Error("preference_location_required");
  if (!command.workModes.length) throw new Error("preference_work_mode_required");
  if (command.feedback.length > 20000) throw new Error("preference_feedback_too_long");
  const directions = command.flexibleDirection ? [] : command.directions;
  const locations = command.flexibleLocation ? [] : command.locations;
  const paths = workspaceMatchingPaths(root);
  const context = await matchingContext(paths);
  if (context.token !== command.token) throw new Error("matching_context_changed");
  const rules = { categories: directions, locations, workModes: command.workModes,
    excludedCompanies: [], excludedJobIds: [], limit: 10, perCompany: 2 };
  await saveMatchingPreferences(paths, { expectedToken: command.token, ...(!context.policy ? { initialRules: rules } : {}),
    feedback: { id: randomUUID(), text: command.feedback || "Updated search preferences on the website", reference: "Confirmed on Profile & preferences", at: new Date().toISOString(),
      patch: { categories: directions, locations, workModes: command.workModes } } });
  return readProfileEditor(root);
}
export async function saveWebsiteResume(root: string, input: unknown) {
  const command = z.object({ token: z.string(), category: resumeCategorySchema,
    filename: z.string().min(1).max(200), base64: z.string().max(14_000_000), approved: z.literal(true) }).strict().parse(input);
  const paths = workspaceMatchingPaths(root);
  return withPreferences(paths.preferences, async () => {
    const context = await matchingContext(paths);
    if (context.token !== command.token) throw new Error("matching_context_changed");
    if (!/\.pdf$/i.test(command.filename) || !/^[A-Za-z0-9+/]+={0,2}$/.test(command.base64)) throw new Error("invalid_resume");
    const bytes = Buffer.from(command.base64, "base64");
    if (bytes.length > 10_000_000 || bytes.subarray(0, 5).toString() !== "%PDF-") throw new Error("invalid_resume");
    // Never silently change an approved mapping used by existing applications.
    if (context.manifest.some(item => item.category === command.category)) throw new Error("resume_profile_exists");
    const relative = `resumes/${randomUUID()}.pdf`;
    await mkdir(join(dirname(paths.manifest), "resumes"), { recursive: true, mode: 0o700 });
    const file = join(dirname(paths.manifest), relative);
    await writePrivateFile(file, bytes, { flag: "wx" });
    try {
      const resumes = [...context.manifest, { category: command.category, path: relative, sha256: createHash("sha256").update(bytes).digest("hex") }];
      const document = paths.manifest === paths.profile
        ? { ...JSON.parse(await readFile(paths.profile, "utf8")), resumes }
        : resumes;
      await replace(paths.manifest, JSON.stringify(document, null, 2) + "\n");
    }
    catch (error) { await rm(file, { force: true }); throw error; }
    return readProfileEditor(root);
  });
}
