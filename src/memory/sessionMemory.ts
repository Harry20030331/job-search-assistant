import { createHash } from "node:crypto";
import { mkdir, readFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import { acquireWindowsFileLock } from "../recordLock.js";
import { writePrivateFile } from "../storage/privateFiles.js";

import { applyEdits, atomicWrite, commitDocuments, documentReview, documentSchema, finishDocumentCommit,
  readDocuments, sourceSchema, type Documents } from "./memoryDocuments.js";
export { sourceSchema } from "./memoryDocuments.js";

import { reviewWithLocalCodex } from "./codexDreaming.js";

const id = z.string().regex(/^[A-Za-z0-9_-]{1,100}$/);
const text = z.string().trim().min(1);
const verbatim = z.string().refine(value => value.trim().length > 0);
const turnSchema = z.object({ id, user: verbatim, assistant: verbatim }).strict();
const preferenceSchema = z.object({
  id, section: z.enum(["job-selection", "application-answers", "interview-preparation"]),
  statement: text, scope: text, exceptions: z.array(text), sources: z.array(sourceSchema).min(1)
}).strict();
export type Preference = z.infer<typeof preferenceSchema>;
const reviewSchema = z.object({ baseRevision: z.number().int().nonnegative(), reason: text,
  upsert: z.array(preferenceSchema), remove: z.array(id) }).strict();
const reviewRequest = z.union([documentReview, reviewSchema]);
export type DreamingReview = z.infer<typeof reviewRequest>;
const sessionSchema = z.object({ id, threadId: text, turns: z.array(turnSchema),
  openedRevision: z.number().int().nonnegative(), closed: z.boolean(),
  review: z.object({ request: reviewRequest, changed: z.boolean(), resultingRevision: z.number().int().nonnegative() }).strict().optional()
}).strict();
const common = { strategy: z.literal("source-linked-preferences"),
  revision: z.number().int().nonnegative(), sessions: z.array(sessionSchema) };
const storeSchema = z.discriminatedUnion("version", [
  z.object({ ...common, version: z.literal(1), candidate: z.unknown(), initialPreferences: text,
    preferences: z.array(preferenceSchema) }).strict(),
  z.object({ ...common, version: z.literal(2) }).strict()
]);
type Store = z.infer<typeof storeSchema>;
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
export const sourceFor = (sessionId: string, turnId: string) => `core://${id.parse(sessionId)}/${id.parse(turnId)}`;
function resolveSource(store: Store, source: string) {
  sourceSchema.parse(source);
  const [sessionId, turnId] = source.slice(7).split("/");
  const session = store.sessions.find(s => s.id === sessionId);
  const turn = session?.turns.find(t => t.id === turnId);
  if (!session?.closed || !turn) throw new Error("source_not_archived");
  return { source, threadId: session.threadId, sessionId, ...turn };
}

/** Opt-in store. Never reads or writes default candidate/product paths. */
export class SourceLinkedSessionMemory {
  private readonly path: string;
  constructor(readonly root: string) { this.path = join(resolve(root), "memory.json"); }
  static async initialize(root: string, input: Documents) {
    const documents = documentSchema.parse(input);
    await mkdir(resolve(root), { mode: 0o700 });
    try {
      for (const [name, content] of Object.entries(documents)) {
        await writePrivateFile(join(root, name + ".md"), content, { flag: "wx" });
      }
      const ledger = { version: 2, strategy: "source-linked-preferences", revision: 0, sessions: [] };
      await atomicWrite(join(root, "memory.json"), JSON.stringify(ledger, null, 2) + "\n");
    } catch (error) { await rm(root, { recursive: true, force: true }); throw error; }
    return new SourceLinkedSessionMemory(root);
  }
  async inspect() { return this.mutate(store => store); }
  private async mutate<T>(fn: (store: Store, changes: Partial<Documents>) => T | Promise<T>) {
    const unlock = await acquireWindowsFileLock(this.path, 5000);
    try {
      await finishDocumentCommit(this.root);
      const store = storeSchema.parse(JSON.parse(await readFile(this.path, "utf8")));
      const before = JSON.stringify(store);
      const changes: Partial<Documents> = {};
      const result = await fn(store, changes);
      if (JSON.stringify(store) !== before) {
        const ledger = JSON.stringify(storeSchema.parse(store), null, 2) + "\n";
        if (Object.keys(changes).length) await commitDocuments(this.root, changes, ledger);
        else await atomicWrite(this.path, ledger);
      }
      return result;
    } finally { await unlock(); }
  }
  async open(sessionId: string, threadId: string) {
    id.parse(sessionId); text.parse(threadId);
    return this.mutate(async store => {
      let session = store.sessions.find(s => s.id === sessionId);
      if (session && session.threadId !== threadId) throw new Error("session_thread_mismatch");
      if (!session) {
        if (store.sessions.some(s => !s.closed || !s.review)) throw new Error("previous_session_not_reviewed");
        if (store.sessions.some(s => s.threadId === threadId)) throw new Error("thread_already_bound");
        session = { id: sessionId, threadId, turns: [], openedRevision: store.revision, closed: false };
        store.sessions.push(session);
      }
      return { sessionId, closed: session.closed, revision: store.revision,
        ...(store.version === 2 ? { documents: await readDocuments(this.root) } :
          { candidate: store.candidate, initialPreferences: store.initialPreferences, preferences: store.preferences }) };
    });
  }
  async append(sessionId: string, turn: z.infer<typeof turnSchema>) {
    const parsed = turnSchema.parse(turn);
    return this.mutate(store => {
      const session = store.sessions.find(s => s.id === sessionId);
      if (!session) throw new Error("session_missing");
      const saved = session.turns.find(t => t.id === parsed.id);
      if (saved) { if (!isDeepStrictEqual(saved, parsed)) throw new Error("turn_conflict"); return sourceFor(sessionId, parsed.id); }
      if (session.closed) throw new Error("session_closed");
      session.turns.push(parsed); return sourceFor(sessionId, parsed.id);
    });
  }
  async archive(sessionId: string) {
    return this.mutate(async store => {
      const session = store.sessions.find(s => s.id === sessionId);
      if (!session?.turns.length) throw new Error("nonempty_session_required");
      session.closed = true;
      return { sessionId, coreHash: hash(session.turns), archived: true, reviewed: !!session.review,
        review: session.review, baseRevision: store.revision, ...(store.version === 2 ? { documents: await readDocuments(this.root) } : { preferences: store.preferences }),
        core: session.turns.map(t => ({ ...t, source: sourceFor(sessionId, t.id) })),
        dreamingInstruction: store.version === 2 ? "Review Core against the four current documents. Return targeted edits with current-turn sources. Correct profile facts only with evidence, preserve scope, and use zero edits when appropriate." : "Review the archived interaction against current preferences. Decide what warrants reuse; add, revise or retract scoped preferences with source links. Preserve conditions and exceptions. A session-only request stays in Core. Zero updates are valid. Use a local Codex review; this interface does not call a model." };
    });
  }
  async close(sessionId: string, reviewer = reviewWithLocalCodex) {
    const archive = await this.archive(sessionId);
    let review = archive.review;
    if (!review) {
      try {
        const proposal = reviewRequest.parse(await reviewer(archive));
        review = await this.dream(sessionId, proposal);
      } catch (error) {
        // Another close may have committed while this reviewer was running.
        review = (await this.inspect()).sessions.find(session => session.id === sessionId)?.review;
        if (!review) throw error;
      }
    }
    return { sessionId, archived: true, coreHash: archive.coreHash, reviewed: true, review };
  }
  async dream(sessionId: string, input: DreamingReview) {
    const request = reviewRequest.parse(input);
    return this.mutate(async (store, changes) => {
      const session = store.sessions.find(s => s.id === sessionId);
      if (!session?.closed) throw new Error("archive_before_dreaming");
      if (session.review) {
        if (!isDeepStrictEqual(session.review.request, request)) throw new Error("review_already_recorded");
        return session.review;
      }
      if (store.revision !== request.baseRevision) throw new Error("memory_revision_conflict");
      if (store.version === 2) {
        if (!("edits" in request)) throw new Error("document_edits_required");
        for (const edit of request.edits) {
          for (const source of edit.sources) resolveSource(store, source);
          if (!edit.sources.some(s => s.startsWith(`core://${sessionId}/`))) throw new Error("current_session_source_required");
        }
        Object.assign(changes, applyEdits(await readDocuments(this.root), request.edits));
        const changed = Object.keys(changes).length > 0;
        if (changed) store.revision++;
        session.review = { request, changed, resultingRevision: store.revision };
        return session.review;
      }
      if ("edits" in request) throw new Error("legacy_run_requires_legacy_review");
      const ids = [...request.upsert.map(p => p.id), ...request.remove];
      if (new Set(ids).size !== ids.length) throw new Error("duplicate_preference_operation");
      for (const p of request.upsert) for (const source of p.sources) resolveSource(store, source);
      if (request.upsert.some(p => !p.sources.some(s => s.startsWith(`core://${sessionId}/`)))) throw new Error("current_session_source_required");
      if (request.remove.some(key => !store.preferences.some(p => p.id === key))) throw new Error("preference_missing");
      // Retractions retain the archived review reason and current session; no evidence is erased.
      const next = store.preferences.filter(p => !ids.includes(p.id)).concat(request.upsert).sort((a,b) => a.id.localeCompare(b.id));
      const changed = !isDeepStrictEqual([...store.preferences].sort((a,b) => a.id.localeCompare(b.id)), next);
      if (changed) { store.preferences = next; store.revision++; }
      session.review = { request, changed, resultingRevision: store.revision };
      return session.review;
    });
  }
  async source(source: string) { return resolveSource(await this.inspect(), source); }
  async search(query: string) {
    text.parse(query); const store = await this.inspect();
    return store.sessions.filter(s => s.closed).flatMap(s => s.turns.filter(t =>
      `${t.user}\n${t.assistant}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
      .map(t => resolveSource(store, sourceFor(s.id, t.id))));
  }
}

/** Other experiment strategies implement the same lifecycle; none silently falls back to ours. */
export interface SessionMemory {
  open: SourceLinkedSessionMemory["open"];
  append: SourceLinkedSessionMemory["append"];
  close: SourceLinkedSessionMemory["close"];
  dream: SourceLinkedSessionMemory["dream"];
  source: SourceLinkedSessionMemory["source"];
  search: SourceLinkedSessionMemory["search"];
}
export type MemoryStrategy = "raw-trace" | "core-interaction" | "session-summary-core" | "source-linked-preferences";
export function createSessionMemory(strategy: MemoryStrategy, root: string): SessionMemory {
  if (strategy !== "source-linked-preferences") throw new Error(`memory_strategy_not_implemented:${strategy}`);
  return new SourceLinkedSessionMemory(root);
}
