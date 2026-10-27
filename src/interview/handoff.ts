import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { z } from "zod";
import { loadCandidateProfile } from "../profile.js";
import { parseOpportunities } from "../storage/opportunities.js";

const settingsSchema = z.object({
  schemaVersion: z.literal(1),
  interviewId: z.string().min(1),
  round: z.string().min(1).nullable(),
  timezone: z.string().min(1).refine(value => {
    try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; }
  }),
  preparationBudgetMinutes: z.number().int().min(3).max(480),
  priorities: z.array(z.string().trim().min(1)).min(1)
}).strict();

export interface InterviewPaths {
  profile: string;
  preferences: string;
  opportunities: string;
  settings: string;
  invitation: string;
}
export interface SourceVersion { path: string; sha256: string }
export const sha256 = (text: string | Buffer) => createHash("sha256").update(text).digest("hex");

/** Read-only projection of canonical sources, never a second job/profile store. */
export async function interviewHandoff(paths: InterviewPaths, jobId: string) {
  const sources = new Map<string, SourceVersion>();
  async function readText(path: string): Promise<string> {
    const absolute = resolve(path), bytes = await readFile(absolute);
    sources.set(absolute, { path: absolute, sha256: sha256(bytes) });
    return bytes.toString("utf8");
  }
  const candidate = await loadCandidateProfile(resolve(paths.profile), readText);
  const preferences = await readText(paths.preferences);
  // Use the shared parser without writing or extending the opportunity schema.
  const opportunityBytes = await readText(paths.opportunities);
  const opportunity = parseOpportunities(JSON.parse(opportunityBytes)).opportunities.find(item => item.jobId === jobId);
  if (!opportunity) throw new Error("interview_job_not_found");
  const settings = settingsSchema.parse(JSON.parse(await readText(paths.settings)));
  const invitation = await readText(paths.invitation);
  if (!invitation.trim()) throw new Error("interview_invitation_required");
  const identity = z.object({ fullName: z.string().trim().min(1) }).passthrough().parse(candidate.identity);
  const facts = Object.fromEntries(["identity", "education", "experiences", "skills", "projects", "publications", "languages"]
    .filter(key => candidate[key] !== undefined).map(key => [key, candidate[key]]));
  const profile = {
    source_id: "profile", name: identity.fullName, timezone: settings.timezone,
    preparation_budget_minutes: settings.preparationBudgetMinutes, priorities: settings.priorities,
    ...facts,
    provenance: "Read-only snapshot of the selected canonical candidate; unknown facts remain unknown."
  };
  const application = {
    job_id: opportunity.jobId, application_id: opportunity.application?.applicationId ?? null,
    interview_id: settings.interviewId, company: opportunity.company, role: opportunity.title,
    round: settings.round, category: opportunity.category, official_url: opportunity.officialUrl,
    notes: "Explicit host-selected opportunity link; this does not prove email identity or authorize any action."
  };
  const versions = [...sources.values()].sort((a, b) => a.path.localeCompare(b.path));
  // Local source identity, not a new field in the shared candidate/job schema.
  // Job-specific v3 descriptors resolve to the same selected shared profile.
  const shared = candidate.schemaVersion === 3
    ? z.object({ sharedSources: z.object({ profile: z.string() }) }).parse(candidate._meta).sharedSources
    : null;
  const candidateSource = { protocol: "candidate-source-v1" as const,
    profile_path: shared ? resolve(dirname(resolve(paths.profile)), shared.profile) : resolve(paths.profile) };
  // Refuse mixed reads if any source changed while the handoff was assembled.
  await checkInterviewSources(versions);
  const payload = {
    schemaVersion: 1 as const, profile, application, candidateSource,
    sources: { "canonical-candidate": JSON.stringify(facts, null, 2), preferences, invitation },
    sourceVersions: versions
  };
  return { ...payload, token: sha256(JSON.stringify(payload)) };
}

export async function checkInterviewSources(versions: SourceVersion[]): Promise<void> {
  for (const source of versions) {
    if (sha256(await readFile(source.path)) !== source.sha256) throw new Error("interview_sources_changed");
  }
}
