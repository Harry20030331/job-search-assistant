import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { assertLiveCandidate } from "./liveCandidate.js";

const directories: string[] = [];
afterEach(async () => { for (const root of directories.splice(0)) await rm(root, { recursive: true, force: true }); });
async function fixture(candidate: unknown) {
  const root = await mkdtemp(join(tmpdir(), "candidate-guard-")); directories.push(root);
  await mkdir(join(root, "data"));
  await writeFile(join(root, "data/candidate.json"), JSON.stringify(candidate));
  return root;
}

test("an explicit false fixture flag does not reject every live candidate", async () => {
  const root = await fixture({ schemaVersion: 2, fictional: false, contact: { email: "candidate@employer.org" } });
  await expect(assertLiveCandidate(root)).resolves.toBeUndefined();
});

test.each(["candidate@example.com", "candidate@sub.example.org", "candidate@fixture.test", "candidate@fixture.invalid"])("reserved contact %s cannot enable live execution", async email => {
  const root = await fixture({ schemaVersion: 2, fictional: false, contact: { email } });
  await expect(assertLiveCandidate(root)).rejects.toThrow("fictional candidate");
});

test("fictional and missing candidate inputs fail closed", async () => {
  const root = await fixture({ schemaVersion: 2, fictional: true, contact: { email: "candidate@employer.org" } });
  await expect(assertLiveCandidate(root)).rejects.toThrow("fictional candidate");
  await writeFile(join(root, "data/candidate.json"), JSON.stringify({ schemaVersion: 2 }));
  await expect(assertLiveCandidate(root)).rejects.toThrow("candidate email");
  await rm(join(root, "data/candidate.json"));
  await expect(assertLiveCandidate(root)).rejects.toThrow();
});

test("the guard checks composed profile facts instead of just the descriptor text", async () => {
  const root = await fixture({ schemaVersion: 3, shared: { profile: "profile.json", experience: "experience.json" }, job: {} });
  await writeFile(join(root, "data/profile.json"), JSON.stringify({ schemaVersion: 1, identity: { fullName: "Test Candidate" }, contact: { email: "candidate@example.com" }, languages: [], education: [], school: {}, links: {}, highSchool: {}, _meta: {} }));
  await writeFile(join(root, "data/experience.json"), JSON.stringify({ schemaVersion: 1, experiences: [], skills: [], projects: [], publications: [], _meta: {} }));
  await expect(assertLiveCandidate(root)).rejects.toThrow("fictional candidate");
});
