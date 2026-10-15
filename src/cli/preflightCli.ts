import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { z } from "zod";
import {
  runBatchPreflight,
  runPreflight,
  type BatchPreflightInput,
  type BatchPreflightResult,
  type PreflightInput,
  type PreflightResult
} from "../preflight.js";

interface CanonicalPathArgs {
  profilePath?: string;
  manifestPath?: string;
}

export interface SinglePreflightCliArgs extends CanonicalPathArgs {
  jobUrl: string;
  category: string;
}

export interface BatchPreflightCliArgs extends CanonicalPathArgs {
  batchPath: string;
}

export type PreflightCliArgs = SinglePreflightCliArgs | BatchPreflightCliArgs;

const batchFileSchema = z.array(z.object({
  applicationId: z.string().min(1),
  jobUrl: z.string(),
  category: z.string()
}).strict()).min(1).max(25);

const maxBatchFileBytes = 64 * 1024;

async function readBoundedBatchJson(path: string): Promise<string> {
  const flags = constants.O_RDONLY | constants.O_NONBLOCK | constants.O_NOFOLLOW;
  const handle = await open(resolve(path), flags);
  try {
    const stats = await handle.stat();
    if (!stats.isFile() || stats.size > maxBatchFileBytes) throw new Error("invalid_batch_file");

    const chunks: Buffer[] = [];
    let total = 0;
    while (total <= maxBatchFileBytes) {
      const chunk = Buffer.allocUnsafe(Math.min(16 * 1024, maxBatchFileBytes + 1 - total));
      const { bytesRead } = await handle.read(chunk, 0, chunk.length, total);
      if (bytesRead === 0) break;
      total += bytesRead;
      if (total > maxBatchFileBytes) throw new Error("invalid_batch_file");
      chunks.push(chunk.subarray(0, bytesRead));
    }
    return Buffer.concat(chunks, total).toString("utf8");
  } finally {
    await handle.close();
  }
}

export function parsePreflightArgs(argv: readonly string[]): PreflightCliArgs {
  if (argv.length % 2 !== 0) throw new Error("invalid_arguments");
  const allowed = new Set(["--batch", "--url", "--category", "--profile", "--manifest"]);
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!flag || !value || value.startsWith("--") || !allowed.has(flag) || values.has(flag)) throw new Error("invalid_arguments");
    values.set(flag, value);
  }
  const paths: CanonicalPathArgs = {};
  if (values.has("--profile")) paths.profilePath = values.get("--profile")!;
  if (values.has("--manifest")) paths.manifestPath = values.get("--manifest")!;
  if (values.has("--batch")) {
    if (values.has("--url") || values.has("--category")) throw new Error("invalid_arguments");
    return { batchPath: values.get("--batch")!, ...paths };
  }
  if (!values.has("--url") || !values.has("--category")) {
    throw new Error("invalid_arguments");
  }
  return { jobUrl: values.get("--url")!, category: values.get("--category")!, ...paths };
}

export interface PreflightCliDependencies {
  preflight(input: PreflightInput): Promise<PreflightResult>;
  batchPreflight?(input: BatchPreflightInput): Promise<BatchPreflightResult>;
  write(value: string): void;
}

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export async function runPreflightCli(
  argv: readonly string[],
  dependencies: PreflightCliDependencies = {
    preflight: runPreflight,
    write: (value) => process.stdout.write(value)
  }
): Promise<number> {
  try {
    const args = parsePreflightArgs(argv);
    const canonicalPaths = {
      manifestPath: args.manifestPath ? resolve(args.manifestPath) : join(projectRoot, "data/resumes.json"),
      profilePath: args.profilePath ? resolve(args.profilePath) : join(projectRoot, "data/candidate.json")
    };
    if ("batchPath" in args) {
      const parsedItems = batchFileSchema.safeParse(JSON.parse(await readBoundedBatchJson(args.batchPath)));
      if (!parsedItems.success) throw new Error("invalid_batch_input");
      const result = await (dependencies.batchPreflight ?? runBatchPreflight)({
        items: parsedItems.data,
        ...canonicalPaths
      });
      dependencies.write(`${JSON.stringify({ ok: true, ready: result.ready, parked: result.parked })}\n`);
    } else {
      const result = await dependencies.preflight({
        category: args.category,
        jobUrl: args.jobUrl,
        ...canonicalPaths
      });
      dependencies.write(`${JSON.stringify({ ok: true, ...result })}\n`);
    }
    return 0;
  } catch {
    dependencies.write(`${JSON.stringify({ ok: false, error: "preflight_failed" })}\n`);
    return 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  process.exitCode = await runPreflightCli(process.argv.slice(2));
}
