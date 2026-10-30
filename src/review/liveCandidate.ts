import { join } from "node:path";
import { loadCandidateProfile } from "../profile.js";

/** Check fresh, composed inputs for both chat and background execution. */
export async function assertLiveCandidate(projectRoot: string): Promise<void> {
  const candidate = await loadCandidateProfile(join(projectRoot, "data/candidate.json"));
  const contact = candidate.contact as { email?: unknown } | undefined;
  const email = typeof contact?.email === "string" ? contact.email.trim() : "";
  const domain = email.split("@")[1]?.toLowerCase();
  if (candidate.fictional === true || (domain && /(?:^|\.)(?:example\.(?:com|org|net)|test|invalid|localhost)$/.test(domain))) {
    throw new Error("This workspace uses fictional candidate data. Use Demo mode for a local rehearsal.");
  }
  if (!domain) throw new Error("A candidate email is required before live execution.");
}
