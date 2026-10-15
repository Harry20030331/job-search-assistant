import { resolve } from "node:path";
import { startDemo } from "./demo.js";
const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== "--dir" || !args[1] || args[1].startsWith("--")) throw new Error("Usage: npm run demo -- --dir <new-directory>");
const demo = await startDemo(resolve(args[1]));
console.log(JSON.stringify({ fictional: true, root: demo.root, reviewUrl: demo.reviewUrl, statusUrl: demo.statusUrl, formUrl: demo.formUrl }, null, 2));
for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => { void demo.close().then(() => process.exit(0)); });
