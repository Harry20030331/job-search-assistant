import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { randomUUID } from "node:crypto";
import { mkdir, realpath } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { listMatchingWorkspaces } from "../matching/workspaces.js";
import { createMatchingWorkspace, createExampleSearchWorkspace } from "../matching/intake.js";
import { resolveRecoveryInputs } from "../review/reviewRecovery.js";
import { startReviewServer, type RunningReviewServer } from "../review/reviewServer.js";
import { ApplicationTaskService, demoTaskExecutor } from "../review/applicationTasks.js";
import { createChatTaskDispatcher, type ChatTaskConfig } from "../review/chatTaskBridge.js";
import { loadCandidateProfile } from "../profile.js";
import { writePrivateFile } from "../storage/privateFiles.js";
import { page as workspacePage, escapeText } from "./views.js";
import { editorStyles } from "./profileView.js";

function page(...args: Parameters<typeof workspacePage>) {
  return workspacePage(...args).replace(/<header[\s\S]*?<\/header>/, '<header class="workspace-top"><a class="workspace-brand" href="/">Application workspace</a></header>')
    .replace('</body>', `<script>for(const form of document.querySelectorAll('form[method="post"]'))form.addEventListener('submit',async e=>{e.preventDefault();const button=form.querySelector('button');button.disabled=true;let message=form.querySelector('[role=status]');if(!message){message=document.createElement('p');message.setAttribute('role','status');form.append(message)}message.textContent='Opening your workspace…';try{const r=await fetch(form.action,{method:'POST',body:new URLSearchParams(new FormData(form))});const d=await r.json();if(!r.ok)throw Error(d.message||'Could not open this workspace.');location.assign(d.url)}catch(e){message.textContent=e.message;button.disabled=false}});</script></body>`);
}

