import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { interviewHandoff, type InterviewPaths } from "./handoff.js";
import { runInterviewCli } from "../cli/interviewCli.js";

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(path => rm(path, { recursive: true, force: true }))); });
async function setup() {
  const root = await mkdtemp(join(tmpdir(), "interview-handoff-")); roots.push(root);
  const paths: InterviewPaths = Object.fromEntries(["profile", "preferences", "opportunities", "settings", "invitation"].map(key => [key, join(root, key + ".json")])) as unknown as InterviewPaths;
  const job = { jobId: "fictional-job", company: "Cedar Example (fictional)", title: "ML Engineer", location: "Remote", category: "llm",
    officialUrl: "https://example.invalid/jobs/ml", sources: ["user-provided"], firstSeen: "2026-10-25", lastVerified: "2026-10-25", note: "", availability: "open", stage: "ready" };
  await writeFile(paths.opportunities, JSON.stringify({ schemaVersion: 1, opportunities: [job] }));
  await writeFile(paths.profile, JSON.stringify({ schemaVersion: 2, identity: { fullName: "Fictional Candidate" }, skills: ["Python"], projects: [], contact: { email: "not-for-preparation@example.invalid" } }));
  await writeFile(paths.preferences, "# Confirmed fictional preferences\nNo personal claims may be invented.\n");
  await writeFile(paths.settings, JSON.stringify({ schemaVersion: 1, interviewId: "fictional-interview", round: null, timezone: "America/Los_Angeles", preparationBudgetMinutes: 90, priorities: ["Explain supplied projects"] }));
  await writeFile(paths.invitation, "Fictional invitation. Time and round have not been confirmed.");
  return { root, paths };
}
const args = (paths: InterviewPaths) => ["--profile", paths.profile, "--preferences", paths.preferences, "--opportunities", paths.opportunities, "--settings", paths.settings, "--invitation", paths.invitation, "--job-id", "fictional-job"];

test("projects canonical facts with stable IDs and preserves the shared store", async () => {
  const { paths } = await setup(), before = await readFile(paths.opportunities, "utf8");
  const handoff = await interviewHandoff(paths, "fictional-job");
  expect(handoff.application).toMatchObject({ job_id: "fictional-job", application_id: null, round: null });
  expect(handoff.profile.name).toBe("Fictional Candidate");
  expect(handoff.candidateSource.profile_path).toBe(paths.profile);
  expect(handoff.sources["canonical-candidate"]).not.toContain("not-for-preparation");
  expect(await readFile(paths.opportunities, "utf8")).toBe(before);
  expect(await runInterviewCli(["context", ...args(paths)])).toEqual(handoff);
});

test("changed candidate facts invalidate staging before Python is started", async () => {
  const { paths, root } = await setup(), before = await interviewHandoff(paths, "fictional-job");
  await writeFile(paths.profile, JSON.stringify({ schemaVersion: 2, identity: { fullName: "Different Candidate" } }));
  await expect(runInterviewCli(["stage", ...args(paths), "--expected-token", before.token, "--output", join(root, "new-run")])).rejects.toThrow("interview_stale_context");
});

test("tracks optional v3 shared-source files in the freshness token", async () => {
  const { root, paths } = await setup();
  const sharedPath = join(root, "shared.json"), experiencePath = join(root, "experience.json");
  const shared = { schemaVersion: 1, identity: { fullName: "Fictional Shared Candidate" }, contact: {}, languages: [], education: [], school: {}, links: {}, highSchool: {}, _meta: {} };
  await writeFile(sharedPath, JSON.stringify(shared));
  await writeFile(experiencePath, JSON.stringify({ schemaVersion: 1, experiences: [], skills: ["Python"], projects: [], publications: [], _meta: {} }));
  await writeFile(paths.profile, JSON.stringify({ schemaVersion: 3, shared: { profile: "shared.json", experience: "experience.json" }, job: {} }));
  const before = await interviewHandoff(paths, "fictional-job");
  expect(before.candidateSource.profile_path).toBe(sharedPath);
  const secondDescriptor = join(root, "another-job.json");
  await writeFile(secondDescriptor, await readFile(paths.profile));
  expect((await interviewHandoff({ ...paths, profile: secondDescriptor }, "fictional-job")).candidateSource).toEqual(before.candidateSource);
  expect(before.sourceVersions.map(source => source.path)).toContain(experiencePath);
  await writeFile(experiencePath, JSON.stringify({ schemaVersion: 1, experiences: [], skills: ["Python", "SQL"], projects: [], publications: [], _meta: {} }));
  expect((await interviewHandoff(paths, "fictional-job")).token).not.toBe(before.token);
});

test("requires a selected job, explicit valid settings and unambiguous CLI paths", async () => {
  const { paths } = await setup();
  await expect(interviewHandoff(paths, "unknown")).rejects.toThrow("interview_job_not_found");
  await expect(runInterviewCli(["context", ...args(paths), "--workspace", "elsewhere"])).rejects.toThrow("invalid_arguments");
  const settings = JSON.parse(await readFile(paths.settings, "utf8"));
  await writeFile(paths.settings, JSON.stringify({ ...settings, timezone: "Invalid/Timezone" }));
  await expect(interviewHandoff(paths, "fictional-job")).rejects.toThrow();
});

test("retains an existing Submission application ID without updating its lifecycle", async () => {
  const { paths } = await setup();
  const document = JSON.parse(await readFile(paths.opportunities, "utf8"));
  document.opportunities[0].stage = "submitted";
  document.opportunities[0].application = {
    applicationId: "fictional-submission-id", ats: "ashby", applicationUrl: "https://example.invalid/jobs/ml/apply",
    cvFilename: "fictional.pdf", visibleResult: "submitted", gmailConfirmation: "not_checked",
    createdAt: "2026-10-24T12:00:00Z", updatedAt: "2026-10-24T12:00:00Z", submittedAt: "2026-10-24T12:00:00Z"
  };
  const before = JSON.stringify(document);
  await writeFile(paths.opportunities, before);
  expect((await interviewHandoff(paths, "fictional-job")).application.application_id).toBe("fictional-submission-id");
  expect(await readFile(paths.opportunities, "utf8")).toBe(before);
});
