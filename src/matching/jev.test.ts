import { mkdtemp, readFile, rm, writeFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, expect, test, vi } from "vitest";
import { runMatchingCli } from "../cli/matchingCli.js";
import { publishJevMatchingRound } from "./jev.js";
import { matchingContext, saveMatchingPreferences } from "./matching.js";
import { demoAssessments, demoRules } from "./demo.js";
import { saveOpportunities, readOpportunities } from "../storage/opportunities.js";

const roots: string[] = [];
afterEach(async () => { vi.restoreAllMocks(); vi.unstubAllEnvs(); for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }); });
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "jev-test-")); roots.push(root);
  const paths = { profile: join(root,"candidate.json"), preferences: join(root,"preferences.md"), manifest: join(root,"resumes.json"), opportunities: join(root,"opportunities.json") };
  await writeFile(paths.profile, JSON.stringify({ schemaVersion: 2, identity: {fullName:"Fictional Private Name"}, contact:{email:"private@example.com"}, applicationFacts:{privateAnswer:"private-answer-marker"}, summary:"Fictional Python retrieval engineer", skills:["Python"], experiences:[{employer:"Fictional Labs",description:"Wrote retrieval evaluation scripts."}] }));
  await writeFile(paths.preferences,"Fictional New Grad retrieval roles.\n"); await writeFile(paths.manifest,"[]");
  await saveOpportunities(paths.opportunities,{schemaVersion:1,opportunities:[]});
  await saveMatchingPreferences(paths,{expectedToken:(await matchingContext(paths)).token,initialRules:demoRules,feedback:{id:"initial",text:"Fictional search",reference:"Fictional test",at:"2026-11-01T00:00:00Z",patch:{}}});
  const round = {version:2,contextToken:(await matchingContext(paths)).token,assessments:demoAssessments("2026-11-01").map(job=>({...job,jobDescription:"Fictional graduate retrieval engineer. Build Python retrieval evaluation scripts. A BS or MS and practical project experience are required. Production deployment is preferred, not mandatory. Washington remote eligible.",jobDescriptionReference:"Authored fictional test JD"}))};
  return { root,paths,round };
}
function answers(rank=2) { return {
  level:{type:"choice",choice:"eligible",confidence:.9,probabilities:{eligible:.95,ineligible:.02,unknown:.03}},
  requirements:{type:"choice",choice:"satisfied",confidence:.9,probabilities:{satisfied:.95,gap:.02,unknown:.03}},
  direction:{type:"score",score:rank,confidence:.9,probabilities:{"0":0,"1":0,"2":rank===2?1:0,"3":rank===3?1:0}},
  experience:{type:"score",score:rank,confidence:.9,probabilities:{"0":0,"1":0,"2":rank===2?1:0,"3":rank===3?1:0}}
}; }
function response(data=answers()) { return new Response(JSON.stringify({model:"jev-fixture",answers:data,usage:{input_tokens:100,output_tokens:12}}),{status:200}); }
const runtime=(fetcher: typeof fetch)=>({apiKey:"fictional-test-key",model:"jev-fixture",fetch:fetcher});

test("real provider-shaped results determine ranking before existing shortlist limits, without sending identity or application-only facts",async()=>{
  const f=await fixture(); const bodies: any[]=[];
  const fetcher=vi.fn<typeof fetch>(async(url,options)=>{
    expect(url).toBe("https://api.typesafe.ai/v1/systemone");expect(options?.redirect).toBe("error");
    const body=JSON.parse(String(options?.body));bodies.push(body);return response(answers(body.state.job.jobId.endsWith("meadow")?3:2));
  });
  const result=await publishJevMatchingRound(f.paths,f.round,runtime(fetcher));
  expect(result.matchingProvider).toBe("typesafe");expect(result.results[0]?.jobId).toBe("fictional-meadow");
  expect(result.results.filter(r=>r.decision==="recommend")).toHaveLength(2);
  expect(JSON.stringify(bodies)).not.toMatch(/Fictional Private Name|private@example|private-answer-marker|resumes\.json/);
  expect(bodies[0].state.candidate.skills).toEqual(["Python"]);
  expect(Object.keys(bodies[0].questions)).toEqual(["level","requirements","direction","experience"]);
  const receipt=JSON.parse(await readFile(result.evaluationReference,"utf8"));expect(receipt).toMatchObject({status:"evaluated",provider:"typesafe",contextToken:f.round.contextToken});expect(receipt.results[0].model).toBe("jev-fixture");expect(JSON.stringify(receipt)).not.toContain("fictional-test-key");
  expect((await readOpportunities(f.paths.opportunities)).opportunities.every(job=>!job.application)).toBe(true);
});

