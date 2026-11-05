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
 const legacy=await fetch(base+"/welcome",{redirect:"manual"});expect(legacy.status).toBe(302);expect(legacy.headers.get("location")).toBe("/");
 const setup=await(await fetch(base+"/")).text();expect(setup).not.toContain("Explore a fictional example");expect(setup.match(/href="\/example"/g)).toHaveLength(1);expect(setup).not.toContain("Continue a search");
 const example=await(await fetch(base+"/example")).text();expect(example).toContain("Back to CareerOS");expect(example).not.toContain('href="/welcome"');expect(example).toContain('class="brand-mark"');
 expect(await(await fetch(base+"/existing")).text()).toContain("No saved search results");
 const input={requestId:randomUUID(),fullName:fields.fullName,email:fields.email,summary:fields.summary,skills:"Research",institution:"Example School",degree:"BS",company:"",title:"",directions:"Research",locations:"",preferences:"Remote roles",confirmed:true};
 expect((await post(base+"/api/start/new",input,"https://attacker.invalid")).status).toBe(403);
 const r=await post(base+"/api/start/new",input);expect(r.status).toBe(200);const result=await r.json();
 const repeat=await post(base+"/api/start/new",input);expect((await repeat.json()).url).toBe(result.url);
 const html=await(await fetch(result.url)).text();expect(html).toContain("Background & skills");expect(html).toContain('href="/settings/accounts"');
 const selected=new URL(result.url).origin;
 for(const path of ["/status/us","/review","/interviews"]){expect((await fetch(selected+path)).status).toBe(200)}
 expect(await readdir(join(root,"local/workspaces"))).toHaveLength(1);
 const existing=await(await fetch(base+"/existing")).text();expect(existing).toContain(fields.fullName);expect(existing).toContain("No search results yet");
 const selection=existing.match(/name="selection" value="([^"]+)"/)![1]!;
 const resume=()=>fetch(base+"/api/start/existing",{method:"POST",headers:{origin:base},body:new URLSearchParams({selection})});
 const resumed=await(await resume()).json();expect(new URL(resumed.url).pathname).toBe("/status");expect(new URL(resumed.url).origin).toBe(selected);
 expect((await(await resume()).json()).url).toBe(resumed.url);
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
test("approved PDF profiles are explicit, immutable and confined to the workspace",async()=>{
 const root=await candidate(),before=await readProfileEditor(root);const request={token:before.token,category:"research_general",filename:"../../external.pdf",base64:Buffer.from("%PDF-1.4\nfixture only\n%%EOF").toString("base64"),approved:true};
 const after=await saveWebsiteResume(root,request);expect(after.manifest[0]?.category).toBe("research_general");expect(after.manifest[0]?.path).toMatch(/^resumes\/[a-f0-9-]+\.pdf$/);expect(await readFile(join(root,"data",after.manifest[0]!.path),"utf8")).toContain("%PDF");
 await expect(saveWebsiteResume(root,{...request,token:after.token})).rejects.toThrow("resume_profile_exists");
 await expect(saveWebsiteResume(root,{...request,token:after.token,category:"new",base64:Buffer.from("not a PDF").toString("base64")})).rejects.toThrow("invalid_resume");
});
test("profile endpoints enforce origin, strict JSON, consent, body limits and disconnected search feedback",async()=>{
 const root=await candidate(),paths=workspaceMatchingPaths(root);const s=await startReviewServer({trackerPath:paths.opportunities,jobsPath:paths.opportunities,reviewPath:join(root,"data/drafts"),workspaceRoot:root,port:0});servers.push(s);
 const state=await readProfileEditor(root);
 expect((await post(s.address+"/api/profile",{revision:state.profileRevision,confirmed:true,fields},"https://attacker.invalid")).status).toBe(403);
 expect((await post(s.address+"/api/profile",{revision:state.profileRevision,confirmed:false,fields})).status).toBe(400);
 expect((await post(s.address+"/api/profile",{revision:state.profileRevision,confirmed:true,fields})).status).toBe(200);
 expect((await post(s.address+"/api/search",{token:(await readProfileEditor(root)).token,requestId:randomUUID()})).status).toBe(503);
 const oversizedStatus = await new Promise<number | undefined>((resolve,reject)=>{const request=httpRequest(s.address+"/api/profile",{method:"POST",headers:{"content-type":"application/json","content-length":"1100001",origin:s.address}},response=>{response.resume();resolve(response.statusCode)});request.on("error",reject);request.end()});
 expect(oversizedStatus).toBe(413);
});

