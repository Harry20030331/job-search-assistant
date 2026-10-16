import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { z } from "zod";
import { markWebsiteConfirmed, reconcileConfirmationBatch, transitionApplication } from "../tracker.js";

export interface ApplicationLifecycleCliIo {
  write(value: string): void;
}

const transitionStatuses = ["closed", "interviewing", "offer"] as const;
const transitionArgumentsSchema = z.object({
  tracker: z.string().min(1),
  applicationId: z.string().min(1),
  status: z.enum(transitionStatuses),
  at: z.string().datetime()
}).strict();

function parseFlags(args: readonly string[], allowed: readonly string[]): Map<string, string> {
  if (args.length !== allowed.length * 2) throw new Error("invalid_arguments");
  const values = new Map<string, string>();
  const allowedFlags = new Set(allowed);
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (!flag || !value || !allowedFlags.has(flag) || values.has(flag)) throw new Error("invalid_arguments");
    values.set(flag, value);
  }
  if (values.size !== allowedFlags.size) throw new Error("invalid_arguments");
  return values;
}

const defaultIo: ApplicationLifecycleCliIo = {
  write: (value) => process.stdout.write(value)
};

export async function runApplicationLifecycleCli(
  argv: readonly string[],
  io: ApplicationLifecycleCliIo = defaultIo
): Promise<number> {
  try {
    const [command, ...args] = argv;
    if (command === "confirm-website") {
      const values = parseFlags(args, ["--tracker", "--application-id", "--evidence", "--at"]);
      const record = await markWebsiteConfirmed(values.get("--tracker")!, values.get("--application-id")!, values.get("--evidence")!, values.get("--at")!);
      io.write(`${JSON.stringify({ ok: true, applicationId: record.applicationId, status: record.status })}\n`);
      return 0;
    }
    if (command === "confirm-batch") {
      const values = parseFlags(args, ["--tracker", "--input"]);
      const result = await reconcileConfirmationBatch(
        values.get("--tracker")!,
        JSON.parse(await readFile(values.get("--input")!, "utf8"))
      );
      io.write(`${JSON.stringify({ ok: true, confirmed: result.confirmed, pending: result.pending })}\n`);
      return 0;
    }
    if (command === "transition") {
      const values = parseFlags(args, ["--tracker", "--application-id", "--status", "--at"]);
      const parsed = transitionArgumentsSchema.parse({
        tracker: values.get("--tracker"),
        applicationId: values.get("--application-id"),
        status: values.get("--status"),
        at: values.get("--at")
      });
      const record = await transitionApplication(
        parsed.tracker,
        parsed.applicationId,
        parsed.status,
        {},
        parsed.at
      );
      io.write(`${JSON.stringify({
        ok: true,
        applicationId: record.applicationId,
        status: record.status
      })}\n`);
      return 0;
    }
    throw new Error("invalid_arguments");
  } catch {
    io.write(`${JSON.stringify({ ok: false, error: "lifecycle_failed" })}\n`);
    return 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  process.exitCode = await runApplicationLifecycleCli(process.argv.slice(2));
}
