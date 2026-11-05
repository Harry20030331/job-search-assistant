import { page } from "./views.js";
import type { readProfileEditor } from "./profileStore.js";
export const editorStyles = `<style>body{-webkit-font-smoothing:antialiased}h1{text-wrap:balance}.editor{max-width:850px}.editor fieldset{border:0;padding:24px;background:#ffffff;border-radius:12px;margin:28px 0;border:1px solid #e5e5e5}.editor legend{font:550 16px Inter,Arial,sans-serif;padding:0 8px}.editor label{display:block;font-size:15px;margin:14px 0}.editor input:not([type=checkbox]),.editor textarea,.editor select{display:block;width:100%;margin-top:6px;padding:11px;border:1px solid #d4d4d4;border-radius:6px;background:#ffffff;color:#171717;font:14px/1.6 Inter,Arial,sans-serif;min-height:44px}.editor textarea{min-height:100px;resize:vertical}.editor input[type=checkbox]{min-width:20px;min-height:20px;vertical-align:middle}.editor button{min-height:44px}.editor :focus-visible{outline:2px solid #171717;outline-offset:3px}.entry{border-top:1px solid #e5e5e5;padding-top:10px;margin-top:16px}.editor button:disabled{opacity:.5}.editor .inline{display:flex;gap:20px;flex-wrap:wrap}.save-message{padding:12px 0;min-height:44px;white-space:pre-wrap}.save-message:empty{display:none}.preference-group{margin:24px 0;padding-bottom:22px;border-bottom:1px solid #e5e5e5}.preference-group h2{font:600 16px/1.5 Inter,Arial,sans-serif;margin:0 0 12px;color:#202020}.editor .flexible-choice{display:flex;align-items:center;gap:10px;min-height:44px;color:#202020;font-weight:550}.preference-hint{font:14px/1.7 Inter,Arial,sans-serif;color:#404040;margin:8px 0}.editor label[hidden]{display:none}
.editor .profile-contact,.editor #education .entry{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,190px),1fr));gap:0 16px}
.editor :is(#preferences-form,[data-preference-index]) textarea{field-sizing:content;min-height:6rem}
.editor :is(#preferences-form,[data-preference-index]) :is(textarea[name="feedback"],textarea[name="content"]){min-height:12rem}

.editor #job-selection-notes{field-sizing:content;min-height:12rem}
</style>`;
const field = (name: string, title: string, type = "text", required = false) => `<label>${title}<input name="${name}" type="${type}" ${required ? "required" : ""}></label>`;
export function renderProfilePage(data: Awaited<ReturnType<typeof readProfileEditor>>, example = false) {
  const settings = example ? "" : '<a class="settings-link" href="/settings/accounts">Settings <span aria-hidden="true">↗</span></a>';
  const savePreferences = example ? "" : '<button class="primary">Save preferences</button><p class="save-message" role="status"></p>';
  const body = `<div class="page-heading"><h1>Profile & Preferences</h1>${settings}</div><div class="editor">

  <form id="profile-form"><fieldset><legend>Personal information</legend><div class="profile-contact">${field("fullName", "Full name", "text", true)}${field("email", "Email", "email")}${field("phone", "Phone")}</div>
  <h2>Education</h2><div id="education"></div><button type="button" class="quiet-button" id="add-education">Add education</button>
  <h2>Background & skills</h2>
  <label>Background summary<textarea name="summary" required maxlength="16000"></textarea></label><label>Skills (one per line)<textarea name="skills" required></textarea></label>
  <h2>Experience</h2><div id="experiences"></div><button type="button" class="quiet-button" id="add-experience">Add experience</button>
  ${example ? "" : '<label><input type="checkbox" name="confirmed" required> I confirm these are my facts and want to save them.</label><button class="primary">Save profile</button><p class="save-message" role="status"></p>'}</fieldset></form>
  <form id="preferences-form"><fieldset><legend>Search preferences</legend><div class="preference-group"><h2>Job direction</h2><label class="flexible-choice"><input type="checkbox" name="flexibleDirection"> I’m flexible — match roles to my background</label><label>Preferred directions<textarea name="directions" placeholder="e.g. Engineering, product, or research"></textarea></label><p class="preference-hint">No job titles needed. Jev evaluates roles against your background.</p></div><div class="preference-group"><h2>Location</h2><label class="flexible-choice"><input type="checkbox" name="flexibleLocation"> I’m flexible about location</label><label>Preferred locations<textarea name="locations" placeholder="e.g. San Francisco, New York"></textarea></label></div><div class="inline">${["remote", "hybrid", "onsite"].map(mode => `<label><input type="checkbox" name="workModes" value="${mode}"> ${mode.charAt(0).toUpperCase() + mode.slice(1)}</label>`).join("")}</div>${example ? "" : '<button class="primary">Save filters</button><p class="save-message" role="status"></p>'}</fieldset></form>
  <section><fieldset><legend>Job selection preferences</legend><textarea id="job-selection-notes" aria-label="Job selection preferences" rows="7" maxlength="20000"></textarea>${example ? "" : '<p id="notes-status" role="status" aria-live="polite"></p>'}</fieldset></section>
  ${data.documents ? ["Application answer preferences", "Interview preparation preferences"].map((label, i) => `<form data-preference-index="${i}"><fieldset><legend>${label}</legend><label>Current preferences<textarea name="content" rows="7" maxlength="20000"></textarea></label>${savePreferences}</fieldset></form>`).join("") : ""}
  <form id="resume-form"><fieldset><legend>Approved resumes</legend>${example ? '<ul id="resume-list"></ul>' : `<p>Applications require an approved PDF. Add as many versions as you need. Matching chooses a resume for each role.</p><ul id="resume-list"></ul>${field("category", "Resume name (e.g. product_management)", "text", true)}<label>PDF resume (up to 10 MB)<input type="file" name="resume" accept=".pdf,application/pdf" required></label><label><input type="checkbox" name="approved" required> I approve this exact PDF for the resume name above.</label><button class="primary">Add approved resume</button><p class="save-message" role="status"></p>`}</fieldset></form>
  <section data-search-refresh-placeholder></section></div>`;
  const script = `let state=${JSON.stringify(data).replaceAll("<", "\\u003c")};
const profile=document.getElementById('profile-form'),preferences=document.getElementById('preferences-form'),resume=document.getElementById('resume-form');
const lines=value=>value.split('\\n').map(s=>s.trim()).filter(Boolean);
function entries(kind,values){const container=document.getElementById(kind);for(const value of values){const row=document.createElement('div');row.className='entry';const keys=kind==='education'?['institution','degree','field']:['employer','title','description'];for(const key of keys){const label=document.createElement('label');label.textContent=key==='institution'?'School or university':key[0].toUpperCase()+key.slice(1);const input=document.createElement(key==='description'?'textarea':'input');input.dataset.key=key;input.value=typeof value[key]==='string'?value[key]:(key==='employer'?value.company||'':'');label.append(input);row.append(label)}container.append(row)}}
const c=state.candidate;for(const key of ['fullName','email','phone','summary','skills'])profile.elements[key].value=key==='fullName'?c.identity?.fullName||'':key==='skills'?(c.skills||[]).join('\\n'):key==='summary'?c.summary||'':c.contact?.[key]||'';
entries('education',c.education||[]);entries('experiences',c.experiences||[]);
document.getElementById('add-education').onclick=()=>entries('education',[{}]);document.getElementById('add-experience').onclick=()=>entries('experiences',[{}]);
if(!state.editable){for(const e of profile.elements)e.disabled=true;profile.querySelector('.save-message').textContent='This profile uses linked shared sources. Edit those owning sources in Codex; this page preserves them.'}
const policy=state.policy?.rules;preferences.elements.directions.value=(policy?.categories||[]).join('\\n');preferences.elements.locations.value=(policy?.locations||[]).join('\\n');for(const e of preferences.querySelectorAll('[name=workModes]'))e.checked=(policy?.workModes||['remote','hybrid','onsite']).includes(e.value);
preferences.elements.flexibleDirection.checked=!policy||policy.categories.length===0;preferences.elements.flexibleLocation.checked=!policy||policy.locations.length===0;
function syncFlexibility(){for(const [toggle,field] of [['flexibleDirection','directions'],['flexibleLocation','locations']]){const flexible=preferences.elements[toggle].checked;preferences.elements[field].disabled=flexible;preferences.elements[field].required=!flexible;preferences.elements[field].closest('label').hidden=flexible}}
preferences.elements.flexibleDirection.addEventListener('change',syncFlexibility);preferences.elements.flexibleLocation.addEventListener('change',syncFlexibility);syncFlexibility();
const notes=document.getElementById('job-selection-notes');
notes.value=state.searchNotes.content;
function resumes(){const list=document.getElementById('resume-list');list.replaceChildren();for(const r of state.manifest){const li=document.createElement('li');li.textContent=r.category+' — approved PDF';list.append(li)}if(!state.manifest.length){const li=document.createElement('li');li.textContent='No approved resume yet. You can still search.';list.append(li)}}resumes();
for(const form of document.querySelectorAll('[data-preference-index]')) form.elements.content.value=state.documents[Number(form.dataset.preferenceIndex)].content;
`;
  const saveScript = example ? `for(const form of document.querySelectorAll('.editor form')) form.addEventListener('submit',event=>event.preventDefault());` : `
const errors={preference_direction_required:'Enter a preferred direction or select I’m flexible.',preference_location_required:'Enter a preferred location or select I’m flexible.',preference_work_mode_required:'Choose at least one work arrangement: Remote, Hybrid or Onsite.',preference_feedback_too_long:'Keep additional preferences within 20,000 characters.',profile_changed:'Your profile changed in another window. Reload and review before saving.',matching_context_changed:'Your inputs changed. Reload and review before saving.',resume_profile_exists:'That resume profile already exists. Choose a new key.',invalid_resume:'Choose a PDF no larger than 10 MB.',runner_unavailable:'Codex is disconnected. Restart this website from your project chat with Start.'};
async function post(url,body){const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw Error(errors[d.error]||'Could not save. Check the fields and try again.');return d}
const notesStatus=document.getElementById('notes-status');
let savedNotes=notes.value, notesRevision=state.searchNotes.revision, savingNotes=false;
async function persistNotes(){
  if(savingNotes)return;
  savingNotes=true;
  try {
    while(notes.value!==savedNotes){
      const content=notes.value;
      notesStatus.textContent='Saving…';
      const next=await post('/api/preferences',{document:'job-selection',revision:notesRevision,content});
      if(next.searchNotes.content!==content)throw Error(errors.profile_changed);
      state=next;notesRevision=next.searchNotes.revision;savedNotes=content;
    }
    notesStatus.textContent='Saved';
  } catch(error){notesStatus.textContent=error.message;}
  finally{savingNotes=false}
}
notes.addEventListener('input',persistNotes);
async function save(form,fn){const button=form.querySelector('button.primary'),message=form.querySelector('.save-message');button.disabled=true;message.textContent='Saving…';try{state=await fn();if(notes.value===savedNotes && !savingNotes && state.searchNotes.content===savedNotes)notesRevision=state.searchNotes.revision;resumes();form.dataset.dirty='false';message.textContent=form.hasAttribute('data-preference-index')?'Saved.':'Saved. Run a new search to update matches.'}catch(e){message.textContent=e.message}finally{button.disabled=false}}
profile.onsubmit=e=>{e.preventDefault();save(profile,()=>post('/api/profile',{revision:state.profileRevision,confirmed:profile.elements.confirmed.checked,fields:{fullName:profile.elements.fullName.value,email:profile.elements.email.value,phone:profile.elements.phone.value,summary:profile.elements.summary.value,skills:lines(profile.elements.skills.value),...Object.fromEntries(['education','experiences'].map(kind=>[kind,[...document.getElementById(kind).children].map(row=>Object.fromEntries([...row.querySelectorAll('[data-key]')].map(e=>[e.dataset.key,e.value])))]))}}))};
preferences.onsubmit=e=>{e.preventDefault();save(preferences,()=>post('/api/preferences',{token:state.token,directions:preferences.elements.flexibleDirection.checked?[]:lines(preferences.elements.directions.value),flexibleDirection:preferences.elements.flexibleDirection.checked,locations:preferences.elements.flexibleLocation.checked?[]:lines(preferences.elements.locations.value),flexibleLocation:preferences.elements.flexibleLocation.checked,workModes:[...preferences.querySelectorAll('[name=workModes]:checked')].map(e=>e.value)}))};
for(const form of document.querySelectorAll('[data-preference-index]')){
  const index=Number(form.dataset.preferenceIndex),initial=state.documents[index];
  let revision=initial.revision;
  form.onsubmit=e=>{e.preventDefault();save(form,async()=>{const next=await post('/api/preferences',{document:['application','interview'][index],revision,content:form.elements.content.value});revision=next.documents[index].revision;return next})}
}
resume.onsubmit=e=>{e.preventDefault();save(resume,async()=>{const file=resume.elements.resume.files[0];if(!file||file.size>10000000)throw Error(errors.invalid_resume);const base64=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result.split(',')[1]);r.onerror=reject;r.readAsDataURL(file)});return post('/api/resumes',{token:state.token,category:resume.elements.category.value,filename:file.name,base64,approved:resume.elements.approved.checked})})};
for(const form of document.querySelectorAll('form')){form.addEventListener('input',()=>form.dataset.dirty='true');const message=form.querySelector('.save-message');new MutationObserver(()=>{if(message.textContent.startsWith('Saved.'))form.dataset.dirty='false'}).observe(message,{childList:true})}
window.addEventListener('beforeunload',e=>{if(savingNotes || notes.value!==savedNotes || [...document.querySelectorAll('form')].some(f=>f.dataset.dirty==='true')){e.preventDefault();e.returnValue=''}});`;
  return page("Profile & Preferences", "profile", body, script + saveScript, example).replace("</head>", editorStyles + "</head>");
}
