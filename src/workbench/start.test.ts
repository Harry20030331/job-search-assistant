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
 expect(await(await fetch(s.address)).text()).toContain("Welcome. Let's get started.");expect(await readdir(root)).toEqual([]);
 expect(await(await fetch(base+"/existing")).text()).toContain("No saved search results");
 const input={requestId:randomUUID(),fullName:fields.fullName,email:fields.email,summary:fields.summary,skills:"Research",institution:"Example School",degree:"BS",company:"",title:"",directions:"Research",locations:"",preferences:"Remote roles",confirmed:true};
 expect((await post(base+"/api/start/new",input,"https://attacker.invalid")).status).toBe(403);
 const r=await post(base+"/api/start/new",input);expect(r.status).toBe(200);const result=await r.json();
 const repeat=await post(base+"/api/start/new",input);expect((await repeat.json()).url).toBe(result.url);
 const html=await(await fetch(result.url)).text();expect(html).toContain("Background & skills");expect(html).toContain("Interview preparation");
 const selected=new URL(result.url).origin;
 for(const path of ["/status/us","/review","/interviews"]){expect((await fetch(selected+path)).status).toBe(200)}
 expect(await readdir(join(root,"local/workspaces"))).toHaveLength(1);
 const existing=await(await fetch(base+"/existing")).text();expect(existing).toContain(fields.fullName);expect(existing).toContain("No search results yet");
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
 expect((await post(s.address+"/api/search",{token:state.token,requestId:randomUUID()})).status).toBe(503);
 const oversizedStatus = await new Promise<number | undefined>((resolve,reject)=>{const request=httpRequest(s.address+"/api/profile",{method:"POST",headers:{"content-type":"application/json","content-length":"1100001",origin:s.address}},response=>{response.resume();resolve(response.statusCode)});request.on("error",reject);request.end()});
 expect(oversizedStatus).toBe(413);
});

test("profile scripts remain valid and escape untrusted candidate content",async()=>{const root=await candidate();const state=await readProfileEditor(root);state.candidate.summary="</script><script>untrusted()</script>";const html=renderProfilePage(state);for(const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g))expect(()=>new Script(match[1]!)).not.toThrow();expect(html).not.toContain("<script>untrusted()</script>")});
