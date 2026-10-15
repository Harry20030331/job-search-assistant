import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { initializeRuntime } from "../runtime.js";

export function parseRuntimeInitArgs(args: readonly string[]): string {
  if (args.length !== 2 || args[0] !== "--dir" || !args[1] || args[1].startsWith("--")) {
    throw new Error("invalid_cli_arguments");
  }
  return resolve(args[1]);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    const root = parseRuntimeInitArgs(process.argv.slice(2));
    await initializeRuntime(root);
    process.stdout.write(JSON.stringify({ ok: true, runtimeDirectory: root, applications: 0 }) + "\n");
  } catch {
    process.stderr.write("runtime_initialization_failed: use a new directory with an existing writable parent; existing storage is never overwritten\n");
    process.exitCode = 1;
  }
}
