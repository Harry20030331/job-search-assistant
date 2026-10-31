import { assertPrivate } from "./storage/privateFiles.js";
import { chmod, lstat, mkdtemp, readFile, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  applicationStatuses,
  createApplication,
  markConfirmed,
  markWebsiteConfirmed,
  setStatusVisibility,
  markSubmitted,
  migrateApplicationTracker,
  readApplicationTracker,
  reconcileConfirmationBatch,
  transitionApplication
} from "./tracker.js";

async function trackerPath(schemaVersion: 2 | 3 = 3) {
  const directory = await mkdtemp(join(tmpdir(), "application-agent-tracker-"));
  const path = join(directory, "tracker.json");
  await writeFile(path, JSON.stringify({ schemaVersion, applications: [] }));
  return path;
}

const input = {
  jobId: "notion-85947779",
  applicationId: "notion-85947779",
  company: "Notion",
  title: "Software Engineer, Early Career (AI)",
  location: "San Francisco, CA",
  ats: "ashby" as const,
  jobUrl: "https://jobs.ashbyhq.com/notion/85947779-6b87-466a-98bc-30a640448c28",
  applicationUrl: "https://jobs.ashbyhq.com/notion/85947779-6b87-466a-98bc-30a640448c28/application",
  category: "llm" as const,
  cvFilename: "example_cv_llm.pdf"
};

function legacyRecord(
  status: "new" | "ready" | "in_progress" | "final_review" | "submitted" | "closed",
  gmailConfirmation: "not_checked" | "confirmed" | "not_received_yet" | "not_applicable" | "ambiguous" = "not_checked"
) {
  return {
    jobId: `${input.jobId}-${status}-${gmailConfirmation}`,
    applicationId: `${input.applicationId}-${status}-${gmailConfirmation}`,
    company: input.company,
    title: input.title,
    location: input.location,
    ats: input.ats,
    jobUrl: `${input.jobUrl}?state=${status}-${gmailConfirmation}`,
    category: input.category,
    cvFilename: input.cvFilename,
    status,
    visibleResult: status === "submitted" ? "submitted" as const : "not_attempted" as const,
    gmailConfirmation,
    createdAt: "2026-08-07T16:00:00.000Z",
    updatedAt: "2026-08-07T16:02:00.000Z"
  };
}

