import { userFiles } from "../storage/userWorkspace.js";
import { writePrivateFile as writeFile } from "../storage/privateFiles.js";
import { randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, readdir, realpath, rename } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { acquireFileLock } from "../recordLock.js";
import { loadCandidateProfile } from "../profile.js";
import { readOpportunities } from "../storage/opportunities.js";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const defaultRegistryPath = join(projectRoot, "local/search-workspaces.json");
const registrySchema = z.object({ version: z.literal(1), paths: z.array(z.string().min(1)) }).strict();
const queues = new Map<string, Promise<unknown>>();

/** Local path index only; candidate facts and jobs remain in their canonical workspace. */
export async function rememberWorkspace(workspace: string, registryPath = defaultRegistryPath) {
  const root = await realpath(workspace);
  await readOpportunities(userFiles(root).opportunities);
  const path = resolve(registryPath);
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const result = (queues.get(path) ?? Promise.resolve()).catch(() => undefined).then(async () => {
    const unlock = await acquireFileLock(path);
    try {
      let registry: z.infer<typeof registrySchema> = { version: 1, paths: [] };
      try { registry = registrySchema.parse(JSON.parse(await readFile(path, "utf8"))); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
      if (!registry.paths.includes(root)) registry.paths.push(root);
      const temporary = join(dirname(path), `.${randomUUID()}.tmp`);
      await writeFile(temporary, JSON.stringify(registry, null, 2) + "\n", { mode: 0o600 });
      await rename(temporary, path);
      return root;
    } finally { await unlock(); }
  });
  queues.set(path, result);
  try { return await result; } finally { if (queues.get(path) === result) queues.delete(path); }
}

export interface DiscoveryOptions { project?: string; registry?: string; temporaryRoots?: string[] }

/** Read-only, shallow discovery. Never recursively scan a user's home or arbitrary disk. */
export async function listMatchingWorkspaces(options: DiscoveryOptions = {}) {
  const project = resolve(options.project ?? projectRoot);
  const registry = options.registry ?? join(project, "local/search-workspaces.json");
  const candidates = new Set([project]), registered = new Set<string>();
  const diagnostics: { path: string; error: string }[] = [];
  const scannedRoots: string[] = [];
  try {
    const saved = registrySchema.parse(JSON.parse(await readFile(registry, "utf8")));
    saved.paths.forEach(path => { candidates.add(resolve(path)); registered.add(resolve(path)); });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") diagnostics.push({ path: registry, error: "workspace_index_unreadable" });
  }
  const roots = [join(project, "local/workspaces"), ...(options.temporaryRoots ?? [tmpdir(), "/tmp"])];
  const seenRoots = new Set<string>();
  for (const directory of roots) {
    try {
      const canonical = await realpath(directory);
      if (seenRoots.has(canonical)) continue;
      seenRoots.add(canonical); scannedRoots.push(canonical);
      const children = (await readdir(canonical, { withFileTypes: true }))
        .filter(e => e.isDirectory() && (directory === roots[0] || /matching|job-search/i.test(e.name)))
        .sort((a, b) => a.name.localeCompare(b.name));
      if (children.length > 200) diagnostics.push({ path: canonical, error: "workspace_scan_truncated" });
      children.slice(0, 200).forEach(e => candidates.add(join(canonical, e.name)));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") diagnostics.push({ path: directory, error: "workspace_directory_unreadable" });
    }
  }
  const workspaces: { path: string; candidate: string | null; totalJobs: number; activeJobs: number; lastActivity: string | null; hasResults: boolean }[] = [];
  const seen = new Set<string>();
  for (const directory of candidates) {
    const store = userFiles(directory).opportunities;
    try {
      if ((await lstat(join(directory, "data"))).isSymbolicLink() || (await lstat(store)).isSymbolicLink()) continue;
      const canonical = await realpath(directory);
      if (seen.has(canonical)) continue;
      seen.add(canonical);
      const document = await readOpportunities(store);
      let candidate: string | null = null;
      try {
        const file = userFiles(canonical).profile;
        if (!(await lstat(file)).isSymbolicLink()) candidate = z.object({ fullName: z.string().min(1) }).parse((await loadCandidateProfile(file)).identity).fullName;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") diagnostics.push({ path: canonical, error: "candidate_summary_unavailable" });
      }
      const times = document.opportunities.flatMap(j => [j.lastVerified, ...(typeof j.application?.updatedAt === "string" ? [j.application.updatedAt] : [])]).sort();
      workspaces.push({ path: canonical, candidate, totalJobs: document.opportunities.length,
        activeJobs: document.opportunities.filter(j => j.availability !== "closed" && j.stage !== "closed" && !j.note.startsWith("user-excluded:") && !j.application?.hiddenFromStatus).length,
        lastActivity: times.at(-1) ?? null, hasResults: document.opportunities.length > 0 });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        if (registered.has(directory)) diagnostics.push({ path: directory, error: "saved_workspace_missing" });
      } else diagnostics.push({ path: directory, error: "workspace_data_unreadable" });
    }
  }
  workspaces.sort((a, b) => (b.lastActivity ?? "").localeCompare(a.lastActivity ?? "") || a.path.localeCompare(b.path));
  const searches = workspaces.filter(w => w.hasResults);
  const message = searches.length ? "I found saved searches. Choose one to continue."
    : diagnostics.length ? "No saved search results were found in the readable locations. Some locations could not be checked."
    : "No saved search results were found. You can set up a new candidate or try the fictional example.";
  return { message, searches, emptyWorkspaces: workspaces.filter(w => !w.hasResults), diagnostics, scannedRoots, registryPath: resolve(registry) };
}
