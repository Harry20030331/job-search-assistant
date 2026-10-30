import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  closeJob,
  jobLibraryHeader,
  normalizeOfficialUrl,
  readJobLibrary,
  setJobStatus,
  upsertJob
} from "./jobLibrary.js";

async function libraryPath() {
  const directory = await mkdtemp(join(tmpdir(), "us-job-library-"));
  const path = join(directory, "jobs.csv");
  await writeFile(path, `${jobLibraryHeader}\n`, "utf8");
  return path;
}

const input = {
  jobId: "12345678",
  company: "Example Company",
  title: "Machine Learning Engineer Graduate, E-Commerce Recommendation",
  location: "Seattle, WA",
  category: "recommendation" as const,
  officialUrl: "https://jobs.example.com/search/12345678?utm_source=Simplify&ref=Simplify",
  sources: ["speedyapply-2027-ai"] as const,
  firstSeen: "2026-08-07",
  lastVerified: "2026-08-07",
  note: "2027 Start; Regular"
};

describe("US job library", () => {
  test("normalizes only tracking parameters", () => {
    expect(normalizeOfficialUrl("https://example.com/job?gh_jid=42&utm_source=x&ref=y#top"))
      .toBe("https://example.com/job?gh_jid=42");
  });

  test("writes and reads RFC 4180 fields", async () => {
    const path = await libraryPath();
    await upsertJob(path, input);
    expect(await readJobLibrary(path)).toEqual([{ ...input, officialUrl: normalizeOfficialUrl(input.officialUrl), sources: [...input.sources], status: "new" }]);
    expect(await readFile(path, "utf8")).toContain('"Machine Learning Engineer Graduate, E-Commerce Recommendation"');
  });

  test("merges sources and preserves first seen plus application-owned status", async () => {
    const path = await libraryPath();
    await upsertJob(path, input);
    const current = await readJobLibrary(path);
    current[0]!.status = "in_progress";
    const text = await readFile(path, "utf8");
    await writeFile(path, text.replace(",new,", ",in_progress,"), "utf8");
    await upsertJob(path, {
      ...input,
      sources: ["simplify-new-grad"],
      firstSeen: "2026-08-08",
      lastVerified: "2026-08-08",
      title: "Updated official title"
    });
    expect((await readJobLibrary(path))[0]).toMatchObject({
      title: "Updated official title",
      sources: ["simplify-new-grad", "speedyapply-2027-ai"],
      firstSeen: "2026-08-07",
      lastVerified: "2026-08-08",
      status: "in_progress"
    });
  });

  test("deduplicates by normalized URL when job ids differ", async () => {
    const path = await libraryPath();
    await upsertJob(path, input);
    await upsertJob(path, { ...input, jobId: "source-generated-id", sources: ["speedyapply-2027-swe"] });
    expect(await readJobLibrary(path)).toHaveLength(1);
  });

  test("merges a user-provided lead without losing its source or first seen date", async () => {
    const path = await libraryPath();
    await upsertJob(path, { ...input, sources: ["user-provided"] });
    await upsertJob(path, { ...input, firstSeen: "2026-08-09" });
    const records = await readJobLibrary(path);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      sources: ["speedyapply-2027-ai", "user-provided"],
      firstSeen: input.firstSeen
    });
  });

  test("marks an existing job closed without deleting it", async () => {
    const path = await libraryPath();
    await upsertJob(path, input);
    await closeJob(path, input.jobId, "2026-08-09", "Official page closed");
    expect((await readJobLibrary(path))[0]).toMatchObject({ status: "closed", lastVerified: "2026-08-09", note: "Official page closed" });
  });

  test("accepts a populated canonical library", async () => {
    const path = await libraryPath();
    await upsertJob(path, {
      ...input,
      jobId: "notion-85947779",
      company: "Notion",
      title: "Software Engineer, Early Career (AI)",
      officialUrl: "https://jobs.ashbyhq.com/notion/85947779-6b87-466a-98bc-30a640448c28",
      status: "ready"
    });
    await expect(readJobLibrary(path)).resolves.toHaveLength(1);
  });

  test("moves only an exact job through application-owned statuses", async () => {
    const path = await libraryPath();
    await upsertJob(path, { ...input, status: "ready" });
    await setJobStatus(path, input.jobId, "in_progress");
    await setJobStatus(path, input.jobId, "final_review");
    expect((await readJobLibrary(path))[0]?.status).toBe("final_review");
    await expect(setJobStatus(path, "missing", "submitted")).rejects.toThrow("job_not_found");
    await expect(setJobStatus(path, input.jobId, "new")).rejects.toThrow("invalid_status_transition");
  });

  test("can park a shortlist for discovery review without closing it or losing history", async () => {
    const path = await libraryPath();
    await upsertJob(path, { ...input, status: "ready" });
    await setJobStatus(path, input.jobId, "new");
    expect(await readJobLibrary(path)).toEqual([{
      ...input,
      officialUrl: normalizeOfficialUrl(input.officialUrl),
      sources: [...input.sources],
      status: "new"
    }]);
    await setJobStatus(path, input.jobId, "ready");
    expect((await readJobLibrary(path))[0]?.status).toBe("ready");
  });

  test.each(["in_progress", "final_review", "submitted"] as const)(
    "discovery cannot demote application-owned %s to new or ready",
    async (status) => {
      const path = await libraryPath();
      await upsertJob(path, { ...input, status: "ready" });
      await setJobStatus(path, input.jobId, "in_progress");
      if (status !== "in_progress") await setJobStatus(path, input.jobId, "final_review");
      if (status === "submitted") await setJobStatus(path, input.jobId, "submitted");
      const original = await readFile(path, "utf8");
      await expect(setJobStatus(path, input.jobId, "new")).rejects.toThrow("invalid_status_transition");
      await expect(setJobStatus(path, input.jobId, "ready")).rejects.toThrow("invalid_status_transition");
      expect(await readFile(path, "utf8")).toBe(original);
      await upsertJob(path, { ...input, status: "new" });
      expect((await readJobLibrary(path))[0]?.status).toBe(status);
    }
  );

  test("accepts open job directions but rejects empty directions and invalid statuses", async () => {
    const path = await libraryPath();
    await expect(upsertJob(path, { ...input, category: "Quantitative Research" })).resolves.toMatchObject({ category: "Quantitative Research" });
    await expect(upsertJob(path, { ...input, category: "" })).rejects.toThrow("invalid_job_record");
    await expect(upsertJob(path, { ...input, status: "applied" as never })).rejects.toThrow("invalid_job_record");
    await writeFile(path, `${jobLibraryHeader}\n${input.jobId},Example Company,Role,Seattle,,https://example.com,user-provided,2026-08-07,2026-08-07,new,note\n`);
    await expect(readJobLibrary(path)).rejects.toThrow("invalid_job_library");
  });
});
