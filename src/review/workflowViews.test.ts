import { Script, runInNewContext } from "node:vm";
import { webcrypto } from "node:crypto";
import { expect, test } from "vitest";
import { withWorkflowControls } from "./workflowViews.js";
import { renderReviewPage, renderUsStatusPage } from "./reviewViews.js";

test("both workflow variants contain valid scripts and show only unavailable runner status", () => {
  for (const mode of ["demo", "codex", undefined] as const) {
    for (const page of ['<header class="review-top"></header>', '<header class="mast"><a href="/review">Review</a></header>']) {
      const html = withWorkflowControls(`<html><head></head><body>${page}<main>Applications</main></body></html>`, mode);
      for (const script of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) expect(() => new Script(script[1]!)).not.toThrow();
      expect(html).not.toContain("Demo · no submissions");
      expect(html).not.toContain("Activity");
      expect(html).not.toContain("task-progress");
      if (mode === undefined) expect(html).toContain("Agent offline");
      else expect(html).not.toContain('class="workspace-mode"');
      expect(html.indexOf('class="workflow"')).toBeGreaterThan(html.indexOf('</main>'));
      if (page.includes('review-top')) {
        expect(html).toContain('id="submit-applications"');
        expect(html).not.toContain('id="run-selected"');
      } else {
        expect(html).not.toContain('id="submit-applications"');
        expect(html).toContain('disabled>Apply ');
        expect(html).not.toContain('id="review-count"');
      }
    }
  }
});

test("Review counts all approved applications and sends their exact revisions only on the final Submit click", async () => {
  const handlers: Record<string, () => Promise<void>> = {};
  const elements = new Map<string, any>();
  const element = (id: string): any => {
    if (id === 'run-selected') return null;
    if (!elements.has(id)) elements.set(id, { disabled: false, textContent: '', replaceChildren() {}, append() {},
      addEventListener(event: string, handler: () => Promise<void>) { handlers[id + ':' + event] = handler; } });
    return elements.get(id);
  };
  const first = { applicationId: 'first', snapshotId: 'snapshot-1', revision: 1 };
  const second = { applicationId: 'second', snapshotId: 'snapshot-2', revision: 3 };
  let approvals = [first], poll!: () => void;
  const requests: any[] = [];
  const tasks: any[] = [], storage = new Map<string, string>();
  const html = withWorkflowControls('<html><head></head><body><header class="review-top"></header><main></main></body></html>', 'demo');
  runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)![1]!, {
    crypto: webcrypto, setInterval(fn: () => void) { poll = fn; },
    sessionStorage: { getItem: (key: string) => storage.get(key), setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) },
    document: { hidden: false, getElementById: element, querySelector: element, querySelectorAll: () => [], createElement: element },
    fetch: async (_url: string, options?: {body: string}) => {
      if (!options) return { ok: true, json: async () => ({mode: 'demo', tasks, approvals}) };
      requests.push(JSON.parse(options.body)); approvals = [];
      tasks.push({requestId: requests[0].requestId, action: "submit", mode: "demo", state: "queued"});
      return { ok: true, json: async () => ({tasks: []}) };
    }
  });
  await new Promise(resolve => setImmediate(resolve));
  expect(element('submission-count').textContent).toBe('(1)');
  approvals = [first, second]; poll(); await new Promise(resolve => setImmediate(resolve));
  expect(element('submission-count').textContent).toBe('(2)');
  expect(requests).toEqual([]);
  await handlers['submit-applications:click']!();
  expect(requests).toHaveLength(1);
  expect(requests[0]).toMatchObject({action: 'submit', mode: 'demo', selections: [first, second]});
  expect(element('submission-count').textContent).toBe('(0)');
  expect(element('submit-applications').disabled).toBe(true);
  expect(storage.get("applications:pending-submission:demo")).toBe(requests[0].requestId);
});

test("website retries retain the request ID after a lost response instead of starting another task", async () => {
  const handlers: Record<string, () => Promise<void>> = {};
  const elements = new Map<string, any>();
  const element = (id: string) => {
    if (id === "submit-applications") return null;
    if (!elements.has(id)) elements.set(id, { disabled: false, textContent: "", open: false, replaceChildren() {}, append() {}, addEventListener(event: string, handler: () => Promise<void>) { handlers[id + ':' + event] = handler; } });
    return elements.get(id);
  };
  const checkbox = { checked: true, value: "job-1", disabled: false, addEventListener() {} };
  const requests: Record<string, any>[] = [];
  const tasks: any[] = [], storage = new Map<string, string>();
  let failed = false;
  const html = withWorkflowControls('<html><head></head><body><header></header></body></html>', "demo");
  runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)![1]!, {
    crypto: webcrypto, setInterval() {},
    sessionStorage: { getItem: (key: string) => storage.get(key), setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) },
    document: { hidden: false, getElementById: element, querySelector: element,
      querySelectorAll: (selector: string) => selector === ".job-select" ? [checkbox] : [], createElement: element },
    fetch: async (_url: string, options?: { body: string }) => {
      if (!options) return { ok: true, json: async () => ({ mode: "demo", tasks, reviewCount: 4 }) };
      requests.push(JSON.parse(options.body));
      if (!failed) { failed = true; throw Error("Connection lost"); }
      tasks.push({requestId: requests[0]!.requestId, action: "prepare", mode: "demo", state: "queued"});
      return { ok: true, json: async () => ({ tasks: [] }) };
    }
  });
  await handlers['run-selected:click']!();
  expect(checkbox.checked).toBe(true);
  await handlers['run-selected:click']!();
  expect(requests).toHaveLength(2);
  expect(requests[0]).toEqual(requests[1]);
  expect(requests[0]).toMatchObject({ action: "prepare", mode: "demo", jobIds: ["job-1"] });
  expect(checkbox.checked).toBe(false);
  expect(element("review-count").textContent).toBe("(4)");
  expect(handlers["submit-applications:click"]).toBeUndefined();
  expect(html).not.toContain("task-progress");
  expect(storage.get("applications:pending-preparation:demo")).toBe(requests[0]!.requestId);
});

