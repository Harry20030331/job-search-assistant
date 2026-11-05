import { statusLayout } from "./statusLayout.js";
import { designSystem } from "../workbench/designSystem.js";
import { reviewStyles, statusStyles, workspaceStyles } from "./applicationStyles.js";
import type { ReviewBatch, ReviewItem } from "./reviewStore.js";
import { statusGroup, statusLabels, type StatusViewItem, type StatusViewStatus } from "./statusView.js";
import type { ChinaStatusViewItem, ChinaStatus } from "../china/status/chinaStatusView.js";
import { workspaceHeader, statusContext } from "../workbench/views.js";

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function categoryLabel(category: ReviewItem["category"]): string {
  const legacy: Record<string, string> = { llm: "LLM", recommendation: "REC", robotics: "LOB" };
  return Object.hasOwn(legacy, category) ? legacy[category]! : escapeHtml(category);
}

function safeHref(value: string): string {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? escapeHtml(value) : "#";
  } catch {
    return "#";
  }
}

const usRegionAbbreviations = new Set([
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
  "DC", "AS", "GU", "MP", "PR", "VI", "UM"
]);

function compactLocation(location: string): string {
  return location.split(" / ").map((segment) => {
    const match = segment.match(/^(.*), ([A-Z]{2})$/);
    return match && usRegionAbbreviations.has(match[2]!) ? match[1]! : segment;
  }).join(" / ");
}


const shellStyles = `
:root{--paper:#ffffff;--ink:#171713;--muted:#737373;--line:#d4d4d4;--safe:#404040;--warn:#737373;--signal:#a3a3a3;--panel:#ffffff;--night:#22231f}
*{box-sizing:border-box}html{background:var(--paper);color:var(--ink)}body{margin:0;font-family:Inter,Arial,sans-serif;line-height:1.45;background:var(--paper)}
a{color:inherit}.mast{min-height:120px;padding:26px clamp(24px,4vw,64px) 22px;background:var(--night);color:#f5f5f5;display:flex;align-items:end;justify-content:space-between;gap:32px;border-bottom:5px solid var(--signal)}
.brand{font-family:Inter,Arial,sans-serif;font-size:clamp(32px,4vw,58px);font-weight:600;letter-spacing:-.035em;line-height:.95}.kicker{font:700 11px/1.2 Inter,Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:var(--signal);margin-bottom:10px}.mast nav{display:flex;gap:8px}.mast nav a{padding:9px 14px;border:1px solid #404040;text-decoration:none;font-size:13px}.mast nav a[aria-current="page"]{background:var(--signal);border-color:var(--signal);color:var(--ink)}
.lede{max-width:70ch;color:#d4d4d4;font-size:14px;margin-top:10px}.meta{font:12px/1.5 Inter,Arial,sans-serif;color:var(--muted)}.badge{display:inline-flex;align-items:center;gap:6px;padding:5px 8px;border:1px solid currentColor;border-radius:999px;font:700 10px/1 Inter,Arial,sans-serif;text-transform:uppercase;letter-spacing:.08em}.badge.pending{color:#404040}.badge.approved,.badge.submitted{color:var(--safe)}.badge.skipped,.badge.closed,.badge.stale{color:var(--warn)}
button,input,textarea{font:inherit}button{cursor:pointer}button:disabled{cursor:not-allowed;opacity:.42}.rule{height:1px;background:var(--line);margin:18px 0}.empty{padding:48px;border:1px dashed var(--line);text-align:center;color:var(--muted)}
@media(max-width:820px){.mast{align-items:start;flex-direction:column}.mast nav{width:100%}.mast nav a{flex:1;text-align:center}}
`;

function shell(title: string, active: "review" | "status", body: string, extraStyles = "", script = "", example = false): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} · CareerOS</title><style>${shellStyles}${extraStyles}${workspaceStyles}${designSystem}</style></head><body>${workspaceHeader(active, "status-top", example)}${body}${script ? `<script>${script}</script>` : ""}</body></html>`;
}

function reviewShell(body: string, styles: string, script: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Review · CareerOS</title><style>${shellStyles}${styles}${workspaceStyles}${designSystem}</style></head><body>${workspaceHeader("review", "review-top")}${body}<script>${script}</script></body></html>`;
}

function requiredMark(required: boolean): string {
  return required ? '<span class="required-mark" aria-hidden="true" title="Required">*</span><span class="sr-only"> (required)</span>' : "";
}

function questionChoices(item: ReviewItem, question: ReviewItem["questions"][number]): string {
  return `<fieldset class="choice-list"><legend>${escapeHtml(question.prompt)}${requiredMark(question.required)}</legend>${(question.options ?? []).map((option) => `<label class="choice-row"><input class="choice-input" type="radio" name="${escapeHtml(`question-${item.applicationId}-${question.id}`)}" value="${escapeHtml(option.id)}" data-question="${escapeHtml(question.id)}" ${option.id === question.selectedOptionId ? "checked" : ""}><span class="choice-copy">${escapeHtml(option.label)}</span></label>`).join("")}</fieldset>`;
}

