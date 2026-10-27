import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { startReviewServer } from "../review/reviewServer.js";
import { resolveRecoveryInputs } from "../review/reviewRecovery.js";
import { ensureExampleData } from "../example.js";
import { readReviewBatch } from "../review/reviewStore.js";

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
  const explicitReview = recovered ? undefined : await readReviewBatch(reviewPath);
  const applicationIds = recovered?.applicationIds ??
    explicitReview!.applications.map((application) => application.applicationId);
  const running = await startReviewServer({
    reviewPath,
    trackerPath,
    jobsPath,
    chinaJobsPath,
    chinaOutreachPath,
    profilePath: "profilePath" in parsed && parsed.profilePath ? resolve(parsed.profilePath) : undefined,
    googleRoot: "googleRoot" in parsed && parsed.googleRoot ? resolve(parsed.googleRoot) : undefined,
    port: parsed.port
  });
  process.stdout.write(formatReviewServerStartup(running.address, reviewPath, applicationIds));
  process.stdout.write(`interviews_url=${running.address}/interviews\n`);
}

if (process.argv[1] && modulePath === resolve(process.argv[1])) {
  await runReviewServerCli(process.argv.slice(2));
}