describe("application tracker", () => {
  test("uses exactly one canonical application lifecycle", async () => {
    expect(applicationStatuses).toEqual([
      "in_review",
      "submitted",
      "confirmed",
      "interviewing",
      "offer",
      "closed"
    ]);

    const path = await trackerPath();
    const record = await createApplication(path, input, "2026-08-07T18:00:00.000Z");
    expect(record).toMatchObject({ status: "in_review", applicationUrl: input.applicationUrl });

    await markSubmitted(path, input.applicationId, {
      applicationId: input.applicationId,
      snapshotId: "snapshot-1",
      approvalConsumed: true,
      visibleResult: "submitted"
    }, "2026-08-07T18:10:00.000Z");
    expect((await readApplicationTracker(path)).applications[0]?.status).toBe("submitted");

    await markConfirmed(path, input.applicationId, "confirmed", "2026-08-07T18:12:00.000Z");
    expect((await readApplicationTracker(path)).applications[0]).toMatchObject({
      status: "confirmed",
      visibleResult: "submitted",
      gmailConfirmation: "confirmed",
      confirmedAt: "2026-08-07T18:12:00.000Z"
    });
  });

  test("website success confirms without inventing email and survives email closeout", async () => {
    const path = await trackerPath();
    await createApplication(path, input, "2026-08-07T18:00:00.000Z");
    await expect(markWebsiteConfirmed(path, input.applicationId, "receipt.png"))
      .rejects.toThrow("submission_evidence_required");
    await markSubmitted(path, input.applicationId, {
      applicationId: input.applicationId, snapshotId: "snapshot-1",
      approvalConsumed: true, visibleResult: "submitted"
    }, "2026-08-07T18:10:00.000Z");
    await markWebsiteConfirmed(path, input.applicationId, "receipt.png", "2026-08-07T18:11:00.000Z");
    await reconcileConfirmationBatch(path, {
      checkedAt: "2026-08-07T18:12:00.000Z", confirmations: [], notReceived: [input.applicationId]
    });
    expect((await readApplicationTracker(path)).applications[0]).toMatchObject({
      status: "confirmed", gmailConfirmation: "not_received_yet",
      websiteConfirmation: { reference: "receipt.png" }, confirmedAt: "2026-08-07T18:11:00.000Z"
    });
    await reconcileConfirmationBatch(path, {
      checkedAt: "2026-08-07T18:13:00.000Z", notReceived: [],
      confirmations: [{ applicationId: input.applicationId, receivedAt: "2026-08-07T18:09:59.000Z" }]
    });
    expect((await readApplicationTracker(path)).applications[0]).toMatchObject({
      status: "confirmed", gmailConfirmation: "confirmed", confirmedAt: "2026-08-07T18:11:00.000Z"
    });
  });

  test("requires an exact HTTPS application URL for new records", async () => {
    const path = await trackerPath();
    await expect(createApplication(path, { ...input, applicationUrl: "http://example.com/application" }))
      .rejects.toThrow("invalid_application_record");
    await expect(createApplication(path, { ...input, applicationUrl: undefined } as never))
      .rejects.toThrow("invalid_application_record");
  });

  test("rejects a persisted v3 record without its exact application URL", async () => {
    const path = await trackerPath();
    await writeFile(path, JSON.stringify({
      schemaVersion: 3,
      applications: [{ ...legacyRecord("final_review"), status: "in_review" }]
    }));
    await expect(readApplicationTracker(path)).rejects.toThrow("invalid_application_tracker");
  });

  test("rejects duplicate application identity or URL", async () => {
    const path = await trackerPath();
    await createApplication(path, input);
    await expect(createApplication(path, input)).rejects.toThrow("duplicate_job");
    await expect(createApplication(path, {
      ...input,
      jobId: "other-job",
      applicationId: "other-application",
      jobUrl: "https://example.com/other-job"
    })).rejects.toThrow("duplicate_job");

    await createApplication(path, {
      ...input,
      jobId: "valid-job",
      applicationId: "valid-application",
      jobUrl: "https://example.com/valid-job",
      applicationUrl: "https://example.com/valid-application"
    });
    expect((await readApplicationTracker(path)).applications).toHaveLength(2);
  });

  test("serializes concurrent updates to different applications without losing records", async () => {
    const path = await trackerPath();
    const records = Array.from({ length: 12 }, (_, index) => ({
      ...input,
      jobId: `job-${index}`,
      applicationId: `application-${index}`,
      jobUrl: `https://example.com/jobs/${index}`,
      applicationUrl: `https://example.com/applications/${index}`
    }));

    await Promise.all(records.map((record) => createApplication(path, record)));

    expect((await readApplicationTracker(path)).applications.map(({ applicationId }) => applicationId).sort())
      .toEqual(records.map(({ applicationId }) => applicationId).sort());
    await assertPrivate(path);
  });

  test("uses the canonical real path for alias transactions without replacing the symlink", async () => {
    const path = await trackerPath();
    const aliasRoot = join(dirname(path), "alias-directory");
    const alias = process.platform === "win32" ? join(aliasRoot, basename(path)) : join(dirname(path), "tracker-alias.json");
    await symlink(process.platform === "win32" ? dirname(path) : path, process.platform === "win32" ? aliasRoot : alias, process.platform === "win32" ? "junction" : "file");
    const second = {
      ...input,
      jobId: "linear-job",
      applicationId: "linear-application",
      jobUrl: "https://example.com/jobs/linear",
      applicationUrl: "https://example.com/applications/linear"
    };

    await Promise.all([createApplication(path, input), createApplication(alias, second)]);

    expect((await readApplicationTracker(path)).applications).toHaveLength(2);
    expect((await lstat(process.platform === "win32" ? aliasRoot : alias)).isSymbolicLink()).toBe(true);
  });

  test("retains snapshot-bound approval safety before visible submission", async () => {
    const path = await trackerPath();
    await createApplication(path, input);
    await expect(markSubmitted(path, input.applicationId, {
      applicationId: input.applicationId,
      snapshotId: "sha256:current",
      approvalConsumed: false,
      visibleResult: "submitted"
    } as never)).rejects.toThrow("website_approval_consumption_required");
    await expect(markSubmitted(path, input.applicationId, {
      applicationId: "another-application",
      snapshotId: "sha256:current",
      approvalConsumed: true,
      visibleResult: "submitted"
    })).rejects.toThrow("website_approval_consumption_required");
    await expect(markSubmitted(path, input.applicationId, {
      applicationId: input.applicationId,
      snapshotId: "sha256:current",
      approvalConsumed: true,
      visibleResult: "failed"
    } as never)).rejects.toThrow("website_approval_consumption_required");

    expect((await readApplicationTracker(path)).applications[0]?.status).toBe("in_review");
  });

  test("does not accept Gmail confirmation as submission-time evidence", async () => {
    const path = await trackerPath();
    await createApplication(path, input);
    await expect(markSubmitted(path, input.applicationId, {
      applicationId: input.applicationId,
      snapshotId: "snapshot-1",
      approvalConsumed: true,
      visibleResult: "submitted",
      gmailConfirmation: "confirmed"
    } as never)).rejects.toThrow("website_approval_consumption_required");
    expect((await readApplicationTracker(path)).applications[0]).toMatchObject({
      status: "in_review",
      visibleResult: "not_attempted",
      gmailConfirmation: "not_checked"
    });
  });

  test("does not confirm without matching Gmail evidence", async () => {
    const path = await trackerPath();
    await createApplication(path, input);
    await markSubmitted(path, input.applicationId, {
      applicationId: input.applicationId,
      snapshotId: "snapshot-1",
      approvalConsumed: true,
      visibleResult: "submitted"
    });

    await expect(markConfirmed(path, input.applicationId, "ambiguous"))
      .rejects.toThrow("gmail_confirmation_required");
    expect((await readApplicationTracker(path)).applications[0]).toMatchObject({
      status: "submitted",
      gmailConfirmation: "not_checked"
    });
  });

  test("atomically reconciles received and pending Gmail confirmations", async () => {
    const path = await trackerPath();
    const pendingInput = {
      ...input,
      jobId: "parallel-1",
      applicationId: "parallel-1",
      jobUrl: "https://example.com/jobs/parallel-1",
      applicationUrl: "https://example.com/applications/parallel-1"
    };
    for (const application of [input, pendingInput]) {
      await createApplication(path, application, "2026-08-17T16:00:00.000Z");
      await markSubmitted(path, application.applicationId, {
        applicationId: application.applicationId,
        snapshotId: `snapshot-${application.applicationId}`,
        approvalConsumed: true,
        visibleResult: "submitted"
      }, "2026-08-17T16:30:00.000Z");
    }

    const result = await reconcileConfirmationBatch(path, {
      checkedAt: "2026-08-17T17:00:00.000Z",
      confirmations: [{
        applicationId: input.applicationId,
        receivedAt: "2026-08-17T16:59:12.000Z"
      }],
      notReceived: [pendingInput.applicationId]
    });

    expect(result).toEqual({ confirmed: 1, pending: 1 });
    expect((await readApplicationTracker(path)).applications).toEqual(expect.arrayContaining([
      expect.objectContaining({
        applicationId: input.applicationId,
        status: "confirmed",
        gmailConfirmation: "confirmed",
        confirmedAt: "2026-08-17T16:59:12.000Z",
        updatedAt: "2026-08-17T17:00:00.000Z"
      }),
      expect.objectContaining({
        applicationId: pendingInput.applicationId,
        status: "submitted",
        gmailConfirmation: "not_received_yet",
        updatedAt: "2026-08-17T17:00:00.000Z"
      })
    ]));
    await assertPrivate(path);
  });

  test.each([
    {
      name: "duplicate confirmations",
      batch: {
        checkedAt: "2026-08-17T17:00:00.000Z",
        confirmations: [
          { applicationId: input.applicationId, receivedAt: "2026-08-17T16:59:12.000Z" },
          { applicationId: input.applicationId, receivedAt: "2026-08-17T16:59:13.000Z" }
        ],
        notReceived: []
      }
    },
    {
      name: "duplicate pending IDs",
      batch: {
        checkedAt: "2026-08-17T17:00:00.000Z",
        confirmations: [],
        notReceived: [input.applicationId, input.applicationId]
      }
    },
    {
      name: "overlapping received and pending IDs",
      batch: {
        checkedAt: "2026-08-17T17:00:00.000Z",
        confirmations: [{ applicationId: input.applicationId, receivedAt: "2026-08-17T16:59:12.000Z" }],
        notReceived: [input.applicationId]
      }
    },
    {
      name: "invalid checked timestamp",
      batch: {
        checkedAt: "private-invalid-time",
        confirmations: [],
        notReceived: [input.applicationId]
      }
    },
    {
      name: "invalid received timestamp",
      batch: {
        checkedAt: "2026-08-17T17:00:00.000Z",
        confirmations: [{ applicationId: input.applicationId, receivedAt: "not-an-iso-time" }],
        notReceived: []
      }
    }
  ])("rejects $name without writing", async ({ batch }) => {
    const path = await trackerPath();
    await createApplication(path, input);
    await markSubmitted(path, input.applicationId, {
      applicationId: input.applicationId,
      snapshotId: "snapshot-1",
      approvalConsumed: true,
      visibleResult: "submitted"
    });
    const before = await readFile(path, "utf8");

    await expect(reconcileConfirmationBatch(path, batch)).rejects.toThrow();

    expect(await readFile(path, "utf8")).toBe(before);
  });

  test.each([
    { name: "missing application", applicationId: "missing-application", prepare: async (_path: string) => undefined },
    { name: "non-submitted application", applicationId: input.applicationId, prepare: createApplication }
  ])("rejects a $name and leaves the entire batch unchanged", async ({ applicationId, prepare }) => {
    const path = await trackerPath();
    const valid = {
      ...input,
      jobId: "valid-submitted",
      applicationId: "valid-submitted",
      jobUrl: "https://example.com/jobs/valid-submitted",
      applicationUrl: "https://example.com/applications/valid-submitted"
    };
    await createApplication(path, valid);
    await markSubmitted(path, valid.applicationId, {
      applicationId: valid.applicationId,
      snapshotId: "snapshot-valid",
      approvalConsumed: true,
      visibleResult: "submitted"
    });
    await prepare(path, input);
    const before = await readFile(path, "utf8");

    await expect(reconcileConfirmationBatch(path, {
      checkedAt: "2026-08-17T17:00:00.000Z",
      confirmations: [{ applicationId: valid.applicationId, receivedAt: "2026-08-17T16:59:12.000Z" }],
      notReceived: [applicationId]
    })).rejects.toThrow();

    expect(await readFile(path, "utf8")).toBe(before);
  });

  test("reads strict legacy current records without confirmedAt", async () => {
    const path = await trackerPath();
    const record = {
      ...legacyRecord("submitted", "confirmed"),
      applicationUrl: input.applicationUrl,
      status: "confirmed"
    };
    await writeFile(path, JSON.stringify({ schemaVersion: 3, applications: [record] }));

    expect((await readApplicationTracker(path)).applications[0]).not.toHaveProperty("confirmedAt");
  });

  test.each(["in_review", "submitted"] as const)(
    "rejects confirmedAt evidence on a %s persisted record",
    async (status) => {
      const path = await trackerPath();
      const record = {
        ...legacyRecord(status === "submitted" ? "submitted" : "final_review", "not_checked"),
        applicationUrl: input.applicationUrl,
        status,
        visibleResult: status === "submitted" ? "submitted" : "not_attempted",
        confirmedAt: "2026-08-17T17:00:00.000Z"
      };
      await writeFile(path, JSON.stringify({ schemaVersion: 3, applications: [record] }));

      await expect(readApplicationTracker(path)).rejects.toThrow("invalid_application_tracker");
    }
  );

  test.each([
    {
      name: "confirmation received before submission",
      checkedAt: "2026-08-17T17:00:00.000Z",
      receivedAt: "2026-08-17T16:29:59.999Z",
      pending: false
    },
    {
      name: "confirmation received after the Gmail check",
      checkedAt: "2026-08-17T17:00:00.000Z",
      receivedAt: "2026-08-17T17:00:00.001Z",
      pending: false
    },
    {
      name: "Gmail check before the existing update",
      checkedAt: "2026-08-17T16:29:59.999Z",
      receivedAt: "2026-08-17T16:29:59.999Z",
      pending: false
    },
    {
      name: "pending check before the existing update",
      checkedAt: "2026-08-17T16:29:59.999Z",
      receivedAt: undefined,
      pending: true
    }
  ])("rejects $name without writing any batch item", async ({ checkedAt, receivedAt, pending }) => {
    const path = await trackerPath();
    const sibling = {
      ...input,
      jobId: "sibling",
      applicationId: "sibling",
      jobUrl: "https://example.com/jobs/sibling",
      applicationUrl: "https://example.com/applications/sibling"
    };
    for (const application of [input, sibling]) {
      await createApplication(path, application, "2026-08-17T16:00:00.000Z");
      await markSubmitted(path, application.applicationId, {
        applicationId: application.applicationId,
        snapshotId: `snapshot-${application.applicationId}`,
        approvalConsumed: true,
        visibleResult: "submitted"
      }, "2026-08-17T16:30:00.000Z");
    }
    const before = await readFile(path, "utf8");

    await expect(reconcileConfirmationBatch(path, {
      checkedAt,
      confirmations: [
        { applicationId: sibling.applicationId, receivedAt: "2026-08-17T16:45:00.000Z" },
        ...(pending ? [] : [{ applicationId: input.applicationId, receivedAt: receivedAt! }])
      ],
      notReceived: pending ? [input.applicationId] : []
    })).rejects.toThrow("invalid_lifecycle_time");

    expect(await readFile(path, "utf8")).toBe(before);
  });

  test("rejects a backward protected transition without writing", async () => {
    const path = await trackerPath();
    await createApplication(path, input, "2026-08-17T16:00:00.000Z");
    await markSubmitted(path, input.applicationId, {
      applicationId: input.applicationId,
      snapshotId: "snapshot-1",
      approvalConsumed: true,
      visibleResult: "submitted"
    }, "2026-08-17T16:30:00.000Z");
    const before = await readFile(path, "utf8");

    await expect(transitionApplication(
      path,
      input.applicationId,
      "closed",
      {},
      "2026-08-17T16:29:59.999Z"
    )).rejects.toThrow("invalid_lifecycle_time");

    expect(await readFile(path, "utf8")).toBe(before);
  });

  test("rejects confirmation from any state except submitted", async () => {
    const path = await trackerPath();
    await createApplication(path, input);
    await expect(markConfirmed(path, input.applicationId, "confirmed"))
      .rejects.toThrow("invalid_status_transition");
  });

  test("allows only forward active progression and closure from active states", async () => {
    const path = await trackerPath();
    await createApplication(path, input);
    await expect(transitionApplication(path, input.applicationId, "offer"))
      .rejects.toThrow("invalid_status_transition");
    await markSubmitted(path, input.applicationId, {
      applicationId: input.applicationId,
      snapshotId: "snapshot-1",
      approvalConsumed: true,
      visibleResult: "submitted"
    });
    await markConfirmed(path, input.applicationId, "confirmed");
    expect((await transitionApplication(path, input.applicationId, "interviewing")).status).toBe("interviewing");
    expect((await transitionApplication(path, input.applicationId, "offer")).status).toBe("offer");
    expect((await transitionApplication(path, input.applicationId, "closed")).status).toBe("closed");
    await expect(transitionApplication(path, input.applicationId, "offer"))
      .rejects.toThrow("invalid_status_transition");

    for (const startingStatus of ["in_review", "submitted", "confirmed", "interviewing"] as const) {
      const closePath = await trackerPath();
      await createApplication(closePath, input);
      if (startingStatus !== "in_review") {
        await markSubmitted(closePath, input.applicationId, {
          applicationId: input.applicationId,
          snapshotId: "snapshot-1",
          approvalConsumed: true,
          visibleResult: "submitted"
        });
      }
      if (startingStatus === "confirmed" || startingStatus === "interviewing") {
        await markConfirmed(closePath, input.applicationId, "confirmed");
      }
      if (startingStatus === "interviewing") {
        await transitionApplication(closePath, input.applicationId, "interviewing");
      }
      expect((await transitionApplication(closePath, input.applicationId, "closed")).status).toBe("closed");
    }
  });

  test("keeps submission and Gmail evidence monotonic through later active states", async () => {
    const path = await trackerPath();
    await createApplication(path, input);
    await markSubmitted(path, input.applicationId, {
      applicationId: input.applicationId,
      snapshotId: "snapshot-1",
      approvalConsumed: true,
      visibleResult: "submitted"
    });
    await markConfirmed(path, input.applicationId, "confirmed");

    await expect(transitionApplication(path, input.applicationId, "interviewing", {
      visibleResult: "failed"
    } as never)).rejects.toThrow("invalid_application_record");
    await expect(transitionApplication(path, input.applicationId, "interviewing", {
      gmailConfirmation: "ambiguous"
    } as never)).rejects.toThrow("invalid_application_record");
    expect((await readApplicationTracker(path)).applications[0]).toMatchObject({
      status: "confirmed",
      visibleResult: "submitted",
      gmailConfirmation: "confirmed"
    });

    await transitionApplication(path, input.applicationId, "interviewing");
    const offered = await transitionApplication(path, input.applicationId, "offer");
    expect(offered).toMatchObject({
      status: "offer",
      visibleResult: "submitted",
      gmailConfirmation: "confirmed"
    });
  });

  test("rejects persisted lifecycle states with contradictory audit evidence", async () => {
    const path = await trackerPath();
    const record = {
      ...legacyRecord("submitted", "not_received_yet"),
      applicationUrl: input.applicationUrl,
      status: "submitted"
    };
    await writeFile(path, JSON.stringify({
      schemaVersion: 3,
      applications: [{ ...record, visibleResult: "failed" }]
    }));
    await expect(readApplicationTracker(path)).rejects.toThrow("invalid_application_tracker");

    await writeFile(path, JSON.stringify({
      schemaVersion: 3,
      applications: [{ ...record, status: "confirmed", gmailConfirmation: "ambiguous" }]
    }));
    await expect(readApplicationTracker(path)).rejects.toThrow("invalid_application_tracker");
  });

  test("migrates strict legacy v2 states while preserving audit evidence", async () => {
    const path = await trackerPath(2);
    const applications = [
      legacyRecord("new"),
      legacyRecord("ready"),
      legacyRecord("in_progress"),
      legacyRecord("final_review", "ambiguous"),
      legacyRecord("submitted", "not_received_yet"),
      legacyRecord("submitted", "confirmed"),
      legacyRecord("closed", "confirmed")
    ];
    await writeFile(path, JSON.stringify({ schemaVersion: 2, applications }));

    const document = await readApplicationTracker(path);
    expect(document.schemaVersion).toBe(3);
    expect(document.applications.map((record) => record.status)).toEqual([
      "in_review",
      "in_review",
      "in_review",
      "in_review",
      "submitted",
      "confirmed",
      "closed"
    ]);
    expect(document.applications[3]).toMatchObject({
      visibleResult: "not_attempted",
      gmailConfirmation: "ambiguous"
    });
    expect(document.applications[0]).not.toHaveProperty("applicationUrl");

    applications[0] = { ...applications[0]!, unexpected: "rejected" } as never;
    await writeFile(path, JSON.stringify({ schemaVersion: 2, applications }));
    await expect(readApplicationTracker(path)).rejects.toThrow("invalid_application_tracker");
  });

  test("migrates a legacy tracker with validated exact URLs and private permissions", async () => {
    const path = await trackerPath(2);
    const record = legacyRecord("final_review", "ambiguous");
    await writeFile(path, JSON.stringify({ schemaVersion: 2, applications: [record] }));
    await chmod(path, 0o644);

    const document = await migrateApplicationTracker(path, {
      [record.applicationId]: input.applicationUrl
    });
    expect(document).toMatchObject({
      schemaVersion: 3,
      applications: [{ status: "in_review", applicationUrl: input.applicationUrl }]
    });
    expect(JSON.parse(await readFile(path, "utf8"))).toEqual(document);
    await assertPrivate(path);
  });

  test("does not rewrite an already-current tracker when migration changes nothing", async () => {
    const path = await trackerPath();
    await createApplication(path, input);
    const before = await stat(path, { bigint: true });

    await migrateApplicationTracker(path, {});

    const after = await stat(path, { bigint: true });
    expect(after.ino).toBe(before.ino);
    expect(after.mtimeNs).toBe(before.mtimeNs);
  });

  test("enforces unique identities and URLs across persisted v3 records", async () => {
    const path = await trackerPath();
    const first = {
      ...legacyRecord("ready"),
      applicationUrl: "https://example.com/applications/first",
      status: "in_review"
    };
    const second = {
      ...legacyRecord("new"),
      jobId: "second-job",
      applicationId: "second-application",
      jobUrl: "https://example.com/jobs/second",
      applicationUrl: "https://example.com/applications/second",
      status: "in_review"
    };

    for (const field of ["jobId", "applicationId", "jobUrl", "applicationUrl"] as const) {
      await writeFile(path, JSON.stringify({
        schemaVersion: 3,
        applications: [first, { ...second, [field]: first[field] }]
      }));
      await expect(readApplicationTracker(path)).rejects.toThrow("invalid_application_tracker");
    }
  });

  test("rejects duplicate migration URLs and preserves valid distinct records", async () => {
    const path = await trackerPath(2);
    const first = legacyRecord("ready");
    const second = {
      ...legacyRecord("new"),
      jobId: "snowflake-job",
      applicationId: "snowflake-application",
      jobUrl: "https://jobs.ashbyhq.com/snowflake/role"
    };
    const source = JSON.stringify({ schemaVersion: 2, applications: [first, second] });
    await writeFile(path, source);

    const duplicateUrl = "https://jobs.ashbyhq.com/shared/application";
    await expect(migrateApplicationTracker(path, {
      [first.applicationId]: duplicateUrl,
      [second.applicationId]: duplicateUrl
    })).rejects.toThrow("invalid_application_tracker");
    expect(await readFile(path, "utf8")).toBe(source);

    const firstUrl = "https://jobs.ashbyhq.com/notion/application";
    const secondUrl = "https://jobs.ashbyhq.com/snowflake/application";
    const document = await migrateApplicationTracker(path, {
      [first.applicationId]: firstUrl,
      [second.applicationId]: secondUrl
    });
    expect(document.applications).toHaveLength(2);
    expect(document.applications.map((record) => record.applicationUrl)).toEqual([firstUrl, secondUrl]);
    expect((await readApplicationTracker(path)).applications).toHaveLength(2);
  });

  test("refuses to persist a migration without an exact HTTPS URL for every record", async () => {
    const path = await trackerPath(2);
    const record = legacyRecord("ready");
    const source = JSON.stringify({ schemaVersion: 2, applications: [record] });
    await writeFile(path, source);

    await expect(migrateApplicationTracker(path, {})).rejects.toThrow("application_url_required");
    await expect(migrateApplicationTracker(path, { [record.applicationId]: "http://example.com/application" }))
      .rejects.toThrow("invalid_application_url");
    expect(await readFile(path, "utf8")).toBe(source);
  });

  test("does not persist arbitrary or secret-shaped fields", async () => {
    const path = await trackerPath();
    await expect(createApplication(path, { ...input, password: "secret" } as never))
      .rejects.toThrow("invalid_application_record");
  });
});

test("visibility changes preserve application evidence and lifecycle", async () => {
  const path = await trackerPath();
  const original = await createApplication(path, input, "2026-08-07T18:00:00.000Z");
  expect(await setStatusVisibility(path, input.applicationId, false)).toEqual({ ...original, hiddenFromStatus: true });
  expect(await setStatusVisibility(path, input.applicationId, true)).toEqual({ ...original, hiddenFromStatus: false });
});
