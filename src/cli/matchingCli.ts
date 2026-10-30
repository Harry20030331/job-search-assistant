import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { matchingContext, publishMatchingRound, saveMatchingPreferences, type MatchingPaths } from "../matching/matching.js";
import { createMatchingWorkspace, readIntakeFile, workspaceMatchingPaths } from "../matching/intake.js";
import { matchingWelcome } from "../matching/welcome.js";

export async function runMatchingCli(args: string[]) {
  const [operation, ...rest] = args;
  if (operation === "welcome") {
    if (rest.length) throw new Error("invalid_arguments");
    return matchingWelcome;
  }
  if (!["intake", "context", "feedback", "publish"].includes(operation ?? "") || rest.length % 2) throw new Error("invalid_arguments");
  const options = new Map<string, string>();
  for (let i = 0; i < rest.length; i += 2) {
    const key = rest[i]!, value = rest[i + 1]!;
    if (!["--workspace", "--profile", "--preferences", "--manifest", "--opportunities", "--input"].includes(key) || options.has(key) || !value || value.startsWith("--")) throw new Error("invalid_arguments");
    options.set(key, value);
  }
  if (operation === "intake") {
    if (!options.has("--workspace") || !options.has("--input") || options.size !== 2) throw new Error("invalid_arguments");
    return createMatchingWorkspace(options.get("--workspace")!, await readIntakeFile(options.get("--input")!));
  }
  if (options.has("--workspace") && ["--profile", "--preferences", "--manifest", "--opportunities"].some(k => options.has(k))) throw new Error("invalid_arguments");
  const paths: MatchingPaths = options.has("--workspace") ? workspaceMatchingPaths(options.get("--workspace")!) : {
    profile: resolve(options.get("--profile") ?? "data/candidate.json"),
    preferences: resolve(options.get("--preferences") ?? "data/preferences.md"),
    manifest: resolve(options.get("--manifest") ?? "data/resumes.json"),
    opportunities: resolve(options.get("--opportunities") ?? "data/opportunities.json")
  };
  if (operation === "context") {
    if (options.has("--input")) throw new Error("invalid_arguments");
    return matchingContext(paths);
  }
  if (!options.has("--input")) throw new Error("invalid_arguments");
  const input: unknown = JSON.parse(await readFile(resolve(options.get("--input")!), "utf8"));
  return operation === "feedback" ? saveMatchingPreferences(paths, input) : publishMatchingRound(paths, input);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    const result = await runMatchingCli(process.argv.slice(2));
    console.log(typeof result === "string" ? result : JSON.stringify(result, null, 2));
  }
  catch (error) {
    const message = error instanceof Error ? error.message : "";
    console.error(/^matching_[a-z_]+$|^duplicate_(feedback_id|matching_assessment)$|^invalid_arguments$/.test(message) ? message : "matching_failed");
    process.exitCode = 1;
  }
}
