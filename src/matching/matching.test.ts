import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { matchingContext, publishMatchingRound, saveMatchingPreferences, type MatchingPaths } from "./matching.js";
import { demoAssessments, demoRules, runMatchingDemo } from "./demo.js";
import { saveOpportunities, readOpportunities, projectJobs } from "../storage/opportunities.js";
import { buildStatusView } from "../review/statusView.js";
import { createApplication } from "../tracker.js";
import { runMatchingCli } from "../cli/matchingCli.js";

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(p => rm(p, { recursive: true, force: true }))); });
const at = "2026-10-25T12:00:00.000Z";
async function setup() {
  const root = await mkdtemp(join(tmpdir(), "matching-")); roots.push(root);
  const paths: MatchingPaths = { profile: join(root, "candidate.json"), preferences: join(root, "preferences.md"), manifest: join(root, "resumes.json"), opportunities: join(root, "opportunities.json") };
  await writeFile(paths.profile, JSON.stringify({ schemaVersion: 2, identity: { fullName: "Fictional Person" } }));
  await writeFile(paths.preferences, "# Preferences\nKeep this independently maintained prose.\n");
  await writeFile(paths.manifest, JSON.stringify([{ category: "llm", path: "fictional.pdf", sha256: "a".repeat(64) }]));
  await saveOpportunities(paths.opportunities, { schemaVersion: 1, opportunities: [] });
  await saveMatchingPreferences(paths, { expectedToken: (await matchingContext(paths)).token, initialRules: demoRules, feedback: { id: "initial", text: "Use the supplied constraints", reference: "Fictional user instruction", at, patch: {} } });
  return { root, paths, assessments: demoAssessments("2026-10-25") };
}
const publish = async (paths: MatchingPaths, assessments: ReturnType<typeof demoAssessments>) => publishMatchingRound(paths, { version: 1, contextToken: (await matchingContext(paths)).token, assessments });
const feedback = async (paths: MatchingPaths, patch: object, id = "change") => saveMatchingPreferences(paths, { expectedToken: (await matchingContext(paths)).token, feedback: { id, text: "Apply these explicit user constraints", reference: "Fictional user feedback", at, patch } });

test("two rounds update recommendations and fixed Status without deleting jobs or closing vacancies", async () => {
  const { paths, assessments } = await setup();
  await publish(paths, assessments);
  await feedback(paths, { workModes: ["remote"], excludedCompanies: ["North Example"] });
  const result = await publish(paths, assessments);
  expect(result.results.map(r => r.decision)).toEqual(["reject", "reject", "recommend"]);
  const document = await readOpportunities(paths.opportunities);
  expect(document.opportunities).toHaveLength(3);
  expect(document.opportunities.every(o => o.availability === "open" && !o.application)).toBe(true);
  expect(document.opportunities.find(o => o.jobId === "fictional-north")?.stage).toBe("new");
  expect(buildStatusView([], projectJobs(document)).map(r => r.jobId)).toEqual(["fictional-meadow"]);
  await publish(paths, assessments);
  expect((await readOpportunities(paths.opportunities)).opportunities).toHaveLength(3);
  expect((await readFile(paths.preferences, "utf8")).startsWith("# Preferences\nKeep this independently maintained prose.\n")).toBe(true);
  expect((await matchingContext(paths)).policy?.feedback).toHaveLength(2);
  await feedback(paths, { workModes: ["remote", "hybrid"], excludedCompanies: [] }, "restore");
  await publish(paths, assessments);
  expect(buildStatusView([], projectJobs(await readOpportunities(paths.opportunities))).map(r => r.jobId)).toEqual(["fictional-north", "fictional-atlas"]);
});

test("stale analyses and concurrent feedback fail instead of losing preferences", async () => {
  const { paths, assessments } = await setup();
  const token = (await matchingContext(paths)).token;
  const command = (id: string) => ({ expectedToken: token, feedback: { id, text: "Remote only", reference: "Fictional user", at, patch: { workModes: ["remote"] } } });
  const results = await Promise.allSettled([saveMatchingPreferences(paths, command("one")), saveMatchingPreferences(paths, command("two"))]);
  expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
  await expect(publishMatchingRound(paths, { version: 1, contextToken: token, assessments })).rejects.toThrow("matching_context_changed");
  const fresh = (await matchingContext(paths)).token;
  await writeFile(paths.profile, JSON.stringify({ schemaVersion: 2, identity: { fullName: "Another Fictional Person" } }));
  await expect(publishMatchingRound(paths, { version: 1, contextToken: fresh, assessments })).rejects.toThrow("matching_context_changed");
});

