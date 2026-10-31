import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { linkInterview, publishInterview, readInterviewBoard, candidateAnchor, type InterviewSnapshot } from "./workbench.js";
import { isOpportunityPath, readOpportunities } from "../storage/opportunities.js";
import { transitionApplication } from "../tracker.js";
import { startReviewServer, type RunningReviewServer } from "../review/reviewServer.js";
import { renderInterviewPage } from "./interviewView.js";
import { acknowledgeNotice, pendingNotices } from "./notifications.js";

const roots: string[] = [], servers: RunningReviewServer[] = [];
afterEach(async () => { await Promise.all(servers.splice(0).map(s => s.close())); await Promise.all(roots.splice(0).map(path => rm(path, { recursive: true, force: true }))); });
async function setup() {
  const root = await mkdtemp(join(tmpdir(), "interview-workbench-")); roots.push(root);
  const paths = { trackerPath: join(root, "opportunities.json"), profilePath: join(root, "candidate.json") };
  await writeFile(paths.profilePath, JSON.stringify({ schemaVersion: 2, identity: { fullName: "Fictional Candidate" } }));
  const application = { applicationId: "application-1", ats: "ashby", applicationUrl: "https://example.invalid/jobs/1/apply", cvFilename: "fictional.pdf",
    visibleResult: "submitted", gmailConfirmation: "not_checked", createdAt: "2026-10-20T10:00:00Z", updatedAt: "2026-10-20T12:00:00Z",
    submittedAt: "2026-10-20T11:00:00Z", websiteConfirmation: { reference: "Fictional receipt", verifiedAt: "2026-10-20T12:00:00Z" } };
  const job = { jobId: "job-1", company: "Fictional Cedar", title: "Graduate ML Engineer", location: "Remote", category: "llm", officialUrl: "https://example.invalid/jobs/1",
    sources: ["user-provided"], firstSeen: "2026-10-20", lastVerified: "2026-10-20", note: "Fictional only", availability: "open", stage: "submitted", application };
  await writeFile(paths.trackerPath, JSON.stringify({ schemaVersion: 1, opportunities: [job, { ...job, jobId: "job-2", officialUrl: "https://example.invalid/jobs/2", title: "Another Fictional Role", application: { ...application, applicationId: "application-2", applicationUrl: "https://example.invalid/jobs/2/apply" } }] }));
  await mkdir(join(root, "drafts"));
  return { root, paths };
}
function link(expectedRevision: number | null = null) {
  return { interviewId: "interview-1", jobId: "job-1", applicationId: "application-1", state: "scheduled", expectedRevision,
    schedule: { start: "2026-10-29T10:00:00-07:00", end: "2026-10-29T11:00:00-07:00", timezone: "America/Los_Angeles" },
    association: { source: "synthetic_test_script", reference: "Fictional verified invitation", verifiedAt: "2026-10-21T12:00:00Z" } };
}
async function snapshot(paths: Awaited<ReturnType<typeof setup>>["paths"]): Promise<InterviewSnapshot> {
  return { schemaVersion: 1, candidateAnchor: await candidateAnchor(paths.profilePath), freshness: "current",
    application: { job_id: "job-1", application_id: "application-1", interview_id: "interview-1", company: "Fictional Cedar", role: "Graduate ML Engineer" },
    proposal: { proposal_id: "plan-1", proposal_hash: "hash-1", version: 1, status: "awaiting_plan_approval", draft: { budget_minutes: 30, priorities: ["Truthful rehearsal"], unknowns: ["Exact questions are unknown"], sections: [
      { section_id: "intro", topic: "Introduction", minutes: 10, objective: "Use actual candidate facts", basis_refs: ["candidate"] },
      { section_id: "practice", topic: "Evaluation", minutes: 15, objective: "Explain a leakage check", basis_refs: ["invitation"] },
      { section_id: "questions", topic: "Questions", minutes: 5, objective: "Identify genuine questions", basis_refs: ["company"] } ] } }, materials: null, debriefs: [] };
}

