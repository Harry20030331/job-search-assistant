import { UserSessions } from "../memory/userSessions.js";
import { readFile, rm } from "node:fs/promises";
import { SourceLinkedSessionMemory } from "../memory/sessionMemory.js";
import { LocalTaskAdapter } from "../memory/localTaskAdapter.js";

// JSON envelopes avoid shell interpolation of user text. Every operation needs an explicit root.
const [command, rootFlag, root, inputFlag, inputPath, ...extra] = process.argv.slice(2);
try {
  if (!command || (rootFlag !== "--root" && rootFlag !== "--workspace") || !root || (inputFlag && inputFlag !== "--input") || extra.length || (inputFlag && !inputPath)) throw new Error("invalid_cli_arguments");
  const input = inputPath ? JSON.parse(await readFile(inputPath, "utf8")) : {};
  if (rootFlag === "--workspace") {
    const user = new UserSessions(root);
    let result;
    switch (command) {
      case "open": result = await user.open(input.sessionId, input.threadId); break;
      case "append": result = await user.append(input.sessionId, input.turn); break;
      case "close": result = await user.close(input.sessionId); break;
      case "source": result = await user.source(input.source); break;
      default: throw new Error("unknown_workspace_command");
    }
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  } else {
    const memory = new SourceLinkedSessionMemory(root); const tasks = new LocalTaskAdapter(root);
    let result: unknown;
    switch (command) {
      case "init":
        await SourceLinkedSessionMemory.initialize(root, input.documents);
        try { await tasks.initialize(input.jobs ?? []); }
        catch (error) { await rm(root, { recursive: true, force: true }); throw error; }
        result = { initialized: true };
        break;
      case "open": result = await memory.open(input.sessionId, input.threadId); break;
      case "append": result = await memory.append(input.sessionId, input.turn); break;
      case "close": result = await memory.close(input.sessionId); break;
      case "archive": result = await memory.archive(input.sessionId); break;
      case "dream": result = await memory.dream(input.sessionId, input.review); break;
      case "inspect": result = await memory.inspect(); break;
      case "source": result = await memory.source(input.source); break;
      case "search": result = await memory.search(input.query); break;
      case "tasks": result = await tasks.read(); break;
      case "add-jobs": result = await tasks.add(input.jobs); break;
      case "decide": result = await tasks.decide(input); break;
      case "draft": result = await tasks.draft(input); break;
      default: throw new Error("unknown_command");
    }
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  }
} catch (error) {
  process.stderr.write((error instanceof Error ? error.message : "memory_command_failed") + "\n"); process.exitCode = 1;
}
