import { describe, expect, test } from "vitest";
import { loadCandidateProfile } from "./profile.js";

function fixture() {
  const facts = {schemaVersion:1,identity:{fullName:"Test Person"},contact:{email:"test@example.com"},education:[],languages:[],school:{},links:{},highSchool:{},_meta:{sections:{},conflicts:[{field:"graduation",status:"unresolved"}]}};
  const evidence = {schemaVersion:1,experiences:[],skills:["Python"],projects:[],publications:[],_meta:{sections:{}} as Record<string,unknown>};
  const config = {schemaVersion:3,shared:{profile:"facts.json",experience:"evidence.json"},job:{availability:{earliestStartDate:"2027-07-01"}} as Record<string,unknown>};
  const read = async (path:string) => {
    if(path==="/data/config.json") return JSON.stringify(config);
    if(path==="/data/facts.json") return JSON.stringify(facts);
    if(path==="/data/evidence.json") return JSON.stringify(evidence);
    throw Error("missing");
  };
  return {facts,evidence,config,read};
}
describe("shared candidate profile",()=>{
  test("reads updates from the source and carries conflicts without writing a cache",async()=>{
    const f=fixture();
    const first=await loadCandidateProfile("/data/config.json",f.read);
    expect(first).toMatchObject({identity:{fullName:"Test Person"},skills:["Python"],availability:{earliestStartDate:"2027-07-01"},_meta:{conflicts:[{field:"graduation",status:"unresolved"}]}});
    f.facts.identity.fullName="Updated Person";
    expect(await loadCandidateProfile("/data/config.json",f.read)).toMatchObject({identity:{fullName:"Updated Person"}});
  });
  test("rejects a job-specific duplicate of shared facts",async()=>{
    const f=fixture();f.config.job.identity={fullName:"Stale Copy"};
    await expect(loadCandidateProfile("/data/config.json",f.read)).rejects.toThrow("job_profile_overrides_shared_facts");
  });
  test("preserves approved category evidence provenance in the JSON rendered by the profile CLI",async()=>{
    const f=fixture();
    f.evidence._meta.currentExperienceView={category:"llm",approvedPdf:"/approved/llm.pdf",sha256:"approved-hash",approvedAt:"2026-09-13",source:"/sources/llm.tex"};
    f.evidence._meta.categoryEvidenceNotes=["Use the matching approved category variant without merging metric scopes."];
    f.config.job._meta={currentExperienceView:{category:"stale"},categoryEvidenceNotes:["stale"]};
    const rendered=JSON.parse(JSON.stringify(await loadCandidateProfile("/data/config.json",f.read)));
    expect(rendered._meta.currentExperienceView).toEqual(f.evidence._meta.currentExperienceView);
    expect(rendered._meta.categoryEvidenceNotes).toEqual(f.evidence._meta.categoryEvidenceNotes);
    expect(rendered.identity).toEqual(f.facts.identity);
    expect(rendered._meta.conflicts).toEqual(f.facts._meta.conflicts);
  });
  test("fails when a shared source disappears instead of using stale values",async()=>{
    const f=fixture();f.config.shared.profile="missing.json";
    await expect(loadCandidateProfile("/data/config.json",f.read)).rejects.toThrow("missing");
  });
  test("rejects unsupported descriptor versions",async()=>{
    await expect(loadCandidateProfile("/data/config.json",async()=>'{"schemaVersion":99}')).rejects.toThrow();
  });
});
