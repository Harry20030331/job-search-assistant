import { resolve } from "node:path";
import { completeScan, readDiscovery } from "../storage/discovery.js";
const [command, ...args] = process.argv.slice(2);
const flags = new Map<string, string>();
if (args.length % 2) throw new Error("invalid_arguments");
for (let i = 0; i < args.length; i += 2) {
  if (!["--path", "--source", "--at"].includes(args[i]!) || flags.has(args[i]!)) throw new Error("invalid_arguments");
  flags.set(args[i]!, args[i + 1]!);
}
if (!flags.get("--path")) throw new Error("invalid_arguments");
const path = resolve(flags.get("--path")!);
if (command === "show" && flags.size === 1) console.log(JSON.stringify(await readDiscovery(path), null, 2));
else if (command === "complete" && flags.size === 3) { await completeScan(path, flags.get("--source")!, flags.get("--at")!, true); console.log(JSON.stringify({ ok: true })); }
else throw new Error("invalid_arguments");
