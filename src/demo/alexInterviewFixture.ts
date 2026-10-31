import { createHash } from "node:crypto";
import { access, mkdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCandidateProfile } from "../profile.js";
import { readOpportunities } from "../storage/opportunities.js";
import { writePrivateFile } from "../storage/privateFiles.js";
import { readReviewBatch } from "../review/reviewStore.js";
import { markSubmitted, markConfirmed } from "../tracker.js";
import { linkInterview } from "../interview/workbench.js";
import { interviewHandoff } from "../interview/handoff.js";
import { stageInterview } from "../cli/interviewCli.js";

const examples = fileURLToPath(new URL("../../examples", import.meta.url));
const scenarios = [
  { id: "alex-adobe-screen", jobId: "alex-adobe-r172083", round: "recruiter", state: "completed", budget: 20,
    start: "2026-10-29T09:00:00-07:00", end: "2026-10-29T09:30:00-07:00", scope: "A fictional recruiter conversation about documented projects and role interest." },
  { id: "alex-adobe-technical", jobId: "alex-adobe-r172083", round: "technical", state: "scheduled", budget: 60,
    start: "2026-11-02T10:00:00-08:00", end: "2026-11-02T11:00:00-08:00", scope: "A fictional early-career technical round: bounded Python coding, testing and a discussion of one documented project. No senior distributed-system design." },
  { id: "alex-nooks-recruiter", jobId: "alex-nooks-311d6e70", round: "recruiter", state: "scheduled", budget: 25,
    start: "2026-11-03T11:00:00-08:00", end: "2026-11-03T11:30:00-08:00", scope: "A fictional recruiter round about background, genuine motivation, collaboration and logistics. No live coding." }
] as const;

