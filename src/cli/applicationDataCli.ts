import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { setStatusVisibility } from "../tracker.js";
import { publishReviewItem, type ReviewItem } from "../review/reviewStore.js";

const commandSchema = z.discriminatedUnion("operation", [
  z.object({ version: z.literal(1), operation: z.literal("status.visibility"), trackerPath: z.string().min(1), applicationId: z.string().min(1), visible: z.boolean() }).strict(),
  z.object({ version: z.literal(1), operation: z.literal("review.publish"), reviewPath: z.string().min(1), item: z.unknown(), expected: z.object({ snapshotId: z.string().min(1), revision: z.number().int().positive().nullable(), decision: z.enum(["pending", "approved", "skipped", "stale", "consumed"]) }).strict().nullable() }).strict()
]);

export async function applyApplicationData(input: unknown) {
  const command = commandSchema.parse(input);
  if (command.operation === "status.visibility") {
    const record = await setStatusVisibility(command.trackerPath, command.applicationId, command.visible);
    return { ok: true, applicationId: record.applicationId, visible: !record.hiddenFromStatus };
  }
  const item = await publishReviewItem(command.reviewPath, command.item as ReviewItem, command.expected);
  return { ok: true, applicationId: item.applicationId, snapshotId: item.snapshotId };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    if (process.argv.length !== 4 || process.argv[2] !== "--input") throw new Error("invalid_arguments");
    console.log(JSON.stringify(await applyApplicationData(JSON.parse(await readFile(process.argv[3]!, "utf8")))));
  } catch (error) {
    const safeCodes = new Set(["review_update_conflict", "fresh_pending_snapshot_required", "replacement_snapshot_required", "submitted_history_is_immutable", "application_identity_changed", "english_review_content_required"]);
    const code = error instanceof Error && safeCodes.has(error.message) ? error.message : "data_update_failed";
    console.log(JSON.stringify({ ok: false, error: code }));
    process.exitCode = 1;
  }
}