function welcome() {
  return page("Welcome", "home", `<div class="eyebrow">Your job search workspace</div><h1>Welcome. Let's get started.</h1><p class="intro">Set up your shared profile, match New Grad opportunities from SimplifyJobs, review applications and prepare for interviews — in one place.</p><div class="tiles"><a class="tile" href="/new"><h2>New candidate</h2><p>Confirm your background and search preferences.</p><span class="arrow">Create your profile →</span></a><a class="tile" href="/existing"><h2>Continue an existing search</h2><p>Choose saved results and pick up where you left off.</p><span class="arrow">View saved searches →</span></a><a class="tile" href="/example"><h2>Try the fictional example</h2><p>Explore Alex's isolated demo. No applications are sent to employers.</p><span class="arrow">Preview the example →</span></a></div>`)
;
}
function newCandidate() {
  return page("New candidate", "home", `<div class="eyebrow">New candidate</div><h1>Tell us about yourself.</h1><p class="intro">Start with the background you want to share. A resume is optional for searching. You can refine your profile on the next page.</p><form class="editor" id="intake"><fieldset><legend>Profile & preferences</legend>${[["fullName","Full name"],["email","Email (optional)"],["institution","School or institution"],["degree","Degree or qualification"],["company","Employer (optional)"],["title","Role (optional)"]].map(([key,label])=>`<label>${label}<input name="${key}" ${key==='fullName'?'required':''} ${key==='email'?'type="email"':''}></label>`).join("")}<label>Background summary<textarea name="summary" required></textarea></label><label>Skills (one per line)<textarea name="skills" required></textarea></label><label>Job directions (one per line)<textarea name="directions" required></textarea></label><label>Preferred locations (one per line, blank if flexible)<textarea name="locations"></textarea></label><label>Additional preferences<textarea name="preferences" required></textarea></label><label><input type="checkbox" name="confirmed" required> I confirm this information and want to save a new profile.</label><button class="primary">Save and continue</button><p class="save-message" role="status"></p></fieldset></form>`, `const form=document.getElementById('intake');const requestId=crypto.randomUUID();form.onsubmit=async e=>{e.preventDefault();const button=form.querySelector('button'),message=form.querySelector('[role=status]');button.disabled=true;message.textContent='Creating your workspace…';const f=new FormData(form);try{const r=await fetch('/api/start/new',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...Object.fromEntries(f),confirmed:f.has('confirmed'),requestId})});const d=await r.json();if(!r.ok)throw Error(d.message||'Check your information and try again.');location.assign(d.url)}catch(e){message.textContent=e.message;button.disabled=false}};`)
    .replace("</head>",editorStyles+"</head>");
}
/** A candidate-free launch page. Explicit selection alone opens a candidate service. */
export async function startWorkbench(repository: string, options: { port?: number; chat?: ChatTaskConfig; temporaryRoots?: string[] } = {}) {
  const registry = join(repository, "local/search-workspaces.json");
  const running = new Map<string, { server: RunningReviewServer; tasks?: ApplicationTaskService }>();
  const opening = new Map<string, Promise<string>>();
  const creations = new Map<string, Promise<string>>();
  const choices = new Map<string, string>();
  async function open(workspace: string) {
    const root = await realpath(workspace);
    if (running.has(root)) return running.get(root)!.server.address + "/profile";
    if (opening.has(root)) return opening.get(root)!;
    const promise = (async () => {
      const inputs = await resolveRecoveryInputs(root);
      const candidate = await loadCandidateProfile(join(root, "data/candidate.json"));
      const email = String((candidate.contact as { email?: string })?.email ?? "");
      const mode = candidate.fictional === true || /@(?:.*\.)?example\.(com|org|net)$/i.test(email) ? "demo" : "codex";
      const tasks = options.chat || mode === "demo" ? new ApplicationTaskService({ ...inputs, taskPath: join(root,"data/application-tasks.json") }, mode,
        mode === "demo" ? demoTaskExecutor : async () => { throw new Error("runner_unavailable"); }, options.chat ? createChatTaskDispatcher(root, options.chat) : undefined) : undefined;
      await tasks?.start();
      try {
        if (options.chat) await writePrivateFile(join(root,"data/chat-runner.json"),JSON.stringify(options.chat));
        const selectedServer = await startReviewServer({ ...inputs, port: 0, profilePath: join(root,"data/candidate.json"), workspaceRoot: root, repositoryRoot: repository, welcomeUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}/welcome`, tasks });
        running.set(root, { server: selectedServer, tasks }); return selectedServer.address + "/profile";
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
      if(request.method==="GET" && ["/","/welcome"].includes(url.pathname)){send(200,welcome());return;}
      if(request.method==="GET" && url.pathname==="/new"){send(200,newCandidate());return;}
      if(request.method==="GET" && url.pathname==="/example"){send(200,page("Fictional example","home",`<h1>Meet Alex, a fictional candidate.</h1><p>This creates an isolated copy for local rehearsal. No employer submission is allowed.</p><form method="post" action="/api/start/example"><button class="primary">Open fictional example</button></form>`));return;}
      if(request.method==="GET" && url.pathname==="/existing"){
        const list=await listMatchingWorkspaces({project:repository,registry,temporaryRoots:options.temporaryRoots});
        const entries=[...list.searches,...list.emptyWorkspaces];
        send(200,page("Saved searches","home",`<h1>Continue your search.</h1><p>${escapeText(list.message)}</p><div class="tiles">${entries.map(w=>{let id=[...choices].find(([,p])=>p===w.path)?.[0];if(!id){id=randomUUID();choices.set(id,w.path)}return `<form class="tile" method="post" action="/api/start/existing"><h2>${escapeText(w.candidate??"Unnamed candidate")}</h2><p>${w.activeJobs} active · ${w.totalJobs} total jobs${!w.hasResults?' · No search results yet':''}</p><p>Last activity: ${escapeText(w.lastActivity??"None recorded")}</p><p>${escapeText(w.path)}</p><input type="hidden" name="selection" value="${id}"><button class="primary">Continue this search</button></form>`}).join("")}</div>${list.diagnostics.map(d=>`<p role="status">Could not check ${escapeText(d.path)} (${escapeText(d.error)})</p>`).join("")}<a class="primary" href="/new">Set up a new candidate</a>`));return;
      }
      if(request.method==="POST" && ["/api/start/new","/api/start/existing","/api/start/example"].includes(url.pathname)){
        let payload="";for await(const chunk of request){payload+=chunk.toString();if(Buffer.byteLength(payload)>65536){send(413,"Request too large");return;}}
        let location:string;
        if(url.pathname==="/api/start/existing"){
          const id=new URLSearchParams(payload).get("selection")??"";const selected=choices.get(id);if(!selected)throw Error("Choose an available saved search.");location=await open(selected);
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
    }catch(error){send(400,JSON.stringify({message:error instanceof Error && error.message==="matching_background_required"?"Add an education or experience entry to continue.":"Could not open this workspace. Check your inputs or choose another saved search."}),"application/json; charset=utf-8");}
  });
  await new Promise<void>((resolve,reject)=>{server.once("error",reject);server.listen(options.port??0,"127.0.0.1",resolve)});
  return { address:`http://127.0.0.1:${(server.address() as AddressInfo).port}/welcome`, async close(){await Promise.all([...running.values()].map(async r=>{await r.tasks?.close();await r.server.close()}));await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()))} };
}
