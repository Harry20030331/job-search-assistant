import { lstat, mkdtemp, readFile, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  consumeApproval,
  createReviewBatch,
  decideReview,
  invalidateSnapshot,
  markFullContentsViewed,
  markOpened,
  readReviewBatch,
  publishReviewItem,
  resolveQuestion,
  selectQuestionOption,
  setReviewApplicationUrl,
  verifyDesiredStateApplied,
  type ReviewBatch
} from "./reviewStore.js";

const liveSnapshotA = `sha256:${"a".repeat(64)}`;
const liveSnapshotB = `sha256:${"b".repeat(64)}`;

async function reviewPath() {
  const directory = await mkdtemp(join(tmpdir(), "application-review-"));
  return join(directory, "review.local.json");
}

function validBatch(): ReviewBatch {
  return {
    schemaVersion: 1 as const,
    batchId: "2026-08-07-weekly",
    createdAt: "2026-08-07T18:00:00.000Z",
    applications: [{
      applicationId: "notion-85947779",
      snapshotId: "sha256:current",
      company: "Notion",
      title: "Software Engineer, Early Career (AI)",
      officialUrl: "https://jobs.ashbyhq.com/notion/85947779-6b87-466a-98bc-30a640448c28",
      ats: "ashby",
      category: "llm" as const,
      location: "San Francisco, CA",
      cv: { filename: "example_cv_llm.pdf", verified: true },
      answers: [{ label: "Sponsorship now or future", value: "Yes", kind: "deterministic" as const }],
      consents: [{ label: "Privacy notice", value: "Accepted", required: true }],
      questions: [],
      validationErrors: [],
      friction: [],
      snapshotCurrent: true,
      preparedAt: "2026-08-07T18:00:00.000Z",
      decision: { state: "pending" as const }
    }]
  };
}

function enumeratedBatch(): ReviewBatch {
  const batch = validBatch();
  batch.applications[0]!.questions = [{
    id: "pwc-history",
    prompt: "Have you ever worked for PricewaterhouseCoopers (PwC)?",
    required: true,
    options: [
      { id: "yes", label: "Yes" },
      { id: "no", label: "No" }
    ],
    recommendedOptionId: "no",
    recommendationSource: "Confirmed personal fact",
    selectedOptionId: "no"
  }];
  batch.applications[0]!.desiredState = { revision: 1, syncState: "pending" };
  return batch;
}

