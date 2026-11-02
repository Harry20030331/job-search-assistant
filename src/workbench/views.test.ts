import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { renderHomePage, renderAccountPage, workspaceHeader } from "./views.js";
import { startReviewServer, type RunningReviewServer } from "../review/reviewServer.js";
import { parseReviewServerArgs } from "../cli/reviewServerCli.js";

const roots: string[] = [], servers: RunningReviewServer[] = [];
afterEach(async () => { await Promise.all(servers.splice(0).map(server => server.close())); await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });

test("all workspace pages have direct Status, Interview and Google connection navigation", () => {
  for (const page of ["profile", "status", "review", "interviews", "account"] as const) {
    const header = workspaceHeader(page);
    expect(header).toContain('href="/status"'); expect(header).toContain('href="/interviews"'); expect(header).toContain('href="/settings/accounts"');
    expect(header.match(/aria-current="page"/g)).toHaveLength(1);
  }
  const home = renderHomePage({ applications: 3, interviews: 2, pendingPlans: 1, practiceReady: 2 });
  expect(home).toContain('href="/interviews?filter=upcoming"'); expect(home).toContain("2 practice pack(s) ready");
});
test("account setup uses Google authorization and session-CSRF signout rather than a password form", () => {
  const page = renderAccountPage();
  expect(page).toContain('href="/google/connect"'); expect(page).toContain('action="/google/sign-out"');
  expect(page).toContain('name="csrf"'); expect(page).not.toContain('type="password"');
  expect(page).toContain("does not import your inbox automatically"); expect(page).toContain("does not revoke Google's saved grant");
});
test("server opens Status by default and exposes account settings and fails safely without configured Google credentials", async () => {
  const root = await mkdtemp(join(tmpdir(), "workspace-home-")); roots.push(root);
  await mkdir(join(root, "drafts"));
  const tracker = join(root, "opportunities.json");
  await writeFile(tracker, JSON.stringify({ schemaVersion: 1, opportunities: [] }));
  await writeFile(join(root, "candidate.json"), JSON.stringify({ schemaVersion: 2, identity: { fullName: "Fictional Candidate" } }));
  const server = await startReviewServer({ trackerPath: tracker, jobsPath: tracker, reviewPath: join(root, "drafts"), port: 0 }); servers.push(server);
  expect(await (await fetch(server.address + "/")).text()).toContain("<h1>Applications</h1>");
  expect(await (await fetch(server.address + "/settings/accounts")).text()).toContain("Connect Google");
  const status = await (await fetch(server.address + "/google/status")).json();
  expect(status).toMatchObject({ connected: false, configured: false, account: null });
  expect(JSON.stringify(status)).not.toContain(root);
  const forged = await fetch(server.address + "/google/sign-out", { method: "POST", headers: { origin: "https://attacker.invalid" }, body: "csrf=x" });
  expect(forged.status).toBe(403);
  expect((await fetch(server.address + "/google/../../.google-local/token.json")).status).toBe(404);
});
test("developer Google configuration remains an explicit server option", () => {
  const parsed = parseReviewServerArgs(["--review", "fixture/drafts", "--tracker", "fixture/opportunities.json", "--jobs", "fixture/opportunities.json", "--port", "8767", "--google-root", "private-google-root"]);
  expect(parsed.googleRoot).toBe("private-google-root");
});

test("application header variants retain interview reminders without replacing their layout class", () => {
  for (const style of ["status-top", "review-top"] as const) {
    const header = workspaceHeader(style === "status-top" ? "status" : "review", style);
    expect(header).toContain(`<header class="${style}">`);
    expect(header).toContain('id="interview-notifications"');
    expect(header).toContain('src="/assets/interview-actions.js"');
    expect(header.match(/aria-current="page"/g)).toHaveLength(1);
  }
});
