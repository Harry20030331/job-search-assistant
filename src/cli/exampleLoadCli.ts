import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadExample } from "../example.js";
const project = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const args = process.argv.slice(2), values = new Map<string, string>();
if (args.length % 2) throw new Error("Usage: npm run example:load -- [--from <example-directory>] [--dir <workspace>] [--snapshot shortlist|review]");
for (let i = 0; i < args.length; i += 2) {
  const key = args[i]!, value = args[i + 1]!;
  if (!["--from", "--dir", "--snapshot"].includes(key) || values.has(key) || value.startsWith("--")) throw new Error("invalid_cli_arguments");
  values.set(key, value);
}
try {
  const workspace = resolve(values.get("--dir") ?? project);
  const snapshot = values.get("--snapshot");
  if (snapshot !== undefined && snapshot !== "shortlist" && snapshot !== "review") throw new Error("invalid_example_snapshot");
  const result = await loadExample(workspace, resolve(values.get("--from") ?? resolve(project, "examples")), snapshot);
  console.log(JSON.stringify({ ok: true, workspace, candidate: result.candidateName, snapshot: result.snapshot, entryPath: result.entryPath, applications: result.applicationCount, backupPath: result.backupPath, next: "Start Review to use the loaded state." }, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : "example_load_failed");
  process.exitCode = 1;
}
