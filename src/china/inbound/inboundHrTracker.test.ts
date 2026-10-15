import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { readInboundHrTracker, writeInboundHrTracker } from "./inboundHrTracker.js";

const interested = {
  contactId: "boss-moonshot-song",
  recruiterName: "宋女士",
  company: "月之暗面",
  recruiterTitle: "HR",
  messageSummary: "大模型 Agentic RL 岗位",
  direction: "agent" as const,
  companyTier: "top_ai_startup" as const,
  status: "interested" as const,
  reason: "头部 AI 公司且岗位明确属于 Agent 后训练",
  nextAction: "prepare_reply" as const,
  firstSeenAt: "2026-08-12T04:49:00.000Z",
  lastActivityAt: "2026-08-12T04:49:00.000Z"
};

describe("Boss inbound HR tracker", () => {
  test("writes and reads a strict tracker", async () => {
    const directory = await mkdtemp(join(tmpdir(), "boss-inbound-"));
    const path = join(directory, "tracker.json");
    await writeInboundHrTracker(path, { schemaVersion: 1, contacts: [interested] });
    await expect(readInboundHrTracker(path)).resolves.toEqual({ schemaVersion: 1, contacts: [interested] });
    expect(JSON.parse(await readFile(path, "utf8"))).toEqual({ schemaVersion: 1, contacts: [interested] });
  });

  test("rejects duplicate contacts and invalid direction", async () => {
    const directory = await mkdtemp(join(tmpdir(), "boss-inbound-"));
    const path = join(directory, "tracker.json");
    await writeFile(path, JSON.stringify({ schemaVersion: 1, contacts: [interested, interested] }));
    await expect(readInboundHrTracker(path)).rejects.toThrow("invalid_inbound_hr_tracker");
    await writeFile(path, JSON.stringify({ schemaVersion: 1, contacts: [{ ...interested, direction: "both" }] }));
    await expect(readInboundHrTracker(path)).rejects.toThrow("invalid_inbound_hr_tracker");
  });

  test("requires reply evidence only after a reply", async () => {
    const directory = await mkdtemp(join(tmpdir(), "boss-inbound-"));
    const path = join(directory, "tracker.json");
    await expect(writeInboundHrTracker(path, {
      schemaVersion: 1,
      contacts: [{ ...interested, status: "replied", nextAction: "wait" }]
    })).rejects.toThrow("invalid_inbound_hr_tracker");
  });
});
