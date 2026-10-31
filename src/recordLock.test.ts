import { mkdtemp, open, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { afterEach, expect, test, vi } from "vitest";
import { acquireWindowsFileLock } from "./recordLock.js";

vi.mock("node:fs/promises", async importOriginal => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return { ...actual, open: vi.fn(actual.open) };
});

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(path => rm(path, { recursive: true, force: true }))); });
async function path() { const root = await mkdtemp(join(tmpdir(), "interview-lock-")); roots.push(root); return join(root, "records.json"); }

test("exclusive Windows locks serialize asynchronous owners and release once", async () => {
  const file = await path();
  let count = 0, active = 0;
  await Promise.all(Array.from({ length: 12 }, async () => {
    const release = await acquireWindowsFileLock(file);
    expect(++active).toBe(1);
    const before = count;
    await new Promise(resolve => setTimeout(resolve, 3));
    count = before + 1; --active;
    await release(); await release();
  }));
  expect(count).toBe(12);
  await expect(readFile(file + ".lock")).rejects.toMatchObject({ code: "ENOENT" });
});

test("an abandoned or replaced owner is never silently removed", async () => {
  const file = await path();
  await writeFile(file + ".lock", "abandoned or partially written owner");
  await expect(acquireWindowsFileLock(file, 25)).rejects.toThrow("application_tracker_locked");
  expect(await readFile(file + ".lock", "utf8")).toBe("abandoned or partially written owner");
  await rm(file + ".lock");
  const release = await acquireWindowsFileLock(file);
  await writeFile(file + ".lock", "different owner");
  await expect(release()).rejects.toThrow("application_tracker_lock_owner_changed");
  expect(await readFile(file + ".lock", "utf8")).toBe("different owner");
});

test("a transient Windows sharing error retries exclusive creation without deleting another owner", async () => {
  const file = await path();
  vi.mocked(open).mockRejectedValueOnce(Object.assign(new Error("fixture delete-pending sharing violation"), { code: "EPERM" }));
  const release = await acquireWindowsFileLock(file, 500);
  const owner = JSON.parse(await readFile(file + ".lock", "utf8"));
  expect(owner.pid).toBe(process.pid);
  await release();
  await expect(readFile(file + ".lock")).rejects.toMatchObject({ code: "ENOENT" });
});

test("independent Windows processes preserve concurrent read-modify-write updates", async () => {
  const file = await path();
  await writeFile(file, "0");
  const module = new URL("./recordLock.ts", import.meta.url).href;
  const script = `import {acquireWindowsFileLock} from ${JSON.stringify(module)};import{readFile,writeFile}from'node:fs/promises';const file=process.argv[1];for(let i=0;i<4;i++){const release=await acquireWindowsFileLock(file);try{const n=Number(await readFile(file,'utf8'));await new Promise(r=>setTimeout(r,5));await writeFile(file,String(n+1))}finally{await release()}}`;
  await Promise.all(Array.from({ length: 3 }, () => new Promise<void>((accept, reject) => {
    const child = spawn(process.execPath, ["--import", "tsx", "--input-type=module", "-e", script, file], { shell: false, stdio: "pipe" });
    child.stdout.resume(); let errors = ""; child.stderr.on("data", chunk => { errors += chunk; });
    child.on("error", reject); child.on("close", code => code === 0 ? accept() : reject(new Error(errors)));
  })));
  expect(await readFile(file, "utf8")).toBe("12");
}, 15_000);
