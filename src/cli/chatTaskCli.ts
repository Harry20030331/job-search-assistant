import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { resolveRecoveryInputs } from "../review/reviewRecovery.js";
import { claimChatTask, finishChatTask, readTasks, runDemoChatTask, type TaskPaths } from "../review/applicationTasks.js";
import { readChatTaskConfig } from "../review/chatTaskBridge.js";
import { assertLiveCandidate } from "../review/liveCandidate.js";

const modulePath = fileURLToPath(import.meta.url);
export async function runChatTaskCli(argv: readonly string[], root = resolve(dirname(modulePath), "../.."), threadId = process.env.CODEX_THREAD_ID): Promise<void> {
  const [command, ...args] = argv;
  if (!["claim", "finish", "run-demo"].includes(command ?? "") || args.length % 2) throw new Error("invalid_arguments");
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index]!, value = args[index + 1]!;
    if (!["--task", "--outcome", "--message"].includes(key) || values.has(key) || !value) throw new Error("invalid_arguments");
    values.set(key, value);
  }
  const id = z.string().uuid().parse(values.get("--task"));
  if (command !== "finish" && values.size !== 1) throw new Error("invalid_arguments");
  const config = await readChatTaskConfig(root);
  if (!threadId || config?.threadId !== threadId) throw new Error("wrong_chat_thread");
  const recovered = await resolveRecoveryInputs(root);
  const paths: TaskPaths = { reviewPath: resolve(recovered.reviewPath), trackerPath: resolve(recovered.trackerPath), jobsPath: resolve(recovered.jobsPath), taskPath: resolve(dirname(recovered.trackerPath), "application-tasks.json") };
  const task = (await readTasks(paths.taskPath)).find(item => item.id === id);
  if (!task || task.chatDelivery?.threadId !== threadId) throw new Error("chat_task_unavailable");
  if (!["queued", "running"].includes(task.state)) {
    process.stdout.write(JSON.stringify({ status: "already_handled", taskId: id, state: task.state }) + "\n");
    return;
  }
  let result = command === "claim" ? await claimChatTask(paths, id, threadId)
    : command === "run-demo" ? await runDemoChatTask(paths, id, threadId)
    : await finishChatTask(paths, id, threadId, z.enum(["completed", "blocked"]).parse(values.get("--outcome")), values.get("--message"));
  if (command === "claim" && result.mode === "codex") {
    try { await assertLiveCandidate(root); }
    catch {
      result = await finishChatTask(paths, id, threadId, "blocked", "Live candidate inputs are missing, invalid or fictional. Check the selected profile before retrying.");
    }
  }
  process.stdout.write(JSON.stringify({ task: result, ...(command === "claim" ? { paths } : {}) }) + "\n");
}
if (process.argv[1] && modulePath === resolve(process.argv[1])) {
  runChatTaskCli(process.argv.slice(2)).catch(error => { process.stderr.write((error instanceof Error ? error.message : "chat_task_failed") + "\n"); process.exitCode = 1; });
}