test.each(["unknown","low-confidence"])("%s results remain unresolved instead of becoming recommendations",async(kind)=>{
  const f=await fixture();f.round.assessments=f.round.assessments.slice(0,1);
  const data=answers();if(kind==="unknown")data.requirements.choice="unknown";else data.direction.confidence=.2;
  const result=await publishJevMatchingRound(f.paths,f.round,runtime(async()=>response(data)));
  expect(result.results[0]?.decision).toBe("needs_confirmation");expect(result.results[0]?.questions.join(" ")).toContain("Jev");
});

test("an explicit Jev qualification conflict rejects a lead, while a prior unknown cannot be cleared by a positive score",async()=>{
  const f=await fixture();f.round.assessments=f.round.assessments.slice(0,2);f.round.assessments[1]!.questions=["Confirm actual start window"];
  const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(response({...answers(),requirements:{type:"choice",choice:"gap",confidence:.9,probabilities:{satisfied:.02,gap:.95,unknown:.03}}})).mockResolvedValueOnce(response());
  const result=await publishJevMatchingRound(f.paths,f.round,runtime(fetcher));
  expect(result.results.find(r=>r.jobId==="fictional-north")?.decision).toBe("reject");expect(result.results.find(r=>r.jobId==="fictional-atlas")?.decision).toBe("needs_confirmation");
});

test.each([401,429,500])("HTTP %s never leaks the upstream body or partially publishes a batch",async(status)=>{
  const f=await fixture();const before=await readFile(f.paths.opportunities,"utf8");
  const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(response()).mockResolvedValueOnce(new Response('private upstream echo and fictional-test-key',{status}));
  await expect(publishJevMatchingRound(f.paths,f.round,runtime(fetcher))).rejects.toThrow(/^matching_jev_/);
  expect(await readFile(f.paths.opportunities,"utf8")).toBe(before);expect(fetcher).toHaveBeenCalledTimes(2);
});

test.each(["malformed","invalid-distribution","timeout"])("%s provider output cannot produce a saved shortlist",async(kind)=>{
  const f=await fixture();const before=await readFile(f.paths.opportunities,"utf8");
  const fetcher:typeof fetch=async()=>{if(kind==="timeout")throw Error("private provider error");if(kind==="malformed")return new Response('{}');const data=answers();data.level.probabilities.eligible=.1;return response(data)};
  await expect(publishJevMatchingRound(f.paths,f.round,runtime(fetcher))).rejects.toThrow(/^matching_jev_/);expect(await readFile(f.paths.opportunities,"utf8")).toBe(before);
});

test("missing configuration, old inputs, stale context and duplicate identity fail before a network call",async()=>{
  const f=await fixture();const fetcher=vi.fn<typeof fetch>();
  await expect(publishJevMatchingRound(f.paths,f.round,{apiKey:"",fetch:fetcher})).rejects.toThrow("matching_jev_key_missing");
  await expect(publishJevMatchingRound(f.paths,{...f.round,version:1},runtime(fetcher))).rejects.toThrow("matching_jev_invalid_input");
  await expect(publishJevMatchingRound(f.paths,{...f.round,contextToken:"stale"},runtime(fetcher))).rejects.toThrow("matching_context_changed");
  await expect(publishJevMatchingRound(f.paths,{...f.round,assessments:[f.round.assessments[0],f.round.assessments[0]]},runtime(fetcher))).rejects.toThrow("duplicate_matching_assessment");
  expect(fetcher).not.toHaveBeenCalled();expect(await readdir(f.root)).not.toContain("matching-evaluations");
});

test("candidate changes during inference block publication even after evaluation finished",async()=>{
  const f=await fixture();const before=await readFile(f.paths.opportunities,"utf8");let changed=false;
  const fetcher:typeof fetch=async()=>{if(!changed){changed=true;await writeFile(f.paths.profile,JSON.stringify({schemaVersion:2,identity:{fullName:"Changed Fictional Candidate"}}))}return response()};
  await expect(publishJevMatchingRound(f.paths,f.round,runtime(fetcher))).rejects.toThrow("matching_context_changed");expect(await readFile(f.paths.opportunities,"utf8")).toBe(before);
});

