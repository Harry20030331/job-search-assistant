import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import { updateInterviewRequest } from "../workbench/interviewRequests.js";
const [action,...args]=process.argv.slice(2);if(!["claim","finish"].includes(action??"")||args.length%2)throw Error("invalid_arguments");
const values=new Map<string,string>();for(let i=0;i<args.length;i+=2){const key=args[i]!,value=args[i+1]!;if(!["--workspace","--request","--outcome","--reply-file"].includes(key)||values.has(key)||!value)throw Error("invalid_arguments");values.set(key,value)}
if(!values.get("--workspace")||!values.get("--request")||(action==="claim"&&values.size!==2)||(action==="finish"&&values.size!==4))throw Error("invalid_arguments");
const result=await updateInterviewRequest(resolve(values.get("--workspace")!),values.get("--request")!,action as "claim"|"finish",process.env.CODEX_THREAD_ID,action==="finish"?z.enum(["completed","blocked"]).parse(values.get("--outcome")):undefined,action==="finish"?await readFile(resolve(values.get("--reply-file")!),"utf8"):undefined);process.stdout.write(JSON.stringify(result)+"\n");
