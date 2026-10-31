import { interviewStyles } from "../workbench/views.js";
/** Shared application workspace styling and responsive page layouts. */
export const workspaceStyles = `${interviewStyles}

html{--review-header-height:64px}
body{background:var(--paper);font-size:15px}
[hidden]{display:none!important}
button,input,textarea,select{font:inherit}
a,button,input,textarea,select{-webkit-tap-highlight-color:transparent}
a:focus-visible,button:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible{outline:2px solid var(--warn);outline-offset:3px}
:is(.review-top,.status-top){min-height:var(--review-header-height);padding:10px clamp(16px,3vw,48px);display:flex;align-items:center;justify-content:space-between;gap:12px;border-bottom:1px solid var(--line);background:var(--panel)}
:is(.review-top,.status-top)>a{font:600 21px "Iowan Old Style",Baskerville,serif;text-decoration:none;letter-spacing:-.025em}
:is(.review-top,.status-top) nav{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
:is(.review-top,.status-top) nav a{display:inline-flex;align-items:center;gap:4px;min-height:40px;padding:8px 12px;border-radius:8px;font-size:13px;color:var(--muted);text-decoration:none}
:is(.review-top,.status-top) nav a[aria-current="page"]{background:#eee8dc;color:var(--ink);font-weight:650}

@media(max-width:420px){.status-top{flex-wrap:wrap;padding:12px 16px;gap:8px}.status-top nav{width:100%;gap:6px}.status-top nav a{padding:8px 10px}}
`;

