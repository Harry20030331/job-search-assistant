import { writePrivateFile as writeFile } from "../storage/privateFiles.js";
import { mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { interviewHandoff } from "./handoff.js";
import { stageInterview } from "../cli/interviewCli.js";
import { linkInterview, publishInterview } from "./workbench.js";
import { startReviewServer } from "../review/reviewServer.js";

const pythonRoot = resolve(dirname(fileURLToPath(import.meta.url)), "python");
async function json(path: string, data: unknown) { await writeFile(path, JSON.stringify(data, null, 2) + "\n", { mode: 0o600 }); }
export async function createInterviewPreview(output: string) {
  output = resolve(output);
  await mkdir(output, { recursive: false }); // Never reset another candidate or an existing preview.
  await mkdir(join(output, "drafts"));
  const profilePath = join(output, "candidate.json"), trackerPath = join(output, "opportunities.json");
  await json(profilePath, { schemaVersion: 2, identity: { fullName: "Alex Reed (fictional preview)" }, education: [], skills: ["Python"], experiences: [], publications: [], languages: [],
    projects: [{ description: "Compared two classifiers on a public synthetic dataset and wrote an error-analysis notebook." },
      { description: "Built a course transit-status API with a teammate, implemented request validation and wrote integration tests. Production ownership is not established." }] });
  await writeFile(join(output, "preferences.md"), "Fictional UI preview only. Keep all achievements, feedback and motivations truthful. Never submit this candidate to an employer.\n");
  const cases = [
    { id: "preview-modeling", company: "Indigo Health Tools", role: "Junior Modeling Data Scientist", location: "San Francisco, CA", round: "technical", budget: 50, state: "scheduled", recipe: "plan", start: "2026-10-29T10:00:00-07:00", end: "2026-10-29T11:00:00-07:00", invitation: "Fictional invitation: this technical round focuses on experiment design and product metrics. Model implementation is not assessed in this round." },
    { id: "preview-recruiter", company: "Cobalt Transit", role: "Graduate Backend Engineer", location: "Remote", round: "recruiter", budget: 20, state: "scheduled", recipe: "materials", start: "2026-10-30T13:00:00-07:00", end: "2026-10-30T13:30:00-07:00", invitation: "Fictional invitation: a recruiter conversation about your background, interest in the role and collaboration. No live coding." },
    { id: "preview-completed", company: "Harbor Relay", role: "Graduate Software Engineer", location: "Seattle, WA", round: "technical", budget: 60, state: "completed", recipe: "debrief", start: "2026-10-24T09:00:00-07:00", end: "2026-10-24T10:00:00-07:00", invitation: "Fictional technical round: implement an interval algorithm and discuss request validation, retries and idempotency in a small service. This is an early-career exercise, not a distributed architecture interview. No interview outcome is established." }
  ];
  await json(trackerPath, { schemaVersion: 1, opportunities: cases.map(c => ({ jobId: c.id, company: c.company, title: c.role, location: c.location, category: "recommendation",
    officialUrl: "https://preview.example.invalid/jobs/" + c.id, sources: ["user-provided"], firstSeen: "2026-10-20", lastVerified: "2026-10-20", note: "Authored fictional local preview, not evaluation evidence.", availability: "open", stage: "submitted",
    application: { applicationId: c.id + "-application", ats: "ashby", applicationUrl: "https://preview.example.invalid/jobs/" + c.id + "/apply", cvFilename: "fictional-preview.pdf",
      visibleResult: "submitted", gmailConfirmation: "not_checked", createdAt: "2026-10-20T10:00:00Z", updatedAt: "2026-10-20T12:00:00Z", submittedAt: "2026-10-20T11:00:00Z",
      websiteConfirmation: { reference: "Authored fictional submission evidence for isolated UI preview only.", verifiedAt: "2026-10-20T12:00:00Z" } } })) });
  const paths = { trackerPath, profilePath };
  // Publish all lifecycle changes before freezing canonical handoffs.
  for (const c of cases) await linkInterview(paths, { interviewId: c.id + "-round", jobId: c.id, applicationId: c.id + "-application", state: c.state,
    schedule: { start: c.start, end: c.end, timezone: "America/Los_Angeles" }, expectedRevision: null,
    association: { source: "synthetic_test_script", reference: "Authored fictional invitation associated with the exact preview application.", verifiedAt: new Date().toISOString() } });
  for (const c of cases) {
    const root = join(output, "interviews", c.id); await mkdir(root);
    await json(join(root, "settings.json"), { schemaVersion: 1, interviewId: c.id + "-round", round: c.round, timezone: "America/Los_Angeles", preparationBudgetMinutes: c.budget, priorities: ["Follow the invitation's round scope", "Use only documented candidate experience"] });
    await writeFile(join(root, "invitation.txt"), c.invitation);
    const bundle = await interviewHandoff({ profile: profilePath, preferences: join(output, "preferences.md"), opportunities: trackerPath, settings: join(root, "settings.json"), invitation: join(root, "invitation.txt") }, c.id);
    const staged = await stageInterview(bundle, join(root, "run")) as { workspace: string };
    await new Promise<void>((accept, reject) => {
      const child = spawn(process.env.INTERVIEW_PYTHON ?? "python", ["-m", "interview.preview", "--workspace", staged.workspace, "--case", c.recipe], {
        cwd: pythonRoot, shell: false, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONDONTWRITEBYTECODE: "1" }
      });
      let errors = ""; child.stdout.resume(); child.stderr.on("data", chunk => { errors += chunk; });
      child.on("error", reject); child.on("close", code => code === 0 ? accept() : reject(new Error("interview_preview_failed: " + errors)));
    });
    await publishInterview(paths, c.id + "-round", staged.workspace, 1);
  }
  await json(join(output, "preview-manifest.json"), { kind: "authored_fictional_preview", createdAt: new Date().toISOString(), model_calls: 0, google_calls: 0,
    human_approvals: 0, synthetic_material_approvals: cases.map(c => c.id + "-round"), evaluation_result: false, practice_format: "simulation-v2" });
  return { root: output, paths, count: cases.length };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const flags = new Map<string, string>();
  if (args.length % 2) throw new Error("invalid_preview_arguments");
  for (let i = 0; i < args.length; i += 2) {
    if (!["--output", "--port", "--google-root"].includes(args[i]!) || flags.has(args[i]!) || !args[i + 1]) throw new Error("invalid_preview_arguments");
    flags.set(args[i]!, args[i + 1]!);
  }
  const port = Number(flags.get("--port") ?? "8767");
  if (!flags.has("--output") || !Number.isInteger(port) || port < 1 || port > 65535) throw new Error("invalid_preview_arguments");
  const preview = await createInterviewPreview(flags.get("--output")!);
  const server = await startReviewServer({ ...preview.paths, reviewPath: join(preview.root, "drafts"), jobsPath: preview.paths.trackerPath, port,
    googleRoot: flags.has("--google-root") ? resolve(flags.get("--google-root")!) : undefined });
  console.log(JSON.stringify({ status: "fictional_preview_ready", interviews: server.address + "/interviews", status_ledger: server.address + "/status/us", runtime: preview.root, model_calls: 0, google_calls: 0 }));
}
