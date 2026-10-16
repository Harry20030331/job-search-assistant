import { chmod, mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { jobLibraryHeader, writeJobLibrary } from "../jobs/jobLibrary.js";
import { createApplication } from "../tracker.js";
import { createReviewBatch, type ReviewBatch } from "./reviewStore.js";
import { resolveRecoveryInputs } from "./reviewRecovery.js";

function batch(applicationId = "notion-1"): ReviewBatch {
  const officialUrl = `https://jobs.ashbyhq.com/notion/${applicationId}`;
  return {
    schemaVersion: 1,
    batchId: "batch-1",
    createdAt: "2026-08-07T18:00:00.000Z",
    applications: [{
      applicationId,
      snapshotId: "snapshot-1",
      company: "Notion",
      title: "Software Engineer, Early Career (AI)",
      officialUrl,
      applicationUrl: `${officialUrl}/application`,
      ats: "ashby",
      category: "llm",
      location: "San Francisco, CA",
      cv: { filename: "example_cv_llm.pdf", verified: true },
      answers: [],
      consents: [],
      questions: [],
      validationErrors: [],
      friction: [],
      snapshotCurrent: true,
      preparedAt: "2026-08-07T18:00:00.000Z",
      decision: { state: "pending" }
    }]
  };
}

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "review-recovery-"));
  await mkdir(join(root, "reviews"));
  await mkdir(join(root, "data"));
  await mkdir(join(root, "data/china"));
  const trackerPath = join(root, "data/application-tracker.local.json");
  const jobsPath = join(root, "data/us-job-library.csv");
  const chinaJobsPath = join(root, "data/china/job-library.csv");
  const chinaOutreachPath = join(root, "data/china/outreach-tracker.local.json");
  await writeFile(trackerPath, `${JSON.stringify({ schemaVersion: 2, applications: [] })}\n`, { mode: 0o600 });
  await writeFile(jobsPath, `${jobLibraryHeader}\n`, { mode: 0o600 });
  await writeFile(chinaJobsPath, "job_id,company,title,location,category,boss_url,recruiter_name,recruiter_title,first_seen,last_verified,status,note\n", { mode: 0o600 });
  await writeFile(chinaOutreachPath, `${JSON.stringify({ schemaVersion: 1, outreach: [] })}\n`, { mode: 0o600 });
  return { root, trackerPath, jobsPath, chinaJobsPath, chinaOutreachPath };
}

async function alignCompanionData(
  trackerPath: string,
  jobsPath: string,
  applicationId = "notion-1",
  overrides: Partial<Parameters<typeof createApplication>[1]> = {}
) {
  const officialUrl = `https://jobs.ashbyhq.com/notion/${applicationId}`;
  const tracker = {
    jobId: `notion-job-${applicationId}`,
    applicationId,
    company: "Notion",
    title: "Software Engineer, Early Career (AI)",
    location: "San Francisco, CA",
    ats: "ashby" as const,
    jobUrl: officialUrl,
    applicationUrl: `${officialUrl}/application`,
    category: "llm" as const,
    cvFilename: "example_cv_llm.pdf",
    ...overrides
  };
  await createApplication(trackerPath, tracker);
  await writeJobLibrary(jobsPath, [{
    jobId: tracker.jobId,
    company: tracker.company,
    title: tracker.title,
    location: tracker.location,
    category: tracker.category,
    officialUrl: tracker.jobUrl,
    sources: ["simplify-new-grad"],
    firstSeen: "2026-08-07",
    lastVerified: "2026-08-07",
    status: "final_review",
    note: ""
  }]);
  return tracker;
}

async function writeAlignedCompanionData(
  trackerPath: string,
  jobsPath: string,
  batches: ReviewBatch[],
  statuses: Record<string, "in_review" | "confirmed">
) {
  const applications = batches.flatMap((document) => document.applications).map((item) => {
    const status = statuses[item.applicationId] ?? "in_review";
    return {
      jobId: `${item.applicationId}-job`,
      applicationId: item.applicationId,
      company: item.company,
      title: item.title,
      location: item.location,
      ats: item.ats,
      jobUrl: item.officialUrl,
      applicationUrl: item.applicationUrl!,
      category: item.category,
      cvFilename: item.cv.filename,
      status,
      visibleResult: status === "confirmed" ? "submitted" : "not_attempted",
      gmailConfirmation: status === "confirmed" ? "confirmed" : "not_checked",
      createdAt: "2026-08-07T18:00:00.000Z",
      updatedAt: "2026-08-08T18:00:00.000Z"
    };
  });
  await writeFile(trackerPath, `${JSON.stringify({ schemaVersion: 3, applications })}\n`, { mode: 0o600 });
  await writeJobLibrary(jobsPath, applications.map((application) => ({
    jobId: application.jobId,
    company: application.company,
    title: application.title,
    location: application.location,
    category: application.category,
    officialUrl: application.jobUrl,
    sources: ["simplify-new-grad"],
    firstSeen: "2026-08-07",
    lastVerified: "2026-08-08",
    status: "final_review" as const,
    note: ""
  })));
}

