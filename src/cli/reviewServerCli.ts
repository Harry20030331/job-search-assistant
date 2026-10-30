import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { startReviewServer } from "../review/reviewServer.js";
import { resolveRecoveryInputs } from "../review/reviewRecovery.js";
import { ensureExampleData } from "../example.js";
import { readReviewBatch, initializeReviewOrder } from "../review/reviewStore.js";
import { ApplicationTaskService, demoTaskExecutor } from "../review/applicationTasks.js";
import { readChatTaskConfig, createChatTaskDispatcher } from "../review/chatTaskBridge.js";
import { codexTaskExecutor } from "../review/codexTaskExecutor.js";
import { assertLiveCandidate } from "../review/liveCandidate.js";

export interface ReviewServerCliArgs {
  reviewPath: string;
  trackerPath: string;
  jobsPath: string;
  chinaJobsPath?: string;
  chinaOutreachPath?: string;
  port: number;
}

export function parseReviewServerArgs(argv: readonly string[]): ReviewServerCliArgs {
  const allowed = new Set(["--review", "--tracker", "--jobs", "--china-jobs", "--china-outreach", "--port"]);
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
  return { reviewPath, trackerPath, jobsPath, chinaJobsPath, chinaOutreachPath, port };
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

export async function runReviewServerCli(argv: readonly string[], projectRoot = defaultProjectRoot): Promise<void> {
  if (argv[0] === "--runtime-dir") {
    if (argv.length !== 2 || !argv[1] || argv[1].startsWith("--")) throw new Error("invalid_cli_arguments");
    projectRoot = resolve(argv[1]);
    argv = [];
  }
  if (argv.length === 0) await ensureExampleData(projectRoot, resolve(defaultProjectRoot, "examples"));
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
  if (mode === "codex") await assertLiveCandidate(projectRoot);
  const chat = await readChatTaskConfig(projectRoot);
  const tasks = new ApplicationTaskService({ reviewPath, trackerPath, jobsPath, taskPath: resolve(dirname(trackerPath), "application-tasks.json") },
    mode, mode === "demo" ? demoTaskExecutor : codexTaskExecutor(projectRoot, process.env.CODEX_CLI_PATH ?? "codex"), chat ? createChatTaskDispatcher(projectRoot, chat) : undefined);
  await tasks.start();
  const running = await startReviewServer({
    reviewPath,
    trackerPath,
    jobsPath,
    chinaJobsPath,
    chinaOutreachPath,
    port: parsed.port,
    tasks
  });
  const stop = async () => { await tasks.close(); await running.close(); process.exit(0); };
  process.once("SIGTERM", () => { void stop(); });
  process.once("SIGINT", () => { void stop(); });
  process.stdout.write(`application_runner=${mode}\napplication_dispatch=${chat ? "chat" : "runner"}\n`);
  process.stdout.write(formatReviewServerStartup(running.address, reviewPath, applicationIds));
}

if (process.argv[1] && modulePath === resolve(process.argv[1])) {
  await runReviewServerCli(process.argv.slice(2));
}
