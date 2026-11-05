import { userFiles } from "./storage/userWorkspace.js";
import { randomUUID } from "node:crypto";
import { lstat, mkdir, mkdtemp, readFile, readdir, rename, rm } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { initializeRuntimeData } from "./runtime.js";
import { runPreflight } from "./preflight.js";
import { resolveRecoveryInputs } from "./review/reviewRecovery.js";
import { readDiscovery } from "./storage/discovery.js";
import { makePrivate, writePrivateFile } from "./storage/privateFiles.js";

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
    await makePrivate(target);
    for (const name of await readdir(source)) await copyPrivate(join(source, name), join(target, name));
  } else if (metadata.isFile()) {
    await mkdir(dirname(target), { recursive: true, mode: 0o700 });
    await writePrivateFile(target, await readFile(source));
  } else throw new Error("invalid_example_file");
}

async function stageLegacyExample(staging: string, source: string, progress: string) {
  const candidate = JSON.parse(await readFile(join(source, "candidate.json"), "utf8"));
  if (candidate.fictional !== true) throw new Error("fictional_example_required");
  const manifest = JSON.parse(await readFile(join(source, "resumes.json"), "utf8"));
  if (!Array.isArray(manifest) || !manifest.length) throw new Error("invalid_example_manifest");
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
    if (await exists(join(progress, name))) await copyPrivate(join(progress, name), join(stagedData, name));
  }
}

/** Load a complete fictional case into data, replacing rather than merging states. */
export async function loadExample(workspace: string, example?: string, snapshot?: "shortlist" | "review") {
  const root = resolve(workspace), source = resolve(example ?? fileURLToPath(new URL("../evaluation/cases/alex", import.meta.url))), data = join(root, "data");
  if (source === data || source.startsWith(data + "/")) throw new Error("example_cannot_be_current_data");
  if (snapshot !== undefined && !["shortlist", "review"].includes(snapshot)) throw new Error("invalid_example_snapshot");
  const selected = snapshot ?? (await exists(join(source, "snapshots/shortlist")) ? "shortlist" : undefined);
  const progress = selected ? join(source, "snapshots", selected) : source;
  if (!await exists(progress) || (selected && !await exists(join(progress, "opportunities.json")))) throw new Error("example_snapshot_not_found");
  if (selected && ((await lstat(join(source, "snapshots"))).isSymbolicLink() || (await lstat(progress)).isSymbolicLink())) throw new Error("example_symlink_not_allowed");
  // Reject an active website runner before replacing its data directory.
  const current = userFiles(root);
  const runnerLock = current.tasks + ".runner.lock";
  if (await exists(runnerLock)) {
    const pid = Number((await readFile(runnerLock, "utf8")).trim());
    if (!Number.isSafeInteger(pid) || pid <= 0) throw new Error("stop_review_before_loading_example");
    try { process.kill(pid, 0); throw new Error("stop_review_before_loading_example"); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error; }
  }
  // Other writers must also be stopped before changing a whole working state.
  const lock = join(root, ".example-load.lock");
  await mkdir(lock, { mode: 0o700 });
  let staging: string | undefined, backupPath: string | undefined;
  try {
    staging = await mkdtemp(join(root, ".example-load-"));
    if (example || selected) await stageLegacyExample(staging, source, progress);
    else await installAlexPilotData(staging);
    const stagedData = join(staging, "data");
    const staged = userFiles(staging);
    const candidate = JSON.parse(await readFile(staged.profile, "utf8"));
    // Host-specific chat routing survives resets, but never comes from a shared example.
    if (await exists(current.chat)) await copyPrivate(current.chat, staged.chat);
    await resolveRecoveryInputs(staging);
    await readDiscovery(join(staged.runtime, "discovery-state.json"));
    if (await exists(data)) {
      if ((await lstat(data)).isSymbolicLink()) throw new Error("workspace_data_symlink_not_allowed");
      const backups = join(root, "local", "example-backups");
      await mkdir(backups, { recursive: true, mode: 0o700 });
      backupPath = join(backups, randomUUID());
      await rename(data, backupPath);
    }
    try { await rename(stagedData, data); }
    catch (error) { if (backupPath) await rename(backupPath, data); throw error; }
    return { ...(await resolveRecoveryInputs(root)), backupPath, candidateName: candidate.identity.fullName, snapshot: selected, entryPath: selected === "review" ? "/review" : "/status/us" };
  } finally {
    if (staging) await rm(staging, { recursive: true, force: true });
    await rm(lock, { recursive: true, force: true });
  }
}

/** Install the same pre-S1 data used by the Alex memory pilot, in a fresh workspace. */
export async function installAlexPilotData(workspace: string) {
  const seed = fileURLToPath(new URL("../evaluation/cases/alex/data/", import.meta.url));
  const data = join(workspace, "data");
  await mkdir(data, { mode: 0o700 });
  try {
    await copyPrivate(seed, data);
    return await resolveRecoveryInputs(workspace);
  } catch (error) {
    await rm(data, { recursive: true, force: true });
    throw error;
  }
}

/** Ordinary startup preserves existing workspaces. Explicit bundles support earlier snapshots. */
export async function ensureExampleData(workspace: string, example?: string): Promise<void> {
  if (await exists(join(workspace, "data")) || await exists(join(workspace, "reviews"))) return;
  if (example) await loadExample(workspace, example);
  else await installAlexPilotData(workspace);
}
