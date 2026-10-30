import type { JobRecord } from "../jobs/jobLibrary.js";
import type { ReviewBatch, ReviewItem } from "./reviewStore.js";
import type { ApplicationTask } from "./applicationTasks.js";
import type { ApplicationRecord } from "../tracker.js";

export type StatusViewStatus = "shortlisted" | "preparing" | "submitting" | "submission_failed" | "rehearsal_complete" | ApplicationRecord["status"];
export interface WorkflowContext { review: ReviewBatch; tasks: readonly ApplicationTask[]; mode?: "demo" | "codex" }
export const statusLabels: Record<StatusViewStatus, string> = {
  shortlisted: "Shortlisted", preparing: "Preparing…",
  in_review: "In Review", submitting: "Submitting…", submission_failed: "Submission failed",
  rehearsal_complete: "Submitted", submitted: "Submitted", confirmed: "Submitted",
  interviewing: "Interviewing", offer: "Offer", closed: "Closed"
};
export function statusGroup(status: StatusViewStatus): string {
  return ["confirmed", "rehearsal_complete"].includes(status) ? "submitted"
    : ["submitting", "submission_failed"].includes(status) ? "in_review" : status;
}
export function sameDraft(task: ApplicationTask, draft: ReviewItem): boolean {
  return task.target.applicationId === draft.applicationId && task.target.snapshotId === draft.snapshotId && task.target.revision === (draft.desiredState?.revision ?? 0);
}
function workflowStatus(jobId: string, fallback: StatusViewStatus, applicationId: string | undefined, context: WorkflowContext): StatusViewStatus {
  if (!["shortlisted", "in_review"].includes(fallback)) return fallback;
  const draft = context.review.applications.find(item => item.applicationId === applicationId);
  const tasks = context.tasks.filter(task => task.target.jobId === jobId);
  const active = tasks.find(task => ["queued", "running"].includes(task.state));
  if (active) return active.action === "prepare" ? "preparing" : "submitting";
  if (draft && context.mode !== "codex" && tasks.some(task => task.action === "submit" && task.state === "demo_complete" && sameDraft(task, draft))) return "rehearsal_complete";
  if (!draft) return "shortlisted";
  const latestSubmission = tasks.filter(task => task.action === "submit" && sameDraft(task, draft)).at(-1);
  return latestSubmission && ["blocked", "interrupted"].includes(latestSubmission.state) ? "submission_failed" : "in_review";
}

export interface StatusViewItem {
  jobId: string;
  applicationId?: string;
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
  preparationNeedsRetry?: boolean;
}

export function buildStatusView(
  applications: readonly ApplicationRecord[],
  jobs: readonly JobRecord[],
  context?: WorkflowContext
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
    applicationId: application.applicationId,
    company: application.company,
    title: application.title,
    location: application.location,
    category: application.category,
    href: application.applicationUrl ?? application.jobUrl,
    status: application.status,
    dateLabel: application.updatedAt.slice(5, 10),
    dateTime: application.updatedAt
  }));
  return [...shortlisted, ...tracked].map(item => {
    if (!context) return item;
    const status = workflowStatus(item.jobId, item.status, item.applicationId, context);
    const latestPreparation = context.tasks.filter(task => task.target.jobId === item.jobId && task.action === "prepare").at(-1);
    const retry = status === "shortlisted" && latestPreparation && ["blocked", "interrupted"].includes(latestPreparation.state);
    return { ...item, status, ...(retry ? { preparationNeedsRetry: true } : {}) };
  });
}
