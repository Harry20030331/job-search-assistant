import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { normalizeOfficialUrl, readJobLibrary } from "../jobs/jobLibrary.js";
import { readApplicationTracker } from "../tracker.js";
import { readReviewBatch } from "./reviewStore.js";

export interface RecoveryInputs {
  reviewPath: string;
  trackerPath: string;
  jobsPath: string;
  chinaJobsPath: string;
  chinaOutreachPath: string;
  port: number;
  applicationCount: number;
  applicationIds: string[];
  liveAtsState: "unverified";
}

async function requirePrivateFile(path: string): Promise<void> {
  let metadata;
  try {
    metadata = await stat(path);
  } catch {
    throw new Error("recovery_file_not_found");
  }
  if (!metadata.isFile()) throw new Error("recovery_file_not_found");
  if ((metadata.mode & 0o777) !== 0o600) throw new Error("unsafe_recovery_file_permissions");
}

export async function resolveRecoveryInputs(projectRoot: string): Promise<RecoveryInputs> {
  const canonical = join(projectRoot, "data/opportunities.json");
  let canonicalExists = false;
  try { await stat(canonical); canonicalExists = true; } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  if (canonicalExists) {
    await requirePrivateFile(canonical);
    const reviewPath = join(projectRoot, "data/drafts");
    const metadata = await stat(reviewPath);
    if (!metadata.isDirectory() || (metadata.mode & 0o777) !== 0o700) throw new Error("unsafe_recovery_file_permissions");
    for (const name of await readdir(reviewPath)) if (name.endsWith(".json")) await requirePrivateFile(join(reviewPath, name));
    const [review, tracker, jobs] = await Promise.all([readReviewBatch(reviewPath), readApplicationTracker(canonical), readJobLibrary(canonical)]);
    validateRecoveryCandidate(review, tracker, jobs, true);
    return { reviewPath, trackerPath: canonical, jobsPath: canonical, chinaJobsPath: "", chinaOutreachPath: "", port: 64441,
      applicationCount: review.applications.length, applicationIds: review.applications.map(item => item.applicationId), liveAtsState: "unverified" };
  }
  const reviewsPath = join(projectRoot, "reviews");
  let names: string[];
  try {
    names = (await readdir(reviewsPath, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && /^\d{4}-\d{2}-\d{2}(?:-[a-z0-9-]+)?\.local\.json$/.test(entry.name))
      .map((entry) => entry.name)
      .sort((left, right) => right.localeCompare(left));
  } catch {
    throw new Error("recovery_review_not_found");
  }
  if (names.length === 0) throw new Error("recovery_review_not_found");

  const trackerPath = join(projectRoot, "data/application-tracker.local.json");
  const jobsPath = join(projectRoot, "data/us-job-library.csv");
  const chinaJobsPath = join(projectRoot, "data/china/job-library.csv");
  const chinaOutreachPath = join(projectRoot, "data/china/outreach-tracker.local.json");
  const reviewPaths = names.map((name) => join(reviewsPath, name));
  await Promise.all(reviewPaths.map(requirePrivateFile));
  await requirePrivateFile(trackerPath);
  await requirePrivateFile(jobsPath);
  // Historical China paths remain compatible with older callers, but are not
  // inputs to the active US review/status server.

  const [tracker, jobs] = await Promise.all([
    readApplicationTracker(trackerPath),
    readJobLibrary(jobsPath)
  ]);

  const validCandidates: Array<{
    reviewPath: string;
    review: Awaited<ReturnType<typeof readReviewBatch>>;
    activeScore: number;
  }> = [];
  let firstCandidateError: unknown;
  for (const reviewPath of reviewPaths) {
    try {
      const review = await readReviewBatch(reviewPath);
      validateRecoveryCandidate(review, tracker, jobs);
      const activeScore = review.applications.filter((reviewItem) =>
        reviewItem.snapshotCurrent &&
        tracker.applications.some((application) =>
          application.applicationId === reviewItem.applicationId && application.status === "in_review"
        )
      ).length;
      validCandidates.push({ reviewPath, review, activeScore });
    } catch (error) {
      firstCandidateError ??= error;
    }
  }
  if (validCandidates.length === 0) {
    if (firstCandidateError instanceof Error) throw firstCandidateError;
    throw new Error("recovery_data_mismatch");
  }

  const greatestActiveScore = Math.max(...validCandidates.map((candidate) => candidate.activeScore));
  const activeCandidates = validCandidates.filter((candidate) =>
    candidate.activeScore === greatestActiveScore && greatestActiveScore > 0
  );
  if (activeCandidates.length > 1) throw new Error("recovery_review_ambiguous");
  const selected = activeCandidates[0] ?? validCandidates[0]!;
  const { reviewPath, review } = selected;

  return {
    reviewPath,
    trackerPath,
    jobsPath,
    chinaJobsPath,
    chinaOutreachPath,
    port: 64440,
    applicationCount: review.applications.length,
    applicationIds: review.applications.map((application) => application.applicationId),
    liveAtsState: "unverified"
  };
}

function validateRecoveryCandidate(
  review: Awaited<ReturnType<typeof readReviewBatch>>,
  tracker: Awaited<ReturnType<typeof readApplicationTracker>>,
  jobs: Awaited<ReturnType<typeof readJobLibrary>>,
  separateResumeCategory = false
): void {
  for (const reviewItem of review.applications) {
    const trackerMatches = tracker.applications.filter(
      (application) => application.applicationId === reviewItem.applicationId
    );
    if (trackerMatches.length !== 1) throw new Error("recovery_data_mismatch");
    const application = trackerMatches[0]!;
    if (
      application.company !== reviewItem.company ||
      application.title !== reviewItem.title ||
      application.location !== reviewItem.location ||
      application.category !== reviewItem.category ||
      application.ats !== reviewItem.ats ||
      application.cvFilename !== reviewItem.cv.filename ||
      normalizeOfficialUrl(application.jobUrl) !== normalizeOfficialUrl(reviewItem.officialUrl) ||
      !reviewItem.applicationUrl ||
      reviewItem.applicationUrl !== application.applicationUrl
    ) throw new Error("recovery_data_mismatch");

    const jobMatches = jobs.filter((job) => job.jobId === application.jobId);
    if (jobMatches.length !== 1) throw new Error("recovery_data_mismatch");
    const job = jobMatches[0]!;
    if (
      (!separateResumeCategory && job.category !== application.category) ||
      normalizeOfficialUrl(job.officialUrl) !== normalizeOfficialUrl(application.jobUrl)
    ) throw new Error("recovery_data_mismatch");
  }
}