test("profile scripts remain valid and escape untrusted candidate content",async()=>{const root=await candidate();const state=await readProfileEditor(root);state.candidate.summary="</script><script>untrusted()</script>";const html=renderProfilePage(state);for(const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g))expect(()=>new Script(match[1]!)).not.toThrow();expect(html).not.toContain("<script>untrusted()</script>")});

test("fictional examples execute local Apply tasks without dispatching to the connected chat",async()=>{const root=await temporary();const server=await startWorkbench(root,{temporaryRoots:[],chat:{version:1,threadId:randomUUID(),executable:"missing-fictional-chat-executable"}});servers.push(server);const base=new URL(server.address).origin;const response=await fetch(base+"/api/start/example",{method:"POST",headers:{origin:base}});const selected=await response.json();const address=new URL(selected.url).origin;const request=await post(address+"/api/tasks",{action:"prepare",mode:"demo",requestId:randomUUID(),jobIds:["alex-nooks-311d6e70"]});expect(request.status).toBe(202);await expect.poll(async()=>{const state=await(await fetch(address+"/api/tasks")).json();return state.tasks[0]?.state},{interval:10,timeout:2000}).toBe("needs_review");const state=await(await fetch(address+"/api/tasks")).json();expect(state.tasks[0].chatDelivery).toBeUndefined()});

test("a confirmed single-user workspace reopens directly on Status after restart; examples never replace it",async()=>{
 const root=await temporary();let server=await startWorkbench(root,{temporaryRoots:[]});servers.push(server);
 const base=new URL(server.address).origin;
 expect(await(await fetch(server.address)).text()).toContain("Create profile");
 expect(await readdir(root)).toEqual([]);
 const input={requestId:randomUUID(),fullName:"Fictional Persistent User",email:"persistent@fictional.invalid",summary:fields.summary,skills:"Research",institution:"Example School",degree:"BS",company:"",title:"",directions:"Research",locations:"",preferences:"Remote roles",confirmed:true};
 const initial=await(await post(base+"/api/start/new",input)).json();expect(new URL(initial.url).pathname).toBe("/profile");
 const pointer=await readFile(join(root,"local/active-workspace.json"),"utf8");
 const demo=await fetch(base+"/api/start/example",{method:"POST",headers:{origin:base}});expect(demo.status).toBe(200);
 expect(await readFile(join(root,"local/active-workspace.json"),"utf8")).toBe(pointer);
 await servers.pop()!.close();server=await startWorkbench(root,{temporaryRoots:[]});servers.push(server);
 const reopened=await fetch(server.address);expect(new URL(reopened.url).pathname).toBe("/status/us");expect(await reopened.text()).toContain("<h1>Applications</h1>");
 const restored=JSON.parse(await readFile(join(root,"local/active-workspace.json"),"utf8"));
 await servers.pop()!.close();await rm(restored.workspace,{recursive:true});server=await startWorkbench(root,{temporaryRoots:[]});servers.push(server);
 expect(await(await fetch(server.address)).text()).toContain("Restore your workspace");
 expect(await readdir(join(root,"local/workspaces"))).toHaveLength(1); // Only the explicitly opened fictional example remains.
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
 const server=await startReviewServer({trackerPath:paths.opportunities,jobsPath:paths.opportunities,reviewPath:join(root,"data/drafts"),workspaceRoot:root,port:0});servers.push(server);
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
