import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { applyApplicationData } from "./applicationDataCli.js";
import { createReviewBatch } from "../review/reviewStore.js";
import { createApplication } from "../tracker.js";

test("versioned data interface rejects layout fields and unsupported versions", async () => {
  const command = { version: 1, operation: "status.visibility", trackerPath: "unused", applicationId: "id", visible: false };
  await expect(applyApplicationData({ ...command, css: "hide approvals" })).rejects.toThrow();
  await expect(applyApplicationData({ ...command, version: 2 })).rejects.toThrow();
  await expect(applyApplicationData({ ...command, visible: "false" })).rejects.toThrow();
});

test("data command updates only the intended application's visibility", async () => {
  const root = await mkdtemp(join(tmpdir(), "application-data-port-"));
  const trackerPath = join(root, "tracker.json");
  await writeFile(trackerPath, JSON.stringify({ schemaVersion: 3, applications: [] }));
  for (const id of ["first", "second"]) await createApplication(trackerPath, {
    applicationId: id, jobId: id, company: id, title: "Software Engineer", location: "San Francisco",
    ats: "ashby", category: "llm", cvFilename: "approved.pdf",
    jobUrl: `https://example.com/jobs/${id}`, applicationUrl: `https://example.com/apply/${id}`
  });
  const before = JSON.parse(await readFile(trackerPath, "utf8"));
  expect(await applyApplicationData({ version: 1, operation: "status.visibility", trackerPath, applicationId: "first", visible: false })).toEqual({ ok: true, applicationId: "first", visible: false });
  const after = JSON.parse(await readFile(trackerPath, "utf8"));
  expect(after.applications[0]).toEqual({ ...before.applications[0], hiddenFromStatus: true });
  expect(after.applications[1]).toEqual(before.applications[1]);
});


test("review.start is an idempotent structured port and rejects presentation overrides", async () => {
  const root=await mkdtemp(join(tmpdir(),"review-start-port-")),reviewPath=join(root,"review.json");
  await createReviewBatch(reviewPath,{schemaVersion:1,batchId:"empty",createdAt:"2026-10-15T12:00:00Z",applications:[]});
  const command={version:1,operation:"review.start",reviewPath};
  expect(await applyApplicationData(command)).toEqual({ok:true,applicationIds:[]});
  expect(await applyApplicationData(command)).toEqual({ok:true,applicationIds:[]});
  await expect(applyApplicationData({...command,order:["invented"]})).rejects.toThrow();
});
