import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readInboundHrTracker, type InboundHrContact } from "../china/inbound/inboundHrTracker.js";

export interface CliIo {
  out(value: string): void;
  err(value: string): void;
}

const defaultIo: CliIo = {
  out: (value) => process.stdout.write(value),
  err: (value) => process.stderr.write(value)
};

function parseArguments(args: readonly string[]): { command: "validate" | "report"; path: string } {
  const [command, flag, path, ...extra] = args;
  if ((command !== "validate" && command !== "report") || flag !== "--path" || !path || extra.length > 0) {
    throw new Error("invalid_cli_arguments");
  }
  return { command, path };
}

function line(contact: InboundHrContact): string {
  return `- ${contact.company} | ${contact.recruiterName} | ${contact.direction} | ${contact.status} | ${contact.reason} | Next action: ${contact.nextAction}`;
}

function section(title: string, contacts: InboundHrContact[]): string {
  const rows = contacts.length ? contacts.map(line) : ["- None"];
  return [`## ${title}`, "", ...rows, ""].join("\n");
}

export function renderInboundHrReport(contacts: InboundHrContact[]): string {
  return [
    "# Boss inbound recruiter screening",
    "",
    section("Interested", contacts.filter((contact) => contact.status === "interested")),
    section("Needs clarification", contacts.filter((contact) => contact.status === "needs_clarification")),
    section("Not interested", contacts.filter((contact) => contact.status === "not_interested")),
    section("Replied or closed", contacts.filter((contact) => contact.status === "replied" || contact.status === "closed"))
  ].join("\n").trimEnd() + "\n";
}

export async function runChinaInboundCli(args: string[], io: CliIo = defaultIo): Promise<number> {
  let parsed: ReturnType<typeof parseArguments>;
  try {
    parsed = parseArguments(args);
  } catch {
    io.err("invalid_cli_arguments\n");
    return 1;
  }

  try {
    const tracker = await readInboundHrTracker(parsed.path);
    if (parsed.command === "validate") {
      io.out(`${JSON.stringify({ valid: true, count: tracker.contacts.length })}\n`);
    } else {
      io.out(renderInboundHrReport(tracker.contacts));
    }
    return 0;
  } catch {
    io.err("inbound_hr_failed\n");
    return 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  process.exitCode = await runChinaInboundCli(process.argv.slice(2));
}