describe("review store", () => {
  test("preserves the exact live application URL", async () => {
    const path = await reviewPath();
    const batch = validBatch();
    batch.applications[0]!.applicationUrl =
      "https://jobs.ashbyhq.com/notion/85947779-6b87-466a-98bc-30a640448c28/application";
    await createReviewBatch(path, batch);

    expect((await readReviewBatch(path)).applications[0]).toMatchObject({
      applicationUrl: "https://jobs.ashbyhq.com/notion/85947779-6b87-466a-98bc-30a640448c28/application"
    });
  });

  test("keeps legacy review items without an application URL readable", async () => {
    const path = await reviewPath();
    await createReviewBatch(path, validBatch());

    expect((await readReviewBatch(path)).applications[0]).not.toHaveProperty("applicationUrl");
  });

  test("reads optional enumerated choices and desired state while keeping historical records readable", async () => {
    const enumeratedPath = await reviewPath();
    await createReviewBatch(enumeratedPath, enumeratedBatch());
    expect((await readReviewBatch(enumeratedPath)).applications[0]).toMatchObject({
      questions: [{
        options: [{ id: "yes", label: "Yes" }, { id: "no", label: "No" }],
        recommendedOptionId: "no",
        recommendationSource: "Confirmed personal fact",
        selectedOptionId: "no"
      }],
      desiredState: { revision: 1, syncState: "pending" }
    });

    const historicalPath = await reviewPath();
    await createReviewBatch(historicalPath, validBatch());
    expect((await readReviewBatch(historicalPath)).applications[0]).not.toHaveProperty("desiredState");
  });

  test("rejects canonical questions from a pending audit batch", async () => {
    const path = await reviewPath();
    const batch = enumeratedBatch();
    batch.applications[0]!.questions[0]!.recommendationSource =
      "Canonical U.S. work-authorization answer";

    await expect(createReviewBatch(path, batch)).rejects.toThrow("invalid_review_batch");
  });

  test("keeps approved historical canonical questions readable", async () => {
    const path = await reviewPath();
    const batch = enumeratedBatch();
    batch.applications[0]!.questions[0]!.recommendationSource =
      "Canonical U.S. work-authorization answer";
    batch.applications[0]!.decision = {
      state: "approved",
      decidedAt: "2026-08-07T18:03:00.000Z",
      desiredRevision: 1
    };

    await createReviewBatch(path, batch);

    expect((await readReviewBatch(path)).applications[0]!.questions[0]).toMatchObject({
      recommendationSource: "Canonical U.S. work-authorization answer"
    });
  });

  test("stores provenance on deterministic answers", async () => {
    const path = await reviewPath();
    const batch = validBatch();
    Object.assign(batch.applications[0]!.answers[0]!, {
      source: "Canonical candidate profile"
    });

    await createReviewBatch(path, batch);

    expect((await readReviewBatch(path)).applications[0]!.answers[0]).toMatchObject({
      source: "Canonical candidate profile"
    });
  });

  test.each([
    ["unknown selected option", { selectedOptionId: "maybe" }],
    ["unknown recommendation", { recommendedOptionId: "maybe" }],
    ["duplicate option IDs", { options: [{ id: "no", label: "No" }, { id: "no", label: "Still no" }] }]
  ])("rejects malformed enumerated questions: %s", async (_label, change) => {
    const path = await reviewPath();
    const batch = enumeratedBatch();
    Object.assign(batch.applications[0]!.questions[0]!, change);
    await expect(createReviewBatch(path, batch)).rejects.toThrow("invalid_review_batch");
  });

  test("keeps free-form resolutions readable but rejects resolution on enumerated questions", async () => {
    const legacyPath = await reviewPath();
    const legacy = validBatch();
    legacy.applications[0]!.questions = [{
      id: "start-date",
      prompt: "When can you start?",
      required: true,
      resolution: "Confirm with recruiter"
    }];
    await createReviewBatch(legacyPath, legacy);
    expect((await readReviewBatch(legacyPath)).applications[0]!.questions[0]!.resolution)
      .toBe("Confirm with recruiter");

    const enumeratedPath = await reviewPath();
    const enumerated = enumeratedBatch();
    enumerated.applications[0]!.questions[0]!.resolution = "No";
    await expect(createReviewBatch(enumeratedPath, enumerated))
      .rejects.toThrow("invalid_review_batch");
    await writeFile(enumeratedPath, JSON.stringify(enumerated), { mode: 0o600 });
    await expect(readReviewBatch(enumeratedPath)).rejects.toThrow("invalid_review_batch");
  });

  test("refuses the free-form mutation path for an enumerated question", async () => {
    const path = await reviewPath();
    await createReviewBatch(path, enumeratedBatch());
    const before = await readFile(path, "utf8");

    await expect(resolveQuestion(
      path, "notion-85947779", "sha256:current", "pwc-history", "No"
    )).rejects.toThrow("invalid_question_resolution");
    expect(await readFile(path, "utf8")).toBe(before);
  });

  test("rejects malformed desired-state records", async () => {
    const path = await reviewPath();
    const batch = enumeratedBatch();
    batch.applications[0]!.desiredState = { revision: 0, syncState: "pending" };
    await expect(createReviewBatch(path, batch)).rejects.toThrow("invalid_review_batch");

    const unsafePath = await reviewPath();
    const unsafe = enumeratedBatch();
    unsafe.applications[0]!.desiredState = {
      revision: Number.MAX_SAFE_INTEGER + 1,
      syncState: "pending"
    };
    await expect(createReviewBatch(unsafePath, unsafe)).rejects.toThrow("invalid_review_batch");
  });

  test("fails closed instead of overflowing the desired revision", async () => {
    const path = await reviewPath();
    const batch = enumeratedBatch();
    batch.applications[0]!.desiredState = {
      revision: Number.MAX_SAFE_INTEGER,
      syncState: "pending"
    };
    await createReviewBatch(path, batch);
    const before = await readFile(path, "utf8");

    await expect(selectQuestionOption(
      path, "notion-85947779", "sha256:current", "pwc-history", "yes"
    )).rejects.toThrow("desired_state_revision_overflow");
    expect(await readFile(path, "utf8")).toBe(before);
  });

  test("requires selected enumerated answers and desired state to exist together", async () => {
    const selectionOnlyPath = await reviewPath();
    const selectionOnly = enumeratedBatch();
    delete selectionOnly.applications[0]!.desiredState;
    await expect(createReviewBatch(selectionOnlyPath, selectionOnly))
      .rejects.toThrow("invalid_review_batch");

    const desiredOnlyPath = await reviewPath();
    const desiredOnly = enumeratedBatch();
    delete desiredOnly.applications[0]!.questions[0]!.selectedOptionId;
    await expect(createReviewBatch(desiredOnlyPath, desiredOnly))
      .rejects.toThrow("invalid_review_batch");
  });

  test("approval and consumption reject a hand-written selection without desired-state binding", async () => {
    const approvalPath = await reviewPath();
    const approvalBatch = enumeratedBatch();
    const approvalItem = approvalBatch.applications[0]!;
    delete approvalItem.desiredState;
    approvalItem.openedAt = "2026-08-07T18:01:00.000Z";
    approvalItem.fullContentsViewedAt = "2026-08-07T18:02:00.000Z";
    await writeFile(approvalPath, JSON.stringify(approvalBatch), { mode: 0o600 });
    await expect(decideReview(
      approvalPath, "notion-85947779", "sha256:current", "approved"
    )).rejects.toThrow();

    const consumptionPath = await reviewPath();
    const consumptionBatch = enumeratedBatch();
    const consumptionItem = consumptionBatch.applications[0]!;
    delete consumptionItem.desiredState;
    consumptionItem.openedAt = "2026-08-07T18:01:00.000Z";
    consumptionItem.fullContentsViewedAt = "2026-08-07T18:02:00.000Z";
    consumptionItem.decision = {
      state: "approved",
      decidedAt: "2026-08-07T18:03:00.000Z"
    };
    await writeFile(consumptionPath, JSON.stringify(consumptionBatch), { mode: 0o600 });
    await expect(consumeApproval(
      consumptionPath, "notion-85947779", "sha256:current"
    )).rejects.toThrow();
  });

  test("rejects consumed desired state that was not verified against a distinct live snapshot", async () => {
    const pendingPath = await reviewPath();
    const pendingBatch = enumeratedBatch();
    pendingBatch.applications[0]!.decision = {
      state: "consumed",
      decidedAt: "2026-08-07T18:03:00.000Z",
      consumedAt: "2026-08-07T18:04:00.000Z",
      desiredRevision: 1
    };
    await expect(createReviewBatch(pendingPath, pendingBatch)).rejects.toThrow("invalid_review_batch");

    const sameSnapshotPath = await reviewPath();
    const sameSnapshotBatch = enumeratedBatch();
    sameSnapshotBatch.applications[0]!.desiredState = {
      revision: 1,
      syncState: "verified",
      verifiedAt: "2026-08-07T18:04:00.000Z",
      verifiedLiveSnapshotId: liveSnapshotA
    };
    sameSnapshotBatch.applications[0]!.snapshotId = liveSnapshotA;
    sameSnapshotBatch.applications[0]!.decision = {
      state: "approved",
      decidedAt: "2026-08-07T18:03:00.000Z",
      desiredRevision: 1
    };
    await expect(createReviewBatch(sameSnapshotPath, sameSnapshotBatch))
      .rejects.toThrow("invalid_review_batch");
  });

  test("selects only an exact enumerated option, increments revision, and leaves other applications unchanged", async () => {
    const path = await reviewPath();
    const batch = enumeratedBatch();
    batch.applications.push({
      ...validBatch().applications[0]!,
      applicationId: "linear-123",
      snapshotId: "sha256:linear",
      company: "Linear",
      title: "Software Engineer",
      officialUrl: "https://linear.app/careers/123"
    });
    const untouched = JSON.stringify(batch.applications[1]);
    await createReviewBatch(path, batch);

    const selected = await selectQuestionOption(
      path,
      "notion-85947779",
      "sha256:current",
      "pwc-history",
      "yes"
    );

    expect(selected).toMatchObject({
      questions: [{ id: "pwc-history", selectedOptionId: "yes" }],
      desiredState: { revision: 2, syncState: "pending" },
      decision: { state: "pending" }
    });
    expect(JSON.stringify((await readReviewBatch(path)).applications[1])).toBe(untouched);
  });

  test("rejects free-form and unknown option values without changing persisted state", async () => {
    const path = await reviewPath();
    await createReviewBatch(path, enumeratedBatch());
    const before = await readFile(path, "utf8");

    await expect(selectQuestionOption(
      path, "notion-85947779", "sha256:current", "pwc-history", "No"
    )).rejects.toThrow("review_question_option_not_found");
    await expect(selectQuestionOption(
      path, "notion-85947779", "sha256:current", "pwc-history", "maybe"
    )).rejects.toThrow("review_question_option_not_found");
    await expect(selectQuestionOption(
      path, "notion-85947779", "sha256:current", "missing", "no"
    )).rejects.toThrow("review_question_not_found");
    expect(await readFile(path, "utf8")).toBe(before);
  });

  test("keeps an identical selected option idempotent without rewriting the file", async () => {
    const path = await reviewPath();
    await createReviewBatch(path, enumeratedBatch());
    const beforeContents = await readFile(path, "utf8");
    const beforeStat = await stat(path, { bigint: true });

    await selectQuestionOption(path, "notion-85947779", "sha256:current", "pwc-history", "no");

    const afterStat = await stat(path, { bigint: true });
    expect(await readFile(path, "utf8")).toBe(beforeContents);
    expect(afterStat.ino).toBe(beforeStat.ino);
    expect(afterStat.mtimeNs).toBe(beforeStat.mtimeNs);
  });

  test("preserves review gates when an exact option changes", async () => {
    const path = await reviewPath();
    const batch = enumeratedBatch();
    batch.applications[0]!.openedAt = "2026-08-07T18:01:00.000Z";
    batch.applications[0]!.fullContentsViewedAt = "2026-08-07T18:02:00.000Z";
    await createReviewBatch(path, batch);

    await expect(selectQuestionOption(
      path, "notion-85947779", "sha256:current", "pwc-history", "yes"
    )).resolves.toMatchObject({
      openedAt: "2026-08-07T18:01:00.000Z",
      fullContentsViewedAt: "2026-08-07T18:02:00.000Z",
      snapshotCurrent: true
    });
  });

  test("allows only the current pending review to edit a selected option", async () => {
    const stalePath = await reviewPath();
    await createReviewBatch(stalePath, enumeratedBatch());
    await expect(selectQuestionOption(
      stalePath, "notion-85947779", "sha256:old", "pwc-history", "yes"
    )).rejects.toThrow("review_snapshot_mismatch");
    await invalidateSnapshot(stalePath, "notion-85947779", "sha256:changed");
    await expect(selectQuestionOption(
      stalePath, "notion-85947779", "sha256:changed", "pwc-history", "yes"
    )).rejects.toThrow("review_snapshot_mismatch");

    for (const decision of [
      { state: "approved", decidedAt: "2026-08-07T18:03:00.000Z", desiredRevision: 1 },
      { state: "skipped", decidedAt: "2026-08-07T18:03:00.000Z" },
      {
        state: "consumed",
        decidedAt: "2026-08-07T18:03:00.000Z",
        consumedAt: "2026-08-07T18:04:00.000Z",
        desiredRevision: 1
      }
    ] as const) {
      const path = await reviewPath();
      const batch = enumeratedBatch();
      if (decision.state === "consumed") {
        batch.applications[0]!.desiredState = {
          revision: 1,
          syncState: "verified",
          verifiedAt: "2026-08-07T18:03:30.000Z",
          verifiedLiveSnapshotId: liveSnapshotA
        };
      }
      batch.applications[0]!.decision = decision;
      await createReviewBatch(path, batch);
      await expect(selectQuestionOption(
        path, "notion-85947779", "sha256:current", "pwc-history", "yes"
      )).rejects.toThrow("approval_not_available");
    }
  });

  test("treats a required selected option as complete and seals the current desired revision", async () => {
    const path = await reviewPath();
    await createReviewBatch(path, enumeratedBatch());
    await markOpened(path, "notion-85947779", "sha256:current", "2026-08-07T18:01:00.000Z");
    await markFullContentsViewed(path, "notion-85947779", "sha256:current", "2026-08-07T18:02:00.000Z");

    await expect(decideReview(
      path, "notion-85947779", "sha256:current", "approved", "2026-08-07T18:03:00.000Z", 1
    )).resolves.toMatchObject({
      decision: { state: "approved", decidedAt: "2026-08-07T18:03:00.000Z", desiredRevision: 1 }
    });
  });

  test("rejects a missing or stale desired revision and leaves the newer desired state unchanged", async () => {
    const path = await reviewPath();
    await createReviewBatch(path, enumeratedBatch());
    await markOpened(path, "notion-85947779", "sha256:current", "2026-08-07T18:01:00.000Z");
    await markFullContentsViewed(path, "notion-85947779", "sha256:current", "2026-08-07T18:02:00.000Z");
    await selectQuestionOption(path, "notion-85947779", "sha256:current", "pwc-history", "yes");
    const before = await readFile(path, "utf8");
    const approve = decideReview as unknown as (
      path: string,
      applicationId: string,
      snapshotId: string,
      decision: "approved",
      now: string,
      expectedDesiredRevision?: number
    ) => Promise<unknown>;

    await expect(approve(
      path, "notion-85947779", "sha256:current", "approved", "2026-08-07T18:03:00.000Z"
    )).rejects.toThrow("desired_revision_mismatch");
    expect(await readFile(path, "utf8")).toBe(before);

    await expect(approve(
      path, "notion-85947779", "sha256:current", "approved", "2026-08-07T18:03:00.000Z", 1
    )).rejects.toThrow("desired_revision_mismatch");
    expect(await readFile(path, "utf8")).toBe(before);

    await expect(approve(
      path, "notion-85947779", "sha256:current", "approved", "2026-08-07T18:03:00.000Z", 2
    )).resolves.toMatchObject({ decision: { state: "approved", desiredRevision: 2 } });
  });

  test("requires desired-state synchronization before consuming its approval", async () => {
    const path = await reviewPath();
    await createReviewBatch(path, enumeratedBatch());
    await markOpened(path, "notion-85947779", "sha256:current", "2026-08-07T18:01:00.000Z");
    await markFullContentsViewed(path, "notion-85947779", "sha256:current", "2026-08-07T18:02:00.000Z");
    await decideReview(
      path, "notion-85947779", "sha256:current", "approved", "2026-08-07T18:03:00.000Z", 1
    );

    await expect(consumeApproval(path, "notion-85947779", "sha256:current"))
      .rejects.toThrow("desired_state_sync_required");
  });

  test("verifies only the exact approved desired revision against a distinct live snapshot", async () => {
    const path = await reviewPath();
    await createReviewBatch(path, enumeratedBatch());
    await markOpened(path, "notion-85947779", "sha256:current", "2026-08-07T18:01:00.000Z");
    await markFullContentsViewed(path, "notion-85947779", "sha256:current", "2026-08-07T18:02:00.000Z");
    await decideReview(
      path, "notion-85947779", "sha256:current", "approved", "2026-08-07T18:03:00.000Z", 1
    );

    await expect(verifyDesiredStateApplied(
      path,
      "notion-85947779",
      "sha256:current",
      1,
      liveSnapshotA,
      "2026-08-07T18:04:00.000Z"
    )).resolves.toMatchObject({
      desiredState: {
        revision: 1,
        syncState: "verified",
        verifiedAt: "2026-08-07T18:04:00.000Z",
        verifiedLiveSnapshotId: liveSnapshotA
      },
      decision: { state: "approved", desiredRevision: 1 }
    });
  });

  test.each([
    " ",
    "live-snapshot",
    "sha256:abc",
    `sha256:${"a".repeat(63)}`,
    ` ${liveSnapshotA}`,
    `${liveSnapshotA} `
  ])("rejects malformed live snapshot verification identity: %s", async (liveSnapshotId) => {
    const path = await reviewPath();
    await createReviewBatch(path, enumeratedBatch());
    await markOpened(path, "notion-85947779", "sha256:current", "2026-08-07T18:01:00.000Z");
    await markFullContentsViewed(path, "notion-85947779", "sha256:current", "2026-08-07T18:02:00.000Z");
    await decideReview(
      path, "notion-85947779", "sha256:current", "approved", "2026-08-07T18:03:00.000Z", 1
    );
    const before = await readFile(path, "utf8");

    await expect(verifyDesiredStateApplied(
      path, "notion-85947779", "sha256:current", 1, liveSnapshotId, "2026-08-07T18:04:00.000Z"
    )).rejects.toThrow("desired_state_live_snapshot_required");
    expect(await readFile(path, "utf8")).toBe(before);
  });

  test("accepts uppercase snapshot hex but prevents cross-application evidence reuse", async () => {
    const path = await reviewPath();
    const batch = enumeratedBatch();
    const second = structuredClone(batch.applications[0]!);
    second.applicationId = "linear-123";
    second.snapshotId = "sha256:linear";
    second.company = "Linear";
    second.title = "Software Engineer";
    second.officialUrl = "https://linear.app/careers/123";
    batch.applications.push(second);
    await createReviewBatch(path, batch);
    for (const [applicationId, snapshotId] of [
      ["notion-85947779", "sha256:current"],
      ["linear-123", "sha256:linear"]
    ] as const) {
      await markOpened(path, applicationId, snapshotId, "2026-08-07T18:01:00.000Z");
      await markFullContentsViewed(path, applicationId, snapshotId, "2026-08-07T18:02:00.000Z");
      await decideReview(path, applicationId, snapshotId, "approved", "2026-08-07T18:03:00.000Z", 1);
    }
    const uppercaseIdentity = liveSnapshotA.toUpperCase().replace("SHA256:", "sha256:");
    await verifyDesiredStateApplied(
      path, "notion-85947779", "sha256:current", 1, uppercaseIdentity, "2026-08-07T18:04:00.000Z"
    );

    await expect(verifyDesiredStateApplied(
      path, "linear-123", "sha256:linear", 1, liveSnapshotA, "2026-08-07T18:04:00.000Z"
    )).rejects.toThrow("desired_state_live_snapshot_reused");
    await expect(verifyDesiredStateApplied(
      path, "linear-123", "sha256:linear", 1, liveSnapshotB, "2026-08-07T18:04:00.000Z"
    )).resolves.toMatchObject({
      desiredState: { syncState: "verified", verifiedLiveSnapshotId: liveSnapshotB }
    });
  });

  test("rejects persisted reuse of live snapshot evidence across applications", async () => {
    const path = await reviewPath();
    const batch = enumeratedBatch();
    const first = batch.applications[0]!;
    first.decision = {
      state: "approved",
      decidedAt: "2026-08-07T18:03:00.000Z",
      desiredRevision: 1
    };
    first.desiredState = {
      revision: 1,
      syncState: "verified",
      verifiedAt: "2026-08-07T18:04:00.000Z",
      verifiedLiveSnapshotId: liveSnapshotA
    };
    const second = structuredClone(first);
    second.applicationId = "linear-123";
    second.snapshotId = "sha256:linear";
    second.company = "Linear";
    second.title = "Software Engineer";
    second.officialUrl = "https://linear.app/careers/123";
    second.desiredState = {
      revision: 1,
      syncState: "verified",
      verifiedAt: "2026-08-07T18:04:00.000Z",
      verifiedLiveSnapshotId: liveSnapshotA.toUpperCase().replace("SHA256:", "sha256:")
    };
    batch.applications.push(second);

    await expect(createReviewBatch(path, batch)).rejects.toThrow("invalid_review_batch");
  });

  test("rejects proposed live evidence that matches another application's review snapshot", async () => {
    const path = await reviewPath();
    const batch = enumeratedBatch();
    batch.applications.push({
      ...validBatch().applications[0]!,
      applicationId: "linear-123",
      snapshotId: liveSnapshotA,
      company: "Linear",
      title: "Software Engineer",
      officialUrl: "https://linear.app/careers/123"
    });
    await createReviewBatch(path, batch);
    await markOpened(path, "notion-85947779", "sha256:current", "2026-08-07T18:01:00.000Z");
    await markFullContentsViewed(
      path, "notion-85947779", "sha256:current", "2026-08-07T18:02:00.000Z"
    );
    await decideReview(
      path, "notion-85947779", "sha256:current", "approved", "2026-08-07T18:03:00.000Z", 1
    );

    await expect(verifyDesiredStateApplied(
      path,
      "notion-85947779",
      "sha256:current",
      1,
      liveSnapshotA.toUpperCase().replace("SHA256:", "sha256:"),
      "2026-08-07T18:04:00.000Z"
    )).rejects.toThrow("desired_state_live_snapshot_required");
  });

  test("rejects persisted live evidence matching any application's review snapshot", async () => {
    const path = await reviewPath();
    const batch = enumeratedBatch();
    const first = batch.applications[0]!;
    first.decision = {
      state: "approved",
      decidedAt: "2026-08-07T18:03:00.000Z",
      desiredRevision: 1
    };
    first.desiredState = {
      revision: 1,
      syncState: "verified",
      verifiedAt: "2026-08-07T18:04:00.000Z",
      verifiedLiveSnapshotId: liveSnapshotA
    };
    batch.applications.push({
      ...validBatch().applications[0]!,
      applicationId: "linear-123",
      snapshotId: liveSnapshotA.toUpperCase().replace("SHA256:", "sha256:"),
      company: "Linear",
      title: "Software Engineer",
      officialUrl: "https://linear.app/careers/123"
    });

    await expect(createReviewBatch(path, batch)).rejects.toThrow("invalid_review_batch");
    await writeFile(path, JSON.stringify(batch), { mode: 0o600 });
    await expect(readReviewBatch(path)).rejects.toThrow("invalid_review_batch");
  });

  test("rejects backdated verification and consumption mutations", async () => {
    const desiredPath = await reviewPath();
    await createReviewBatch(desiredPath, enumeratedBatch());
    await markOpened(desiredPath, "notion-85947779", "sha256:current", "2026-08-07T18:01:00.000Z");
    await markFullContentsViewed(
      desiredPath, "notion-85947779", "sha256:current", "2026-08-07T18:02:00.000Z"
    );
    await decideReview(
      desiredPath, "notion-85947779", "sha256:current", "approved", "2026-08-07T18:03:00.000Z", 1
    );
    await expect(verifyDesiredStateApplied(
      desiredPath, "notion-85947779", "sha256:current", 1, liveSnapshotA, "2026-08-07T18:02:59.000Z"
    )).rejects.toThrow("invalid_verification_chronology");
    await verifyDesiredStateApplied(
      desiredPath, "notion-85947779", "sha256:current", 1, liveSnapshotA, "2026-08-07T18:04:00.000Z"
    );
    await expect(consumeApproval(
      desiredPath, "notion-85947779", "sha256:current", "2026-08-07T18:03:59.000Z"
    )).rejects.toThrow("invalid_consumption_chronology");

    const legacyPath = await reviewPath();
    const legacy = validBatch();
    legacy.applications[0]!.openedAt = "2026-08-07T18:01:00.000Z";
    legacy.applications[0]!.fullContentsViewedAt = "2026-08-07T18:02:00.000Z";
    legacy.applications[0]!.decision = {
      state: "approved",
      decidedAt: "2026-08-07T18:03:00.000Z"
    };
    await createReviewBatch(legacyPath, legacy);
    await expect(consumeApproval(
      legacyPath, "notion-85947779", "sha256:current", "2026-08-07T18:02:59.000Z"
    )).rejects.toThrow("invalid_consumption_chronology");
  });

  test("rejects persisted backdated verification and consumption audit records", async () => {
    const verifiedPath = await reviewPath();
    const verified = enumeratedBatch();
    verified.applications[0]!.decision = {
      state: "approved",
      decidedAt: "2026-08-07T18:03:00.000Z",
      desiredRevision: 1
    };
    verified.applications[0]!.desiredState = {
      revision: 1,
      syncState: "verified",
      verifiedAt: "2026-08-07T18:02:59.000Z",
      verifiedLiveSnapshotId: liveSnapshotA
    };
    await expect(createReviewBatch(verifiedPath, verified)).rejects.toThrow("invalid_review_batch");

    const consumedPath = await reviewPath();
    const consumed = validBatch();
    consumed.applications[0]!.decision = {
      state: "consumed",
      decidedAt: "2026-08-07T18:03:00.000Z",
      consumedAt: "2026-08-07T18:02:59.000Z"
    };
    await expect(createReviewBatch(consumedPath, consumed)).rejects.toThrow("invalid_review_batch");

    const desiredConsumedPath = await reviewPath();
    const desiredConsumed = enumeratedBatch();
    desiredConsumed.applications[0]!.decision = {
      state: "consumed",
      decidedAt: "2026-08-07T18:03:00.000Z",
      consumedAt: "2026-08-07T18:03:59.000Z",
      desiredRevision: 1
    };
    desiredConsumed.applications[0]!.desiredState = {
      revision: 1,
      syncState: "verified",
      verifiedAt: "2026-08-07T18:04:00.000Z",
      verifiedLiveSnapshotId: liveSnapshotA
    };
    await expect(createReviewBatch(desiredConsumedPath, desiredConsumed))
      .rejects.toThrow("invalid_review_batch");
  });

  test.each([
    ["open before preparation", {
      openedAt: "2026-08-07T17:59:59.000Z"
    }],
    ["view before open", {
      openedAt: "2026-08-07T18:01:00.000Z",
      fullContentsViewedAt: "2026-08-07T18:00:59.000Z"
    }],
    ["decision before full view", {
      openedAt: "2026-08-07T18:01:00.000Z",
      fullContentsViewedAt: "2026-08-07T18:02:00.000Z",
      decision: { state: "skipped", decidedAt: "2026-08-07T18:01:59.000Z" }
    }]
  ])("rejects persisted audit chronology: %s", async (_label, change) => {
    const path = await reviewPath();
    const batch = validBatch();
    Object.assign(batch.applications[0]!, change);

    await expect(createReviewBatch(path, batch)).rejects.toThrow("invalid_review_batch");
    await writeFile(path, JSON.stringify(batch), { mode: 0o600 });
    await expect(readReviewBatch(path)).rejects.toThrow("invalid_review_batch");
  });

  test("rejects backdated open, full-view, and decision mutations without rewriting", async () => {
    const path = await reviewPath();
    await createReviewBatch(path, validBatch());
    const prepared = await readFile(path, "utf8");
    await expect(markOpened(
      path, "notion-85947779", "sha256:current", "2026-08-07T17:59:59.000Z"
    )).rejects.toThrow("invalid_opened_chronology");
    expect(await readFile(path, "utf8")).toBe(prepared);

    await markOpened(path, "notion-85947779", "sha256:current", "2026-08-07T18:01:00.000Z");
    const opened = await readFile(path, "utf8");
    await expect(markFullContentsViewed(
      path, "notion-85947779", "sha256:current", "2026-08-07T18:00:59.000Z"
    )).rejects.toThrow("invalid_full_view_chronology");
    expect(await readFile(path, "utf8")).toBe(opened);

    await markFullContentsViewed(
      path, "notion-85947779", "sha256:current", "2026-08-07T18:02:00.000Z"
    );
    const viewed = await readFile(path, "utf8");
    await expect(decideReview(
      path, "notion-85947779", "sha256:current", "approved", "2026-08-07T18:01:59.000Z"
    )).rejects.toThrow("invalid_decision_chronology");
    expect(await readFile(path, "utf8")).toBe(viewed);
  });

  test("rejects unapproved, mismatched, cross-application, or non-distinct desired-state verification", async () => {
    const unapprovedPath = await reviewPath();
    await createReviewBatch(unapprovedPath, enumeratedBatch());
    await expect(verifyDesiredStateApplied(
      unapprovedPath, "notion-85947779", "sha256:current", 1, liveSnapshotA
    )).rejects.toThrow("approval_not_available");

    const path = await reviewPath();
    const batch = enumeratedBatch();
    batch.applications.push({
      ...validBatch().applications[0]!,
      applicationId: "linear-123",
      snapshotId: "sha256:linear",
      company: "Linear",
      title: "Software Engineer",
      officialUrl: "https://linear.app/careers/123"
    });
    await createReviewBatch(path, batch);
    await markOpened(path, "notion-85947779", "sha256:current", "2026-08-07T18:01:00.000Z");
    await markFullContentsViewed(path, "notion-85947779", "sha256:current", "2026-08-07T18:02:00.000Z");
    await decideReview(
      path, "notion-85947779", "sha256:current", "approved", "2026-08-07T18:03:00.000Z", 1
    );

    await expect(verifyDesiredStateApplied(
      path, "notion-85947779", "sha256:current", 2, liveSnapshotA
    )).rejects.toThrow("desired_state_revision_mismatch");
    await expect(verifyDesiredStateApplied(
      path, "linear-123", "sha256:linear", 1, liveSnapshotA
    )).rejects.toThrow("approval_not_available");
    await expect(verifyDesiredStateApplied(
      path, "notion-85947779", "sha256:current", 1, "sha256:current"
    )).rejects.toThrow("desired_state_live_snapshot_required");
  });

  test("keeps exact verification idempotent, then consumes the approval once", async () => {
    const path = await reviewPath();
    await createReviewBatch(path, enumeratedBatch());
    await markOpened(path, "notion-85947779", "sha256:current", "2026-08-07T18:01:00.000Z");
    await markFullContentsViewed(path, "notion-85947779", "sha256:current", "2026-08-07T18:02:00.000Z");
    await decideReview(
      path, "notion-85947779", "sha256:current", "approved", "2026-08-07T18:03:00.000Z", 1
    );
    await verifyDesiredStateApplied(
      path, "notion-85947779", "sha256:current", 1, liveSnapshotA, "2026-08-07T18:04:00.000Z"
    );
    const before = await readFile(path, "utf8");
    await verifyDesiredStateApplied(
      path, "notion-85947779", "sha256:current", 1, liveSnapshotA, "2026-08-07T19:04:00.000Z"
    );
    expect(await readFile(path, "utf8")).toBe(before);

    await expect(consumeApproval(
      path, "notion-85947779", "sha256:current", "2026-08-07T18:05:00.000Z"
    )).resolves.toMatchObject({
      decision: {
        state: "consumed",
        desiredRevision: 1,
        consumedAt: "2026-08-07T18:05:00.000Z"
      }
    });
    await expect(consumeApproval(path, "notion-85947779", "sha256:current"))
      .rejects.toThrow("approval_not_available");
  });

  test("invalidating an unconsumed verified snapshot clears its live verification", async () => {
    const path = await reviewPath();
    await createReviewBatch(path, enumeratedBatch());
    await markOpened(path, "notion-85947779", "sha256:current", "2026-08-07T18:01:00.000Z");
    await markFullContentsViewed(path, "notion-85947779", "sha256:current", "2026-08-07T18:02:00.000Z");
    await decideReview(
      path, "notion-85947779", "sha256:current", "approved", "2026-08-07T18:03:00.000Z", 1
    );
    await verifyDesiredStateApplied(
      path, "notion-85947779", "sha256:current", 1, liveSnapshotA, "2026-08-07T18:04:00.000Z"
    );

    await expect(invalidateSnapshot(path, "notion-85947779", "sha256:changed"))
      .resolves.toMatchObject({
        snapshotId: "sha256:changed",
        snapshotCurrent: false,
        decision: { state: "stale" },
        desiredState: { revision: 1, syncState: "pending" }
      });
    expect((await readReviewBatch(path)).applications[0]!.desiredState)
      .not.toHaveProperty("verifiedLiveSnapshotId");
  });

  test("updates only the exact matching review item application URL", async () => {
    const path = await reviewPath();
    const batch = validBatch();
    batch.applications.push({
      ...batch.applications[0]!,
      applicationId: "linear-123",
      snapshotId: "sha256:linear",
      company: "Linear",
      title: "Software Engineer",
      officialUrl: "https://linear.app/careers/123"
    });
    const untouched = structuredClone(batch.applications[1]);
    await createReviewBatch(path, batch);

    await setReviewApplicationUrl(
      path,
      "notion-85947779",
      "sha256:current",
      "https://jobs.ashbyhq.com/notion/85947779-6b87-466a-98bc-30a640448c28/application"
    );

    const stored = await readReviewBatch(path);
    expect(stored.applications[0]?.applicationUrl)
      .toBe("https://jobs.ashbyhq.com/notion/85947779-6b87-466a-98bc-30a640448c28/application");
    expect(stored.applications[1]).toEqual(untouched);
  });

  test.each([
    "http://jobs.ashbyhq.com/notion/85947779/application",
    "not a URL"
  ])("rejects an invalid exact application URL: %s", async (applicationUrl) => {
    const path = await reviewPath();
    await createReviewBatch(path, validBatch());

    await expect(setReviewApplicationUrl(
      path,
      "notion-85947779",
      "sha256:current",
      applicationUrl
    )).rejects.toThrow();
    expect((await readReviewBatch(path)).applications[0]).not.toHaveProperty("applicationUrl");
  });

  test("rejects wrong and stale snapshot identifiers when updating the application URL", async () => {
    const path = await reviewPath();
    await createReviewBatch(path, validBatch());

    await expect(setReviewApplicationUrl(
      path,
      "notion-85947779",
      "sha256:wrong",
      "https://jobs.ashbyhq.com/notion/85947779/application"
    )).rejects.toThrow("review_snapshot_mismatch");

    await invalidateSnapshot(path, "notion-85947779", "sha256:changed");
    await expect(setReviewApplicationUrl(
      path,
      "notion-85947779",
      "sha256:current",
      "https://jobs.ashbyhq.com/notion/85947779/application"
    )).rejects.toThrow("review_snapshot_mismatch");
    await expect(setReviewApplicationUrl(
      path,
      "notion-85947779",
      "sha256:changed",
      "https://jobs.ashbyhq.com/notion/85947779/application"
    )).rejects.toThrow("review_snapshot_mismatch");
  });

  test("keeps an identical approved application URL idempotent and rejects a material change", async () => {
    const path = await reviewPath();
    const batch = validBatch();
    const item = batch.applications[0]!;
    item.applicationUrl = "https://jobs.ashbyhq.com/notion/85947779/application";
    item.openedAt = "2026-08-07T18:01:00.000Z";
    item.fullContentsViewedAt = "2026-08-07T18:02:00.000Z";
    item.decision = { state: "approved", decidedAt: "2026-08-07T18:03:00.000Z" };
    await createReviewBatch(path, batch);
    const beforeNoOpContents = await readFile(path, "utf8");
    const beforeNoOpStat = await stat(path, { bigint: true });

    await expect(setReviewApplicationUrl(
      path,
      "notion-85947779",
      "sha256:current",
      "https://jobs.ashbyhq.com/notion/85947779/application"
    )).resolves.toMatchObject({ decision: { state: "approved" } });
    const afterNoOpStat = await stat(path, { bigint: true });
    expect(await readFile(path, "utf8")).toBe(beforeNoOpContents);
    expect(afterNoOpStat.ino).toBe(beforeNoOpStat.ino);
    expect(afterNoOpStat.mtimeNs).toBe(beforeNoOpStat.mtimeNs);

    const before = await readFile(path, "utf8");
    await expect(setReviewApplicationUrl(
      path,
      "notion-85947779",
      "sha256:current",
      "https://jobs.ashbyhq.com/notion/85947779/application?step=review"
    )).rejects.toThrow("review_snapshot_replacement_required");
    expect(await readFile(path, "utf8")).toBe(before);
  });

  test("rejects an application URL change after approval consumption without erasing audit evidence", async () => {
    const path = await reviewPath();
    const batch = validBatch();
    const item = batch.applications[0]!;
    item.applicationUrl = "https://jobs.ashbyhq.com/notion/85947779/application";
    item.openedAt = "2026-08-07T18:01:00.000Z";
    item.fullContentsViewedAt = "2026-08-07T18:02:00.000Z";
    item.decision = {
      state: "consumed",
      decidedAt: "2026-08-07T18:03:00.000Z",
      consumedAt: "2026-08-07T18:04:00.000Z"
    };
    await createReviewBatch(path, batch);
    const before = await readFile(path, "utf8");

    await expect(setReviewApplicationUrl(
      path,
      "notion-85947779",
      "sha256:current",
      "https://jobs.ashbyhq.com/notion/85947779/application?step=review"
    )).rejects.toThrow("review_snapshot_replacement_required");
    expect(await readFile(path, "utf8")).toBe(before);
  });

  test.each([
    ["opened", { openedAt: "2026-08-07T18:01:00.000Z" }],
    ["viewed", { fullContentsViewedAt: "2026-08-07T18:02:00.000Z" }]
  ])("rejects an application URL change when pending $0 evidence exists", async (_label, evidence) => {
    const path = await reviewPath();
    const batch = validBatch();
    Object.assign(batch.applications[0]!, evidence);
    await createReviewBatch(path, batch);
    const before = await readFile(path, "utf8");

    await expect(setReviewApplicationUrl(
      path,
      "notion-85947779",
      "sha256:current",
      "https://jobs.ashbyhq.com/notion/85947779/application"
    )).rejects.toThrow("review_snapshot_replacement_required");
    expect(await readFile(path, "utf8")).toBe(before);
  });

  test("serializes overlapping mutations so updates to two items both persist", async () => {
    const path = await reviewPath();
    const batch = validBatch();
    batch.applications.push({
      ...batch.applications[0]!,
      applicationId: "linear-123",
      snapshotId: "sha256:linear",
      company: "Linear",
      title: "Software Engineer",
      officialUrl: "https://linear.app/careers/123"
    });
    await createReviewBatch(path, batch);

    await Promise.all([
      markOpened(path, "notion-85947779", "sha256:current", "2026-08-07T18:01:00.000Z"),
      setReviewApplicationUrl(
        path,
        "linear-123",
        "sha256:linear",
        "https://linear.app/careers/123/application"
      )
    ]);

    const stored = await readReviewBatch(path);
    expect(stored.applications[0]?.openedAt).toBe("2026-08-07T18:01:00.000Z");
    expect(stored.applications[1]?.applicationUrl).toBe("https://linear.app/careers/123/application");
  });

  test("continues queued mutations after an earlier mutation rejects", async () => {
    const path = await reviewPath();
    await createReviewBatch(path, validBatch());

    const rejected = markOpened(path, "notion-85947779", "sha256:wrong");
    const following = markOpened(
      path,
      "notion-85947779",
      "sha256:current",
      "2026-08-07T18:01:00.000Z"
    );

    await expect(rejected).rejects.toThrow("review_snapshot_mismatch");
    await expect(following).resolves.toMatchObject({ openedAt: "2026-08-07T18:01:00.000Z" });
    expect((await readReviewBatch(path)).applications[0]?.openedAt).toBe("2026-08-07T18:01:00.000Z");
  });

  test("updates the canonical target through a symlink without replacing the alias", async () => {
    const path = await reviewPath();
    const alias = join(dirname(path), "review.alias.json");
    await createReviewBatch(path, validBatch());
    await symlink(path, alias);

    await markOpened(alias, "notion-85947779", "sha256:current", "2026-08-07T18:01:00.000Z");

    expect((await lstat(alias)).isSymbolicLink()).toBe(true);
    expect((await readReviewBatch(path)).applications[0]?.openedAt).toBe("2026-08-07T18:01:00.000Z");
  });

  test("serializes snapshot invalidation with another item mutation without restoring stale approval", async () => {
    const path = await reviewPath();
    const batch = validBatch();
    const first = batch.applications[0]!;
    first.openedAt = "2026-08-07T18:01:00.000Z";
    first.fullContentsViewedAt = "2026-08-07T18:02:00.000Z";
    first.decision = { state: "approved", decidedAt: "2026-08-07T18:03:00.000Z" };
    batch.applications.push({
      ...first,
      applicationId: "linear-123",
      snapshotId: "sha256:linear",
      company: "Linear",
      title: "Software Engineer",
      officialUrl: "https://linear.app/careers/123",
      openedAt: undefined,
      fullContentsViewedAt: undefined,
      decision: { state: "pending" }
    });
    await createReviewBatch(path, batch);

    await Promise.all([
      invalidateSnapshot(path, "notion-85947779", "sha256:changed"),
      markOpened(path, "linear-123", "sha256:linear", "2026-08-07T18:04:00.000Z")
    ]);

    const stored = await readReviewBatch(path);
    expect(stored.applications[0]).toMatchObject({
      snapshotId: "sha256:changed",
      snapshotCurrent: false,
      decision: { state: "stale" }
    });
    expect(stored.applications[1]?.openedAt).toBe("2026-08-07T18:04:00.000Z");
    await expect(decideReview(path, "notion-85947779", "sha256:changed", "approved"))
      .rejects.toThrow("review_snapshot_mismatch");
  });

  test("retains consumed authorization audit when invalidating its snapshot", async () => {
    const path = await reviewPath();
    const batch = validBatch();
    const item = batch.applications[0]!;
    item.openedAt = "2026-08-07T18:01:00.000Z";
    item.fullContentsViewedAt = "2026-08-07T18:02:00.000Z";
    item.decision = {
      state: "consumed",
      decidedAt: "2026-08-07T18:03:00.000Z",
      consumedAt: "2026-08-07T18:04:00.000Z"
    };
    await createReviewBatch(path, batch);

    await invalidateSnapshot(path, "notion-85947779", "sha256:changed");

    const stored = (await readReviewBatch(path)).applications[0]!;
    expect(stored).toMatchObject({
      snapshotId: "sha256:current",
      snapshotCurrent: false,
      openedAt: "2026-08-07T18:01:00.000Z",
      fullContentsViewedAt: "2026-08-07T18:02:00.000Z",
      decision: {
        state: "consumed",
        decidedAt: "2026-08-07T18:03:00.000Z",
        consumedAt: "2026-08-07T18:04:00.000Z"
      }
    });
    await expect(decideReview(path, "notion-85947779", "sha256:current", "approved"))
      .rejects.toThrow("review_snapshot_mismatch");
    await expect(consumeApproval(path, "notion-85947779", "sha256:current"))
      .rejects.toThrow("review_snapshot_mismatch");
    await expect(decideReview(path, "notion-85947779", "sha256:changed", "approved"))
      .rejects.toThrow("review_snapshot_mismatch");
  });

  test.each([
    ["pending with decidedAt", { state: "pending", decidedAt: "2026-08-07T18:03:00.000Z" }],
    ["pending with consumedAt", { state: "pending", consumedAt: "2026-08-07T18:04:00.000Z" }],
    ["approved without decidedAt", { state: "approved" }],
    ["approved with consumedAt", {
      state: "approved",
      decidedAt: "2026-08-07T18:03:00.000Z",
      consumedAt: "2026-08-07T18:04:00.000Z"
    }],
    ["skipped without decidedAt", { state: "skipped" }],
    ["skipped with consumedAt", {
      state: "skipped",
      decidedAt: "2026-08-07T18:03:00.000Z",
      consumedAt: "2026-08-07T18:04:00.000Z"
    }],
    ["stale with decidedAt", { state: "stale", decidedAt: "2026-08-07T18:03:00.000Z" }],
    ["stale with consumedAt", { state: "stale", consumedAt: "2026-08-07T18:04:00.000Z" }],
    ["consumed without decidedAt", { state: "consumed", consumedAt: "2026-08-07T18:04:00.000Z" }],
    ["consumed without consumedAt", { state: "consumed", decidedAt: "2026-08-07T18:03:00.000Z" }]
  ])("rejects contradictory decision state: %s", async (_label, decision) => {
    const path = await reviewPath();
    const batch = validBatch();
    batch.applications[0]!.decision = decision as never;

    await expect(createReviewBatch(path, batch)).rejects.toThrow("invalid_review_batch");
  });

  test("rejects a persisted contradictory decision state when reading", async () => {
    const path = await reviewPath();
    const batch = validBatch();
    batch.applications[0]!.decision = {
      state: "approved",
      consumedAt: "2026-08-07T18:04:00.000Z"
    } as never;
    await writeFile(path, JSON.stringify(batch), "utf8");

    await expect(readReviewBatch(path)).rejects.toThrow("invalid_review_batch");
  });

  test("writes a strict batch atomically with private permissions", async () => {
    const path = await reviewPath();
    await createReviewBatch(path, validBatch());
    expect((await stat(path)).mode & 0o777).toBe(0o600);
    expect((await readReviewBatch(path)).applications[0]?.company).toBe("Notion");
  });

  test("rejects secret-shaped or arbitrary persisted fields", async () => {
    const path = await reviewPath();
    const batch = validBatch();
    await expect(createReviewBatch(path, {
      ...batch,
      applications: [{ ...batch.applications[0], password: "never-store" }]
    } as never)).rejects.toThrow("invalid_review_batch");
  });

  test("requires opening and viewing full contents before approval", async () => {
    const path = await reviewPath();
    await createReviewBatch(path, validBatch());
    await expect(decideReview(path, "notion-85947779", "sha256:current", "approved"))
      .rejects.toThrow("review_gate_incomplete");
    await markOpened(path, "notion-85947779", "sha256:current", "2026-08-07T18:01:00.000Z");
    await expect(decideReview(path, "notion-85947779", "sha256:current", "approved"))
      .rejects.toThrow("review_gate_incomplete");
    await markFullContentsViewed(path, "notion-85947779", "sha256:current", "2026-08-07T18:02:00.000Z");
    await expect(decideReview(path, "notion-85947779", "sha256:current", "approved", "2026-08-07T18:03:00.000Z"))
      .resolves.toMatchObject({ decision: { state: "approved", decidedAt: "2026-08-07T18:03:00.000Z" } });
  });

  test("keeps repeated gate and approval requests idempotent without rewriting audit timestamps", async () => {
    const path = await reviewPath();
    await createReviewBatch(path, validBatch());
    await markOpened(path, "notion-85947779", "sha256:current", "2026-08-07T18:01:00.000Z");
    await markOpened(path, "notion-85947779", "sha256:current", "2026-08-07T19:01:00.000Z");
    await markFullContentsViewed(path, "notion-85947779", "sha256:current", "2026-08-07T18:02:00.000Z");
    await markFullContentsViewed(path, "notion-85947779", "sha256:current", "2026-08-07T19:02:00.000Z");
    await decideReview(path, "notion-85947779", "sha256:current", "approved", "2026-08-07T18:03:00.000Z");
    const approvedContents = await readFile(path, "utf8");
    const approvedStat = await stat(path, { bigint: true });

    await markOpened(path, "notion-85947779", "sha256:current", "2026-08-07T20:01:00.000Z");
    await markFullContentsViewed(path, "notion-85947779", "sha256:current", "2026-08-07T20:02:00.000Z");
    await decideReview(path, "notion-85947779", "sha256:current", "approved", "2026-08-07T20:03:00.000Z");

    const stored = (await readReviewBatch(path)).applications[0]!;
    expect(stored.openedAt).toBe("2026-08-07T18:01:00.000Z");
    expect(stored.fullContentsViewedAt).toBe("2026-08-07T18:02:00.000Z");
    expect(stored.decision).toEqual({ state: "approved", decidedAt: "2026-08-07T18:03:00.000Z" });
    expect(await readFile(path, "utf8")).toBe(approvedContents);
    const repeatedStat = await stat(path, { bigint: true });
    expect(repeatedStat.ino).toBe(approvedStat.ino);
    expect(repeatedStat.mtimeNs).toBe(approvedStat.mtimeNs);
  });

  test("fails closed when a non-pending decision lacks gate evidence or is changed", async () => {
    const path = await reviewPath();
    const batch = validBatch();
    batch.applications[0]!.decision = { state: "skipped", decidedAt: "2026-08-07T18:03:00.000Z" };
    await createReviewBatch(path, batch);
    const before = await readFile(path, "utf8");

    await expect(markOpened(path, "notion-85947779", "sha256:current"))
      .rejects.toThrow("approval_not_available");
    await expect(markFullContentsViewed(path, "notion-85947779", "sha256:current"))
      .rejects.toThrow("approval_not_available");
    await expect(decideReview(path, "notion-85947779", "sha256:current", "approved"))
      .rejects.toThrow("approval_not_available");
    expect(await readFile(path, "utf8")).toBe(before);
  });

  test("resolving a required question invalidates the current snapshot and cannot be replayed", async () => {
    const path = await reviewPath();
    const batch = validBatch();
    batch.applications[0]!.questions = [{ id: "start-date", prompt: "Can you start in July 2027?", required: true }];
    await createReviewBatch(path, batch);

    await expect(resolveQuestion(path, "notion-85947779", "sha256:current", "start-date", "Confirm with recruiter"))
      .resolves.toMatchObject({
        snapshotCurrent: false,
        questions: [{ id: "start-date", resolution: "Confirm with recruiter" }],
        decision: { state: "stale" }
      });
    await expect(decideReview(path, "notion-85947779", "sha256:current", "approved"))
      .rejects.toThrow("review_snapshot_mismatch");
    await expect(resolveQuestion(path, "notion-85947779", "sha256:current", "start-date", "Confirm with recruiter"))
      .rejects.toThrow("review_snapshot_mismatch");
  });

  test("rejects question resolution after review gates have started and preserves the file", async () => {
    const path = await reviewPath();
    const batch = validBatch();
    batch.applications[0]!.questions = [{ id: "start-date", prompt: "Can you start in July 2027?", required: true }];
    await createReviewBatch(path, batch);
    await markOpened(path, "notion-85947779", "sha256:current");
    const before = await readFile(path, "utf8");

    await expect(resolveQuestion(path, "notion-85947779", "sha256:current", "start-date", "Confirm with recruiter"))
      .rejects.toThrow("review_snapshot_replacement_required");
    expect(await readFile(path, "utf8")).toBe(before);
  });

  test.each([
    { state: "approved", decidedAt: "2026-08-07T18:03:00.000Z" },
    { state: "skipped", decidedAt: "2026-08-07T18:03:00.000Z" },
    { state: "stale" },
    {
      state: "consumed",
      decidedAt: "2026-08-07T18:03:00.000Z",
      consumedAt: "2026-08-07T18:04:00.000Z"
    }
  ] as const)("never rewrites a $state decision while resolving a question", async (decision) => {
    const path = await reviewPath();
    const batch = validBatch();
    batch.applications[0]!.questions = [{ id: "start-date", prompt: "Can you start in July 2027?", required: true }];
    batch.applications[0]!.decision = decision;
    await createReviewBatch(path, batch);
    const before = await readFile(path, "utf8");

    await expect(resolveQuestion(path, "notion-85947779", "sha256:current", "start-date", "Confirm with recruiter"))
      .rejects.toThrow("approval_not_available");
    expect(await readFile(path, "utf8")).toBe(before);
  });

  test("binds decisions to the exact current snapshot", async () => {
    const path = await reviewPath();
    await createReviewBatch(path, validBatch());
    await expect(markOpened(path, "notion-85947779", "sha256:old"))
      .rejects.toThrow("review_snapshot_mismatch");
    await markOpened(path, "notion-85947779", "sha256:current");
    await markFullContentsViewed(path, "notion-85947779", "sha256:current");
    await invalidateSnapshot(path, "notion-85947779", "sha256:changed");
    await expect(decideReview(path, "notion-85947779", "sha256:current", "approved"))
      .rejects.toThrow("review_snapshot_mismatch");
  });

  test("consumes an exact approval at most once", async () => {
    const path = await reviewPath();
    await createReviewBatch(path, validBatch());
    await markOpened(path, "notion-85947779", "sha256:current", "2026-08-07T18:01:00.000Z");
    await markFullContentsViewed(path, "notion-85947779", "sha256:current", "2026-08-07T18:02:00.000Z");
    await decideReview(
      path, "notion-85947779", "sha256:current", "approved", "2026-08-07T18:03:00.000Z"
    );
    await expect(consumeApproval(path, "notion-85947779", "sha256:current", "2026-08-07T18:04:00.000Z"))
      .resolves.toMatchObject({ decision: { state: "consumed", consumedAt: "2026-08-07T18:04:00.000Z" } });
    await expect(consumeApproval(path, "notion-85947779", "sha256:current"))
      .rejects.toThrow("approval_not_available");
    expect(JSON.parse(await readFile(path, "utf8")).applications[0].decision.state).toBe("consumed");
  });
});

