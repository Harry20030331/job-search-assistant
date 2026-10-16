import { createHash, randomUUID } from "node:crypto";
import { chmod, readdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join, basename } from "node:path";
import { readOpportunities, projectApplications, transactOpportunities } from "./opportunities.js";
import type { ApplicationRecord } from "../tracker.js";
import type { ReviewBatch } from "../review/reviewStore.js";

export function isDraftDirectory(path: string): boolean { return basename(path) === "drafts"; }
function opportunityPath(path: string): string { return join(dirname(path), "opportunities.json"); }
function filename(jobId: string): string { return encodeURIComponent(jobId) + ".json"; }
function identityHash(record: ApplicationRecord): string {
  return createHash("sha256").update(JSON.stringify([record.jobId, record.applicationId, record.company, record.title,
    record.location, record.category, record.ats, record.jobUrl, record.applicationUrl, record.cvFilename])).digest("hex");
}
export async function readDrafts(path: string): Promise<ReviewBatch> {
  const tracker = projectApplications(await readOpportunities(opportunityPath(path)));
  const names = (await readdir(path)).filter(name => name.endsWith(".json")).sort();
  const applications: ReviewBatch["applications"] = [];
  for (const name of names) {
    const stored = JSON.parse(await readFile(join(path, name), "utf8"));
    const { schemaVersion, jobId, cvVerified, identitySha256, ...content } = stored;
    if (schemaVersion !== 1 || typeof jobId !== "string" || filename(jobId) !== name || typeof cvVerified !== "boolean" || typeof identitySha256 !== "string" || !/^[0-9a-f]{64}$/.test(identitySha256)) throw new Error("invalid_draft");
    const record = tracker.applications.find(record => record.jobId === jobId);
    if (!record) throw new Error("draft_application_not_found");
    // Identity and lifecycle come from the opportunity, never from draft headers.
    for (const key of ["applicationId", "company", "title", "location", "category", "ats", "officialUrl", "applicationUrl", "cv"]) {
      if (key in content) throw new Error("duplicated_draft_identity");
    }
    applications.push({ ...content, snapshotCurrent: content.snapshotCurrent === true && identitySha256 === identityHash(record), applicationId: record.applicationId, company: record.company, title: record.title,
      location: record.location, category: record.category, ats: record.ats, officialUrl: record.jobUrl,
      applicationUrl: record.applicationUrl, cv: { filename: record.cvFilename, verified: cvVerified } });
  }
  return { schemaVersion: 1, batchId: "active-drafts", createdAt: applications.map(item => item.preparedAt).sort()[0] ?? "1970-01-01T00:00:00.000Z", applications };
}
export async function saveDrafts(path: string, batch: ReviewBatch): Promise<void> {
  // Caller holds the same opportunity lock used by lifecycle changes and cleanup.
  const tracker = projectApplications(await readOpportunities(opportunityPath(path)));
  const writes: Array<{ path: string; content: string }> = [];
  for (const item of batch.applications) {
    const record = tracker.applications.find(record => record.applicationId === item.applicationId);
    if (!record) throw new Error("draft_application_not_found");
    if (item.company !== record.company || item.title !== record.title || item.location !== record.location ||
      item.category !== record.category || item.ats !== record.ats || item.officialUrl !== record.jobUrl ||
      item.applicationUrl !== record.applicationUrl || item.cv.filename !== record.cvFilename) throw new Error("draft_identity_mismatch");
    const { applicationId, company, title, location, category, ats, officialUrl, applicationUrl, cv, ...content } = item;
    writes.push({ path: join(path, filename(record.jobId)), content: JSON.stringify({ schemaVersion: 1, jobId: record.jobId, identitySha256: identityHash(record), cvVerified: cv.verified, ...content }, null, 2) + "\n" });
  }
  for (const item of writes) {
    let previous: string | undefined;
    try { previous = await readFile(item.path, "utf8"); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    if (previous === item.content) continue;
    const temporary = join(path, `.${randomUUID()}.tmp`);
    await writeFile(temporary, item.content, { mode: 0o600 });
    await rename(temporary, item.path); await chmod(item.path, 0o600);
  }
}
export function withDraftLock<T>(path: string, change: () => Promise<T>): Promise<T> {
  return transactOpportunities(opportunityPath(path), change);
}
/** Only remove working answers after success is durably recorded; never treat approval as success. */
export async function pruneSubmittedDrafts(path: string): Promise<string[]> {
  return transactOpportunities(opportunityPath(path), async document => {
    const removed: string[] = [];
    for (const item of document.opportunities) {
      if (!["submitted", "interviewing", "offer", "closed"].includes(item.stage) || !(item.application?.submittedAt || item.application?.confirmedAt) || item.application?.visibleResult !== "submitted") continue;
      if (!item.application.submissionEvidence && !item.application.websiteConfirmation && item.application.gmailConfirmation !== "confirmed") continue;
      try { await unlink(join(path, filename(item.jobId))); removed.push(item.jobId); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    }
    return removed;
  });
}