function generatedAnswerRows(item: ReviewItem): string {
  return item.answers.map((answer, index) => answer.kind === "generated"
    ? `<section class="review-item"><label class="short-label" for="answer-${escapeHtml(item.applicationId)}-${index}">${escapeHtml(answer.label)}</label><textarea class="long-answer generated-answer" id="answer-${escapeHtml(item.applicationId)}-${index}" data-answer-index="${index}" maxlength="16000" rows="6">${escapeHtml(answer.value)}</textarea></section>` : "").join("");
}

function applicationEvidence(item: ReviewItem): string {
  return `<p class="meta">CV: ${escapeHtml(item.cv.filename)} · ${item.cv.verified ? "Verified" : "Not verified"}</p>`;
}

function unresolvedQuestionRows(item: ReviewItem): string {
  return item.questions.map((question) => {
    const hint = question.required ? "" : '<div class="question-hint">Optional · You can leave this blank.</div>';
    if (question.options) return `<section class="review-item question" tabindex="-1" data-required="${question.required}" data-answered="${Boolean(question.options ? question.selectedOptionId : (question.draftAnswer?.trim() || question.resolution))}">${questionChoices(item, question)}${hint}</section>`;
    const value = question.draftAnswer ?? question.resolution ?? "";
    if (question.inputType === "short-text") {
      const id = `text-${item.applicationId}-${question.id}`;
      return `<section class="review-item question" tabindex="-1" data-required="${question.required}" data-answered="${Boolean(question.options ? question.selectedOptionId : (question.draftAnswer?.trim() || question.resolution))}"><label class="short-label" for="${escapeHtml(id)}">${escapeHtml(question.prompt)}${requiredMark(question.required)}</label><input class="short-answer" id="${escapeHtml(id)}" data-question="${escapeHtml(question.id)}" type="text" maxlength="300" value="${escapeHtml(value)}" ${question.required ? 'aria-required="true"' : ""}>${hint}</section>`;
    }
    return `<section class="review-item question" tabindex="-1" data-required="${question.required}" data-answered="${Boolean(question.options ? question.selectedOptionId : (question.draftAnswer?.trim() || question.resolution))}"><label class="short-label" for="long-${escapeHtml(item.applicationId)}-${escapeHtml(question.id)}">${escapeHtml(question.prompt)}${requiredMark(question.required)}</label><textarea class="long-answer question-answer" id="long-${escapeHtml(item.applicationId)}-${escapeHtml(question.id)}" data-question="${escapeHtml(question.id)}" maxlength="16000" rows="6" ${question.required ? 'aria-required="true"' : ""}>${escapeHtml(value)}</textarea>${hint}</section>`;
  }).join("");
}

function reviewCard(item: ReviewItem, selected: boolean, readOnly = false, workflowState?: StatusViewStatus): string {
  const missing = item.questions.some((question) => question.required && !(question.options ? question.selectedOptionId : (question.draftAnswer?.trim() || question.resolution)));
  const reason = missing ? "Complete the required answers to approve." : "";
  const href = safeHref(item.applicationUrl ?? item.officialUrl);
  const decisions = generatedAnswerRows(item) + unresolvedQuestionRows(item);
  return `<article class="detail" data-detail="${escapeHtml(item.applicationId)}" ${selected ? "" : "hidden"}>
    <header class="detail-head"><div><div class="category">${categoryLabel(item.category)}</div><h1>${escapeHtml(item.title)}</h1><p>${escapeHtml(item.company)}</p></div><div class="detail-actions"><a class="application-link" href="${href}" target="_blank" rel="noopener noreferrer">Open application ↗</a>${!readOnly ? `<div class="decision-dock"><button class="approve" data-action="approve" ${missing ? "disabled" : ""}>Approve content</button><span class="approval-reason meta" role="status">${reason}</span></div>` : `<div class="decision-dock"><span class="approved-status" role="status">${workflowState === "submitting" ? "Submitting…" : workflowState === "submission_failed" ? "Submission failed" : "Reviewed"}</span><button ${workflowState === "submitting" ? "disabled" : ""} class="reopen-content" data-id="${escapeHtml(item.applicationId)}" data-snapshot="${escapeHtml(item.snapshotId)}">Edit answers</button></div>`}${!readOnly ? '<div class="save-status" role="status" aria-live="polite"></div>' : ""}</div></header>
    ${item.reviewStage === "questions" ? "" : applicationEvidence(item)}
    <div class="judgments">${readOnly ? '<fieldset class="approved-contents" disabled>' : ""}${decisions || '<p class="meta">No additional decisions needed.</p>'}${readOnly ? "</fieldset>" : ""}</div>


  </article>`;
}

