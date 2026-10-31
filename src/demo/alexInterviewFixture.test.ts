import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { loadExample } from "../example.js";
import { prepareAlexInterviewFixture } from "./alexInterviewFixture.js";

test("Alex interview fixture rejects unfinished rehearsals, existing interviews and another identity without changing applications", async () => {
  const root = await mkdtemp(join(tmpdir(), "alex-interview-guard-"));
  try {
    await loadExample(root, fileURLToPath(new URL("../../examples", import.meta.url)), "review");
    const tracker = join(root, "data/opportunities.json"), before = await readFile(tracker, "utf8");
    await writeFile(join(root, "data/application-tasks.json"), JSON.stringify({ tasks: [] }));
    await expect(prepareAlexInterviewFixture(root)).rejects.toThrow("complete_local_adobe_and_nooks_rehearsals_first");
    await mkdir(join(root, "data/interviews"));
    await writeFile(join(root, "data/interviews/registry.json"), "{}");
    await expect(prepareAlexInterviewFixture(root)).rejects.toThrow("alex_interviews_already_exist");
    const path = join(root, "data/candidate.json"), profile = JSON.parse(await readFile(path, "utf8"));
    profile.identity.fullName = "Different Fictional Candidate";
    await writeFile(path, JSON.stringify(profile));
    await expect(prepareAlexInterviewFixture(root)).rejects.toThrow("exact_fictional_alex_profile_required");
    expect(await readFile(tracker, "utf8")).toBe(before);
  } finally { await rm(root, { recursive: true, force: true }); }
}, 60_000);
