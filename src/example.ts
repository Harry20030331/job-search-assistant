import { readFile, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { initializeRuntimeData } from "./runtime.js";
import { runPreflight } from "./preflight.js";

/** Seed one workspace once. Starting Review later does not read examples. */
export async function initializeExample(workspace: string, examples: string) {
  const names = ["candidate.json", "preferences.md", "resumes.json", "alex-morgan-resume.pdf"];
  const files = await Promise.all(names.map(async name => ({ name, bytes: await readFile(join(examples, name)) })));
  if (JSON.parse(files[0]!.bytes.toString()).fictional !== true) throw new Error("fictional_example_required");
  await runPreflight({ category: "llm", jobUrl: "https://careers.example.com/jobs/example", profilePath: join(examples, "candidate.json"), manifestPath: join(examples, "resumes.json") });
  // This call exclusively creates data/. If it already exists, leave it untouched.
  const inputs = await initializeRuntimeData(workspace);
  try {
    for (const { name, bytes } of files) await writeFile(join(workspace, "data", name), bytes, { flag: "wx", mode: 0o600 });
    await runPreflight({ category: "llm", jobUrl: "https://careers.example.com/jobs/example", profilePath: join(workspace, "data/candidate.json"), manifestPath: join(workspace, "data/resumes.json") });
    return inputs;
  } catch (error) {
    // Only this initializer's newly created directory may be removed on failure.
    await rm(join(workspace, "data"), { recursive: true, force: true });
    throw error;
  }
}
