import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { z } from "zod";
import { loadCandidateProfile } from "./profile.js";
import { isLegacyResumeCategory, legacyResumeCategories, resumeCategorySchema, type ResumeCategory } from "./classification.js";

/** Historical exported keys; allowed resume categories now come from the selected manifest. */
export const categories = legacyResumeCategories;
export type Category = ResumeCategory;

const manifestSchema = z.array(z.object({
  category: resumeCategorySchema,
  path: z.string().min(1),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i)
}));

const profileSchema = z.object({
  schemaVersion: z.number(),
  identity: z.object({ fullName: z.string().min(1) })
});

const batchItemSchema = z.object({
  applicationId: z.string().min(1),
  jobUrl: z.string(),
  category: z.string()
}).strict();

const batchInputSchema = z.object({
  items: z.array(batchItemSchema).min(1).max(25),
  manifestPath: z.string().min(1),
  profilePath: z.string().min(1)
}).strict();

type Manifest = z.infer<typeof manifestSchema>;

export interface PreflightDependencies {
  readText(path: string): Promise<string>;
  readBytes(path: string): Promise<Buffer>;
}

const defaultDependencies: PreflightDependencies = {
  readText: (path) => readFile(path, "utf8"),
  readBytes: (path) => readFile(path)
};

export interface PreflightInput {
  category: string;
  jobUrl: string;
  manifestPath: string;
  profilePath: string;
}

export interface PreflightResult {
  category: Category;
  jobUrl: string;
  cvPath: string;
  cvSha256: string;
  candidateName: string;
}

export interface BatchPreflightItem {
  applicationId: string;
  jobUrl: string;
  category: string;
}

export interface BatchPreflightInput {
  items: BatchPreflightItem[];
  manifestPath: string;
  profilePath: string;
}

export interface BatchPreflightReady extends PreflightResult {
  applicationId: string;
}

export interface BatchPreflightParked {
  applicationId: string;
  error: "explicit_category_required" | "unsupported_category" | "invalid_job_url";
}

export interface BatchPreflightResult {
  ready: BatchPreflightReady[];
  parked: BatchPreflightParked[];
}

function parseCategory(category: string, manifest?: Manifest): Category {
  if (!category) throw new Error("explicit_category_required");
  const parsedCategory = resumeCategorySchema.safeParse(category);
  if (!parsedCategory.success) throw new Error("unsupported_category");
  if (manifest && !manifest.some(entry => entry.category === category) && !isLegacyResumeCategory(category)) throw new Error("unsupported_category");
  return parsedCategory.data;
}

function parseJobUrl(value: string): string {
  let jobUrl: URL;
  try {
    jobUrl = new URL(value);
  } catch {
    throw new Error("invalid_job_url");
  }
  if (jobUrl.protocol !== "https:") throw new Error("invalid_job_url");
  return jobUrl.toString();
}

async function loadCanonicalInputs(
  profilePath: string,
  manifestPath: string,
  dependencies: PreflightDependencies
): Promise<{ candidateName: string; manifest: Manifest }> {
  const candidate = await loadCandidateProfile(profilePath, dependencies.readText);
  const profile = profileSchema.parse(candidate);
  const source = resolve(manifestPath) === resolve(profilePath)
    ? candidate.resumes
    : JSON.parse(await dependencies.readText(manifestPath));
  const manifest = manifestSchema.parse(source);
  const manifestCategories = manifest.map((entry) => entry.category);
  if (manifest.length === 0 || new Set(manifestCategories).size !== manifest.length) {
    throw new Error("approved_cv_manifest_invalid");
  }
  return {
    candidateName: profile.identity.fullName,
    manifest: manifest.map((entry) => ({ ...entry, path: resolve(dirname(manifestPath), entry.path) }))
  };
}

async function verifyApprovedCv(
  category: Category,
  manifest: Manifest,
  dependencies: PreflightDependencies,
  hashByPath?: Map<string, string>
): Promise<{ cvPath: string; cvSha256: string }> {
  const approved = manifest.find((entry) => entry.category === category);
  if (!approved) throw new Error("approved_cv_not_configured");

  let actualHash = hashByPath?.get(approved.path);
  if (!actualHash) {
    let bytes: Buffer;
    try {
      bytes = await dependencies.readBytes(approved.path);
    } catch {
      throw new Error("approved_cv_missing");
    }
    actualHash = createHash("sha256").update(bytes).digest("hex");
    hashByPath?.set(approved.path, actualHash);
  }
  if (actualHash !== approved.sha256.toLowerCase()) throw new Error("approved_cv_hash_mismatch");
  return { cvPath: approved.path, cvSha256: actualHash };
}

export async function runPreflight(input: PreflightInput): Promise<PreflightResult> {
  const category = parseCategory(input.category);
  const jobUrl = parseJobUrl(input.jobUrl);
  const canonical = await loadCanonicalInputs(input.profilePath, input.manifestPath, defaultDependencies);
  parseCategory(category, canonical.manifest);
  const approved = await verifyApprovedCv(category, canonical.manifest, defaultDependencies);

  return {
    category,
    jobUrl,
    ...approved,
    candidateName: canonical.candidateName
  };
}

export async function runBatchPreflight(
  input: BatchPreflightInput,
  dependencies: PreflightDependencies = defaultDependencies
): Promise<BatchPreflightResult> {
  const parsed = batchInputSchema.safeParse(input);
  if (!parsed.success) throw new Error("invalid_batch_input");

  const applicationIds = new Set<string>();
  for (const item of parsed.data.items) {
    if (applicationIds.has(item.applicationId)) throw new Error("duplicate_application_id");
    applicationIds.add(item.applicationId);
  }

  const canonical = await loadCanonicalInputs(parsed.data.profilePath, parsed.data.manifestPath, dependencies);
  const approvedByCategory = new Map<Category, { cvPath: string; cvSha256: string }>();
  const hashByPath = new Map<string, string>();
  for (const { category } of canonical.manifest) {
    approvedByCategory.set(category, await verifyApprovedCv(category, canonical.manifest, dependencies, hashByPath));
  }

  const ready: BatchPreflightReady[] = [];
  const parked: BatchPreflightParked[] = [];
  for (const item of parsed.data.items) {
    try {
      const category = parseCategory(item.category, canonical.manifest);
      const jobUrl = parseJobUrl(item.jobUrl);
      const approved = approvedByCategory.get(category);
      if (!approved) throw new Error("approved_cv_not_configured");
      ready.push({
        applicationId: item.applicationId,
        category,
        jobUrl,
        ...approved,
        candidateName: canonical.candidateName
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "invalid_batch_input";
      if (message !== "explicit_category_required" && message !== "unsupported_category" && message !== "invalid_job_url") throw error;
      parked.push({ applicationId: item.applicationId, error: message });
    }
  }
  return { ready, parked };
}
