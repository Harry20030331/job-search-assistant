import { serveWorkspaceFont } from "./assets.js";
import { renderNewCandidate } from "./intakeView.js";
import { beginIntakeRequest, readIntakeRequest, reviseIntakeRequest, confirmIntakeRequest } from "./intakeRequests.js";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { randomUUID } from "node:crypto";
import { mkdir, realpath, readFile, rename } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { listMatchingWorkspaces } from "../matching/workspaces.js";
import { workspaceMatchingPaths, createMatchingWorkspace, createExampleSearchWorkspace } from "../matching/intake.js";
import { resolveRecoveryInputs } from "../review/reviewRecovery.js";
import { startReviewServer, type RunningReviewServer } from "../review/reviewServer.js";
import { ApplicationTaskService, demoTaskExecutor } from "../review/applicationTasks.js";
import { createChatTaskDispatcher, type ChatTaskConfig } from "../review/chatTaskBridge.js";
import { loadCandidateProfile } from "../profile.js";
import { writePrivateFile } from "../storage/privateFiles.js";
import { page as workspacePage, escapeText, setupHeader } from "./views.js";

function page(...args: Parameters<typeof workspacePage>) {
  return workspacePage(...args).replace("<body>", '<body class="welcome-shell">').replace(/<header[\s\S]*?<\/header>/, setupHeader())
    .replace('</body>', `<script>for(const form of document.querySelectorAll('form[method="post"]'))form.addEventListener('submit',async e=>{e.preventDefault();const button=form.querySelector('button');button.disabled=true;let message=form.querySelector('[role=status]');if(!message){message=document.createElement('p');message.setAttribute('role','status');form.append(message)}message.textContent='Opening your workspace…';try{const r=await fetch(form.action,{method:'POST',body:new URLSearchParams(new FormData(form))});const d=await r.json();if(!r.ok)throw Error(d.message||'Could not open this workspace.');location.assign(d.url)}catch(e){message.textContent=e.message;button.disabled=false}});</script></body>`);
}

