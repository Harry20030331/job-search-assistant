import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { workIntakeRequest } from "../workbench/intakeRequests.js";
const [action,...args]=process.argv.slice(2);
if(!["claim","preview","block"].includes(action??"")||args.length%2)throw Error("invalid_arguments");
const values=new Map<string,string>();
for(let i=0;i<args.length;i+=2){const key=args[i]!,value=args[i+1]!;if(!["--request","--revision","--input","--message"].includes(key)||values.has(key)||!value)throw Error("invalid_arguments");values.set(key,value)}
if(!values.has("--request")||!values.has("--revision")||values.size!==(action==="claim"?2:3))throw Error("invalid_arguments");
const revision=z.coerce.number().int().nonnegative().parse(values.get("--revision"));
const input=action==="preview"?JSON.parse(await readFile(resolve(z.string().min(1).parse(values.get("--input"))),"utf8")):action==="block"?z.string().min(1).parse(values.get("--message")):undefined;
const root=resolve(dirname(fileURLToPath(import.meta.url)),"../..");
process.stdout.write(JSON.stringify(await workIntakeRequest(root,z.string().uuid().parse(values.get("--request")),revision,process.env.CODEX_THREAD_ID,action as "claim"|"preview"|"block",input))+"\n");
