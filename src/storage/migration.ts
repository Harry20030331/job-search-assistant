import type { JobRecord } from "../jobs/jobLibrary.js";
import type { ApplicationRecord } from "../tracker.js";
import { mergeApplications, parseOpportunities, type Opportunities } from "./opportunities.js";

/** Pure conversion. Caller snapshots old files and validates before activating the result. */
export function convertLegacy(jobs: JobRecord[], applications: ApplicationRecord[]): Opportunities {
  const document: Opportunities = { schemaVersion: 1, opportunities: jobs.map(({ status, ...job }) => ({
    ...job, availability: status === "closed" ? "closed" : "open", stage: status === "closed" ? "closed" : status === "new" ? "new" : "ready"
  })) };
  for (const application of applications) {
    let job = document.opportunities.find(item => item.jobId === application.jobId);
    if (!job) {
      job = { jobId: application.jobId, company: application.company, title: application.title,
        location: application.location, category: application.category, officialUrl: application.jobUrl,
        sources: ["user-provided"], firstSeen: application.createdAt.slice(0, 10), lastVerified: application.createdAt.slice(0, 10),
        note: "Recovered from the historical application record; vacancy availability has not been rechecked.",
        availability: "unknown", stage: "ready" };
      document.opportunities.push(job);
    }
    // The application is the authoritative identity once filling has begun.
    Object.assign(job, { company: application.company, title: application.title, location: application.location,
      officialUrl: application.jobUrl });
  }
  mergeApplications(document, applications);
  // Keep the existing visible order without introducing a second ordering ledger.
  const tracked = new Set(applications.map(item => item.jobId));
  document.opportunities = [
    ...document.opportunities.filter(item => !tracked.has(item.jobId)),
    ...applications.map(record => document.opportunities.find(item => item.jobId === record.jobId)!)
  ];
  return parseOpportunities(document);
}
