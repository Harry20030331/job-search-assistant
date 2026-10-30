import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadExample } from "../example.js";
import { matchingContext, publishMatchingRound, saveMatchingPreferences, type Assessment, type MatchingPaths } from "./matching.js";
import { rememberWorkspace } from "./workspaces.js";

export const demoRules = {
  categories: ["llm" as const], workModes: ["remote" as const, "hybrid" as const, "onsite" as const],
  locations: ["Seattle, WA"], excludedCompanies: [] as string[], excludedJobIds: [] as string[], limit: 2, perCompany: 1
};

/** Supplied fictional observations, not claims of a live search or model evaluation. */
export function demoAssessments(date: string): Assessment[] {
  return [
    ["north", "North Example", "remote"],
    ["atlas", "Atlas Example", "hybrid"],
    ["meadow", "Meadow Example", "remote"]
  ].map(([id, company, workMode]) => ({
    jobId: `fictional-${id}`, company: company!, title: "Graduate Retrieval Engineer",
    location: "Seattle, WA", category: "llm", officialUrl: `https://jobs.example.com/${id}`,
    sources: ["user-provided"], firstSeen: date, lastVerified: date,
    workMode: workMode as Assessment["workMode"], eligibleLocations: ["Seattle, WA"], decision: "recommend",
    match: ["Entry-level retrieval work fits the supplied candidate's project experience"],
    gaps: ["Production deployment experience is limited"], questions: [],
    candidateEvidence: ["candidate.json: experiences.example-labs and skillDepth"],
    jobEvidence: [`Fictional ${company} brief: BS/MS, 0-2 years, July 2027 start, ${workMode}, Washington eligible, production experience preferred`]
  }));
}

export async function runMatchingDemo(directory: string, registryPath?: string) {
  const root = resolve(directory);
  await mkdir(root, { mode: 0o700 }); // Refuse to overwrite any existing workspace.
  await loadExample(root, resolve(dirname(fileURLToPath(import.meta.url)), "../../examples"));
  const paths: MatchingPaths = { profile: join(root, "data/candidate.json"), preferences: join(root, "data/preferences.md"), manifest: join(root, "data/resumes.json"), opportunities: join(root, "data/opportunities.json") };
  const now = new Date().toISOString();
  const initial = await matchingContext(paths);
  await saveMatchingPreferences(paths, {
    expectedToken: initial.token, initialRules: demoRules,
    feedback: { id: "demo-initial", text: "For this fictional exercise, recommend two Seattle roles, at most one per company.", reference: "Fictional scripted user, round 1", at: now, patch: {} }
  });
  const assessments = demoAssessments(now.slice(0, 10));
  const before = await publishMatchingRound(paths, { version: 1, contextToken: (await matchingContext(paths)).token, assessments });
  await saveMatchingPreferences(paths, {
    expectedToken: (await matchingContext(paths)).token,
    feedback: { id: "demo-remote", text: "Only remote roles; exclude North Example. Keep the other preferences.", reference: "Fictional scripted user, round 2", at: now, patch: { workModes: ["remote"], excludedCompanies: ["North Example"] } }
  });
  // Fixed observations are deliberately reused in this offline mechanics demonstration.
  const after = await publishMatchingRound(paths, { version: 1, contextToken: (await matchingContext(paths)).token, assessments });
  await writeFile(join(root, "matching-demo-report.json"), JSON.stringify({ fictional: true, purpose: "Offline mechanics demonstration; not matching accuracy evidence", before, after }, null, 2), { mode: 0o600 });
  let registryWarning: string | undefined;
  try { await rememberWorkspace(root, registryPath); } catch { registryWarning = "workspace_index_update_failed"; }
  return { root, ...(registryWarning ? { registryWarning } : {}), before: before.results.map(r => ({ jobId: r.jobId, decision: r.decision })), after: after.results.map(r => ({ jobId: r.jobId, decision: r.decision })), report: join(root, "matching-demo-report.json"), paths };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  if (process.argv.length !== 4 || process.argv[2] !== "--dir") throw new Error("Usage: npm run matching:demo -- --dir <new-directory>");
  console.log(JSON.stringify(await runMatchingDemo(process.argv[3]!), null, 2));
}
