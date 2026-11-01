import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { afterEach, expect, test, vi } from "vitest";
import { loadExample } from "../example.js";
import { ApplicationTaskService, demoTaskExecutor, readTasks } from "../review/applicationTasks.js";
import { runChatTaskCli } from "./chatTaskCli.js";

const directories: string[] = [], services: ApplicationTaskService[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const service of services.splice(0)) await service.close();
  for (const root of directories.splice(0)) await rm(root, {recursive: true, force: true});
});

test("a live task delivered before fixture validation is blocked in the bound chat", async () => {
  const root = await mkdtemp(join(tmpdir(), "chat-cli-")); directories.push(root);
  const inputs = await loadExample(root, fileURLToPath(new URL("../../examples", import.meta.url)));
  const threadId = randomUUID(), taskPath = join(root, "data/application-tasks.json");
  await writeFile(join(root, "data/chat-runner.json"), JSON.stringify({version: 1, threadId, executable: "/unused/test-cli"}));
  const service = new ApplicationTaskService({...inputs, taskPath}, "codex", demoTaskExecutor, {threadId, send: async () => randomUUID()});
  services.push(service); await service.start();
  const [task] = await service.enqueue({action: "prepare", mode: "codex", requestId: randomUUID(), jobIds: ["alex-nooks-311d6e70"]});
  await expect(runChatTaskCli(["claim", "--task", task!.id], root, randomUUID())).rejects.toThrow("wrong_chat_thread");
  expect((await readTasks(taskPath))[0]!.state).toBe("queued");
  const output = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  await runChatTaskCli(["claim", "--task", task!.id, "--workspace", root], "/unused/fictional-repository", threadId);
  expect((await readTasks(taskPath))[0]).toMatchObject({state: "blocked", message: expect.stringContaining("fictional")});
  await runChatTaskCli(["claim", "--task", task!.id], root, threadId);
  expect(String(output.mock.calls.at(-1)![0])).toContain("already_handled");
});
