import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, expect, test } from "vitest";
import { createMatchingWorkspace, workspaceMatchingPaths } from "../matching/intake.js";
import { matchingContext, publishMatchingRound } from "../matching/matching.js";
import { upsertJob, readJobLibrary } from "../jobs/jobLibrary.js";
import { readOpportunities } from "../storage/opportunities.js";
import { ApplicationTaskService, claimChatTask, demoTaskExecutor } from "./applicationTasks.js";
import { startReviewServer } from "./reviewServer.js";
import { buildStatusView } from "./statusView.js";
import { readApplicationTracker } from "../tracker.js";

const roots: string[] = [], services: ApplicationTaskService[] = [], servers: Array<{close():Promise<void>}> = [];
afterEach(async()=>{for(const server of servers.splice(0))await server.close();for(const service of services.splice(0))await service.close();for(const root of roots.splice(0))await rm(root,{recursive:true,force:true})});
async function fixture(mode:"codex"|"demo"="codex") {
 const base=await mkdtemp(join(tmpdir(),"resume-routing-"));roots.push(base);const root=join(base,"candidate");
 await createMatchingWorkspace(root,{confirmed:true,reference:"Fictional routing test",candidate:{schemaVersion:2,fictional:true,identity:{fullName:"Fictional Resume Tester"},summary:"Research and engineering course projects",skills:["Research","Python"],education:[{institution:"Example School",degree:"BS"}]},preferences:"Fictional graduate roles",rules:{categories:["Engineering"],locations:[],workModes:["remote","hybrid","onsite"],excludedCompanies:[],excludedJobIds:[],limit:10,perCompany:2}});
 const paths=workspaceMatchingPaths(root),manifest=[];
 for(const category of ["engineering","product"]) {
  const bytes=Buffer.from("%PDF-1.4\nAuthored fictional fixture "+category+"\n%%EOF");const sha256=createHash("sha256").update(bytes).digest("hex");
  await writeFile(join(root,"data/profile",category+".pdf"),bytes);manifest.push({category,path:category+".pdf",sha256});
 }
 await writeFile(paths.profile,JSON.stringify({ ...JSON.parse(await readFile(paths.profile,"utf8")), resumes: manifest }));const context=await matchingContext(paths);
 for(let i=0;i<2;i++)await upsertJob(paths.opportunities,{jobId:"role-"+i,company:"Example "+i,title:"Graduate Engineer",location:"Remote",category:"Engineering",officialUrl:"https://example.com/roles/"+i,sources:["user-provided"],firstSeen:"2026-11-01",lastVerified:"2026-11-01",note:"Fictional fixture",status:"ready",resumeRecommendation:{profileKey:manifest[i]!.category,sha256:manifest[i]!.sha256,status:"matched",confidence:.9,contextToken:context.token,evaluatedAt:"2026-11-01T18:00:00Z"}});
 const threadId=randomUUID(),taskPaths={reviewPath:join(root,"data/opportunities"),trackerPath:paths.opportunities,jobsPath:paths.opportunities,taskPath:join(root,"data/runtime/application-tasks.json"),matchingPaths:paths};
 const service=new ApplicationTaskService(taskPaths,mode,demoTaskExecutor,mode==="codex"?{threadId,send:async()=>"fictional-message"}:undefined);services.push(service);await service.start();
 const command={action:"prepare",mode,requestId:randomUUID(),jobIds:["role-0","role-1"]};
 return {root,paths,manifest,context,threadId,taskPaths,service,command};
}
test("one Apply batch pins each job's own Jev-selected resume and is idempotent without a batch selector",async()=>{
 const f=await fixture(),tasks=await f.service.enqueue(f.command);
 expect(tasks.map(task=>[task.target.jobId,task.target.resumeCategory,task.target.resumeSha256])).toEqual([
  ["role-0","engineering",f.manifest[0]!.sha256],["role-1","product",f.manifest[1]!.sha256]
 ]);
 expect((await f.service.enqueue(f.command)).map(task=>task.id)).toEqual(tasks.map(task=>task.id));
 expect(tasks.every(task=>task.state==="queued")).toBe(true);
});
test.each(["stale-context","changed-pdf","no-match","missing-match","conflicting-selection"])("%s rejects the entire Apply batch",async(kind)=>{
 const f=await fixture();
 if(kind==="stale-context")await writeFile(f.paths.preferences,await readFile(f.paths.preferences,"utf8")+"\nChanged fictional preference.\n");
 if(kind==="changed-pdf")await writeFile(join(f.root,"data/profile/product.pdf"),"%PDF-1.4 changed attachment");
 if(kind==="no-match"||kind==="missing-match") {
  const job=(await readJobLibrary(f.paths.opportunities))[1]!;
  await upsertJob(f.paths.opportunities,{...job,status:"ready",resumeRecommendation:kind==="missing-match"?undefined:{...job.resumeRecommendation!,profileKey:null,sha256:null,status:"no_match"}});
 }
 const command=kind==="conflicting-selection"?{...f.command,resumeCategory:"engineering"}:f.command;
 await expect(f.service.enqueue(command)).rejects.toThrow();expect(await f.service.list()).toEqual([]);
});
test("queued tasks recheck the pinned PDF before an existing chat can claim them",async()=>{
 const f=await fixture(),tasks=await f.service.enqueue(f.command);await writeFile(join(f.root,"data/profile/engineering.pdf"),"%PDF-1.4 altered after queueing");
 await expect(claimChatTask(f.taskPaths,tasks[0]!.id,f.threadId)).rejects.toThrow("approved_cv_hash_mismatch");
 expect((await f.service.list())[0]?.state).toBe("blocked");expect((await f.service.list())[1]?.state).toBe("queued");
});
test("the website displays matched resume tags and accepts a mixed-resume Apply request without a global key",async()=>{
 const f=await fixture();const server=await startReviewServer({...f.taskPaths,tasks:f.service,workspaceRoot:f.root,port:0});servers.push(server);
 const html=await(await fetch(server.address+"/status")).text();expect(html).toContain('<th scope="col">Resume</th>');expect(html).toContain('title="Matched by Jev">engineering</span>');expect(html).toContain('title="Matched by Jev">product</span>');expect(html).not.toContain('id="application-resume"');
 const response=await fetch(server.address+"/api/tasks",{method:"POST",headers:{origin:server.address,"content-type":"application/json"},body:JSON.stringify(f.command)});
 expect(response.status).toBe(202);expect((await response.json()).tasks.map((task:any)=>task.target.resumeCategory)).toEqual(["engineering","product"]);
});
test("a started application keeps its original bound PDF and is protected from later Matching routing changes",async()=>{
 const f=await fixture("demo");await f.service.enqueue({...f.command,jobIds:["role-0"]});await f.service.idle();
 const bound=(await readOpportunities(f.paths.opportunities)).opportunities.find(job=>job.jobId==="role-0")!;
 expect(bound.application?.resumeCategory).toBe("engineering");
 const newSuggestion={...bound.resumeRecommendation!,profileKey:"product",sha256:f.manifest[1]!.sha256};
 const result=await publishMatchingRound(f.paths,{version:1,contextToken:f.context.token,assessments:[{jobId:bound.jobId,company:bound.company,title:bound.title,location:bound.location,category:bound.category,officialUrl:bound.officialUrl,sources:bound.sources,firstSeen:bound.firstSeen,lastVerified:bound.lastVerified,workMode:"remote",eligibleLocations:[],decision:"recommend",match:["Fictional fit"],gaps:[],questions:[],candidateEvidence:["Fictional project"],jobEvidence:["Fictional JD"],resumeRecommendation:newSuggestion}]});
 expect(result.protectedIds).toEqual(["role-0"]);
 const document=await readOpportunities(f.paths.opportunities);expect(document.opportunities.find(job=>job.jobId==="role-0")!.application?.resumeCategory).toBe("engineering");
 const status=buildStatusView((await readApplicationTracker(f.paths.opportunities)).applications,await readJobLibrary(f.paths.opportunities));expect(status.find(job=>job.jobId==="role-0")?.resumeProfile).toBe("engineering");
});

test("a changed approved PDF produces an actionable website conflict instead of a generic server error",async()=>{
 const f=await fixture(),server=await startReviewServer({...f.taskPaths,tasks:f.service,workspaceRoot:f.root,port:0});servers.push(server);
 await writeFile(join(f.root,"data/profile/product.pdf"),"%PDF-1.4 changed fictional attachment");
 const response=await fetch(server.address+"/api/tasks",{method:"POST",headers:{origin:server.address,"content-type":"application/json"},body:JSON.stringify(f.command)});
 expect(response.status).toBe(409);expect(await response.json()).toMatchObject({error:"matching_resume_changed"});expect(await f.service.list()).toEqual([]);
});
