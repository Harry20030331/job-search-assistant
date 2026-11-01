import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { startWorkbench } from "../workbench/start.js";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"../..");
const thread=z.string().uuid().safeParse(process.env.CODEX_THREAD_ID);
const server=await startWorkbench(root,{chat:thread.success?{version:1,threadId:thread.data,executable:process.env.CODEX_CLI_PATH??"codex"}:undefined});
process.stdout.write(`welcome_url=${server.address}\n`);
for(const signal of ["SIGINT","SIGTERM"] as const)process.once(signal,()=>{void server.close().then(()=>process.exit(0))});
