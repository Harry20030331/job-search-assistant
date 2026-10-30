import { mkdtemp, mkdir, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { initializeRuntime } from "../runtime.js";
import { upsertJob } from "../jobs/jobLibrary.js";
import { listMatchingWorkspaces, rememberWorkspace } from "./workspaces.js";
import { startMatchingSurface } from "./surface.js";
const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(p => rm(p, { recursive: true, force: true }))); });
async function setup() {
  const root = await mkdtemp(join(tmpdir(), "workspace-discovery-")); roots.push(root);
  const project = join(root, "project"), temporary = join(root, "temporary");
  await mkdir(project); await mkdir(temporary);
  return { root, project, temporary, registry: join(project, "local/search-workspaces.json") };
}
async function workspace(path: string, populated = true) {
  await initializeRuntime(path);
  await writeFile(join(path, "data/candidate.json"), JSON.stringify({ schemaVersion: 2, identity: { fullName: "Casey Example" } }));
  if (populated) await upsertJob(join(path, "data/opportunities.json"), { jobId: "fictional-one", company: "Example", title: "Engineer", location: "Seattle", category: "llm", officialUrl: "https://jobs.example.com/one", sources: ["user-provided"], firstSeen: "2026-10-25", lastVerified: "2026-10-29", status: "ready", note: "Fictional fixture" });
}
test("discovers registered, local and legacy temporary results without altering their data", async () => {
  const { root, project, temporary, registry } = await setup();
  const external = join(root, "external"), legacy = join(temporary, "matching-old-demo");
  await workspace(external); await workspace(legacy);
  await mkdir(join(project, "local/workspaces"), { recursive: true });
  const local = join(project, "local/workspaces/first"); await workspace(local, false);
  const before = await readFile(join(external, "data/opportunities.json"), "utf8");
  await Promise.all([rememberWorkspace(external, registry), rememberWorkspace(legacy, registry)]);
  await rememberWorkspace(external, registry);
  const result = await listMatchingWorkspaces({ project, registry, temporaryRoots: [temporary] });
  expect(result.searches.map(w => w.path).sort()).toEqual((await Promise.all([realpath(external), realpath(legacy)])).sort());
  expect(result.searches[0]).toMatchObject({ candidate: "Casey Example", totalJobs: 1, activeJobs: 1, lastActivity: "2026-10-29" });
  expect(result.emptyWorkspaces.map(w => w.path)).toEqual([await realpath(local)]);
  expect((JSON.parse(await readFile(registry, "utf8"))).paths).toHaveLength(2);
  expect(await readFile(join(external, "data/opportunities.json"), "utf8")).toBe(before);
});
test("distinguishes no search results, missing workspaces and corrupt data", async () => {
  const { root, project, temporary, registry } = await setup();
  expect((await listMatchingWorkspaces({ project, temporaryRoots: [] })).message).toMatch(/^No saved search results were found\./);
  const missing = join(root, "gone");
  await workspace(missing); await rememberWorkspace(missing, registry); await rm(missing, { recursive: true });
  const broken = join(temporary, "matching-broken"); await workspace(broken);
  await writeFile(join(broken, "data/opportunities.json"), "invalid");
  const result = await listMatchingWorkspaces({ project, registry, temporaryRoots: [temporary] });
  expect(result.searches).toEqual([]);
  expect(result.diagnostics.map(d => d.error).sort()).toEqual(["saved_workspace_missing", "workspace_data_unreadable"].sort());
  expect(result.message).toContain("Some locations could not be checked");
});
test("does not recurse into unrelated folders or follow discovered symlinks", async () => {
  const { root, project, temporary } = await setup();
  const external = join(root, "external"); await workspace(external);
  await symlink(external, join(temporary, "matching-link"));
  await mkdir(join(temporary, "unrelated")); await workspace(join(temporary, "unrelated/matching-hidden"));
  expect((await listMatchingWorkspaces({ project, temporaryRoots: [temporary] })).searches).toEqual([]);
});
test("serves two selected workspaces on separate loopback ports before any search", async () => {
  const { root } = await setup();
  const one = join(root, "one"), two = join(root, "two");
  await workspace(one, false); await workspace(two);
  const a = await startMatchingSurface(one), b = await startMatchingSurface(two);
  try {
    expect(a.statusUrl).not.toBe(b.statusUrl);
    expect(a.statusUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/status\/us$/);
    expect(await (await fetch(a.statusUrl)).text()).toContain("No active applications");
    expect(await (await fetch(b.statusUrl)).text()).toContain("Example");
  } finally { await Promise.all([a.server.close(), b.server.close()]); }
});
