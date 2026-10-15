import { describe, expect, test } from "vitest";
import type { ChinaJobRecord } from "../jobs/chinaJobLibrary.js";
import type { ChinaOutreachRecord } from "../outreach/chinaOutreachTracker.js";
import { buildChinaStatusView } from "./chinaStatusView.js";

function job(overrides: Partial<ChinaJobRecord> = {}): ChinaJobRecord {
  return {
    jobId: "boss-123",
    company: "示例科技",
    title: "大模型应用工程师",
    location: "上海",
    category: "agent",
    bossUrl: "https://www.zhipin.com/job_detail/example.html",
    recruiterName: "王女士",
    recruiterTitle: "招聘经理",
    firstSeen: "2026-08-08",
    lastVerified: "2026-08-08",
    status: "discovered",
    note: "Agent 平台",
    ...overrides
  };
}

function outreach(overrides: Partial<ChinaOutreachRecord> = {}): ChinaOutreachRecord {
  return {
    outreachId: "outreach-boss-123",
    jobId: "boss-123",
    recruiterName: "王女士",
    category: "agent",
    cvFilename: "agent.pdf",
    message: "您好，我对这个岗位很感兴趣。",
    status: "awaiting_review",
    createdAt: "2026-08-08T20:00:00.000Z",
    updatedAt: "2026-08-08T20:01:00.000Z",
    ...overrides
  };
}

describe("China status projection", () => {
  test("shows a discovered Boss job without creating outreach state", () => {
    expect(buildChinaStatusView([job()], [])).toEqual([{
      jobId: "boss-123",
      company: "示例科技",
      title: "大模型应用工程师",
      location: "上海",
      category: "agent",
      recruiter: "王女士 · 招聘经理",
      href: "https://www.zhipin.com/job_detail/example.html",
      status: "discovered",
      dateLabel: "08-08",
      dateTime: "2026-08-08T00:00:00.000Z"
    }]);
  });

  test("merges only the exact job outreach and projects its China lifecycle", () => {
    const rows = buildChinaStatusView([
      job(),
      job({ jobId: "boss-456", bossUrl: "https://www.zhipin.com/job_detail/robotics.html", title: "机器人学习工程师", category: "robotics", recruiterName: "", recruiterTitle: "" })
    ], [outreach()]);
    expect(rows[0]?.status).toBe("awaiting_review");
    expect(rows[0]?.dateTime).toBe("2026-08-08T20:01:00.000Z");
    expect(rows[1]?.status).toBe("discovered");
    expect(rows[1]?.recruiter).toBe("Recruiter not recorded");
  });

  test("maps contacted evidence to Contacted without US submission states", () => {
    const row = buildChinaStatusView([job()], [outreach({
      status: "contacted",
      approvedSnapshotId: "sha256:abc",
      sentAt: "2026-08-08T20:02:00.000Z",
      updatedAt: "2026-08-08T20:02:00.000Z"
    })])[0];
    expect(row?.status).toBe("contacted");
    expect(row).not.toHaveProperty("gmailConfirmation");
    expect(row).not.toHaveProperty("ats");
  });
});
