import type { ReviewBatch, ReviewItem } from "./reviewStore.js";
import type { StatusViewItem, StatusViewStatus } from "./statusView.js";
import type { ChinaStatusViewItem, ChinaStatus } from "../china/status/chinaStatusView.js";

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function categoryLabel(category: ReviewItem["category"]): string {
  return { llm: "LLM", recommendation: "REC", robotics: "LOB" }[category];
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

function isFinalReviewReady(item: ReviewItem): boolean {
  return item.cv.verified && item.snapshotCurrent && item.validationErrors.length === 0 &&
    item.questions.every((question) => !question.required || Boolean(
      question.options ? question.selectedOptionId : (question.draftAnswer?.trim() || question.resolution)
    ));
}

function readyForApproval(item: ReviewItem): boolean {
  return item.decision.state === "pending" && isFinalReviewReady(item);
}

const shellStyles = `
:root{--paper:#f3f0e8;--ink:#171713;--muted:#68665f;--line:#cbc5b8;--safe:#1e6b4c;--warn:#c5522a;--signal:#f2b84b;--panel:#fffdf7;--night:#22231f}
*{box-sizing:border-box}html{background:var(--paper);color:var(--ink)}body{margin:0;font-family:"Avenir Next","Gill Sans",sans-serif;line-height:1.45;background:radial-gradient(circle at 87% 5%,rgba(242,184,75,.2),transparent 28rem),var(--paper)}
a{color:inherit}.mast{min-height:120px;padding:26px clamp(24px,4vw,64px) 22px;background:var(--night);color:#f9f5e9;display:flex;align-items:end;justify-content:space-between;gap:32px;border-bottom:5px solid var(--signal)}
.brand{font-family:"Iowan Old Style",Baskerville,serif;font-size:clamp(32px,4vw,58px);font-weight:600;letter-spacing:-.035em;line-height:.95}.kicker{font:700 11px/1.2 ui-monospace,monospace;letter-spacing:.14em;text-transform:uppercase;color:var(--signal);margin-bottom:10px}.mast nav{display:flex;gap:8px}.mast nav a{padding:9px 14px;border:1px solid #5b5d55;text-decoration:none;font-size:13px}.mast nav a[aria-current="page"]{background:var(--signal);border-color:var(--signal);color:var(--ink)}
.lede{max-width:70ch;color:#c9cabf;font-size:14px;margin-top:10px}.meta{font:12px/1.5 ui-monospace,monospace;color:var(--muted)}.badge{display:inline-flex;align-items:center;gap:6px;padding:5px 8px;border:1px solid currentColor;border-radius:999px;font:700 10px/1 ui-monospace,monospace;text-transform:uppercase;letter-spacing:.08em}.badge.pending{color:#765e24}.badge.approved,.badge.submitted{color:var(--safe)}.badge.skipped,.badge.closed,.badge.stale{color:var(--warn)}
button,input,textarea{font:inherit}button{cursor:pointer}button:disabled{cursor:not-allowed;opacity:.42}.rule{height:1px;background:var(--line);margin:18px 0}.empty{padding:48px;border:1px dashed var(--line);text-align:center;color:var(--muted)}
@media(max-width:820px){.mast{align-items:start;flex-direction:column}.mast nav{width:100%}.mast nav a{flex:1;text-align:center}}
`;

function shell(title: string, active: "review" | "status", body: string, extraStyles = "", script = ""): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>${shellStyles}${extraStyles}</style></head><body><header class="mast"><div><div class="kicker">Local application desk · no-submit surface</div><div class="brand">Application control room</div><p class="lede">Review evidence locally. Decisions are snapshot-bound. This site cannot operate an ATS.</p></div><nav aria-label="Primary"><a href="/review" ${active === "review" ? 'aria-current="page"' : ""}>Review queue</a><a href="/status" ${active === "status" ? 'aria-current="page"' : ""}>Status ledger</a></nav></header>${body}${script ? `<script>${script}</script>` : ""}</body></html>`;
}

function reviewShell(body: string, styles: string, script: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Application review</title><style>${shellStyles}${styles}</style></head><body><header class="review-top"><a href="/review" aria-current="page">Applications</a><nav aria-label="Primary"><a href="/review" aria-current="page">Review</a><a href="/status">Status</a></nav></header>${body}<script>${script}</script></body></html>`;
}

