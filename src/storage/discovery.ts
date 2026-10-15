import { randomUUID } from "node:crypto";
import { readFile, writeFile, rename, realpath } from "node:fs/promises";
import { dirname, join } from "node:path";
import { z } from "zod";
import { acquireFileLock } from "../recordLock.js";
const schema = z.object({ version: z.literal(1), sources: z.record(z.object({ lastSuccessfulScanAt: z.string().datetime({ offset: true }) }).strict()), initializedFrom: z.record(z.unknown()).optional() }).strict();
export async function readDiscovery(path: string) { return schema.parse(JSON.parse(await readFile(path, "utf8"))); }
const queues = new Map<string, Promise<unknown>>();
export async function completeScan(path: string, source: string, at: string, completed: boolean): Promise<void> {
  if (!completed || !/^[a-z0-9][a-z0-9-]*$/.test(source) || !z.string().datetime({ offset: true }).safeParse(at).success) throw new Error("completed_scan_required");
  const key = await realpath(path);
  const task = (queues.get(key) ?? Promise.resolve()).catch(() => undefined).then(async () => {
    const unlock = await acquireFileLock(key);
    try {
      const document = await readDiscovery(key);
      if (document.sources[source] && Date.parse(at) < Date.parse(document.sources[source]!.lastSuccessfulScanAt)) throw new Error("checkpoint_cannot_regress");
      document.sources[source] = { lastSuccessfulScanAt: at };
      const temporary = join(dirname(key), `.${randomUUID()}.tmp`);
      await writeFile(temporary, JSON.stringify(document, null, 2) + "\n", { mode: 0o600 });
      await rename(temporary, key);
    } finally { await unlock(); }
  });
  queues.set(key, task);
  try { await task; } finally { if (queues.get(key) === task) queues.delete(key); }
}