test("Windows and POSIX opportunity paths use the same authoritative store", () => {
  expect(isOpportunityPath("C:\\fictional\\opportunities.json")).toBe(true);
  expect(isOpportunityPath("/fictional/opportunities.json")).toBe(true);
  expect(isOpportunityPath("not-opportunities.json")).toBe(false);
});
test("verified interview link advances the existing application and preserves another role", async () => {
  const { paths } = await setup();
  const before = (await readOpportunities(paths.trackerPath)).opportunities[1];
  expect((await linkInterview(paths, link())).revision).toBe(1);
  const jobs = (await readOpportunities(paths.trackerPath)).opportunities;
  expect(jobs[0]!.stage).toBe("interviewing"); expect(jobs[1]).toEqual(before);
  await expect(linkInterview(paths, link())).rejects.toThrow("interview_revision_conflict");
  expect((await readInterviewBoard(paths))[0]!.entry.revision).toBe(1);
});
test("wrong IDs, missing proof, stale identity and future evidence cannot advance an application", async () => {
  const { paths } = await setup();
  await expect(linkInterview(paths, { ...link(), applicationId: "application-2" })).rejects.toThrow();
  await expect(linkInterview(paths, { ...link(), association: { source: "email", reference: "", verifiedAt: "2026-10-21T12:00:00Z" } })).rejects.toThrow();
  await expect(linkInterview(paths, { ...link(), association: { ...link().association, verifiedAt: "2099-01-01T00:00:00Z" } })).rejects.toThrow();
  await expect(transitionApplication(paths.trackerPath, "application-1", "interviewing", {}, "2026-10-21T12:00:00Z",
    { jobId: "job-1", company: "Wrong Company", title: "Graduate ML Engineer", jobUrl: "https://example.invalid/jobs/1" })).rejects.toThrow("application_identity_changed");
  expect((await readOpportunities(paths.trackerPath)).opportunities[0]!.stage).toBe("submitted");
});
test("publishing binds candidate, job, application, interview and revision; stale runs stay blocked", async () => {
  const { root, paths } = await setup(); await linkInterview(paths, link());
  const data = await snapshot(paths), work = join(root, "work");
  await expect(publishInterview(paths, "interview-1", work, 1, async () => ({ ...data, freshness: "stale" }))).rejects.toThrow("interview_run_stale");
  await expect(publishInterview(paths, "interview-1", work, 1, async () => ({ ...data, application: { ...data.application, job_id: "job-2" } }))).rejects.toThrow("interview_run_identity_changed");
  expect((await publishInterview(paths, "interview-1", work, 1, async () => data)).revision).toBe(2);
  const board = await readInterviewBoard(paths, async () => data);
  expect(board[0]!.snapshot?.proposal?.version).toBe(1);
  await writeFile(paths.profilePath, JSON.stringify({ schemaVersion: 2, identity: { fullName: "Different Fictional Candidate" } }));
  await expect(readInterviewBoard(paths, async () => data)).rejects.toThrow("interview_candidate_changed");
});
test("cancelling one round does not close the application; rescheduling detaches old preparation", async () => {
  const { paths, root } = await setup(); await linkInterview(paths, link());
  const data = await snapshot(paths); await publishInterview(paths, "interview-1", join(root, "work"), 1, async () => data);
  await linkInterview(paths, { ...link(2), state: "cancelled" });
  expect((await readOpportunities(paths.trackerPath)).opportunities[0]!.stage).toBe("interviewing");
  const moved = link(3); moved.schedule.start = "2026-10-30T10:00:00-07:00"; moved.schedule.end = "2026-10-30T11:00:00-07:00";
  await linkInterview(paths, moved);
  expect((await readInterviewBoard(paths))[0]!.entry.workspace).toBeNull();
});
test("interview rendering escapes source text, distinguishes approvals, and preserves empty states", async () => {
  const { paths, root } = await setup(); await linkInterview(paths, link());
  const data = await snapshot(paths); data.proposal!.draft.sections[0]!.objective = '<img src=x onerror="alert(1)">';
  await publishInterview(paths, "interview-1", join(root, "work"), 1, async () => data);
  const page = renderInterviewPage(await readInterviewBoard(paths, async () => data), "interview-1", "preparation");
  expect(page).toContain("&lt;img"); expect(page).not.toContain('<img src=x'); expect(page).toContain("Awaiting your approval");
  expect(page).not.toContain("<form"); expect(page).toContain("30-minute plan");
  expect(renderInterviewPage([])).toContain("Room for your next conversation");
});