test.each(["demo", "codex"] as const)("%s Apply resumes after reload and opens Review when the first draft is ready", async mode => {
  let poll!: () => void;
  const redirects: string[] = [], storage = new Map([[`applications:pending-preparation:${mode}`, "selected-batch"]]);
  const elements = new Map<string, any>();
  const element = (id: string): any => {
    if (id === "submit-applications") return null;
    if (!elements.has(id)) elements.set(id, { textContent: "", addEventListener() {} });
    return elements.get(id);
  };
  const checkbox = { checked: false, addEventListener() {} };
  const tasks = [
    {requestId: "selected-batch", action: "prepare", mode, state: "running"},
    {requestId: "selected-batch", action: "prepare", mode, state: "queued"},
    {requestId: "another-batch", action: "prepare", mode, state: "needs_review"}
  ];
  const html = withWorkflowControls('<html><head></head><body><main></main></body></html>', mode);
  runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)![1]!, {
    crypto: webcrypto, setInterval(fn: () => void) { poll = fn; },
    sessionStorage: {getItem: (key: string) => storage.get(key), removeItem: (key: string) => storage.delete(key)},
    location: {assign: (url: string) => redirects.push(url)},
    document: {hidden: false, getElementById: element, querySelector: element, querySelectorAll: (selector: string) => selector === ".job-select" ? [checkbox] : []},
    fetch: async () => ({ok: true, json: async () => ({mode, tasks, approvals: []})})
  });
  await new Promise(resolve => setImmediate(resolve)); expect(redirects).toEqual([]);
  tasks[0]!.state = "needs_review"; checkbox.checked = true;
  poll(); await new Promise(resolve => setImmediate(resolve)); expect(redirects).toEqual([]);
  checkbox.checked = false; poll(); await new Promise(resolve => setImmediate(resolve));
  expect(redirects).toEqual(["/review"]); expect(tasks[1]!.state).toBe("queued"); expect(storage.size).toBe(0);
  poll(); await new Promise(resolve => setImmediate(resolve)); expect(redirects).toHaveLength(1);
});

test.each(["blocked", "interrupted", "removed"])("Apply does not open an empty Review when its request is %s", async state => {
  const redirects: string[] = []; let cleared = false;
  const element = (id: string) => id === "submit-applications" ? null : {textContent: "", addEventListener() {}};
  const html = withWorkflowControls('<html><head></head><body><main></main></body></html>', "demo");
  runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)![1]!, {
    crypto: webcrypto, setInterval() {},
    sessionStorage: {getItem: () => "batch", removeItem: () => {cleared = true;}},
    location: {assign: (url: string) => redirects.push(url)},
    document: {getElementById: element, querySelector: element, querySelectorAll: () => []},
    fetch: async () => ({ok: true, json: async () => ({mode: "demo", approvals: [], tasks: state === "removed" ? [] : [{requestId: "batch", action: "prepare", mode: "demo", state}]})})
  });
  await new Promise(resolve => setImmediate(resolve));
  expect(redirects).toEqual([]); expect(cleared).toBe(true);
});

test("workflow changes refresh the page after edits are saved, never while text or selections are pending", async () => {
  for (const kind of ["clean", "dirty", "selected", "saving", "focused"] as const) {
    let poll!: () => void, reloads = 0;
    const elements = new Map<string, any>();
    const element = (id: string): any => {
      if (id === "run-selected") return null;
      if (!elements.has(id)) elements.set(id, { disabled: false, textContent: "", replaceChildren() {}, append() {}, addEventListener() {} });
      return elements.get(id);
    };
    const state = { dirtyInputs: new Set(kind === "dirty" ? ["answer"] : []) };
    const selection = { checked: kind === "selected", value: "job", addEventListener() {} };
    const save = { textContent: kind === "saving" ? "Saving…" : "Saved" };
    let focused = kind === "focused";
    const html = withWorkflowControls('<html><head></head><body><header class="review-top"></header><main></main></body></html>', "demo", "old-version");
    runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)![1]!, {
      crypto: webcrypto, desiredStates: new Map([["application", state]]),
      location: { reload() { reloads++; } },
      setInterval(fn: () => void) { poll = fn; },
      document: { hidden: false, activeElement: { matches: () => focused }, getElementById: element, querySelector: element,
        querySelectorAll: (selector: string) => selector === ".job-select" ? [selection] : selector === ".save-status" ? [save] : [], createElement: element },
      fetch: async () => ({ ok: true, json: async () => ({ mode: "demo", tasks: [], approvals: [], viewVersion: "new-version" }) })
    });
    await new Promise(resolve => setImmediate(resolve));
    expect(reloads).toBe(kind === "clean" ? 1 : 0);
    if (kind !== "clean") {
      state.dirtyInputs.clear(); selection.checked = false; save.textContent = "Saved"; focused = false;
      poll(); await new Promise(resolve => setImmediate(resolve)); expect(reloads).toBe(1);
    }
  }
});