describe("review recovery inputs", () => {
  test("selects the newest dated private review record without mutating it", async () => {
    const { root, trackerPath, jobsPath, chinaJobsPath, chinaOutreachPath } = await fixture();
    const older = join(root, "reviews/2026-08-06.local.json");
    const newest = join(root, "reviews/2026-08-07.local.json");
    await createReviewBatch(older, batch("older"));
    await createReviewBatch(newest, batch("newest"));
    await alignCompanionData(trackerPath, jobsPath, "newest");
    const before = await import("node:fs/promises").then(({ readFile }) => readFile(newest, "utf8"));

    await expect(resolveRecoveryInputs(root)).resolves.toEqual({
      reviewPath: newest,
      trackerPath,
      jobsPath,
      chinaJobsPath,
      chinaOutreachPath,
      port: 64440,
      applicationCount: 1,
      applicationIds: ["newest"],
      liveAtsState: "unverified"
    });
    await expect(import("node:fs/promises").then(({ readFile }) => readFile(newest, "utf8"))).resolves.toBe(before);
  });

  test("fails closed when no dated review record exists", async () => {
    const { root } = await fixture();
    await expect(resolveRecoveryInputs(root)).rejects.toThrow("recovery_review_not_found");
  });

  test("prefers an active suffixed review batch over a confirmed historical batch", async () => {
    const { root, trackerPath, jobsPath } = await fixture();
    const historicalPath = join(root, "reviews/2026-08-08.local.json");
    const activePath = join(root, "reviews/2026-08-08-next.local.json");
    const historical = batch("amazon-confirmed");
    const active = batch("parallel-active");
    active.applications.push({
      ...batch("servicenow-active").applications[0]!,
      snapshotId: "snapshot-2"
    });
    await createReviewBatch(historicalPath, historical);
    await createReviewBatch(activePath, active);
    await writeAlignedCompanionData(trackerPath, jobsPath, [historical, active], {
      "amazon-confirmed": "confirmed",
      "parallel-active": "in_review",
      "servicenow-active": "in_review"
    });

    await expect(resolveRecoveryInputs(root)).resolves.toMatchObject({
      reviewPath: activePath,
      applicationCount: 2,
      applicationIds: ["parallel-active", "servicenow-active"]
    });
  });

  test("fails closed when multiple review batches have the same active score", async () => {
    const { root, trackerPath, jobsPath } = await fixture();
    const alpha = batch("alpha-active");
    const beta = batch("beta-active");
    await createReviewBatch(join(root, "reviews/2026-08-08-alpha.local.json"), alpha);
    await createReviewBatch(join(root, "reviews/2026-08-08-beta.local.json"), beta);
    await writeAlignedCompanionData(trackerPath, jobsPath, [alpha, beta], {
      "alpha-active": "in_review",
      "beta-active": "in_review"
    });

    await expect(resolveRecoveryInputs(root)).rejects.toThrow("recovery_review_ambiguous");
  });

  test("falls back to the newest valid record when no batch is active", async () => {
    const { root, trackerPath, jobsPath } = await fixture();
    const olderPath = join(root, "reviews/2026-08-07.local.json");
    const newestPath = join(root, "reviews/2026-08-08.local.json");
    const older = batch("older-confirmed");
    const newest = batch("newest-confirmed");
    await createReviewBatch(olderPath, older);
    await createReviewBatch(newestPath, newest);
    await writeAlignedCompanionData(trackerPath, jobsPath, [older, newest], {
      "older-confirmed": "confirmed",
      "newest-confirmed": "confirmed"
    });

    await expect(resolveRecoveryInputs(root)).resolves.toMatchObject({
      reviewPath: newestPath,
      applicationIds: ["newest-confirmed"]
    });
  });

  test("fails closed when a review application has no exact tracker application", async () => {
    const { root } = await fixture();
    await createReviewBatch(join(root, "reviews/2026-08-07.local.json"), batch());

    await expect(resolveRecoveryInputs(root)).rejects.toThrow("recovery_data_mismatch");
  });

  test("fails closed when review, tracker, and job identity fields disagree", async () => {
    const { root, trackerPath, jobsPath } = await fixture();
    const review = batch();
    review.applications[0]!.applicationUrl = "https://jobs.ashbyhq.com/notion/other-application";
    await createReviewBatch(join(root, "reviews/2026-08-07.local.json"), review);
    await alignCompanionData(trackerPath, jobsPath, "notion-1", { company: "Different Company" });

    await expect(resolveRecoveryInputs(root)).rejects.toThrow("recovery_data_mismatch");
  });

  test("fails closed when the current review item has no exact application URL", async () => {
    const { root, trackerPath, jobsPath } = await fixture();
    const review = batch();
    delete review.applications[0]!.applicationUrl;
    await createReviewBatch(join(root, "reviews/2026-08-07.local.json"), review);
    await alignCompanionData(trackerPath, jobsPath);

    await expect(resolveRecoveryInputs(root)).rejects.toThrow("recovery_data_mismatch");
  });

  test("fails closed when the review CV filename does not match the tracker", async () => {
    const { root, trackerPath, jobsPath } = await fixture();
    const review = batch();
    review.applications[0]!.cv.filename = "example_cv_robotics.pdf";
    await createReviewBatch(join(root, "reviews/2026-08-07.local.json"), review);
    await alignCompanionData(trackerPath, jobsPath);

    await expect(resolveRecoveryInputs(root)).rejects.toThrow("recovery_data_mismatch");
  });

  test("fails closed when the review location does not match the tracker", async () => {
    const { root, trackerPath, jobsPath } = await fixture();
    const review = batch();
    review.applications[0]!.location = "New York, NY";
    await createReviewBatch(join(root, "reviews/2026-08-07.local.json"), review);
    await alignCompanionData(trackerPath, jobsPath);

    await expect(resolveRecoveryInputs(root)).rejects.toThrow("recovery_data_mismatch");
  });

  test("starts recovery for aligned evidence even when CV verification is still pending", async () => {
    const { root, trackerPath, jobsPath } = await fixture();
    const review = batch();
    review.applications[0]!.cv.verified = false;
    await createReviewBatch(join(root, "reviews/2026-08-07.local.json"), review);
    await alignCompanionData(trackerPath, jobsPath);

    await expect(resolveRecoveryInputs(root)).resolves.toMatchObject({ applicationCount: 1 });
  });

  test("allows extra historical tracker and job-library rows", async () => {
    const { root, trackerPath, jobsPath } = await fixture();
    await createReviewBatch(join(root, "reviews/2026-08-07.local.json"), batch());
    const current = await alignCompanionData(trackerPath, jobsPath);
    const historical = {
      ...current,
      jobId: "historical-job",
      applicationId: "historical-application",
      company: "Historical Company",
      title: "Historical Role",
      jobUrl: "https://example.com/jobs/historical",
      applicationUrl: "https://example.com/applications/historical"
    };
    await createApplication(trackerPath, historical);
    await writeJobLibrary(jobsPath, [current, historical].map((application) => ({
      jobId: application.jobId,
      company: application.company,
      title: application.title,
      location: application.location,
      category: application.category,
      officialUrl: application.jobUrl,
      sources: ["simplify-new-grad"],
      firstSeen: "2026-08-07",
      lastVerified: "2026-08-07",
      status: "final_review" as const,
      note: ""
    })));

    await expect(resolveRecoveryInputs(root)).resolves.toMatchObject({ applicationCount: 1 });
  });

  test("fails closed when an otherwise aligned tracker application has no job-library record", async () => {
    const { root, trackerPath } = await fixture();
    await createReviewBatch(join(root, "reviews/2026-08-07.local.json"), batch());
    await createApplication(trackerPath, {
      jobId: "notion-job-1",
      applicationId: "notion-1",
      company: "Notion",
      title: "Software Engineer, Early Career (AI)",
      location: "San Francisco, CA",
      ats: "ashby",
      jobUrl: "https://jobs.ashbyhq.com/notion/1",
      applicationUrl: "https://jobs.ashbyhq.com/notion/1/application",
      category: "llm",
      cvFilename: "example_cv_llm.pdf"
    });

    await expect(resolveRecoveryInputs(root)).rejects.toThrow("recovery_data_mismatch");
  });

  test("fails closed for unsafe permissions or malformed companion data", async () => {
    const { root, trackerPath } = await fixture();
    const reviewPath = join(root, "reviews/2026-08-07.local.json");
    await createReviewBatch(reviewPath, batch());
    await chmod(reviewPath, 0o644);
    await expect(resolveRecoveryInputs(root)).rejects.toThrow("unsafe_recovery_file_permissions");

    await chmod(reviewPath, 0o600);
    await writeFile(trackerPath, "{}\n", { mode: 0o600 });
    await expect(resolveRecoveryInputs(root)).rejects.toThrow("invalid_application_tracker");
  });
});
