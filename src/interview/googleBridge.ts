import { resolveInterviewPython } from "./pythonRuntime.mjs";
import { spawn, type ChildProcess } from "node:child_process";
import { access } from "node:fs/promises";
import { request as httpRequest, type IncomingMessage, type ServerResponse } from "node:http";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pythonRoot = resolve(dirname(fileURLToPath(import.meta.url)), "python");
export const googleRoutes = new Set(["/google/status", "/google/connect", "/google/callback", "/google/sign-out"]);

/** Fixed loopback proxy to the existing OAuth implementation; never expose token files. */
export class GoogleBridge {
  private child: ChildProcess | undefined;
  private pending: Promise<number> | undefined;
  private stopped = false;
  constructor(private readonly root: string) {}

  private start(origin: string): Promise<number> {
    if (this.stopped) return Promise.reject(new Error("google_connection_unavailable"));
    if (this.pending) return this.pending;
    this.pending = (async () => {
      await access(join(this.root, "client.json"));
      return new Promise<number>((accept, reject) => {
        const child = spawn(resolveInterviewPython(), ["-m", "interview.onboarding", "--root", resolve(this.root),
          "--port", "0", "--workbench", "--parent-stdin", "--public-origin", origin], { cwd: pythonRoot, shell: false, windowsHide: true,
          stdio: ["pipe", "pipe", "pipe"], env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONDONTWRITEBYTECODE: "1" } });
        this.child = child;
        let output = "", ready = false;
        const timer = setTimeout(() => { child.kill(); reject(new Error("google_connection_unavailable")); }, 10000);
        child.stderr!.resume();
        child.stdout!.setEncoding("utf8").on("data", chunk => {
          output += chunk;
          if (output.length > 4096) { child.kill(); clearTimeout(timer); reject(new Error("google_connection_unavailable")); return; }
          if (!output.includes("\n") || ready) return;
          try {
            const value = JSON.parse(output.split("\n")[0]!);
            if (value.ready !== true || !Number.isInteger(value.port) || value.port < 1 || value.port > 65535) throw new Error();
            ready = true; clearTimeout(timer); accept(value.port);
          } catch { child.kill(); clearTimeout(timer); reject(new Error("google_connection_unavailable")); }
        });
        child.on("error", () => { clearTimeout(timer); reject(new Error("google_connection_unavailable")); });
        child.on("exit", () => { clearTimeout(timer); this.pending = undefined; if (!ready) reject(new Error("google_connection_unavailable")); });
      });
    })().catch(error => { this.pending = undefined; throw error; });
    return this.pending;
  }

  async proxy(request: IncomingMessage, response: ServerResponse, origin: string): Promise<void> {
    const url = new URL(request.url ?? "/", origin);
    if (!googleRoutes.has(url.pathname) || request.headers.host !== new URL(origin).host ||
        (request.method !== "GET" && request.method !== "POST") ||
        (request.method === "POST" && (request.headers.origin !== origin || request.headers["transfer-encoding"]))) {
      request.resume(); response.writeHead(403, { "cache-control": "no-store" }); response.end("Invalid Google connection request"); return;
    }
    if ((request.method === "GET" && url.pathname === "/google/sign-out") ||
        (request.method === "POST" && !["/google/connect", "/google/sign-out"].includes(url.pathname))) {
      request.resume(); response.writeHead(405); response.end("Method not allowed"); return;
    }
    const length = request.headers["content-length"];
    if (request.method === "POST" && (typeof length !== "string" || !/^[1-9][0-9]*$/.test(length) || Number(length) > 4096)) {
      request.resume(); response.writeHead(400); response.end("Invalid connection request"); return;
    }
    let port: number;
    try { port = await this.start(origin); }
    catch {
      request.resume();
      const status = url.pathname === "/google/status";
      response.writeHead(status ? 200 : 503, { "content-type": status ? "application/json; charset=utf-8" : "text/plain; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" });
      response.end(status ? JSON.stringify({ connected: false, configured: false, account: null, error: "Google connection is not available. The developer needs to configure this installation once." }) : "Google connection is unavailable. Return to Account and try again.");
      return;
    }
    await new Promise<void>(resolveRequest => {
      const headers: Record<string, string> = { Host: new URL(origin).host };
      for (const name of ["cookie", "origin", "content-type", "content-length"]) {
        const value = request.headers[name]; if (typeof value === "string") headers[name] = value;
      }
      const upstream = httpRequest({ hostname: "127.0.0.1", port, method: request.method, path: url.pathname + url.search, headers, timeout: 65000 }, result => {
        response.writeHead(result.statusCode ?? 502, result.headers);
        result.pipe(response); result.on("end", resolveRequest);
        result.on("error", () => { response.destroy(); resolveRequest(); });
      });
      upstream.on("error", () => {
        if (!response.headersSent) response.writeHead(502, { "cache-control": "no-store" });
        response.end("Google connection could not be completed. Return to Account and try again."); resolveRequest();
      });
      upstream.on("timeout", () => upstream.destroy());
      request.pipe(upstream);
    });
  }

  close() { this.stopped = true; this.child?.stdin?.end(); this.child?.kill(); }
}
