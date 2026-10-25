import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { matchingContext, publishMatchingRound, saveMatchingPreferences, type MatchingPaths } from "../matching/matching.js";

export async function runMatchingCli(args: string[]) {
  const [operation, ...rest] = args;
  if (!["context", "feedback", "publish"].includes(operation ?? "") || rest.length % 2) throw new Error("invalid_arguments");
  const options = new Map<string, string>();
  for (let i = 0; i < rest.length; i += 2) {
    const key = rest[i]!, value = rest[i + 1]!;
    if (!["--profile", "--preferences", "--manifest", "--opportunities", "--input"].includes(key) || options.has(key) || value.startsWith("--")) throw new Error("invalid_arguments");
    options.set(key, value);
  }
  const paths: MatchingPaths = {
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
  try { console.log(JSON.stringify(await runMatchingCli(process.argv.slice(2)), null, 2)); }
  catch (error) {
    const message = error instanceof Error ? error.message : "";
    console.error(/^matching_[a-z_]+$|^duplicate_(feedback_id|matching_assessment)$|^invalid_arguments$/.test(message) ? message : "matching_failed");
    process.exitCode = 1;
  }
}
