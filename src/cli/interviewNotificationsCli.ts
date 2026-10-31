import { resolve, join } from "node:path";
import { acknowledgeNotice, pendingNotices } from "../interview/notifications.js";

const [action, ...args] = process.argv.slice(2);
const values = new Map<string, string>();
let includeSynthetic = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--include-synthetic") { includeSynthetic = true; continue; }
  const flag = args[i]!, value = args[++i];
  if (!["--runtime-dir", "--profile", "--id"].includes(flag) || !value || value.startsWith("--") || values.has(flag)) throw new Error("invalid_notification_arguments");
  values.set(flag, value);
}
if (!["pending", "ack"].includes(action ?? "") || !values.has("--runtime-dir")) throw new Error("invalid_notification_arguments");
const root = resolve(values.get("--runtime-dir")!);
const paths = { trackerPath: join(root, "opportunities.json"), profilePath: resolve(values.get("--profile") ?? join(root, "candidate.json")) };
if (action === "pending") {
  const notifications = (await pendingNotices(paths, "chat")).filter(item => includeSynthetic || !item.synthetic);
  process.stdout.write(JSON.stringify({ notifications }) + "\n");
} else {
  if (!values.has("--id")) throw new Error("notification_id_required");
  const acknowledged = await acknowledgeNotice(paths, values.get("--id")!, "chat");
  process.stdout.write(JSON.stringify({ acknowledged }) + "\n");
}