export function renderReviewPage(batch: ReviewBatch, selectedId?: string, submittedApplicationIds: readonly string[] = [], workflowStates: ReadonlyMap<string, StatusViewStatus> = new Map(), applicationOrder: readonly string[] = batch.applications.map(item => item.applicationId)): string {
  const submitted = new Set(submittedApplicationIds);
  const isHistory = (item: ReviewItem) => item.decision.state === "approved" || item.decision.state === "consumed" || submitted.has(item.applicationId);
  const pending = batch.applications.filter((item) => item.decision.state === "pending" && !isHistory(item));
  const collecting = batch.applications.filter((item) => !isHistory(item) && !pending.includes(item) && item.reviewStage === "questions" && ["pending", "stale"].includes(item.decision.state));

  const reviewed = batch.applications.filter(item => item.decision.state === "approved" && item.decision.scope === "content-only" && !submitted.has(item.applicationId));
  const positions = new Map(applicationOrder.map((id, index) => [id, index]));
  const visible = batch.applications.filter(item => pending.includes(item) || collecting.includes(item) || reviewed.includes(item))
    .sort((a, b) => (positions.get(a.applicationId) ?? Number.MAX_SAFE_INTEGER) - (positions.get(b.applicationId) ?? Number.MAX_SAFE_INTEGER));
  const explicitSelection = visible.find((item) => item.applicationId === selectedId);
  const selected = explicitSelection?.applicationId ?? visible.find(item => pending.includes(item) || collecting.includes(item))?.applicationId ?? visible[0]?.applicationId;
  const details = selected
    ? visible.map((item) => reviewCard(item, item.applicationId === selected, reviewed.includes(item), workflowStates.get(item.applicationId))).join("")
    : `<section class="review-complete" aria-labelledby="review-complete-title"><h1 id="review-complete-title">No applications pending review</h1><p>View application progress in Status.</p><a href="/status">View application status <span aria-hidden="true">↗</span></a></section>`;
  const queueRows = (items: ReviewItem[]) => items.map((item) => `<button class="queue-item" data-application="${escapeHtml(item.applicationId)}" aria-pressed="${item.applicationId === selected}"><span class="queue-copy"><strong>${escapeHtml(item.company)}</strong><span class="queue-role">${escapeHtml(item.title)}</span><small>${escapeHtml(item.location)}</small>${reviewed.includes(item) ? `<span class="review-label">${workflowStates.get(item.applicationId) === "submitting" ? "Submitting…" : workflowStates.get(item.applicationId) === "submission_failed" ? "Submission failed" : "Reviewed"}</span>` : ""}</span></button>`).join("");
  const body = visible.length
    ? `<main id="workspace-main" tabindex="-1" class="review-layout">${statusContext("in_review", "Review")}<aside class="queue" aria-label="Applications to review"><div class="queue-heading">Review <span>${visible.length}</span></div><label class="queue-picker-label" for="application-picker">Application</label><select class="queue-picker" id="application-picker">${visible.map(item => `<option value="${escapeHtml(item.applicationId)}" ${item.applicationId === selected ? "selected" : ""}>${escapeHtml(item.company)} — ${escapeHtml(item.title)}${reviewed.includes(item) ? " · Reviewed" : ""}</option>`).join("")}</select><div class="queue-list">${queueRows(visible)}</div></aside><div class="detail-wrap">${details}</div></main>`
    : `<main id="workspace-main" tabindex="-1" class="review-empty-layout">${statusContext("in_review", "Review")}${details}</main>`;
  const styles = reviewStyles;
  const items = JSON.stringify(visible.map((item) => ({ applicationId: item.applicationId, snapshotId: item.snapshotId, decision: collecting.includes(item) ? "questions" : item.decision.state }))).replaceAll("<", "\\u003c");
  const desiredStates = JSON.stringify(batch.applications.map((item) => [item.applicationId, {
    desiredRevision: item.desiredState?.revision ?? 0,
    syncState: item.desiredState?.syncState ?? "pending",
    requiredOptionIds: item.questions.filter((question) => question.required && question.options).map((question) => question.id),
    missingText: item.questions.some((question) => question.required && !question.options && !(question.draftAnswer?.trim() || question.resolution)),
    selectedOptions: Object.fromEntries(item.questions.filter((question) => question.options && question.selectedOptionId).map((question) => [question.id, question.selectedOptionId!]))
  }])).replaceAll("<", "\\u003c");
  const script = `const items=${items};const desiredStates=new Map(${desiredStates});
const updateApproval=(detail,state)=>{const approve=detail.querySelector('.approve');if(!approve)return;const missing=state.missingText||state.requiredOptionIds.some(id=>!state.selectedOptions[id]),dirty=Boolean(state.dirtyInputs?.size),failed=Boolean(state.saveErrors?.size);approve.disabled=missing||dirty||failed;const reason=detail.querySelector('.approval-reason');if(reason)reason.textContent=missing?'Complete the required answers to approve.':failed?'Resolve the save error to approve.':dirty?'Save your changes to approve.':''};
const setPickerBusy=busy=>document.querySelectorAll('.queue-picker').forEach(picker=>picker.disabled=busy);
const disabledStates=new Map();const setBusy=busy=>document.querySelectorAll('.queue-item,.approve,.choice-input,.short-answer,.long-answer').forEach(control=>{if(busy){disabledStates.set(control,control.disabled);control.disabled=true}else{control.disabled=disabledStates.get(control)??false;disabledStates.delete(control)}});
document.querySelectorAll('.queue-picker').forEach(picker=>picker.addEventListener('change',()=>{if(!picker.disabled)location.href='/review?application='+encodeURIComponent(picker.value)}));
document.querySelectorAll('[data-application]').forEach(button=>button.addEventListener('click',()=>{if(!button.disabled)location.href='/review?application='+encodeURIComponent(button.dataset.application)}));
document.querySelectorAll('.approve').forEach(button=>button.addEventListener('click',async()=>{
 if(button.disabled)return;
 const detail=button.closest('.detail'),id=detail.dataset.detail,item=items.find(i=>i.applicationId===id),state=desiredStates.get(id),status=detail.querySelector('.save-status');
 let firstMissing;
 detail.querySelectorAll('.question').forEach(row=>{const controls=[...row.querySelectorAll('input,textarea')],answered=controls.length?controls.some(c=>c.type==='radio'?c.checked:Boolean(c.value.trim())):row.dataset.answered==='true',missing=row.dataset.required==='true'&&!answered;row.classList.toggle('missing',missing);if(missing&&!firstMissing)firstMissing=row});
 if(firstMissing){status.textContent='Please complete this required answer.';firstMissing.scrollIntoView({behavior:'smooth',block:'center'});(firstMissing.querySelector('input,textarea')||firstMissing).focus();return}
 setPickerBusy(true);setBusy(true);
 try{const approval={applicationId:id,snapshotId:item.snapshotId};if(state?.desiredRevision>0)approval.expectedDesiredRevision=state.desiredRevision;
 const response=await fetch('/api/review/content-approval',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(approval)}),data=await response.json();
 if(!response.ok||data.applicationId!==id||data.snapshotId!==item.snapshotId||data.decision?.scope!=='content-only')throw Error('Could not approve');
 const index=items.findIndex(i=>i.applicationId===id),next=[...items.slice(index+1),...items.slice(0,index)].find(i=>i.decision==='pending'||i.decision==='questions');
 location.href='/review?application='+encodeURIComponent(next?.applicationId??id);
 }catch{status.textContent='Could not save approval. Please try again.';setBusy(false);setPickerBusy(false)}
}));`;
  const choiceScript = `document.querySelectorAll('.choice-input').forEach(radio=>radio.addEventListener('change',async()=>{if(radio.disabled)return;const detail=radio.closest('.detail'),item=items.find(i=>i.applicationId===detail.dataset.detail),state=item&&desiredStates.get(item.applicationId),status=detail.querySelector('.save-status');if(!item||!state||!status)return;const questionId=radio.dataset.question,optionId=radio.value,previous=state.selectedOptions[questionId],controls=[...document.querySelectorAll('.choice-input,.queue-item,.approve,.short-answer,.long-answer')].map(c=>[c,c.disabled]);controls.forEach(([c])=>c.disabled=true);document.querySelectorAll('.queue-picker').forEach(picker=>picker.disabled=true);status.textContent='Saving…';let saved=false;try{const response=await fetch('/api/review/answer',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({applicationId:item.applicationId,snapshotId:item.snapshotId,questionId,optionId,expectedRevision:state.desiredRevision})}),data=await response.json();if(!response.ok||data.applicationId!==item.applicationId||data.snapshotId!==item.snapshotId||data.questionId!==questionId||data.selectedOptionId!==optionId||!Number.isSafeInteger(data.desiredState?.revision)||data.desiredState.revision<1||data.desiredState.revision<state.desiredRevision||data.desiredState.syncState!=='pending')throw Error('Could not save');state.selectedOptions[questionId]=optionId;state.desiredRevision=data.desiredState.revision;state.syncState='pending';saved=true;status.textContent='Saved'}catch{status.textContent='Could not save. Previous choice restored.';detail.querySelectorAll('.choice-input').forEach(input=>{if(input.dataset.question===questionId)input.checked=input.value===previous})}finally{document.querySelectorAll('.queue-picker').forEach(picker=>picker.disabled=false);controls.forEach(([c,disabled])=>c.disabled=disabled);state.saveErrors??=new Set();if(saved)state.saveErrors.delete(questionId);else state.saveErrors.add(questionId);updateApproval(detail,state)}}));`;
  const completionStyles = `.review-empty-layout{display:grid;place-items:center;min-height:calc(100vh - 48px);padding:48px 24px}.review-complete{max-width:520px;text-align:center;padding-bottom:10vh}.review-complete h1{font-size:clamp(22px,3vw,30px);font-weight:500;line-height:1.4;margin:0 0 14px}.review-complete p{font-size:14px;line-height:1.7;color:var(--muted);margin:0 0 28px}.review-complete a{display:inline-block;font-size:14px;text-decoration:none;border-bottom:1px solid var(--line);padding:6px 0}.review-complete a:hover,.review-complete a:focus-visible{border-color:var(--ink)}`;
  const textScript = `document.querySelectorAll('.short-answer,.question-answer,.generated-answer').forEach(input=>{
    let savedValue=input.value;
    input.addEventListener('input',()=>{const detail=input.closest('.detail'),state=desiredStates.get(detail.dataset.detail);if(!state)return;state.dirtyInputs??=new Set();if(input.value===savedValue)state.dirtyInputs.delete(input);else state.dirtyInputs.add(input);updateApproval(detail,state)});
    input.addEventListener('keydown',event=>{if(event.key==='Enter'&&input.tagName==='INPUT'){event.preventDefault();input.blur()}});
    input.addEventListener('change',async()=>{
      if(input.disabled||input.value===savedValue)return;
      const detail=input.closest('.detail'),item=items.find(i=>i.applicationId===detail.dataset.detail),state=item&&desiredStates.get(item.applicationId),status=detail.querySelector('.save-status');
      if(!item||!state||!status)return;
      const controls=[...document.querySelectorAll('.choice-input,.queue-item,.approve,.short-answer,.long-answer')].map(c=>[c,c.disabled]);controls.forEach(([c])=>c.disabled=true);
      document.querySelectorAll('.queue-picker').forEach(picker=>picker.disabled=true);status.textContent='Saving…';let saved=false;
      try{
        const generated=input.classList.contains('generated-answer');const response=await fetch(generated?'/api/review/generated-answer':'/api/review/text',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({applicationId:item.applicationId,snapshotId:item.snapshotId,...(generated?{answerIndex:Number(input.dataset.answerIndex)}:{questionId:input.dataset.question}),value:input.value,expectedRevision:state.desiredRevision})}),data=await response.json();
        if(!response.ok||data.applicationId!==item.applicationId||data.snapshotId!==item.snapshotId||(generated?data.answerIndex!==Number(input.dataset.answerIndex):data.questionId!==input.dataset.question)||typeof data.value!=='string'||!Number.isSafeInteger(data.desiredState?.revision)||data.desiredState.revision<1||data.desiredState.revision<state.desiredRevision||data.desiredState.syncState!=='pending')throw Error('Could not save');
        input.value=data.value;savedValue=data.value;state.desiredRevision=data.desiredState.revision;state.syncState='pending';if(!generated)state.missingText=data.missingText===true;saved=true;status.textContent='Saved';
      }catch{input.value=savedValue;status.textContent='Could not save. Previous answer restored.'}
      finally{document.querySelectorAll('.queue-picker').forEach(picker=>picker.disabled=false);controls.forEach(([c,disabled])=>c.disabled=disabled);state.dirtyInputs?.delete(input);state.saveErrors??=new Set();const key=input.dataset.question??('answer:'+input.dataset.answerIndex);if(saved)state.saveErrors.delete(key);else state.saveErrors.add(key);updateApproval(detail,state);input.fitContent?.()}
    });
  });`;
  const sizingScript = `document.querySelectorAll('textarea.long-answer').forEach(input=>{
    const fit=()=>{if(input.closest('[hidden]'))return;input.style.height='auto';input.style.height=Math.max(144,input.scrollHeight+2)+'px'};
    input.fitContent=fit;input.addEventListener('input',fit);input.addEventListener('change',()=>setTimeout(fit,0));fit();
    if(typeof ResizeObserver!=='undefined'){let width=input.getBoundingClientRect().width;new ResizeObserver(()=>{const next=input.getBoundingClientRect().width;if(next!==width){width=next;fit()}}).observe(input)}
  });`;
  return reviewShell(body, styles + completionStyles, script + choiceScript + textScript + sizingScript);
}

