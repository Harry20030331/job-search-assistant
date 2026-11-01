/** Website actions use stable IDs; model output is never inserted as HTML. */
export function withWorkflowControls(html: string, mode?: "demo" | "codex", viewVersion = "", resumeCategories?: string[]): string {
  const review = html.includes('class="review-top"');
  const banner = mode ? "" : "Agent offline";
  const resumePicker = !review && mode === "codex" && resumeCategories !== undefined ? `<label class="resume-picker">Resume profile <select id="application-resume"><option value="">Choose an approved resume</option>${resumeCategories.map(key => `<option value="${key.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;")}">${key.replaceAll("&", "&amp;").replaceAll("<", "&lt;")}</option>`).join("")}</select></label>` : "";
  const bar = `<section class="workflow" aria-label="Application actions"><div class="workflow-actions">${banner ? `<span class="workspace-mode">${banner}</span>` : ""}<div class="workflow-buttons">${resumePicker}${review ? '<button class="workflow-primary" id="submit-applications" disabled>Submit applications <span id="submission-count">(0)</span></button>' : '<button class="workflow-primary" id="run-selected" disabled>Apply <span id="selection-count">(0)</span></button>'}</div></div><p id="workflow-message" role="status" aria-live="polite"></p></section>`;
  const styles = `<style>html{scroll-padding-bottom:calc(var(--application-actions-height,96px) + 16px)}body{padding-bottom:var(--application-actions-height,96px)}.review-layout,.review-empty-layout{min-height:calc(100dvh - var(--review-header-height,48px) - var(--application-actions-height,96px))}.detail-wrap{padding-bottom:24px}.workflow{padding:0;background:transparent;border:0;max-width:1180px;margin:0 auto}.workspace-mode{font-size:12px;color:var(--muted);margin:0 auto 0 0}.workflow-actions{position:fixed;z-index:20;left:0;right:0;bottom:0;padding:12px clamp(20px,4vw,52px);padding-bottom:calc(12px + env(safe-area-inset-bottom));background:var(--panel);border-top:1px solid var(--line);display:flex;align-items:center;justify-content:flex-end;gap:20px}.workflow-actions[hidden]{display:none}.resume-picker{font-size:12px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}.resume-picker select{min-height:44px;max-width:100%;border:1px solid var(--line);border-radius:8px;background:var(--panel);padding:8px}.workflow-buttons{display:flex;gap:12px;flex-wrap:wrap}.workflow-primary{background:var(--ink);color:var(--panel);border:1px solid var(--ink);padding:12px 18px;white-space:nowrap}.workflow-primary:disabled{opacity:.45}.row-selection{display:flex;gap:10px;align-items:center}.job-select{accent-color:var(--ink);width:16px;height:16px}.reopen-content{border:1px solid var(--line);background:var(--panel);padding:8px 12px}.decision-dock label{font-size:12px;display:flex;align-items:center;gap:6px}#workflow-message{font-size:13px;color:var(--warn);margin:8px clamp(20px,4vw,52px)}#selection-summary{margin-top:8px}#selection-summary:empty,#workflow-message:empty{display:none}@media(max-width:700px){.workflow-actions{align-items:stretch;flex-direction:column}.workflow-primary{width:100%}.decision-dock{flex-wrap:wrap}}.workflow-actions{padding:12px clamp(16px,3vw,48px);padding-bottom:calc(12px + env(safe-area-inset-bottom));box-shadow:0 -4px 16px #25201505}.workflow-primary{min-height:44px;border-radius:8px;font-size:14px;font-weight:600;padding:12px 20px}.reopen-content{border-radius:8px;min-height:44px;font-size:13px}.workflow-buttons{max-width:100%;width:auto}@media(max-width:700px){.workflow-buttons{width:100%}.workflow-actions{gap:8px;padding:10px 16px;padding-bottom:calc(10px + env(safe-area-inset-bottom))}}</style>`;
  const script = `<script>(()=>{
const viewVersion=${JSON.stringify(viewVersion)},mode=${JSON.stringify(mode ?? "unavailable")},button=document.getElementById('run-selected'),submitButton=document.getElementById('submit-applications'),message=document.getElementById('workflow-message');
const resumePicker=${Boolean(resumePicker)}?document.getElementById('application-resume'):null;
const controls=[...document.querySelectorAll('.job-select')];
if(typeof ResizeObserver!=='undefined'){const bar=document.querySelector('.workflow-actions');const reserveSpace=()=>document.documentElement.style.setProperty('--application-actions-height',bar.getBoundingClientRect().height+'px');new ResizeObserver(reserveSpace).observe(bar);reserveSpace()}
let busy=false,lastPayload='',requestId='',approvals=[],connected=true,modeChanged=false;
const submissionKey='applications:pending-submission:'+mode;
let submissionRequest='';
try{if(submitButton&&typeof sessionStorage!=='undefined')submissionRequest=sessionStorage.getItem(submissionKey)||''}catch{}
function rememberSubmission(id){submissionRequest=id;try{if(typeof sessionStorage!=='undefined'){if(id)sessionStorage.setItem(submissionKey,id);else sessionStorage.removeItem(submissionKey)}}catch{}}
const preparationKey='applications:pending-preparation:'+mode;
let preparationRequest='';
try{if(typeof sessionStorage!=='undefined'){if(button)preparationRequest=sessionStorage.getItem(preparationKey)||'';else sessionStorage.removeItem(preparationKey)}}catch{}
function rememberPreparation(id){preparationRequest=id;try{if(typeof sessionStorage!=='undefined'){if(id)sessionStorage.setItem(preparationKey,id);else sessionStorage.removeItem(preparationKey)}}catch{}}
const uuid=()=>{const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;const h=[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20)};
const selected=()=>controls.filter(c=>c.checked);
function refreshView(version){
 if(!viewVersion||!version||version===viewVersion)return;
 const dirty=typeof desiredStates!=='undefined'&&[...desiredStates.values()].some(state=>state.dirtyInputs?.size||state.saveErrors?.size);
 const focused=document.activeElement?.matches?.('input:not([type=checkbox]):not([type=radio]),textarea,select');
 const saving=[...document.querySelectorAll('.save-status')].some(status=>status.textContent==='Saving…');
 if(busy||dirty||focused||saving||selected().length)return;
 const filter=document.querySelector('[data-status-filter][aria-pressed="true"]');
 if(button&&filter){const target=new URL(location.href);target.searchParams.set('stage',filter.dataset.statusFilter);location.replace(target.href)}else location.reload();
}
function update(){const unavailable=busy||mode==='unavailable'||!connected||modeChanged;if(button){button.disabled=unavailable||selected().length===0||Boolean(resumePicker&&!resumePicker.value);document.getElementById('selection-count').textContent='('+selected().length+')'}if(submitButton){submitButton.disabled=unavailable||approvals.length===0;document.getElementById('submission-count').textContent='('+approvals.length+')'}if(button){const filter=document.querySelector('[data-status-filter][aria-pressed="true"]');button.hidden=controls.length===0||Boolean(filter?.dataset?.statusFilter&&filter.dataset.statusFilter!=='shortlisted');document.querySelector('.workflow-actions').hidden=button.hidden}}
resumePicker?.addEventListener('change',update);controls.forEach(c=>c.addEventListener('change',update));document.querySelectorAll('[data-status-filter]').forEach(c=>c.addEventListener('click',update));update();
const errors={task_target_unavailable:'The selection changed. Reload the page and review the current content.',task_already_active:'This application is already being processed.',submission_outcome_unresolved:'A previous submission has an unresolved outcome. Check the employer before starting another attempt.',runner_unavailable:'The runner is disconnected. Your answers are saved.'};
async function start(action){
 if((action==='prepare'?button:submitButton)?.disabled)return;
 const chosen=selected(),payload=action==='submit'?{action,selections:approvals.map(item=>({...item}))}:{action,jobIds:chosen.map(c=>c.value),...(resumePicker?{resumeCategory:resumePicker.value}:{})};
 const encoded=JSON.stringify(payload);if(encoded!==lastPayload||!requestId){lastPayload=encoded;requestId=uuid()}
 busy=true;controls.forEach(c=>c.disabled=true);update();message.textContent='Starting…';
 try{const response=await fetch('/api/tasks',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...payload,mode,requestId})});const data=await response.json();if(!response.ok)throw Error(errors[data.error]||'Could not start this request. Try again.');message.textContent='';if(action==='prepare'){chosen.forEach(c=>c.checked=false);rememberPreparation(requestId)}else{approvals=[];rememberSubmission(requestId)}requestId='';await refresh()}
 catch(error){message.textContent=error.message||'Connection lost. Retry to check the same request.'}
 finally{busy=false;controls.forEach(c=>c.disabled=false);update()}
}
button?.addEventListener('click',()=>start('prepare'));
submitButton?.addEventListener('click',()=>start('submit'));
document.querySelectorAll('.reopen-content').forEach(control=>control.addEventListener('click',async()=>{
 control.disabled=true;
 try{const response=await fetch('/api/review/reopen',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({applicationId:control.dataset.id,snapshotId:control.dataset.snapshot})});const data=await response.json();if(!response.ok)throw Error(errors[data.error]||'Could not reopen this application. Reload to check its state.');location.reload()}
 catch(error){message.textContent=error.message;control.disabled=false}
}));
function syncSubmissionState(tasks){
 for(const detail of document.querySelectorAll('[data-detail]')){
  const edit=detail.querySelector('.reopen-content');if(!edit)continue;
  const latest=tasks.filter(task=>task.action==='submit'&&task.target.applicationId===detail.dataset.detail&&task.target.snapshotId===edit.dataset.snapshot).at(-1);
  const active=latest&&['queued','running'].includes(latest.state),failed=latest&&['blocked','interrupted'].includes(latest.state);
  edit.disabled=Boolean(active);const label=detail.querySelector('.approved-status');if(label)label.textContent=active?'Submitting…':failed?'Submission failed':'Reviewed';
 }
}
function showSubmissionResult(tasks){
 if(!submitButton||!submissionRequest)return false;
 const batch=tasks.filter(task=>task.requestId===submissionRequest&&task.action==='submit'&&task.mode===mode);
 if(!batch.length){rememberSubmission('');return false}
 if(batch.some(task=>['queued','running'].includes(task.state)))return false;
 if(batch.some(task=>!['completed','demo_complete'].includes(task.state))){rememberSubmission('');return false}
 const dirty=typeof desiredStates!=='undefined'&&[...desiredStates.values()].some(state=>state.dirtyInputs?.size||state.saveErrors?.size);
 const focused=document.activeElement?.matches?.('input:not([type=checkbox]):not([type=radio]),textarea,select');
 const saving=[...document.querySelectorAll('.save-status')].some(status=>status.textContent==='Saving…');
 if(busy||dirty||focused||saving)return false;
 rememberSubmission('');location.assign('/status/us?stage=submitted');return true;
}
function showPreparedReview(tasks){
 if(!button||!preparationRequest)return false;
 const batch=tasks.filter(task=>task.requestId===preparationRequest&&task.action==='prepare'&&task.mode===mode);
 if(!batch.length){rememberPreparation('');return false}
 if(!batch.some(task=>task.state==='needs_review')){
  if(!batch.some(task=>['queued','running'].includes(task.state)))rememberPreparation('');
  return false;
 }
 if(busy||selected().length)return false;
 rememberPreparation('');location.assign('/review');return true;
}
async function refresh(){
 try{const response=await fetch('/api/tasks');if(!response.ok)throw Error();const data=await response.json();if(data.mode!==mode){modeChanged=true;update();message.textContent='The workspace mode changed. Reload before starting work.';return}connected=true;approvals=data.approvals??[];syncSubmissionState(data.tasks);const count=document.getElementById('review-count');if(count)count.textContent='('+ (data.reviewCount??0) +')';update();
 if(message.textContent==='Connection lost. Reconnecting…')message.textContent='';
 if(!showPreparedReview(data.tasks)&&!showSubmissionResult(data.tasks))refreshView(data.viewVersion);
 }catch{connected=false;update();message.textContent='Connection lost. Reconnecting…'}
}
void refresh();setInterval(()=>{if(!document.hidden)void refresh()},2500);
})();</script>`;
  if (!review) html = html.replace('>Review</a>', '>Review <span id="review-count" aria-live="polite"></span></a>');
  return html.replace("</head>", `${styles}</head>`).replace("</main>", `</main>${bar}`).replace("</body>", `${script}</body>`);
}
