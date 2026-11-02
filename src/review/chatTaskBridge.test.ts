import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, expect, test } from "vitest";
import { createChatTaskDispatcher, readChatTaskConfig, connectCurrentChat } from "./chatTaskBridge.js";
import type { ApplicationTask } from "./applicationTasks.js";

const directories: string[] = [];
afterEach(async () => { await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true }))); });
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "chat-bridge-")); directories.push(root);
  const threadId = randomUUID(), messageId = randomUUID();
  const executable = join(root, "fake-codex.cjs"), argsPath = join(root, "arguments.json");
  await writeFile(executable, `#!${process.execPath}\nconst fs = require('node:fs'); fs.writeFileSync(${JSON.stringify(argsPath)}, JSON.stringify(process.argv.slice(2))); console.log(${JSON.stringify(`Queued message ${messageId} for thread ${threadId}.`)});\n`, { mode: 0o700 });
  return { root, threadId, messageId, executable, argsPath };
}
test("uses the configured existing chat and passes the whole prompt as one literal CLI argument", async () => {
  const f = await fixture();
  const task = { id: randomUUID(), action: "prepare", mode: "demo" } as ApplicationTask;
  const bridge = createChatTaskDispatcher(f.root, { version: 1, threadId: f.threadId, executable: f.executable }, (_exe, args, options) => promisify(execFile)(process.execPath, [f.executable, ...args], options));
  expect(await bridge.send([task])).toBe(f.messageId);
  const args = JSON.parse(await readFile(f.argsPath, "utf8"));
  expect(args.slice(0, 4)).toEqual(["queue", "--thread", f.threadId, "--message"]);
  expect(args).toHaveLength(6);
  expect(args[5]).toBe("--resume");
  expect(args[4]).toContain(task.id);
  expect(args[4]).toContain("Never open employer forms or submit fictional data");
});
test("does not confirm delivery when the CLI acknowledges a different chat", async () => {
  const f = await fixture();
  const bridge = createChatTaskDispatcher(f.root, { version: 1, threadId: randomUUID(), executable: f.executable }, (_exe, args, options) => promisify(execFile)(process.execPath, [f.executable, ...args], options));
  await expect(bridge.send([])).rejects.toThrow("chat_delivery_unconfirmed");
});
test("private runtime config is optional but malformed config fails closed", async () => {
  const f = await fixture();
  expect(await readChatTaskConfig(f.root)).toBeUndefined();
  await mkdir(join(f.root, "data"));
  await writeFile(join(f.root, "data/chat-runner.json"), JSON.stringify({ version: 1, threadId: f.threadId, executable: f.executable }));
  expect((await readChatTaskConfig(f.root))!.threadId).toBe(f.threadId);
  await writeFile(join(f.root, "data/chat-runner.json"), JSON.stringify({ version: 1, threadId: "not-a-thread", executable: f.executable }));
  await expect(readChatTaskConfig(f.root)).rejects.toThrow();
});


test("a missing connection binds to the hosting chat once without sending or replacing existing configuration",async()=>{
 const f=await fixture();await rm(join(f.root,"data/chat-runner.json"),{force:true});
 expect(await connectCurrentChat(f.root,{})).toBeUndefined();
 expect(await connectCurrentChat(f.root,{CODEX_THREAD_ID:"not-a-thread"})).toBeUndefined();
 const input={CODEX_THREAD_ID:f.threadId,CODEX_CLI_PATH:f.executable};
 const [a,b]=await Promise.all([connectCurrentChat(f.root,input),connectCurrentChat(f.root,input)]);
 expect(a).toEqual({version:1,threadId:f.threadId,executable:f.executable});expect(b).toEqual(a);
 const bytes=await readFile(join(f.root,"data/chat-runner.json"),"utf8");
 expect(await connectCurrentChat(f.root,{CODEX_THREAD_ID:randomUUID(),CODEX_CLI_PATH:"another-cli"})).toEqual(a);
 expect(await readFile(join(f.root,"data/chat-runner.json"),"utf8")).toBe(bytes);
});