describe("fixed review publication interface", () => {
  test("publishes a new pending snapshot without overwriting siblings or inheriting approval", async () => {
    const path = await reviewPath(); const batch = validBatch();
    batch.applications.push({ ...batch.applications[0]!, applicationId: "sibling", snapshotId: "sibling-snapshot" });
    await createReviewBatch(path, batch);
    const item = { ...batch.applications[0]!, snapshotId: "replacement", answers: [{ label: "Why this role?", value: "Build useful AI systems.", kind: "generated" as const }] };
    await publishReviewItem(path, item, { snapshotId: batch.applications[0]!.snapshotId, revision: null, decision: "pending" });
    const saved = await readReviewBatch(path);
    expect(saved.applications[0]).toEqual(item);
    expect(saved.applications[1]).toEqual(batch.applications[1]);
    await expect(publishReviewItem(path, { ...item, snapshotId: "next" }, { snapshotId: "outdated", revision: null, decision: "pending" })).rejects.toThrow("review_update_conflict");
    await expect(publishReviewItem(path, { ...item, snapshotId: "next", openedAt: batch.createdAt }, { snapshotId: "replacement", revision: null, decision: "pending" })).rejects.toThrow("fresh_pending_snapshot_required");
    expect(await readReviewBatch(path)).toEqual(saved);
  });

  test("concurrent publishers cannot replace the same expected snapshot twice", async () => {
    const path = await reviewPath(); const batch = validBatch(); await createReviewBatch(path, batch);
    const expected = { snapshotId: batch.applications[0]!.snapshotId, revision: null, decision: "pending" as const };
    const results = await Promise.allSettled(["first", "second"].map(snapshotId => publishReviewItem(path, { ...batch.applications[0]!, snapshotId }, expected)));
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter(r => r.status === "rejected")).toHaveLength(1);
  });

  test("rejects non-English display content without mutating the review", async () => {
    const path = await reviewPath(); const batch = validBatch(); await createReviewBatch(path, batch);
    await expect(publishReviewItem(path, { ...batch.applications[0]!, snapshotId: "new", questions: [{ id: "q", prompt: "\u8bf7\u8865\u5145", required: true }] }, { snapshotId: batch.applications[0]!.snapshotId, revision: null, decision: "pending" })).rejects.toThrow("english_review_content_required");
    expect(await readReviewBatch(path)).toEqual(batch);
  });
});
