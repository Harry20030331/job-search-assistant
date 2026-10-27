import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { linkInterview, publishInterview, readInterviewBoard } from "../interview/workbench.js";

export async function runInterviewTrackCli(args: string[]) {
  const [phase, ...rest] = args;
  if (!["link", "publish", "inspect"].includes(phase ?? "") || rest.length % 2) throw new Error("invalid_arguments");
  const allowed = new Set(["--runtime-dir", "--profile", "--input", "--interview-id", "--workspace", "--expected-revision"]);
  const flags = new Map<string, string>();
  for (let i = 0; i < rest.length; i += 2) {
    if (!allowed.has(rest[i]!) || flags.has(rest[i]!) || !rest[i + 1] || rest[i + 1]!.startsWith("--")) throw new Error("invalid_arguments");
    flags.set(rest[i]!, rest[i + 1]!);
  }
  if (!flags.has("--runtime-dir")) throw new Error("invalid_arguments");
  const root = resolve(flags.get("--runtime-dir")!);
  const paths = { trackerPath: resolve(root, "opportunities.json"), profilePath: resolve(flags.get("--profile") ?? resolve(root, "candidate.json")) };
  if (phase === "link" && flags.has("--input") && !["--workspace", "--interview-id", "--expected-revision"].some(k => flags.has(k))) {
    return linkInterview(paths, JSON.parse(await readFile(resolve(flags.get("--input")!), "utf8")));
  }
  if (phase === "publish" && !flags.has("--input") && ["--workspace", "--interview-id", "--expected-revision"].every(k => flags.has(k))) {
    const revision = Number(flags.get("--expected-revision"));
    if (!Number.isSafeInteger(revision) || revision < 1) throw new Error("invalid_arguments");
    return publishInterview(paths, flags.get("--interview-id")!, flags.get("--workspace")!, revision);
  }
  if (phase === "inspect" && !["--input", "--workspace", "--interview-id", "--expected-revision"].some(k => flags.has(k))) return readInterviewBoard(paths);
  throw new Error("invalid_arguments");
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try { console.log(JSON.stringify(await runInterviewTrackCli(process.argv.slice(2)), null, 2)); }
  catch { console.error("interview_tracking_failed"); process.exitCode = 1; }
}
