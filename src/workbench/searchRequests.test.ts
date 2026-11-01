import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { afterEach, expect, test } from "vitest";
import { createMatchingWorkspace } from "../matching/intake.js";
import { readProfileEditor } from "./profileStore.js";
import { requestWebsiteSearch, updateSearchRequest, latestSearchStatus } from "./searchRequests.js";
const roots:string[]=[];afterEach(async()=>{for(const r of roots.splice(0))await rm(r,{recursive:true,force:true})});
async function setup(){const base=await mkdtemp(join(tmpdir(),"ng-web-"));roots.push(base);const root=join(base,"candidate"),threadId=randomUUID(),messageId=randomUUID(),argsPath=join(base,"args.json"),exe=join(base,"fake-codex.cjs");
 await createMatchingWorkspace(root,{confirmed:true,reference:"Fictional source-scope test",candidate:{schemaVersion:2,identity:{fullName:"Fictional Candidate"},summary:"Product research",skills:["Research"],education:[{institution:"Example School"}]},preferences:"PM New Grad only",rules:{categories:["Product Management"],locations:[],workModes:["remote"],excludedCompanies:[],excludedJobIds:[],limit:3,perCompany:1}},join(base,"registry.json"));
 await writeFile(exe,`#!${process.execPath}\nconst fs=require('node:fs');if(fs.existsSync(${JSON.stringify(argsPath)}))throw Error('duplicate delivery');fs.writeFileSync(${JSON.stringify(argsPath)},JSON.stringify(process.argv.slice(2)));console.log(${JSON.stringify(`Queued message ${messageId} for thread ${threadId}.`)});\n`,{mode:0o700});
 await writeFile(join(root,"data/chat-runner.json"),JSON.stringify({version:1,threadId,executable:exe}),{mode:0o600});return {root,base,threadId,argsPath}}
test("New Grad requests bind the sole repository, official verification, current inputs and single delivery",async()=>{
 const f=await setup(),context=await readProfileEditor(f.root),requestId=randomUUID();
 expect(await latestSearchStatus(f.root)).toBeNull();
 const request={requestId,token:context.token};expect(await requestWebsiteSearch(f.root,f.base,request)).toMatchObject({state:"delivered"});
 expect(await requestWebsiteSearch(f.root,f.base,request)).toMatchObject({state:"delivered"});
 const args=JSON.parse(await readFile(f.argsPath,"utf8"));expect(args.slice(0,4)).toEqual(["queue","--thread",f.threadId,"--message"]);
 expect(args[5]).toBe("--resume");expect(args[4]).toContain('"allowOpenWebSearch":false');expect(args[4]).toContain("Product Management anchor for PM");expect(args[4]).toContain("official employer links");expect(args[4]).toContain("search:request -- claim");
 const saved=JSON.parse(await readFile(join(f.root,"data/search-requests",requestId+".json"),"utf8"));expect(saved.scope).toMatchObject({cohort:"new-grad",source:"simplify-new-grad",allowOpenWebSearch:false});
 await expect(updateSearchRequest(f.root,requestId,"claim",randomUUID())).rejects.toThrow("wrong_chat_thread");
 expect(await updateSearchRequest(f.root,requestId,"claim",f.threadId)).toMatchObject({state:"running"});
 await expect(updateSearchRequest(f.root,requestId,"claim",f.threadId)).rejects.toThrow("already_handled");
 expect(await latestSearchStatus(f.root)).toMatchObject({state:"running"});
 await updateSearchRequest(f.root,requestId,"finish",f.threadId,"completed",{completedRound:true,reference:"Fictional repository check: no new roles",inspected:0,observedAt:new Date().toISOString()});expect(await latestSearchStatus(f.root)).toMatchObject({state:"completed"});
});
test("a changed matching context is rejected before any message is delivered",async()=>{const f=await setup();await expect(requestWebsiteSearch(f.root,f.base,{requestId:randomUUID(),token:"stale"})).rejects.toThrow("matching_context_changed")});
