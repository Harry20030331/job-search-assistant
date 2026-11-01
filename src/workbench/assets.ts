import { readFile } from "node:fs/promises";
import type { ServerResponse } from "node:http";
/** Fixed local asset path; no user-controlled filesystem lookup. */
export async function serveWorkspaceFont(response: ServerResponse) {
  const bytes = await readFile(new URL("./assets/InterVariable.woff2", import.meta.url));
  response.writeHead(200, { "content-type": "font/woff2", "cache-control": "public, max-age=86400", "x-content-type-options": "nosniff" });
  response.end(bytes);
}
