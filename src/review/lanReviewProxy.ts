import { createServer, request as httpRequest, type IncomingHttpHeaders } from "node:http";
import { isIPv4 } from "node:net";

export function allowedLanRequest(peer: string | undefined, client: string, authority: string,
  headers: IncomingHttpHeaders, path: string | undefined): boolean {
  return peer?.replace(/^::ffff:/, "") === client && headers.host === authority &&
    (headers.origin === undefined || headers.origin === `http://${authority}`) &&
    !!path?.startsWith("/") && !path.startsWith("//");
}

// Opt-in, one-device campus-network bridge. The canonical server stays loopback-only.
export function startLanReviewProxy(host: string, client: string, port = 64441, upstreamPort = 64440) {
  if (!isIPv4(host) || !isIPv4(client) || host === client || client.startsWith("127.")) {
    throw new Error("distinct_ipv4_host_and_client_required");
  }
  const authority = `${host}:${port}`;
  const server = createServer((req, res) => {
    const requestOrigin = req.headers.origin;
    if (!allowedLanRequest(req.socket.remoteAddress, client, authority, req.headers, req.url)) {
      res.writeHead(403, { "cache-control": "no-store" });
      res.end("Access restricted to the configured review device.");
      req.resume();
      return;
    }
    // Preserve upstream CSRF checks after validating the real LAN authority/origin.
    const headers: IncomingHttpHeaders = { ...req.headers, host: `127.0.0.1:${upstreamPort}` };
    delete headers["forwarded"];
    delete headers["x-forwarded-for"];
    delete headers["x-forwarded-host"];
    if (requestOrigin !== undefined) headers.origin = `http://127.0.0.1:${upstreamPort}`;
    const upstream = httpRequest({
      hostname: "127.0.0.1", port: upstreamPort, method: req.method,
      path: req.url, headers
    }, response => {
      res.writeHead(response.statusCode ?? 502, response.headers);
      response.pipe(res);
    });
    upstream.on("error", () => {
      if (!res.headersSent) res.writeHead(502, { "cache-control": "no-store" });
      res.end("Local review server unavailable.");
    });
    req.on("aborted", () => upstream.destroy());
    res.on("close", () => upstream.destroy());
    req.pipe(upstream);
  });
  return new Promise<typeof server>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      resolve(server);
    });
  });
}
