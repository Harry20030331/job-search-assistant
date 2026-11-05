import { userFiles } from "../storage/userWorkspace.js";
import { writePrivateFile as writeFile } from "../storage/privateFiles.js";
import { randomUUID } from "node:crypto";
import { lstat, mkdir, mkdtemp, readFile, rename, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { z } from "zod";
import { initializeRuntime } from "../runtime.js";
import { matchingContext, saveMatchingPreferences, type MatchingPaths } from "./matching.js";
import { rememberWorkspace } from "./workspaces.js";
import { installAlexPilotData } from "../example.js";
import { jobDirectionSchema } from "../classification.js";

const line = z.string().trim().min(1).max(2000);
const rules = z.object({
  categories: z.array(jobDirectionSchema),
  workModes: z.array(z.enum(["remote", "hybrid", "onsite"])).min(1),
  locations: z.array(line), excludedCompanies: z.array(line), excludedJobIds: z.array(line),
  limit: z.number().int().min(1).max(25), perCompany: z.number().int().min(1).max(25)
}).strict();
const intake = z.object({
  confirmed: z.literal(true), reference: line,
  candidate: z.object({
    schemaVersion: z.literal(2),
    identity: z.object({ fullName: line }).passthrough(),
    summary: line, skills: z.array(line).min(1),
    education: z.array(z.record(z.unknown())).optional(), experiences: z.array(z.record(z.unknown())).optional()
  }).passthrough(),
  preferences: z.string().trim().min(1).max(20000), applicationPreferences: z.string().trim().max(20000).default(""), interviewPreferences: z.string().trim().max(20000).default(""), rules
}).strict();

export function workspaceMatchingPaths(directory: string): MatchingPaths {
  return userFiles(directory);
}

/** Search intake is deliberately smaller than employer-application onboarding. */
export async function createMatchingWorkspace(directory: string, input: unknown, registryPath?: string | null) {
  const parsed = intake.parse(input);
  const metadata = z.record(z.unknown()).parse(parsed.candidate._meta ?? {});
  if (metadata.linkedinImport !== undefined) {
    const imported = z.object({ sourceUrl: z.string(), observedAt: z.string().datetime(), state: z.literal("pending_confirmation"), evidence: z.array(z.object({ field: z.string(), reference: z.string() }).strict()) }).strict().parse(metadata.linkedinImport);
    metadata.linkedinImport = { ...imported, state: "confirmed", confirmedAt: new Date().toISOString(), confirmationReference: parsed.reference };
  }
  if (!parsed.candidate.education?.length && !parsed.candidate.experiences?.length) throw new Error("matching_background_required");
  const root = resolve(directory);
  // Exclusive initialization: a second candidate can never overwrite or merge with a current case.
  await initializeRuntime(root, new Date(), true);
  try {
    const paths = userFiles(root);
    await writeFile(paths.application, parsed.applicationPreferences + "\n", { flag: "wx" });
    await writeFile(paths.interview, parsed.interviewPreferences + "\n", { flag: "wx" });
    await writeFile(paths.profile, JSON.stringify({ ...parsed.candidate, resumes: [],
      _meta: { ...metadata, intake: { reference: parsed.reference, confirmedAt: new Date().toISOString() } }
    }, null, 2) + "\n", { mode: 0o600, flag: "wx" });
    await writeFile(paths.preferences, "# Candidate search preferences\n\n" + parsed.preferences + "\n", { mode: 0o600, flag: "wx" });
    const initial = await matchingContext(paths);
    await saveMatchingPreferences(paths, { expectedToken: initial.token, initialRules: parsed.rules,
      feedback: { id: randomUUID(), text: "Confirmed search intake; read the complete preference prose", reference: parsed.reference, at: new Date().toISOString(), patch: {} } });
    const context = await matchingContext(paths);
    // Index failure must not destroy a valid candidate workspace.
    let registryWarning: string | undefined;
    try { if (registryPath !== null) await rememberWorkspace(root, registryPath); } catch { registryWarning = "workspace_index_update_failed"; }
    return { ok: true, root, paths, context, ...(registryWarning ? { registryWarning } : {}), next: "Read all inputs, browse supported sources and official pages, then publish a current assessed round. Application preflight remains required before filling." };
  } catch (error) {
    // Only the directory exclusively created by this call is removed on failure.
    await rm(root, { recursive: true, force: true });
    throw error;
  }
}

/** Publish one complete profile into the repository. Repeated confirmations reuse the same intake. */
export async function createPersonalWorkspace(repository: string, input: unknown, requestId: string) {
  const root = resolve(repository);
  const data = join(root, "data");
  async function checkExisting() {
    try { await lstat(data); } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
      throw error;
    }
    const candidate = await readIntakeFile(userFiles(root).profile);
    if (z.object({ _meta: z.object({ websiteIntake: z.object({ requestId: z.literal(requestId) }) }) }).safeParse(candidate).success) return true;
    throw new Error("profile_already_exists");
  }
  if (await checkExisting()) return root;
  const staging = await mkdtemp(join(root, ".intake-"));
  try {
    const prepared = await createMatchingWorkspace(join(staging, "profile"), input, null);
    try { await rename(join(prepared.root, "data"), data); }
    catch (error) {
      if (!["EEXIST", "ENOTEMPTY"].includes((error as NodeJS.ErrnoException).code ?? "") || !await checkExisting()) throw error;
    }
    return root;
  } finally { await rm(staging, { recursive: true, force: true }); }
}

export async function readIntakeFile(path: string): Promise<unknown> {
  return JSON.parse(await readFile(resolve(path), "utf8"));
}

/** Isolate the saved fictional inputs before live research, without running scripted rounds. */
export async function createExampleSearchWorkspace(directory: string, registryPath?: string | null) {
  const root = resolve(directory);
  await mkdir(root, { mode: 0o700 });
  try {
    await installAlexPilotData(root);
    let registryWarning: string | undefined;
    try { if (registryPath !== null) await rememberWorkspace(root, registryPath); } catch { registryWarning = "workspace_index_update_failed"; }
    return { root, fictional: true, paths: workspaceMatchingPaths(root), ...(registryWarning ? { registryWarning } : {}) };
  } catch (error) { await rm(root, { recursive: true, force: true }); throw error; }
}
