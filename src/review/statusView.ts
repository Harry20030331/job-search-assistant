import type { JobRecord } from "../jobs/jobLibrary.js";
import type { ApplicationRecord } from "../tracker.js";

export type StatusViewStatus = "shortlisted" | ApplicationRecord["status"];

export interface StatusViewItem {
  jobId: string;
  company: string;
  title: string;
  location: string;
  category: ApplicationRecord["category"];
  href: string;
  status: StatusViewStatus;
  dateLabel: string;
  dateTime: string;
  screeningStatus?: "ready" | "new" | "closed";
  screeningNote?: string;
}

export function buildStatusView(
  applications: readonly ApplicationRecord[],
  jobs: readonly JobRecord[]
): StatusViewItem[] {
  const trackedJobIds = new Set(applications.map(({ jobId }) => jobId));
  const shortlisted: StatusViewItem[] = jobs
    .filter(({ jobId, status, note }) => ["ready", "new", "closed"].includes(status) && !trackedJobIds.has(jobId) && !note.startsWith("user-excluded:"))
    .map((job) => ({
      jobId: job.jobId,
      company: job.company,
      title: job.title,
      location: job.location,
      category: job.category,
      href: job.officialUrl,
      status: job.status === "closed" ? "closed" : "shortlisted",
      screeningStatus: job.status as "ready" | "new" | "closed",
      screeningNote: job.note,
      dateLabel: job.lastVerified.slice(5),
      dateTime: `${job.lastVerified}T00:00:00.000Z`
    }));
  const tracked: StatusViewItem[] = applications.filter((application) => !application.hiddenFromStatus).map((application) => ({
    jobId: application.jobId,
    company: application.company,
    title: application.title,
    location: application.location,
    category: application.category,
    href: application.applicationUrl ?? application.jobUrl,
    status: application.status,
    dateLabel: application.updatedAt.slice(5, 10),
    dateTime: application.updatedAt
  }));
  return [...shortlisted, ...tracked];
}
