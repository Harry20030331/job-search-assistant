import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  readChinaOutreachTracker,
  writeChinaOutreachTracker,
  type ChinaOutreachRecord
} from "./chinaOutreachTracker.js";

async function temporaryPath() {
  return join(await mkdtemp(join(tmpdir(), "china-outreach-")), "outreach.local.json");
}

function outreach(overrides: Partial<ChinaOutreachRecord> = {}): ChinaOutreachRecord {
  return {
    outreachId: "outreach-boss-123",
    jobId: "boss-123",
    recruiterName: "王女士",
    category: "agent",
    cvFilename: "agent.pdf",
    message: "您好，我对这个岗位很感兴趣。",
    status: "draft",
    createdAt: "2026-08-08T20:00:00.000Z",
    updatedAt: "2026-08-08T20:00:00.000Z",
    ...overrides
  };
}

describe("China initial-outreach tracker", () => {
  test.each(["draft", "awaiting_review", "closed"] as const)("round-trips %s without send evidence", async (status) => {
    const path = await temporaryPath();
    const record = outreach({ status });
    await writeChinaOutreachTracker(path, { schemaVersion: 1, outreach: [record] });
    expect(await readChinaOutreachTracker(path)).toEqual({ schemaVersion: 1, outreach: [record] });
  });

  test("requires snapshot-bound send evidence for contacted", async () => {
    const path = await temporaryPath();
    const record = outreach({
      status: "contacted",
      approvedSnapshotId: "sha256:abc",
      sentAt: "2026-08-08T20:05:00.000Z",
      updatedAt: "2026-08-08T20:05:00.000Z"
    });
    await writeChinaOutreachTracker(path, { schemaVersion: 1, outreach: [record] });
    expect((await readChinaOutreachTracker(path)).outreach[0]).toEqual(record);
    await expect(writeChinaOutreachTracker(path, {
      schemaVersion: 1,
      outreach: [outreach({ status: "contacted" })]
    })).rejects.toThrow("invalid_china_outreach_tracker");
  });

  test.each(["agent", "robotics"] as const)("requires an explicit %s CV category", async (category) => {
    const path = await temporaryPath();
    await writeChinaOutreachTracker(path, { schemaVersion: 1, outreach: [outreach({ category })] });
    expect((await readChinaOutreachTracker(path)).outreach[0]?.category).toBe(category);
  });

  test("rejects duplicate outreach and job identities", async () => {
    const path = await temporaryPath();
    await expect(writeChinaOutreachTracker(path, {
      schemaVersion: 1,
      outreach: [outreach(), outreach({ message: "另一条" })]
    })).rejects.toThrow("duplicate_china_outreach");
    await expect(writeChinaOutreachTracker(path, {
      schemaVersion: 1,
      outreach: [outreach(), outreach({ outreachId: "other" })]
    })).rejects.toThrow("duplicate_china_outreach");
  });

  test("rejects reply or conversation fields and malformed documents", async () => {
    const path = await temporaryPath();
    await writeFile(path, JSON.stringify({
      schemaVersion: 1,
      outreach: [{ ...outreach(), replies: ["您好"] }]
    }), { mode: 0o600 });
    await expect(readChinaOutreachTracker(path)).rejects.toThrow("invalid_china_outreach_tracker");
    await writeFile(path, JSON.stringify({ schemaVersion: 2, outreach: [] }), { mode: 0o600 });
    await expect(readChinaOutreachTracker(path)).rejects.toThrow("invalid_china_outreach_tracker");
  });
});