function marketSwitch(active: "us" | "china"): string {
  if (active === "us") return `<nav class="market-switch" aria-label="Applications"><a href="/status/us" aria-current="page">All applications</a></nav>`;
  return `<nav class="market-switch" aria-label="Market"><a href="/status/us">US</a><a href="/status/china" ${active === "china" ? 'aria-current="page"' : ""}>China</a></nav>`;
}

const marketSwitchStyles = `.market-switch{display:flex;gap:8px;margin-bottom:28px}.market-switch a{min-width:72px;padding:9px 18px;border:1px solid var(--line);border-radius:999px;text-align:center;text-decoration:none;color:var(--muted);font:700 11px Inter,Arial,sans-serif;letter-spacing:.08em}.market-switch a[aria-current="page"]{background:var(--ink);border-color:var(--ink);color:var(--paper)}`;

const statusFilterScript = `const statusFilters=document.querySelectorAll('[data-status-filter]'),statusRows=document.querySelectorAll('[data-status]'),statusCount=document.querySelector('[data-status-count]'),statusCountLabel=document.querySelector('[data-status-count-label]'),statusEmpty=document.querySelector('[data-status-empty]');statusFilters.forEach(filter=>filter.addEventListener('click',()=>{const selected=filter.dataset.statusFilter;let visible=0;statusRows.forEach(row=>{const show=selected==='all'||row.dataset.status===selected;row.hidden=!show;if(show){visible+=1;const link=row.querySelector('.row-link'),ordinal=String(visible).padStart(2,'0');if(link){link.textContent=ordinal+' ↗';link.setAttribute('aria-label',(link.getAttribute('aria-label')||'').replace(/^(Open (?:application|Boss job)) [0-9]+:/,'$1 '+ordinal+':'))}}});statusFilters.forEach(candidate=>candidate.setAttribute('aria-pressed',String(candidate===filter)));if(statusCount)statusCount.textContent=String(visible);if(statusCountLabel)statusCountLabel.textContent='shown';if(statusEmpty)statusEmpty.hidden=visible!==0;document.querySelectorAll('[data-stage-task]').forEach(link=>link.hidden=link.dataset.stageTask!==selected);const apply=document.getElementById('snapshot-apply');if(apply)apply.hidden=!['all','shortlisted'].includes(selected)}))`;

