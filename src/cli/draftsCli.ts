import { resolve } from "node:path";
import { pruneSubmittedDrafts } from "../storage/drafts.js";
if (process.argv[2] !== "prune" || process.argv[3] !== "--path" || !process.argv[4] || process.argv.length !== 5) throw new Error("invalid_arguments");
console.log(JSON.stringify({ removed: await pruneSubmittedDrafts(resolve(process.argv[4])) }));
