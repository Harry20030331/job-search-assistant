import { access, readFile, readdir } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const project = dirname(dirname(fileURLToPath(import.meta.url)));
const fail = (message) => { throw new Error(message); };
const pass = (message) => console.log(`PASS ${message}`);
const packageJson = JSON.parse(await readFile(join(project, "package.json"), "utf8"));
const exact = (actual, wanted) => JSON.stringify(Object.keys(actual ?? {}).sort()) === JSON.stringify(wanted.sort());
if (!exact(packageJson.dependencies, ["zod"])) fail("unexpected_runtime_dependency");
if (!exact(packageJson.devDependencies, ["@types/node", "tsx", "typescript", "vitest"])) fail("unexpected_development_dependency");
pass("dependency surface is minimal");

const required = [
  "AGENTS.md", "CONTEXT.md", "docs/workflow-contract.md", "docs/candidate-inputs.md",
  "docs/architecture.md", "docs/structure.md", "docs/ui-contract.md", "docs/ui-contract-v1.json",
  "skills/submission/SKILL.md", "skills/matching/SKILL.md",
  "skills/submission/greenhouse/SKILL.md", "skills/submission/ashby/SKILL.md", "skills/submission/lever/SKILL.md",
  "skills/submission/workday/SKILL.md", "skills/submission/long-tail/SKILL.md",
  "docs/job-discovery.md", "src/storage/opportunities.ts", "src/storage/drafts.ts"
];
for (const path of required) await access(join(project, path)).catch(() => fail(`required_file_missing:${path}`));
pass("active contracts and skills exist without private runtime or archive files");

for (const path of ["AGENTS.md", "README.md", "docs/architecture.md", "skills/submission/SKILL.md"]) {
  const content = await readFile(join(project, path), "utf8");
  if (!content.includes("docs/workflow-contract.md")) fail(`workflow_contract_reference_missing:${path}`);
}
for (const ats of ["ashby", "greenhouse", "lever", "long-tail", "workday"]) {
  const path = `skills/submission/${ats}/SKILL.md`;
  const content = await readFile(join(project, path), "utf8");
  if (!content.includes("../SKILL.md")) fail(`common_skill_reference_missing:${path}`);
}
const context = await readFile(join(project, "CONTEXT.md"), "utf8");
for (const term of ["Application", "Batch", "Canonical Input", "Review Snapshot", "Website Approval", "Submission Evidence", "Confirmation", "Protected Recruiting Update", "Friction", "Status Ledger"]) {
  if (!context.includes(`## ${term}`)) fail(`domain_term_missing:${term}`);
}
pass("entrypoints defer to the current contract and ATS modules to common policy");

// These are scope guards, not an assertion that the agent will follow prose.
const chinaOutreachSource = await readFile(join(project, "src/china/outreach/chinaOutreachTracker.ts"), "utf8");
for (const forbidden of ["replies:", "conversation:", "messages:"]) {
  if (chinaOutreachSource.includes(forbidden)) fail(`china_reply_scope_present:${forbidden}`);
}
const serverSource = await readFile(join(project, "src/review/reviewServer.ts"), "utf8");
for (const forbidden of ["/api/china", "china/send", "china/upload"]) {
  if (serverSource.includes(forbidden)) fail(`china_mutation_route_present:${forbidden}`);
}
for (const route of ["/status/us", "/status/china"]) {
  if (!serverSource.includes(route)) fail(`compatible_status_route_missing:${route}`);
}
if (packageJson.scripts?.["review:resume"] !== "tsx src/cli/reviewServerCli.ts") fail("review_resume_command_missing");
if (packageJson.scripts?.["runtime:init"] !== "tsx src/cli/runtimeInitCli.ts") fail("runtime_init_command_missing");
pass("recovery, fresh initialization and historical no-send boundaries exist");

async function walk(directory) {
  const paths = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (["node_modules", ".git", "docs"].includes(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) paths.push(...await walk(path)); else paths.push(path);
  }
  return paths;
}

const projectFiles = [
  ...await walk(join(project, "src")),
  ...await walk(join(project, "skills")),
  ...await walk(join(project, "scripts"))
];
const forbiddenSegments = /(^|[/.-])(extension|native-host|scanner|formmodel|reconciler|batch|retry|replay)([/.-]|$)/i;
for (const file of projectFiles) {
  const local = relative(project, file);
  if (forbiddenSegments.test(local)) fail(`forbidden_runtime_path:${local}`);
}
for (const file of (await walk(join(project, "src"))).filter((path) => path.endsWith(".ts"))) {
  const text = await readFile(file, "utf8");
  if (/from\s+["'][^"']*ApplicationExecutor|import\s*\([^)]*ApplicationExecutor/i.test(text)) {
    fail(`old_runtime_import:${relative(project, file)}`);
  }
}
pass("no legacy runtime or generic browser engine is imported");

console.log("boundary verification passed");
