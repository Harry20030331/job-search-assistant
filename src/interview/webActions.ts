import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { withInterviewRun, type WorkbenchPaths } from "./workbench.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "python");
const decisionSchema = z.object({ interviewId: z.string().min(1), expectedRevision: z.number().int().positive(),
  proposalId: z.string().min(1), proposalHash: z.string().min(1), proposalVersion: z.number().int().positive(), retry: z.boolean() }).strict();
export type PlanDecision = z.infer<typeof decisionSchema>;
export async function pythonAction(action: "decide" | "run" | "fail", workspace: string, input?: unknown, jobId?: string): Promise<Record<string, unknown>> {
  return new Promise((accept, reject) => {
    const child = spawn(process.env.INTERVIEW_PYTHON ?? "python", ["-m", "interview.web_workflow", action, "--workspace", workspace,
      ...(jobId ? ["--job-id", jobId] : [])], { cwd: root, shell: false, windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"], env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONDONTWRITEBYTECODE: "1" } });
    let output = "";
    const timer = action === "run" ? undefined : setTimeout(() => { child.kill(); reject(new Error("interview_plan_conflict")); }, 20_000);
    child.stdout.setEncoding("utf8").on("data", part => { output += part; if (output.length > 16_384) child.kill(); });
    child.stderr.resume(); child.stdin.on("error", () => {}); child.stdin.end(input ? JSON.stringify(input) : "");
    child.on("error", () => { clearTimeout(timer); reject(new Error("interview_generation_unavailable")); });
    child.on("close", code => { clearTimeout(timer); try {
      const value = JSON.parse(output);
      if (code !== 0 || value.error || output.length > 16_384) throw new Error(); accept(value);
    } catch { reject(new Error("interview_plan_conflict")); } });
  });
}
export async function approveWebsitePlan(paths: WorkbenchPaths, input: unknown, action = pythonAction) {
  const parsed = decisionSchema.safeParse(input);
  if (!parsed.success) throw new Error("invalid_request");
  const command = parsed.data;
  const result = await withInterviewRun(paths, command.interviewId, command.expectedRevision, async item => {
    const proposal = item.snapshot!.proposal;
    if (!proposal || proposal.proposal_id !== command.proposalId || proposal.proposal_hash !== command.proposalHash || proposal.version !== command.proposalVersion) throw new Error("interview_plan_conflict");
    const job = await action("decide", item.entry.workspace!, { origin: item.entry.association.source === "synthetic_test_script" ? "synthetic_test_script" : "human_workbench",
      decision: { interview_id: command.interviewId, proposal_id: command.proposalId, proposal_hash: command.proposalHash,
        proposal_version: command.proposalVersion, retry: command.retry } });
    return { job, workspace: item.entry.workspace! };
  });
  if (result.job.status === "queued" && typeof result.job.job_id === "string") {
    // SQLite performs the single claim, including across duplicate HTTP requests.
    void action("run", result.workspace, undefined, result.job.job_id).catch(() =>
      action("fail", result.workspace, undefined, result.job.job_id as string).catch(() => undefined));
  }
  return result.job;
}
