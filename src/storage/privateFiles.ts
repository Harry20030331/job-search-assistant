import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { chmod, lstat, open, readFile, stat, unlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";

const execute = promisify(execFile);
const systemTool = (name: string) => join(process.env.SystemRoot ?? "C:\\Windows", "System32", name);
let sid: Promise<string> | undefined;
async function currentSid() {
  sid ??= execute(systemTool("whoami.exe"), ["/user", "/fo", "csv", "/nh"], { windowsHide: true, timeout: 10_000 })
    .then(({ stdout }) => {
      const value = /S-1-\d+(?:-\d+)+/.exec(stdout)?.[0];
      if (!value) throw new Error("private_permissions_unavailable");
      return value;
    });
  return sid;
}

/** Restrict a selected local file/directory; never recurse into other data. */
export async function makePrivate(path: string): Promise<void> {
  const metadata = await lstat(path);
  if (metadata.isSymbolicLink() || (!metadata.isFile() && !metadata.isDirectory())) throw new Error("invalid_private_file");
  if (process.platform !== "win32") { await chmod(path, metadata.isDirectory() ? 0o700 : 0o600); return; }
  const permissions = metadata.isDirectory() ? "(OI)(CI)(F)" : "(F)";
  await execute(systemTool("icacls.exe"), [resolve(path), "/inheritance:r", "/grant:r",
    `*${await currentSid()}:${permissions}`, `*S-1-5-18:${permissions}`, `*S-1-5-32-544:${permissions}`, "/q"],
    { windowsHide: true, timeout: 10_000 });
}

/** Establish permissions before writing content, including on Windows. */
export async function writePrivateFile(path: string, content: string | Buffer, options: { flag?: string; mode?: number; encoding?: string } = {}): Promise<void> {
  if (!options.flag?.includes("x")) {
    try {
      const metadata = await lstat(path);
      if (metadata.isSymbolicLink()) throw new Error("invalid_private_file");
      await assertPrivate(path);
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  }
  const file = await open(path, options.flag ?? "w", 0o600);
  try { await makePrivate(path); await assertPrivate(path); await file.writeFile(content); }
  finally { await file.close(); }
}

/** POSIX mode or actual Windows DACL, with no permission changes during reads. */
export async function assertPrivate(path: string, directory = false): Promise<void> {
  const metadata = await stat(path);
  if (!(directory ? metadata.isDirectory() : metadata.isFile())) throw new Error("unsafe_recovery_file_permissions");
  if (process.platform !== "win32") {
    if ((metadata.mode & 0o777) !== (directory ? 0o700 : 0o600)) throw new Error("unsafe_recovery_file_permissions");
    return;
  }
  const saved = join(tmpdir(), "application-acl-" + randomUUID());
  try {
    // /save emits machine-readable SDDL instead of localized account names.
    // No recursion and no ACL mutation are performed by this inspection.
    await execute(systemTool("icacls.exe"), [resolve(path), "/save", saved, "/q"], { windowsHide: true, timeout: 10_000 });
    const bytes = await readFile(saved);
    const text = bytes.toString(bytes[1] === 0 || (bytes[0] === 0xff && bytes[1] === 0xfe) ? "utf16le" : "utf8");
    const dacl = text.split(/\r?\n/).find(line => line.startsWith("D:"));
    assertPrivateDacl(dacl ?? "", await currentSid());
  } finally {
    await unlink(saved).catch(error => { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; });
  }
}

export function assertPrivateDacl(dacl: string, ownerSid: string): void {
  const trusted = new Set([ownerSid, "SY", "BA", "S-1-5-18", "S-1-5-32-544"]);
  const entries = [...dacl.matchAll(/\(([^()]*)\)/g)];
  if (!dacl.startsWith("D:") || dacl.includes("NO_ACCESS_CONTROL") || !entries.length) throw new Error("unsafe_recovery_file_permissions");
  for (const entry of entries) {
    const fields = entry[1]!.split(";");
    if (fields.length !== 6 || !["A", "D"].includes(fields[0]!) || (fields[0] === "A" && !trusted.has(fields[5]!))) {
      throw new Error("unsafe_recovery_file_permissions");
    }
  }
}
