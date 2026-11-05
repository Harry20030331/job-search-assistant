import { request as httpRequest } from "node:http";
import { Script } from "node:vm";
import { renderProfilePage } from "./profileView.js";
import { mkdtemp, rm, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { afterEach, expect, test } from "vitest";
import { startWorkbench } from "./start.js";
import { readProfileEditor, saveProfileEditor, saveWebsitePreferences, saveWebsiteResume } from "./profileStore.js";
import { createMatchingWorkspace } from "../matching/intake.js";
import { startReviewServer } from "../review/reviewServer.js";
import { workspaceMatchingPaths } from "../matching/intake.js";
const roots: string[] = [], servers: { close(): Promise<void> }[] = [];
afterEach(async()=>{for(const s of servers.splice(0))await s.close();for(const r of roots.splice(0))await rm(r,{recursive:true,force:true})});
async function temporary(){const root=await mkdtemp(join(tmpdir(),"web-workbench-"));roots.push(root);return root}
const fields={fullName:"Fictional Example",email:"example@example.com",phone:"",summary:"Builds interactive tools",skills:["Research"],education:[{institution:"Example School",degree:"BS",field:"Computing"}],experiences:[]};
async function candidate(){const base=await temporary(),root=join(base,"candidate");await createMatchingWorkspace(root,{confirmed:true,reference:"Fictional test fixture",candidate:{schemaVersion:2,identity:{fullName:fields.fullName},summary:fields.summary,skills:fields.skills,education:fields.education,applicationFacts:{preserved:true}},preferences:"Keep this original preference prose.",rules:{categories:["Research"],locations:[],workModes:["remote"],excludedCompanies:["Excluded Example"],excludedJobIds:[],limit:5,perCompany:1}},join(base,"registry.json"));return root}
const post=(url:string,body:unknown,origin=new URL(url).origin)=>fetch(url,{method:"POST",headers:{"content-type":"application/json",origin},body:JSON.stringify(body)});
test("welcome starts without selecting or writing candidate data; new setup is isolated and idempotent",async()=>{
 const root=await temporary();const s=await startWorkbench(root,{temporaryRoots:[]});servers.push(s);const base=new URL(s.address).origin;
 expect(await(await fetch(s.address)).text()).toContain("Create profile");expect(await readdir(root)).toEqual([]);
 expect(await(await fetch(base+"/existing")).text()).toContain("Create profile");
 const input={requestId:randomUUID(),fullName:fields.fullName,email:fields.email,summary:fields.summary,skills:"Research",institution:"Example School",degree:"BS",company:"",title:"",directions:"Research",locations:"",preferences:"Remote roles",confirmed:true};
 expect((await post(base+"/api/start/new",input,"https://attacker.invalid")).status).toBe(403);
 const r=await post(base+"/api/start/new",input);expect(r.status).toBe(200);const result=await r.json();
 const repeat=await post(base+"/api/start/new",input);expect((await repeat.json()).url).toBe(result.url);
 const html=await(await fetch(result.url)).text();expect(html).toContain("Background & skills");expect(html).toContain('href="/settings/accounts"');
 const selected=new URL(result.url).origin;
 for(const path of ["/status/us","/review","/interviews"]){expect((await fetch(selected+path)).status).toBe(200)}
 const saved=JSON.parse(await readFile(join(root,"data/profile/candidate.json"),"utf8"));
 expect(saved.identity.fullName).toBe(fields.fullName);
 expect((await post(base+"/api/start/new",{...input,requestId:randomUUID(),fullName:"Second Person"})).status).toBe(409);
 expect(await readdir(root)).not.toContain("local");
 expect(new URL((await fetch(base+"/existing")).url).origin).toBe(selected);
 const font=await fetch(selected+"/assets/InterVariable.woff2");expect(font.headers.get("content-type")).toBe("font/woff2");expect(Buffer.from(await font.arrayBuffer()).subarray(0,4).toString()).toBe("wOF2");
});
test("profile saves preserve hidden facts and reject a stale concurrent editor",async()=>{
 const root=await candidate();const before=await readProfileEditor(root);
 const after=await saveProfileEditor(root,{revision:before.profileRevision,confirmed:true,fields:{...fields,summary:"Updated summary"}});
 expect(after.candidate.applicationFacts).toEqual({preserved:true});expect(after.candidate.summary).toBe("Updated summary");
 await expect(saveProfileEditor(root,{revision:before.profileRevision,confirmed:true,fields})).rejects.toThrow("profile_changed");
 const attempts=await Promise.allSettled([saveProfileEditor(root,{revision:after.profileRevision,confirmed:true,fields}),saveProfileEditor(root,{revision:after.profileRevision,confirmed:true,fields:{...fields,summary:"Another change"}})]);
 expect(attempts.filter(r=>r.status==="fulfilled")).toHaveLength(1);
});
test("preference feedback preserves prose and exclusions, uses current context and requires new screening",async()=>{
 const root=await candidate(),before=await readProfileEditor(root);
 const after=await saveWebsitePreferences(root,{token:before.token,directions:["Product"],locations:["Example City"],workModes:["hybrid"],feedback:"Look for product research"});
 expect(after.preferences).toContain("Keep this original preference prose.");expect(after.policy?.rules.excludedCompanies).toEqual(["Excluded Example"]);expect(after.policy?.rules.categories).toEqual(["Product"]);
 await expect(saveWebsitePreferences(root,{token:before.token,directions:["Product"],locations:[],workModes:["remote"],feedback:"Stale update"})).rejects.toThrow("matching_context_changed");
});
test("editing or clearing merged search notes replaces the local Markdown while keeping filter rules",async()=>{
  const root=await candidate();
  const initial=await readProfileEditor(root);
  const legacy=await saveWebsitePreferences(root,{token:initial.token,directions:["Research"],locations:[],workModes:["remote"],feedback:"Prefer small teams"});
  expect(legacy.searchNotes.content).toContain("Keep this original preference prose.");
  expect(legacy.searchNotes.content).toContain("Prefer small teams");
  const edit={document:"job-selection",revision:legacy.searchNotes.revision,content:"Hybrid works.\n- Within Seattle."};
  const saved=await saveWebsitePreferences(root,edit);
  expect(saved.searchNotes.content).toBe(edit.content);
  expect(saved.policy?.rules).toEqual(legacy.policy?.rules);
  const file=await readFile(workspaceMatchingPaths(root).preferences,"utf8");
  expect(file.split("## Confirmed Matching preferences")[0]).toContain(edit.content);
  await expect(saveWebsitePreferences(root,edit)).rejects.toThrow("profile_changed");
  await saveWebsitePreferences(root,{...edit,revision:saved.searchNotes.revision,content:""});
  expect((await readProfileEditor(root)).searchNotes.content).toBe("");
});
test("approved PDF profiles are explicit, immutable and confined to the workspace",async()=>{
 const root=await candidate(),before=await readProfileEditor(root);const request={token:before.token,category:"research_general",filename:"../../external.pdf",base64:Buffer.from("%PDF-1.4\nfixture only\n%%EOF").toString("base64"),approved:true};
 const after=await saveWebsiteResume(root,request);expect(after.manifest[0]?.category).toBe("research_general");expect(after.manifest[0]?.path).toMatch(/^resumes\/[a-f0-9-]+\.pdf$/);expect(await readFile(join(root,"data/profile",after.manifest[0]!.path),"utf8")).toContain("%PDF");
 await expect(saveWebsiteResume(root,{...request,token:after.token})).rejects.toThrow("resume_profile_exists");
 await expect(saveWebsiteResume(root,{...request,token:after.token,category:"new",base64:Buffer.from("not a PDF").toString("base64")})).rejects.toThrow("invalid_resume");
});
test("profile endpoints enforce origin, strict JSON, consent, body limits and disconnected search feedback",async()=>{
 const root=await candidate(),paths=workspaceMatchingPaths(root);const s=await startReviewServer({trackerPath:paths.opportunities,jobsPath:paths.opportunities,reviewPath:join(root,"data/opportunities"),workspaceRoot:root,port:0});servers.push(s);
 const state=await readProfileEditor(root);
 expect((await post(s.address+"/api/profile",{revision:state.profileRevision,confirmed:true,fields},"https://attacker.invalid")).status).toBe(403);
 expect((await post(s.address+"/api/profile",{revision:state.profileRevision,confirmed:false,fields})).status).toBe(400);
 expect((await post(s.address+"/api/profile",{revision:state.profileRevision,confirmed:true,fields})).status).toBe(200);
 expect((await post(s.address+"/api/search",{token:(await readProfileEditor(root)).token,requestId:randomUUID()})).status).toBe(503);
 const oversizedStatus = await new Promise<number | undefined>((resolve,reject)=>{const request=httpRequest(s.address+"/api/profile",{method:"POST",headers:{"content-type":"application/json","content-length":"1100001",origin:s.address}},response=>{response.resume();resolve(response.statusCode)});request.on("error",reject);request.end()});
 expect(oversizedStatus).toBe(413);
});

test("profile scripts remain valid and escape untrusted candidate content",async()=>{const root=await candidate();const state=await readProfileEditor(root);state.candidate.summary="</script><script>untrusted()</script>";const html=renderProfilePage(state);for(const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g))expect(()=>new Script(match[1]!)).not.toThrow();expect(html).not.toContain("<script>untrusted()</script>")});

