import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { SourceLinkedSessionMemory, createSessionMemory } from "./sessionMemory.js";
import { LocalTaskAdapter } from "./localTaskAdapter.js";
const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(p => rm(p, { recursive: true, force: true }))); });
const seed = {
  profile: "# Alex\nGraduates in July.",
  "job-selection": "# Screening\nRelocation undecided.",
  "application-answers": "# Applications\nKeep answers concise.",
  "interview-preparation": "# Interviews\nMock interviews."
};
async function setup() {
  const parent = await mkdtemp(join(tmpdir(), "session-memory-test-")); roots.push(parent);
  return SourceLinkedSessionMemory.initialize(join(parent, "case"), seed);
}
const edit = {document: "job-selection" as const, before: "Relocation undecided.",
  after: "Avoid New York relocation. Washington remote is eligible.", sources: ["core://S1/T1"]};
test("archives before review, resolves exact Core and makes repeated finalization harmless", async () => {
  const m = await setup(); await m.open("S1","thread-one");
  const turn = { id:"T1", user:"\nI do not want to move to New York. This list should be short.  \n", assistant:"Saved shortlist.\n" };
  await m.append("S1",turn);
  await expect(m.dream("S1", {baseRevision:0,reason:"explicit future instruction",edits:[edit]})).rejects.toThrow("archive_before_dreaming");
  const closed = await m.archive("S1");
  const review = {baseRevision:0,reason:"explicit future instruction",edits:[edit]};
  await m.dream("S1",review); const before = await m.inspect();
  await m.append("S1",turn); await m.archive("S1"); await m.dream("S1",review);
  expect(await m.inspect()).toEqual(before);
  expect((await m.source("core://S1/T1")).user).toBe(turn.user);
  expect((await m.archive("S1")).coreHash).toBe(closed.coreHash);
  await expect(m.append("S1", {...turn,user:"changed"})).rejects.toThrow("turn_conflict");
  await expect(m.append("S1", {...turn,id:"T2"})).rejects.toThrow("session_closed");
  expect((await m.search("move to New York"))).toHaveLength(1);
  const next = await new SourceLinkedSessionMemory(m.root).open("S2","thread-two");
  if (!("documents" in next)) throw new Error("Expected document memory");
  expect(next.documents).toEqual({...seed, "job-selection":
    "# Screening\nAvoid New York relocation. Washington remote is eligible. [S1/T1](core://S1/T1)"});
  expect(await readFile(join(m.root, "job-selection.md"), "utf8")).toBe(next.documents["job-selection"]);
});
test("rejects unresolvable evidence and stale reviews; zero updates preserve preference revision", async () => {
  const m = await setup(); await m.open("S1","one");
  await expect(m.open("S2","two")).rejects.toThrow("previous_session_not_reviewed");
  await m.append("S1",{id:"T1",user:"Only this answer needs detail.",assistant:"Expanded."}); await m.archive("S1");
  await expect(m.dream("S1",{baseRevision:0,reason:"bad",edits:[{...edit,sources:["core://S1/missing"]}]})).rejects.toThrow("source_not_archived");
  await expect(m.dream("S1",{baseRevision:1,reason:"stale",edits:[]})).rejects.toThrow("memory_revision_conflict");
  expect(await m.dream("S1",{baseRevision:0,reason:"Session-only request",edits:[]})).toMatchObject({changed:false,resultingRevision:0});
  expect(await m.open("S1","one")).toMatchObject({documents:seed});
  await expect(m.open("S1","other")).rejects.toThrow("session_thread_mismatch");
  expect(() => createSessionMemory("raw-trace",m.root)).toThrow("not_implemented");
});
test("concurrent appends retain both turns and task actions retain actual first decisions", async () => {
  const m = await setup(); await m.open("S1","one");
  await Promise.all(["T1","T2"].map(id => m.append("S1",{id,user:id,assistant:"ok"})));
  expect((await m.inspect()).sessions[0]!.turns).toHaveLength(2);
  const tasks = new LocalTaskAdapter(m.root);
  await tasks.initialize([{id:"J1",company:"Fictional",title:"SWE",city:"Seattle",description:"Simulated JD",provenance:"simulated-jd",verification:"not live"}]);
  const action = {sessionId:"S1",requestId:"first",decisions:[{jobId:"J1",disposition:"confirm" as const,reason:"Needs confirmation"}]};
  await tasks.decide(action); await tasks.decide(action);
  expect((await tasks.read()).actions).toHaveLength(1);
  await tasks.decide({...action,requestId:"second",decisions:[{jobId:"J1",disposition:"shortlist",reason:"Confirmed"}]});
  expect((await tasks.read()).actions[0]).toEqual(action);
  await expect(tasks.draft({jobId:"J1",status:"local-review",fields:[{question:"Invented question",answer:"x",source:"none"}],blocker:"",observedAt:"today"})).rejects.toThrow("verified_fields_required");
});

