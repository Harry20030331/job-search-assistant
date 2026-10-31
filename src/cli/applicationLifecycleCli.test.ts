import { execFile, spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, test } from "vitest";
import {
  createApplication,
  markConfirmed,
  markSubmitted,
  readApplicationTracker
} from "../tracker.js";
import { runApplicationLifecycleCli } from "./applicationLifecycleCli.js";

const execFileAsync = promisify(execFile);

async function createProcessOwnedLock(lockPath: string) {
  const owner = spawn(process.execPath, ["-e", "setInterval(() => {}, 1_000)"], { stdio: "ignore" });
  await once(owner, "spawn");
  await execFileAsync("/usr/bin/shlock", ["-f", lockPath, "-p", String(owner.pid)]);
  return owner;
}

async function killOwner(owner: ReturnType<typeof spawn>) {
  const exited = once(owner, "exit");
  owner.kill("SIGKILL");
  await exited;
}

const application = {
  jobId: "tmobile-1",
  applicationId: "tmobile-1",
  company: "T-Mobile",
  title: "Machine Learning Engineer",
  location: "Bellevue, WA",
  ats: "workday" as const,
  jobUrl: "https://example.com/jobs/tmobile-1",
  applicationUrl: "https://example.com/applications/tmobile-1",
  category: "llm" as const,
  cvFilename: "example_cv_llm.pdf"
};

async function setupTracker() {
  const directory = await mkdtemp(join(tmpdir(), "lifecycle-cli-"));
  const tracker = join(directory, "private-tracker.json");
  await writeFile(tracker, JSON.stringify({ schemaVersion: 3, applications: [] }));
  await createApplication(tracker, application, "2026-08-17T16:00:00.000Z");
  await markSubmitted(tracker, application.applicationId, {
    applicationId: application.applicationId,
    snapshotId: "snapshot-1",
    approvalConsumed: true,
    visibleResult: "submitted"
  }, "2026-08-17T16:30:00.000Z");
  return { directory, tracker };
}

