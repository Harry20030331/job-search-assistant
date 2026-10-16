import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, expect, test } from "vitest";
import { initializeExample } from "./example.js";
import { resolveRecoveryInputs } from "./review/reviewRecovery.js";

const directories: string[] = [];
const examples = fileURLToPath(new URL("../examples", import.meta.url));
afterEach(async () => { for (const path of directories.splice(0)) await rm(path, { recursive: true, force: true }); });

test("copies fictional inputs once into an empty workspace and preserves local edits on recovery", async () => {
  const root = await mkdtemp(join(tmpdir(), "course-example-")); directories.push(root);
  const original = await readFile(join(examples, "candidate.json"), "utf8");
  const inputs = await initializeExample(root, examples);
  expect(await readFile(join(root, "data/candidate.json"), "utf8")).toBe(original);
  expect(JSON.parse(await readFile(inputs.jobsPath, "utf8")).opportunities).toEqual([]);
  expect(await readdir(inputs.reviewPath)).toEqual([]);
  const modified = JSON.parse(original); modified.availability.relocation = true;
  await writeFile(join(root, "data/candidate.json"), JSON.stringify(modified));
  await expect(initializeExample(root, examples)).rejects.toMatchObject({ code: "EEXIST" });
  expect((await resolveRecoveryInputs(root)).applicationIds).toEqual([]);
  expect(JSON.parse(await readFile(join(root, "data/candidate.json"), "utf8")).availability.relocation).toBe(true);
  expect(await readFile(join(examples, "candidate.json"), "utf8")).toBe(original);
});

test("invalid example leaves an existing workspace untouched", async () => {
  const root = await mkdtemp(join(tmpdir(), "course-example-invalid-")); directories.push(root);
  await writeFile(join(root, "keep.txt"), "keep");
  await expect(initializeExample(root, join(root, "missing"))).rejects.toThrow();
  expect(await readdir(root)).toEqual(["keep.txt"]);
});