/** A candidate-free launch page. Explicit selection alone opens a candidate service. */
export async function startWorkbench(repository: string, options: { port?: number; chat?: ChatTaskConfig; temporaryRoots?: string[] } = {}) {
  const registry = join(repository, "local/search-workspaces.json");
  const activePath = join(repository, "local/active-workspace.json");
  const running = new Map<string, { server: RunningReviewServer; tasks?: ApplicationTaskService; real: boolean }>();
  const opening = new Map<string, Promise<string>>();
  const creations = new Map<string, Promise<string>>();
  const choices = new Map<string, string>();
  async function rememberActive(root: string) {
    await mkdir(join(repository, "local"), { recursive: true, mode: 0o700 });
    const temporary = join(repository, "local", `.${randomUUID()}.tmp`);
    await writePrivateFile(temporary, JSON.stringify({ version: 1, workspace: root, selectedAt: new Date().toISOString() }));
    await rename(temporary, activePath);
  }
  async function open(workspace: string) {
    const root = await realpath(workspace);
    if (running.has(root)) { if (running.get(root)!.real) await rememberActive(root); return running.get(root)!.server.address + "/profile"; }
    if (opening.has(root)) return opening.get(root)!;
    const promise = (async () => {
      const inputs = await resolveRecoveryInputs(root);
      const candidate = await loadCandidateProfile(join(root, "data/candidate.json"));
      const email = String((candidate.contact as { email?: string })?.email ?? "");
      const mode = candidate.fictional === true || /@(?:.*\.)?example\.(com|org|net)$/i.test(email) ? "demo" : "codex";
      const tasks = options.chat || mode === "demo" ? new ApplicationTaskService({ ...inputs, taskPath: join(root,"data/application-tasks.json"), matchingPaths: workspaceMatchingPaths(root) }, mode,
        mode === "demo" ? demoTaskExecutor : async () => { throw new Error("runner_unavailable"); }, mode === "codex" && options.chat ? createChatTaskDispatcher(root, options.chat) : undefined) : undefined;
      await tasks?.start();
      try {
        if (options.chat) await writePrivateFile(join(root,"data/chat-runner.json"),JSON.stringify(options.chat));
        const selectedServer = await startReviewServer({ ...inputs, port: 0, profilePath: join(root,"data/candidate.json"), workspaceRoot: root, repositoryRoot: repository, welcomeUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}/`, searchRefresh: { automatic: mode === "codex", ...(mode === "demo" ? { pausedReason: "Demo · automatic updates paused." } : {}) }, tasks });
        try { if (mode === "codex") await rememberActive(root); }
        catch (error) { await selectedServer.close(); throw error; }
        running.set(root, { server: selectedServer, tasks, real: mode === "codex" });
        return selectedServer.address + "/profile";
      } catch(error) { await tasks?.close(); throw error; }
    })();
    opening.set(root,promise);
    try { return await promise; } finally { opening.delete(root); }
  }
  const server = createServer(async (request,response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const send = (status: number, body: string, type="text/html; charset=utf-8") => {
      response.writeHead(status,{"content-type":type,"cache-control":"no-store","x-content-type-options":"nosniff","content-security-policy":"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"});response.end(body);
    };
    try {
      // Reject DNS rebinding and foreign-origin writes before any parsing or workspace mutation.
      const address=server.address() as AddressInfo;
      if (![ `127.0.0.1:${address.port}`, `localhost:${address.port}` ].includes(request.headers.host ?? "")) {send(403,"Invalid host");return;}
      if(request.method==="POST" && (request.headers["sec-fetch-site"] === "cross-site" || request.headers.origin !== `http://${request.headers.host}`)){send(403,"Invalid origin");return;}
      if (request.method === "GET" && url.pathname === "/assets/InterVariable.woff2") { await serveWorkspaceFont(response); return; }
      if (request.method === "GET" && url.pathname === "/") {
        let active: { version: 1; workspace: string } | undefined;
        try { active = z.object({ version: z.literal(1), workspace: z.string().min(1), selectedAt: z.string().datetime() }).strict().parse(JSON.parse(await readFile(activePath, "utf8"))); }
        catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") { send(200, page("Restore workspace", "home", '<h1>Restore your workspace</h1><p class="intro">Your saved workspace could not be read. Choose your existing search to reconnect it.</p><a class="primary" href="/existing">Restore saved search</a>')); return; }
        }
        if (active) {
          try { const target = (await open(active.workspace)).replace(/\/profile$/, "/status"); response.writeHead(302, { location: target, "cache-control": "no-store" }); response.end(); }
          catch { send(200, page("Restore workspace", "home", '<h1>Restore your workspace</h1><p class="intro">Your saved workspace is unavailable. Reconnect your existing search to continue.</p><a class="primary" href="/existing">Restore saved search</a>')); }
        } else send(200, renderNewCandidate());
        return;
      }
      if(request.method==="GET" && url.pathname==="/welcome"){response.writeHead(302,{location:"/","cache-control":"no-store"});response.end();return;}
      if(request.method==="GET" && url.pathname==="/new"){send(200,renderNewCandidate());return;}
      const intakeMatch = /^\/api\/intake\/([0-9a-f-]{36})(?:\/(revise|confirm))?$/.exec(url.pathname);
      if (request.method === "GET" && intakeMatch && !intakeMatch[2]) {
        send(200, JSON.stringify(await readIntakeRequest(repository, intakeMatch[1]!)), "application/json; charset=utf-8"); return;
      }
      if (request.method === "POST" && (url.pathname === "/api/intake" || intakeMatch)) {
        if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers["content-type"] ?? "")) { request.resume(); send(415, JSON.stringify({ message: "Please send the source using this page." }), "application/json; charset=utf-8"); return; }
        const maximum = url.pathname === "/api/intake" ? 14100000 : 20000;
        if (Number(request.headers["content-length"]) > maximum) { request.resume(); send(413, JSON.stringify({ message: "Choose a PDF up to 10 MB, or a shorter text passage." }), "application/json; charset=utf-8"); return; }
        const chunks: Buffer[] = []; let size = 0;
        for await (const chunk of request) { const bytes = Buffer.from(chunk); size += bytes.length; if (size > maximum) { send(413, JSON.stringify({ message: "This source is too large." }), "application/json; charset=utf-8"); return; } chunks.push(bytes); }
        const input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        if (url.pathname === "/api/intake") { send(202, JSON.stringify(await beginIntakeRequest(repository, options.chat, input)), "application/json; charset=utf-8"); return; }
        if (intakeMatch![2] === "revise") { send(202, JSON.stringify(await reviseIntakeRequest(repository, options.chat, intakeMatch![1]!, input)), "application/json; charset=utf-8"); return; }
        if (intakeMatch![2] === "confirm") { const root = await confirmIntakeRequest(repository, intakeMatch![1]!, input); send(200, JSON.stringify({ url: await open(root) }), "application/json; charset=utf-8"); return; }
        send(404, "Not found"); return;
      }
      if(request.method==="GET" && url.pathname==="/example"){send(200,page("Fictional example","home",`<section class="entry-shell"><h1>Fictional example</h1><div class="entry-card"><h2>Meet Alex Liu</h2><p>Explore matching, application review and interview preparation with a fictional profile.</p><p class="entry-note">Local demo · No employer submissions</p><form method="post" action="/api/start/example"><button class="primary">Open example <span aria-hidden="true">↗</span></button></form></div></section>`));return;}
      if(request.method==="GET" && url.pathname==="/existing"){
        const list=await listMatchingWorkspaces({project:repository,registry,temporaryRoots:options.temporaryRoots});
        const entries=[...list.searches,...list.emptyWorkspaces];
        send(200,page("Saved searches","home",`<h1>Saved searches</h1>${entries.length ? "" : `<p>${escapeText(list.message)}</p>`}<div class="tiles saved-searches">${entries.map(w=>{let id=[...choices].find(([,p])=>p===w.path)?.[0];if(!id){id=randomUUID();choices.set(id,w.path)}return `<form class="tile" method="post" action="/api/start/existing"><h2>${escapeText(w.candidate??"Unnamed candidate")}</h2><p>${w.activeJobs} active · ${w.totalJobs} total jobs${!w.hasResults?' · No search results yet':''}</p><p>Updated ${escapeText(w.lastActivity?.slice(0,10)??"—")}</p><details><summary>Location</summary><p class="workspace-location">${escapeText(w.path)}</p></details><input type="hidden" name="selection" value="${id}"><button class="primary">Continue →</button></form>`}).join("")}</div>${list.diagnostics.map(d=>`<p role="status">Could not check ${escapeText(d.path)} (${escapeText(d.error)})</p>`).join("")}<a class="primary" href="/new">Set up a new candidate</a>`));return;
      }
      if(request.method==="POST" && ["/api/start/new","/api/start/existing","/api/start/example"].includes(url.pathname)){
        let payload="";for await(const chunk of request){payload+=chunk.toString();if(Buffer.byteLength(payload)>65536){send(413,"Request too large");return;}}
        let location:string;
        if(url.pathname==="/api/start/existing"){
          const id=new URLSearchParams(payload).get("selection")??"";const selected=choices.get(id);if(!selected)throw Error("Choose an available saved search.");location=(await open(selected)).replace(/\/profile$/, "/status");
        }else{
          const base=join(repository,"local/workspaces");await mkdir(base,{recursive:true,mode:0o700});
          if(url.pathname==="/api/start/example"){
            const root=join(base,`example-${randomUUID()}`);await createExampleSearchWorkspace(root,registry);location=await open(root);
          }else{
            const f=z.object({requestId:z.string().uuid(),fullName:z.string().trim().min(1),email:z.union([z.literal(""),z.string().email()]),summary:z.string().trim().min(1),skills:z.string().trim().min(1),institution:z.string(),degree:z.string(),company:z.string(),title:z.string(),directions:z.string().trim().min(1),locations:z.string(),preferences:z.string().trim().min(1),confirmed:z.literal(true)}).strict().parse(JSON.parse(payload));
            if(!creations.has(f.requestId)){
              const work=(async()=>{const root=join(base,`candidate-${f.requestId}`);const lines=(s:string)=>s.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
                await createMatchingWorkspace(root,{confirmed:true,reference:"Candidate confirmed on Welcome webpage",candidate:{schemaVersion:2,identity:{fullName:f.fullName},contact:{email:f.email},summary:f.summary,skills:lines(f.skills),education:f.institution||f.degree?[{institution:f.institution,degree:f.degree}]:[],experiences:f.company||f.title?[{employer:f.company,title:f.title}]:[]},preferences:f.preferences,rules:{categories:lines(f.directions),locations:lines(f.locations),workModes:["remote","hybrid","onsite"],excludedCompanies:[],excludedJobIds:[],limit:10,perCompany:2}},registry);return root;})();
              creations.set(f.requestId,work);work.catch(()=>creations.delete(f.requestId));
            }
            location=await open(await creations.get(f.requestId)!);
            send(200,JSON.stringify({url:location}),"application/json; charset=utf-8");return;
          }
        }
        send(200,JSON.stringify({url:location}),"application/json; charset=utf-8");return;
      }
      send(404,"Not found");
    } catch(error) {
      const code = error instanceof Error ? error.message : "request_failed";
      const publicCodes = new Set(["runner_unavailable", "invalid_pdf", "linkedin_profile_url_required", "intake_request_changed", "intake_preview_required", "intake_location_required", "intake_direction_required"]);
      if (publicCodes.has(code)) { send(code === "runner_unavailable" ? 503 : code === "intake_request_changed" ? 409 : 422, JSON.stringify({ error: code }), "application/json; charset=utf-8"); return; }
      send((error as NodeJS.ErrnoException).code === "ENOENT" ? 404 : 400, JSON.stringify({ message: code === "matching_background_required" ? "Add an education or experience entry to continue." : "Could not open this request. Check your input or choose another background source." }), "application/json; charset=utf-8");
    }
  });
  await new Promise<void>((resolve,reject)=>{server.once("error",reject);server.listen(options.port??0,"127.0.0.1",resolve)});
  return { address:`http://127.0.0.1:${(server.address() as AddressInfo).port}/`, async close(){await Promise.all([...running.values()].map(async r=>{await r.tasks?.close();await r.server.close()}));await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()))} };
}
