import { startLanReviewProxy } from "../review/lanReviewProxy.js";

const [host, client] = process.argv.slice(2);
if (!host || !client || process.argv.length !== 4) {
  throw new Error("usage: lanReviewProxyCli.ts <server-IPv4> <client-IPv4>");
}
await startLanReviewProxy(host, client);
process.stdout.write(`Client review URL: http://${host}:64441/status/us\nAllowed device: ${client}\n`);
