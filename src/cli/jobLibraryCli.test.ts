import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { jobLibraryHeader, readJobLibrary } from "../jobs/jobLibrary.js";
import { runJobLibraryCli, type CliIo } from "./jobLibraryCli.js";

async function setup() {
  const directory = await mkdtemp(join(tmpdir(), "job-cli-"));
  const path = join(directory, "jobs.csv");
  await writeFile(path, `${jobLibraryHeader}\n`, "utf8");
  const stdout: string[] = [];
  const stderr: string[] = [];
  const io: CliIo = { out: (value) => stdout.push(value), err: (value) => stderr.push(value) };
  return { path, stdout, stderr, io };
}

describe("job library CLI", () => {
  test("validates an empty library", async () => {
    const { path, stdout, stderr, io } = await setup();
    expect(await runJobLibraryCli(["validate", "--path", path], io)).toBe(0);
    expect(JSON.parse(stdout[0]!)).toEqual({ valid: true, count: 0 });
    expect(stderr).toEqual([]);
  });

  test("upserts metadata without printing the note", async () => {
    const { path, stdout, io } = await setup();
    expect(await runJobLibraryCli([
      "upsert", "--path", path,
      "--job-id", "role-1", "--company", "Example", "--title", "MLE Graduate",
      "--location", "Seattle, WA", "--category", "llm",
      "--url", "https://jobs.example.com/role-1", "--source", "speedyapply-2027-ai",
      "--first-seen", "2026-08-07", "--last-verified", "2026-08-07",
      "--note", "2027 Start private detail"
    ], io)).toBe(0);
    expect(JSON.parse(stdout.at(-1)!)).toEqual({ updated: true, jobId: "role-1", status: "new" });
    expect(stdout.join(" ")).not.toContain("private detail");
  });

  test("accepts repeated approved sources and closes a job", async () => {
    const { path, stdout, io } = await setup();
    await runJobLibraryCli([
      "upsert", "--path", path, "--job-id", "role-1", "--company", "Example",
      "--title", "MLE Graduate", "--location", "Seattle, WA", "--category", "llm",
      "--url", "https://jobs.example.com/role-1", "--source", "speedyapply-2027-ai",
      "--source", "simplify-new-grad", "--first-seen", "2026-08-07",
      "--last-verified", "2026-08-07", "--status", "ready"
    ], io);
    expect(await runJobLibraryCli([
      "close", "--path", path, "--job-id", "role-1", "--last-verified", "2026-08-08",
      "--note", "Official page closed"
    ], io)).toBe(0);
    expect(JSON.parse(stdout.at(-1)!)).toEqual({ closed: true, jobId: "role-1" });
    expect(stdout.join(" ")).not.toContain("Official page closed");
  });

  test("moves an exact job through application-owned statuses", async () => {
    const { path, stdout, io } = await setup();
    await runJobLibraryCli([
      "upsert", "--path", path, "--job-id", "role-1", "--company", "Example",
      "--title", "MLE Graduate", "--location", "Seattle, WA", "--category", "llm",
      "--url", "https://jobs.example.com/role-1", "--source", "speedyapply-2027-ai",
      "--first-seen", "2026-08-07", "--last-verified", "2026-08-07", "--status", "ready"
    ], io);
    expect(await runJobLibraryCli([
      "status", "--path", path, "--job-id", "role-1", "--status", "in_progress"
    ], io)).toBe(0);
    expect(await runJobLibraryCli([
      "status", "--path", path, "--job-id", "role-1", "--status", "final_review"
    ], io)).toBe(0);
    expect((await readJobLibrary(path))[0]?.status).toBe("final_review");
    expect(JSON.parse(stdout.at(-1)!)).toEqual({ updated: true, jobId: "role-1", status: "final_review" });
  });

  test.each([
    ["validate"],
    ["validate", "--path", "a", "--unknown", "b"],
    ["validate", "--path", "a", "--path", "b"],
    ["upsert", "--path"],
    ["unknown", "--path", "a"]
  ])("rejects invalid arguments: %j", async (...args: string[]) => {
    const { stderr, io } = await setup();
    expect(await runJobLibraryCli(args, io)).toBe(1);
    expect(stderr).toEqual(["invalid_cli_arguments\n"]);
  });
});
