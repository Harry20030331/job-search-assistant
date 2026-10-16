import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { resolveRecoveryInputs, type RecoveryInputs } from "./review/reviewRecovery.js";

/** Initialize new storage only. Existing storage is never repaired or overwritten here. */
export async function initializeRuntime(directory: string, _now = new Date()): Promise<RecoveryInputs> {
  const root = resolve(directory);
  // Exclusive mkdir rejects existing directories, files and symlinks.
  await mkdir(root, { mode: 0o700 });
  return initializeRuntimeData(root);
}

/** Initialize data inside an existing workspace; never replace existing data. */
export async function initializeRuntimeData(directory: string): Promise<RecoveryInputs> {
  const root = resolve(directory);
  await mkdir(join(root, "data"), { mode: 0o700 });
  await mkdir(join(root, "data/drafts"), { mode: 0o700 });
  const files = [
    ["data/opportunities.json", JSON.stringify({ schemaVersion: 1, opportunities: [] }, null, 2)],
    ["data/discovery-state.json", JSON.stringify({ version: 1, sources: {} }, null, 2)]
  ] as const;
  for (const [path, content] of files) {
    await writeFile(join(root, path), content + "\n", { flag: "wx", mode: 0o600 });
  }
  return resolveRecoveryInputs(root);
}