function questionChoices(item: ReviewItem, question: ReviewItem["questions"][number]): string {
  return `<fieldset class="choice-list"><legend>${escapeHtml(question.prompt)}</legend>${(question.options ?? []).map((option) => `<label class="choice-row"><input class="choice-input" type="radio" name="${escapeHtml(`question-${item.applicationId}-${question.id}`)}" value="${escapeHtml(option.id)}" data-question="${escapeHtml(question.id)}" ${option.id === question.selectedOptionId ? "checked" : ""}><span class="choice-copy">${escapeHtml(option.label)}</span></label>`).join("")}</fieldset>`;
}

function generatedAnswerRows(item: ReviewItem): string {
  return item.answers.filter((answer) => answer.kind === "generated")
    .map((answer) => `<section class="review-item"><h3>${escapeHtml(answer.label)}</h3><p>${escapeHtml(answer.value)}</p></section>`).join("");
}

function applicationEvidence(item: ReviewItem): string {
  return `<p class="meta">CV: ${escapeHtml(item.cv.filename)} · ${item.cv.verified ? "Verified" : "Not verified"}</p>`;
}

function unresolvedQuestionRows(item: ReviewItem): string {
  return item.questions.map((question) => question.options
    ? `<section class="review-item question">${questionChoices(item, question)}</section>`
    : `<section class="review-item question"><h3>${escapeHtml(question.prompt)}</h3>${question.draftAnswer || question.resolution ? `<p>${escapeHtml(question.draftAnswer ?? question.resolution ?? "")}</p>` : ""}</section>`).join("");
}

function validationRows(item: ReviewItem): string {
  return item.validationErrors
    .map((message) => `<section class="review-item blocker"><small>Blocker</small><p>${escapeHtml(message)}</p></section>`)
    .join("");
}

function reviewCard(item: ReviewItem, selected: boolean, readOnly = false): string {
  const ready = readyForApproval(item);
  const missing = item.questions.some((question) => question.required && !(question.options ? question.selectedOptionId : (question.draftAnswer?.trim() || question.resolution)));
  const reason = ready ? "" : missing ? "Required answers are missing" : "Ready to approve after form verification";
  const href = safeHref(item.applicationUrl ?? item.officialUrl);
  const decisions = generatedAnswerRows(item) + unresolvedQuestionRows(item);
  return `<article class="detail" data-detail="${escapeHtml(item.applicationId)}" ${selected ? "" : "hidden"}>
    <header class="detail-head"><div><div class="category">${categoryLabel(item.category)}</div><h1>${escapeHtml(item.title)}</h1><p>${escapeHtml(item.company)}</p></div><a class="application-link" href="${href}" target="_blank" rel="noopener noreferrer">Open application ↗</a></header>
    ${item.reviewStage === "questions" ? "" : applicationEvidence(item)}
    <div class="judgments">${decisions || '<p class="meta">No additional decisions needed.</p>'}${item.reviewStage === "questions" ? "" : validationRows(item)}</div>
    ${!readOnly ? '<div class="save-status" role="status" aria-live="polite"></div>' : ""}
    ${!readOnly ? `<footer class="decision-dock"><span class="approval-reason meta" role="status">${reason}</span><button class="approve" data-action="approve" ${ready ? "" : "disabled"}>Approve</button></footer>` : ""}
  </article>`;
}

