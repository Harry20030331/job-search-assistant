import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { chmod, open, readFile, unlink } from "node:fs/promises";
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
  if (process.platform === "win32") return acquireWindowsFileLock(path);
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

/** Atomic exclusive creation on Windows; abandoned locks fail closed for manual recovery. */
export async function acquireWindowsFileLock(path: string, waitMilliseconds = 15_000): Promise<() => Promise<void>> {
  const lockPath = `${path}.lock`;
  const owner = JSON.stringify({ pid: process.pid, token: randomUUID(), createdAt: new Date().toISOString() }) + "\n";
  const deadline = Date.now() + waitMilliseconds;
  while (true) {
    let handle;
    try {
      handle = await open(lockPath, "wx", 0o600);
    } catch (error) {
      const code = errorCode(error);
      // Windows can briefly report sharing/access errors while a just-deleted
      // lock is still closing. Wait without removing or replacing any owner.
      if (!["EEXIST", "EPERM", "EACCES", "EBUSY"].includes(code ?? "")) throw new Error("application_tracker_lock_failed");
      if (Date.now() >= deadline) throw new Error(code === "EEXIST" ? "application_tracker_locked" : "application_tracker_lock_failed");
      await delay(10 + Math.floor(Math.random() * 16));
      continue;
    }
    try {
      await handle.writeFile(owner, "utf8");
      await handle.sync();
    } catch {
      await handle.close();
      await unlink(lockPath);
      throw new Error("application_tracker_lock_failed");
    }
    await handle.close();
    let released = false;
    return async () => {
      if (released) return;
      const releaseDeadline = Date.now() + waitMilliseconds;
      while (!released) {
        try {
          if (await readFile(lockPath, "utf8") !== owner) throw new Error("application_tracker_lock_owner_changed");
          await unlink(lockPath);
          released = true;
        } catch (error) {
          if (errorCode(error) === "ENOENT") { released = true; break; }
          if (!["EPERM", "EACCES", "EBUSY"].includes(errorCode(error) ?? "") || Date.now() >= releaseDeadline) throw error;
          await delay(10 + Math.floor(Math.random() * 16));
        }
      }
    };
  }
}