/** Explicit recording fixture, never a live mailbox dispatcher or application executor. */
export async function prepareAlexInterviewFixture(runtime: string) {
  const root = resolve(runtime), data = join(root, "data"), profilePath = join(data, "candidate.json"), trackerPath = join(data, "opportunities.json");
  const profile = await loadCandidateProfile(profilePath);
  const sameProfile = createHash("sha256").update(await readFile(profilePath)).digest("hex") === createHash("sha256").update(await readFile(join(examples, "candidate.json"))).digest("hex");
  if (profile.fictional !== true || !sameProfile) throw new Error("exact_fictional_alex_profile_required");
  const before = await readOpportunities(trackerPath), expected = await readOpportunities(join(examples, "snapshots/review/opportunities.json"));
  if (JSON.stringify(before.opportunities.map(job => job.jobId).sort()) !== JSON.stringify(expected.opportunities.map(job => job.jobId).sort())) throw new Error("alex_five_role_checkpoint_required");
  const interviewRoot = join(data, "interviews");
  try { await access(join(interviewRoot, "registry.json")); throw new Error("alex_interviews_already_exist"); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  const tasks = JSON.parse(await readFile(join(data, "application-tasks.json"), "utf8")).tasks as Array<{ id: string; mode: string; action: string; state: string; target: { applicationId?: string; snapshotId?: string; jobId: string } }>;
  const drafts = (await readReviewBatch(join(data, "drafts"))).applications;
  const ids = [...new Set(scenarios.map(item => item.jobId))];
  const selected = ids.map(id => {
    const job = before.opportunities.find(item => item.jobId === id)!;
    const draft = drafts.find(item => item.applicationId === job.application?.applicationId);
    const task = tasks.find(item => item.mode === "demo" && item.action === "submit" && item.state === "demo_complete" && item.target.applicationId === job.application?.applicationId && item.target.snapshotId === draft?.snapshotId);
    if (!job.application || job.stage !== "in_review" || !draft || draft.decision.state !== "approved" || !task) throw new Error("complete_local_adobe_and_nooks_rehearsals_first");
    return { job, draft, task };
  });
  await mkdir(interviewRoot, { recursive: true });
  const write = (path: string, value: unknown) => writePrivateFile(path, JSON.stringify(value, null, 2) + "\n", { flag: "wx" });
  await write(join(interviewRoot, "demo-fixture.json"), { origin: "synthetic_test_script", fictional: true,
    note: "Authored post-submission fixture following two actual local demo tasks; no employer or Google operation. These mail files are synthetic and not Gmail observations.",
    sourceTaskIds: selected.map(item => item.task.id), scenarios, untouchedJobIds: before.opportunities.filter(job => !ids.includes(job.jobId as typeof ids[number])).map(job => job.jobId) });
  for (const { job, draft, task } of selected) {
    const receipt = join(interviewRoot, job.jobId + "-receipt.eml");
    await writePrivateFile(receipt, `From: demo@example.invalid\nTo: alex.liu@example.com\nSubject: Fictional application receipt: ${job.company}\nX-Demo: synthetic_test_script\n\nThis is an authored recording fixture, not an employer receipt. The preceding website task ${task.id} was only a local rehearsal.\n`, { flag: "wx" });
    const at = new Date().toISOString();
    await markSubmitted(trackerPath, job.application!.applicationId, { applicationId: job.application!.applicationId,
      snapshotId: draft.snapshotId, approvalConsumed: true, visibleResult: "submitted",
      authorization: { source: "chat", reference: "synthetic_test_script: explicit Alex Liu recording fixture; not real submission authorization", approvedAt: at },
      evidence: { source: "email", reference: "synthetic_test_script:" + receipt, verifiedAt: at } }, at);
    await markConfirmed(trackerPath, job.application!.applicationId, "confirmed", new Date().toISOString());
  }
  const paths = { trackerPath, profilePath };
  for (const item of scenarios) {
    const job = before.opportunities.find(job => job.jobId === item.jobId)!;
    await linkInterview(paths, { interviewId: item.id, jobId: item.jobId, applicationId: job.application!.applicationId,
      state: item.state, expectedRevision: null, schedule: { start: item.start, end: item.end, timezone: "America/Los_Angeles" },
      association: { source: "synthetic_test_script", reference: "Authored fictional invitation for the exact saved Alex application; not real recruiting evidence.", verifiedAt: new Date().toISOString() } });
  }
  const runs = [];
  for (const item of scenarios) {
    const job = before.opportunities.find(job => job.jobId === item.jobId)!;
    const folder = join(interviewRoot, item.id); await mkdir(folder);
    const settings = join(folder, "settings.json"), invitation = join(folder, "invitation.txt");
    await write(settings, { schemaVersion: 1, interviewId: item.id, round: item.round, timezone: "America/Los_Angeles", preparationBudgetMinutes: item.budget,
      priorities: ["Follow the explicitly fictional round scope", "Keep missing JD/company facts and personal motivations unknown"] });
    await writePrivateFile(invitation, `Fictional recording invitation; no actual employer contact.\nCandidate: Alex Liu\nCompany: ${job.company}\nRole: ${job.title}\nJob ID: ${job.jobId}\nApplication ID: ${job.application!.applicationId}\nRound: ${item.round}\nTime: ${item.start} to ${item.end}, America/Los_Angeles\n${item.scope}\nNo JD or verified company culture information is supplied. The role URL and original questions are saved historical references, not currently verified requirements. No actual employer question list or outcome is established.\n`, { flag: "wx" });
    const handoff = await interviewHandoff({ profile: profilePath, preferences: join(data, "preferences.md"), opportunities: trackerPath, settings, invitation }, item.jobId);
    const staged = await stageInterview(handoff, join(folder, "run")) as { workspace: string };
    runs.push({ ...item, workspace: staged.workspace });
  }
  const after = await readOpportunities(trackerPath);
  for (const job of before.opportunities.filter(job => !ids.includes(job.jobId as typeof ids[number]))) {
    if (JSON.stringify(after.opportunities.find(item => item.jobId === job.jobId)) !== JSON.stringify(job)) throw new Error("unrelated_alex_job_changed");
  }
  await write(join(interviewRoot, "runs.json"), { fictional: true, real_employer_actions: 0, real_google_calls: 0, paths, runs });
  return { fictional: true, runtime: root, runs, note: "Next: context analysis/plans and exact plan acceptance. No full practice is generated by this command." };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 4 || process.argv[2] !== "--runtime-dir") throw new Error("Usage: demo:alex:interviews -- --runtime-dir <selected-Alex-workspace>");
  prepareAlexInterviewFixture(process.argv[3]!).then(result => console.log(JSON.stringify(result))).catch(error => { console.error(error.message); process.exitCode = 1; });
}
