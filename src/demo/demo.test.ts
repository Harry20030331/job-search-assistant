import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';
import { startDemo } from './demo.js';
import { readReviewBatch } from '../review/reviewStore.js';
import { readOpportunities } from '../storage/opportunities.js';

test('fictional form preserves review gates, rejects drift, records one result and prunes only after success', async () => {
 const parent=await mkdtemp(join(tmpdir(),'course-demo-')),root=join(parent,'runtime');
 const demo=await startDemo(root);
 const review=new URL(demo.reviewUrl).origin,form=new URL(demo.formUrl).origin;
 const post=(origin:string,path:string,body:object)=>fetch(origin+path,{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)});
 try {
  const pdf=await readFile(join(dirname(fileURLToPath(import.meta.url)),'../../examples/alex-morgan-resume.pdf'));
  const values={name:'Alex Morgan',email:'alex.morgan@example.com',summary:'I built Study Search with source citations and regression checks.',relocation:'',resumeName:'alex-morgan-resume.pdf',resumeBase64:pdf.toString('base64')};
  expect((await post(form,'/submit',values)).status).toBe(409);
  expect((await post(form,'/prepare',{...values,email:'other@example.com'})).status).toBe(409);
  expect((await post(form,'/prepare',values)).status).toBe(200);
  const drafts=join(root,'data/drafts');
  const item=(await readReviewBatch(drafts)).applications[0]!;
  const identity={applicationId:item.applicationId,snapshotId:item.snapshotId};
  await post(review,'/api/review/open',identity); await post(review,'/api/review/viewed',identity);
  expect((await post(review,'/api/review/decision',{...identity,decision:'approved'})).status).toBe(422);
  expect((await post(review,'/api/review/answer',{...identity,questionId:'relocation',optionId:'yes'})).status).toBe(200);
  expect((await post(review,'/api/review/decision',{...identity,decision:'approved',expectedDesiredRevision:1})).status).toBe(200);
  expect((await post(form,'/submit',{...values,relocation:'no'})).status).toBe(409);
  expect((await post(form,'/submit',{...values,relocation:'yes',summary:'Changed after approval'})).status).toBe(409);
  expect((await readOpportunities(join(root,'data/opportunities.json'))).opportunities[0]!.stage).toBe('in_review');
  expect((await post(form,'/submit',{...values,relocation:'yes'})).status).toBe(200);
  expect((await readOpportunities(join(root,'data/opportunities.json'))).opportunities[0]!.stage).toBe('submitted');
  expect((await readReviewBatch(drafts)).applications).toEqual([]);
  expect(JSON.parse(await readFile(join(root,'data/demo-receipt.json'),'utf8')).fictional).toBe(true);
  expect((await post(form,'/submit',{...values,relocation:'yes'})).status).toBe(409);
  expect((await fetch(demo.statusUrl)).status).toBe(200);
 } finally {await demo.close();await rm(parent,{recursive:true,force:true});}
});