describe("application lifecycle CLI", () => {
  test("reconciles an exact local confirmation batch and prints only counts", async () => {
    const { directory, tracker } = await setupTracker();
    const input = join(directory, "confirmations.json");
    await writeFile(input, JSON.stringify({
      checkedAt: "2026-08-17T17:00:00.000Z",
      confirmations: [{ applicationId: application.applicationId, receivedAt: "2026-08-17T16:59:12.000Z" }],
      notReceived: []
    }));
    const writes: string[] = [];

    expect(await runApplicationLifecycleCli([
      "confirm-batch", "--tracker", tracker, "--input", input
    ], { write: (value) => writes.push(value) })).toBe(0);

    expect(writes).toEqual([`${JSON.stringify({ ok: true, confirmed: 1, pending: 0 })}\n`]);
    expect((await readApplicationTracker(tracker)).applications[0]).toMatchObject({
      status: "confirmed",
      confirmedAt: "2026-08-17T16:59:12.000Z"
    });
  });

  test("transitions one exact application and prints only its ID and status", async () => {
    const { tracker } = await setupTracker();
    await markConfirmed(tracker, application.applicationId, "confirmed", "2026-08-17T17:00:00.000Z");
    const writes: string[] = [];

    expect(await runApplicationLifecycleCli([
      "transition", "--tracker", tracker,
      "--application-id", application.applicationId,
      "--status", "interviewing",
      "--at", "2026-08-17T18:00:00.000Z"
    ], { write: (value) => writes.push(value) })).toBe(0);

    expect(writes).toEqual([`${JSON.stringify({
      ok: true,
      applicationId: application.applicationId,
      status: "interviewing"
    })}\n`]);
    expect((await readApplicationTracker(tracker)).applications[0]).toMatchObject({
      status: "interviewing",
      updatedAt: "2026-08-17T18:00:00.000Z"
    });
  });

  test("serializes real lifecycle CLI processes without losing updates", async () => {
    const directory = await mkdtemp(join(tmpdir(), "lifecycle-multiprocess-"));
    const tracker = join(directory, "tracker.json");
    await writeFile(tracker, JSON.stringify({ schemaVersion: 3, applications: [] }));
    const applications = Array.from({ length: 16 }, (_, index) => ({
      ...application,
      jobId: `job-${index}`,
      applicationId: `application-${index}`,
      jobUrl: `https://example.com/jobs/${index}`,
      applicationUrl: `https://example.com/applications/${index}`
    }));
    for (const record of applications) {
      await createApplication(tracker, record, "2026-08-17T16:00:00.000Z");
      await markSubmitted(tracker, record.applicationId, {
        applicationId: record.applicationId,
        snapshotId: `snapshot-${record.applicationId}`,
        approvalConsumed: true,
        visibleResult: "submitted"
      }, "2026-08-17T16:30:00.000Z");
      await markConfirmed(tracker, record.applicationId, "confirmed", "2026-08-17T17:00:00.000Z");
    }
    const cli = join(process.cwd(), "src", "cli", "applicationLifecycleCli.ts");

    const results = await Promise.all(applications.map((record) => execFileAsync(process.execPath, [
      "--import", "tsx",
      cli,
      "transition", "--tracker", tracker,
      "--application-id", record.applicationId,
      "--status", "interviewing",
      "--at", "2026-08-17T18:00:00.000Z"
    ])));

    expect(results.map(({ stdout }) => JSON.parse(stdout))).toEqual(applications.map((record) => ({
      ok: true,
      applicationId: record.applicationId,
      status: "interviewing"
    })));
    expect((await readApplicationTracker(tracker)).applications.map(({ status }) => status))
      .toEqual(applications.map(() => "interviewing"));
    await expect(readFile(`${tracker}.lock`, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  }, process.platform === "win32" ? 60_000 : 20_000);

  test.skipIf(process.platform === "win32")("reclaims a killed process owner and preserves every concurrent mutation", async () => {
    for (let round = 0; round < 4; round += 1) {
      const directory = await mkdtemp(join(tmpdir(), "lifecycle-stale-race-"));
      const tracker = join(directory, "tracker.json");
      await writeFile(tracker, JSON.stringify({ schemaVersion: 3, applications: [] }));
      const applications = Array.from({ length: 16 }, (_, index) => ({
        ...application,
        jobId: `round-${round}-job-${index}`,
        applicationId: `round-${round}-application-${index}`,
        jobUrl: `https://example.com/rounds/${round}/jobs/${index}`,
        applicationUrl: `https://example.com/rounds/${round}/applications/${index}`
      }));
      for (const record of applications) {
        await createApplication(tracker, record, "2026-08-17T16:00:00.000Z");
        await markSubmitted(tracker, record.applicationId, {
          applicationId: record.applicationId,
          snapshotId: `snapshot-${record.applicationId}`,
          approvalConsumed: true,
          visibleResult: "submitted"
        }, "2026-08-17T16:30:00.000Z");
        await markConfirmed(tracker, record.applicationId, "confirmed", "2026-08-17T17:00:00.000Z");
      }
      const lockPath = `${tracker}.lock`;
      const owner = await createProcessOwnedLock(lockPath);
      await killOwner(owner);
      const cli = join(process.cwd(), "src", "cli", "applicationLifecycleCli.ts");

      const results = await Promise.all(applications.map((record) => execFileAsync(process.execPath, [
        "--import", "tsx",
        cli,
        "transition", "--tracker", tracker,
        "--application-id", record.applicationId,
        "--status", "interviewing",
        "--at", "2026-08-17T18:00:00.000Z"
      ])));

      expect(results.map(({ stdout }) => JSON.parse(stdout))).toEqual(applications.map((record) => ({
        ok: true,
        applicationId: record.applicationId,
        status: "interviewing"
      })));
      expect((await readApplicationTracker(tracker)).applications.map(({ status }) => status))
        .toEqual(applications.map(() => "interviewing"));
      await expect(readFile(lockPath, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
      expect((await readdir(directory)).filter((name) => name.includes(".lock"))).toEqual([]);
    }
  }, 30_000);

  test.skipIf(process.platform === "win32")("waits for a live shlock owner and continues after that owner exits", async () => {
    const { tracker } = await setupTracker();
    await markConfirmed(tracker, application.applicationId, "confirmed", "2026-08-17T17:00:00.000Z");
    const lockPath = `${tracker}.lock`;
    const owner = await createProcessOwnedLock(lockPath);
    const cli = join(process.cwd(), "src", "cli", "applicationLifecycleCli.ts");
    const mutation = execFileAsync(process.execPath, [
      "--import", "tsx",
      cli,
      "transition", "--tracker", tracker,
      "--application-id", application.applicationId,
      "--status", "interviewing",
      "--at", "2026-08-17T18:00:00.000Z"
    ]);

    await new Promise((resolve) => setTimeout(resolve, 200));
    expect((await readApplicationTracker(tracker)).applications[0]?.status).toBe("confirmed");
    await killOwner(owner);
    const { stdout } = await mutation;

    expect(JSON.parse(stdout)).toEqual({
      ok: true,
      applicationId: application.applicationId,
      status: "interviewing"
    });
    expect((await readApplicationTracker(tracker)).applications[0]?.status).toBe("interviewing");
    await expect(readFile(lockPath, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  }, 10_000);

  test("rejects non-strict batch JSON without changing the tracker", async () => {
    const { directory, tracker } = await setupTracker();
    const input = join(directory, "confirmations.json");
    await writeFile(input, JSON.stringify({
      checkedAt: "2026-08-17T17:00:00.000Z",
      confirmations: [],
      notReceived: [application.applicationId],
      rawEmailBody: "private mail"
    }));
    const before = await readFile(tracker, "utf8");
    const writes: string[] = [];

    expect(await runApplicationLifecycleCli([
      "confirm-batch", "--tracker", tracker, "--input", input
    ], { write: (value) => writes.push(value) })).toBe(1);

    expect(writes).toEqual([`${JSON.stringify({ ok: false, error: "lifecycle_failed" })}\n`]);
    expect(writes.join("")).not.toContain("private mail");
    expect(await readFile(tracker, "utf8")).toBe(before);
  });

  test.each([
    ["confirm-batch", "--tracker", "/private/tracker.json"],
    ["confirm-batch", "--tracker", "/private/tracker.json", "--input", "/private/input.json", "--extra", "secret"],
    ["transition", "--tracker", "/private/tracker.json", "--application-id", "a", "--status", "submitted", "--at", "2026-08-17T18:00:00.000Z"],
    ["transition", "--tracker", "/private/tracker.json", "--application-id", "a", "--status", "closed", "--at", "invalid"]
  ])("returns one fixed error for invalid or failing input: %j", async (...args: string[]) => {
    const writes: string[] = [];

    expect(await runApplicationLifecycleCli(args, { write: (value) => writes.push(value) })).toBe(1);
    expect(writes).toEqual([`${JSON.stringify({ ok: false, error: "lifecycle_failed" })}\n`]);
    expect(writes.join("")).not.toContain("/private/");
    expect(writes.join("")).not.toContain("invalid");
  });
});