test("unknown requirements stay questions and duplicates or incomplete rounds cannot partially publish", async () => {
  const { paths, assessments } = await setup();
  const unknown = { ...assessments[0]!, workMode: null, eligibleLocations: [] };
  expect((await publish(paths, [unknown])).results[0]?.decision).toBe("needs_confirmation");
  expect((await readOpportunities(paths.opportunities)).opportunities[0]?.stage).toBe("new");
  await expect(publish(paths, [assessments[0]!, assessments[0]!])).rejects.toThrow("duplicate_matching_assessment");
  await publish(paths, assessments);
  const before = await readFile(paths.opportunities, "utf8");
  await expect(publish(paths, [assessments[2]!])).rejects.toThrow("matching_round_incomplete");
  expect(await readFile(paths.opportunities, "utf8")).toBe(before);
});

test("normalized identity retains exclusions and Submission records are immutable to matching", async () => {
  const { paths, assessments } = await setup();
  await publish(paths, assessments);
  const job = assessments[1]!;
  await createApplication(paths.opportunities, { jobId: job.jobId, applicationId: "fictional-application", company: job.company, title: job.title, location: job.location, category: job.category, ats: "ashby", jobUrl: job.officialUrl, applicationUrl: job.officialUrl + "/apply", cvFilename: "fictional.pdf" }, at);
  const before = (await readOpportunities(paths.opportunities)).opportunities.find(o => o.jobId === job.jobId);
  await feedback(paths, { excludedJobIds: [assessments[0]!.jobId], excludedCompanies: [job.company] });
  assessments[0] = { ...assessments[0]!, jobId: "different-incoming-id", officialUrl: assessments[0]!.officialUrl + "?utm_source=fixture" };
  const result = await publish(paths, assessments);
  expect(result.results[0]?.jobId).toBe("fictional-north");
  expect(result.results[0]?.decision).toBe("reject");
  expect(result.protectedIds).toEqual([job.jobId]);
  expect((await readOpportunities(paths.opportunities)).opportunities.find(o => o.jobId === job.jobId)).toEqual(before);
});

test("CLI accepts explicit inputs and refuses malformed commands", async () => {
  const { paths } = await setup();
  expect(await runMatchingCli(["context", "--profile", paths.profile, "--preferences", paths.preferences, "--manifest", paths.manifest])).toHaveProperty("token");
  await expect(runMatchingCli(["feedback"])).rejects.toThrow("invalid_arguments");
  await feedback(paths, { categories: ["recommendation"] });
  expect((await matchingContext(paths)).categoriesWithoutResume).toEqual(["recommendation"]);
});

test("an outdated observation rolls back the complete publication", async () => {
  const { paths, assessments } = await setup();
  await publish(paths, assessments);
  const before = await readFile(paths.opportunities, "utf8");
  assessments[0] = { ...assessments[0]!, match: ["Changed explanation that must not partially save"] };
  assessments[1] = { ...assessments[1]!, firstSeen: "2026-10-24", lastVerified: "2026-10-24" };
  await expect(publish(paths, assessments)).rejects.toThrow("matching_observation_outdated");
  expect(await readFile(paths.opportunities, "utf8")).toBe(before);
});

test("remote-only feedback turns an unknown work mode into a saved research question", async () => {
  const { paths, assessments } = await setup();
  const unknown = { ...assessments[0]!, workMode: null };
  expect((await publish(paths, [unknown])).results[0]?.decision).toBe("recommend");
  await feedback(paths, { workModes: ["remote"] });
  const result = await publish(paths, [unknown]);
  expect(result.results[0]?.decision).toBe("needs_confirmation");
  expect(result.results[0]?.questions).toContain("Confirm permitted work mode");
  const stored = (await readOpportunities(paths.opportunities)).opportunities[0]!;
  expect(stored.stage).toBe("new");
  expect(stored.note).toMatch(/^user-excluded:/);
  expect(buildStatusView([], projectJobs(await readOpportunities(paths.opportunities)))).toEqual([]);
});

test("offline demo is isolated and refuses to replace existing state", async () => {
  const parent = await mkdtemp(join(tmpdir(), "matching-demo-")); roots.push(parent);
  const root = join(parent, "case");
  const demo = await runMatchingDemo(root, join(parent, "index.json"));
  expect(demo.before.filter(r => r.decision === "recommend")).toHaveLength(2);
  expect(demo.after.filter(r => r.decision === "recommend").map(r => r.jobId)).toEqual(["fictional-meadow"]);
  await expect(runMatchingDemo(root)).rejects.toThrow();
});
