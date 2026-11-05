import { randomUUID } from "node:crypto";
import { readFile, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { writePrivateFile } from "../storage/privateFiles.js";

export const documentNames = ["profile", "job-selection", "application-answers", "interview-preparation"] as const;
export const documentName = z.enum(documentNames);
const markdown = z.string().refine(value => value.trim().length > 0);
export const documentSchema = z.object({
  profile: markdown, "job-selection": markdown, "application-answers": markdown, "interview-preparation": markdown
}).strict();
export type Documents = z.infer<typeof documentSchema>;
export const sourceSchema = z.string().regex(/^core:\/\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+$/);
export const documentReview = z.object({
  baseRevision: z.number().int().nonnegative(), reason: z.string().trim().min(1),
  edits: z.array(z.object({
    document: documentName, before: z.string(), after: z.string(), sources: z.array(sourceSchema).min(1)
  }).strict())
}).strict();

export async function readDocuments(root: string): Promise<Documents> {
  const entries = await Promise.all(documentNames.map(async name =>
    [name, await readFile(join(root, name + ".md"), "utf8")] as const));
  return documentSchema.parse(Object.fromEntries(entries));
}

export function applyEdits(current: Documents, edits: z.infer<typeof documentReview>["edits"], allowEmptyPreferences = false) {
  const changes: Partial<Documents> = {};
  for (const edit of edits) {
    const body = changes[edit.document] ?? current[edit.document];
    const links = edit.sources.map(source => `[${source.slice(7)}](${source})`).join(" ");
    const replacement = edit.after.trim() ? `${edit.after.trimEnd()} ${links}` : "";
    if (!edit.before) {
      if (!replacement) throw new Error("empty_document_edit");
      changes[edit.document] = body.trimEnd() + "\n\n" + replacement + "\n";
    } else {
      const at = body.indexOf(edit.before);
      if (at < 0 || body.indexOf(edit.before, at + 1) >= 0) throw new Error("document_anchor_not_unique");
      changes[edit.document] = body.slice(0, at) + replacement + body.slice(at + edit.before.length);
    }
  }
  if (!allowEmptyPreferences) documentSchema.parse({ ...current, ...changes });
  return changes;
}

export async function atomicWrite(path: string, content: string) {
  const temporary = path + "." + randomUUID() + ".tmp";
  try {
    await writePrivateFile(temporary, content, { flag: "wx" });
    await rename(temporary, path);
  } finally { await rm(temporary, { force: true }); }
}

// A validated, durable redo record covers the document files and the Core review receipt.
// All runtime readers hold the same root lock and replay it before observing state.
const transaction = z.object({ documents: documentSchema.partial(), ledger: z.string() }).strict();
export async function finishDocumentCommit(root: string) {
  const path = join(root, ".dream-pending.json");
  let contents: string;
  try { contents = await readFile(path, "utf8"); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return; throw error; }
  const pending = transaction.parse(JSON.parse(contents));
  for (const [name, body] of Object.entries(pending.documents)) {
    await atomicWrite(join(root, name + ".md"), body);
  }
  await atomicWrite(join(root, "memory.json"), pending.ledger);
  await rm(path);
}

export async function commitDocuments(root: string, documents: Partial<Documents>, ledger: string) {
  await atomicWrite(join(root, ".dream-pending.json"), JSON.stringify({ documents, ledger }));
  await finishDocumentCommit(root);
}