export function renderReviewPage(batch: ReviewBatch, selectedId?: string, submittedApplicationIds: readonly string[] = []): string {
  const submitted = new Set(submittedApplicationIds);
  const isHistory = (item: ReviewItem) => item.decision.state === "approved" || item.decision.state === "consumed" || submitted.has(item.applicationId);
  const pending = batch.applications.filter((item) => item.decision.state === "pending" && !isHistory(item) && item.cv.verified && item.snapshotCurrent && item.validationErrors.length === 0);
  const collecting = batch.applications.filter((item) => !isHistory(item) && !pending.includes(item) && item.reviewStage === "questions" && ["pending", "stale"].includes(item.decision.state));

  const visible = [...pending, ...collecting];
  const explicitSelection = visible.find((item) => item.applicationId === selectedId);
  const selected = explicitSelection?.applicationId ?? pending[0]?.applicationId ?? collecting[0]?.applicationId;
  const details = selected
    ? visible.map((item) => reviewCard(item, item.applicationId === selected, false)).join("")
    : `<section class="review-complete" aria-labelledby="review-complete-title"><h1 id="review-complete-title">No applications pending review</h1><p>View application progress in Status.</p><a href="/status">View application status <span aria-hidden="true">↗</span></a></section>`;
  const queueRows = (items: ReviewItem[]) => items.map((item) => `<button class="queue-item" data-application="${escapeHtml(item.applicationId)}" aria-pressed="${item.applicationId === selected}"><span class="queue-index">${String(visible.indexOf(item) + 1).padStart(2, "0")}</span><span><strong>${escapeHtml(item.company)}</strong><small>${escapeHtml(item.location)}</small></span></button>`).join("");
  const body = visible.length
    ? `<main class="review-layout"><aside class="queue"><div class="queue-list">${queueRows(pending)}${queueRows(collecting)}</div></aside><div class="detail-wrap">${details}</div></main>`
    : `<main class="review-empty-layout">${details}</main>`;
  const styles = `.review-top{height:48px;padding:0 20px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line);background:var(--panel)}.review-top>a{font:600 15px "Iowan Old Style",serif;text-decoration:none}.review-top nav{display:flex;gap:16px}.review-top nav a{font-size:12px;color:var(--muted);text-decoration:none}.review-top nav a[aria-current="page"]{color:var(--ink)}.review-layout{display:grid;grid-template-columns:160px 1fr;min-height:calc(100vh - 48px)}.queue{border-right:1px solid var(--line);background:rgba(255,253,247,.55)}.queue-list{display:grid}.queue-item{display:grid;grid-template-columns:22px 1fr;gap:8px;text-align:left;padding:14px 10px;border:0;border-bottom:1px solid var(--line);background:transparent;color:inherit}.queue-item[aria-pressed="true"]{box-shadow:inset 2px 0 var(--warn);background:var(--panel)}.queue-index{font:10px ui-monospace,monospace;color:var(--muted)}.queue-item strong,.queue-item small{display:block}.queue-item strong{font-size:12px}.queue-item small{margin-top:3px;font-size:10px;color:var(--muted)}.detail-wrap{padding:clamp(28px,5vw,72px);max-width:980px}.detail-head{display:flex;align-items:start;justify-content:space-between;gap:28px;padding-bottom:24px;border-bottom:1px solid var(--line)}.category{font:700 10px ui-monospace,monospace;letter-spacing:.12em;color:var(--warn)}.detail h1{font:500 28px/1.08 "Iowan Old Style",serif;letter-spacing:-.025em;margin:7px 0;max-width:24ch}.detail-head p{margin:0;color:var(--muted)}.application-link{white-space:nowrap;text-decoration:none;border-bottom:1px solid currentColor;padding:5px 0;font-size:13px}.judgments{margin-top:8px}.review-item{padding:20px 0;border-bottom:1px solid var(--line)}.review-item small{font:700 9px ui-monospace,monospace;text-transform:uppercase;letter-spacing:.1em;color:var(--muted)}.review-item h3,.choice-list legend{font:600 17px/1.35 "Iowan Old Style",serif;margin:6px 0}.review-item p{white-space:pre-wrap;margin:8px 0 0}.question{border-left:3px solid var(--signal);padding-left:16px}.choice-list{display:grid;min-width:0;margin:6px 0 0;padding:0;border:0;border-top:1px solid var(--line)}.choice-list legend{float:left;width:100%;padding:0 0 7px;border-bottom:1px solid var(--line)}.choice-list legend+*{clear:both}.choice-row{display:grid;grid-template-columns:18px minmax(0,1fr);gap:10px;align-items:start;padding:11px 2px;border-bottom:1px solid var(--line);cursor:pointer}.choice-row:hover{background:rgba(255,253,247,.65)}.choice-input{width:15px;height:15px;margin:3px 0 0;accent-color:var(--ink)}.choice-copy{display:flex;align-items:baseline;justify-content:space-between;gap:14px;font-size:14px}.recommendation{flex:none;color:var(--safe);font:700 9px/1.3 ui-monospace,monospace;text-transform:uppercase;letter-spacing:.06em}.save-status{min-height:18px;padding-top:12px;color:var(--muted);font:600 10px/1.4 ui-monospace,monospace}.blocker{border-left:3px solid var(--warn);padding-left:16px;color:var(--warn)}.decision-dock{display:flex;justify-content:flex-end;align-items:center;gap:16px;padding-top:8px}.approve{padding:10px 20px;border:1px solid var(--ink);background:var(--ink);color:white;font-weight:700}.approve:disabled{background:transparent;color:var(--muted)}@media(max-width:680px){.review-layout{grid-template-columns:1fr}.queue{border-right:0;border-bottom:1px solid var(--line)}.queue-list{display:flex;overflow:auto}.queue-item{min-width:150px;border-right:1px solid var(--line)}.detail-head{display:grid}.detail-wrap{padding:28px 20px}.choice-copy{display:grid;gap:5px}.recommendation{white-space:normal}}`;
  const items = JSON.stringify(visible.map((item) => ({ applicationId: item.applicationId, snapshotId: item.snapshotId, decision: collecting.includes(item) ? "questions" : item.decision.state }))).replaceAll("<", "\\u003c");
  const desiredStates = JSON.stringify(batch.applications.filter((item) => item.questions.length > 0).map((item) => [item.applicationId, {
    desiredRevision: item.desiredState?.revision ?? 0,
    syncState: item.desiredState?.syncState ?? "pending",
    requiredOptionIds: item.questions.filter((question) => question.required && question.options).map((question) => question.id),
    missingText: item.questions.some((question) => question.required && !question.options && !(question.draftAnswer?.trim() || question.resolution)),
    selectedOptions: Object.fromEntries(item.questions.filter((question) => question.options && question.selectedOptionId).map((question) => [question.id, question.selectedOptionId!]))
  }])).replaceAll("<", "\\u003c");
  const script = `const items=${items};const desiredStates=new Map(${desiredStates});const post=async(path,body)=>{const response=await fetch(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});if(!response.ok){const data=await response.json().catch(()=>({error:'request_failed'}));alert(data.error||'Request failed');return false}return true};const nextPending=id=>{const index=items.findIndex(item=>item.applicationId===id),ordered=[...items.slice(index+1),...items.slice(0,index)];return ordered.find(item=>item.applicationId!==id&&item.decision==='pending')};const disabledStates=new Map();const setBusy=busy=>document.querySelectorAll('.queue-item,.approve,.choice-input').forEach(control=>{if(busy){disabledStates.set(control,control.disabled);control.disabled=true}else{control.disabled=disabledStates.get(control)??false;disabledStates.delete(control)}});document.querySelectorAll('[data-application]').forEach(button=>button.addEventListener('click',async()=>{if(button.disabled)return;setBusy(true);let complete=false;try{const id=button.dataset.application,item=items.find(item=>item.applicationId===id);if(item?.decision==='history'||item?.decision==='questions'){location.href='/review?application='+encodeURIComponent(id);complete=true;return}complete=await post('/api/review/open',item)&&await post('/api/review/viewed',item);if(complete)location.href='/review?application='+encodeURIComponent(id)}finally{if(!complete)setBusy(false)}}));document.querySelectorAll('.approve').forEach(button=>button.addEventListener('click',async()=>{if(button.disabled)return;setBusy(true);let complete=false;try{const detail=button.closest('.detail'),id=detail.dataset.detail,item=items.find(item=>item.applicationId===id),state=desiredStates.get(id),approval={...item,decision:'approved'};if(state?.desiredRevision>0)approval.expectedDesiredRevision=state.desiredRevision;complete=await post('/api/review/open',item)&&await post('/api/review/viewed',item)&&await post('/api/review/decision',approval);if(!complete)return;const next=nextPending(id);if(!next){location.href='/review';return}complete=await post('/api/review/open',next)&&await post('/api/review/viewed',next);if(complete)location.href='/review?application='+encodeURIComponent(next.applicationId)}finally{if(!complete)setBusy(false)}}));`;
  const choiceScript = `document.querySelectorAll('.choice-input').forEach(radio=>radio.addEventListener('change',async()=>{if(radio.disabled)return;const detail=radio.closest('.detail'),item=items.find(i=>i.applicationId===detail.dataset.detail),state=item&&desiredStates.get(item.applicationId),status=detail.querySelector('.save-status');if(!item||!state||!status)return;const questionId=radio.dataset.question,optionId=radio.value,previous=state.selectedOptions[questionId],controls=[...document.querySelectorAll('.choice-input,.queue-item,.approve')].map(c=>[c,c.disabled]);controls.forEach(([c])=>c.disabled=true);status.textContent='Saving…';let saved=false,reviewReady=false;try{const response=await fetch('/api/review/answer',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({applicationId:item.applicationId,snapshotId:item.snapshotId,questionId,optionId})}),data=await response.json();if(!response.ok||data.applicationId!==item.applicationId||data.snapshotId!==item.snapshotId||data.questionId!==questionId||data.selectedOptionId!==optionId||!Number.isSafeInteger(data.desiredState?.revision)||data.desiredState.revision<1||data.desiredState.revision<state.desiredRevision||data.desiredState.syncState!=='pending')throw Error('Could not save');state.selectedOptions[questionId]=optionId;state.desiredRevision=data.desiredState.revision;state.syncState='pending';saved=true;reviewReady=data.reviewReady===true;status.textContent='Saved'}catch{status.textContent='Could not save. Previous choice restored.';detail.querySelectorAll('.choice-input').forEach(input=>{if(input.dataset.question===questionId)input.checked=input.value===previous})}finally{controls.forEach(([c,disabled])=>c.disabled=disabled);const approve=detail.querySelector('.approve');if(approve&&saved){approve.disabled=!reviewReady;const reason=detail.querySelector('.approval-reason');if(reason)reason.textContent=reviewReady?'':state.missingText||state.requiredOptionIds.some(id=>!state.selectedOptions[id])?'Required answers are missing':'Ready to approve after form verification'}}}));`;
  const completionStyles = `.review-empty-layout{display:grid;place-items:center;min-height:calc(100vh - 48px);padding:48px 24px}.review-complete{max-width:520px;text-align:center;padding-bottom:10vh}.review-complete h1{font-size:clamp(22px,3vw,30px);font-weight:500;line-height:1.4;margin:0 0 14px}.review-complete p{font-size:14px;line-height:1.7;color:var(--muted);margin:0 0 28px}.review-complete a{display:inline-block;font-size:14px;text-decoration:none;border-bottom:1px solid var(--line);padding:6px 0}.review-complete a:hover,.review-complete a:focus-visible{border-color:var(--ink)}`;
  return reviewShell(body, styles + completionStyles, script + choiceScript);
}

