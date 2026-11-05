import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { createExampleSearchWorkspace, createMatchingWorkspace } from "./intake.js";
import { runMatchingCli } from "../cli/matchingCli.js";
import { runPreflight } from "../preflight.js";
const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(p => rm(p, { recursive: true, force: true }))); });
const input = {
  confirmed: true, reference: "Fictional user confirms the intake summary",
  candidate: { schemaVersion: 2, identity: { fullName: "Casey Example" }, summary: "MS student with a retrieval course project", skills: ["Python", "Retrieval"], education: [{ degree: "MS", endDate: "2027-06" }], experiences: [], availability: { relocation: null } },
  preferences: "Entry-level applied LLM roles. Seattle remote or hybrid. Start July 2027. Relocation unknown.",
  rules: { categories: ["llm"], workModes: ["remote", "hybrid"], locations: ["Seattle, WA"], excludedCompanies: [], excludedJobIds: [], limit: 3, perCompany: 1 }
};
async function target() { const parent = await mkdtemp(join(tmpdir(), "intake-")); roots.push(parent); return join(parent, "case"); }
test("confirmed search intake preserves unknowns, needs no resume and remains blocked from application preflight", async () => {
  const directory = await target();
  const result = await createMatchingWorkspace(directory, input, join(dirname(directory), "index.json"));
  expect(result.context.candidate.availability).toEqual({ relocation: null });
  expect(result.context.availableResumeCategories).toEqual([]);
  expect(result.context.candidate).not.toHaveProperty("contact");
  expect(JSON.parse(await readFile(result.paths.profile, "utf8")).resumes).toEqual([]);
  const context = await runMatchingCli(["context", "--workspace", result.root]);
  expect(context).toHaveProperty("token", result.context.token);
  await expect(runPreflight({ category: "llm", jobUrl: "https://jobs.example.com/one", profilePath: result.paths.profile, manifestPath: result.paths.manifest })).rejects.toThrow("approved_cv_manifest_invalid");
  await expect(createMatchingWorkspace(result.root, input)).rejects.toThrow();
  expect((JSON.parse(await readFile(result.paths.profile, "utf8"))).identity.fullName).toBe("Casey Example");
});
test("unconfirmed or empty-background intake cannot initialize a candidate workspace", async () => {
  await expect(createMatchingWorkspace(await target(), { ...input, confirmed: false })).rejects.toThrow();
  await expect(createMatchingWorkspace(await target(), { ...input, candidate: { ...input.candidate, education: [] } })).rejects.toThrow("matching_background_required");
});

test("creates a registered fictional workspace before research without running scripted recommendations", async () => {
  const root = await target();
  const registry = join(dirname(root), "index.json");
  const result = await createExampleSearchWorkspace(root, registry);
  expect(JSON.parse(await readFile(result.paths.profile, "utf8")).fictional).toBe(true);
  const saved = JSON.parse(await readFile(result.paths.opportunities, "utf8")).opportunities;
  const seed = new URL("../../evaluation/cases/alex/data/opportunities/opportunities.json", import.meta.url);
  expect(saved).toEqual(JSON.parse(await readFile(seed, "utf8")).opportunities);
  expect(saved.every((job: { stage: string; application?: unknown }) => job.stage === "new" && !job.application)).toBe(true);
  expect(JSON.parse(await readFile(registry, "utf8")).paths).toHaveLength(1);
  await expect(createExampleSearchWorkspace(root, registry)).rejects.toThrow();
});
