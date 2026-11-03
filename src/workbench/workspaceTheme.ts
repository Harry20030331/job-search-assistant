/** Extend the reviewed Status visual language to the remaining product surfaces. */
export const workspaceTheme = `
body:not(.welcome-shell):not(.status-workspace){--rail:208px;--content-pad:clamp(28px,4vw,64px);--paper:#fafbfc;--panel:#fff;--ink:#202020;--muted:#202020;--green:#202020;--line:#e4e9ee;--soft:#f3f5f7;--safe:#202020;--warn:#202020;background:#fafbfc;color:#202020;font:500 15px/1.65 var(--font)}
body:not(.welcome-shell):not(.status-workspace)>:is(.workspace-top,.review-top,.status-top){width:var(--rail);background:#eff1f3;border-right:1px solid #e0e4e8;padding:30px 16px 24px;gap:0}
body:not(.welcome-shell):not(.status-workspace)>header>.workspace-brand{color:#202020;font-size:16px;gap:8px;padding:0 5px 48px}
body:not(.welcome-shell):not(.status-workspace)>header nav{gap:8px}
body:not(.welcome-shell):not(.status-workspace)>header nav a{color:#202020;font:550 14px/1.4 var(--font);padding:12px 14px;border-radius:8px;gap:12px}
body:not(.welcome-shell):not(.status-workspace)>header nav a:hover{background:#f5f7fa;color:#202020}
body:not(.welcome-shell):not(.status-workspace)>header nav a[aria-current=page]{background:#fff;border-color:#e1e6eb;color:#202020;box-shadow:none;font-weight:600}
body:not(.welcome-shell):not(.status-workspace)>main{max-width:1512px;padding:48px var(--content-pad) 104px}
body:not(.welcome-shell):not(.status-workspace)>main>h1,body:not(.status-workspace) .hero h1{font:650 clamp(32px,3vw,42px)/1.15 var(--font);letter-spacing:-.045em;color:#202020;margin:0 0 32px}
body:not(.welcome-shell):not(.status-workspace) :is(.eyebrow,.intro,.note,.meta,.status,.save-message,.support,.category,.row-category,.permission span,.detail-meta,.company,.pill,.card-link,.section-no,.section-title>span,.list-empty,.preparation-retry){color:#202020}
body:not(.status-workspace) :is(.primary,.workflow-primary,.approve,.plan-action button,.primary-link){font:650 15px/1.5 var(--font);color:#202020;min-height:44px;padding:11px 18px;border-radius:8px}
body:not(.status-workspace) :is(.quiet-button,.reopen-content){font:550 14px/1.5 var(--font);color:#202020;min-height:44px;padding:10px 14px;border-color:#dde3e8}
body:not(.status-workspace) button:disabled,body:not(.status-workspace) .workflow-primary:disabled,body:not(.status-workspace) .approve:disabled{color:#7d858e;background:#edf0f3;border-color:#e0e5e9;box-shadow:none}
body:not(.welcome-shell):not(.status-workspace) .workflow-actions{background:#fffffff5;border-color:#e6ebf0}
body:not(.welcome-shell):not(.status-workspace) .search-refresh{display:flex;flex-direction:row;align-items:center;gap:24px;background:#fff0df;border:1px solid #f2d3b2;border-radius:10px;margin:0 0 28px;padding:18px 20px;box-shadow:none}
body:not(.welcome-shell):not(.status-workspace) .search-refresh-copy{display:grid;gap:6px;min-width:0}
body:not(.welcome-shell):not(.status-workspace) .search-refresh p{font:550 15px/1.65 var(--font);margin:0;color:#202020}
body:not(.welcome-shell):not(.status-workspace) .search-refresh #search-last-updated{font-size:16px;font-weight:650}
body:not(.welcome-shell):not(.status-workspace) .search-refresh #search-refresh-message{font-size:15px;font-weight:550;color:#202020}
body:not(.welcome-shell):not(.status-workspace) .search-refresh button{font:650 15px/1.5 var(--font);background:#fff;border-color:#dfe6ed;border-radius:7px;min-height:40px;padding:8px 13px;align-self:center}
/* Profile and account: readable forms on a consistent white work surface. */
body:not(.welcome-shell) .editor{max-width:940px}
body:not(.welcome-shell) .editor fieldset{padding:30px;margin:0 0 32px;border-color:#e4e9ee;border-radius:12px;box-shadow:0 4px 20px #00000002}
body:not(.welcome-shell) .editor legend{font:650 18px/1.5 var(--font);color:#202020;padding:0 8px}
body:not(.welcome-shell) .editor label{font:550 15px/1.6 var(--font);color:#202020;margin:18px 0}
body:not(.welcome-shell) .editor :is(input:not([type=checkbox]),textarea,select){font:500 16px/1.75 var(--font);color:#202020;border-color:#dce2e8;background:#fff;padding:12px 14px;border-radius:7px}
body:not(.welcome-shell) .editor h2{font:600 18px/1.5 var(--font);color:#202020;margin:28px 0 12px}
body:not(.welcome-shell) .editor :is(p,li,.preference-hint){font:500 15px/1.75 var(--font);color:#202020}
body:not(.welcome-shell) .editor .preference-group h2{margin-top:0}
body:not(.welcome-shell) .editor .flexible-choice{font-weight:550}
body:not(.welcome-shell) .editor input[type=checkbox]{accent-color:#202020}
body:not(.welcome-shell) .account-panel{max-width:900px;padding:30px;border-color:#e4e9ee;border-radius:12px;box-shadow:0 4px 20px #00000002}
body:not(.welcome-shell) .account-panel h2{font:600 22px/1.4 var(--font);color:#202020;margin:8px 0 16px}
body:not(.welcome-shell) .account-panel p,body:not(.welcome-shell) .permission{font:500 15px/1.75 var(--font);color:#202020}
body:not(.welcome-shell) .account-panel .status{font:600 13px/1.5 var(--font);color:#202020}
body:not(.welcome-shell) .permission{padding:20px 0;border-color:#e9edf1}
body:not(.welcome-shell) .connection-error{background:#fff0df;border:1px solid #f2d3b2;border-radius:8px;padding:14px 16px;color:#202020!important;font-size:15px}
body:not(.welcome-shell) .account-panel .small-note{font-size:14px!important;color:#202020;line-height:1.8}
/* Review: keep the queue and exact approval controls, match Status hierarchy. */
body:not(.welcome-shell) .review-layout{grid-template-columns:220px minmax(0,1fr);gap:28px;align-items:start}
body:not(.welcome-shell) .queue-heading{font:600 18px/1.5 var(--font);padding:0 8px 22px;color:#202020}
body:not(.welcome-shell) .queue-heading span{font-size:13px;color:#202020;background:#eff1f3}
body:not(.welcome-shell) .queue-item{padding:18px 14px;color:#202020;border-radius:9px}
body:not(.welcome-shell) .queue-item[aria-pressed=true]{border-color:#e0e5eb;background:#fff;box-shadow:inset 3px 0 #ee9148}
body:not(.welcome-shell) .queue-item:hover{background:#f0f2f5}
body:not(.welcome-shell) .queue-item strong{font-size:15px;font-weight:600;line-height:1.5;color:#202020}
body:not(.welcome-shell) .queue-role{font-size:14px;line-height:1.65;color:#202020}
body:not(.welcome-shell) .queue-item small{font-size:12px;line-height:1.6;color:#202020}
body:not(.welcome-shell) .detail-wrap{padding:30px;background:#fff;border-color:#e4e9ee;border-radius:12px;box-shadow:0 4px 20px #00000002}
body:not(.welcome-shell) .detail h1{font:650 clamp(26px,2.5vw,34px)/1.25 var(--font);color:#202020;letter-spacing:-.035em}
body:not(.welcome-shell) .category{background:#f0f3f6;color:#202020;font-size:12px;font-weight:550}
body:not(.welcome-shell) .detail-head p{font-size:14px;line-height:1.7;color:#202020}
body:not(.welcome-shell) .application-link{font:550 14px/1.6 var(--font);color:#202020}
body:not(.welcome-shell) .review-item{padding:26px 0}
body:not(.welcome-shell) :is(.short-label,.choice-list legend,.review-item h3){font:600 16px/1.7 var(--font);color:#202020}
body:not(.welcome-shell) :is(.long-answer,.short-answer){font:500 16px/1.8 var(--font);color:#202020;padding:13px 14px;border-color:#dce2e8}
body:not(.welcome-shell) .choice-copy{font:500 15px/1.7 var(--font);color:#202020}
body:not(.welcome-shell) .choice-row{border-color:#e0e5e9;padding:14px}
body:not(.welcome-shell) .choice-row:has(input:checked){background:#fff7ed;border-color:#e7bb91}
body:not(.welcome-shell) :is(.approval-reason,.save-status,.optional-hint){font-size:13px;line-height:1.7;color:#202020}
body:not(.welcome-shell) .review-label{color:#202020;font-size:12px}
/* Interview: the same queue, neutral typography and restrained orange selection. */
body:not(.welcome-shell) .hero{padding:0 0 32px;align-items:center}
body:not(.welcome-shell) .hero h1{margin:0 0 12px}
body:not(.welcome-shell) .hero p{font-size:15px;line-height:1.7;color:#202020}
body:not(.welcome-shell) .hero-count strong{font:500 36px/1 var(--font);color:#b75918}
body:not(.welcome-shell) .hero-count span{font-size:13px;color:#202020}
body:not(.welcome-shell) .workspace{grid-template-columns:220px minmax(0,1fr);gap:28px}
body:not(.welcome-shell) .list-heading h2{font-size:18px;font-weight:600;color:#202020}
body:not(.welcome-shell) .list-heading>span{font-size:13px;color:#202020}
body:not(.welcome-shell) .filters{background:transparent;border-radius:0;padding:0;gap:8px;margin-bottom:22px}
body:not(.welcome-shell) .filters a{font:550 13px/1.5 var(--font);color:#202020;border:0;border-radius:0;background:transparent;min-height:44px;padding:10px 6px}
body:not(.welcome-shell) .filters a[aria-current=page]{background:transparent;color:#202020;box-shadow:inset 0 -2px #ee9148;font-weight:600}
body:not(.welcome-shell) .interview-card{padding:18px 14px}
body:not(.welcome-shell) .interview-card[aria-current]{background:#fff;border-color:#e0e5eb;box-shadow:inset 3px 0 #ee9148}
body:not(.welcome-shell) .interview-card .company{font-size:15px;font-weight:600;color:#202020}
body:not(.welcome-shell) .interview-card h3{font:500 14px/1.65 var(--font);color:#202020}
body:not(.welcome-shell) .interview-card p{font-size:12px;line-height:1.7;color:#202020}
body:not(.welcome-shell) .pill{font:550 12px/1.5 var(--font);color:#202020;background:#f0f3f6;padding:4px 8px}
body:not(.welcome-shell) .workspace>.detail{background:#fff;border-color:#e4e9ee;border-radius:12px;padding:30px;box-shadow:0 4px 20px #00000002}
body:not(.welcome-shell) .workspace .role-heading{font:650 clamp(26px,2.5vw,34px)/1.25 var(--font);color:#202020}
body:not(.welcome-shell) .detail-meta{font-size:13px;line-height:1.7;color:#202020}
body:not(.welcome-shell) .detail-tabs a{font:550 14px/1.6 var(--font);color:#202020;min-height:48px}
body:not(.welcome-shell) .detail-tabs a[aria-current]{border-color:#ee9148;color:#202020;font-weight:600}
body:not(.welcome-shell) :is(.detail-body h2,.panel h2){font:600 21px/1.5 var(--font);color:#202020}
body:not(.welcome-shell) :is(.support,.facts,.facts>div){font:500 15px/1.8 var(--font);color:#202020}
body:not(.welcome-shell) .facts dt{color:#202020}
body:not(.welcome-shell) .section-title h3{font-size:18px;font-weight:600;color:#202020}
body:not(.welcome-shell) :is(.simulation p,.simulation li){font:500 15px/1.8 var(--font);color:#202020}
body:not(.welcome-shell) .simulation code{font:500 14px/1.75 var(--font);color:#202020}
body:not(.welcome-shell) .plan-action{background:#fff0df;border-color:#f2d3b2;border-radius:10px;padding:22px}
body:not(.welcome-shell) :is(.plan-action p,.provenance p,.demo-note){font:500 14px/1.75 var(--font);color:#202020}
body:not(.welcome-shell) .demo-note{text-transform:none;letter-spacing:0;padding:0 0 18px}
body:not(.welcome-shell) .detail-body summary{font-size:14px;color:#202020}
/* First-use setup keeps its centered layout and shares the same readable type. */
body.welcome-shell{background:#fafbfc;color:#202020;font-weight:500}
body.welcome-shell>header{background:#eff1f3;border-color:#e0e4e8}
body.welcome-shell>header>.workspace-brand{color:#202020;font-size:16px}
body.welcome-shell .intake-shell h1{font-size:40px;font-weight:650;color:#202020}
body.welcome-shell .intake-shell h2{font-size:26px;font-weight:600;color:#202020}
body.welcome-shell .intake-shell :is(label,.field-hint,.profile-summary,.intake-error){font-size:15px;color:#202020;line-height:1.75}
body.welcome-shell .intake-shell :is(input:not([type=checkbox]):not([type=file]),textarea){font:500 16px/1.75 var(--font);color:#202020}
@media(max-width:1120px) and (min-width:901px){body:not(.welcome-shell) :is(.review-layout,.workspace){grid-template-columns:190px minmax(0,1fr);gap:22px}body:not(.welcome-shell) :is(.detail-wrap,.workspace>.detail){padding:24px}}
@media(max-width:900px){
 body:not(.welcome-shell):not(.status-workspace){--rail:0px;--content-pad:28px;padding-left:0}
 body:not(.welcome-shell):not(.status-workspace)>:is(.workspace-top,.review-top,.status-top){position:static;width:100%;min-height:0;padding:22px 28px 0;border-right:0;border-bottom:1px solid #e0e4e8}
 body:not(.welcome-shell):not(.status-workspace)>header>.workspace-brand{padding:0 0 20px}
 body:not(.welcome-shell):not(.status-workspace)>header nav{flex-direction:row;gap:6px;overflow-x:auto;padding-bottom:12px}
 body:not(.welcome-shell):not(.status-workspace)>header nav a{min-height:40px;padding:9px 12px;font-size:13px}
 body:not(.welcome-shell):not(.status-workspace)>main{padding:38px 28px 100px}
 body:not(.welcome-shell):not(.status-workspace) .workflow-actions{left:0}
}
@media(max-width:700px){
 body:not(.welcome-shell) :is(.review-layout,.workspace){display:block}
 body:not(.welcome-shell) :is(.detail-wrap,.workspace>.detail){padding:24px 20px}
 body:not(.welcome-shell) .queue{margin-bottom:24px}
 body:not(.welcome-shell) .queue-picker{font:500 16px/1.6 var(--font);color:#202020;border-color:#dce2e8}
 body:not(.welcome-shell) .queue-picker-label{font:550 14px/1.5 var(--font);color:#202020}
 body:not(.welcome-shell) .interview-card{background:#fff;border-color:#e4e9ee}
 body:not(.welcome-shell) .editor fieldset,body:not(.welcome-shell) .account-panel{padding:24px 20px}
 body:not(.welcome-shell) .hero{align-items:flex-start;gap:24px}
 body:not(.welcome-shell) .hero-count strong{font-size:30px}
}
@media(max-width:520px){
 body:not(.welcome-shell):not(.status-workspace){--content-pad:20px}
 body:not(.welcome-shell):not(.status-workspace)>:is(.workspace-top,.review-top,.status-top){padding:22px 20px 0}
 body:not(.welcome-shell):not(.status-workspace)>main{padding:32px 20px 100px}
 body:not(.welcome-shell):not(.status-workspace)>main>h1,body:not(.status-workspace) .hero h1{font-size:36px}
 body:not(.welcome-shell):not(.status-workspace) .search-refresh{gap:12px;align-items:flex-start}
 body:not(.welcome-shell):not(.status-workspace) .search-refresh button{padding:10px 12px;align-self:flex-start;white-space:nowrap}
 body:not(.welcome-shell) .facts>div{grid-template-columns:1fr;gap:5px}
 body:not(.welcome-shell) .section-title{flex-wrap:wrap;gap:8px}
 body.welcome-shell .intake-shell h1{font-size:36px}
}
/* Two primary destinations; task pages retain their place inside Status. */
.task-context{display:flex;align-items:center;flex-wrap:wrap;gap:12px;margin:0 0 28px;font:550 14px/1.6 var(--font);color:#202020}
.task-context a{display:inline-flex;align-items:center;gap:8px;min-height:44px;text-decoration:none;color:#202020}
.task-context a:hover{text-decoration:underline;text-underline-offset:4px}
body .review-layout>.task-context{grid-column:1 / -1;margin:0}
.page-heading{display:flex;align-items:center;justify-content:space-between;gap:24px;max-width:940px;margin:0 0 32px}
body .page-heading h1{font:650 clamp(32px,3vw,42px)/1.15 var(--font);letter-spacing:-.045em;margin:0;color:#202020}
.settings-link{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:10px 14px;border:1px solid #dce2e8;border-radius:8px;background:#fff;color:#202020;text-decoration:none;font:550 14px/1.5 var(--font);white-space:nowrap}
.settings-link:hover{background:#f3f5f7}
.row-task-link{display:inline-flex;align-items:center;gap:5px;min-height:40px;margin-top:4px;font:600 14px/1.6 var(--font);color:#202020;text-decoration:none}
.row-task-link:hover{text-decoration:underline;text-underline-offset:3px}
body.status-workspace .status-overview dd{display:flex;align-items:center;min-height:44px}
body.status-workspace .overview-task-link{display:inline-flex;align-items:center;min-height:44px;color:inherit;text-decoration:underline;text-decoration-color:#edc9a8;text-decoration-thickness:2px;text-underline-offset:8px}
body.status-workspace .overview-task-link:hover{text-decoration-color:#ee9148}
.stage-task-link{display:inline-flex;align-items:center;gap:8px;margin-left:auto;min-height:44px;padding:8px 12px;font:600 13px/1.5 var(--font);text-decoration:none;color:#202020;background:#fff0df;border:1px solid #f2d3b2;border-radius:7px}
.stage-task-link:hover{background:#ffe7cc}
body.status-workspace .pipeline-heading{flex-wrap:wrap}
@media(max-width:700px){body .review-layout>.task-context{margin-bottom:22px}.page-heading{flex-wrap:wrap;gap:16px}.task-context{margin-bottom:22px}body .page-heading h1{font-size:36px}.stage-task-link{margin-left:0}.row-task-link{font-size:13px}}
`;
