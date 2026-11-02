import { cp, mkdtemp, readFile, readdir, rename, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, expect, test } from "vitest";
import { ensureExampleData, loadExample } from "./example.js";
import { upsertJob } from "./jobs/jobLibrary.js";
import { matchingContext } from "./matching/matching.js";
import { workspaceMatchingPaths } from "./matching/intake.js";
import { ApplicationTaskService } from "./review/applicationTasks.js";
import { randomUUID, createHash } from "node:crypto";

const directories: string[] = [];
const examples = fileURLToPath(new URL("../examples", import.meta.url));
afterEach(async () => { for (const path of directories.splice(0)) await rm(path, { recursive: true, force: true }); });
async function directory() { const root = await mkdtemp(join(tmpdir(), "course-example-")); directories.push(root); return root; }
const job = {jobId:"test-role",company:"Fictional Employer",title:"Software Engineer",location:"Seattle",category:"llm" as const,officialUrl:"https://careers.example.com/jobs/test",sources:["user-provided" as const],firstSeen:"2026-10-15",lastVerified:"2026-10-15",note:"Synthetic",status:"ready" as const};

test("startup supplies a default case and preserves subsequent local edits", async () => {
  const root = await directory();
  await ensureExampleData(root, examples);
  const path = join(root, "data/candidate.json"), modified = JSON.parse(await readFile(path, "utf8"));
  modified.availability.relocation = true; await writeFile(path, JSON.stringify(modified));
  await ensureExampleData(root, examples);
  expect(JSON.parse(await readFile(path, "utf8")).availability.relocation).toBe(true);
  expect(JSON.parse(await readFile(join(root,"data/opportunities.json"),"utf8")).opportunities).toHaveLength(5);
});

test("loads another candidate and resume name, removes old progress and backs up the prior state", async () => {
  const root = await directory(), alternate = await directory();
  const initial = await loadExample(root, examples);
  await upsertJob(initial.jobsPath, job);
  await cp(examples, alternate, { recursive: true });
  await rm(join(alternate,"snapshots"),{recursive:true});
  const profilePath = join(alternate, "candidate.json");
  const candidate = JSON.parse(await readFile(profilePath, "utf8"));
  candidate.identity = { fullName: "Jamie Reed", firstName: "Jamie", lastName: "Reed" };
  await writeFile(profilePath, JSON.stringify(candidate));
  await rename(join(alternate,"alex-liu-resume.pdf"),join(alternate,"alternate.pdf"));
  const manifest = JSON.parse(await readFile(join(alternate,"resumes.json"),"utf8"));
  manifest[0].path = "./alternate.pdf"; await writeFile(join(alternate,"resumes.json"),JSON.stringify(manifest));
  const next = await loadExample(root, alternate);
  expect(next.candidateName).toBe("Jamie Reed");
  expect(JSON.parse(await readFile(next.jobsPath,"utf8")).opportunities).toEqual([]);
  expect(await readdir(join(root,"data"))).not.toContain("alex-liu-resume.pdf");
  expect(await readFile(join(root,"data/alternate.pdf"))).toEqual(await readFile(join(alternate,"alternate.pdf")));
  expect(JSON.parse(await readFile(join(next.backupPath!,"opportunities.json"),"utf8")).opportunities).toHaveLength(6);
  expect(JSON.parse(await readFile(join(examples,"candidate.json"),"utf8")).identity.fullName).toBe("Alex Liu");
});

test("loads saved opportunity and discovery state when supplied by an example", async () => {
  const root = await directory(), saved = await directory();
  const inputs = await loadExample(saved, examples);
  await upsertJob(inputs.jobsPath, job);
  await writeFile(join(saved,"data/discovery-state.json"),JSON.stringify({version:1,sources:{fixture:{lastSuccessfulScanAt:"2026-10-15T12:00:00Z"}}}));
  const loaded = await loadExample(root, join(saved,"data"));
  expect(JSON.parse(await readFile(loaded.jobsPath,"utf8")).opportunities.some((item: {jobId: string}) => item.jobId === "test-role")).toBe(true);
  expect(JSON.parse(await readFile(join(root,"data/discovery-state.json"),"utf8")).sources.fixture).toBeDefined();
});