test("Try example serves navigable snapshots and returns to personal setup without creating data", async () => {
  const root = await temporary();
  const server = await startWorkbench(root);
  servers.push(server);
  const base = new URL(server.address).origin;
  const status = await fetch(base + "/example", { redirect: "error" });
  expect(status.status).toBe(200);
  const html = await status.text();
  for (const company of ["Cedar Search", "Raincloud Systems", "Hudson AI", "Summit Platform", "Harbor Index"]) expect(html).toContain(company);
  expect(html).toContain('href="/example/jobs/A1"');
  expect(html).not.toContain('id="run-selected"');
  expect(html).not.toContain('Not matched yet');
  expect(html).not.toContain('>Direction</th>');
  expect(html.match(/class="resume-tag"/g)).toHaveLength(5);
  expect(html).toContain('</nav><a class="workspace-return"');
  const batch = "job=A1&job=A2";
  const review = await (await fetch(base + "/example/review?stage=in_review&" + batch)).text();
  expect(review).toContain("Recall@5");
  expect(review).toContain("Agent Task Bench");
  expect(review).toContain("Approve (2)");
  const submitted = await (await fetch(base + "/example?stage=submitted&" + batch)).text();
  expect(submitted.match(/data-status="submitted"/g)).toHaveLength(2);
  const interview = await (await fetch(base + "/example/interview?stage=interviewing&focus=A1&" + batch)).text();
  expect(interview).toContain("Retrieval evaluation");
  expect((await fetch(base + "/example/review?job=unknown")).status).toBe(404);
  const job = await (await fetch(base + "/example/jobs/A1")).text();
  expect(job).toContain("Seattle hybrid");
  const profile = await (await fetch(base + "/example/profile")).text();
  expect(profile).toContain("Alex Liu");
  for (const view of [html, job, profile]) expect(view).toContain('href="/"><span aria-hidden="true">←</span> My workspace');
  expect((await post(base + "/api/tasks", { action: "prepare" })).status).toBe(404);
  expect(await readdir(root)).toEqual([]);
});