export const reviewStyles = `${workspaceStyles}
.review-layout{display:grid;grid-template-columns:clamp(220px,23vw,300px) minmax(0,1fr);gap:clamp(24px,3vw,48px);width:100%;max-width:1500px;margin:0 auto;padding:28px clamp(16px,3vw,48px);align-items:start}
.queue{position:sticky;top:24px;min-width:0;max-height:calc(100dvh - 48px - var(--application-actions-height,80px));overflow:auto;scrollbar-width:thin}
.queue-heading{display:flex;align-items:center;justify-content:space-between;padding:4px 8px 16px;font-weight:650;font-size:14px}
.queue-heading span{padding:2px 9px;background:#e7e2d7;border-radius:20px;color:var(--muted);font-size:12px}
.queue-list{display:grid;gap:8px;padding:3px}
.queue-item{display:grid;grid-template-columns:minmax(0,1fr);text-align:left;padding:15px 12px;border:1px solid transparent;border-radius:10px;background:transparent;color:inherit;min-height:72px}
.queue-item:hover{background:#eae6dc}
.queue-item[aria-pressed="true"]{border-color:#d5c6ae;background:var(--panel);box-shadow:inset 3px 0 var(--warn),0 2px 6px #26201405}
.queue-copy{min-width:0;overflow-wrap:anywhere}
.queue-item strong,.queue-item small,.queue-role{display:block}
.queue-item strong{font-size:14px;font-weight:650}
.queue-role{font-size:12px;line-height:1.45;margin-top:5px;color:#535149}
.queue-item small{font-size:11px;color:var(--muted);margin-top:6px;line-height:1.4}
.review-label{display:inline-block;margin-top:8px;font-size:11px;font-weight:650;color:#a44817}
.queue-picker,.queue-picker-label{display:none}
.detail-wrap,.detail{min-width:0;width:100%}
.detail-wrap{padding:0 0 24px}
.detail-head{display:grid;grid-template-columns:minmax(0,1fr) 210px;align-items:start;gap:28px;padding:8px 0 26px;border-bottom:1px solid var(--line)}
.detail-head>div{min-width:0}
.category{display:inline-block;font:650 11px/1.4 ui-monospace,monospace;letter-spacing:.08em;color:var(--warn);margin-bottom:10px}
.detail h1{font:500 clamp(25px,2.5vw,36px)/1.15 "Iowan Old Style",Baskerville,serif;letter-spacing:-.025em;margin:0;overflow-wrap:anywhere;text-wrap:pretty}
.detail-head p{font-size:14px;margin:12px 0 0;color:var(--muted)}
.detail-actions{display:flex;flex-direction:column;align-items:stretch;gap:10px;text-align:right}
.application-link{display:inline-flex;justify-content:flex-end;align-items:center;min-height:40px;text-decoration:none;font-size:13px;color:var(--muted)}
.application-link:hover{text-decoration:underline;text-underline-offset:4px;color:var(--ink)}
.decision-dock{display:flex;flex-direction:column;align-items:stretch;gap:9px}
.approve{min-height:44px;padding:10px 16px;border:1px solid var(--ink);border-radius:8px;background:var(--ink);color:white;font-weight:650;font-size:14px}
.approve:disabled{opacity:1;background:#e6e2d9;border-color:#ded8cd;color:#77736b}
.approval-reason{font:12px/1.5 "Avenir Next","Gill Sans",sans-serif;color:var(--muted)}
.save-status{font-size:12px;color:var(--safe);overflow-wrap:anywhere}
.save-status:empty,.approval-reason:empty{display:none}
.approved-status{color:var(--safe);font-size:13px;font-weight:650}
.approved-contents{border:0;padding:0;margin:0;min-width:0}
.judgments{margin-top:22px}
.review-item{margin:0 0 16px;padding:clamp(18px,2vw,28px);border:1px solid #ded8cb;border-radius:12px;background:var(--panel)}
.review-item h3,.short-label,.choice-list legend{font:600 15px/1.6 "Avenir Next","Gill Sans",sans-serif;color:var(--ink);overflow-wrap:anywhere}
.short-label{display:block;margin:0 0 14px}
.review-item p{white-space:pre-wrap;overflow-wrap:anywhere}
.question.missing{outline:2px solid var(--warn);outline-offset:3px}
.required-mark{color:#b42318;font:700 20px/1 "Avenir Next",sans-serif;margin-left:6px}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0}
.long-answer,.short-answer{display:block;width:100%;min-width:0;padding:14px 16px;border:1px solid #d7d1c5;border-radius:8px;background:#fff;color:var(--ink);font-size:15px;line-height:1.7;transition:border-color .15s}
.long-answer{min-height:144px;resize:vertical;field-sizing:content}
.short-answer{min-height:48px}
.long-answer:hover,.short-answer:hover{border-color:#a49b8b}
.approved-contents .long-answer,.approved-contents .short-answer{background:#f6f4ee;color:#55534c;opacity:1;-webkit-text-fill-color:#55534c}
.question-hint{font-size:12px;color:var(--muted);margin-top:10px}
.choice-list{display:grid;gap:8px;min-width:0;margin:0;padding:0;border:0}
.choice-list legend{float:left;width:100%;padding:0 0 14px;margin:0}
.choice-list legend+*{clear:both}
.choice-row{display:flex;gap:12px;align-items:flex-start;min-height:48px;padding:12px 14px;border:1px solid #ded8cb;border-radius:8px;background:#fff;cursor:pointer}
.choice-row:hover{border-color:#a49b8b}
.choice-row:has(input:checked){background:#f5efe3;border-color:#b79d74}
.choice-input{flex:none;width:18px;height:18px;margin:2px 0 0;accent-color:var(--ink)}
.choice-copy{font-size:14px;line-height:1.5;overflow-wrap:anywhere;min-width:0}
.blocker{color:var(--warn)}
@media(min-width:1600px){.review-layout{padding-top:40px}}
@media(max-width:1000px){
 .review-layout{grid-template-columns:210px minmax(0,1fr);gap:24px;padding:24px}
 .detail-head{grid-template-columns:minmax(0,1fr);gap:18px}
 .detail-actions{width:100%;max-width:320px;align-items:flex-start;text-align:left}
 .detail-actions .decision-dock{width:100%}
 .application-link{justify-content:flex-start}
}
@media(max-width:700px){
 .review-layout{display:block;padding:16px}
 .queue{position:static;max-height:none;overflow:visible;margin-bottom:24px}
 .queue-heading,.queue-list{display:none}
 .queue-picker-label{display:block;font-size:12px;color:var(--muted);margin-bottom:7px}
 .queue-picker{display:block;width:100%;max-width:100%;min-width:0;min-height:48px;padding:10px 12px;border:1px solid var(--line);border-radius:8px;background:var(--panel);color:var(--ink);font-size:14px;text-overflow:ellipsis}
 .detail-head{padding-top:0;padding-bottom:20px;gap:14px}
 .detail h1{font-size:27px;line-height:1.2}
 .detail-actions{max-width:none}
 .detail-actions .decision-dock{max-width:360px}
 .review-item{padding:18px 16px;border-radius:10px}
 .long-answer,.short-answer{padding:12px;font-size:16px}
}
@media(max-width:420px){
 html{--review-header-height:104px}
 .review-top{flex-wrap:wrap;padding:12px 16px;gap:8px}
 .review-top nav{width:100%;gap:6px}
 .review-top nav a{padding:8px 10px}
 .review-layout{padding:16px 12px}
 .detail h1{font-size:25px}
 .review-item{padding:16px 12px}
}
@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition:none!important}}
`;