function marketSwitch(active: "us" | "china"): string {
  if (active === "us") return `<nav class="market-switch" aria-label="Applications"><a href="/status/us" aria-current="page">All applications</a></nav>`;
  return `<nav class="market-switch" aria-label="Market"><a href="/status/us">US</a><a href="/status/china" ${active === "china" ? 'aria-current="page"' : ""}>China</a></nav>`;
}

const marketSwitchStyles = `.market-switch{display:flex;gap:8px;margin-bottom:28px}.market-switch a{min-width:72px;padding:9px 18px;border:1px solid var(--line);border-radius:999px;text-align:center;text-decoration:none;color:var(--muted);font:700 11px ui-monospace,monospace;letter-spacing:.08em}.market-switch a[aria-current="page"]{background:var(--ink);border-color:var(--ink);color:var(--paper)}`;

const statusFilterScript = `const statusFilters=document.querySelectorAll('[data-status-filter]'),statusRows=document.querySelectorAll('[data-status]'),statusCount=document.querySelector('[data-status-count]'),statusCountLabel=document.querySelector('[data-status-count-label]'),statusEmpty=document.querySelector('[data-status-empty]');statusFilters.forEach(filter=>filter.addEventListener('click',()=>{const selected=filter.dataset.statusFilter;let visible=0;statusRows.forEach(row=>{const show=row.dataset.status===selected;row.hidden=!show;if(show){visible+=1;const link=row.querySelector('.row-link'),ordinal=String(visible).padStart(2,'0');if(link){link.textContent=ordinal+' ↗';link.setAttribute('aria-label',(link.getAttribute('aria-label')||'').replace(/^(Open (?:application|Boss job)) [0-9]+:/,'$1 '+ordinal+':'))}}});statusFilters.forEach(candidate=>candidate.setAttribute('aria-pressed',String(candidate===filter)));if(statusCount)statusCount.textContent=String(visible);if(statusCountLabel)statusCountLabel.textContent='shown';if(statusEmpty)statusEmpty.hidden=visible!==0}))`;

