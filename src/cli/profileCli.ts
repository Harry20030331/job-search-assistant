import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { loadCandidateProfile } from "../profile.js";

export function parseProfileArgs(args: readonly string[]): { check: boolean; profilePath: string } {
  let check = false;
  let profilePath: string | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--check" && !check) check = true;
    else if (arg === "--profile" && profilePath === undefined) {
      const value = args[++index];
      if (!value || value.startsWith("--")) throw new Error("invalid_arguments");
      profilePath = resolve(value);
    } else throw new Error("invalid_arguments");
  }
  return { check, profilePath: profilePath ?? resolve(dirname(fileURLToPath(import.meta.url)), "../../data/candidate.json") };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    const args = parseProfileArgs(process.argv.slice(2));
    const profile = await loadCandidateProfile(args.profilePath);
    process.stdout.write(JSON.stringify(args.check ? { ok: true, schemaVersion: profile.schemaVersion } : profile, null, 2) + "\n");
  } catch {
    process.stderr.write("candidate_profile_invalid\n");
    process.exitCode = 1;
  }
}
