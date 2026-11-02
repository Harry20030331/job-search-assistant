import type { InterviewBoardItem } from "../interview/workbench.js";
import type { ResumeRecommendation } from "../matching/resumeRecommendation.js";
import type { JobRecord } from "../jobs/jobLibrary.js";
import type { ReviewBatch, ReviewItem } from "./reviewStore.js";
import type { ApplicationTask } from "./applicationTasks.js";
import type { ApplicationRecord } from "../tracker.js";

export type StatusViewStatus = "shortlisted" | "preparing" | "submitting" | "submission_failed" | "rehearsal_complete" | ApplicationRecord["status"];
export interface WorkflowContext { review: ReviewBatch; tasks: readonly ApplicationTask[]; mode?: "demo" | "codex"; demoInterviewEnabled?: boolean; demoInterviews?: readonly InterviewBoardItem[] }
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
  if (draft && context.mode !== "codex" && tasks.some(task => task.action === "submit" && task.state === "demo_complete" && sameDraft(task, draft))) {
    return context.mode === "demo" && context.demoInterviews?.some(item => item.entry.applicationId === applicationId && item.entry.demoSubmission?.snapshotId === draft.snapshotId && item.entry.demoSubmission.revision === (draft.desiredState?.revision ?? 0)) ? "interviewing" : "rehearsal_complete";
  }
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
  category: JobRecord["category"];
  href: string;
  status: StatusViewStatus;
  dateLabel: string;
  dateTime: string;
  screeningStatus?: "ready" | "new" | "closed";
  screeningNote?: string;
  preparationNeedsRetry?: boolean;
  resumeRecommendation?: ResumeRecommendation;
  resumeProfile?: string;
  resumeStale?: boolean;
  demoInterviewTarget?: { jobId: string; applicationId: string; taskId: string; snapshotId: string; revision: number };
  interviewHref?: string;
}

export function buildStatusView(
  applications: readonly ApplicationRecord[],
  jobs: readonly JobRecord[],
  context?: WorkflowContext
): StatusViewItem[] {
  const trackedJobIds = new Set(applications.map(({ jobId }) => jobId));
  const directions = new Map(jobs.map(job => [job.jobId, job.category]));
  const shortlisted: StatusViewItem[] = jobs
    .filter(({ jobId, status, note }) => ["ready", "new", "closed"].includes(status) && !trackedJobIds.has(jobId) && !note.startsWith("user-excluded:"))
    .map((job) => ({
      jobId: job.jobId,
      company: job.company,
      title: job.title,
      location: job.location,
      category: job.category,
      ...(job.resumeRecommendation ? { resumeRecommendation: job.resumeRecommendation } : {}),
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
    category: directions.get(application.jobId) ?? application.category,
    resumeProfile: application.category,
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
    const draft = context.review.applications.find(draft => draft.applicationId === item.applicationId);
    const submission = draft ? context.tasks.find(task => task.mode === "demo" && task.action === "submit" && task.state === "demo_complete" && sameDraft(task, draft)) : undefined;
    const interview = context.mode === "demo" ? context.demoInterviews?.find(round => round.entry.applicationId === item.applicationId && round.entry.demoSubmission?.taskId === submission?.id) : undefined;
    const target = context.mode === "demo" && context.demoInterviewEnabled && status === "rehearsal_complete" && submission && draft && draft.decision.state === "approved" && draft.decision.scope === "content-only"
      ? { jobId: item.jobId, applicationId: draft.applicationId, taskId: submission.id, snapshotId: draft.snapshotId, revision: draft.desiredState?.revision ?? 0 } : undefined;
    return { ...item, status, ...(target ? { demoInterviewTarget: target } : {}), ...(status === "interviewing" && interview ? { interviewHref: "/interviews?interview=" + encodeURIComponent(interview.entry.interviewId) } : {}), ...(retry ? { preparationNeedsRetry: true } : {}) };
  });
}
