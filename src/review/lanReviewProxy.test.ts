import { expect, test } from "vitest";
import { allowedLanRequest } from "./lanReviewProxy.js";

const authority = "192.0.2.10:64441";
const client = "192.0.2.11";
test("allows only the designated device and exact LAN authority", () => {
  expect(allowedLanRequest(client, client, authority, { host: authority }, "/status/us")).toBe(true);
  expect(allowedLanRequest(`::ffff:${client}`, client, authority,
    { host: authority, origin: `http://${authority}` }, "/api/review/answer")).toBe(true);
  expect(allowedLanRequest("192.0.2.12", client, authority, { host: authority }, "/review")).toBe(false);
  expect(allowedLanRequest(client, client, authority, { host: "evil.example" }, "/review")).toBe(false);
});
test("rejects cross-origin mutation and proxy-style URLs", () => {
  for (const origin of ["http://evil.example", "null", `http://${authority}.evil.example`]) {
    expect(allowedLanRequest(client, client, authority, { host: authority, origin }, "/api/review/decision")).toBe(false);
  }
  for (const path of [undefined, "//evil.example", "http://evil.example"]) {
    expect(allowedLanRequest(client, client, authority, { host: authority }, path)).toBe(false);
  }
});
