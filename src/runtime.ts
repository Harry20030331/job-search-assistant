import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { resolveRecoveryInputs, type RecoveryInputs } from "./review/reviewRecovery.js";
import { makePrivate, writePrivateFile } from "./storage/privateFiles.js";

/** Initialize new storage only. Existing storage is never repaired or overwritten here. */
export async function initializeRuntime(directory: string, _now = new Date(), grouped = false): Promise<RecoveryInputs> {
  const root = resolve(directory);
  // Exclusive mkdir rejects existing directories, files and symlinks.
  await mkdir(root, { mode: 0o700 });
  await makePrivate(root);
  return initializeRuntimeData(root, grouped);
}

/** Initialize data inside an existing workspace; never replace existing data. */
export async function initializeRuntimeData(directory: string, grouped = false): Promise<RecoveryInputs> {
  const root = resolve(directory);
  await mkdir(join(root, "data"), { mode: 0o700 });
  await makePrivate(join(root, "data"));
  for (const name of grouped ? ["profile/preferences", "sessions", "opportunities", "runtime"] : ["drafts"]) {
    const path = join(root, "data", name);
    await mkdir(path, { recursive: true, mode: 0o700 });
    await makePrivate(path);
  }
  const files = [
    [grouped ? "data/opportunities/opportunities.json" : "data/opportunities.json", JSON.stringify({ schemaVersion: 1, opportunities: [] }, null, 2)],
    [grouped ? "data/runtime/discovery-state.json" : "data/discovery-state.json", JSON.stringify({ version: 1, sources: {} }, null, 2)]
  ] as const;
  for (const [path, content] of files) {
    await writePrivateFile(join(root, path), content + "\n", { flag: "wx" });
  }
  return resolveRecoveryInputs(root);
}
