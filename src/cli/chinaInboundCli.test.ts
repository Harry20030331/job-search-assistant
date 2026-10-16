import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { writeInboundHrTracker } from "../china/inbound/inboundHrTracker.js";
import { runChinaInboundCli, type CliIo } from "./chinaInboundCli.js";

async function setup() {
  const directory = await mkdtemp(join(tmpdir(), "china-inbound-cli-"));
  const path = join(directory, "tracker.json");
  const base = {
    recruiterTitle: "HR",
    firstSeenAt: "2026-08-12T04:49:00.000Z",
    lastActivityAt: "2026-08-12T04:49:00.000Z"
  };
  await writeInboundHrTracker(path, {
    schemaVersion: 1,
    contacts: [
      { ...base, contactId: "moonshot-song", recruiterName: "Taylor Reed", company: "Moonshot AI", messageSummary: "Agentic RL", direction: "agent", companyTier: "top_ai_startup", status: "interested", reason: "Clear match", nextAction: "prepare_reply" },
      { ...base, contactId: "deeproute-liu", recruiterName: "Casey Park", company: "DeepRoute", messageSummary: "Algorithm role", direction: "unclassified", companyTier: "top_robotics", status: "needs_clarification", reason: "Role direction unclear", nextAction: "ask_clarifying_question" },
      { ...base, contactId: "huawei-huang", recruiterName: "Sam Chen", company: "Huawei", messageSummary: "Agent Infra", direction: "agent", companyTier: "big_tech", status: "not_interested", reason: "Excluded employer", nextAction: "none" }
    ]
  });
  const stdout: string[] = [];
  const stderr: string[] = [];
  const io: CliIo = { out: (value) => stdout.push(value), err: (value) => stderr.push(value) };
  return { path, stdout, stderr, io };
}

describe("China inbound HR CLI", () => {
  test("validates a tracker", async () => {
    const { path, stdout, io } = await setup();
    expect(await runChinaInboundCli(["validate", "--path", path], io)).toBe(0);
    expect(stdout.join("")).toContain('"valid":true');
  });

  test("reports every review status", async () => {
    const { path, stdout, io } = await setup();
    expect(await runChinaInboundCli(["report", "--path", path], io)).toBe(0);
    const output = stdout.join("");
    expect(output).toContain("interested");
    expect(output).toContain("not_interested");
    expect(output).toContain("needs_clarification");
    expect(output).toContain("## Interested");
  });

  test("rejects missing path", async () => {
    const { stderr, io } = await setup();
    expect(await runChinaInboundCli(["report"], io)).toBe(1);
    expect(stderr.join("")).toContain("invalid_cli_arguments");
  });
});