export function renderUsStatusPage(applications: readonly StatusViewItem[]): string {
  const activeApplications = applications.filter((item) => item.status !== "closed");
  const lifecycle = ["Shortlisted", "In Review", "Submitted", "Interviewing", "Offer"] as const;
  const statusLabels: Record<StatusViewStatus, string> = {
    shortlisted: "Shortlisted",
    in_review: "In Review",
    submitted: "Submitted",
    confirmed: "Submitted",
    interviewing: "Interviewing",
    offer: "Offer",
    closed: "Closed"
  };
  const rows = activeApplications.map((item, index) => {
    const href = safeHref(item.href);
    const city = compactLocation(item.location);
    const ordinal = String(index + 1).padStart(2, "0");
    return `<article class="status-row" data-status="${item.status === "confirmed" ? "submitted" : item.status}"><a class="row-link" href="${href}" target="_blank" rel="noopener noreferrer" aria-label="Open application ${ordinal}: ${escapeHtml(item.company)} — ${escapeHtml(item.title)}">${ordinal} ↗</a><div class="row-application"><div class="company-line">${escapeHtml(item.company)} · ${escapeHtml(city)}</div><div class="role">${escapeHtml(item.title)}</div></div><span class="row-category">${categoryLabel(item.category)}</span><span class="row-status">${statusLabels[item.status]}</span><time datetime="${escapeHtml(item.dateTime)}" aria-label="Updated ${escapeHtml(item.dateLabel)}">${escapeHtml(item.dateLabel)}</time></article>`;
  }).join("");
  const lifecycleLabel = lifecycle.join(" → ");
  const body = `<main class="status-page"><header class="status-head"><div><div class="kicker dark">United States lifecycle ledger</div><h1>Application status</h1></div><div class="total" aria-live="polite"><strong data-status-count>${activeApplications.length}</strong><span data-status-count-label>active</span></div></header><section class="lifecycle-guide" aria-label="Filter applications by status. Lifecycle: ${lifecycleLabel}"><div class="lifecycle-stages us-stages">${lifecycle.map((status) => `<button class="status-filter" type="button" data-status-filter="${status.toLowerCase().replace(" ", "_")}" aria-pressed="false">${status}</button>`).join("")}</div><div class="lifecycle-line" aria-hidden="true"></div></section><section class="status-list" aria-label="Tracked applications">${rows}<div class="empty filter-empty" data-status-empty hidden>No applications match this status.</div>${activeApplications.length ? "" : `<div class="empty">No active applications.</div>`}</section></main>`;
  const styles = `.status-page{padding:clamp(24px,4vw,52px);max-width:1180px;margin:auto}.status-head{display:flex;justify-content:space-between;align-items:end;padding-bottom:18px}.status-head h1{font:500 clamp(36px,5vw,62px)/.95 "Iowan Old Style",serif;letter-spacing:-.04em;margin:7px 0 0}.total{text-align:right}.total strong,.total span{display:block}.total strong{font:44px/1 "Iowan Old Style",serif}.total span{font:10px ui-monospace,monospace;text-transform:uppercase}.lifecycle-guide{overflow-x:auto;padding:14px 2px 20px}.lifecycle-stages,.lifecycle-line{min-width:650px}.lifecycle-stages{display:grid;gap:8px;text-align:center}.us-stages{grid-template-columns:repeat(5,1fr)}.status-filter{min-width:0;padding:8px 5px;border:1px solid transparent;border-radius:999px;background:transparent;color:var(--muted);font:600 10px/1.2 ui-monospace,monospace;letter-spacing:.04em;white-space:nowrap}.status-filter:hover,.status-filter:focus-visible{border-color:var(--line);color:var(--ink)}.status-filter[aria-pressed="true"]{background:var(--ink);border-color:var(--ink);color:var(--paper)}.lifecycle-line{height:1px;margin-top:10px;background:var(--line);position:relative}.lifecycle-line::after{content:"→";position:absolute;right:-1px;top:50%;padding-left:5px;background:var(--paper);color:var(--muted);font:14px/1 ui-monospace,monospace;transform:translateY(-52%)}.status-list{border-top:1px solid var(--line)}.status-row{display:grid;grid-template-columns:64px minmax(260px,1fr) 100px 112px 48px;gap:18px;align-items:center;min-height:72px;padding:12px 8px;border-bottom:1px solid var(--line)}.status-row[hidden]{display:none}.filter-empty{border-bottom:1px solid var(--line)}.row-link{align-self:stretch;display:flex;align-items:center;font:600 11px ui-monospace,monospace;text-decoration:none;color:var(--muted)}.row-link:hover,.row-link:focus-visible{color:var(--ink);text-decoration:underline;text-underline-offset:4px}.company-line{font-size:13px;font-weight:650}.role{margin-top:3px;font:17px/1.2 "Iowan Old Style",serif}.row-category,.row-status,time{font:600 10px/1.3 ui-monospace,monospace}.row-category{text-transform:uppercase;color:var(--muted)}.row-status{color:var(--ink)}time{color:var(--muted)}@media(max-width:720px){.status-page{padding:24px 18px}.status-head{align-items:start}.status-row{grid-template-columns:48px minmax(0,1fr) auto auto;gap:8px 12px;padding:14px 4px}.row-link{grid-row:1 / span 2}.row-application{grid-column:2 / -1}.row-category{grid-column:2}.row-status{grid-column:3}time{grid-column:4}}`;
  return shell("US application status", "status", body, `${marketSwitchStyles}${styles}`, statusFilterScript);
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
    return `<article class="status-row china-row" data-status="${item.status}"><a class="row-link" href="${safeHref(item.href)}" target="_blank" rel="noopener noreferrer" aria-label="Open Boss job ${ordinal}: ${escapeHtml(item.company)} — ${escapeHtml(item.title)}">${ordinal} ↗</a><div class="row-application"><div class="company-line">${escapeHtml(item.company)} · ${escapeHtml(compactLocation(item.location))}</div><div class="role">${escapeHtml(item.title)}</div><div class="recruiter">${escapeHtml(item.recruiter)}</div></div><span class="row-category">${escapeHtml(item.category)}</span><span class="row-status">${labels[item.status]}</span><time datetime="${escapeHtml(item.dateTime)}" aria-label="Updated ${escapeHtml(item.dateLabel)}">${escapeHtml(item.dateLabel)}</time></article>`;
  }).join("");
  const lifecycleLabel = lifecycle.join(" → ");
  const statusValues: readonly ChinaStatus[] = ["discovered", "ready_to_contact", "awaiting_review", "contacted", "closed"];
  const body = `<main class="status-page">${marketSwitch("china")}<header class="status-head"><div><div class="kicker dark">China initial-outreach ledger</div><h1>BOSS Zhipin status</h1></div><div class="total" aria-live="polite"><strong data-status-count>${items.length}</strong><span data-status-count-label>tracked</span></div></header><section class="lifecycle-guide" aria-label="Filter Boss jobs by status. Lifecycle: ${lifecycleLabel}"><div class="lifecycle-stages china-stages">${lifecycle.map((status, index) => `<button class="status-filter" type="button" data-status-filter="${statusValues[index]}" aria-pressed="false">${status}</button>`).join("")}</div><div class="lifecycle-line" aria-hidden="true"></div></section><section class="status-list" aria-label="Tracked Boss jobs">${rows}<div class="empty filter-empty" data-status-empty hidden>No BOSS Zhipin jobs match this status.</div>${items.length ? "" : `<div class="empty">No BOSS Zhipin jobs tracked yet.</div>`}</section></main>`;
  const styles = `.status-page{padding:clamp(24px,4vw,52px);max-width:1180px;margin:auto}.status-head{display:flex;justify-content:space-between;align-items:end;padding-bottom:18px}.status-head h1{font:500 clamp(36px,5vw,62px)/.95 "Iowan Old Style",serif;letter-spacing:-.04em;margin:7px 0 0}.total{text-align:right}.total strong,.total span{display:block}.total strong{font:44px/1 "Iowan Old Style",serif}.total span{font:10px ui-monospace,monospace;text-transform:uppercase}.lifecycle-guide{overflow-x:auto;padding:14px 2px 20px}.lifecycle-stages,.lifecycle-line{min-width:650px}.lifecycle-stages{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;color:var(--muted);font:600 10px/1.2 ui-monospace,monospace;letter-spacing:.04em;text-align:center}.lifecycle-line{height:1px;margin-top:10px;background:var(--line);position:relative}.lifecycle-line::after{content:"→";position:absolute;right:-1px;top:50%;padding-left:5px;background:var(--paper);color:var(--muted);font:14px/1 ui-monospace,monospace;transform:translateY(-52%)}.status-list{border-top:1px solid var(--line)}.status-row{display:grid;grid-template-columns:64px minmax(260px,1fr) 100px 132px 48px;gap:18px;align-items:center;min-height:80px;padding:12px 8px;border-bottom:1px solid var(--line)}.row-link{align-self:stretch;display:flex;align-items:center;font:600 11px ui-monospace,monospace;text-decoration:none;color:var(--muted)}.company-line{font-size:13px;font-weight:650}.role{margin-top:3px;font:17px/1.2 "Iowan Old Style",serif}.recruiter{margin-top:5px;color:var(--muted);font:11px ui-monospace,monospace}.row-category,.row-status,time{font:600 10px/1.3 ui-monospace,monospace}.row-category{text-transform:uppercase;color:var(--muted)}time{color:var(--muted)}.empty{padding:32px 8px;color:var(--muted)}@media(max-width:720px){.status-page{padding:24px 18px}.status-row{grid-template-columns:48px minmax(0,1fr) auto auto;gap:8px 12px}.row-link{grid-row:1 / span 2}.row-application{grid-column:2 / -1}.row-category{grid-column:2}.row-status{grid-column:3}time{grid-column:4}}`;
  return shell("China BOSS Zhipin status", "status", body, `${marketSwitchStyles}${styles}.china-stages{grid-template-columns:repeat(5,1fr)}.status-filter{min-width:0;padding:8px 5px;border:1px solid transparent;border-radius:999px;background:transparent;color:var(--muted);font:600 10px/1.2 ui-monospace,monospace;letter-spacing:.04em;white-space:nowrap}.status-filter:hover,.status-filter:focus-visible{border-color:var(--line);color:var(--ink)}.status-filter[aria-pressed="true"]{background:var(--ink);border-color:var(--ink);color:var(--paper)}.status-row[hidden]{display:none}.filter-empty{border-bottom:1px solid var(--line)}`, statusFilterScript);
}
