import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, expect, test } from "vitest";
import { assertPrivate, assertPrivateDacl, makePrivate, writePrivateFile } from "./privateFiles.js";

const roots: string[] = [];
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }); });
test("private writes and directory inheritance remain usable with the native platform permission check", async () => {
  const root = await mkdtemp(join(tmpdir(), "private-records-")); roots.push(root);
  await makePrivate(root);
  await assertPrivate(root, true);
  const file = join(root, "records.json");
  await writePrivateFile(file, '{"fictional":true}', { flag: "wx" });
  await assertPrivate(file);
  expect(await readFile(file, "utf8")).toBe('{"fictional":true}');
  await expect(writePrivateFile(file, "overwritten", { flag: "wx" })).rejects.toMatchObject({ code: "EEXIST" });
  expect(await readFile(file, "utf8")).toBe('{"fictional":true}');
});
test("DACL validation rejects broad readers, unknown principals, null DACL and unsupported conditional rules", () => {
  const user = "S-1-5-21-1-2-3-1001";
  expect(() => assertPrivateDacl(`D:P(A;;FA;;;${user})(A;;FA;;;SY)(A;;FA;;;BA)`, user)).not.toThrow();
  for (const acl of ["", "D:NO_ACCESS_CONTROL", "D:", "D:(A;;FR;;;WD)", "D:(A;;FR;;;BU)",
    "D:(A;;FR;;;S-1-5-21-1-2-3-1002)", "D:(XA;;FR;;;WD;(condition))"]) {
    expect(() => assertPrivateDacl(acl, user)).toThrow("unsafe_recovery_file_permissions");
  }
});
test("an actually broadened fixture is rejected without repairing it during a read", async () => {
  const root = await mkdtemp(join(tmpdir(), "private-deny-")); roots.push(root);
  const file = join(root, "fictional.txt");
  await writePrivateFile(file, "fictional permission test only");
  if (process.platform === "win32") await promisify(execFile)("icacls.exe", [file, "/grant", "*S-1-1-0:(R)"]);
  else { const { chmod } = await import("node:fs/promises"); await chmod(file, 0o644); }
  const before = await stat(file);
  await expect(assertPrivate(file)).rejects.toThrow("unsafe_recovery_file_permissions");
  await expect(writePrivateFile(file, "must not truncate")).rejects.toThrow("unsafe_recovery_file_permissions");
  expect((await stat(file)).mtimeMs).toBe(before.mtimeMs);
  expect(await readFile(file, "utf8")).toBe("fictional permission test only");
});