test("website plan approval binds the version and disables stale, cancelled and ready plans", async () => {
  const { paths } = await setup(); await linkInterview(paths, link());
  const data = await snapshot(paths); data.proposal!.draft.context_hash = "context";
  const item = (await readInterviewBoard(paths))[0]!; item.snapshot = data;
  const page = renderInterviewPage([item], "interview-1", "preparation");
  expect(page).toContain("Approve plan & generate practice"); expect(page).toContain("data-plan-decision=");
  expect(page).toContain("&quot;proposalId&quot;:&quot;plan-1&quot;");
  expect(page).toContain("Describe revisions in Codex chat");
  data.freshness = "stale"; expect(renderInterviewPage([item], "interview-1", "preparation")).not.toContain("data-plan-decision=");
  data.freshness = "current"; item.entry.state = "cancelled";
  expect(renderInterviewPage([item], "interview-1", "preparation")).not.toContain("data-plan-decision=");
});

test("notification dismissal and chat delivery are independent durable receipts", async () => {
  const { paths } = await setup(); const record = link(); record.schedule.start = "2020-10-29T10:00:00-07:00"; record.schedule.end = "2020-10-29T11:00:00-07:00";
  await linkInterview(paths, record);
  const notices = await pendingNotices(paths, "website"); expect(notices).toHaveLength(1);
  await acknowledgeNotice(paths, notices[0]!.id, "website"); expect(await pendingNotices(paths, "website")).toEqual([]);
  expect(await pendingNotices(paths, "chat")).toHaveLength(1);
  await acknowledgeNotice(paths, notices[0]!.id, "chat"); expect(await pendingNotices(paths, "chat")).toEqual([]);
  expect(await acknowledgeNotice(paths, notices[0]!.id, "chat")).toBe(false);
  await expect(acknowledgeNotice(paths, "wrong-id", "website")).rejects.toThrow("interview_notice_changed");
});

test("interview browser writes require exact origin, CSRF, JSON and a valid current plan", async () => {
  const { paths, root } = await setup(); await linkInterview(paths, link());
  const server = await startReviewServer({ ...paths, reviewPath: join(root, "drafts"), jobsPath: paths.trackerPath, port: 0 }); servers.push(server);
  const state = await (await fetch(server.address + "/api/interviews/state")).json() as { csrf: string };
  const headers = { "content-type": "application/json", "x-interview-csrf": state.csrf, origin: server.address };
  const post = (extra: Record<string,string>, body = "{}") => fetch(server.address + "/api/interviews/approve-plan", { method: "POST", headers: extra, body });
  expect((await post({ "content-type": "application/json" })).status).toBe(403);
  expect((await post({ ...headers, origin: "https://example.invalid" })).status).toBe(403);
  expect((await post({ ...headers, "x-interview-csrf": "incorrect" })).status).toBe(403);
  expect((await post({ ...headers, "content-type": "text/plain" })).status).toBe(415);
  expect((await post(headers)).status).toBe(400);
  expect((await post(headers, JSON.stringify({ interviewId: "interview-1", expectedRevision: 999, proposalId: "plan-1", proposalHash: "hash-1", proposalVersion: 1, retry: false }))).status).toBe(409);
  expect((await fetch(server.address + "/assets/interview-actions.js")).status).toBe(200);
});
test("same Review service exposes read-only interviews and existing shared lifecycle", async () => {
  const { paths, root } = await setup(); await linkInterview(paths, link());
  const server = await startReviewServer({ ...paths, reviewPath: join(root, "drafts"), jobsPath: paths.trackerPath, port: 0 }); servers.push(server);
  const page = await fetch(server.address + "/interviews"); expect(page.status).toBe(200);
  expect(await page.text()).toContain("Fictional Cedar");
  const status = await (await fetch(server.address + "/status/us")).text(); expect(status).toContain('data-status="interviewing"');
  expect((await fetch(server.address + "/interviews", { method: "POST" })).status).toBe(404);
  expect((await fetch(server.address + "/interviews/../../.google-local/token.json")).status).toBe(404);
});