export const statusStyles = `${workspaceStyles}
.status-page{width:100%;max-width:1440px;margin:0 auto;padding:32px clamp(16px,3vw,48px)}
.status-head{display:flex;justify-content:space-between;align-items:center;gap:20px;margin-bottom:24px}
.status-head h1{font:500 clamp(28px,3vw,36px)/1.2 "Iowan Old Style",Baskerville,serif;letter-spacing:-.025em;margin:0}
.total{display:flex;align-items:baseline;gap:6px;padding:6px 12px;background:#e7e2d7;border-radius:20px;white-space:nowrap;color:var(--muted)}
.total strong{font-size:15px;color:var(--ink)}.total span{font-size:12px}
.lifecycle-guide{margin-bottom:22px;overflow-x:auto;padding:4px 2px 10px;scrollbar-width:thin}
.lifecycle-stages{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;min-width:600px;text-align:center}
.status-filter{min-width:0;min-height:44px;padding:10px 12px;border:1px solid transparent;border-radius:999px;background:transparent;color:var(--muted);font:600 12px/1.4 ui-monospace,monospace;white-space:nowrap}
.status-filter:hover{background:#eae6dc;color:var(--ink)}
.status-filter[aria-pressed="true"]{background:var(--ink);color:var(--panel)}
.lifecycle-line{position:relative;min-width:600px;height:1px;margin:14px 0 4px;background:var(--line)}
.lifecycle-line::after{content:"→";position:absolute;right:0;top:50%;transform:translateY(-52%);padding-left:6px;background:var(--paper);color:var(--muted);font:16px/1 ui-monospace,monospace}
.status-list{display:grid;gap:12px}
.status-row{display:grid;grid-template-columns:64px minmax(0,1fr) 50px 148px 48px;gap:20px;align-items:center;padding:22px 24px;border:1px solid #ded8cb;border-radius:12px;background:var(--panel);min-width:0}
.status-row:has(.job-select:checked){border-color:#b79d74;background:#faf5e9;box-shadow:inset 3px 0 var(--warn)}
.row-application{min-width:0;overflow-wrap:anywhere}
.preparation-retry{margin:8px 0 0;font-size:12px;color:var(--muted)}
.company-line{font-size:13px;font-weight:600;color:var(--muted);line-height:1.5}
.role{font:500 22px/1.3 "Iowan Old Style",Baskerville,serif;margin-top:6px;color:var(--ink)}
.row-link{display:inline-flex;align-items:center;justify-content:center;min-height:44px;min-width:32px;font:12px ui-monospace,monospace;text-decoration:none;color:var(--muted)}
.row-link:hover{color:var(--ink);text-decoration:underline;text-underline-offset:4px}
.row-category{font:600 11px/1.5 ui-monospace,monospace;color:var(--warn)}
.row-status{justify-self:start;font-size:12px;line-height:1.4;font-weight:600;padding:6px 10px;border-radius:20px;background:#eee9df;color:#5c564b;overflow-wrap:anywhere;max-width:100%}
[data-status="in_review"] .row-status{background:#f6ead6;color:#865c21}
[data-status="submitted"] .row-status,[data-status="interviewing"] .row-status,[data-status="offer"] .row-status{background:#e6efe5;color:var(--safe)}
.status-row time{font-size:12px;color:var(--muted);text-align:right}
.status-list .empty{border-radius:12px;padding:40px 20px;font-size:14px}
.status-page .job-select{width:20px;height:20px;margin:0;flex:none}
@media(max-width:1000px){.status-row{grid-template-columns:64px minmax(0,1fr) 120px;gap:10px 16px;padding:18px 20px}.row-selection{grid-column:1;grid-row:1 / span 2}.row-application{grid-column:2;grid-row:1 / span 2}.row-status{grid-column:3;grid-row:1}.row-category{grid-column:2;grid-row:3}.status-row time{grid-column:3;grid-row:3;text-align:left}}
@media(max-width:700px){.status-page{padding:24px 16px}.status-head{gap:12px;margin-bottom:18px}.status-head h1{font-size:29px}.status-filter{padding:10px 12px;font-size:12px}.status-row{grid-template-columns:48px minmax(0,1fr) auto;padding:16px;gap:8px 12px}.row-selection{grid-column:1;grid-row:1;flex-wrap:wrap;justify-content:center}.row-application{grid-column:2 / -1;grid-row:1}.row-category{grid-column:2;grid-row:2}.row-status{grid-column:2;grid-row:3}.status-row time{grid-column:3;grid-row:3}.role{font-size:21px}.company-line{font-size:12px}}
@media(max-width:420px){.status-page{padding:22px 12px}.status-head h1{font-size:27px}.status-row{padding:14px 12px;gap:8px}.total{padding:5px 9px}.total span{font-size:11px}}
`;