test("a confirmed single-user workspace reopens directly on Status after restart; examples never replace it",async()=>{
 const root=await temporary();let server=await startWorkbench(root,{temporaryRoots:[]});servers.push(server);
 const base=new URL(server.address).origin;
 expect(await(await fetch(server.address)).text()).toContain("Create profile");
 expect(await readdir(root)).toEqual([]);
 const input={requestId:randomUUID(),fullName:"Fictional Persistent User",email:"persistent@fictional.invalid",summary:fields.summary,skills:"Research",institution:"Example School",degree:"BS",company:"",title:"",directions:"Research",locations:"",preferences:"Remote roles",confirmed:true};
 const initial=await(await post(base+"/api/start/new",input)).json();expect(new URL(initial.url).pathname).toBe("/profile");
 const profilePath=join(root,"data/profile/candidate.json");
 const personal=await readFile(profilePath,"utf8");
 const demo=await fetch(base+"/api/start/example",{method:"POST",headers:{origin:base}});expect(demo.status).toBe(200);
 expect(await readFile(profilePath,"utf8")).toBe(personal);
 expect(await readdir(root)).not.toContain("evaluation");
 await servers.pop()!.close();server=await startWorkbench(root,{temporaryRoots:[]});servers.push(server);
 const reopened=await fetch(server.address);expect(new URL(reopened.url).pathname).toBe("/status/us");expect(await reopened.text()).toContain("<h1>Applications</h1>");
 expect((await post(new URL(server.address).origin+"/api/start/new",input)).status).toBe(200);
 await servers.pop()!.close();await rm(profilePath);server=await startWorkbench(root);servers.push(server);
 expect(await(await fetch(server.address)).text()).toContain("Restore your profile");

});