test("invalid snapshots and escaping resume paths leave current data unchanged", async () => {
  const root = await directory(), invalid = await directory();
  await loadExample(root, examples);
  const before = await readFile(join(root,"data/candidate.json"),"utf8");
  await cp(examples, invalid, {recursive:true});
  await writeFile(join(invalid,"snapshots/shortlist/opportunities.json"),'{"invalid":true}');
  await expect(loadExample(root, invalid)).rejects.toThrow();
  await rm(join(invalid,"snapshots"),{recursive:true});
  const manifest=JSON.parse(await readFile(join(invalid,"resumes.json"),"utf8"));
  manifest[0].path="../outside.pdf";await writeFile(join(invalid,"resumes.json"),JSON.stringify(manifest));
  await expect(loadExample(root, invalid)).rejects.toThrow("example_resume_outside_bundle");
  expect(await readFile(join(root,"data/candidate.json"),"utf8")).toBe(before);
  expect((await readdir(root)).filter(n=>n.startsWith('.example-load'))).toEqual([]);
});

test("rejects symlink inputs and does not silently replace existing malformed data on startup", async () => {
  const root = await directory(), invalid = await directory();
  await cp(examples, invalid, {recursive:true});
  if (process.platform === "win32") {
    await symlink(examples, join(invalid,"linked-resumes"), "junction");
    const manifest=JSON.parse(await readFile(join(invalid,"resumes.json"),"utf8"));
    manifest[0].path="linked-resumes/alex-liu-resume.pdf";
    await writeFile(join(invalid,"resumes.json"),JSON.stringify(manifest));
  } else { await rm(join(invalid,"candidate.json"));await symlink(join(examples,"candidate.json"),join(invalid,"candidate.json")); }
  await expect(loadExample(root, invalid)).rejects.toThrow("example_symlink_not_allowed");
  await loadExample(root, examples);
  await writeFile(join(root,"data/candidate.json"),"invalid");
  await ensureExampleData(root, examples);
  expect(await readFile(join(root,"data/candidate.json"),"utf8")).toBe("invalid");
});


test("both checkpoints share one candidate and five jobs; switching resets approvals and preserves private chat routing", async () => {
  const root=await directory();
  const shortlist=await loadExample(root,examples);
  expect(shortlist.snapshot).toBe("shortlist");expect(shortlist.entryPath).toBe("/status/us");
  const initial=JSON.parse(await readFile(shortlist.jobsPath,"utf8"));
  expect(initial.opportunities).toHaveLength(5);
  expect(initial.opportunities.every((job: {stage:string;application?:unknown})=>job.stage==="ready"&&!job.application)).toBe(true);
  const profile=await readFile(join(root,"data/candidate.json"),"utf8");
  const config=JSON.stringify({version:1,threadId:"test-local-routing",executable:"/test/codex"});
  await writeFile(join(root,"data/chat-runner.json"),config);
  await writeFile(join(root,"data/application-tasks.json"),JSON.stringify({version:1,tasks:[]}));
  const review=await loadExample(root,examples,"review");
  expect(review.applicationCount).toBe(5);expect(review.entryPath).toBe("/review");
  expect(await readFile(join(root,"data/candidate.json"),"utf8")).toBe(profile);
  expect(await readFile(join(root,"data/chat-runner.json"),"utf8")).toBe(config);
  expect(await readdir(join(root,"data"))).not.toContain("application-tasks.json");
  const opportunities=JSON.parse(await readFile(review.jobsPath,"utf8"));
  expect(opportunities.opportunities.map((job: {jobId:string})=>job.jobId)).toEqual(initial.opportunities.map((job: {jobId:string})=>job.jobId));
  const { readReviewBatch, selectQuestionOption, approveReviewContent }=await import("./review/reviewStore.js");
  const batch=await readReviewBatch(review.reviewPath);
  expect(batch.applications.every(item=>item.decision.state==="pending"&&!item.snapshotCurrent&&!item.cv.verified)).toBe(true);
  const nooks=batch.applications.find(item=>item.company==="Nooks")!;
  await selectQuestionOption(review.reviewPath,nooks.applicationId,nooks.snapshotId,"relocation","relocate",0);
  await approveReviewContent(review.reviewPath,nooks.applicationId,nooks.snapshotId,1);
  const again=await loadExample(root,examples,"shortlist");
  expect(again.applicationCount).toBe(0);
  expect((await readReviewBatch(join(again.backupPath!,"drafts"))).applications.find(item=>item.company==="Nooks")!.decision.state).toBe("approved");
  const reset=await loadExample(root,examples,"review");
  const resetNooks=(await readReviewBatch(reset.reviewPath)).applications.find(item=>item.company==="Nooks")!;
  expect(resetNooks.decision.state).toBe("pending");expect(resetNooks.questions[0]!.selectedOptionId).toBeUndefined();
}, process.platform === "win32" ? 60_000 : 20_000);

