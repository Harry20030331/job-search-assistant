import { execFile } from "node:child_process";
import { mkdtemp, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, expect, test, vi } from "vitest";
import { parsePreflightArgs, runPreflightCli } from "./preflightCli.js";

const execFileAsync = promisify(execFile);

describe("preflight CLI", () => {
  test("parses one HTTPS URL and one explicit supported category", () => {
    expect(parsePreflightArgs([
      "--url", "https://jobs.example.com/role",
      "--category", "robotics"
    ])).toEqual({ jobUrl: "https://jobs.example.com/role", category: "robotics" });
  });

  test("parses one local batch JSON path without changing single-item arguments", () => {
    expect(parsePreflightArgs(["--batch", "/tmp/preflight-batch.json"]))
      .toEqual({ batchPath: "/tmp/preflight-batch.json" });
  });

  test.each([
    { args: [] },
    { args: ["--url", "https://jobs.example.com/role"] },
    { args: ["--category", "llm"] },
    { args: ["--url", "https://jobs.example.com/role", "--category", "llm", "--extra", "value"] }
  ])("rejects incomplete or unknown arguments: $args", ({ args }) => {
    expect(() => parsePreflightArgs(args)).toThrow("invalid_arguments");
  });

  test("uses fixed project-local canonical paths and writes one JSON result", async () => {
    const preflight = vi.fn(async () => ({
      category: "llm" as const,
      jobUrl: "https://jobs.example.com/role",
      cvPath: "/approved/llm.pdf",
      cvSha256: "a".repeat(64),
      candidateName: "Alex Morgan"
    }));
    const writes: string[] = [];

    const exitCode = await runPreflightCli(
      ["--url", "https://jobs.example.com/role", "--category", "llm"],
      { preflight, write: (value) => writes.push(value) }
    );

    expect(exitCode).toBe(0);
    expect(preflight).toHaveBeenCalledOnce();
    expect(preflight).toHaveBeenCalledWith({
      category: "llm",
      jobUrl: "https://jobs.example.com/role",
      manifestPath: fileURLToPath(new URL("../../data/resumes.json", import.meta.url)),
      profilePath: fileURLToPath(new URL("../../data/candidate.json", import.meta.url))
    });
    expect(writes).toEqual([`${JSON.stringify({
      ok: true,
      category: "llm",
      jobUrl: "https://jobs.example.com/role",
      cvPath: "/approved/llm.pdf",
      cvSha256: "a".repeat(64),
      candidateName: "Alex Morgan"
    })}\n`]);
  });

  test("returns a fixed JSON error without exposing thrown details", async () => {
    const writes: string[] = [];
    const exitCode = await runPreflightCli(
      ["--url", "https://jobs.example.com/role", "--category", "llm"],
      {
        preflight: async () => { throw new Error("private path and details"); },
        write: (value) => writes.push(value)
      }
    );

    expect(exitCode).toBe(1);
    expect(writes).toEqual([`${JSON.stringify({ ok: false, error: "preflight_failed" })}\n`]);
    expect(writes.join("")).not.toContain("private path");
  });

  test("reads a strict bounded batch and writes one minimal ready/parked JSON result", async () => {
    const directory = await mkdtemp(join(tmpdir(), "preflight-cli-batch-"));
    const batchPath = join(directory, "batch.json");
    const items = [
      { applicationId: "a", jobUrl: "https://jobs.example.com/a", category: "llm" },
      { applicationId: "b", jobUrl: "bad", category: "robotics" }
    ];
    await writeFile(batchPath, JSON.stringify(items));
    const ready = [{
      applicationId: "a",
      category: "llm" as const,
      jobUrl: "https://jobs.example.com/a",
      cvPath: "/approved/llm.pdf",
      cvSha256: "a".repeat(64),
      candidateName: "Alex Morgan"
    }];
    const batchPreflight = vi.fn(async () => ({
      ready,
      parked: [{ applicationId: "b", error: "invalid_job_url" as const }]
    }));
    const writes: string[] = [];

    const exitCode = await runPreflightCli(["--batch", batchPath], {
      batchPreflight,
      preflight: vi.fn(),
      write: (value) => writes.push(value)
    });

    expect(exitCode).toBe(0);
    expect(batchPreflight).toHaveBeenCalledWith({
      items,
      manifestPath: fileURLToPath(new URL("../../data/resumes.json", import.meta.url)),
      profilePath: fileURLToPath(new URL("../../data/candidate.json", import.meta.url))
    });
    expect(writes).toEqual([`${JSON.stringify({
      ok: true,
      ready,
      parked: [{ applicationId: "b", error: "invalid_job_url" }]
    })}\n`]);
  });

  test.each([
    { name: "object", value: { items: [] } },
    { name: "empty array", value: [] },
    { name: "oversized array", value: Array.from({ length: 26 }, (_, index) => ({ applicationId: `a-${index}`, jobUrl: "https://jobs.example.com/a", category: "llm" })) },
    { name: "extra item field", value: [{ applicationId: "a", jobUrl: "https://jobs.example.com/a", category: "llm", privatePath: "/secret" }] }
  ])("rejects strict batch input: $name", async ({ value }) => {
    const directory = await mkdtemp(join(tmpdir(), "preflight-cli-invalid-"));
    const batchPath = join(directory, "batch.json");
    await writeFile(batchPath, JSON.stringify(value));
    const writes: string[] = [];
    const batchPreflight = vi.fn();

    const exitCode = await runPreflightCli(["--batch", batchPath], {
      batchPreflight,
      preflight: vi.fn(),
      write: (output) => writes.push(output)
    });

    expect(exitCode).toBe(1);
    expect(batchPreflight).not.toHaveBeenCalled();
    expect(writes).toEqual([`${JSON.stringify({ ok: false, error: "preflight_failed" })}\n`]);
    expect(writes.join("")).not.toContain("privatePath");
    expect(writes.join("")).not.toContain("/secret");
  });

  test("rejects a valid batch JSON file larger than 64 KiB before dispatch", async () => {
    const directory = await mkdtemp(join(tmpdir(), "preflight-cli-oversized-"));
    const batchPath = join(directory, "batch.json");
    const item = [{ applicationId: "a", jobUrl: "https://jobs.example.com/a", category: "llm" }];
    await writeFile(batchPath, `${" ".repeat(64 * 1024)}${JSON.stringify(item)}`);
    const writes: string[] = [];
    const batchPreflight = vi.fn();

    const exitCode = await runPreflightCli(["--batch", batchPath], {
      batchPreflight,
      preflight: vi.fn(),
      write: (output) => writes.push(output)
    });

    expect(exitCode).toBe(1);
    expect(batchPreflight).not.toHaveBeenCalled();
    expect(writes).toEqual([`${JSON.stringify({ ok: false, error: "preflight_failed" })}\n`]);
  });

  test.each([
    { name: "directory", pathFor: async (directory: string) => directory },
    { name: "symbolic link", pathFor: async (directory: string) => {
      const target = join(directory, "target.json");
      const link = join(directory, "batch-link.json");
      await writeFile(target, JSON.stringify([{ applicationId: "a", jobUrl: "https://jobs.example.com/a", category: "llm" }]));
      await symlink(target, link);
      return link;
    } }
  ])("rejects a non-regular $name batch path", async ({ pathFor }) => {
    const directory = await mkdtemp(join(tmpdir(), "preflight-cli-non-regular-"));
    const batchPath = await pathFor(directory);
    const writes: string[] = [];
    const batchPreflight = vi.fn();

    const exitCode = await runPreflightCli(["--batch", batchPath], {
      batchPreflight,
      preflight: vi.fn(),
      write: (output) => writes.push(output)
    });

    expect(exitCode).toBe(1);
    expect(batchPreflight).not.toHaveBeenCalled();
    expect(writes).toEqual([`${JSON.stringify({ ok: false, error: "preflight_failed" })}\n`]);
  });

  test("rejects a FIFO promptly without waiting for a writer", async () => {
    const directory = await mkdtemp(join(tmpdir(), "preflight-cli-fifo-"));
    const fifoPath = join(directory, "batch.fifo");
    await execFileAsync("/usr/bin/mkfifo", [fifoPath]);
    const writes: string[] = [];
    const batchPreflight = vi.fn();
    let timeout: NodeJS.Timeout | undefined;

    try {
      const exitCode = await Promise.race([
        runPreflightCli(["--batch", fifoPath], {
          batchPreflight,
          preflight: vi.fn(),
          write: (output) => writes.push(output)
        }),
        new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(() => reject(new Error("fifo_open_blocked")), 1_000);
        })
      ]);
      expect(exitCode).toBe(1);
    } finally {
      if (timeout) clearTimeout(timeout);
    }

    expect(batchPreflight).not.toHaveBeenCalled();
    expect(writes).toEqual([`${JSON.stringify({ ok: false, error: "preflight_failed" })}\n`]);
  });
});