test("the public publish CLI requires Jev instead of accepting the old Codex-only input",async()=>{
 const f=await fixture(),input=join(f.root,"round.json");
 const args=["publish","--profile",f.paths.profile,"--preferences",f.paths.preferences,"--manifest",f.paths.manifest,"--opportunities",f.paths.opportunities,"--input",input];
 vi.stubEnv("TYPESAFE_API_KEY","fictional-cli-key");vi.stubEnv("TYPESAFE_MODEL","jev-fixture");
 const fetcher=vi.spyOn(globalThis,"fetch").mockImplementation(async()=>response());
 await writeFile(input,JSON.stringify({...f.round,version:1}));
 await expect(runMatchingCli(args)).rejects.toThrow("matching_jev_invalid_input");expect(fetcher).not.toHaveBeenCalled();
 await writeFile(input,JSON.stringify(f.round));
 expect(await runMatchingCli(args)).toMatchObject({matchingProvider:"typesafe"});expect(fetcher).toHaveBeenCalledTimes(3);
});

test("a partial rescreen cannot incur new requests or leave prior managed recommendations stale",async()=>{
 const f=await fixture();await publishJevMatchingRound(f.paths,f.round,runtime(async()=>response()));
 const before=await readFile(f.paths.opportunities,"utf8"),fetcher=vi.fn<typeof fetch>();
 await expect(publishJevMatchingRound(f.paths,{...f.round,assessments:f.round.assessments.slice(0,1)},runtime(fetcher))).rejects.toThrow("matching_round_incomplete");
 expect(fetcher).not.toHaveBeenCalled();expect(await readFile(f.paths.opportunities,"utf8")).toBe(before);
});

test("positive Jev answers cannot override deterministic company exclusions",async()=>{
 const f=await fixture(),context=await matchingContext(f.paths);
 await saveMatchingPreferences(f.paths,{expectedToken:context.token,feedback:{id:"exclude",text:"Exclude North Example",reference:"Fictional explicit feedback",at:"2026-11-01T01:00:00Z",patch:{excludedCompanies:["North Example"]}}});
 const result=await publishJevMatchingRound(f.paths,{...f.round,contextToken:(await matchingContext(f.paths)).token},runtime(async()=>response()));
 expect(result.results.find(r=>r.jobId==="fictional-north")?.decision).toBe("reject");
});

