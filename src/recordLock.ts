import { execFile } from "node:child_process";
import { chmod, readFile, unlink } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";
const lockWaitMilliseconds = 5_000;
const execFileAsync = promisify(execFile);

function errorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error
    ? String(error.code)
    : undefined;
}

async function releaseShlock(lockPath: string): Promise<void> {
  try {
    const ownerPid = Number((await readFile(lockPath, "utf8")).trim());
    if (ownerPid === process.pid) await unlink(lockPath);
  } catch (error) {
    if (errorCode(error) !== "ENOENT") throw error;
  }
}

export async function acquireFileLock(path: string): Promise<() => Promise<void>> {
  const lockPath = `${path}.lock`;
  const deadline = Date.now() + lockWaitMilliseconds;
  while (true) {
    try {
      await execFileAsync(
        "/usr/bin/shlock",
        ["-f", lockPath, "-p", String(process.pid)],
        { shell: false, timeout: 1_000 }
      );
      try {
        await chmod(lockPath, 0o600);
      } catch {
        await releaseShlock(lockPath);
        throw new Error("application_tracker_lock_failed");
      }
      return () => releaseShlock(lockPath);
    } catch (error) {
      if (error instanceof Error && error.message === "application_tracker_lock_failed") throw error;
      if (errorCode(error) === "ENOENT") throw new Error("application_tracker_lock_failed");
      if (Date.now() >= deadline) throw new Error("application_tracker_locked");
      await delay(10 + Math.floor(Math.random() * 16));
    }
  }
}
