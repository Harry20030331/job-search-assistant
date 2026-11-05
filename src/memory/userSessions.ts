import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import { withPreferences } from "../matching/matching.js";
import { userFiles } from "../storage/userWorkspace.js";
import { atomicWrite, applyEdits, documentReview, sourceSchema, type Documents } from "./memoryDocuments.js";
import { reviewWithLocalCodex } from "./codexDreaming.js";

const id = z.string().regex(/^[A-Za-z0-9_-]{1,100}$/);
const verbatim = z.string().refine(s => s.trim().length > 0);
const turn = z.object({ id, user: verbatim, assistant: verbatim }).strict();
const kind = z.enum(["job-selection", "application-answers", "interview-preparation"]);
const change = z.object({ document: kind, before: z.string(), after: z.string() });
const session = z.object({
  sessionId: id, threadId: verbatim, turns: z.array(turn), closed: z.boolean(),
  pending: z.array(change).optional(), review: documentReview.optional()
}).strict();
const boundary = "## Confirmed Matching preferences\n\n<!-- matching-policy:v1 -->";

/** The selected user's own session file is both the raw interaction and its close receipt. */
export class UserSessions {
  private readonly files;
  constructor(root: string) {
    this.files = userFiles(root);
    if (!this.files.grouped) throw new Error("grouped_user_workspace_required");
  }
  private file(key: string) { return join(this.files.sessions, id.parse(key) + ".json"); }
  private async read(key: string) {
    const data = session.parse(JSON.parse(await readFile(this.file(key), "utf8")));
    if (data.sessionId !== key) throw new Error("session_identity_mismatch");
    return data;
  }
  private save(data: z.infer<typeof session>) {
    return atomicWrite(this.file(data.sessionId), JSON.stringify(data, null, 2) + "\n");
  }
  private lock<T>(work: () => Promise<T>) { return withPreferences(this.files.preferences, work); }
  private path(name: z.infer<typeof kind>) {
    return { "job-selection": this.files.preferences, "application-answers": this.files.application,
      "interview-preparation": this.files.interview }[name];
  }
  private async documents(): Promise<Documents> {
    const [profile, selection, application, interview] = await Promise.all([
      this.files.profile, this.files.preferences, this.files.application, this.files.interview
    ].map(path => readFile(path, "utf8")));
    // Only editable prose goes to the reviewer. Structured matching policy has its own writer.
    return { profile: profile!, "job-selection": selection!.split(boundary)[0]!,
      "application-answers": application!, "interview-preparation": interview! };
  }
  async open(key: string, threadId: string) {
    verbatim.parse(threadId);
    return this.lock(async () => {
      let data;
      try { data = await this.read(key); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        data = { sessionId: key, threadId, closed: false, turns: [] };
        await this.save(data);
      }
      if (data.threadId !== threadId) throw new Error("session_thread_mismatch");
      return { sessionId: key, closed: data.closed, documents: await this.documents(), paths: this.files };
    });
  }
  async append(key: string, input: unknown) {
    const parsed = turn.parse(input);
    return this.lock(async () => {
      const data = await this.read(key);
      const prior = data.turns.find(t => t.id === parsed.id);
      if (prior && !isDeepStrictEqual(prior, parsed)) throw new Error("turn_conflict");
      if (!prior) {
        if (data.closed) throw new Error("session_closed");
        data.turns.push(parsed); await this.save(data);
      }
      return { source: 'core://' + key + '/' + parsed.id };
    });
  }
  async source(input: string) {
    const [key, turnId] = sourceSchema.parse(input).slice(7).split("/");
    const data = await this.read(key!);
    const item = data.turns.find(t => t.id === turnId);
    if (!data.closed || !item) throw new Error("source_not_archived");
    return { ...item, threadId: data.threadId, sessionId: key, source: input };
  }
  private async finish(data: z.infer<typeof session>) {
    // A retried write can complete partial work but cannot overwrite an intervening user edit.
    for (const edit of data.pending ?? []) {
      const path = this.path(edit.document);
      const current = await readFile(path, "utf8");
      if (current === edit.after) continue;
      if (current !== edit.before) throw new Error("preference_changed_during_recovery");
      await atomicWrite(path, edit.after);
    }
    if (data.pending) { delete data.pending; await this.save(data); }
    return { sessionId: data.sessionId, reviewed: true, review: data.review };
  }
  async close(key: string, reviewer = reviewWithLocalCodex) {
    const snapshot = await this.lock(async () => {
      const data = await this.read(key);
      if (data.review) return { result: await this.finish(data) };
      if (!data.turns.length) throw new Error("nonempty_session_required");
      if (!data.closed) { data.closed = true; await this.save(data); }
      return { documents: await this.documents(), core: data.turns.map(t => ({ ...t, source: 'core://' + key + '/' + t.id })) };
    });
    if (snapshot.result) return snapshot.result;
    const proposal = documentReview.parse(await reviewer({ documents: snapshot.documents!, core: snapshot.core!, baseRevision: 0,
      dreamingInstruction: "Use the candidate profile as context. Edit only reusable preferences in job-selection, application-answers or interview-preparation; cite exact supplied turns. Retain conditions and exceptions." }));
    return this.lock(async () => {
      const data = await this.read(key);
      if (data.review) return this.finish(data);
      const current = await this.documents();
      if (!isDeepStrictEqual(current, snapshot.documents)) throw new Error("preferences_changed_retry_close");
      for (const edit of proposal.edits) {
        kind.parse(edit.document);
        if (edit.sources.some(s => !snapshot.core!.some(t => t.source === s))) throw new Error("current_session_source_required");
        if (edit.after.includes("<!-- matching-policy") || edit.after.includes("<!-- /matching-policy")) throw new Error("reserved_matching_policy_marker");
      }
      const changes = applyEdits(current, proposal.edits, true);
      data.pending = [];
      for (const name of kind.options) {
        if (changes[name] === undefined) continue;
        const before = await readFile(this.path(name), "utf8");
        data.pending.push({ document: name, before, after: changes[name]!.trim() + (before.length > current[name].length ? "\n\n" + before.slice(current[name].length) : "\n") });
      }
      data.review = proposal;
      await this.save(data);
      return this.finish(data);
    });
  }
}