const demoInterviewScript = `;document.querySelectorAll('[data-demo-interview]').forEach(button=>button.addEventListener('click',async()=>{
 if(button.disabled)return;const target=JSON.parse(button.dataset.demoInterview),message=button.parentElement.querySelector('[data-demo-message]');
 button.disabled=true;button.setAttribute('aria-busy','true');button.textContent='Moving…';message.textContent='';
 try{const response=await fetch('/api/demo/interviews',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(target)}),data=await response.json();
  if(!response.ok||data.jobId!==target.jobId||data.applicationId!==target.applicationId||typeof data.interviewId!=='string')throw Error(data.error==='runner_unavailable'?'Codex is disconnected. Restart the website from your project chat.':data.error==='task_already_active'?'Wait for the current interview request to finish, then try again.':data.error==='demo_interview_unavailable'?'This action is available for fictional demos only.':data.error==='demo_interview_changed'?'This rehearsal changed. Reload Status before trying again.':'Could not create the demo interview. Try again.');
  location.assign('/interviews?interview='+encodeURIComponent(data.interviewId)+'&view=preparation&filter=all');
 }catch(error){message.textContent=error.message;button.disabled=false;button.removeAttribute('aria-busy');button.textContent='Simulate interview'}
}));`;

function resumeTag(item: StatusViewItem, example = false): string {
  const recommendation = item.resumeRecommendation;
  const key = item.resumeProfile ?? (!item.resumeStale && recommendation?.status === "matched" ? recommendation.profileKey : null);
  if (key) {
    return `<span class="resume-tag" title="${example ? "Matched resume in the prepared snapshot" : item.resumeProfile ? "Application resume" : "Matched by Jev"}">${categoryLabel(key)}</span>`;
  }
  const label = item.resumeStale ? "Refresh match" : recommendation?.status === "no_resumes" ? "Add resume" : recommendation?.status === "no_match" ? "No suitable resume" : recommendation?.status === "needs_review" ? "Review match" : "Not matched yet";
  return `<a class="resume-tag resume-unresolved" href="/profile">${label}</a>`;
}

