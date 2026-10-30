import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { initializeRuntime } from "../runtime.js";
import { matchingContext, saveMatchingPreferences, type MatchingPaths } from "./matching.js";
import { rememberWorkspace } from "./workspaces.js";
import { loadExample } from "../example.js";

const line = z.string().trim().min(1).max(2000);
const rules = z.object({
  categories: z.array(z.enum(["llm", "recommendation"])).min(1),
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
  preferences: z.string().trim().min(1).max(20000), rules
}).strict();

export function workspaceMatchingPaths(directory: string): MatchingPaths {
  const data = join(resolve(directory), "data");
  return { profile: join(data, "candidate.json"), preferences: join(data, "preferences.md"), manifest: join(data, "resumes.json"), opportunities: join(data, "opportunities.json") };
}

/** Search intake is deliberately smaller than employer-application onboarding. */
export async function createMatchingWorkspace(directory: string, input: unknown, registryPath?: string) {
  const parsed = intake.parse(input);
  const metadata = z.record(z.unknown()).parse(parsed.candidate._meta ?? {});
  if (metadata.linkedinImport !== undefined) {
    const imported = z.object({ sourceUrl: z.string(), observedAt: z.string().datetime(), state: z.literal("pending_confirmation"), evidence: z.array(z.object({ field: z.string(), reference: z.string() }).strict()) }).strict().parse(metadata.linkedinImport);
    metadata.linkedinImport = { ...imported, state: "confirmed", confirmedAt: new Date().toISOString(), confirmationReference: parsed.reference };
  }
  if (!parsed.candidate.education?.length && !parsed.candidate.experiences?.length) throw new Error("matching_background_required");
  const root = resolve(directory);
  // Exclusive initialization: a second candidate can never overwrite or merge with a current case.
  await initializeRuntime(root);
  try {
    const paths = workspaceMatchingPaths(root);
    await writeFile(paths.profile, JSON.stringify({ ...parsed.candidate,
      _meta: { ...metadata, intake: { reference: parsed.reference, confirmedAt: new Date().toISOString() } }
    }, null, 2) + "\n", { mode: 0o600, flag: "wx" });
    await writeFile(paths.preferences, "# Candidate search preferences\n\n" + parsed.preferences + "\n", { mode: 0o600, flag: "wx" });
    // Search needs an explicit category, but does not need an approved application attachment.
    await writeFile(paths.manifest, "[]\n", { mode: 0o600, flag: "wx" });
    const initial = await matchingContext(paths);
    await saveMatchingPreferences(paths, { expectedToken: initial.token, initialRules: parsed.rules,
      feedback: { id: randomUUID(), text: "Confirmed search intake; read the complete preference prose", reference: parsed.reference, at: new Date().toISOString(), patch: {} } });
    const context = await matchingContext(paths);
    // Index failure must not destroy a valid candidate workspace.
    let registryWarning: string | undefined;
    try { await rememberWorkspace(root, registryPath); } catch { registryWarning = "workspace_index_update_failed"; }
    return { ok: true, root, paths, context, ...(registryWarning ? { registryWarning } : {}), next: "Read all inputs, browse supported sources and official pages, then publish a current assessed round. Application preflight remains required before filling." };
  } catch (error) {
    // Only the directory exclusively created by this call is removed on failure.
    await rm(root, { recursive: true, force: true });
    throw error;
  }
}

export async function readIntakeFile(path: string): Promise<unknown> {
  return JSON.parse(await readFile(resolve(path), "utf8"));
}

/** Isolate the saved fictional inputs before live research, without running scripted rounds. */
export async function createExampleSearchWorkspace(directory: string, registryPath?: string) {
  const root = resolve(directory);
  await mkdir(root, { mode: 0o700 });
  try {
    await loadExample(root, resolve(dirname(fileURLToPath(import.meta.url)), "../../examples"));
    let registryWarning: string | undefined;
    try { await rememberWorkspace(root, registryPath); } catch { registryWarning = "workspace_index_update_failed"; }
    return { root, fictional: true, paths: workspaceMatchingPaths(root), ...(registryWarning ? { registryWarning } : {}) };
  } catch (error) { await rm(root, { recursive: true, force: true }); throw error; }
}
