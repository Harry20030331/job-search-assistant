import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { afterEach, expect, test } from "vitest";
import { ApplicationTaskService, demoTaskExecutor, type TaskPaths } from "../review/applicationTasks.js";
import { saveOpportunities } from "../storage/opportunities.js";
import { upsertJob } from "../jobs/jobLibrary.js";
import { approveReviewContent, readReviewBatch, reopenReviewContent, saveQuestionText } from "../review/reviewStore.js";
import { startReviewServer } from "../review/reviewServer.js";
import { linkDemoInterview, readInterviewBoard } from "./workbench.js";

const roots:string[]=[], services:ApplicationTaskService[]=[], servers:Array<{close():Promise<void>}>=[];
afterEach(async()=>{for(const server of servers.splice(0))await server.close();for(const service of services.splice(0))await service.close();for(const root of roots.splice(0))await rm(root,{recursive:true,force:true})});
async function fixture(fictional=true) {
 const root=await mkdtemp(join(tmpdir(),"demo-interview-"));roots.push(root);
 const profilePath=join(root,"candidate.json"),paths:TaskPaths={trackerPath:join(root,"opportunities.json"),jobsPath:join(root,"opportunities.json"),reviewPath:join(root,"drafts"),taskPath:join(root,"application-tasks.json")};
 await writeFile(profilePath,JSON.stringify({schemaVersion:2,fictional,identity:{fullName:"Fictional Recording Candidate"},contact:{email:"recording@fictional.invalid"}}));await mkdir(paths.reviewPath);
 await saveOpportunities(paths.trackerPath,{schemaVersion:1,opportunities:[]});
 for(let index=0;index<2;index++)await upsertJob(paths.jobsPath,{jobId:"job-"+index,company:"Fictional Employer "+index,title:"Graduate Engineer",location:"Remote",category:"llm",officialUrl:"https://example.invalid/jobs/"+index,sources:["user-provided"],firstSeen:"2026-11-01",lastVerified:"2026-11-01",note:"Authored fictional recording fixture",status:"ready"});
 const service=new ApplicationTaskService(paths,"demo",demoTaskExecutor);services.push(service);await service.start();
 const boardPaths={...paths,profilePath};
 const serve=async(mode:"demo"|"codex"="demo")=>{
  let selected=service;
  if(mode==="codex"){await service.close();selected=new ApplicationTaskService(paths,"codex",async()=>{throw Error("No live executor is used by this test")});services.push(selected);await selected.start()}
  const server=await startReviewServer({...paths,profilePath,tasks:selected,port:0});servers.push(server);return server;
 };
 const ready=async()=>{
  await service.enqueue({action:"prepare",mode:"demo",requestId:randomUUID(),jobIds:["job-0"]});await service.idle();
  let draft=(await readReviewBatch(paths.reviewPath)).applications[0]!;
  draft=await saveQuestionText(paths.reviewPath,draft.applicationId,draft.snapshotId,"demo-motivation","Fictional recording answer.",0);
  draft=await saveQuestionText(paths.reviewPath,draft.applicationId,draft.snapshotId,"demo-start","July 2027",1);
  await approveReviewContent(paths.reviewPath,draft.applicationId,draft.snapshotId,2);
  return {applicationId:draft.applicationId,snapshotId:draft.snapshotId,revision:2};
 };
 const submitted=async()=>{const selection=await ready();const tasks=await service.enqueue({action:"submit",mode:"demo",requestId:randomUUID(),selections:[selection]});await service.idle();return {jobId:"job-0",...selection,taskId:tasks[0]!.id}};
 return {root,paths,profilePath,boardPaths,service,serve,ready,submitted};
}
const post=(address:string,body:unknown,origin=address)=>fetch(address+"/api/demo/interviews",{method:"POST",headers:{origin,"content-type":"application/json"},body:JSON.stringify(body)});

