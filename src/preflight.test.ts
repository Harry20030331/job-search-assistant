import { createHash } from "node:crypto";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { runBatchPreflight, runPreflight } from "./preflight.js";

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "application-agent-preflight-"));
  const pdfPath = join(directory, "approved.pdf");
  const bytes = Buffer.from("approved resume fixture");
  await writeFile(pdfPath, bytes);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const profilePath = join(directory, "profile.json");
  await writeFile(profilePath, JSON.stringify({ schemaVersion: 2, identity: { fullName: "Alex Morgan" } }));
  const manifestPath = join(directory, "cvs.json");
  await writeFile(manifestPath, JSON.stringify([
    { category: "llm", path: pdfPath, sha256 },
    { category: "robotics", path: pdfPath, sha256 },
    { category: "recommendation", path: pdfPath, sha256 }
  ]));
  return { directory, manifestPath, pdfPath, profilePath, sha256 };
}

describe("runPreflight", () => {
  test.each(["llm", "robotics", "recommendation"] as const)("routes exact %s category", async (category) => {
    const files = await fixture();
    const result = await runPreflight({
      category,
      jobUrl: "https://jobs.example.com/role",
      manifestPath: files.manifestPath,
      profilePath: files.profilePath
    });
    expect(result).toMatchObject({ category, cvPath: files.pdfPath, cvSha256: files.sha256 });
  });

  test("rejects an absent category", async () => {
    const files = await fixture();
    await expect(runPreflight({ category: "", jobUrl: "https://jobs.example.com/role", ...files })).rejects.toThrow("explicit_category_required");
  });

  test("rejects an unknown category", async () => {
    const files = await fixture();
    await expect(runPreflight({ category: "finance", jobUrl: "https://jobs.example.com/role", ...files })).rejects.toThrow("unsupported_category");
  });

  test("rejects a malformed or non-HTTPS job URL", async () => {
    const files = await fixture();
    await expect(runPreflight({ category: "llm", jobUrl: "javascript:alert(1)", ...files })).rejects.toThrow("invalid_job_url");
  });

  test("rejects a missing CV", async () => {
    const files = await fixture();
    const missing = join(files.directory, "missing.pdf");
    await writeFile(files.manifestPath, JSON.stringify([
      { category: "llm", path: missing, sha256: files.sha256 },
      { category: "robotics", path: files.pdfPath, sha256: files.sha256 },
      { category: "recommendation", path: files.pdfPath, sha256: files.sha256 }
    ]));
    await expect(runPreflight({ category: "llm", jobUrl: "https://jobs.example.com/role", manifestPath: files.manifestPath, profilePath: files.profilePath })).rejects.toThrow("approved_cv_missing");
  });

  test("rejects a CV hash mismatch", async () => {
    const files = await fixture();
    await writeFile(files.manifestPath, JSON.stringify([
      { category: "llm", path: files.pdfPath, sha256: "0".repeat(64) },
      { category: "robotics", path: files.pdfPath, sha256: files.sha256 },
      { category: "recommendation", path: files.pdfPath, sha256: files.sha256 }
    ]));
    await expect(runPreflight({ category: "llm", jobUrl: "https://jobs.example.com/role", manifestPath: files.manifestPath, profilePath: files.profilePath })).rejects.toThrow("approved_cv_hash_mismatch");
  });

  test("allows a configured subset but rejects an explicitly requested unmapped category", async () => {
    const files = await fixture();
    await writeFile(files.manifestPath, JSON.stringify([
      { category: "llm", path: files.pdfPath, sha256: files.sha256 },
      { category: "robotics", path: files.pdfPath, sha256: files.sha256 }
    ]));
    await expect(runPreflight({ category: "llm", jobUrl: "https://jobs.example.com/role", ...files })).resolves.toMatchObject({ cvPath: files.pdfPath });
    await expect(runPreflight({ category: "recommendation", jobUrl: "https://jobs.example.com/role", ...files })).rejects.toThrow("approved_cv_not_configured");
    await expect(runBatchPreflight({ items: [{ applicationId: "missing", category: "recommendation", jobUrl: "https://jobs.example.com/role" }], profilePath: files.profilePath, manifestPath: files.manifestPath })).rejects.toThrow("approved_cv_not_configured");
  });

  test("rejects duplicate category entries", async () => {
    const files = await fixture();
    const duplicate = { category: "llm", path: files.pdfPath, sha256: files.sha256 };
    await writeFile(files.manifestPath, JSON.stringify([duplicate, duplicate,
      { category: "robotics", path: files.pdfPath, sha256: files.sha256 },
      { category: "recommendation", path: files.pdfPath, sha256: files.sha256 }
    ]));
    await expect(runPreflight({ category: "llm", jobUrl: "https://jobs.example.com/role", manifestPath: files.manifestPath, profilePath: files.profilePath })).rejects.toThrow("approved_cv_manifest_invalid");
  });
});

