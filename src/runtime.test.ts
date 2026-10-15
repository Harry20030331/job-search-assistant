import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { initializeRuntime } from "./runtime.js";
import { runBatchPreflight, runPreflight } from "./preflight.js";
import { resolveRecoveryInputs } from "./review/reviewRecovery.js";
import { startReviewServer } from "./review/reviewServer.js";
import { parseProfileArgs } from "./cli/profileCli.js";
import { parsePreflightArgs, runPreflightCli } from "./cli/preflightCli.js";
import { parseReviewServerArgs } from "./cli/reviewServerCli.js";
import { parseRuntimeInitArgs } from "./cli/runtimeInitCli.js";

const temporary: string[] = [];
afterEach(async () => { await Promise.all(temporary.splice(0).map((path) => rm(path, { recursive: true, force: true }))); });

async function fixture() {
  const parent = await mkdtemp(join(tmpdir(), "career-independent-"));
  temporary.push(parent);
  return { parent, root: join(parent, "runtime") };
}

describe("independent candidate inputs and runtime", () => {
  test("initializes and serves empty private US storage without historical or China files", async () => {
    const { root } = await fixture();
    const inputs = await initializeRuntime(root, new Date("2026-10-15T12:00:00Z"));
    expect(inputs.applicationIds).toEqual([]);
    expect(inputs.liveAtsState).toBe("unverified");
    expect((await readdir(join(root, "data"))).sort()).toEqual(["discovery-state.json", "drafts", "opportunities.json"]);
    for (const path of [inputs.reviewPath, inputs.trackerPath, inputs.jobsPath]) {
      expect((await stat(path)).mode & 0o777).toBe(path === inputs.reviewPath ? 0o700 : 0o600);
    }
    expect((await stat(root)).mode & 0o777).toBe(0o700);
    const before = await readdir(inputs.reviewPath);
    const server = await startReviewServer({ ...inputs, port: 0 });
    try {
      for (const route of ["/review", "/status/us"]) {
        const response = await fetch(server.address + route);
        expect(response.status).toBe(200);
        expect(await response.text()).toContain(route === "/review" ? "No applications pending review" : "No active applications.");
      }
      const historical = await fetch(server.address + "/status/china", { redirect: "manual" });
      expect(historical.headers.get("location")).toBe("/status/us");
    } finally { await server.close(); }
    expect(await readdir(inputs.reviewPath)).toEqual(before);
    expect(await resolveRecoveryInputs(root)).toEqual(inputs);
  });

  test("refuses an existing directory or symlink and never truncates its records", async () => {
    const { root, parent } = await fixture();
    const inputs = await initializeRuntime(root);
    const before = await readFile(inputs.trackerPath, "utf8");
    await expect(initializeRuntime(root)).rejects.toMatchObject({ code: "EEXIST" });
    const link = join(parent, "linked");
    await symlink(root, link);
    await expect(initializeRuntime(link)).rejects.toMatchObject({ code: "EEXIST" });
    expect(await readFile(inputs.trackerPath, "utf8")).toBe(before);
  });

  test("preflights synthetic facts and a single manifest-relative attachment without personal inputs", async () => {
    const { parent } = await fixture();
    const bytes = Buffer.from("%PDF-1.4\nSynthetic test attachment; not a candidate resume.\n%%EOF");
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const profilePath = join(parent, "candidate.json");
    const manifestPath = join(parent, "cvs.json");
    await writeFile(profilePath, JSON.stringify({ schemaVersion: 2, identity: { fullName: "Example Candidate" } }));
    await writeFile(join(parent, "approved.pdf"), bytes);
    await writeFile(manifestPath, JSON.stringify([{ category: "llm", path: "./approved.pdf", sha256 }]));
    const input = { profilePath, manifestPath, category: "llm", jobUrl: "https://careers.example.com/jobs/example" };
    expect(await runPreflight(input)).toMatchObject({ candidateName: "Example Candidate", cvPath: join(parent, "approved.pdf"), cvSha256: sha256 });
    expect((await runBatchPreflight({ profilePath, manifestPath, items: [{ applicationId: "example", category: input.category, jobUrl: input.jobUrl }] })).ready).toHaveLength(1);
    const outputs: string[] = [];
    expect(await runPreflightCli(["--url", input.jobUrl, "--category", "llm", "--profile", profilePath, "--manifest", manifestPath], { preflight: runPreflight, write: (text) => outputs.push(text) })).toBe(0);
    expect(JSON.parse(outputs[0]!)).toMatchObject({ ok: true, candidateName: "Example Candidate" });
    await writeFile(manifestPath, "[]");
    await expect(runPreflight(input)).rejects.toThrow("approved_cv_manifest_invalid");
  });

  test("accepts explicit input paths while rejecting ambiguous or malformed CLI combinations", () => {
    expect(parseProfileArgs(["--profile", "/example/profile.json", "--check"])).toEqual({ check: true, profilePath: "/example/profile.json" });
    expect(parsePreflightArgs(["--batch", "batch.json", "--profile", "profile.json", "--manifest", "cvs.json"])).toEqual({ batchPath: "batch.json", profilePath: "profile.json", manifestPath: "cvs.json" });
    expect(parseReviewServerArgs(["--review", "r", "--tracker", "t", "--jobs", "j", "--port", "64440"])).toMatchObject({ reviewPath: "r", trackerPath: "t", jobsPath: "j", port: 64440 });
    expect(parseRuntimeInitArgs(["--dir", "/example/runtime"])).toBe("/example/runtime");
    for (const args of [["--check", "--check"], ["--profile"], ["--profile", "--check"], ["--unknown"]]) expect(() => parseProfileArgs(args)).toThrow();
    for (const args of [["--batch", "b", "--url", "https://example.com"], ["--batch", "b", "--profile", "p", "--profile", "q"], ["--url", "--category", "llm"]]) expect(() => parsePreflightArgs(args)).toThrow();
    expect(() => parseRuntimeInitArgs(["--dir", "--check"])).toThrow();
  });
});
