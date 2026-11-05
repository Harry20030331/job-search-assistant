import { runInNewContext } from "node:vm";
import { expect, test } from "vitest";
import { interviewBrowserScript } from "./browserActions.js";

function harness(options: { failPage?: boolean; otherRound?: boolean } = {}) {
  const before = JSON.stringify([1, "proposal-1", true, false, "running"]);
  const after = JSON.stringify([1, "proposal-1", true, true, "ready"]);
  const practice = { dataset: { practiceRound: "round-1", practiceState: before }, children: ["Waiting"], replaceChildren(...nodes: string[]) { this.children = nodes; } };
  let tick: () => Promise<void> = async () => {}, reloads = 0, pageFetches = 0;
  const unsentRequest = { value: "My unsent availability" };
  runInNewContext(interviewBrowserScript, {
    document: { getElementById: () => null, querySelector: (selector: string) => selector === "[data-practice-round]" ? practice : null },
    location: { href: "http://localhost/interviews?interview=round-1&view=practice", reload: () => reloads++ },
    setInterval: (callback: typeof tick, ms: number) => { tick = callback; expect(ms).toBe(3000); },
    fetch: async (url: string) => url === "/api/interviews/state" ? { ok: true, json: async () => ({ csrf: "token", notifications: [], rounds: [{ id: "round-1", revision: 1, proposalId: "proposal-1", current: true, materialReady: true, generation: { status: "ready" } }] }) } : (++pageFetches, { ok: !options.failPage, text: async () => "server-rendered practice" }),
    DOMParser: class { parseFromString() { return { querySelector: () => ({ dataset: { practiceRound: options.otherRound ? "round-2" : "round-1", practiceState: after }, childNodes: ["Generated questions"] }) }; } }
  });
  return { practice, unsentRequest, tick: () => tick(), reloads: () => reloads, pageFetches: () => pageFetches };
}

test("Practice updates on first poll without an approval button or page reload and preserves unsent requests", async () => {
  const h = harness();
  await expect.poll(() => h.practice.children[0]).toBe("Generated questions");
  expect(h.reloads()).toBe(0);
  expect(h.unsentRequest.value).toBe("My unsent availability");
  await h.tick();
  expect(h.pageFetches()).toBe(1);
});

test.each([{ failPage: true }, { otherRound: true }])("Practice preserves existing content on failed fetch or mismatched round: %j", async options => {
  const h = harness(options);
  await expect.poll(h.pageFetches).toBe(1);
  await h.tick();
  expect(h.practice.children).toEqual(["Waiting"]);
  expect(h.reloads()).toBe(0);
});
