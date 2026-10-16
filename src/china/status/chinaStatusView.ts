import type { ChinaJobRecord } from "../jobs/chinaJobLibrary.js";
import type { ChinaOutreachRecord } from "../outreach/chinaOutreachTracker.js";

export type ChinaStatus = ChinaJobRecord["status"];

export interface ChinaStatusViewItem {
  jobId: string;
  company: string;
  title: string;
  location: string;
  category: ChinaJobRecord["category"];
  recruiter: string;
  href: string;
  status: ChinaStatus;
  dateLabel: string;
  dateTime: string;
}

function recruiterLabel(job: ChinaJobRecord): string {
  const parts = [job.recruiterName, job.recruiterTitle].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Recruiter not recorded";
}

function projectedStatus(job: ChinaJobRecord, outreach?: ChinaOutreachRecord): ChinaStatus {
  if (!outreach) return job.status;
  if (outreach.status === "draft") return "ready_to_contact";
  if (outreach.status === "awaiting_review") return "awaiting_review";
  return outreach.status;
}

export function buildChinaStatusView(
  jobs: readonly ChinaJobRecord[],
  outreach: readonly ChinaOutreachRecord[]
): ChinaStatusViewItem[] {
  const byJobId = new Map(outreach.map((record) => [record.jobId, record]));
  return jobs.map((job) => {
    const record = byJobId.get(job.jobId);
    const dateTime = record?.updatedAt ?? `${job.lastVerified}T00:00:00.000Z`;
    return {
      jobId: job.jobId,
      company: job.company,
      title: job.title,
      location: job.location,
      category: job.category,
      recruiter: recruiterLabel(job),
      href: job.bossUrl,
      status: projectedStatus(job, record),
      dateLabel: dateTime.slice(5, 10),
      dateTime
    };
  });
}
