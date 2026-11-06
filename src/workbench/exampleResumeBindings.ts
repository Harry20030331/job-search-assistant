import { matchingContext } from "../matching/matching.js";
import { workspaceMatchingPaths } from "../matching/intake.js";
import { readJobLibrary, upsertJob } from "../jobs/jobLibrary.js";
import { runPreflight } from "../preflight.js";

// Authored website-demo bindings, not an inference from a job direction or a Jev result.
const bindings: Record<string, string> = { A1: "llm", A2: "llm", A3: "llm", A4: "llm", A5: "llm" };

/** Seed only the website's isolated copy; leave the unscreened research case unchanged. */
export async function seedExampleResumeBindings(workspace: string) {
  const paths = workspaceMatchingPaths(workspace);
  const context = await matchingContext(paths);
  if (context.candidate.fictional !== true) throw new Error("fictional_example_required");
  const jobs = await readJobLibrary(paths.opportunities);
  for (const job of jobs) {
    const profileKey = bindings[job.jobId];
    if (!profileKey || job.officialUrl !== `https://example.invalid/jobs/${job.jobId}` || job.resumeRecommendation) continue;
    const checked = await runPreflight({ category: profileKey, jobUrl: job.officialUrl, profilePath: paths.profile, manifestPath: paths.manifest });
    const { status: _status, ...input } = job;
    await upsertJob(paths.opportunities, { ...input, resumeRecommendation: {
      profileKey, sha256: checked.cvSha256, status: "matched", confidence: 1,
      contextToken: context.token, evaluatedAt: new Date().toISOString()
    } });
  }
}