async function addResumeEvidence(f: Awaited<ReturnType<typeof fixture>>) {
  const { createHash } = await import("node:crypto");
  const entries = [];
  for (const [category,text] of [["engineering", "Python retrieval evaluation, backend APIs and integration tests."], ["product", "Product discovery interviews, product experiments and launch planning."]]) {
    const bytes = Buffer.from("%PDF-1.4\nFictional attachment " + category + "\n%%EOF");
    await writeFile(join(f.root, category + ".pdf"), bytes);
    entries.push({ category: category!, path: category + ".pdf", sha256: createHash("sha256").update(bytes).digest("hex"), text: text! });
  }
  await writeFile(f.paths.manifest, JSON.stringify(entries.map(({text: _text,...entry})=>entry)));
  return { ...f.round, contextToken: (await matchingContext(f.paths)).token, resumeEvidence: entries.map(({path:_path,...entry})=>entry) };
}
function resumeResponse(choice="resume:engineering",confidence=.9) {
  return new Response(JSON.stringify({model:"jev-fixture",answers:{...answers(),selectedResume:{type:"choice",choice,confidence,
    probabilities:{"resume:engineering":choice==="resume:engineering"?1:0,"resume:product":choice==="resume:product"?1:0,none:choice==="none"?1:0}}}}));
}
test("Jev chooses between actual resume evidence per job and publishes the exact approved PDF version",async()=>{
  const f=await fixture(),round=await addResumeEvidence(f);round.assessments=round.assessments.slice(0,2);
  const result=await publishJevMatchingRound(f.paths,round,runtime(async(_url,options)=>{
    const body=JSON.parse(String(options?.body));expect(body.state.resumes[0].text).toContain("retrieval evaluation");
    expect(Object.keys(body.questions.selectedResume.criteria)).toEqual(["resume:engineering","resume:product","none"]);
    expect(JSON.stringify(body)).not.toContain(f.root);
    return resumeResponse(body.state.job.jobId==="fictional-north"?"resume:engineering":"resume:product");
  }));
  const jobs=(await readOpportunities(f.paths.opportunities)).opportunities;
  for(const [id,key] of [["fictional-north","engineering"],["fictional-atlas","product"]]) {
    const saved=jobs.find(job=>job.jobId===id)!.resumeRecommendation!;
    expect(saved).toMatchObject({profileKey:key,status:"matched",contextToken:round.contextToken,sha256:round.resumeEvidence.find(resume=>resume.category===key)!.sha256});
    expect(result.results.find(job=>job.jobId===id)?.resumeRecommendation).toEqual(saved);
  }
});
test.each(["none","low-confidence"])("%s resume decisions cannot masquerade as an approved routing match",async(kind)=>{
  const f=await fixture(),round=await addResumeEvidence(f);round.assessments=round.assessments.slice(0,1);
  const result=await publishJevMatchingRound(f.paths,round,runtime(async()=>resumeResponse(kind==="none"?"none":"resume:engineering",kind==="none"?.9:.2)));
  expect(result.results[0]?.resumeRecommendation?.status).toBe(kind==="none"?"no_match":"needs_review");
  expect(result.results[0]?.decision).toBe("recommend"); // A missing attachment does not reject an otherwise matching job.
});
test.each(["missing-evidence","duplicate-evidence","changed-pdf"])("%s blocks before a provider call",async(kind)=>{
  const f=await fixture(),round=await addResumeEvidence(f),fetcher=vi.fn<typeof fetch>();
  if(kind==="missing-evidence")round.resumeEvidence=[];
  if(kind==="duplicate-evidence")round.resumeEvidence[1]=round.resumeEvidence[0]!;
  if(kind==="changed-pdf")await writeFile(join(f.root,"engineering.pdf"),"%PDF-1.4 changed attachment");
  await expect(publishJevMatchingRound(f.paths,round,runtime(fetcher))).rejects.toThrow(/^matching_resume_/);expect(fetcher).not.toHaveBeenCalled();
});
test.each(["missing-choice","unconfigured-choice","wrong-probability-keys"])("%s model resume output cannot publish",async(kind)=>{
  const f=await fixture(),round=await addResumeEvidence(f);round.assessments=round.assessments.slice(0,1);
  const before=await readFile(f.paths.opportunities,"utf8");
  const output=kind==="missing-choice"?response():resumeResponse(kind==="unconfigured-choice"?"resume:invented":"resume:engineering");
  const data=await output.json();if(kind==="wrong-probability-keys")data.answers.selectedResume.probabilities={"resume:engineering":1};
  await expect(publishJevMatchingRound(f.paths,round,runtime(async()=>new Response(JSON.stringify(data))))).rejects.toThrow("matching_jev_invalid_response");
  expect(await readFile(f.paths.opportunities,"utf8")).toBe(before);
});
test("PDF changes during inference invalidate routing before publication",async()=>{
 const f=await fixture(),round=await addResumeEvidence(f);round.assessments=round.assessments.slice(0,1);
 await expect(publishJevMatchingRound(f.paths,round,runtime(async()=>{await writeFile(join(f.root,"engineering.pdf"),"%PDF-1.4 changed while inference ran");return resumeResponse()}))).rejects.toThrow("matching_resume_changed");
 expect((await readOpportunities(f.paths.opportunities)).opportunities).toEqual([]);
});


test("flexible scope reaches Jev explicitly and scores actual work against background without target titles",async()=>{
 const f=await fixture();const before=await matchingContext(f.paths);
 await saveMatchingPreferences(f.paths,{expectedToken:before.token,feedback:{id:"flexible",text:"I am flexible",reference:"Fictional website confirmation",at:"2026-11-01T00:00:00Z",patch:{categories:[],locations:[]}}});
 f.round.contextToken=(await matchingContext(f.paths)).token;f.round.assessments=f.round.assessments.slice(0,1).map(job=>({...job,category:"Product Research"}));
 let body:any;const result=await publishJevMatchingRound(f.paths,f.round,runtime(async(_url,options)=>{body=JSON.parse(String(options?.body));return response()}));
 expect(body.state.currentSearchScope).toMatchObject({jobDirections:{mode:"flexible",values:[]},locations:{mode:"flexible",values:[]}});
 expect(body.questions.direction.instructions).toContain("need not supply job titles");
 expect(body.questions.direction.instructions).toContain("do not restore superseded restrictions");
 expect(result.results[0]?.reasons).not.toContain("Direction excluded by preferences");
 expect(result.results[0]?.resumeRecommendation?.status).toBe("no_resumes");
});
