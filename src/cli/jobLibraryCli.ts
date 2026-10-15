import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import {
  closeJob,
  jobStatuses,
  readJobLibrary,
  setJobStatus,
  upsertJob,
  type NewJobRecord
} from "../jobs/jobLibrary.js";

export interface CliIo {
  out(value: string): void;
  err(value: string): void;
}

const commandFlags = {
  validate: ["--path"],
  upsert: [
    "--path", "--job-id", "--company", "--title", "--location", "--category", "--url",
    "--source", "--first-seen", "--last-verified", "--status", "--note"
  ],
  status: ["--path", "--job-id", "--status"],
  close: ["--path", "--job-id", "--last-verified", "--note"]
} as const;

const requiredFlags = {
  validate: ["--path"],
  upsert: [
    "--path", "--job-id", "--company", "--title", "--location", "--category", "--url",
    "--source", "--first-seen", "--last-verified"
  ],
  status: ["--path", "--job-id", "--status"],
  close: ["--path", "--job-id", "--last-verified", "--note"]
} as const;

type Command = keyof typeof commandFlags;

interface ParsedArguments {
  command: Command;
  values: Map<string, string[]>;
}

function invalidArguments(): never {
  throw new Error("invalid_cli_arguments");
}

function parseArguments(args: readonly string[]): ParsedArguments {
  const command = args[0];
  if (command !== "validate" && command !== "upsert" && command !== "status" && command !== "close") invalidArguments();
  const allowed = new Set<string>(commandFlags[command]);
  const values = new Map<string, string[]>();

  for (let index = 1; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (!flag || !allowed.has(flag) || !value || value.startsWith("--")) invalidArguments();
    if (flag !== "--source" && values.has(flag)) invalidArguments();
    values.set(flag, [...(values.get(flag) ?? []), value]);
  }
  if ((args.length - 1) % 2 !== 0) invalidArguments();
  for (const flag of requiredFlags[command]) {
    if (!values.has(flag)) invalidArguments();
  }
  return { command, values };
}

function scalar(values: Map<string, string[]>, flag: string): string {
  const value = values.get(flag)?.[0];
  if (!value) invalidArguments();
  return value;
}

const defaultIo: CliIo = {
  out: (value) => process.stdout.write(value),
  err: (value) => process.stderr.write(value)
};

export async function runJobLibraryCli(args: string[], io: CliIo = defaultIo): Promise<number> {
  let parsed: ParsedArguments;
  try {
    parsed = parseArguments(args);
  } catch {
    io.err("invalid_cli_arguments\n");
    return 1;
  }

  try {
    if (parsed.command === "validate") {
      const records = await readJobLibrary(scalar(parsed.values, "--path"));
      io.out(`${JSON.stringify({ valid: true, count: records.length })}\n`);
      return 0;
    }

    if (parsed.command === "upsert") {
      const statusValue = parsed.values.get("--status")?.[0];
      if (statusValue !== undefined && statusValue !== "new" && statusValue !== "ready") invalidArguments();
      const record = await upsertJob(scalar(parsed.values, "--path"), {
        jobId: scalar(parsed.values, "--job-id"),
        company: scalar(parsed.values, "--company"),
        title: scalar(parsed.values, "--title"),
        location: scalar(parsed.values, "--location"),
        category: scalar(parsed.values, "--category") as NewJobRecord["category"],
        officialUrl: scalar(parsed.values, "--url"),
        sources: parsed.values.get("--source") as NewJobRecord["sources"],
        firstSeen: scalar(parsed.values, "--first-seen"),
        lastVerified: scalar(parsed.values, "--last-verified"),
        status: statusValue,
        note: parsed.values.get("--note")?.[0] ?? ""
      });
      io.out(`${JSON.stringify({ updated: true, jobId: record.jobId, status: record.status })}\n`);
      return 0;
    }

    if (parsed.command === "status") {
      const jobId = scalar(parsed.values, "--job-id");
      const status = scalar(parsed.values, "--status") as (typeof jobStatuses)[number];
      if (!jobStatuses.includes(status)) invalidArguments();
      await setJobStatus(scalar(parsed.values, "--path"), jobId, status);
      io.out(`${JSON.stringify({ updated: true, jobId, status })}\n`);
      return 0;
    }

    const jobId = scalar(parsed.values, "--job-id");
    await closeJob(
      scalar(parsed.values, "--path"),
      jobId,
      scalar(parsed.values, "--last-verified"),
      scalar(parsed.values, "--note")
    );
    io.out(`${JSON.stringify({ closed: true, jobId })}\n`);
    return 0;
  } catch (error) {
    io.err(`${error instanceof Error && error.message === "invalid_cli_arguments" ? "invalid_cli_arguments" : "job_library_failed"}\n`);
    return 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  process.exitCode = await runJobLibraryCli(process.argv.slice(2));
}
