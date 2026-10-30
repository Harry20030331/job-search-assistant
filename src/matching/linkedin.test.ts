import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { linkedInProfileUrl, previewLinkedInImport } from "./linkedin.js";
import { createMatchingWorkspace } from "./intake.js";
import { runMatchingCli } from "../cli/matchingCli.js";
const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(p => rm(p, { recursive: true, force: true }))); });
const observed = {
  sourceUrl: "https://www.linkedin.com/in/fictional-casey/?trk=fixture", observedUrl: "https://www.linkedin.com/in/fictional-casey/", observedAt: "2026-10-29T12:00:00.000Z", access: "visible",
  sections: {
    fullName: { value: "Casey Example", evidence: "Fictional profile header" },
    headline: { value: "Software engineer working on retrieval prototypes", evidence: "Fictional profile headline" },
    education: [{ value: { institution: "Example Institute", degree: "MS" }, evidence: "Fictional education section; dates not visible" }],
    skills: [{ value: "Python", evidence: "Fictional skills section" }]
  }
};
test("maps visible facts without filling missing history, dates or private answers", () => {
  const result = previewLinkedInImport(observed);
  expect(result.status).toBe("needs_confirmation");
  expect(result.proposal).toMatchObject({ schemaVersion: 2, identity: { fullName: "Casey Example" }, skills: ["Python"], links: { linkedin: "https://www.linkedin.com/in/fictional-casey/" } });
  expect(result.proposal).not.toHaveProperty("experiences");
  expect(result.proposal).not.toHaveProperty("contact");
  expect(result.proposal).not.toHaveProperty("workAuthorization");
  expect((result.proposal?.education as object[])[0]).not.toHaveProperty("endDate");
});
test("unavailable profiles return a manual fallback and reject purported extracted facts", () => {
  const blocked = { ...observed, observedUrl: "https://www.linkedin.com/authwall", access: "login_required", sections: {} };
  expect(previewLinkedInImport(blocked)).toMatchObject({ status: "blocked", proposal: null });
  expect(previewLinkedInImport(blocked).message).toContain("resume is optional");
  expect(() => previewLinkedInImport({ ...blocked, sections: observed.sections })).toThrow("linkedin_unavailable_facts_rejected");
});
test("rejects wrong profile, non-profile URLs and lookalike domains", () => {
  expect(linkedInProfileUrl("https://linkedin.com/in/fictional-casey/details/experience/")).toBe("https://www.linkedin.com/in/fictional-casey/");
  for (const url of ["https://linkedin.com.evil.example/in/fictional-casey", "https://www.linkedin.com/jobs/1", "http://linkedin.com/in/fictional-casey", "https://user:pass@linkedin.com/in/fictional-casey"]) expect(() => linkedInProfileUrl(url)).toThrow();
  expect(() => previewLinkedInImport({ ...observed, observedUrl: "https://linkedin.com/in/another-fictional-case/" })).toThrow("linkedin_profile_identity_mismatch");
});
test("reports existing-fact conflicts without altering the current candidate", () => {
  const existing = { schemaVersion: 2, identity: { fullName: "Taylor Example" }, summary: "Confirmed original summary", skills: ["TypeScript"] };
  const before = JSON.stringify(existing);
  const result = previewLinkedInImport(observed, existing);
  expect(result.conflicts.map(c => c.field).sort()).toEqual(["identity.fullName", "skills", "summary"]);
  expect(JSON.stringify(existing)).toBe(before);
});
test("requires confirmation to save imported facts and preserves omitted history through search intake", async () => {
  const parent = await mkdtemp(join(tmpdir(), "linkedin-intake-")); roots.push(parent);
  const root = join(parent, "case"), preview = previewLinkedInImport(observed);
  const input = { confirmed: false, reference: "Fictional user confirms imported facts", candidate: preview.proposal,
    preferences: "Entry-level LLM work in Seattle", rules: { categories: ["llm"], workModes: ["remote"], locations: ["Seattle, WA"], excludedCompanies: [], excludedJobIds: [], limit: 3, perCompany: 1 } };
  await expect(createMatchingWorkspace(root, input, join(parent, "index.json"))).rejects.toThrow();
  const result = await createMatchingWorkspace(root, { ...input, confirmed: true }, join(parent, "index.json"));
  const saved = JSON.parse(await readFile(result.paths.profile, "utf8"));
  expect(saved._meta.linkedinImport).toMatchObject({ state: "confirmed", confirmationReference: input.reference });
  expect(saved).not.toHaveProperty("experiences");
  const file = join(parent, "observations.json");
  await writeFile(file, JSON.stringify(observed));
  expect(await runMatchingCli(["linkedin-preview", "--input", file, "--workspace", root])).toHaveProperty("status", "needs_confirmation");
});
