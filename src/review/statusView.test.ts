import { describe, expect, test } from "vitest";
import type { JobRecord } from "../jobs/jobLibrary.js";
import type { ApplicationRecord } from "../tracker.js";
import { buildStatusView } from "./statusView.js";

const application: ApplicationRecord = {
  jobId: "tracked-job",
  applicationId: "tracked-application",
  company: "Tracked Co",
  title: "Machine Learning Engineer",
  location: "San Francisco, CA",
  ats: "ashby",
  jobUrl: "https://example.com/jobs/tracked",
  applicationUrl: "https://example.com/applications/tracked",
  category: "llm",
  cvFilename: "example_cv_llm.pdf",
  status: "confirmed",
  visibleResult: "submitted",
  gmailConfirmation: "confirmed",
  createdAt: "2026-08-06T18:00:00.000Z",
  updatedAt: "2026-08-07T18:02:00.000Z"
};

const readyJob: JobRecord = {
  jobId: "ready-job",
  company: "Ready Co",
  title: "Robotics Research Engineer",
  location: "Seattle, WA",
  category: "robotics",
  officialUrl: "https://example.com/jobs/ready?source=official",
  sources: ["speedyapply-2027-ai"],
  firstSeen: "2026-08-06",
  lastVerified: "2026-08-07",
  status: "ready",
  note: "2027 timing unconfirmed"
};

describe("status view projection", () => {
  test("places ready jobs before tracked applications with exact link and date evidence", () => {
    expect(buildStatusView([application], [readyJob])).toEqual([
      {
        jobId: "ready-job",
        company: "Ready Co",
        title: "Robotics Research Engineer",
        location: "Seattle, WA",
        category: "robotics",
        href: "https://example.com/jobs/ready?source=official",
        status: "shortlisted",
        screeningStatus: "ready",
        screeningNote: "2027 timing unconfirmed",
        dateLabel: "08-07",
        dateTime: "2026-08-07T00:00:00.000Z"
      },
      {
        jobId: "tracked-job",
        applicationId: "tracked-application",
        company: "Tracked Co",
        title: "Machine Learning Engineer",
        location: "San Francisco, CA",
        category: "llm",
        resumeProfile: "llm",
        href: "https://example.com/applications/tracked",
        status: "confirmed",
        dateLabel: "08-07",
        dateTime: "2026-08-07T18:02:00.000Z"
      }
    ]);
  });

  test("includes pending candidates and lets the tracker win an exact jobId collision", () => {
    const nonReady = { ...readyJob, jobId: "new-job", status: "new" as const };
    const duplicate = { ...readyJob, jobId: application.jobId, company: "Stale CSV Company" };
    const result = buildStatusView([application], [nonReady, duplicate, readyJob]);

    expect(result.map(({ jobId }) => jobId)).toEqual(["new-job", "ready-job", "tracked-job"]);
    expect(result.some(({ company }) => company === "Stale CSV Company")).toBe(false);
  });

  test.each(["in_review", "submitted", "confirmed", "interviewing", "offer", "closed"] as const)(
    "preserves tracker state %s without changing persistence semantics",
    (status) => {
      expect(buildStatusView([{ ...application, status }], [])[0]?.status).toBe(status);
    }
  );

  test("keeps unavailable candidates visible with an explicit closed screening status", () => {
    const result = buildStatusView([], [{ ...readyJob, status: "closed", note: "Official job not found" }]);
    expect(result[0]?.status).toBe("closed");
    expect(result[0]?.screeningStatus).toBe("closed");
    expect(result[0]?.screeningNote).toBe("Official job not found");
  });

  test("omits user-excluded experienced roles without calling them employer-closed", () => {
    expect(buildStatusView([], [{ ...readyJob, status: "new", note: "user-excluded: required professional experience" }])).toEqual([]);
  });

  test("uses the tracker job URL only when no exact application URL exists", () => {
    expect(buildStatusView([{ ...application, applicationUrl: undefined }], [])[0]?.href).toBe(application.jobUrl);
  });
});
