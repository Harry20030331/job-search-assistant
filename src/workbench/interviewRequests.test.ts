import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { Script } from "node:vm";
import { afterEach, expect, test } from "vitest";
import { createMatchingWorkspace } from "../matching/intake.js";
import { requestInterviewWork, updateInterviewRequest, interviewRequestHistory, withInterviewRequests } from "./interviewRequests.js";
const roots:string[]=[];afterEach(async()=>{for(const r of roots.splice(0))await rm(r,{recursive:true,force:true})});
async function setup(){const base=await mkdtemp(join(tmpdir(),"web-interview-"));roots.push(base);const root=join(base,"candidate"),threadId=randomUUID(),messageId=randomUUID(),argsPath=join(base,"args.json"),exe=join(base,"fake-codex.cjs");
 await createMatchingWorkspace(root,{confirmed:true,reference:"Fictional interview website test",candidate:{schemaVersion:2,identity:{fullName:"Fictional Candidate"},summary:"Research tools",skills:["Research"],education:[{institution:"Example School"}]},preferences:"New Grad",rules:{categories:["Research"],locations:[],workModes:["remote"],excludedCompanies:[],excludedJobIds:[],limit:3,perCompany:1}},join(base,"registry.json"));
 await writeFile(exe,`#!${process.execPath}\nconst fs=require('node:fs');if(fs.existsSync(${JSON.stringify(argsPath)}))throw Error('duplicate delivery');fs.writeFileSync(${JSON.stringify(argsPath)},JSON.stringify(process.argv.slice(2)));console.log(${JSON.stringify(`Queued message ${messageId} for thread ${threadId}.`)});\n`,{mode:0o700});await writeFile(join(root,"data/chat-runner.json"),JSON.stringify({version:1,threadId,executable:exe}),{mode:0o600});return {root,base,threadId,argsPath}}
test("website interview requests retain the user message and return questions without granting calendar authority",async()=>{
 const f=await setup(),message="Fictional invitation. Can we schedule next Tuesday?",request={requestId:randomUUID(),action:"scheduling",applicationId:"",interviewId:"",message};
 const result=await requestInterviewWork(f.root,f.base,request);expect(result[0]).toMatchObject({message,state:"delivered"});expect(await requestInterviewWork(f.root,f.base,request)).toEqual(result);
 const args=JSON.parse(await readFile(f.argsPath,"utf8"));expect(args[4]).toContain("not confirmation of a calendar write");expect(args[4]).toContain("wait for the user's explicit confirmation");expect(args[5]).toBe("--resume");
 await expect(requestInterviewWork(f.root,f.base,{...request,requestId:randomUUID()})).rejects.toThrow("task_already_active");
 await expect(updateInterviewRequest(f.root,request.requestId,"claim",randomUUID())).rejects.toThrow("wrong_chat_thread");
 expect(await updateInterviewRequest(f.root,request.requestId,"claim",f.threadId)).toMatchObject({message,state:"running"});
 await expect(updateInterviewRequest(f.root,request.requestId,"claim",f.threadId)).rejects.toThrow("already_handled");
 const reply="Please confirm the date, timezone and duration. No calendar write has been performed.";
 await updateInterviewRequest(f.root,request.requestId,"finish",f.threadId,"blocked",reply);
 expect(await interviewRequestHistory(f.root)).toEqual([expect.objectContaining({message,reply,state:"blocked"})]);expect(JSON.stringify(await interviewRequestHistory(f.root))).not.toContain(f.threadId);
});
test("unrecognized application and interview targets cannot be queued",async()=>{const f=await setup();await expect(requestInterviewWork(f.root,f.base,{requestId:randomUUID(),action:"debrief",applicationId:"missing",interviewId:"",message:"Fictional notes"})).rejects.toThrow("invalid_request")});
test("interview request panels use valid scripts, text-only replies and escaped stable targets",()=>{const html=withInterviewRequests('<html><head></head><body><main></main></body></html>',[], '\"><script>bad()</script>');expect(html).toContain("Details / reply");expect(html).not.toContain('<script>bad()</script>');expect(html).toContain("reply.textContent=e.reply");for(const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g))expect(()=>new Script(match[1]!)).not.toThrow()});

test("fictional interview delivery keeps demo provenance and excludes live account actions",async()=>{
 const f=await setup();
 const entries=await requestInterviewWork(f.root,f.base,{requestId:randomUUID(),action:"invitation",applicationId:"",interviewId:"",message:"Stage a fictional invitation after the local rehearsal."},"demo");
 expect(entries[0]).toMatchObject({mode:"demo",state:"delivered"});
 const args=JSON.parse(await readFile(f.argsPath,"utf8"));
 expect(args[4]).toContain("Do not access real Gmail, Google Calendar or employer forms");
 expect(args[4]).toContain("only after its local demo submissions are complete");
 expect(args[4]).toContain("Reuse an existing demo checkpoint");
 expect(args[4]).toContain("current plan acceptance");
});
