import { describe, expect, test } from "vitest";
import { formatReviewServerStartup, parseReviewServerArgs } from "./reviewServerCli.js";

describe("review server CLI", () => {
  test("parses exact local paths and port", () => {
    expect(parseReviewServerArgs([
      "--review", "reviews/2026-08-07.local.json",
      "--tracker", "data/application-tracker.local.json",
      "--jobs", "data/us-job-library.csv",
      "--china-jobs", "data/china/job-library.csv",
      "--china-outreach", "data/china/outreach-tracker.local.json",
      "--port", "64440"
    ])).toEqual({
      reviewPath: "reviews/2026-08-07.local.json",
      trackerPath: "data/application-tracker.local.json",
      jobsPath: "data/us-job-library.csv",
      chinaJobsPath: "data/china/job-library.csv",
      chinaOutreachPath: "data/china/outreach-tracker.local.json",
      port: 64440
    });
  });

  test("rejects missing, duplicate, extra, or invalid flags", () => {
    expect(() => parseReviewServerArgs(["--review", "x"])).toThrow("invalid_cli_arguments");
    expect(() => parseReviewServerArgs([
      "--review", "x", "--tracker", "y", "--jobs", "z", "--china-jobs", "a", "--china-outreach", "b", "--port", "70000"
    ])).toThrow("invalid_cli_arguments");
    expect(() => parseReviewServerArgs([
      "--review", "x", "--tracker", "y", "--jobs", "z", "--china-jobs", "a", "--china-outreach", "b", "--unknown", "1"
    ])).toThrow("invalid_cli_arguments");
  });

  test("announces both pages and treats live ATS state as unverified", () => {
    expect(formatReviewServerStartup(
      "http://127.0.0.1:64440",
      "/project/reviews/2026-08-07.local.json",
      ["parallel-active", "servicenow-active"]
    ))
      .toBe([
        "workspace_url=http://127.0.0.1:64440/review",
        "review_url=http://127.0.0.1:64440/review",
        "us_status_url=http://127.0.0.1:64440/status/us",
        "review_record=/project/reviews/2026-08-07.local.json",
        "applications=2",
        "application_ids=parallel-active,servicenow-active",
        "ats_live_state=unverified",
        "recovery_action=re-observe ATS pages; replace snapshots when live continuity is lost"
      ].join("\n") + "\n");
  });
});
