import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { z } from "zod";

const record = z.record(z.unknown());
const descriptor = z.object({
  schemaVersion: z.literal(3),
  shared: z.object({ profile: z.string().min(1), experience: z.string().min(1) }).strict(),
  job: record
}).strict();
const sharedProfile = z.object({
  schemaVersion: z.literal(1),
  identity: z.object({ fullName: z.string().min(1) }).passthrough(),
  contact: record,
  languages: z.array(record),
  education: z.array(record),
  school: record,
  links: record,
  highSchool: record,
  _meta: record
}).strict();
const sharedExperience = z.object({
  schemaVersion: z.literal(1),
  experiences: z.array(record), skills: z.array(z.string()), projects: z.array(record),
  publications: z.array(record), _meta: record
}).strict();

/** Compose fresh sources in memory. No cache and no job override of shared facts. */
export async function loadCandidateProfile(
  profilePath: string,
  readText: (path: string) => Promise<string> = (path) => readFile(path, "utf8")
): Promise<Record<string, unknown>> {
  const input = record.parse(JSON.parse(await readText(profilePath)));
  // Historical fixtures and callers can still supply flat v2 data.
  if (input.schemaVersion === 2) return input;
  const config = descriptor.parse(input);
  const base = dirname(profilePath);
  const profile = sharedProfile.parse(JSON.parse(await readText(resolve(base, config.shared.profile))));
  const experience = sharedExperience.parse(JSON.parse(await readText(resolve(base, config.shared.experience))));
  const { schemaVersion: _p, _meta: profileMeta, ...facts } = profile;
  const { schemaVersion: _e, _meta: experienceMeta, ...evidence } = experience;
  for (const key of Object.keys(config.job)) {
    if (Object.hasOwn(facts, key) || Object.hasOwn(evidence, key) || ["schemaVersion", "narrative", "reusableAnswers", "__proto__", "constructor", "prototype"].includes(key)) {
      throw new Error("job_profile_overrides_shared_facts");
    }
  }
  const jobMeta = record.parse(config.job._meta ?? {});
  return {
    ...config.job, ...facts, ...evidence, schemaVersion: 3,
    _meta: {
      ...jobMeta,
      sections: { ...record.parse(jobMeta.sections ?? {}), ...record.parse(profileMeta.sections ?? {}), ...record.parse(experienceMeta.sections ?? {}) },
      conflicts: profileMeta.conflicts ?? [],
      ...(experienceMeta.currentExperienceView === undefined ? {} : { currentExperienceView: experienceMeta.currentExperienceView }),
      ...(experienceMeta.categoryEvidenceNotes === undefined ? {} : { categoryEvidenceNotes: experienceMeta.categoryEvidenceNotes }),
      sharedSources: config.shared
    }
  };
}
