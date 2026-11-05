import type { JobRecord } from "../jobs/jobLibrary.js";
import { page, escapeText as esc } from "./views.js";

// Authored against Alex's pilot profile. These responses and interview prompts
// are stable for each job and require no model, queue, or employer connection.
const briefs: Record<string, { answer: string; focus: string; prompt: string; followUp: string }> = {
  A1: {
    answer: "At Example Labs I built ingestion and citation checks for a hybrid document search prototype. Recall@5 improved from 0.64 to 0.79 on a fixed 60-question development set. I would validate the change on held-out queries before claiming it generalizes.",
    focus: "Retrieval evaluation", prompt: "A search change improves Recall@5, but users report worse citations. How would you investigate?",
    followUp: "Separate retrieval failures from citation failures. Describe a held-out test that would catch both."
  },
  A2: {
    answer: "On Agent Task Bench, our three-person team built a tool-using assistant with replayable synthetic tasks. I owned tool validation and failure analysis, including checks around approval gates.",
    focus: "Reliable tool execution", prompt: "A tool succeeds but its response times out. How would you retry safely?",
    followUp: "Trace one request through validation, an approval gate, and replay. Identify which part Alex owned."
  },
  A3: {
    answer: "I built a retrieval assistant for synthetic course notes and own its ingestion and evaluation. I am based in Seattle. I would need to discuss the New York relocation requirement before confirming availability.",
    focus: "Grounded answers", prompt: "How would you detect an answer that cites a relevant document but makes an unsupported claim?",
    followUp: "Walk through one citation check, then clarify the four-day onsite requirement."
  },
  A4: {
    answer: "My experience is in graduate research and prototype engineering. I have not led a production Kubernetes deployment or held a staff-level role. My relevant work is building and evaluating small retrieval systems.",
    focus: "System design and scope", prompt: "How would you take a local evaluation pipeline to a distributed training environment?",
    followUp: "Distinguish the components Alex has implemented from the production design he would propose."
  },
  A5: {
    answer: "For Study Search, I built ingestion and deterministic regression checks over synthetic course notes. I would bring that same approach to diagnosing indexing changes and relevance regressions.",
    focus: "Indexing and relevance", prompt: "After a partial reindex, some documents disappear from search. How would you isolate the failure?",
    followUp: "Describe an index consistency check and a relevance test to run before rollout."
  }
};

export function exampleQuery(jobs: readonly JobRecord[], stage: string, focus?: string) {
  const query = new URLSearchParams({ stage });
  for (const job of jobs) query.append("job", job.jobId);
  if (focus) query.set("focus", focus);
  return "?" + query.toString();
}

const styles = `<style>
.snapshot-sheet{max-width:760px}.snapshot-sheet h1{margin:8px 0 28px}.snapshot-sheet h2{font-size:19px;line-height:1.45;margin:0 0 6px}.snapshot-sheet p{line-height:1.65;margin:8px 0}.snapshot-sheet article{padding:22px 0;border-top:1px solid #dce1e5}.snapshot-sheet .context{color:#505963;font-size:14px}body .snapshot-sheet .primary{background:#e7eaed;border-color:#cbd1d6;color:#202326}
body .snapshot-sheet .primary:not(:disabled):hover{background:#d9dee3;border-color:#adb5bd;color:#202326}
body .snapshot-sheet .primary:focus-visible{outline:2px solid #39434d;outline-offset:3px}
</style>`;

export function exampleReview(jobs: readonly JobRecord[]) {
  const answers = jobs.map(job => `<article><h2>${esc(job.company)}</h2><p class="context">${esc(job.title)} · ${esc(job.location)}</p><h3>Describe your relevant experience.</h3><p>${esc(briefs[job.jobId]!.answer)}</p></article>`).join("");
  const body = `<section class="snapshot-sheet"><p class="context">Alex Liu · Application snapshot</p><h1>In Review</h1>${answers}<a class="primary" href="/example${esc(exampleQuery(jobs,"submitted"))}">Approve${jobs.length > 1 ? " (" + jobs.length + ")" : ""}</a></section>`;
  return page("In Review", "review", body, "", true).replace("</head>", styles + "</head>");
}

export function exampleInterview(jobs: readonly JobRecord[], job: JobRecord) {
  const brief = briefs[job.jobId]!;
  const body = `<section class="snapshot-sheet"><p class="context">Alex Liu · Interview snapshot</p><h1>Interview preparation</h1><article><h2>${esc(job.company)}</h2><p>${esc(job.title)}</p><p class="context">Technical screen · 30 minutes</p></article><article><h2>${esc(brief.focus)}</h2><p>${esc(brief.prompt)}</p><details><summary>Practice notes</summary><p>${esc(brief.followUp)}</p></details></article><a class="primary" href="/example${esc(exampleQuery(jobs, "interviewing", job.jobId))}">View pipeline</a></section>`;
  return page("Interview preparation", "interviews", body, "", true).replace("</head>", styles + "</head>");
}
