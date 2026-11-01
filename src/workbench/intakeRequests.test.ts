import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { Script } from "node:vm";
import { afterEach, expect, test } from "vitest";
import { beginIntakeRequest, workIntakeRequest, readIntakeRequest, reviseIntakeRequest, confirmIntakeRequest, intakeDirectory } from "./intakeRequests.js";
import { renderNewCandidate } from "./intakeView.js";
import { startWorkbench } from "./start.js";
const roots:string[]=[];const servers:{close():Promise<void>}[]=[];
afterEach(async()=>{for(const server of servers.splice(0))await server.close();for(const root of roots.splice(0))await rm(root,{recursive:true,force:true})});
async function setup(){const root=await mkdtemp(join(tmpdir(),"source-intake-"));roots.push(root);const threadId=randomUUID(),chat={version:1 as const,threadId,executable:"/fictional/codex"};const calls:string[][]=[];const run=async(_exe:string,args:string[])=>{calls.push(args);return {stdout:`Queued message ${randomUUID()} for thread ${threadId}.`}};return {root,chat,run,calls}}
const candidate={schemaVersion:2,identity:{fullName:"Fictional Casey"},summary:"Builds research prototypes",skills:["Research"],education:[{institution:"Example University",degree:"BS"}]};
const preview={candidate,uncertainties:["Exact start date is unknown"],reference:"Fictional supplied text"};
const preferences={revision:0,confirmed:true,directions:["Product Management"],locations:[],flexibleLocation:true,workModes:["remote"],notes:"New Grad roles only"};
const post=(url:string,body:unknown,origin=new URL(url).origin)=>fetch(url,{method:"POST",headers:{origin,"content-type":"application/json"},body:JSON.stringify(body)});

test("three accessible source choices replace the upfront form and all inline scripts compile",()=>{const html=renderNewCandidate();for(const label of ["LinkedIn","Paste text","Upload PDF","Create profile","Review"])expect(html).toContain(label);expect(html).toContain('role="tablist"');expect(html).toContain('aria-controls="panel-pdf"');expect(html).not.toContain('name="fullName"');expect(html).not.toContain('id="intake"');expect(html).not.toContain('/assets/interview-actions.js');for(const script of html.matchAll(/<script>([\s\S]*?)<\/script>/g))expect(()=>new Script(script[1]!)).not.toThrow()});

test("pasted text is staged without candidate creation, delivered once and confirmed only after a reviewed preview",async()=>{
 const f=await setup(),requestId=randomUUID(),source={requestId,kind:"text",value:"Fictional Casey studies at Example University and builds research prototypes."};
 expect(await beginIntakeRequest(f.root,f.chat,source,f.run)).toMatchObject({state:"delivered",revision:0});await beginIntakeRequest(f.root,f.chat,source,f.run);expect(f.calls).toHaveLength(1);expect(f.calls[0]?.at(-1)).toBe("--resume");
 await expect(readdir(join(f.root,"local/workspaces"))).rejects.toMatchObject({code:"ENOENT"});
 await expect(confirmIntakeRequest(f.root,requestId,preferences)).rejects.toThrow("intake_preview_required");
 await expect(workIntakeRequest(f.root,requestId,0,randomUUID(),"claim")).rejects.toThrow("wrong_chat_thread");
 expect(await workIntakeRequest(f.root,requestId,0,f.chat.threadId,"claim")).toMatchObject({sourceValue:source.value,state:"running"});
 await expect(workIntakeRequest(f.root,requestId,0,f.chat.threadId,"claim")).rejects.toThrow("already_handled");
 await workIntakeRequest(f.root,requestId,0,f.chat.threadId,"preview",preview);
 const publicState=await readIntakeRequest(f.root,requestId);expect(publicState).toMatchObject({state:"preview_ready",preview:{candidate:{identity:candidate.identity}}});expect(JSON.stringify(publicState)).not.toContain(f.chat.threadId);expect(JSON.stringify(publicState)).not.toContain("sourceValue");
 await expect(confirmIntakeRequest(f.root,requestId,{...preferences,confirmed:false})).rejects.toThrow();
 const workspace=await confirmIntakeRequest(f.root,requestId,preferences);expect(await confirmIntakeRequest(f.root,requestId,{revision:0,confirmed:true})).toBe(workspace);
 expect(JSON.parse(await readFile(join(workspace,"data/candidate.json"),"utf8"))).toMatchObject({identity:candidate.identity,_meta:{websiteIntake:{requestId,kind:"text"}}});expect(JSON.parse(await readFile(join(workspace,"data/resumes.json"),"utf8"))).toEqual([]);
});

