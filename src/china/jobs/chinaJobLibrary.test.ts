import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  chinaJobLibraryHeader,
  readChinaJobLibrary,
  writeChinaJobLibrary,
  type ChinaJobRecord
} from "./chinaJobLibrary.js";

async function temporaryPath() {
  return join(await mkdtemp(join(tmpdir(), "china-job-library-")), "jobs.csv");
}

function job(overrides: Partial<ChinaJobRecord> = {}): ChinaJobRecord {
  return {
    jobId: "boss-123",
    company: "Example Technology",
    title: "Applied LLM Engineer",
    location: "Shanghai",
    category: "agent",
    bossUrl: "https://www.zhipin.com/job_detail/example.html",
    recruiterName: "Jordan Lee",
    recruiterTitle: "Recruiting Manager",
    firstSeen: "2026-08-08",
    lastVerified: "2026-08-08",
    status: "discovered",
    note: "Agent platform work",
    ...overrides
  };
}

describe("China job library", () => {
  test("round-trips the exact China fields and lifecycle", async () => {
    const path = await temporaryPath();
    const records = [
      job(),
      job({
        jobId: "boss-456",
        bossUrl: "https://www.zhipin.com/job_detail/robotics.html",
        title: "Robot Learning Engineer",
        category: "robotics",
        status: "awaiting_review",
        recruiterName: "",
        recruiterTitle: ""
      })
    ];
    await writeChinaJobLibrary(path, records);
    expect(await readChinaJobLibrary(path)).toEqual(records);
    expect((await readFile(path, "utf8")).split("\n")[0]).toBe(chinaJobLibraryHeader);
  });

  test.each(["agent", "robotics"] as const)("accepts the explicit %s category", async (category) => {
    const path = await temporaryPath();
    await writeChinaJobLibrary(path, [job({ category })]);
    expect((await readChinaJobLibrary(path))[0]?.category).toBe(category);
  });

  test.each(["discovered", "ready_to_contact", "awaiting_review", "contacted", "closed"] as const)(
    "accepts the %s lifecycle state",
    async (status) => {
      const path = await temporaryPath();
      await writeChinaJobLibrary(path, [job({ status })]);
      expect((await readChinaJobLibrary(path))[0]?.status).toBe(status);
    }
  );

  test("rejects duplicate job identities and Boss URLs", async () => {
    const path = await temporaryPath();
    await expect(writeChinaJobLibrary(path, [job(), job({ title: "Another role" })])).rejects.toThrow("duplicate_china_job");
    await expect(writeChinaJobLibrary(path, [job(), job({ jobId: "boss-other" })])).rejects.toThrow("duplicate_china_job");
  });

  test("rejects unsupported categories, statuses, non-Boss URLs, and reversed dates", async () => {
    const path = await temporaryPath();
    for (const record of [
      job({ category: "recommendation" as never }),
      job({ status: "submitted" as never }),
      job({ bossUrl: "https://example.com/job" }),
      job({ firstSeen: "2026-08-09", lastVerified: "2026-08-08" })
    ]) {
      await expect(writeChinaJobLibrary(path, [record])).rejects.toThrow("invalid_china_job_library");
    }
  });

  test("fails closed for a malformed CSV", async () => {
    const path = await temporaryPath();
    await writeFile(path, `${chinaJobLibraryHeader}\nwrong,column,count\n`, { mode: 0o600 });
    await expect(readChinaJobLibrary(path)).rejects.toThrow("invalid_china_job_library");
  });
});
