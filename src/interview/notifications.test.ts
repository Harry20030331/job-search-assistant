import { expect, test } from "vitest";
import { dueNotices } from "./notifications.js";
import { interviewEnded, type InterviewBoardItem } from "./workbench.js";

function item(): InterviewBoardItem {
  return { company: "Fictional Cedar", role: "Graduate Engineer", location: "Remote", officialUrl: "https://example.invalid/job", applicationStage: "interviewing", snapshot: null, problem: null,
    entry: { interviewId: "round-1", jobId: "job-1", applicationId: "app-1", state: "scheduled", revision: 1, workspace: null,
      updatedAt: "2026-10-30T10:00:00Z", schedule: { start: "2026-10-30T10:00:00-07:00", end: "2026-10-30T11:00:00-07:00", timezone: "America/Los_Angeles" },
      association: { source: "synthetic_test_script", reference: "Fictional", verifiedAt: "2026-10-29T12:00:00Z" } } };
}
test("only the exact elapsed end time makes a round due, including offsets", () => {
  const round = item(), end = Date.parse(round.entry.schedule!.end);
  expect(interviewEnded(round, end - 1)).toBe(false); expect(interviewEnded(round, end)).toBe(true);
  expect(dueNotices([round], end)[0]!.href).toContain("view=debrief");
  expect(round.entry.state).toBe("scheduled");
});
test("cancelled, unknown-time and debriefed rounds produce no reminder", () => {
  const round = item(); round.entry.state = "cancelled"; expect(dueNotices([round], Infinity)).toEqual([]);
  round.entry.state = "invited"; round.entry.schedule = null; expect(dueNotices([round], Infinity)).toEqual([]);
  const reported = item(); reported.snapshot = { debriefs: [{ mode: "interview" }] } as InterviewBoardItem["snapshot"];
  expect(dueNotices([reported], Infinity)).toEqual([]);
  reported.snapshot = { debriefs: [{ mode: "practice" }] } as InterviewBoardItem["snapshot"];
  expect(dueNotices([reported], Infinity)).toHaveLength(1);
});
test("rescheduling invalidates the old reminder identity and waits for the new end", () => {
  const round = item(), original = dueNotices([round], Infinity)[0]!.id;
  round.entry.schedule!.start = "2026-11-01T10:00:00-08:00"; round.entry.schedule!.end = "2026-11-01T11:00:00-08:00";
  expect(dueNotices([round], Date.parse("2026-10-31T12:00:00Z"))).toEqual([]);
  expect(dueNotices([round], Infinity)[0]!.id).not.toBe(original);
});
test("equivalent UTC offsets do not create duplicate reminders", () => {
  const round = item(), original = dueNotices([round], Infinity)[0]!.id;
  round.entry.schedule!.start = "2026-10-30T17:00:00Z"; round.entry.schedule!.end = "2026-10-30T18:00:00Z";
  round.entry.schedule!.timezone = "UTC";
  expect(dueNotices([round], Infinity)[0]!.id).toBe(original);
});