test("PDF upload is stored privately with a fixed filename and never silently becomes an approved resume",async()=>{const f=await setup(),requestId=randomUUID();await beginIntakeRequest(f.root,f.chat,{requestId,kind:"pdf",filename:"../../example.pdf",base64:Buffer.from("%PDF-1.4\nfictional fixture\n%%EOF").toString("base64")},f.run);expect(await readFile(join(intakeDirectory(f.root,requestId),"source.pdf"),"utf8")).toContain("%PDF");const claimed=await workIntakeRequest(f.root,requestId,0,f.chat.threadId,"claim");expect(claimed).toMatchObject({sourcePath:join(intakeDirectory(f.root,requestId),"source.pdf")});await expect(beginIntakeRequest(f.root,f.chat,{requestId:randomUUID(),kind:"pdf",filename:"example.pdf",base64:Buffer.from("not a pdf").toString("base64")},f.run)).rejects.toThrow("invalid_pdf");await expect(beginIntakeRequest(f.root,undefined,{requestId:randomUUID(),kind:"text",value:"Fictional text with no connected reader."},f.run)).rejects.toThrow("runner_unavailable")});

test("blocked LinkedIn imports cannot publish invented facts; corrections invalidate earlier previews and claims",async()=>{const f=await setup(),requestId=randomUUID(),sourceUrl="https://www.linkedin.com/in/fictional-casey/";await beginIntakeRequest(f.root,f.chat,{requestId,kind:"linkedin",value:sourceUrl},f.run);await workIntakeRequest(f.root,requestId,0,f.chat.threadId,"claim");await expect(workIntakeRequest(f.root,requestId,0,f.chat.threadId,"preview",{...preview,observation:{sourceUrl,observedUrl:"https://www.linkedin.com/authwall",observedAt:new Date().toISOString(),access:"login_required",sections:{}}})).rejects.toThrow("linkedin_source_not_verified");await workIntakeRequest(f.root,requestId,0,f.chat.threadId,"block","LinkedIn requires login. Paste your profile text or upload a PDF instead.");expect(await readIntakeRequest(f.root,requestId)).toMatchObject({state:"blocked",preview:null});await reviseIntakeRequest(f.root,f.chat,requestId,{revision:0,correction:"My background: Fictional Casey at Example University; research prototypes."},f.run);await expect(workIntakeRequest(f.root,requestId,0,f.chat.threadId,"preview",preview)).rejects.toThrow("intake_request_changed");expect(await workIntakeRequest(f.root,requestId,1,f.chat.threadId,"claim")).toMatchObject({corrections:[expect.stringContaining("Fictional Casey")]});await expect(beginIntakeRequest(f.root,f.chat,{requestId:randomUUID(),kind:"linkedin",value:"https://linkedin.com.evil.example/in/someone/"},f.run)).rejects.toThrow("linkedin_profile_url_required")});

test("source routes reject foreign origin, unsupported content types and oversized bodies without dispatch",async()=>{const f=await setup();const server=await startWorkbench(f.root,{temporaryRoots:[]});servers.push(server);const base=new URL(server.address).origin;expect(await(await fetch(base+"/new")).text()).toContain("Paste text");expect((await post(base+"/api/intake",{requestId:randomUUID(),kind:"text",value:"Fictional background for a new candidate."},"https://attacker.invalid")).status).toBe(403);expect((await fetch(base+"/api/intake",{method:"POST",headers:{origin:base,"content-type":"text/plain"},body:"hello"})).status).toBe(415);expect((await post(base+"/api/intake",{requestId:randomUUID(),kind:"text",value:"Fictional background for a new candidate."})).status).toBe(503);expect((await fetch(base+"/api/intake/00000000-0000-4000-8000-000000000000")).status).toBe(404)});

test("LinkedIn previews must match observed facts and retain source confirmation provenance",async()=>{
 const f=await setup(),requestId=randomUUID(),sourceUrl="https://www.linkedin.com/in/fictional-casey/";
 await beginIntakeRequest(f.root,f.chat,{requestId,kind:"linkedin",value:sourceUrl},f.run);await workIntakeRequest(f.root,requestId,0,f.chat.threadId,"claim");
 const observation={sourceUrl,observedUrl:sourceUrl,observedAt:new Date().toISOString(),access:"visible",sections:{fullName:{value:candidate.identity.fullName,evidence:"Fictional header"},headline:{value:candidate.summary,evidence:"Fictional headline"},skills:candidate.skills.map(value=>({value,evidence:"Fictional skills"})),education:candidate.education.map(value=>({value,evidence:"Fictional education"}))}};
 const linkedCandidate={...candidate,links:{linkedin:sourceUrl}};
 await expect(workIntakeRequest(f.root,requestId,0,f.chat.threadId,"preview",{...preview,candidate:{...linkedCandidate,summary:"Invented unsupported headline"},observation})).rejects.toThrow("linkedin_facts_not_observed");
 await workIntakeRequest(f.root,requestId,0,f.chat.threadId,"preview",{...preview,candidate:linkedCandidate,observation});
 const root=await confirmIntakeRequest(f.root,requestId,preferences);
 expect(JSON.parse(await readFile(join(root,"data/candidate.json"),"utf8"))).toMatchObject({_meta:{linkedinImport:{sourceUrl,state:"confirmed"}}});
});
