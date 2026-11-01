import { resolve } from "node:path";
import { z } from "zod";
import { updateSearchRequest } from "../workbench/searchRequests.js";
const [action,...args]=process.argv.slice(2);
if(!["claim","finish"].includes(action??"")||args.length%2)throw Error("invalid_arguments");
const values=new Map<string,string>();
for(let i=0;i<args.length;i+=2){const key=args[i]!,value=args[i+1]!;if(!["--workspace","--request","--outcome"].includes(key)||values.has(key)||!value)throw Error("invalid_arguments");values.set(key,value)}
if(!values.get("--workspace")||!values.get("--request")||(action==="claim"&&values.size!==2)||(action==="finish"&&values.size!==3))throw Error("invalid_arguments");
const result=await updateSearchRequest(resolve(values.get("--workspace")!),values.get("--request")!,action as "claim"|"finish",process.env.CODEX_THREAD_ID,action==="finish"?z.enum(["completed","blocked"]).parse(values.get("--outcome")):undefined);
process.stdout.write(JSON.stringify({requestId:result.requestId,state:result.state})+"\n");
