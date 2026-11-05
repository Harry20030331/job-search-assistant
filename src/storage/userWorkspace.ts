import { existsSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

/** Detect the layout of the selected workspace, including pre-existing flat workspaces. */
export function userFiles(directory: string) {
  return filesInData(resolve(directory, "data"));
}

export function filesInData(data: string) {
  const grouped = existsSync(join(data, "opportunities", "opportunities.json"));
  const profile = grouped ? join(data, "profile") : data;
  const roles = grouped ? join(data, "opportunities") : data;
  const preferences = join(profile, "preferences");
  const candidate = join(profile, "candidate.json");
  const separateManifest = join(profile, "resumes.json");
  // Existing grouped workspaces can still use their original sidecar and flat runtime.
  const manifest = grouped && !existsSync(separateManifest) ? candidate : separateManifest;
  const runtime = grouped && existsSync(join(data, "runtime")) ? join(data, "runtime") : data;
  return {
    grouped, data, profile: candidate, manifest, runtime,
    tasks: join(runtime, "application-tasks.json"), chat: join(runtime, "chat-runner.json"),
    preferences: grouped ? join(preferences, "job-selection.md") : join(data, "preferences.md"),
    application: join(preferences, "application-answers.md"), interview: join(preferences, "interview-preparation.md"),
    sessions: join(data, "sessions"), opportunities: join(roles, "opportunities.json"),
    drafts: grouped ? roles : join(data, "drafts")
  };
}

/** Interview commands historically accept the data directory; also accept a workspace root. */
export function filesForRuntime(directory: string) {
  const workspace = userFiles(directory);
  return existsSync(workspace.opportunities) ? workspace : filesInData(directory);
}

export function dataForTracker(tracker: string) {
  const parent = dirname(tracker);
  return basename(parent) === "opportunities" && basename(dirname(parent)) === "data" ? dirname(parent) : parent;
}

export function jobFolder(roles: string, jobId: string) {
  // Prefix keeps special names such as ".." and "registry.json" out of the parent namespace.
  return join(roles, "job-" + encodeURIComponent(jobId));
}