test.each(["demo", "codex"] as const)("%s submission navigates only after its whole saved batch completes and edits are safe", async mode => {
  let poll!: () => void;
  const redirects: string[] = [], storage = new Map([[`applications:pending-submission:${mode}`, "this-batch"]]);
  const elements = new Map<string, any>();
  const element = (id: string): any => {
    if (id === "run-selected") return null;
    if (!elements.has(id)) elements.set(id, { disabled: false, textContent: "", addEventListener() {} });
    return elements.get(id);
  };
  const state = { dirtyInputs: new Set<string>() };
  const complete = mode === "demo" ? "demo_complete" : "completed";
  const tasks = [
    { requestId: "this-batch", action: "submit", mode, state: "running" },
    { requestId: "this-batch", action: "submit", mode, state: complete },
    { requestId: "unrelated", action: "submit", mode, state: "blocked" }
  ];
  const html = withWorkflowControls('<html><head></head><body><header class="review-top"></header><main></main></body></html>', mode);
  runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)![1]!, {
    crypto: webcrypto, desiredStates: new Map([["other-application", state]]),
    sessionStorage: { getItem: (key: string) => storage.get(key), removeItem: (key: string) => storage.delete(key) },
    location: { assign: (url: string) => redirects.push(url) },
    setInterval(fn: () => void) { poll = fn; },
    document: { hidden: false, getElementById: element, querySelector: element, querySelectorAll: () => [] },
    fetch: async () => ({ ok: true, json: async () => ({ mode, tasks, approvals: [] }) })
  });
  await new Promise(resolve => setImmediate(resolve));
  expect(redirects).toEqual([]);
  tasks[0]!.state = complete; state.dirtyInputs.add("answer");
  poll(); await new Promise(resolve => setImmediate(resolve));
  expect(redirects).toEqual([]);
  state.dirtyInputs.clear(); poll(); await new Promise(resolve => setImmediate(resolve));
  expect(redirects).toEqual(["/status/us?stage=submitted"]);
  expect(storage.size).toBe(0);
  poll(); await new Promise(resolve => setImmediate(resolve));
  expect(redirects).toHaveLength(1);
});

test.each(["blocked", "interrupted"])("a %s submission stays in Review instead of redirecting to success", async state => {
  let cleared = false;
  const redirects: string[] = [];
  const element = (id: string) => id === "run-selected" ? null : { textContent: "", addEventListener() {} };
  const html = withWorkflowControls('<html><head></head><body><header class="review-top"></header><main></main></body></html>', "demo");
  runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)![1]!, {
    crypto: webcrypto, setInterval() {},
    sessionStorage: { getItem: () => "batch", removeItem: () => { cleared = true; } },
    location: { assign: (url: string) => redirects.push(url) },
    document: { getElementById: element, querySelector: element, querySelectorAll: () => [] },
    fetch: async () => ({ ok: true, json: async () => ({ mode: "demo", approvals: [], tasks: [
      { requestId: "batch", action: "submit", mode: "demo", state: "demo_complete" },
      { requestId: "batch", action: "submit", mode: "demo", state }
    ] }) })
  });
  await new Promise(resolve => setImmediate(resolve));
  expect(redirects).toEqual([]); expect(cleared).toBe(true);
});


test("integrated navigation preserves the separate Apply and Submit controls", () => {
  const review = withWorkflowControls(renderReviewPage({ schemaVersion: 1, batchId: "navigation-test", createdAt: "2026-10-30T12:00:00Z", applications: [] }), "demo");
  const status = withWorkflowControls(renderUsStatusPage([]), "demo");
  for (const html of [review, status]) {
    for (const path of ["/profile", "/status"]) expect(html).toContain(`href="${path}"`);
  }
  expect(review).toContain('id="submit-applications"');
  expect(review).not.toContain('id="run-selected"');
  expect(status).toContain('id="run-selected"');
  expect(status).not.toContain('id="submit-applications"');
});

test("live website preparation uses per-job Matching results without a batch resume picker", () => {
  const html = withWorkflowControls('<html><head></head><body><header></header><main></main></body></html>', "codex", "", ["pm_general", '<script>bad</script>']);
  expect(html).not.toContain('id="application-resume"');
  expect(html).not.toContain('<script>bad</script>');
  expect(html).not.toContain('resumeCategory:resumePicker.value');
  expect(html).toContain("resumeReady==='false'");
});