test("practice asks the question directly and keeps guidance and code in the answer", async () => {
  const { paths } = await setup();
  const data = await snapshot(paths);
  data.materials = { material_format: "simulation-v2", unknowns: [], sections: [{ section_id: "practice", minutes: 15, exercises: [{
    kind: "suggested_practice", exercise_type: "coding", scenario: "A fictional calendar helper needs free time ranges inside one window. Busy ranges may overlap, touch or repeat.",
    prompt: "Implement `available_intervals(start, end, busy)`.", artifacts: [{ label: "Examples", format: "text", content: "1) empty -> full window 2) covered -> []" }],
    constraints: ["Use half-open intervals.", "Do not mutate the input."], follow_ups: ["What if intervals are sorted?", "How do you handle an empty window?"],
    steps: ["Clip and sort busy intervals.", "Merge and emit gaps."], sample_answer: ["```python\nif start > end:\n    raise ValueError()\n```", "Sorting costs O(n log n)."],
    answer_points: ["Internal reference notes"], self_check: ["Internal check"], basis_refs: ["candidate"], timebox_minutes: 15,
    rubric: ["Correctness", "Boundaries", "Complexity"].map(criterion => ({ criterion, strong_answer: "Internal strong answer anchor", common_mistake: "Internal pitfall" }))
  }] }] };
  const primaryExercise = data.materials.sections[0]!.exercises[0]!;
  if (!("scenario" in primaryExercise)) throw new Error("Expected simulation fixture");
  data.materials.question_bank = [{ ...primaryExercise, question_title: "Alternative coding question", question_details: [], plan_section_id: "practice",
    solution: { language: "python", function_name: "free_time", code: "def free_time(start, end):\n    return end - start", complexity: "O(1) time and space.",
      tests: [{ arguments_json: "[0, 5]", expected_json: "5", expected_error: null }] } }];
  const page = renderInterviewPage([{ entry: { ...link(), state: "scheduled", association: { ...link().association, source: "email" }, revision: 1, workspace: null, updatedAt: "2026-10-26T12:00:00Z" }, company: "Fictional Cedar", role: "Graduate ML Engineer", location: "Remote", officialUrl: "https://example.invalid", applicationStage: "interviewing", snapshot: data, problem: null }], "interview-1", "practice");
  for (const heading of ["Follow-ups", "Method", "Sample answer"]) expect(page).toContain(`<h4>${heading}</h4>`);
  expect(page).not.toContain("<h4>Scenario</h4>"); expect(page).not.toContain("<h4>Task</h4>");
  expect(page).toContain("<ol><li>empty -&gt; full window</li><li>covered -&gt; []</li></ol>");
  expect(page).toContain("<pre><code>if start &gt; end:");
  expect(page).not.toContain("Internal reference notes"); expect(page).not.toContain("Internal pitfall");
  expect(page).toContain('<details class="answer-guide"><summary>Show answer</summary>');
  expect(page).toContain("More questions"); expect(page).toContain("Alternative coding question");
  expect(page).toContain("your 30-minute plan stays the same"); expect(page).toContain("Python solution");
  expect(page).toContain("def free_time(start, end):");
});