describe("runBatchPreflight", () => {
  test("returns ready siblings while parking invalid per-item URLs and categories", async () => {
    const files = await fixture();
    const result = await runBatchPreflight({
      items: [
        { applicationId: "a", jobUrl: "https://jobs.example.com/a", category: "llm" },
        { applicationId: "b", jobUrl: "bad", category: "robotics" },
        { applicationId: "c", jobUrl: "https://jobs.example.com/c", category: "finance" }
      ],
      manifestPath: files.manifestPath,
      profilePath: files.profilePath
    });

    expect(result.ready).toEqual([
      expect.objectContaining({
        applicationId: "a",
        category: "llm",
        jobUrl: "https://jobs.example.com/a",
        cvPath: files.pdfPath,
        cvSha256: files.sha256,
        candidateName: "Alex Morgan"
      })
    ]);
    expect(result.parked).toEqual([
      { applicationId: "b", error: "invalid_job_url" },
      { applicationId: "c", error: "unsupported_category" }
    ]);
  });

  test("loads each shared canonical input once and reads a shared physical PDF only once", async () => {
    const files = await fixture();
    const reads = new Map<string, number>();

    await runBatchPreflight({
      items: [
        { applicationId: "a", jobUrl: "https://jobs.example.com/a", category: "llm" },
        { applicationId: "b", jobUrl: "https://jobs.example.com/b", category: "llm" },
        { applicationId: "c", jobUrl: "https://jobs.example.com/c", category: "robotics" }
      ],
      manifestPath: files.manifestPath,
      profilePath: files.profilePath
    }, {
      readText: async (path) => {
        const key = String(path);
        reads.set(key, (reads.get(key) ?? 0) + 1);
        return readFile(path, "utf8");
      },
      readBytes: async (path) => {
        const key = String(path);
        reads.set(key, (reads.get(key) ?? 0) + 1);
        return readFile(path);
      }
    });

    expect(reads.get(files.profilePath)).toBe(1);
    expect(reads.get(files.manifestPath)).toBe(1);
    expect(reads.get(files.pdfPath)).toBe(1);
  });

  test("reads each distinct physical PDF path exactly once", async () => {
    const files = await fixture();
    const roboticsPath = join(files.directory, "robotics.pdf");
    const recommendationPath = join(files.directory, "recommendation.pdf");
    const roboticsBytes = Buffer.from("robotics resume fixture");
    const recommendationBytes = Buffer.from("recommendation resume fixture");
    await writeFile(roboticsPath, roboticsBytes);
    await writeFile(recommendationPath, recommendationBytes);
    await writeFile(files.manifestPath, JSON.stringify([
      { category: "llm", path: files.pdfPath, sha256: files.sha256 },
      { category: "robotics", path: roboticsPath, sha256: createHash("sha256").update(roboticsBytes).digest("hex") },
      { category: "recommendation", path: recommendationPath, sha256: createHash("sha256").update(recommendationBytes).digest("hex") }
    ]));
    const reads = new Map<string, number>();

    await runBatchPreflight({
      items: [{ applicationId: "a", jobUrl: "https://jobs.example.com/a", category: "llm" }],
      manifestPath: files.manifestPath,
      profilePath: files.profilePath
    }, {
      readText: (path) => readFile(path, "utf8"),
      readBytes: async (path) => {
        reads.set(path, (reads.get(path) ?? 0) + 1);
        return readFile(path);
      }
    });

    expect(reads).toEqual(new Map([
      [files.pdfPath, 1],
      [roboticsPath, 1],
      [recommendationPath, 1]
    ]));
  });

  test("compares every shared-path manifest entry against its own expected hash", async () => {
    const files = await fixture();
    await writeFile(files.manifestPath, JSON.stringify([
      { category: "llm", path: files.pdfPath, sha256: files.sha256 },
      { category: "robotics", path: files.pdfPath, sha256: "0".repeat(64) },
      { category: "recommendation", path: files.pdfPath, sha256: files.sha256 }
    ]));
    let pdfReads = 0;

    await expect(runBatchPreflight({
      items: [{ applicationId: "a", jobUrl: "https://jobs.example.com/a", category: "llm" }],
      manifestPath: files.manifestPath,
      profilePath: files.profilePath
    }, {
      readText: (path) => readFile(path, "utf8"),
      readBytes: async (path) => {
        pdfReads += 1;
        return readFile(path);
      }
    })).rejects.toThrow("approved_cv_hash_mismatch");

    expect(pdfReads).toBe(1);
  });

  test.each([
    { name: "duplicate application IDs", mutate: (input: Record<string, unknown>) => input },
    { name: "an empty batch", mutate: () => ({ items: [] }) },
    { name: "more than 25 items", mutate: () => ({ items: Array.from({ length: 26 }, (_, index) => ({ applicationId: `a-${index}`, jobUrl: "https://jobs.example.com/a", category: "llm" })) }) },
    { name: "extra batch fields", mutate: (input: Record<string, unknown>) => ({ ...input, extra: true }) },
    { name: "extra item fields", mutate: (input: Record<string, unknown>) => ({ ...input, items: [{ applicationId: "a", jobUrl: "https://jobs.example.com/a", category: "llm", extra: true }] }) }
  ])("rejects $name as a whole-batch input error", async ({ name, mutate }) => {
    const files = await fixture();
    const base = {
      items: [
        { applicationId: "duplicate", jobUrl: "https://jobs.example.com/a", category: "llm" },
        { applicationId: "duplicate", jobUrl: "https://jobs.example.com/b", category: "robotics" }
      ],
      manifestPath: files.manifestPath,
      profilePath: files.profilePath
    };
    const changed = mutate(base) as typeof base;
    const expected = name === "duplicate application IDs" ? "duplicate_application_id" : "invalid_batch_input";
    await expect(runBatchPreflight({ ...base, ...changed })).rejects.toThrow(expected);
  });

  test.each([
    { name: "profile", prepare: async (files: Awaited<ReturnType<typeof fixture>>) => writeFile(files.profilePath, "not-json") },
    { name: "manifest", prepare: async (files: Awaited<ReturnType<typeof fixture>>) => writeFile(files.manifestPath, "not-json") },
    { name: "approved PDF", prepare: async (files: Awaited<ReturnType<typeof fixture>>) => writeFile(files.pdfPath, "changed") }
  ])("rejects the whole batch when the shared $name is invalid", async ({ prepare }) => {
    const files = await fixture();
    await prepare(files);
    await expect(runBatchPreflight({
      items: [
        { applicationId: "a", jobUrl: "https://jobs.example.com/a", category: "llm" },
        { applicationId: "b", jobUrl: "bad", category: "robotics" }
      ],
      manifestPath: files.manifestPath,
      profilePath: files.profilePath
    })).rejects.toThrow();
  });
});