test("the orange recording action appears only after a completed local submission and creates a linked synthetic interview",async()=>{
 const f=await fixture(),server=await f.serve();
 expect(await(await fetch(server.address+"/status/us")).text()).not.toContain('data-demo-interview="');
 const target=await f.submitted(),before=await readFile(f.paths.trackerPath,"utf8");
 const submitted=await(await fetch(server.address+"/status/us?stage=submitted")).text();expect(submitted).toContain('data-demo-interview="');expect(submitted).toContain('>Simulate interview</button>');
 const response=await post(server.address,target);expect(response.status).toBe(200);const result=await response.json();
 expect(await readFile(f.paths.trackerPath,"utf8")).toBe(before); // No submission evidence or real lifecycle is fabricated.
 const board=await readInterviewBoard(f.boardPaths);expect(board).toHaveLength(1);expect(board[0]).toMatchObject({applicationStage:"interviewing",entry:{interviewId:result.interviewId,jobId:target.jobId,applicationId:target.applicationId,state:"invited",schedule:null,association:{source:"synthetic_test_script"},demoSubmission:{taskId:target.taskId}}});
 const status=await(await fetch(server.address+"/status/us?stage=interviewing")).text();expect(status).toContain('data-job="job-0" data-status="interviewing"');expect(status).not.toContain('data-demo-interview="');expect(status).toContain('>Interview prep ');
 const interviews=await(await fetch(server.address+"/interviews?interview="+result.interviewId+"&view=preparation")).text();expect(interviews).toContain("Fictional Employer 0");expect(interviews).toContain("Fictional preview");expect(interviews).toContain("No plan yet");
 const restart=await f.serve();expect(await(await fetch(restart.address+"/status/us")).text()).toContain('data-job="job-0" data-status="interviewing"');
});
test("repeated and concurrent recording clicks reuse one stable interview without replacing preparation pointers",async()=>{
 const f=await fixture(),target=await f.submitted();
 const results=await Promise.all([linkDemoInterview(f.boardPaths,target),linkDemoInterview(f.boardPaths,target),linkDemoInterview(f.boardPaths,target)]);
 expect(new Set(results.map(result=>result.interviewId)).size).toBe(1);const board=await readInterviewBoard(f.boardPaths);expect(board).toHaveLength(1);expect(board[0]?.entry.revision).toBe(1);
});
test("live mode rejects the simulation endpoint even when old completed demo tasks are present",async()=>{
 const f=await fixture(),target=await f.submitted(),server=await f.serve("codex");
 expect((await post(server.address,target)).status).toBe(403);expect(await(await fetch(server.address+"/status/us")).text()).not.toContain('data-demo-interview="');expect(await readInterviewBoard(f.boardPaths)).toEqual([]);
});
test("a non-fictional candidate cannot acquire a simulated interview",async()=>{
 const f=await fixture(false),target=await f.submitted(),server=await f.serve();
 expect((await post(server.address,target)).status).toBe(403);expect(await(await fetch(server.address+"/status/us")).text()).not.toContain('data-demo-interview="');expect(await readInterviewBoard(f.boardPaths)).toEqual([]);
});
test("wrong origin, strict fields and stale snapshot fail without changing the application",async()=>{
 const f=await fixture(),target=await f.submitted(),server=await f.serve(),before=await readFile(f.paths.trackerPath,"utf8");
 expect((await post(server.address,target,"https://attacker.invalid")).status).toBe(403);
 expect((await post(server.address,{...target,extra:"untrusted"})).status).toBe(400);
 expect((await post(server.address,{...target,applicationId:"another-application"})).status).toBe(409);
 await reopenReviewContent(f.paths.reviewPath,target.applicationId,target.snapshotId);
 expect((await post(server.address,target)).status).toBe(409);expect(await readFile(f.paths.trackerPath,"utf8")).toBe(before);expect(await readInterviewBoard(f.boardPaths)).toEqual([]);
});
test("reopening approved content invalidates the old demo round and removes the derived Interviewing stage",async()=>{
 const f=await fixture(),target=await f.submitted(),server=await f.serve();await linkDemoInterview(f.boardPaths,target);
 await reopenReviewContent(f.paths.reviewPath,target.applicationId,target.snapshotId);
 expect(await readInterviewBoard(f.boardPaths)).toEqual([]);const status=await(await fetch(server.address+"/status/us")).text();expect(status).toContain('data-job="job-0" data-status="in_review"');expect(status).not.toContain('data-demo-interview="');
});
test("a preparation task or unfinished submission cannot stand in for completed submission rehearsal",async()=>{
 const f=await fixture(),selection=await f.ready(),server=await f.serve();
 const prepare=(await f.service.list())[0]!;expect((await post(server.address,{jobId:"job-0",...selection,taskId:prepare.id})).status).toBe(409);expect(await readInterviewBoard(f.boardPaths)).toEqual([]);
});
