import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../src/interview/python");
const [entry, ...args] = process.argv.slice(2);
const modules = {
  test: ["unittest", "discover", "-s", "tests", "-q"],
  benchmark: ["evaluation.workflow"], "workflow-review": ["evaluation.workflow_review"],
  context: ["interview.preparation_context"], "context-cases": ["evaluation.context_cases"],
  "context-analyze": ["interview.context_flow"],
  "context-pilot": ["evaluation.context_pilot"],
  "context-preparation": ["interview.context_preparation"], "context-prepare": ["interview.context_preparation_flow"],
  "context-preparation-pilot": ["evaluation.context_preparation_pilot"],
  "preparation-quality": ["evaluation.preparation_quality_review"],
  "preparation-controls": ["evaluation.preparation_quality_controls"],
  enrich: ["interview.enrichment"],
  "enrichment-checks": ["evaluation.enrichment_scenarios"],
  learning: ["interview.candidate_learning"],
  practice: ["interview.practice_flow"],
  eval: ["evaluation.runner"], triage: ["evaluation.mail_triage"], analysis: ["evaluation.analysis"],
  calibration: ["evaluation.calibration"], prepare: ["interview.preparation_flow"],
  tools: ["interview.tools"], local: ["interview.cli"],
  approve: ["scripts.preparation_approval"], coordinator: ["interview.coordinator_cli"],
  inbox: ["interview.inbox_cli"], connect: ["interview.onboarding"], google: ["interview.google_cli"]
};
if (!Object.hasOwn(modules, entry)) throw new Error("invalid_interview_entrypoint");
const child = spawn(process.env.INTERVIEW_PYTHON ?? "python", ["-m", ...modules[entry], ...args], {
  cwd: root, shell: false, stdio: "inherit",
  env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONDONTWRITEBYTECODE: "1" }
});
child.on("error", () => { console.error("interview_python_unavailable: set INTERVIEW_PYTHON to a Python 3.12 environment"); process.exitCode = 1; });
child.on("exit", code => { process.exitCode = code ?? 1; });
