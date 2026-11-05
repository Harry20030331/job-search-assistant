import { dataForTracker, filesInData } from "../storage/userWorkspace.js";
import { existsSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { startReviewServer } from "../review/reviewServer.js";
import { resolveRecoveryInputs } from "../review/reviewRecovery.js";
import { ensureExampleData } from "../example.js";
import { readReviewBatch, initializeReviewOrder } from "../review/reviewStore.js";
import { ApplicationTaskService, demoTaskExecutor } from "../review/applicationTasks.js";
import { connectCurrentChat, createChatTaskDispatcher } from "../review/chatTaskBridge.js";
import { codexTaskExecutor } from "../review/codexTaskExecutor.js";
import { assertLiveCandidate } from "../review/liveCandidate.js";

export interface ReviewServerCliArgs {
  reviewPath: string;
  trackerPath: string;
  jobsPath: string;
  chinaJobsPath?: string;
  chinaOutreachPath?: string;
  port: number;
  profilePath?: string;
  googleRoot?: string;
}

export function parseReviewServerArgs(argv: readonly string[]): ReviewServerCliArgs {
  const allowed = new Set(["--review", "--tracker", "--jobs", "--china-jobs", "--china-outreach", "--port", "--profile", "--google-root"]);
  if (argv.length % 2 !== 0) throw new Error("invalid_cli_arguments");
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!flag || !value || value.startsWith("--") || !allowed.has(flag) || values.has(flag)) throw new Error("invalid_cli_arguments");
    values.set(flag, value);
  }
  const reviewPath = values.get("--review");
  const trackerPath = values.get("--tracker");
  const jobsPath = values.get("--jobs");
  const chinaJobsPath = values.get("--china-jobs");
  const chinaOutreachPath = values.get("--china-outreach");
  const port = Number(values.get("--port"));
  if (!reviewPath || !trackerPath || !jobsPath || !Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("invalid_cli_arguments");
  }
  return { reviewPath, trackerPath, jobsPath, chinaJobsPath, chinaOutreachPath, port,
    ...(values.has("--profile") ? { profilePath: values.get("--profile")! } : {}),
    ...(values.has("--google-root") ? { googleRoot: values.get("--google-root")! } : {}) };
}

export function formatReviewServerStartup(address: string, reviewPath: string, applicationIds: readonly string[]): string {
  return [
    `workspace_url=${address}${applicationIds.length ? "/review" : "/status/us"}`,
    `review_url=${address}/review`,
    `us_status_url=${address}/status/us`,
    `review_record=${reviewPath}`,
    `applications=${applicationIds.length}`,
    `application_ids=${applicationIds.join(",")}`,
    "ats_live_state=unverified",
    "recovery_action=re-observe ATS pages; replace snapshots when live continuity is lost"
  ].join("\n") + "\n";
}

const modulePath = fileURLToPath(import.meta.url);
const defaultProjectRoot = resolve(dirname(modulePath), "../..");

export function reviewWorkspaceRoot(trackerPath: string, fallback: string) {
  return basename(dataForTracker(trackerPath)) === "data" ? dirname(dataForTracker(trackerPath)) : fallback;
}

export async function runReviewServerCli(argv: readonly string[], projectRoot = defaultProjectRoot): Promise<void> {
  if (argv[0] === "--runtime-dir") {
    if (argv.length !== 2 || !argv[1] || argv[1].startsWith("--")) throw new Error("invalid_cli_arguments");
    projectRoot = resolve(argv[1]);
    argv = [];
  }
  if (argv.length === 0 && projectRoot !== defaultProjectRoot) await ensureExampleData(projectRoot);
  if (argv.length === 0 && !existsSync(resolve(projectRoot, "data"))) throw new Error("Run npm start to set up your profile or try Alex.");
  const recovered = argv.length === 0 ? await resolveRecoveryInputs(projectRoot) : undefined;
  const parsed = recovered ?? parseReviewServerArgs(argv);
  const reviewPath = resolve(parsed.reviewPath);
  const trackerPath = resolve(parsed.trackerPath);
  const jobsPath = resolve(parsed.jobsPath);
  const chinaJobsPath = parsed.chinaJobsPath ? resolve(parsed.chinaJobsPath) : undefined;
  const chinaOutreachPath = parsed.chinaOutreachPath ? resolve(parsed.chinaOutreachPath) : undefined;
  await initializeReviewOrder(reviewPath);
  const explicitReview = recovered ? undefined : await readReviewBatch(reviewPath);
  const applicationIds = recovered?.applicationIds ??
    explicitReview!.applications.map((application) => application.applicationId);
  const mode = process.env.APPLICATION_RUNNER ?? "demo";
  if (mode !== "demo" && mode !== "codex") throw new Error("invalid_application_runner");
  const workspaceRoot = reviewWorkspaceRoot(trackerPath, projectRoot);
  if (mode === "codex") await assertLiveCandidate(workspaceRoot);
  const chat = await connectCurrentChat(workspaceRoot);
  const dispatchToChat = mode === "codex" && Boolean(chat);
  const files = filesInData(dataForTracker(trackerPath));
  const tasks = new ApplicationTaskService({ reviewPath, trackerPath, jobsPath, taskPath: files.tasks,
    ...(existsSync(files.manifest) ? { matchingPaths: {
      profile: "profilePath" in parsed && parsed.profilePath ? resolve(parsed.profilePath) : files.profile,
      preferences: files.preferences, manifest: files.manifest, opportunities: trackerPath
    } } : {}) },
    mode, mode === "demo" ? demoTaskExecutor : codexTaskExecutor(projectRoot, process.env.CODEX_CLI_PATH ?? "codex"), dispatchToChat ? createChatTaskDispatcher(workspaceRoot, chat!) : undefined);
  await tasks.start();
  const running = await startReviewServer({
    reviewPath,
    trackerPath,
    jobsPath,
    chinaJobsPath,
    chinaOutreachPath,
    profilePath: "profilePath" in parsed && parsed.profilePath ? resolve(parsed.profilePath) : undefined,
    googleRoot: "googleRoot" in parsed && parsed.googleRoot ? resolve(parsed.googleRoot) : undefined,
    port: parsed.port,
    workspaceRoot,
    repositoryRoot: defaultProjectRoot,
    searchRefresh: { automatic: false },
    tasks
  });
  const stop = async () => { await tasks.close(); await running.close(); process.exit(0); };
  process.once("SIGTERM", () => { void stop(); });
  process.once("SIGINT", () => { void stop(); });
  process.stdout.write(`application_runner=${mode}\napplication_dispatch=${dispatchToChat ? "chat" : "runner"}\n`);
  process.stdout.write(formatReviewServerStartup(running.address, reviewPath, applicationIds));
  process.stdout.write(`interviews_url=${running.address}/interviews\n`);
}

if (process.argv[1] && modulePath === resolve(process.argv[1])) {
  await runReviewServerCli(process.argv.slice(2));
}
