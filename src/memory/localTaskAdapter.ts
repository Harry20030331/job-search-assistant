import { readFile, realpath, rename, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join, resolve } from "node:path";
import { z } from "zod";
import { acquireWindowsFileLock } from "../recordLock.js";
import { writePrivateFile } from "../storage/privateFiles.js";

const text = z.string().trim().min(1);
const job = z.object({ id: text, title: text, company: text, city: text, description: text,
  officialUrl: z.string().url().optional(), provenance: z.enum(["simulated-jd", "unverified-saved-posting", "browser-verified"]),
  verification: text }).strict();
const decision = z.object({ jobId: text, disposition: z.enum(["shortlist", "confirm", "exclude"]), reason: text }).strict();
const draft = z.object({ jobId: text, status: z.enum(["blocked", "local-review"]),
  fields: z.array(z.object({ question: text, answer: z.string(), source: text }).strict()),
  blocker: z.string(), observedUrl: z.string().url().optional(), observedAt: text }).strict();
const action = z.object({ sessionId: text, requestId: text, decisions: z.array(decision) }).strict();
const schema = z.object({ version: z.literal(1), fictional: z.literal(true), jobs: z.array(job),
  shortlist: z.array(text), pending: z.array(text), actions: z.array(action), drafts: z.array(draft) }).strict();
export type LocalJob = z.infer<typeof job>;
export interface TaskStateAdapter {
  read(): Promise<z.infer<typeof schema>>;
  decide(input: z.infer<typeof action>): Promise<unknown>;
  draft(input: z.infer<typeof draft>): Promise<unknown>;
}
/** Isolated local experiment only. A future virtual website can implement TaskStateAdapter. */
export class LocalTaskAdapter implements TaskStateAdapter {
  constructor(readonly root: string) {}
  get path() { return join(resolve(this.root), "local-tasks.json"); }
  async initialize(jobs: LocalJob[]) {
    await writePrivateFile(this.path, JSON.stringify(schema.parse({ version:1, fictional:true, jobs,
      shortlist:[], pending:[], actions:[], drafts:[] }), null, 2) + "\n", { flag:"wx" });
  }
  async read() { return schema.parse(JSON.parse(await readFile(this.path, "utf8"))); }
  private async update(fn: (state: z.infer<typeof schema>) => unknown) {
    const path = await realpath(this.path); const unlock = await acquireWindowsFileLock(path, 5000);
    let temporary: string | undefined;
    try {
      const state = await this.read(); const before = JSON.stringify(state); const result = fn(state);
      if (JSON.stringify(state) !== before) {
        schema.parse(state); temporary = join(resolve(this.root), `.${randomUUID()}.tmp`);
        await writePrivateFile(temporary, JSON.stringify(state, null, 2) + "\n", { flag:"wx" });
        await rename(temporary, path); temporary = undefined;
      }
      return result;
    } finally { if (temporary) await unlink(temporary); await unlock(); }
  }
  async add(jobs: LocalJob[]) {
    const parsed = z.array(job).parse(jobs);
    return this.update(state => {
      for (const value of parsed) {
        const existing = state.jobs.find(j => j.id === value.id);
        if (existing && JSON.stringify(existing) !== JSON.stringify(value)) throw new Error("job_identity_conflict");
        if (!existing) state.jobs.push(value);
      }
      return { added: parsed.map(j => j.id) };
    });
  }
  async decide(input: z.infer<typeof action>) {
    const parsed = action.parse(input);
    return this.update(state => {
      const existing = state.actions.find(a => a.requestId === parsed.requestId);
      if (existing) { if (JSON.stringify(existing) !== JSON.stringify(parsed)) throw new Error("decision_conflict"); return existing; }
      if (new Set(parsed.decisions.map(d => d.jobId)).size !== parsed.decisions.length) throw new Error("duplicate_decision");
      for (const d of parsed.decisions) {
        if (!state.jobs.some(j => j.id === d.jobId)) throw new Error("job_missing");
        state.shortlist = state.shortlist.filter(key => key !== d.jobId);
        state.pending = state.pending.filter(key => key !== d.jobId);
        if (d.disposition === "shortlist") state.shortlist.push(d.jobId);
        if (d.disposition === "confirm") state.pending.push(d.jobId);
      }
      state.actions.push(parsed); return parsed;
    });
  }
  async draft(input: z.infer<typeof draft>) {
    const parsed = draft.parse(input);
    return this.update(state => {
      const target = state.jobs.find(j => j.id === parsed.jobId);
      if (!target) throw new Error("job_missing");
      if (parsed.fields.length && target.provenance !== "browser-verified") throw new Error("verified_fields_required");
      if (parsed.status === "blocked" && !parsed.blocker) throw new Error("blocker_required");
      state.drafts = state.drafts.filter(d => d.jobId !== parsed.jobId).concat(parsed);
      return parsed;
    });
  }
}
