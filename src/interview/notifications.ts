import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { acquireFileLock } from "../recordLock.js";
import { candidateAnchor, interviewEnded, readInterviewBoard, type InterviewBoardItem, type WorkbenchPaths } from "./workbench.js";
import { sha256 } from "./handoff.js";

const stateSchema = z.object({ schemaVersion: z.literal(1), candidate: z.string(), receipts: z.record(z.object({
  websiteDismissedAt: z.string().optional(), chatDeliveredAt: z.string().optional()
}).strict()) }).strict();
export interface InterviewNotice { id: string; interviewId: string; company: string; role: string; end: string; href: string; synthetic: boolean }
function pathFor(paths: WorkbenchPaths) { return join(paths.interviewPath ?? join(dirname(paths.trackerPath), "interviews"), "notification-receipts.json"); }
async function read(paths: WorkbenchPaths) {
  const candidate = sha256(JSON.stringify(await candidateAnchor(paths.profilePath)));
  try {
    const state = stateSchema.parse(JSON.parse(await readFile(pathFor(paths), "utf8")));
    if (state.candidate !== candidate) throw new Error("interview_candidate_changed");
    return state;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return { schemaVersion: 1 as const, candidate, receipts: {} as z.infer<typeof stateSchema>["receipts"] };
  }
}
export function dueNotices(items: InterviewBoardItem[], now = Date.now()): InterviewNotice[] {
  return items.filter(item => !item.problem && interviewEnded(item, now) && !item.snapshot?.debriefs.some(report => report.mode === "interview")).map(item => ({
    id: sha256(JSON.stringify([item.entry.interviewId, Date.parse(item.entry.schedule!.start), Date.parse(item.entry.schedule!.end)])), interviewId: item.entry.interviewId,
    company: item.company, role: item.role, end: item.entry.schedule!.end,
    href: "/interviews?" + new URLSearchParams({ interview: item.entry.interviewId, view: "debrief", filter: "completed" }),
    synthetic: item.entry.association.source === "synthetic_test_script"
  }));
}
export async function pendingNotices(paths: WorkbenchPaths, channel: "website" | "chat", items?: InterviewBoardItem[]) {
  const state = await read(paths);
  return dueNotices(items ?? await readInterviewBoard(paths)).filter(item => !state.receipts[item.id]?.[channel === "website" ? "websiteDismissedAt" : "chatDeliveredAt"]);
}
export async function acknowledgeNotice(paths: WorkbenchPaths, id: string, channel: "website" | "chat") {
  const path = pathFor(paths); await mkdir(dirname(path), { recursive: true });
  const unlock = await acquireFileLock(path);
  try {
    const state = await read(paths);
    if (!dueNotices(await readInterviewBoard(paths)).some(item => item.id === id)) throw new Error("interview_notice_changed");
    const field = channel === "website" ? "websiteDismissedAt" : "chatDeliveredAt";
    if (state.receipts[id]?.[field]) return false;
    state.receipts[id] = { ...state.receipts[id], [field]: new Date().toISOString() };
    const temporary = path + "." + randomUUID() + ".tmp";
    await writeFile(temporary, JSON.stringify(state) + "\n", { mode: 0o600 }); await rename(temporary, path);
    return true;
  } finally { await unlock(); }
}
