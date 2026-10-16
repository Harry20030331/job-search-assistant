import { randomUUID } from "node:crypto";
import { copyFile, lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, chmod } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { initializeRuntimeData } from "./runtime.js";
import { runPreflight } from "./preflight.js";
import { resolveRecoveryInputs } from "./review/reviewRecovery.js";
import { readDiscovery } from "./storage/discovery.js";

async function exists(path: string) {
  try { await lstat(path); return true; } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}
async function copyPrivate(source: string, target: string): Promise<void> {
  const metadata = await lstat(source);
  if (metadata.isSymbolicLink()) throw new Error("example_symlink_not_allowed");
  if (metadata.isDirectory()) {
    await mkdir(target, { recursive: true, mode: 0o700 });
    for (const name of await readdir(source)) await copyPrivate(join(source, name), join(target, name));
  } else if (metadata.isFile()) {
    await mkdir(dirname(target), { recursive: true, mode: 0o700 });
    await copyFile(source, target); await chmod(target, 0o600);
  } else throw new Error("invalid_example_file");
}

/** Load a complete fictional case into data, replacing rather than merging states. */
export async function loadExample(workspace: string, example: string) {
  const root = resolve(workspace), source = resolve(example), data = join(root, "data");
  if (source === data || source.startsWith(data + "/")) throw new Error("example_cannot_be_current_data");
  // The UI and writers must be stopped before changing a whole working state.
  const lock = join(root, ".example-load.lock");
  await mkdir(lock, { mode: 0o700 });
  let staging: string | undefined, backupPath: string | undefined;
  try {
    const candidate = JSON.parse(await readFile(join(source, "candidate.json"), "utf8"));
    if (candidate.fictional !== true) throw new Error("fictional_example_required");
    const manifest = JSON.parse(await readFile(join(source, "resumes.json"), "utf8"));
    if (!Array.isArray(manifest) || !manifest.length) throw new Error("invalid_example_manifest");
    staging = await mkdtemp(join(root, ".example-load-"));
    await initializeRuntimeData(staging);
    const stagedData = join(staging, "data");
    for (const name of ["candidate.json", "preferences.md", "resumes.json"]) await copyPrivate(join(source, name), join(stagedData, name));
    for (const entry of manifest) {
      if (typeof entry.path !== "string" || isAbsolute(entry.path)) throw new Error("example_resume_must_be_relative");
      const local = relative(source, resolve(source, entry.path));
      if (local.startsWith("..") || !local.toLowerCase().endsWith(".pdf")) throw new Error("example_resume_outside_bundle");
      // Check every parent to avoid following a directory symlink out of the bundle.
      let parent = dirname(resolve(source, entry.path));
      while (parent !== source) {
        if ((await lstat(parent)).isSymbolicLink()) throw new Error("example_symlink_not_allowed");
        parent = dirname(parent);
      }
      await copyPrivate(join(source, local), join(stagedData, local));
      await runPreflight({ category: entry.category, jobUrl: "https://careers.example.com/jobs/example", profilePath: join(stagedData, "candidate.json"), manifestPath: join(stagedData, "resumes.json") });
    }
    for (const name of ["opportunities.json", "discovery-state.json", "drafts"]) {
      if (await exists(join(source, name))) await copyPrivate(join(source, name), join(stagedData, name));
    }
    await resolveRecoveryInputs(staging);
    await readDiscovery(join(stagedData, "discovery-state.json"));
    if (await exists(data)) {
      if ((await lstat(data)).isSymbolicLink()) throw new Error("workspace_data_symlink_not_allowed");
      const backups = join(root, "local", "example-backups");
      await mkdir(backups, { recursive: true, mode: 0o700 });
      backupPath = join(backups, randomUUID());
      await rename(data, backupPath);
    }
    try { await rename(stagedData, data); }
    catch (error) { if (backupPath) await rename(backupPath, data); throw error; }
    return { ...(await resolveRecoveryInputs(root)), backupPath, candidateName: candidate.identity.fullName };
  } finally {
    if (staging) await rm(staging, { recursive: true, force: true });
    await rm(lock, { recursive: true, force: true });
  }
}

/** Ordinary startup keeps existing data; a checkout without data uses the default case. */
export async function ensureExampleData(workspace: string, example: string): Promise<void> {
  if (!(await exists(join(workspace, "data"))) && !(await exists(join(workspace, "reviews")))) await loadExample(workspace, example);
}
