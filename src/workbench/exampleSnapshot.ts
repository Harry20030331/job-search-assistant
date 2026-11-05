import { fileURLToPath } from "node:url";
import { readJobLibrary } from "../jobs/jobLibrary.js";
import { renderUsStatusPage } from "../review/reviewViews.js";
import { buildStatusView } from "../review/statusView.js";
import { userFiles } from "../storage/userWorkspace.js";
import { renderProfilePage } from "./profileView.js";
import { readProfileEditor } from "./profileStore.js";
import { page, escapeText } from "./views.js";
import { exampleReview, exampleInterview, exampleQuery } from "./exampleWorkflow.js";

const seed = fileURLToPath(new URL("../../evaluation/cases/alex/", import.meta.url));

/** Read only the authored case. Snapshot pages never open a runner or a user workspace. */
export async function renderExampleSnapshot(url: URL): Promise<string | undefined> {
  const path = url.pathname;
  const jobs = await readJobLibrary(userFiles(seed).opportunities);
  const ids = new Set(url.searchParams.getAll("job"));
  const selected = jobs.filter(job => ids.has(job.jobId));
  if (selected.length !== ids.size) return undefined;
  const stage = url.searchParams.get("stage") ?? "";
  const focus = selected.find(job => job.jobId === url.searchParams.get("focus"));
  const query = selected.length ? escapeText(exampleQuery(selected, stage, focus?.jobId)) : "";
  // Preserve the displayed checkpoint when a visitor opens a profile or a job and returns to Status.
  function navigation(html: string) {
    return html.replaceAll('href="/example"', `href="/example${query}"`)
      .replaceAll('href="/example/profile"', `href="/example/profile${query}"`)
      .replace(/href="(\/example\/jobs\/[^"?]+)"/g, `href="$1${query}"`);
  }
  if (path === "/example/profile") {
    return navigation(renderProfilePage(await readProfileEditor(seed), true));
  }
  if (path === "/example/review") {
    if (!selected.length) return undefined;
    return navigation(exampleReview(selected));
  }
  if (path === "/example/interview") {
    if (!focus) return undefined;
    return navigation(exampleInterview(selected, focus));
  }
  if (path === "/example" || path === "/example/") {
    const items = buildStatusView([], jobs);
    const profile = await readProfileEditor(seed);
    for (const item of items) {
      const resume = profile.manifest.find(entry => entry.category === item.category);
      if (resume) item.resumeRecommendation = {
        profileKey: resume.category, sha256: resume.sha256, status: "matched",
        confidence: 1, contextToken: profile.token, evaluatedAt: item.dateTime
      };
    }
    for (const item of items.filter(item => ids.has(item.jobId))) {
      if (stage === "submitted" || stage === "interviewing") {
        item.status = stage === "interviewing" && item.jobId === focus?.jobId ? "interviewing" : "submitted";
        item.interviewHref = "/example/interview" + exampleQuery(selected, "interviewing", item.jobId);
      } else if (stage === "in_review") {
        item.status = "in_review";
      }
    }
    return navigation(renderUsStatusPage(items, true, selected.length ? "/example/review" + exampleQuery(selected, "in_review") : undefined));
  }
  const job = jobs.find(item => path === "/example/jobs/" + encodeURIComponent(item.jobId));
  if (!job) return undefined;
  let action = "";
  if (!selected.length) action = `<a class="primary" href="/example/review${escapeText(exampleQuery([job], "in_review"))}">Apply</a>`;
  else if (ids.has(job.jobId)) {
    action = stage === "in_review"
      ? `<a class="primary" href="/example/review${query}">Review</a>`
      : `<a class="primary" href="/example/interview${escapeText(exampleQuery(selected, "interviewing", job.jobId))}">Interview</a>`;
  }
  return navigation(page(job.title, "status", `<nav class="task-context"><a href="/example">← Back to jobs</a></nav><h1>${escapeText(job.title)}</h1><p>${escapeText(job.company)} · ${escapeText(job.location)}</p><p>${escapeText(job.note)}</p>${action}`, "", true));
}
