import { createHash, randomUUID } from "node:crypto";
import { readFile, realpath, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { z } from "zod";
import { loadCandidateProfile } from "../profile.js";
import { acquireFileLock } from "../recordLock.js";
import { normalizeOfficialUrl, upsertRecord } from "../jobs/jobLibrary.js";
import { mergeJobs, projectJobs, transactOpportunities } from "../storage/opportunities.js";
import { jobDirectionSchema } from "../classification.js";
import { jobSources } from "../jobs/sources.js";

const text = z.string().trim().min(1).max(2000).refine(s => !/[\r\n]/.test(s));
const category = jobDirectionSchema;
const mode = z.enum(["remote", "hybrid", "onsite"]);
const rulesSchema = z.object({
  categories: z.array(category).min(1),
  workModes: z.array(mode).min(1),
  locations: z.array(text),
  excludedCompanies: z.array(text),
  excludedJobIds: z.array(text),
  limit: z.number().int().min(1).max(25),
  perCompany: z.number().int().min(1).max(25)
}).strict();
const feedbackSchema = z.object({
  id: text, text, reference: text, at: z.string().datetime(),
  patch: rulesSchema.partial()
}).strict();
const policySchema = z.object({
  version: z.literal(1), rules: rulesSchema,
  feedback: z.array(feedbackSchema)
}).strict();
const begin = "<!-- matching-policy:v1 -->";
const end = "<!-- /matching-policy -->";
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const equal = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const managed = (note: string) => note.startsWith("matching:") || note.startsWith("user-excluded: matching:");

function readPolicy(markdown: string) {
  if (!markdown.includes(begin) && !markdown.includes(end)) return null;
  if (markdown.split(begin).length !== 2 || markdown.split(end).length !== 2) throw new Error("invalid_matching_policy");
  const start = markdown.indexOf(begin) + begin.length;
  const stop = markdown.indexOf(end);
  if (stop < start) throw new Error("invalid_matching_policy");
  return policySchema.parse(JSON.parse(markdown.slice(start, stop).trim()));
}

export interface MatchingPaths { profile: string; preferences: string; manifest: string; opportunities: string }

/** The agent must read all inputs; a hash binds its analysis to this exact context. */
export async function matchingContext(paths: MatchingPaths) {
  const [candidate, preferences, manifestText] = await Promise.all([
    loadCandidateProfile(paths.profile), readFile(paths.preferences, "utf8"), readFile(paths.manifest, "utf8")
  ]);
  const manifest = z.array(z.object({ category: z.string(), path: z.string(), sha256: z.string() })).parse(JSON.parse(manifestText));
  const policy = readPolicy(preferences);
  return { token: hash(JSON.stringify({ candidate, preferences, manifestText })), candidate, preferences, manifest, policy,
    availableResumeCategories: manifest.map(entry => entry.category) };
}

const queues = new Map<string, Promise<unknown>>();
async function withPreferences<T>(path: string, task: () => Promise<T>): Promise<T> {
  const key = await realpath(path);
  const result = (queues.get(key) ?? Promise.resolve()).catch(() => undefined).then(async () => {
    const unlock = await acquireFileLock(key);
    try { return await task(); } finally { await unlock(); }
  });
  queues.set(key, result);
  try { return await result; } finally { if (queues.get(key) === result) queues.delete(key); }
}

/** Narrow preference edit: preserve prose, keep feedback in the canonical preferences source. */
export async function saveMatchingPreferences(paths: MatchingPaths, input: unknown) {
  const command = z.object({
    expectedToken: text,
    initialRules: rulesSchema.optional(),
    feedback: feedbackSchema
  }).strict().parse(input);
  return withPreferences(paths.preferences, async () => {
    const context = await matchingContext(paths);
    if (context.token !== command.expectedToken) throw new Error("matching_context_changed");
    const previous = context.policy;
    if (previous?.feedback.some(f => f.id === command.feedback.id)) throw new Error("duplicate_feedback_id");
    if (previous && command.initialRules) throw new Error("matching_policy_already_exists");
    if (!previous && !command.initialRules) throw new Error("matching_initial_rules_required");
    const policy = policySchema.parse({ version: 1,
      rules: { ...(previous?.rules ?? command.initialRules), ...command.feedback.patch },
      feedback: [...(previous?.feedback ?? []), command.feedback]
    });
    const block = `${begin}\n${JSON.stringify(policy, null, 2)}\n${end}`;
    const updated = previous
      ? context.preferences.slice(0, context.preferences.indexOf(begin)) + block + context.preferences.slice(context.preferences.indexOf(end) + end.length)
      : context.preferences + `\n\n## Confirmed Matching preferences\n\n${block}\n`;
    const temporary = join(dirname(paths.preferences), `.${randomUUID()}.tmp`);
    await writeFile(temporary, updated, { mode: 0o600 });
    await rename(temporary, paths.preferences);
    return { ok: true, requiresRescreen: true, context: await matchingContext(paths) };
  });
}

const assessmentSchema = z.object({
  jobId: text, company: text, title: text, location: text, category,
  officialUrl: z.string().url().startsWith("https://"),
  sources: z.array(z.enum(jobSources)).min(1),
  firstSeen: z.string().date(), lastVerified: z.string().date(),
  workMode: mode.nullable(),
  eligibleLocations: z.array(text),
  decision: z.enum(["recommend", "needs_confirmation", "reject"]),
  match: z.array(text).min(1), gaps: z.array(text), questions: z.array(text),
  candidateEvidence: z.array(text).min(1), jobEvidence: z.array(text).min(1)
}).strict();
export type Assessment = z.infer<typeof assessmentSchema>;
const roundSchema = z.object({ version: z.literal(1), contextToken: text, assessments: z.array(assessmentSchema).min(1).max(100) }).strict();

/** Language reasoning belongs to Codex. This gate enforces explicit structured constraints. */
export async function publishMatchingRound(paths: MatchingPaths, input: unknown) {
  const round = roundSchema.parse(input);
  return withPreferences(paths.preferences, async () => {
    const context = await matchingContext(paths);
    if (context.token !== round.contextToken) throw new Error("matching_context_changed");
    if (!context.policy) throw new Error("matching_initial_rules_required");
    const rules = context.policy.rules;
    // One transaction prevents partially published rounds and races with Submission.
    return transactOpportunities(paths.opportunities, document => {
      const ids = new Set<string>(), urls = new Set<string>();
      const counts = new Map<string, number>();
      let selected = 0;
      const results = round.assessments.map(input => {
        const existing = document.opportunities.find(j => j.jobId === input.jobId || normalizeOfficialUrl(j.officialUrl) === normalizeOfficialUrl(input.officialUrl));
        if (existing && normalizeOfficialUrl(existing.officialUrl) !== normalizeOfficialUrl(input.officialUrl)) throw new Error("matching_identity_changed");
        const a = { ...input, jobId: existing?.jobId ?? input.jobId };
        const url = normalizeOfficialUrl(a.officialUrl);
        if (ids.has(a.jobId) || urls.has(url)) throw new Error("duplicate_matching_assessment");
        ids.add(a.jobId); urls.add(url);
        if (a.firstSeen > a.lastVerified) throw new Error("invalid_matching_dates");
        const reasons: string[] = [];
        if (!rules.categories.some(direction => equal(direction, a.category))) reasons.push("Direction excluded by preferences");
        if (rules.excludedJobIds.includes(a.jobId)) reasons.push("Job excluded by user");
        if (rules.excludedCompanies.some(c => equal(c, a.company))) reasons.push("Company excluded by user");
        if (a.workMode && !rules.workModes.includes(a.workMode)) reasons.push("Work mode excluded by preferences");
        if (rules.locations.length && a.eligibleLocations.length && !a.eligibleLocations.some(l => rules.locations.some(p => equal(l, p)))) reasons.push("Location excluded by preferences");
        const questions = [...a.questions];
        if (!a.workMode && new Set(rules.workModes).size < 3) questions.push("Confirm permitted work mode");
        if (rules.locations.length && !a.eligibleLocations.length) questions.push("Confirm permitted work location");
        let decision = reasons.length || a.decision === "reject" ? "reject" : questions.length || a.decision === "needs_confirmation" ? "needs_confirmation" : "recommend";
        const company = a.company.trim().toLowerCase();
        if (existing?.application || existing?.availability === "closed") decision = "protected";
        if (decision === "recommend") {
          if (selected >= rules.limit || (counts.get(company) ?? 0) >= rules.perCompany) {
            decision = "deferred";
            reasons.push("Outside the configured shortlist or employer limit");
          } else { selected++; counts.set(company, (counts.get(company) ?? 0) + 1); }
        }
        return { ...a, officialUrl: url, decision, reasons, questions };
      });
      const existingJobs = projectJobs(document);
      for (const item of document.opportunities) {
        if (!item.application && item.availability !== "closed" && managed(item.note) && !urls.has(normalizeOfficialUrl(item.officialUrl))) throw new Error("matching_round_incomplete");
      }
      const protectedIds: string[] = [];
      for (const result of results) {
        const existing = document.opportunities.find(j => j.jobId === result.jobId || normalizeOfficialUrl(j.officialUrl) === result.officialUrl);
        if (existing && normalizeOfficialUrl(existing.officialUrl) !== result.officialUrl) throw new Error("matching_identity_changed");
        if (existing) result.jobId = existing.jobId;
        if (existing?.application || existing?.availability === "closed") { protectedIds.push(result.jobId); continue; }
        if (existing && result.lastVerified < existing.lastVerified) throw new Error("matching_observation_outdated");
        if (!["recommend", "needs_confirmation"].includes(result.decision) && !existing) continue;
        const explanation = `Match: ${result.match.join("; ")}. Gaps: ${result.gaps.join("; ") || "None recorded"}. Questions: ${result.questions.join("; ") || "None"}. ${result.reasons.join("; ")}. Evidence: ${result.candidateEvidence.join("; ")}; ${result.jobEvidence.join("; ")}`;
        const preferenceProofMissing = (new Set(rules.workModes).size < 3 && !result.workMode) || (rules.locations.length > 0 && !result.eligibleLocations.length);
        const visible = result.decision === "recommend" || (result.decision === "needs_confirmation" && !preferenceProofMissing);
        const note = `${visible ? "" : "user-excluded: "}matching: ${result.decision}. ${explanation}`;
        const { jobId, company, title, location, category, officialUrl, sources, firstSeen, lastVerified } = result;
        const record = upsertRecord(existingJobs, { jobId, company, title, location, category, officialUrl, sources, firstSeen, lastVerified, note, status: "ready" });
        record.status = result.decision === "recommend" ? "ready" : "new";
        mergeJobs(document, [record]);
      }
      return { ok: true, contextToken: context.token, results, protectedIds };
    });
  });
}
