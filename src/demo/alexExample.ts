import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { userFiles } from "../storage/userWorkspace.js";
import { installAlexPilotData, loadExample } from "../example.js";
import { makePrivate } from "../storage/privateFiles.js";
import { runReviewServerCli } from "../cli/reviewServerCli.js";

/** Reproduce the saved five-role case without replacing the current candidate. */
async function main() {
  const flags = new Map<string, string>(), args = process.argv.slice(2);
  if (args.length % 2) throw new Error("invalid_alex_demo_arguments");
  for (let i = 0; i < args.length; i += 2) {
    if (!["--dir", "--snapshot", "--port"].includes(args[i]!) || flags.has(args[i]!) || !args[i + 1] || args[i + 1]!.startsWith("--")) throw new Error("invalid_alex_demo_arguments");
    flags.set(args[i]!, args[i + 1]!);
  }
  const snapshot = flags.get("--snapshot"), port = Number(flags.get("--port") ?? "8774");
  if ((snapshot !== undefined && !["shortlist", "review"].includes(snapshot)) || !Number.isInteger(port) || port < 1 || port > 65535) throw new Error("invalid_alex_demo_arguments");
  if (process.env.APPLICATION_RUNNER && process.env.APPLICATION_RUNNER !== "demo") throw new Error("alex_requires_demo_mode");
  const root = resolve(flags.get("--dir") ?? join(tmpdir(), "careeros-alex-" + randomUUID()));
  await mkdir(root); // Existing directories are never reset by this entrypoint.
  await makePrivate(root);
  const result = snapshot
    ? await loadExample(root, fileURLToPath(new URL("../../examples", import.meta.url)), snapshot as "shortlist" | "review")
    : await installAlexPilotData(root);
  console.log(JSON.stringify({ fictional: true, candidate: "Alex Liu", snapshot: snapshot ?? "pilot-initial", runtime: root, employer_actions: 0 }));
  await runReviewServerCli(["--review", result.reviewPath, "--tracker", result.trackerPath, "--jobs", result.jobsPath,
    "--profile", userFiles(root).profile, "--port", String(port)], root);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error instanceof Error ? error.message : "alex_demo_failed"); process.exitCode = 1; });
}
