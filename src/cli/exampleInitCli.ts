import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { initializeExample } from "../example.js";

const project = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const args = process.argv.slice(2);
if (args.length !== 0 && (args.length !== 2 || args[0] !== "--dir" || !args[1] || args[1].startsWith("--"))) {
  throw new Error("Usage: npm run setup:example [-- --dir <existing-workspace>]");
}
try {
  const workspace = args[1] ? resolve(args[1]) : project;
  await initializeExample(workspace, resolve(project, "examples"));
  console.log(JSON.stringify({ ok: true, workspace, candidate: "Alex Morgan", applications: 0, next: "Start Review with this workspace; setup is only needed once." }, null, 2));
} catch {
  console.error("example_setup_failed: data must not already exist and the example must be valid; existing data was not overwritten");
  process.exitCode = 1;
}
