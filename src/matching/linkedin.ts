import { z } from "zod";

const text = z.string().trim().min(1).max(4000);
const fact = <T extends z.ZodTypeAny>(value: T) => z.object({ value, evidence: text }).strict();
const education = z.object({ institution: text, degree: text.optional(), field: text.optional(), startDate: text.optional(), endDate: text.nullable().optional(), status: text.optional() }).strict();
const experience = z.object({ employer: text, title: text, location: text.optional(), employmentType: text.optional(), startDate: text.optional(), endDate: text.nullable().optional(), description: text.optional() }).strict();
const sectionsSchema = z.object({
  fullName: fact(text).optional(), headline: fact(text).optional(),
  education: z.array(fact(education)).max(100).optional(),
  experiences: z.array(fact(experience)).max(100).optional(),
  skills: z.array(fact(text)).max(200).optional()
}).strict();
const observationSchema = z.object({
  sourceUrl: text, observedUrl: text, observedAt: z.string().datetime(),
  access: z.enum(["visible", "login_required", "unavailable"]),
  sections: sectionsSchema.default({})
}).strict();

/** Accept only the user-designated profile, not job pages or lookalike domains. */
export function linkedInProfileUrl(raw: string): string {
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error("linkedin_profile_url_required"); }
  const match = /^\/in\/([^/]+)(?:\/(?:details\/(?:education|experience|skills)\/)?)?$/.exec(url.pathname);
  if (url.protocol !== "https:" || !["linkedin.com", "www.linkedin.com"].includes(url.hostname) || url.username || url.password || url.port || !match) throw new Error("linkedin_profile_url_required");
  return `https://www.linkedin.com/in/${match[1]}/`;
}

/** Codex supplies observed visible facts; this read-only mapper cannot browse or save a candidate. */
export function previewLinkedInImport(input: unknown, existing?: Record<string, unknown>) {
  const observation = observationSchema.parse(input);
  const sourceUrl = linkedInProfileUrl(observation.sourceUrl);
  if (observation.access !== "visible") {
    if (Object.keys(observation.sections).length) throw new Error("linkedin_unavailable_facts_rejected");
    return { status: "blocked", sourceUrl, proposal: null, conflicts: [], message: "I could not read the specified LinkedIn profile. You can paste its text, provide a LinkedIn export or resume, or enter your background manually. A resume is optional." };
  }
  if (linkedInProfileUrl(observation.observedUrl) !== sourceUrl) throw new Error("linkedin_profile_identity_mismatch");
  const s = observation.sections;
  const proposal: Record<string, unknown> = { schemaVersion: 2, links: { linkedin: sourceUrl } };
  const evidence: { field: string; reference: string }[] = [];
  if (s.fullName) { proposal.identity = { fullName: s.fullName.value }; evidence.push({ field: "identity.fullName", reference: s.fullName.evidence }); }
  if (s.headline) { proposal.summary = s.headline.value; evidence.push({ field: "summary", reference: s.headline.evidence }); }
  for (const key of ["education", "experiences", "skills"] as const) {
    if (s[key]) {
      proposal[key] = s[key].map(f => f.value);
      s[key].forEach((f, i) => evidence.push({ field: `${key}.${i}`, reference: f.evidence }));
    }
  }
  proposal._meta = { linkedinImport: { sourceUrl, observedAt: observation.observedAt, state: "pending_confirmation", evidence } };
  const missingForSearch: string[] = [];
  if (!s.fullName) missingForSearch.push("Name or alias");
  if (!s.headline) missingForSearch.push("Background summary");
  if (!s.skills?.length) missingForSearch.push("Core skills");
  if (!s.education?.length && !s.experiences?.length) missingForSearch.push("Education or work experience");
  const conflicts: { field: string; existing: unknown; imported: unknown }[] = [];
  const compare = (value: unknown, previous: unknown, field: string) => {
    if (previous === undefined || previous === null || previous === "" || (Array.isArray(previous) && !previous.length)) return;
    if (value && previous && typeof value === "object" && typeof previous === "object" && !Array.isArray(value) && !Array.isArray(previous)) {
      for (const [key, child] of Object.entries(value)) compare(child, (previous as Record<string, unknown>)[key], field ? `${field}.${key}` : key);
    } else if (JSON.stringify(value) !== JSON.stringify(previous)) conflicts.push({ field, existing: previous, imported: value });
  };
  if (existing) for (const [key, value] of Object.entries(proposal)) if (!["schemaVersion", "_meta"].includes(key)) compare(value, existing[key], key);
  return { status: "needs_confirmation", sourceUrl, proposal, conflicts, missingForSearch,
    preferencesToAsk: ["Target roles/category", "Locations and work modes", "Start timing", "Search and employer limits"],
    message: "Please review the imported facts and any missing information. Nothing has been saved. Existing candidate facts have not been changed." };
}
