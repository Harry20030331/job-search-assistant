import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, expect, test } from "vitest";
import { createMatchingWorkspace } from "./matching/intake.js";
import { matchingContext, publishMatchingRound, saveMatchingPreferences } from "./matching/matching.js";
import { upsertJob } from "./jobs/jobLibrary.js";
import { createApplication, readApplicationTracker, markSubmitted } from "./tracker.js";
import { readOpportunities, parseOpportunities, projectJobs, mergeApplications, transactOpportunities } from "./storage/opportunities.js";
import { publishReviewItem, readReviewBatch, type ReviewItem } from "./review/reviewStore.js";
import { runPreflight } from "./preflight.js";
import { startMatchingSurface } from "./matching/surface.js";
import { buildStatusView } from "./review/statusView.js";
import { renderUsStatusPage } from "./review/reviewViews.js";

const roots: string[] = [];
const at = "2026-10-29T12:00:00.000Z";
afterEach(async () => { await Promise.all(roots.splice(0).map(p => rm(p, { recursive: true, force: true }))); });
async function fixture() {
  const parent = await mkdtemp(join(tmpdir(), "direction-routing-")); roots.push(parent);
  const root = join(parent, "case");
  const intake = await createMatchingWorkspace(root, { confirmed: true, reference: "Fictional candidate confirms product and design search",
    candidate: { schemaVersion: 2, fictional: true, identity: { fullName: "Casey Example" }, summary: "Product design course projects", skills: ["User research"], education: [{ institution: "Example Institute" }] },
    preferences: "Product Management, Design and Customer Success roles in Seattle. Unknown conditions remain questions.",
    rules: { categories: ["Product Management", "Design", "Customer Success"], workModes: ["remote"], locations: ["Seattle, WA"], excludedCompanies: [], excludedJobIds: [], limit: 3, perCompany: 1 }
  }, join(parent, "index.json"));
  return { parent, root, paths: intake.paths };
}
const job = { jobId: "product-example", company: "Product Example", title: "Associate Product Manager", location: "Seattle, WA", category: "Product Management", officialUrl: "https://careers.example.com/product", sources: ["official-careers"] as const, firstSeen: "2026-10-29", lastVerified: "2026-10-29", note: "Conditional fictional lead", status: "new" as const };
const application = { jobId: job.jobId, applicationId: "product-app", company: job.company, title: job.title, location: job.location, ats: "ashby" as const, jobUrl: job.officialUrl, applicationUrl: job.officialUrl + "/apply", category: "pm_general", cvFilename: "approved-product.pdf" };

test("shortlists ordinary directions with no resume and processes feedback without application changes", async () => {
  const { paths } = await fixture();
  expect((await matchingContext(paths)).availableResumeCategories).toEqual([]);
  const assessments = ["Product Management", "Design", "Customer Success"].map((category, i) => ({ ...job, jobId: `example-${i}`, company: `Example ${i}`, category, officialUrl: `https://careers.example.com/${i}`, workMode: "remote", eligibleLocations: ["Seattle, WA"], decision: i === 0 ? "needs_confirmation" : "recommend", match: ["Relevant fictional course experience"], gaps: [], questions: i === 0 ? ["Verify start timing"] : [], candidateEvidence: ["Supplied fictional background"], jobEvidence: ["Supplied fictional official-page observation"] }));
  // The assessment contract intentionally contains no job-library status/note fields.
  const input = assessments.map(({ note: _n, status: _s, ...assessment }) => assessment);
  await publishMatchingRound(paths, { version: 1, contextToken: (await matchingContext(paths)).token, assessments: input });
  const records = await readOpportunities(paths.opportunities);
  expect(records.opportunities).toHaveLength(3);
  expect(records.opportunities.every(o => !o.application)).toBe(true);
  expect(records.opportunities[0]?.stage).toBe("new");
  await saveMatchingPreferences(paths, { expectedToken: (await matchingContext(paths)).token, feedback: { id: "design-only", text: "Only Design roles", reference: "Fictional user feedback", at, patch: { categories: ["Design"] } } });
  await publishMatchingRound(paths, { version: 1, contextToken: (await matchingContext(paths)).token, assessments: input });
  expect(buildStatusView([], projectJobs(await readOpportunities(paths.opportunities))).map(j => j.category)).toEqual(["Design"]);
});