test("flexible website preferences clear only requested filters and survive reload without manual job titles",async()=>{
 const root=await candidate(),before=await readProfileEditor(root);
 const after=await saveWebsitePreferences(root,{token:before.token,directions:["Stale direction"],flexibleDirection:true,locations:["Stale city"],flexibleLocation:true,workModes:["remote"],feedback:""});
 expect(after.policy?.rules.categories).toEqual([]);expect(after.policy?.rules.locations).toEqual([]);
 expect(after.policy?.rules.excludedCompanies).toEqual(before.policy?.rules.excludedCompanies);
 expect(after.candidate).toEqual(before.candidate);expect(after.manifest).toEqual(before.manifest);
 expect((await readProfileEditor(root)).policy?.rules.categories).toEqual([]);
 const html=renderProfilePage(after);expect(html).toContain('name="flexibleDirection"');expect(html).toContain('name="flexibleLocation"');expect(html).toContain('No job titles needed.');
 for(const script of html.matchAll(/<script>([\s\S]*?)<\/script>/g))expect(()=>new Script(script[1]!)).not.toThrow();
 await expect(saveWebsitePreferences(root,{token:after.token,directions:[],flexibleDirection:false,locations:[],flexibleLocation:true,workModes:["remote"],feedback:""})).rejects.toThrow("preference_direction_required");
 await expect(saveWebsitePreferences(root,{token:after.token,directions:["Research"],locations:[],flexibleLocation:false,workModes:["remote"],feedback:""})).rejects.toThrow("preference_location_required");
 const specific=await saveWebsitePreferences(root,{token:after.token,directions:["Research"],flexibleDirection:false,locations:["Example City"],flexibleLocation:false,workModes:["hybrid"],feedback:"Specific scope"});
 expect(specific.policy?.rules.categories).toEqual(["Research"]);expect(specific.policy?.rules.locations).toEqual(["Example City"]);
});

test("preferences HTTP accepts multiline feedback longer than 2000 characters and reports actionable field errors",async()=>{
 const root=await candidate(),paths=workspaceMatchingPaths(root);
 const server=await startReviewServer({trackerPath:paths.opportunities,jobsPath:paths.opportunities,reviewPath:join(root,"data/opportunities"),workspaceRoot:root,port:0});servers.push(server);
 const initial=await readProfileEditor(root),feedback="Remote roles\n\n"+"Fictional preference detail. ".repeat(100);
 const input={token:initial.token,directions:[],flexibleDirection:true,locations:[],flexibleLocation:true,workModes:["remote"],feedback};
 const response=await post(server.address+"/api/preferences",input);expect(response.status).toBe(200);
 const saved=await response.json();expect(saved.policy.feedback.at(-1).text).toBe(feedback.trim());
 expect(saved.policy.rules.categories).toEqual([]);expect(saved.policy.rules.excludedCompanies).toEqual(initial.policy?.rules.excludedCompanies);
 expect(saved.candidate).toEqual(initial.candidate);expect(saved.manifest).toEqual(initial.manifest);
 expect((await readProfileEditor(root)).policy?.feedback.at(-1)?.text).toBe(feedback.trim());
 const before=await readFile(paths.preferences,"utf8");
 for(const [patch,error] of [[{feedback:"x".repeat(20001)},"preference_feedback_too_long"],[{workModes:[]},"preference_work_mode_required"],[{flexibleDirection:false},"preference_direction_required"],[{flexibleLocation:false},"preference_location_required"]] as const){
  const rejected=await post(server.address+"/api/preferences",{...input,token:saved.token,...patch});expect(rejected.status).toBe(400);expect(await rejected.json()).toEqual({ok:false,error});
 }
 expect(await readFile(paths.preferences,"utf8")).toBe(before);
 expect((await post(server.address+"/api/preferences",input)).status).toBe(409);
});

test("a real-layout session keeps exact turns, writes only the cited preference and reopens it in Profile", async () => {
  const { UserSessions } = await import("../memory/userSessions.js");
  const root = await candidate();
  const memory = new UserSessions(root);
  const initial = await readProfileEditor(root);
  await memory.open("S1", "fictional-first-thread");
  const user = "For future interviews, start with system design.";
  await memory.append("S1", { id: "T1", user, assistant: "Understood." });
  await memory.close("S1", async () => ({ baseRevision: 0, reason: "Explicit future scope",
    edits: [{ document: "interview-preparation", before: "", after: "Start with system design.", sources: ["core://S1/T1"] }] }));
  await memory.close("S1", async () => { throw new Error("review must run only once"); });
  const next = await new UserSessions(root).open("S2", "fictional-second-thread");
  expect(next.documents["interview-preparation"]).toContain("[S1/T1](core://S1/T1)");
  expect(await memory.source("core://S1/T1")).toMatchObject({ user, assistant: "Understood." });
  expect(JSON.parse(await readFile(join(root,"data/sessions/S1.json"), "utf8")).turns).toHaveLength(1);
  const editor = await readProfileEditor(root);
  expect(editor.documents![0]).toEqual(initial.documents![0]);
  expect(editor.documents![1]!.content).toBe(next.documents["interview-preparation"]);
  expect(editor.preferences).toBe(initial.preferences);
  expect(editor.profileRevision).toBe(initial.profileRevision);
  await expect(saveWebsitePreferences(root, { document: "interview", revision: initial.documents![1]!.revision,
    content: "A stale manual edit" })).rejects.toThrow("profile_changed");
});