test("validates a complete review before writing and recovers a pending commit on reopen", async () => {
  const m = await setup();
  await m.open("S1","thread-one");
  await m.append("S1",{id:"T1",user:"I graduate in August and want mock interview feedback after each answer.",assistant:"Understood."});
  await m.archive("S1");
  const fact = {document:"profile" as const, before:"Graduates in July.", after:"Graduates in August.", sources:["core://S1/T1"]};
  const style = {document:"interview-preparation" as const, before:"Mock interviews.", after:"Give feedback after each answer.", sources:["core://S1/T1"]};
  const request = {baseRevision:0,reason:"Correct graduation and remember interview feedback timing",edits:[fact,style]};
  await expect(m.dream("S1",{...request,edits:[fact,{...style,before:"Unknown anchor"}]})).rejects.toThrow("document_anchor");
  expect(await readFile(join(m.root,"profile.md"),"utf8")).toBe(seed.profile);
  await m.dream("S1",request);
  const ledger = await readFile(join(m.root,"memory.json"),"utf8");
  const profile = await readFile(join(m.root,"profile.md"),"utf8");
  // Simulate interruption with some files still at their pre-commit contents.
  await writeFile(join(m.root,"profile.md"),seed.profile);
  await writeFile(join(m.root,".dream-pending.json"),JSON.stringify({documents:{profile},ledger}));
  const restored = new SourceLinkedSessionMemory(m.root);
  const next = await restored.open("S2","thread-two");
  if (!("documents" in next)) throw new Error("Expected document memory");
  expect(next.documents).toEqual({...seed,profile,"interview-preparation":"# Interviews\nGive feedback after each answer. [S1/T1](core://S1/T1)"});
  expect(next.revision).toBe(1);
  expect((await restored.dream("S1",request)).resultingRevision).toBe(1);
});

test("closing automatically reviews once, retries a failed review, and opens the next session at the committed revision", async () => {
  const memory = await setup();
  await memory.open("S1", "thread-one");
  await memory.append("S1", {id:"T1", user:"I want Washington remote, no New York relocation.", assistant:"Understood."});
  await expect(memory.close("S1", async () => { throw new Error("offline"); })).rejects.toThrow("offline");
  await expect(memory.open("S2", "thread-two")).rejects.toThrow("previous_session_not_reviewed");
  const first = await memory.close("S1", async archive => {
    expect(archive.core[0]?.source).toBe("core://S1/T1");
    return {baseRevision:archive.baseRevision, reason:"Relocation preference", edits:[edit]};
  });
  expect(first.review).toMatchObject({changed:true, resultingRevision:1});
  expect(await memory.close("S1", async () => { throw new Error("duplicate"); })).toEqual(first);
  const next = await memory.open("S2", "thread-two");
  if (!("documents" in next)) throw new Error("Expected document memory");
  expect(next.documents["job-selection"]).toContain("[S1/T1](core://S1/T1)");
  await memory.append("S2", {id:"T1", user:"Shorten this answer.", assistant:"Done."});
  const second = await memory.close("S2", async archive => ({
    baseRevision:archive.baseRevision, reason:"Only for this answer", edits:[]
  }));
  expect(second.review).toMatchObject({changed:false, resultingRevision:1});
  expect((await memory.open("S3", "thread-three")).revision).toBe(1);
});