export function renderUsStatusPage(applications: readonly StatusViewItem[], example = false, exampleReviewUrl?: string): string {
  const activeApplications = applications.filter((item) => item.status !== "closed");
  const lifecycle = ["Shortlisted", "In Review", "Submitted", "Interviewing", "Offer"] as const;
  const rows = activeApplications.map((item, index) => {
    const href = example ? "/example/jobs/" + encodeURIComponent(item.jobId) : safeHref(item.href);
    const target = example ? "" : ' target="_blank" rel="noopener noreferrer"';
    const city = compactLocation(item.location);
    const ordinal = String(index + 1).padStart(2, "0");

    return `<tr class="status-row" data-job="${escapeHtml(item.jobId)}" data-status="${statusGroup(item.status)}"><td class="row-selection-cell"><label class="row-selection">${example && !exampleReviewUrl && item.status === "shortlisted" ? `<input class="snapshot-select" type="checkbox" form="snapshot-apply" name="job" value="${escapeHtml(item.jobId)}" aria-label="Select ${escapeHtml(item.company)}">` : !example && item.status === "shortlisted" ? `<input class="job-select" type="checkbox" value="${escapeHtml(item.jobId)}" data-resume-ready="${Boolean(item.resumeProfile || (!item.resumeStale && item.resumeRecommendation?.status === "matched"))}" aria-label="Prepare ${escapeHtml(item.company)} — ${escapeHtml(item.title)}">` : ""}</label></td><td><a class="row-link" href="${href}"${target} aria-label="Open application ${ordinal}: ${escapeHtml(item.company)} — ${escapeHtml(item.title)}">${ordinal} ↗</a></td><td class="row-application"><div class="company-line">${escapeHtml(item.company)}</div><div class="row-location">${escapeHtml(city)}</div></td><td class="row-role"><a class="role" href="${href}"${target}>${escapeHtml(item.title)}</a>${item.preparationNeedsRetry ? '<p class="preparation-retry">Apply again to prepare.</p>' : ""}${item.demoInterviewTarget ? `<div class="row-demo-actions"><button class="demo-interview-button" type="button" data-demo-interview="${escapeHtml(JSON.stringify(item.demoInterviewTarget))}" aria-label="Simulate interview for ${escapeHtml(item.company)} — ${escapeHtml(item.title)}">Simulate interview</button><p class="demo-interview-message" data-demo-message role="status" aria-live="polite"></p></div>` : ""}</td><td><span class="row-stage">${statusLabels[item.status]}</span></td><td class="row-resume">${resumeTag(item, example)}</td><td><time datetime="${escapeHtml(item.dateTime)}" aria-label="Updated ${escapeHtml(item.dateLabel)}">${escapeHtml(item.dateLabel)}</time></td></tr>`;
  }).join("");
  const lifecycleLabel = lifecycle.join(" → ");
  const count = (group: string) => activeApplications.filter(item => statusGroup(item.status) === group).length;
  const apply = example && !exampleReviewUrl && count("shortlisted") ? `<form id="snapshot-apply" action="/example/review" method="get"><input type="hidden" name="stage" value="in_review"><button class="snapshot-apply-button" disabled>Apply</button></form>` : "";
  const selectionScript = example ? `;const picks=[...document.querySelectorAll(".snapshot-select")],applyButton=document.querySelector(".snapshot-apply-button");function syncPicks(){if(applyButton){const n=picks.filter(p=>p.checked).length;applyButton.disabled=n===0;applyButton.textContent=n?"Apply ("+n+")":"Apply"}}picks.forEach(p=>p.addEventListener("change",syncPicks));window.addEventListener("pageshow",syncPicks);syncPicks();` : "";
  const reviewLink = example ? escapeHtml(exampleReviewUrl ?? "/example") : "/review";
  const interviewLink = example ? escapeHtml(activeApplications.find(i => i.status === "interviewing")?.interviewHref ?? "/example") : "/interviews?filter=upcoming&amp;view=preparation";
  const body = `<main id="workspace-main" tabindex="-1" class="status-page"><header class="status-head"><div class="status-intro"><h1>Applications</h1></div><dl class="status-overview" aria-label="Application overview"><div><dt>Active opportunities</dt><dd>${activeApplications.length}</dd></div><div><dt>In review</dt><dd>${count("in_review") ? `<a class="overview-task-link" href="${reviewLink}" aria-label="Review ${count("in_review")} ${count("in_review") === 1 ? "application" : "applications"}">${count("in_review")}</a>` : "0"}</dd></div><div><dt>Interviewing</dt><dd>${count("interviewing") ? `<a class="overview-task-link" href="${interviewLink}" aria-label="Prepare ${count("interviewing")} ${count("interviewing") === 1 ? "interview" : "interviews"}">${count("interviewing")}</a>` : "0"}</dd></div></dl></header><section data-search-refresh-placeholder></section><section class="status-list" aria-label="Tracked applications"><div class="pipeline-heading"><h2>Your pipeline</h2><div class="total" aria-live="polite"><strong data-status-count>${activeApplications.length}</strong><span data-status-count-label>shown</span></div><div class="pipeline-actions">${apply}${count("in_review") ? `<a class="stage-task-link" data-stage-task="in_review" href="${reviewLink}" hidden>Review applications <span aria-hidden="true">↗</span></a>` : ""}${count("interviewing") ? `<a class="stage-task-link" data-stage-task="interviewing" href="${interviewLink}" hidden>Prepare interviews <span aria-hidden="true">↗</span></a>` : ""}</div></div><section class="lifecycle-guide" aria-label="Filter applications by status. Lifecycle: ${lifecycleLabel}"><div class="lifecycle-stages us-stages"><button class="status-filter" type="button" data-status-filter="all" aria-pressed="true">All (${activeApplications.length})</button>${lifecycle.map((status) => `<button class="status-filter" type="button" data-status-filter="${status.toLowerCase().replace(" ", "_")}" aria-pressed="false">${status}</button>`).join("")}</div></section><div class="status-table-scroll"><table class="status-table"><thead><tr><th aria-label="Selection"></th><th scope="col">#</th><th scope="col">Company · Location</th><th scope="col">Role</th><th scope="col">Status</th><th scope="col">Resume</th><th scope="col">Date</th></tr></thead><tbody>${rows}</tbody></table></div><div class="empty filter-empty" data-status-empty hidden>No applications match this status.</div>${activeApplications.length ? "" : `<div class="empty">No active applications.</div>`}</section></main>`;
  return shell("Status", "status", body, `${marketSwitchStyles}${statusStyles}${statusLayout}${example ? ".snapshot-apply-button{font:600 14px/1.4 var(--font);padding:8px 18px;border:0;border-radius:7px;background:#202326;color:#fff;cursor:pointer}.snapshot-apply-button:disabled{background:#e5e8ec;color:#5d6670;cursor:default}.snapshot-select{width:17px;height:17px;accent-color:#202326}" : ""}`, statusFilterScript + demoInterviewScript + `;const savedStage=new URLSearchParams(location.search).get('stage');if(savedStage)[...statusFilters].find(button=>button.dataset.statusFilter===savedStage)?.click();` + selectionScript, example).replace("<body>", '<body class="status-workspace">');
}

