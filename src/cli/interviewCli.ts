import { mkdir } from "node:fs/promises";
import { makePrivate } from "../storage/privateFiles.js";
import { filesForRuntime, jobFolder } from "../storage/userWorkspace.js";
import { resolveInterviewPython } from "../interview/pythonRuntime.mjs";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { checkInterviewSources, interviewHandoff, type InterviewPaths } from "../interview/handoff.js";

export const interviewPythonRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../interview/python");
export async function stageInterview(bundle: Awaited<ReturnType<typeof interviewHandoff>>, output: string) {
  await checkInterviewSources(bundle.sourceVersions);
  return new Promise<object>((accept, reject) => {
    const child = spawn(resolveInterviewPython(), ["-m", "interview.team_bridge", "--output", resolve(output)], {
      cwd: interviewPythonRoot, shell: false, stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONDONTWRITEBYTECODE: "1" }
    });
    let stdout = "";
    child.stdout.setEncoding("utf8").on("data", chunk => { stdout += chunk; });
    // Do not echo private source contents or subprocess tracebacks on failure.
    child.stderr.resume();
    child.on("error", () => reject(new Error("interview_python_unavailable")));
    child.on("close", code => {
      if (code !== 0) { reject(new Error("interview_stage_failed")); return; }
      try { accept(JSON.parse(stdout)); } catch { reject(new Error("interview_stage_failed")); }
    });
    child.stdin.on("error", () => reject(new Error("interview_stage_failed")));
    child.stdin.end(JSON.stringify(bundle));
  });
}

export async function runInterviewCli(args: string[]) {
  const [operation, ...rest] = args;
  if (!["context", "stage"].includes(operation ?? "") || rest.length % 2) throw new Error("invalid_arguments");
  const flags = new Map<string, string>();
  const allowed = ["--workspace", "--profile", "--preferences", "--opportunities", "--settings", "--invitation", "--job-id", "--expected-token", "--output"];
  for (let i = 0; i < rest.length; i += 2) {
    const key = rest[i]!, value = rest[i + 1]!;
    if (!allowed.includes(key) || flags.has(key) || !value || value.startsWith("--")) throw new Error("invalid_arguments");
    flags.set(key, value);
  }
  if (!["--settings", "--invitation", "--job-id"].every(key => flags.has(key))) throw new Error("invalid_arguments");
  if (flags.has("--workspace") && ["--profile", "--preferences", "--opportunities"].some(key => flags.has(key))) throw new Error("invalid_arguments");
  if (operation === "context" && (flags.has("--output") || flags.has("--expected-token"))) throw new Error("invalid_arguments");
  if (operation === "stage" && (!flags.has("--expected-token") || (!flags.has("--output") && !flags.has("--workspace")))) throw new Error("invalid_arguments");
  const base = resolve(flags.get("--workspace") ?? "data");
  const files = filesForRuntime(base);
  const paths: InterviewPaths = {
    profile: resolve(flags.get("--profile") ?? files.profile),
    preferences: resolve(flags.get("--preferences") ?? (files.grouped ? files.interview : files.preferences)),
    opportunities: resolve(flags.get("--opportunities") ?? files.opportunities),
    settings: resolve(flags.get("--settings")!), invitation: resolve(flags.get("--invitation")!)
  };
  const bundle = await interviewHandoff(paths, flags.get("--job-id")!);
  if (operation === "context") return bundle;
  if (flags.get("--expected-token") !== bundle.token) throw new Error("interview_stale_context");
  const output = flags.get("--output") ?? (files.grouped
    ? resolve(jobFolder(dirname(files.opportunities), flags.get("--job-id")!), "interviews", "round-" + encodeURIComponent(bundle.application.interview_id))
    : undefined);
  if (!output) throw new Error("invalid_arguments");
  if (files.grouped && !flags.has("--output")) {
    const role = dirname(dirname(output));
    await mkdir(role, { recursive: true, mode: 0o700 });
    await makePrivate(role);
    await mkdir(dirname(output), { recursive: true, mode: 0o700 });
    await makePrivate(dirname(output));
  }
  return stageInterview(bundle, output);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try { console.log(JSON.stringify(await runInterviewCli(process.argv.slice(2)), null, 2)); }
  catch (error) {
    const message = error instanceof Error ? error.message : "";
    console.error(/^interview_[a-z_]+$|^invalid_arguments$/.test(message) ? message : "interview_failed");
    process.exitCode = 1;
  }
}