test("snapshot loading refuses an active runner and an unknown checkpoint without replacing data", async () => {
  const root=await directory();await loadExample(root,examples);
  const before=await readFile(join(root,"data/opportunities.json"),"utf8");
  await writeFile(join(root,"data/application-tasks.json.runner.lock"),String(process.pid));
  await expect(loadExample(root,examples,"review")).rejects.toThrow("stop_review_before_loading_example");
  await rm(join(root,"data/application-tasks.json.runner.lock"));
  await expect(loadExample(root,examples,"unknown" as "review")).rejects.toThrow("invalid_example_snapshot");
  expect(await readFile(join(root,"data/opportunities.json"),"utf8")).toBe(before);
});

test("Alex checkpoints retain current resume routing and preparation pins the exact PDF", async () => {
  for (const snapshot of ["shortlist", "review"] as const) {
    const root = await directory();
    const loaded = await loadExample(root, examples, snapshot);
    const paths = workspaceMatchingPaths(root);
    const context = await matchingContext(paths);
    const document = JSON.parse(await readFile(loaded.jobsPath, "utf8"));
    const digest = createHash("sha256").update(await readFile(join(root, "data/alex-liu-resume.pdf"))).digest("hex");
    for (const job of document.opportunities) {
      expect(job.resumeRecommendation).toMatchObject({ status: "matched", profileKey: "llm", sha256: digest, contextToken: context.token });
      expect(job.note).toContain("Authored fictional resume routing (not a Jev run)");
      if (snapshot === "review") expect(job.application.resumeCategory).toBe("llm");
    }
    // A synthetic dispatcher retains queued requests without running application work.
    const queue = new ApplicationTaskService({ ...loaded, taskPath: join(root, "data/application-tasks.json"), matchingPaths: paths }, "demo",
      async () => { throw new Error("unexpected_execution"); }, { threadId: randomUUID(), send: async () => "fictional-receipt" });
    try {
      const selected = document.opportunities.map((job: { jobId: string }) => job.jobId);
      const queued = await queue.enqueue({ action: "prepare", mode: "demo", requestId: randomUUID(), jobIds: selected });
      expect(queued).toHaveLength(5);
      expect(queued.every(task => task.target.resumeCategory === "llm" && task.target.resumeSha256 === digest)).toBe(true);
      await writeFile(paths.preferences, context.preferences + "\nChanged fictional preferences.\n");
      if (snapshot === "shortlist") await expect(queue.enqueue({ action: "prepare", mode: "demo", requestId: randomUUID(), jobIds: selected })).rejects.toThrow("matching_resume_changed");
    } finally { await queue.close(); }
  }
});