export const renderStatusPage = renderUsStatusPage;

export function renderChinaStatusPage(items: readonly ChinaStatusViewItem[]): string {
  const lifecycle = ["Discovered", "Ready to Contact", "Awaiting Review", "Contacted", "Closed"] as const;
  const labels: Record<ChinaStatus, (typeof lifecycle)[number]> = {
    discovered: "Discovered",
    ready_to_contact: "Ready to Contact",
    awaiting_review: "Awaiting Review",
    contacted: "Contacted",
    closed: "Closed"
  };
  const rows = items.map((item, index) => {
    const ordinal = String(index + 1).padStart(2, "0");
    return `<article class="status-row china-row" data-status="${item.status}"><a class="row-link" href="${safeHref(item.href)}" target="_blank" rel="noopener noreferrer" aria-label="Open Boss job ${ordinal}: ${escapeHtml(item.company)} — ${escapeHtml(item.title)}">${ordinal} ↗</a></div><div class="row-application"><div class="company-line">${escapeHtml(item.company)} · ${escapeHtml(compactLocation(item.location))}</div><div class="role">${escapeHtml(item.title)}</div><div class="recruiter">${escapeHtml(item.recruiter)}</div></div><span class="row-category">${escapeHtml(item.category)}</span><span class="row-status">${labels[item.status]}</span><time datetime="${escapeHtml(item.dateTime)}" aria-label="Updated ${escapeHtml(item.dateLabel)}">${escapeHtml(item.dateLabel)}</time></article>`;
  }).join("");
  const lifecycleLabel = lifecycle.join(" → ");
  const statusValues: readonly ChinaStatus[] = ["discovered", "ready_to_contact", "awaiting_review", "contacted", "closed"];
  const body = `<main id="workspace-main" tabindex="-1" class="status-page">${marketSwitch("china")}<header class="status-head"><div><div class="kicker dark">China initial-outreach ledger</div><h1>BOSS Zhipin status</h1></div><div class="total" aria-live="polite"><strong data-status-count>${items.length}</strong><span data-status-count-label>tracked</span></div></header><section class="lifecycle-guide" aria-label="Filter Boss jobs by status. Lifecycle: ${lifecycleLabel}"><div class="lifecycle-stages china-stages">${lifecycle.map((status, index) => `<button class="status-filter" type="button" data-status-filter="${statusValues[index]}" aria-pressed="false">${status}</button>`).join("")}</div><div class="lifecycle-line" aria-hidden="true"></div></section><section class="status-list" aria-label="Tracked Boss jobs">${rows}<div class="empty filter-empty" data-status-empty hidden>No BOSS Zhipin jobs match this status.</div>${items.length ? "" : `<div class="empty">No BOSS Zhipin jobs tracked yet.</div>`}</section></main>`;
  const styles = `.status-page{padding:clamp(24px,4vw,52px);max-width:1180px;margin:auto}.status-head{display:flex;justify-content:space-between;align-items:end;padding-bottom:18px}.status-head h1{font:500 clamp(36px,5vw,62px)/.95 Inter,Arial,sans-serif;letter-spacing:-.04em;margin:7px 0 0}.total{text-align:right}.total strong,.total span{display:block}.total strong{font:44px/1 Inter,Arial,sans-serif}.total span{font:10px Inter,Arial,sans-serif;text-transform:uppercase}.lifecycle-guide{overflow-x:auto;padding:14px 2px 20px}.lifecycle-stages,.lifecycle-line{min-width:650px}.lifecycle-stages{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;color:var(--muted);font:600 10px/1.2 Inter,Arial,sans-serif;letter-spacing:.04em;text-align:center}.lifecycle-line{height:1px;margin-top:10px;background:var(--line);position:relative}.lifecycle-line::after{content:"→";position:absolute;right:-1px;top:50%;padding-left:5px;background:var(--paper);color:var(--muted);font:14px/1 Inter,Arial,sans-serif;transform:translateY(-52%)}.status-list{border-top:1px solid var(--line)}.status-row{display:grid;grid-template-columns:64px minmax(260px,1fr) 100px 132px 48px;gap:18px;align-items:center;min-height:80px;padding:12px 8px;border-bottom:1px solid var(--line)}.row-link{align-self:stretch;display:flex;align-items:center;font:600 11px Inter,Arial,sans-serif;text-decoration:none;color:var(--muted)}.company-line{font-size:13px;font-weight:650}.role{margin-top:3px;font:17px/1.2 Inter,Arial,sans-serif}.recruiter{margin-top:5px;color:var(--muted);font:11px Inter,Arial,sans-serif}.row-category,.row-status,time{font:600 10px/1.3 Inter,Arial,sans-serif}.row-category{text-transform:uppercase;color:var(--muted)}time{color:var(--muted)}.empty{padding:32px 8px;color:var(--muted)}@media(max-width:720px){.status-page{padding:24px 18px}.status-row{grid-template-columns:48px minmax(0,1fr) auto auto;gap:8px 12px}.row-link{grid-row:1 / span 2}.row-application{grid-column:2 / -1}.row-category{grid-column:2}.row-status{grid-column:3}time{grid-column:4}}`;
  return shell("China BOSS Zhipin status", "status", body, `${marketSwitchStyles}${styles}.china-stages{grid-template-columns:repeat(5,1fr)}.status-filter{min-width:0;padding:8px 5px;border:1px solid transparent;border-radius:999px;background:transparent;color:var(--muted);font:600 10px/1.2 Inter,Arial,sans-serif;letter-spacing:.04em;white-space:nowrap}.status-filter:hover,.status-filter:focus-visible{border-color:var(--line);color:var(--ink)}.status-filter[aria-pressed="true"]{background:var(--ink);border-color:var(--ink);color:var(--paper)}.status-row[hidden]{display:none}.filter-empty{border-bottom:1px solid var(--line)}`, statusFilterScript);
}