test("configured arbitrary resume profiles pass existing preflight and remain separate through review and submission", async () => {
  const { root, paths } = await fixture();
  await upsertJob(paths.opportunities, job);
  await expect(createApplication(paths.opportunities, { ...application, category: undefined as never }, at)).rejects.toThrow("invalid_application_record");
  const bytes = Buffer.from("Fictional approved product resume content");
  const pdf = join(root, "data", application.cvFilename);
  await writeFile(pdf, bytes);
  await writeFile(paths.manifest, JSON.stringify([{ category: "pm_general", path: application.cvFilename, sha256: createHash("sha256").update(bytes).digest("hex") }]));
  await expect(runPreflight({ profilePath: paths.profile, manifestPath: paths.manifest, jobUrl: job.officialUrl, category: "Product Management" })).rejects.toThrow("unsupported_category");
  const checked = await runPreflight({ profilePath: paths.profile, manifestPath: paths.manifest, jobUrl: job.officialUrl, category: "pm_general" });
  expect(checked.cvPath).toBe(pdf);
  await createApplication(paths.opportunities, application, at);
  const sibling = { ...job, jobId: "legacy-sibling", category: "llm", officialUrl: "https://careers.example.com/legacy" };
  await upsertJob(paths.opportunities, sibling);
  await createApplication(paths.opportunities, { ...application, jobId: sibling.jobId, applicationId: "legacy-app", jobUrl: sibling.officialUrl, applicationUrl: sibling.officialUrl + "/apply", category: "llm" }, at);
  const stored = (await readOpportunities(paths.opportunities)).opportunities[0]!;
  expect(stored.category).toBe("Product Management");
  expect(stored.application?.resumeCategory).toBe("pm_general");
  expect((await readApplicationTracker(paths.opportunities)).applications.map(a => a.category)).toEqual(["pm_general", "llm"]);
  const item: ReviewItem = { applicationId: application.applicationId, company: job.company, title: job.title, location: job.location, category: "pm_general", ats: "ashby", officialUrl: job.officialUrl, applicationUrl: application.applicationUrl, cv: { filename: application.cvFilename, verified: true }, snapshotId: "product-snapshot", snapshotCurrent: true, answers: [], consents: [], questions: [], validationErrors: [], friction: [], preparedAt: at, decision: { state: "pending" } };
  const drafts = join(root, "data/drafts");
  await publishReviewItem(drafts, item, null);
  expect((await readReviewBatch(drafts)).applications[0]?.category).toBe("pm_general");
  const surface = await startMatchingSurface(root);
  try { expect(await (await fetch(surface.statusUrl)).text()).toContain("Product Management"); }
  finally { await surface.server.close(); }
  const record = (await readApplicationTracker(paths.opportunities)).applications[0]!;
  expect(buildStatusView([record], projectJobs(await readOpportunities(paths.opportunities)))[0]?.category).toBe("Product Management");
  const document = await readOpportunities(paths.opportunities);
  expect(() => mergeApplications(document, [{ ...record, category: "different_resume" }])).toThrow("opportunity_identity_mismatch");
  await markSubmitted(paths.opportunities, record.applicationId, { applicationId: record.applicationId, snapshotId: item.snapshotId, approvalConsumed: true, visibleResult: "submitted", authorization: { source: "chat", reference: "Fictional exact user acceptance", approvedAt: at }, evidence: { source: "official_page", reference: "Fictional successful submission", verifiedAt: at } }, at);
  expect((await readApplicationTracker(paths.opportunities)).applications[0]).toMatchObject({ category: "pm_general", status: "submitted" });
});

test("legacy applications read without rewriting and new directions never infer resume bindings", async () => {
  const { paths } = await fixture();
  await upsertJob(paths.opportunities, { ...job, category: "llm" });
  await createApplication(paths.opportunities, { ...application, category: "llm" }, at);
  await transactOpportunities(paths.opportunities, doc => { delete doc.opportunities[0]!.application!.resumeCategory; });
  const before = await readFile(paths.opportunities, "utf8");
  expect((await readApplicationTracker(paths.opportunities)).applications[0]?.category).toBe("llm");
  expect(await readFile(paths.opportunities, "utf8")).toBe(before);
  const invalid = JSON.parse(before); invalid.opportunities[0].category = "Product Management";
  expect(() => parseOpportunities(invalid)).toThrow("application_resume_category_required");
});

test("free direction labels are escaped and cannot inject HTML", () => {
  const html = renderUsStatusPage(buildStatusView([], [{ ...job, category: '<img src=x onerror="alert(1)">', sources: ["official-careers"] }]));
  expect(html).toContain("&lt;img");
  expect(html).not.toContain('<img src=x');
});

test("an explicitly saved PM lead needs no resume or broadening of ongoing search preferences", async () => {
  const { paths } = await fixture();
  await saveMatchingPreferences(paths, { expectedToken: (await matchingContext(paths)).token, feedback: { id: "llm-scope", text: "Keep automatic search focused on LLM roles", reference: "Fictional search preference", at, patch: { categories: ["llm"] } } });
  const before = await readFile(paths.preferences, "utf8");
  await upsertJob(paths.opportunities, job);
  expect(await readFile(paths.preferences, "utf8")).toBe(before);
  expect((await readOpportunities(paths.opportunities)).opportunities[0]).toMatchObject({ category: "Product Management", stage: "new" });
  expect((await readApplicationTracker(paths.opportunities)).applications).toEqual([]);
  expect((await matchingContext(paths)).availableResumeCategories).toEqual([]);
});
