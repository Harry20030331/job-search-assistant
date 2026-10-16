import { cp, mkdtemp, readFile, readdir, rename, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, expect, test } from "vitest";
import { ensureExampleData, loadExample } from "./example.js";
import { upsertJob } from "./jobs/jobLibrary.js";

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
  expect(JSON.parse(await readFile(join(root,"data/opportunities.json"),"utf8")).opportunities).toEqual([]);
});

test("loads another candidate and resume name, removes old progress and backs up the prior state", async () => {
  const root = await directory(), alternate = await directory();
  const initial = await loadExample(root, examples);
  await upsertJob(initial.jobsPath, job);
  await cp(examples, alternate, { recursive: true });
  const profilePath = join(alternate, "candidate.json");
  const candidate = JSON.parse(await readFile(profilePath, "utf8"));
  candidate.identity = { fullName: "Jamie Reed", firstName: "Jamie", lastName: "Reed" };
  await writeFile(profilePath, JSON.stringify(candidate));
  await rename(join(alternate,"alex-morgan-resume.pdf"),join(alternate,"alternate.pdf"));
  const manifest = JSON.parse(await readFile(join(alternate,"resumes.json"),"utf8"));
  manifest[0].path = "./alternate.pdf"; await writeFile(join(alternate,"resumes.json"),JSON.stringify(manifest));
  const next = await loadExample(root, alternate);
  expect(next.candidateName).toBe("Jamie Reed");
  expect(JSON.parse(await readFile(next.jobsPath,"utf8")).opportunities).toEqual([]);
  expect(await readdir(join(root,"data"))).not.toContain("alex-morgan-resume.pdf");
  expect(await readFile(join(root,"data/alternate.pdf"))).toEqual(await readFile(join(alternate,"alternate.pdf")));
  expect(JSON.parse(await readFile(join(next.backupPath!,"opportunities.json"),"utf8")).opportunities).toHaveLength(1);
  expect(JSON.parse(await readFile(join(examples,"candidate.json"),"utf8")).identity.fullName).toBe("Alex Morgan");
});

test("loads saved opportunity and discovery state when supplied by an example", async () => {
  const root = await directory(), saved = await directory();
  const inputs = await loadExample(saved, examples);
  await upsertJob(inputs.jobsPath, job);
  await writeFile(join(saved,"data/discovery-state.json"),JSON.stringify({version:1,sources:{fixture:{lastSuccessfulScanAt:"2026-10-15T12:00:00Z"}}}));
  const loaded = await loadExample(root, join(saved,"data"));
  expect(JSON.parse(await readFile(loaded.jobsPath,"utf8")).opportunities[0].jobId).toBe("test-role");
  expect(JSON.parse(await readFile(join(root,"data/discovery-state.json"),"utf8")).sources.fixture).toBeDefined();
});

test("invalid snapshots and escaping resume paths leave current data unchanged", async () => {
  const root = await directory(), invalid = await directory();
  await loadExample(root, examples);
  const before = await readFile(join(root,"data/candidate.json"),"utf8");
  await cp(examples, invalid, {recursive:true});
  await writeFile(join(invalid,"opportunities.json"),'{"invalid":true}');
  await expect(loadExample(root, invalid)).rejects.toThrow();
  await rm(join(invalid,"opportunities.json"));
  const manifest=JSON.parse(await readFile(join(invalid,"resumes.json"),"utf8"));
  manifest[0].path="../outside.pdf";await writeFile(join(invalid,"resumes.json"),JSON.stringify(manifest));
  await expect(loadExample(root, invalid)).rejects.toThrow("example_resume_outside_bundle");
  expect(await readFile(join(root,"data/candidate.json"),"utf8")).toBe(before);
  expect((await readdir(root)).filter(n=>n.startsWith('.example-load'))).toEqual([]);
});

test("rejects symlink inputs and does not silently replace existing malformed data on startup", async () => {
  const root = await directory(), invalid = await directory();
  await cp(examples, invalid, {recursive:true});
  await rm(join(invalid,"candidate.json"));await symlink(join(examples,"candidate.json"),join(invalid,"candidate.json"));
  await expect(loadExample(root, invalid)).rejects.toThrow("example_symlink_not_allowed");
  await loadExample(root, examples);
  await writeFile(join(root,"data/candidate.json"),"invalid");
  await ensureExampleData(root, examples);
  expect(await readFile(join(root,"data/candidate.json"),"utf8")).toBe("invalid");
});
