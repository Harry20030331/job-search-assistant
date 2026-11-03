import { workspaceTheme } from "./workspaceTheme.js";
/** Shared visual language: quiet navigation, readable work surfaces, deliberate actions. */
export const designSystem = `
@font-face{font-family:Inter;src:url('/assets/InterVariable.woff2') format('woff2');font-weight:100 900;font-style:normal;font-display:swap}
:root{--font:Inter,Arial,sans-serif;--paper:#fafafa;--panel:#fff;--ink:#171717;--muted:#666;--line:#e5e5e5;--green:#171717;--soft:#f3f3f3;--safe:#236340;--warn:#8a571c;--accent-0:#171717;--accent-1:#737373;--accent-2:#a3a3a3;--accent-3:#d4d4d4;--rail:224px;--content-pad:clamp(24px,3.5vw,56px);--review-header-height:0px}
*{box-sizing:border-box}html{-webkit-font-smoothing:antialiased;font-variant-numeric:tabular-nums;scroll-padding-bottom:100px}
body{margin:0;padding-left:var(--rail);background:var(--paper);color:var(--ink);font:14px/1.6 var(--font)}
button,input,textarea,select{font-family:var(--font)}a{color:inherit}h1,h2,h3,h4,legend{font-family:var(--font);text-wrap:balance}h1{font-weight:600;letter-spacing:-.045em}p{text-wrap:pretty}
button,summary,a{touch-action:manipulation}button{cursor:pointer}button:disabled{cursor:default}input[type=checkbox],input[type=radio]{accent-color:var(--ink)}
:is(a,button,input,textarea,select,summary):focus-visible{outline:2px solid #171717;outline-offset:4px}
button,a,input,textarea,select{transition:background-color .16s,border-color .16s,color .16s,box-shadow .16s,transform .12s}
button:not(:disabled):active{transform:scale(.96)}[hidden]{display:none!important}summary{min-height:40px;align-content:center}
.skip-link{position:fixed;left:240px;top:-80px;z-index:100;background:#171717;color:#fff;padding:10px 18px;border-radius:8px}.skip-link:focus{top:12px}
body> :is(.workspace-top,.status-top,.review-top){position:fixed;inset:0 auto 0 0;z-index:30;width:var(--rail);min-height:100dvh;padding:32px 16px 24px;display:flex;flex-direction:column;align-items:stretch;justify-content:flex-start;gap:0;background:#f5f5f5;border:0;border-right:1px solid var(--line)}
body>header>.workspace-brand{display:flex;flex-direction:column;align-items:flex-start;gap:14px;padding:0 12px 32px;white-space:normal;font:600 15px/1.4 var(--font);letter-spacing:-.035em;text-decoration:none;max-width:180px}
body .workspace-brand .brand-mark{display:grid;place-items:center;width:36px;height:36px;background:#171717;color:#fff;border-radius:10px}
.nav-caption{padding:0 12px 12px;font-size:11px;color:#737373}
body>:is(.workspace-top,.status-top,.review-top) nav{display:flex;flex-direction:column;align-items:stretch;flex-wrap:nowrap;gap:5px;overflow:visible;max-width:none}
body>:is(.workspace-top,.status-top,.review-top) nav a{display:flex;align-items:center;gap:12px;min-height:44px;padding:10px 12px;border:1px solid transparent;border-radius:8px;color:#666;background:transparent;text-decoration:none;font:450 13px/1.4 var(--font);white-space:nowrap}
body>:is(.workspace-top,.status-top,.review-top) nav a:hover{background:#ebebeb;color:#171717}
body>:is(.workspace-top,.status-top,.review-top) nav a[aria-current=page]{border-color:#dedede;background:#fff;color:#171717;font-weight:600;box-shadow:0 1px 3px #00000005}
body>:is(.workspace-top,.status-top,.review-top) nav a svg{flex-shrink:0}.workspace-footer{margin-top:auto;padding:32px 12px 0;font-size:11px;line-height:1.8;color:#737373;max-width:175px}.workspace-dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:#a3a3a3;margin-right:6px}
body>main{width:100%;max-width:1440px;margin:0 auto;padding:48px var(--content-pad) 64px;min-width:0}
body>main>h1,body .status-head h1,body .hero h1{font:600 clamp(28px,3vw,38px)/1.2 var(--font);letter-spacing:-.045em;margin:0 0 12px}
body>main>h1{margin-bottom:32px}body .eyebrow{font:500 12px/1.5 var(--font);text-transform:none;letter-spacing:0;color:#666}
:is(.primary,.intake-primary,.plan-action button,.primary-link,.workflow-primary){background:#171717;color:#fff;border:1px solid #171717;min-height:44px;border-radius:8px;font-size:13px;font-weight:550;box-shadow:0 1px 2px #0000000a}
:is(.primary,.intake-primary,.plan-action button,.workflow-primary):not(:disabled):hover{background:#333;box-shadow:0 2px 6px #00000014}
body button:disabled,body .workflow-primary:disabled,body .approve:disabled{opacity:1;background:#ededed;border-color:#e5e5e5;color:#858585;box-shadow:none}
body .quiet-button,body .reopen-content{background:#fff;border:1px solid #dcdcdc;border-radius:7px;min-height:40px;color:#404040;font-size:12px}body .quiet-button:hover{background:#f5f5f5}
/* Candidate-free entry: one clear decision, with space to understand the product. */
body.welcome-shell{padding-left:0;background:#fff}
body.welcome-shell>header{position:static;inset:auto;min-height:88px;width:100%;padding:0 clamp(24px,6vw,88px);flex-direction:row;align-items:center;justify-content:space-between;border-right:0;border-bottom:1px solid #ededed;background:#fff}
body.welcome-shell>header>.workspace-brand{padding:0;max-width:none;font-size:15px;white-space:nowrap}
body.welcome-shell>header nav{flex-direction:row}body.welcome-shell>:is(.workspace-top) nav a[aria-current=page]{border:0;background:transparent;box-shadow:none}body.welcome-shell>header nav a{min-height:44px;background:#fff;border:0;padding:8px 0;color:#666;box-shadow:none}
body.welcome-shell>main{max-width:1440px;padding:0 clamp(24px,6vw,88px) 64px}
body .welcome-page{max-width:none;margin:0;min-height:calc(100dvh - 152px);display:grid;grid-template-columns:minmax(0,1.2fr) minmax(320px,.85fr);align-items:center;gap:clamp(48px,7vw,112px);padding:72px 0}
.welcome-tag{display:flex;align-items:center;gap:9px;font-size:12px;color:#525252;margin-bottom:28px}.welcome-tag>span{height:7px;width:7px;border-radius:50%;background:#171717}
body .welcome-page h1{font:550 clamp(44px,5.5vw,76px)/1.04 var(--font);letter-spacing:-.065em;margin:0 0 28px;max-width:10ch;text-wrap:initial}
.welcome-intro{max-width:38ch;font-size:16px;line-height:1.85;color:#666}.journey{display:flex;align-items:center;gap:14px;margin-top:52px;max-width:360px;font-size:12px;font-weight:550}.journey i{height:1px;flex:1;background:#ddd;min-width:16px}.welcome-note{font-size:11px;color:#737373;margin-top:16px}
body .welcome-options{display:grid;gap:12px}
body .welcome-option{position:relative;display:flex;align-items:flex-start;gap:18px;min-height:146px;padding:26px;border:1px solid #e5e5e5;border-radius:14px;background:#fff;box-shadow:0 2px 4px #00000003;text-decoration:none}
body .welcome-option:hover{border-color:#a3a3a3;box-shadow:0 4px 12px #00000008}
body .welcome-option:first-child{background:#171717;border-color:#171717;color:#fff;box-shadow:0 4px 12px #00000012}
body .welcome-option:first-child:hover{background:#292929}
body .welcome-icon{display:grid;place-items:center;flex:none;width:42px;height:42px;border:1px solid #e5e5e5;background:#fafafa;border-radius:10px;color:#525252}
body .welcome-option:first-child .welcome-icon{background:#303030;border-color:#454545;color:#fff}
.welcome-option-copy{display:grid;gap:5px;min-width:0}.welcome-option-copy strong{font-size:16px;font-weight:550}.welcome-option-copy>span{font-size:12px;line-height:1.7;color:#737373}.welcome-option:first-child .welcome-option-copy>span{color:#bdbdbd}.welcome-option-copy>.welcome-action{font-size:12px;font-weight:550;color:#171717;margin-top:12px}.welcome-option:first-child .welcome-option-copy>.welcome-action{color:#fff}
/* Applications: one readable table and locally scrolling lifecycle controls. */
body .status-page{padding:48px var(--content-pad) 64px;max-width:1500px}
body .status-head{align-items:center;margin-bottom:28px}.status-head .total{font-size:12px;gap:7px;background:#fff;border:1px solid #e5e5e5;padding:5px 12px;border-radius:20px}.status-head .total strong{font-weight:600}
body .search-refresh{display:flex;flex-direction:row;align-items:center;justify-content:space-between;margin:0 0 28px;padding:18px 20px;background:#fff;border:1px solid #e5e5e5;border-radius:12px;gap:20px;font-size:12px}
body .search-refresh strong{font-size:13px}body .search-refresh button{min-height:40px;padding:9px 14px;background:#fff;border-color:#dcdcdc;font-size:12px}
body .lifecycle-guide{border:0;margin:0 0 20px;padding:0;overflow-x:auto;scrollbar-width:thin}
body .lifecycle-stages{display:flex;gap:6px;padding:4px;background:#ededed;border-radius:10px;min-width:max-content}
body .status-filter{min-height:40px;padding:9px 13px;border:1px solid transparent;border-radius:7px;font:450 12px/1.4 var(--font);color:#666;background:transparent}
body .status-filter:hover{background:#e5e5e5;color:#171717}body .status-filter[aria-pressed=true]{background:#fff;border-color:#ddd;color:#171717;font-weight:550;box-shadow:0 1px 2px #00000006}
body .status-list{border:1px solid #e5e5e5;border-radius:12px;background:#fff;overflow:hidden}
body .status-table{min-width:700px}body .status-table th{background:#fdfdfd;padding:15px 16px;font-size:11px;font-weight:500;color:#737373}body .status-table th:first-child{padding-left:12px;width:52px}body .status-table th:nth-child(2){width:50px}body .status-table th:nth-child(3){width:27%}body .status-table th:nth-child(5){width:95px}body .status-table th:last-child{width:76px}
body .status-row td{padding:20px 16px;font-size:13px;line-height:1.6;border-bottom:1px solid #efefef}body .status-row:last-child td{border-bottom:0}body .status-row td:first-child{padding-left:12px}
body .company-line{font-size:13px;font-weight:600}body .row-location{font-size:11px;line-height:1.6;margin-top:4px;color:#737373}body .role{font:450 13px/1.6 var(--font)}body .row-category{display:inline-block;padding:3px 8px;background:#f5f5f5;border-radius:5px;font-size:10px;letter-spacing:0;color:#666}body .status-row time,body .row-link{font-size:11px;color:#737373;white-space:nowrap}
body .status-row:hover{background:#fafafa}body .status-row:has(.job-select:checked){background:#f0f0f0}body .status-page .job-select{width:17px;height:17px}body .row-selection{min-height:40px;width:32px}
/* Review: keep the queue distinct from the editable document. */
body .review-layout{max-width:1500px;padding:36px var(--content-pad) 48px;grid-template-columns:230px minmax(0,1fr);gap:32px}
body .queue{top:28px;max-height:calc(100dvh - 140px);padding-right:3px}body .queue-heading{padding:0 10px 18px;font-size:13px}body .queue-heading span{background:#e9e9e9;color:#666;font-size:11px}
body .queue-list{gap:5px}body .queue-item{padding:16px 14px;border-radius:9px;min-height:90px}body .queue-item[aria-pressed=true]{border-color:#dedede;background:#fff;box-shadow:0 1px 4px #00000005,inset 3px 0 #171717}body .queue-item:hover{background:#efefef}body .queue-item strong{font-size:13px}body .queue-role{font-size:12px;margin-top:6px;line-height:1.6}body .queue-item small{font-size:10px;line-height:1.6}
body .detail-wrap{background:#fff;border:1px solid #e5e5e5;border-radius:14px;padding:28px;box-shadow:0 2px 6px #00000003}
body .detail-head{display:grid;grid-template-columns:minmax(0,1fr);padding:0 0 24px;gap:18px}
body .detail h1{font:600 clamp(24px,2.3vw,32px)/1.22 var(--font);letter-spacing:-.04em}
body .category{font:500 11px/1.5 var(--font);letter-spacing:0;padding:3px 8px;background:#f5f5f5;border-radius:5px;margin-bottom:12px}
body .detail-head p{font-size:13px;margin-top:10px}body .detail-actions{display:flex;flex-direction:row;justify-content:space-between;align-items:flex-start;max-width:none;width:100%;gap:20px;text-align:left}body .detail-actions .decision-dock{width:auto;max-width:240px;text-align:right}body .application-link{justify-content:flex-start;font-size:12px;flex-shrink:0}body .approve{font-size:12px;min-height:42px;padding:10px 18px}body .approval-reason{font-size:11px}
body .review-item{padding:22px 0;margin:0;border:0;border-radius:0;background:transparent}body .review-item+.review-item{border-top:1px solid #ededed}body .short-label,body .choice-list legend,body .review-item h3{font:550 14px/1.7 var(--font)}
body .long-answer,body .short-answer{font-size:14px;line-height:1.85;border-radius:8px;padding:12px 14px;border-color:#ddd;box-shadow:0 1px 2px #00000003}body .long-answer:focus,body .short-answer:focus{border-color:#737373}body .long-answer{min-height:160px}body .choice-row{padding:13px 14px;border-radius:8px;border-color:#e5e5e5;gap:12px}body .choice-row:has(input:checked){background:#f5f5f5;border-color:#737373}body .choice-copy{font-size:13px;line-height:1.7}
body .workflow-actions{left:var(--rail);padding:14px var(--content-pad);padding-bottom:calc(14px + env(safe-area-inset-bottom));background:#ffffffed;backdrop-filter:blur(12px);border-top:1px solid #e5e5e5;box-shadow:0 -4px 16px #00000003}
body .workflow-primary{font-size:13px;min-height:44px;padding:11px 20px}body .workflow-primary span{margin-left:6px}body .resume-picker{font-size:12px}body #workflow-message{margin-left:var(--content-pad)}
/* Profile and account surfaces share the same form rhythm. */
body .editor{max-width:860px}body .editor fieldset{margin:0 0 28px;padding:28px;border:1px solid #e5e5e5;border-radius:12px;background:#fff;box-shadow:0 2px 5px #00000002}body .editor legend{font-size:15px;font-weight:600;padding:0 8px}
body .editor label{font-size:12px;margin:18px 0;color:#525252}body .editor input:not([type=checkbox]),body .editor textarea,body .editor select{border-color:#ddd;padding:11px 13px;border-radius:7px;font-size:14px;background:#fff}body .editor textarea{line-height:1.8}body .editor h2{font-size:14px;margin-top:30px}body .editor input[type=checkbox]{min-width:18px;min-height:18px;margin-right:6px}body .editor .entry{padding:4px 0 0}body .editor input[type=file]{background:#fafafa;font-size:12px}body .editor fieldset>p{font-size:12px;color:#666}
body .tile,body .account-panel{padding:28px;border:1px solid #e5e5e5;border-radius:12px;background:#fff;box-shadow:0 2px 6px #00000003}body .tile h2,body .account-panel h2{font-size:17px;font-weight:550}body .tile:hover{border-color:#b5b5b5;box-shadow:0 4px 12px #00000006}body .tile .count{font-size:28px;font-weight:550}body .permission{padding:18px 0;font-size:12px}
/* Interview preparation: coherent queue, plan and readable practice pages. */
body .hero{padding:0 0 28px;align-items:center;border:0;margin:0}body .hero-count{font-size:12px;color:#666}body .workspace{display:grid;overflow:visible;grid-template-columns:230px minmax(0,1fr);gap:32px;padding:0;border:0}body .workspace>aside{padding:0;background:transparent;border:0;min-width:0}body .list-heading{margin:0 0 18px;padding:0;font-size:13px}body .list-heading h2{font-size:13px}
body .filters{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px;padding:4px;background:#ededed;border:0;border-radius:10px;margin-bottom:20px}body .filters a{min-height:40px;border:1px solid transparent;border-radius:7px;color:#666;font-size:11px}body .filters a[aria-current=page]{background:#fff;color:#171717;border-color:#ddd;box-shadow:0 1px 2px #00000005}
body .interview-card{padding:16px 14px;border-radius:9px;background:transparent;border:1px solid transparent;margin-bottom:6px}body .interview-card[aria-current]{background:#fff;border-color:#ddd;box-shadow:inset 3px 0 #171717}body .interview-card .company{font-size:13px;font-weight:600}body .interview-card h3{font:450 12px/1.6 var(--font)}body .interview-card p{font-size:10px}
body .workspace>.detail{background:#fff;border:1px solid #e5e5e5;border-radius:14px;padding:28px;min-width:0;box-shadow:0 2px 6px #00000003}body .workspace .role-heading{font:600 clamp(24px,2.4vw,32px)/1.25 var(--font);letter-spacing:-.035em}body .workspace .detail-head{gap:8px}body .workspace .detail-meta{font-size:11px;gap:12px;flex-wrap:wrap}body .detail-tabs{gap:22px;margin-top:22px;overflow-x:auto}body .detail-tabs a{font-size:12px;min-height:44px;white-space:nowrap}body .detail-body{padding:24px 0 0}body .panel{padding:22px 0;background:transparent;border:0;border-bottom:1px solid #ededed;border-radius:0}body .panel h2,body .detail-body h2{font:600 19px/1.4 var(--font)}body .support,body .facts{font-size:13px;line-height:1.85}body .empty-state{padding:64px 24px;text-align:center;background:transparent;border:0}body .empty-state h3{font:550 22px/1.3 var(--font);letter-spacing:-.035em}body .empty-state p{font-size:13px;line-height:1.85;max-width:44ch;margin:14px auto 0;color:#666}body .plan-section{padding:22px 0}body .section-title h3{font-size:16px}body .simulation{padding:22px;border-color:#e5e5e5;border-radius:10px}body .plan-action{background:#fafafa;border-color:#e5e5e5;border-radius:12px}
body .empty,body .review-complete{border:0}body .status-list .empty{padding:48px 24px;font-size:13px}body .review-complete{padding:40px 24px}body .review-complete h1{font-weight:600;letter-spacing:-.035em}body .list-empty{font-size:12px;line-height:1.8;padding:12px;color:#737373}
/* Intake reuses the entry shell without exposing candidate navigation. */
body.welcome-shell:has(.intake-shell)>main{padding-top:32px;max-width:1000px}body .intake-shell{max-width:740px}body .intake-shell .source-section{border-radius:14px;box-shadow:0 2px 6px #00000003}body .source-tabs{background:#fafafa;padding:8px}body .source-tabs button{min-height:56px;font-size:13px}body .source-tabs button[aria-selected=true]{background:#fff;border-color:#dedede;box-shadow:0 1px 3px #00000005}body .intake-shell input:not([type=checkbox]):not([type=file]),body .intake-shell textarea{background:#fff;border-radius:8px}body .intake-shell h1{font-size:34px;font-weight:600}body .intake-shell .source-body{padding:28px}body .intake-shell h2{font-weight:550;font-size:24px}
@media(min-width:1600px){:root{--rail:240px}body .review-layout,body .workspace{grid-template-columns:260px minmax(0,1fr);gap:40px}}
@media(max-width:1150px) and (min-width:901px){:root{--rail:196px;--content-pad:28px}body>header>.workspace-brand{font-size:14px}body .review-layout,body .workspace{grid-template-columns:190px minmax(0,1fr);gap:20px}body .detail-wrap,body .workspace>.detail{padding:24px}}
@media(max-width:900px){
 :root{--rail:0px;--content-pad:24px;--review-header-height:128px}body{padding-left:0}
 body> :is(.workspace-top,.status-top,.review-top){position:static;inset:auto;min-height:0;width:100%;padding:20px 24px 0;flex-direction:column;align-items:stretch;border:0;border-bottom:1px solid #e5e5e5;background:#fff;gap:14px}
 body>header>.workspace-brand{flex-direction:row;align-items:center;max-width:none;padding:0;gap:10px;font-size:15px}body .workspace-brand .brand-mark{height:30px;width:30px;border-radius:8px}body .nav-caption,body .workspace-footer{display:none}
 body>:is(.workspace-top,.status-top,.review-top) nav{flex-direction:row;gap:4px;max-width:100%;overflow-x:auto;padding:0 0 12px;scrollbar-width:thin}body>:is(.workspace-top,.status-top,.review-top) nav a{flex:none;padding:9px 12px;min-height:40px;font-size:12px;gap:8px}body>:is(.workspace-top,.status-top,.review-top) nav a svg{width:16px;height:16px}
 body>main,body .status-page{padding-top:32px}body .review-layout{padding-top:28px;grid-template-columns:210px minmax(0,1fr);gap:24px}body .detail-wrap,body .workspace>.detail{padding:24px}body .workspace{grid-template-columns:210px minmax(0,1fr);gap:24px}
 body.welcome-shell>header{min-height:76px;padding:0 24px;gap:20px}body.welcome-shell>header nav{padding:0}body .welcome-page{padding:48px 0;gap:40px;grid-template-columns:minmax(0,1fr) minmax(300px,1fr)}body .welcome-page h1{font-size:52px}body .welcome-intro{font-size:14px}
 .skip-link{left:20px}
}
@media(max-width:700px){
 :root{--content-pad:20px}body .review-layout,body .workspace{display:block}body .queue{position:static;max-height:none;padding:0;margin-bottom:20px}body .queue-heading,body .queue-list{display:none}body .queue-picker-label{display:block;font-size:12px;margin-bottom:8px;color:#666}body .queue-picker{display:block;width:100%;min-height:48px;padding:10px 12px;border:1px solid #ddd;border-radius:8px;background:#fff;font-size:14px;color:#171717}
 body .detail-wrap,body .workspace>.detail{padding:22px 18px;border-radius:12px}body .detail h1,body .workspace .role-heading{font-size:26px}body .detail-actions{flex-wrap:wrap;gap:10px}body .detail-actions .decision-dock{max-width:none;flex:1;min-width:160px}body .long-answer,body .short-answer{font-size:16px}body .choice-copy{font-size:13px}body .review-item{padding:22px 0}
 body .workflow-actions{left:0;flex-direction:row;gap:12px;padding:12px 20px;padding-bottom:calc(12px + env(safe-area-inset-bottom))}body .workflow-buttons{width:100%;justify-content:flex-end}body .workflow-primary{width:auto;max-width:100%}body .resume-picker{width:100%}
 body .workspace>aside{margin-bottom:24px}body .interview-list{display:flex;gap:10px;overflow-x:auto;max-width:100%}body .interview-card{min-width:210px;max-width:260px;flex:0 0 75%;background:#fff;border-color:#e5e5e5;margin-bottom:4px}body .filters{grid-template-columns:repeat(4,minmax(0,1fr))}body .filters a{font-size:11px;padding:8px 2px}body .hero{gap:12px;flex-wrap:wrap}body .hero-count{margin:0}
 body .editor input:not([type=checkbox]),body .editor textarea,body .editor select,body .intake-shell input:not([type=checkbox]):not([type=file]),body .intake-shell textarea{font-size:16px}body .editor fieldset{padding:22px 18px;margin-bottom:24px}body .search-refresh{align-items:flex-start;flex-direction:column;padding:18px;gap:14px}body .search-refresh button{align-self:flex-start}body .search-refresh #search-new-count{display:block;margin-left:0}body .tiles{grid-template-columns:1fr}body .tile,body .account-panel{padding:22px}
 body .welcome-page{display:block;padding:44px 0 20px;min-height:0}body .welcome-copy{margin-bottom:36px}body .welcome-page h1{font-size:clamp(42px,9vw,60px);max-width:none;margin-bottom:20px}.welcome-tag{margin-bottom:20px;font-size:11px}body .welcome-intro{font-size:14px;max-width:40ch}.journey{margin-top:28px;max-width:320px}.welcome-note{margin-top:10px}body .welcome-option{min-height:132px;padding:22px;gap:16px}body .welcome-options{gap:10px}
 body.welcome-shell>main{padding:0 24px 40px}body .intake-shell .source-body{padding:22px 18px}body .source-tabs button{font-size:12px}body .intake-shell h1{font-size:30px}
}
@media(max-width:380px){:root{--content-pad:16px}body> :is(.workspace-top,.status-top,.review-top){padding:16px 16px 0}body>:is(.workspace-top,.status-top,.review-top) nav a{padding:9px 10px}body .detail-actions{flex-direction:column}body .detail-actions .decision-dock{width:100%;text-align:left}body .approve{width:100%}body .welcome-option{padding:18px;gap:12px}body.welcome-shell>header>.workspace-brand{font-size:13px}body .welcome-icon{width:36px;height:36px}}
/* Reference-led visual system: blue structure, white work surfaces, orange actions. */
:root{--navy:#24476b;--blue:#315885;--blue-mid:#4471b4;--blue-light:#bdd4e5;--orange:#f89344;--paper:#f5f7fa;--panel:#fff;--ink:#23374b;--muted:#627286;--line:#dfe6ee;--soft:#eef3f8;--green:#315885;--safe:#315885;--warn:#985223;--accent-0:#315885;--accent-1:#4471b4;--accent-2:#bdd4e5;--accent-3:#f89344}
body{background:var(--paper);color:var(--ink)}
body> :is(.workspace-top,.status-top,.review-top){background:var(--navy);border-right:1px solid #1e3e5f}
body>header>.workspace-brand{color:#fff}body .workspace-brand .brand-mark{background:var(--orange);color:#24476b;box-shadow:none}
body .nav-caption{color:#b9cce0}
body>:is(.workspace-top,.status-top,.review-top) nav a{color:#d2dfed}
body>:is(.workspace-top,.status-top,.review-top) nav a:hover{background:#315b83;color:#fff}
body>:is(.workspace-top,.status-top,.review-top) nav a[aria-current=page]{background:#fff;border-color:#fff;color:#24476b;box-shadow:inset 3px 0 #f89344}
body .workspace-dot{background:#91acc8}body .workspace-footer{color:#b9cce0}
body :is(.primary,.intake-primary,.plan-action button,.primary-link,.workflow-primary,.approve){background:var(--orange);border-color:var(--orange);color:#203c57;font-weight:600;box-shadow:0 1px 2px #24476b0a}
body :is(.primary,.intake-primary,.plan-action button,.workflow-primary,.approve):not(:disabled):hover{background:#ee842e;border-color:#ee842e;color:#19344d}
body button:disabled,body .workflow-primary:disabled,body .approve:disabled{background:#edf0f4;border-color:#e1e6ec;color:#7d8997;box-shadow:none}
body :is(a,button,input,textarea,select,summary):focus-visible{outline-color:#4471b4}
body .status-head h1,body>main>h1,body .hero h1,body .detail h1,body .workspace .role-heading{color:#203d5a}
body .status-head .total{border-color:#dfe6ee;color:#627286}
body .search-refresh{background:#fff;border:1px solid #dfe6ee;box-shadow:none}
body .search-refresh strong{color:#24476b}body .search-refresh button{background:#fff;border-color:#c5d4e3;color:#315885}body .search-refresh button:not(:disabled):hover{background:#eef4fa;border-color:#8ca9c6}
body .lifecycle-stages{background:transparent;padding:0;gap:8px}body .status-filter{color:#627286}body .status-filter:hover{background:#eaf0f6;color:#24476b}body .status-filter[aria-pressed=true]{background:#f89344;border-color:#f89344;color:#203c57;box-shadow:none}
body .status-table th{background:#f3f6fa;color:#627286}body .status-row:hover{background:#f8fafc}body .status-row:has(.job-select:checked){background:#edf4fa}
body .row-category{background:#eef3f8;color:#4d6d8f}body .status-table{min-width:850px}body .status-table th:nth-child(3){width:23%}body .status-table th:nth-child(6){width:142px}body .status-table th:last-child{width:76px}
.resume-tag{display:inline-flex;align-items:center;min-height:28px;max-width:100%;padding:4px 9px;border:1px solid #cfdeeb;border-radius:6px;background:#eaf2f9;color:#315b81;font-size:10px;font-weight:550;line-height:1.6;overflow-wrap:anywhere;text-decoration:none}
body .resume-unresolved{background:#fff5e9;border-color:#efd7ba;color:#8b5323;font-weight:450}body .resume-unresolved:hover{text-decoration:underline;text-underline-offset:3px}
body .queue-heading span{background:#e7edf4;color:#516e8c}body .queue-item[aria-pressed=true]{border-color:#b6cce0;background:#fff;box-shadow:inset 3px 0 #315885}body .queue-item:hover{background:#edf3f8}body .category{background:#eaf2f9;color:#476b8d}
body .choice-row:has(input:checked){background:#f0f6fb;border-color:#91afce}body .choice-input,body .job-select,body input[type=checkbox],body input[type=radio]{accent-color:#315885}
body .review-item+.review-item{border-top-color:#e4eaf1}body .detail-wrap,body .workspace>.detail{border-color:#dfe6ee;box-shadow:0 2px 8px #24476b04}
body .review-label,body .approved-status{color:#985223}
body .filters{background:#edf2f7}body .filters a[aria-current=page]{background:#315885;color:#fff;border-color:#315885;box-shadow:none}
body .interview-card[aria-current]{background:#fff;border-color:#b6cce0;box-shadow:inset 3px 0 #315885}body .pill{background:#edf3f9;color:#4d6d8f;font-family:var(--font)}body .pill.scheduled{background:#e6f0f8;color:#315885}body .pill.completed{background:#eef3f8;color:#4b6681}body .pill.cancelled{background:#f0f2f5;color:#6f7784}
body .plan-action{background:#f6f9fc;border-color:#d9e4ee}body .deliverable{background:#edf4fa;color:#506d8b}body .simulation{border-color:#dfe6ee;background:#fff}body .detail-tabs a[aria-current]{border-color:#315885;color:#24476b}
body .editor fieldset:nth-of-type(1){border-color:#dfe6ee}body .editor legend{color:#315885}
body .source-tabs{background:#f4f7fa}body .source-tabs button[aria-selected=true]{background:#e6f0f8;border-color:#c2d5e6;color:#315885}body .upload-zone{background:#f6f9fc;border-color:#a9c1d6}
body .welcome-option:first-child{background:#24476b;border-color:#24476b}body .welcome-option:first-child:hover{background:#2c547d}body .welcome-option:first-child .welcome-icon{background:#f89344;border-color:#f89344;color:#24476b}body .welcome-option:nth-child(2),body .welcome-option:nth-child(3){background:#fff;border-color:#dfe6ee}body .welcome-option .welcome-icon{background:#edf3f8;border-color:#d8e4ef;color:#315885}body .welcome-option:first-child .welcome-option-copy>span{color:#d2dfed}body .welcome-option:first-child .welcome-option-copy>.welcome-action{color:#fff}body .welcome-tag>span{background:#f89344}
body .row-demo-actions{margin-top:10px}.demo-interview-button{min-height:40px;padding:8px 12px;border:1px solid #f89344;border-radius:7px;background:#f89344;color:#203c57;font:600 11px/1.5 var(--font)}.demo-interview-button:hover{background:#ee842e;border-color:#ee842e}.demo-interview-message{font-size:11px;line-height:1.6;color:#985223;margin:8px 0 0}.demo-interview-message:empty{display:none}.row-interview-link{display:inline-flex;align-items:center;min-height:40px;margin-top:6px;color:#315885;font-size:12px;text-decoration:none}.row-interview-link:hover{text-decoration:underline;text-underline-offset:3px}@media(max-width:700px){.demo-interview-button{min-height:44px}}
body .workflow-actions{background:#fffffff5;border-color:#dfe6ee}
body.welcome-shell{background:#fff}body.welcome-shell>header{background:#fff;border-bottom-color:#e5ebf1}body.welcome-shell>header>.workspace-brand{color:#24476b}body.welcome-shell>:is(.workspace-top) nav a{color:#627286}body.welcome-shell>:is(.workspace-top) nav a:hover{background:#f4f7fa;color:#24476b}
@media(max-width:900px){body> :is(.workspace-top,.status-top,.review-top){background:#24476b;border-bottom-color:#1e3e5f}body.welcome-shell>header{background:#fff}}

@media(prefers-reduced-motion:reduce){*,*::before,*::after{transition:none!important;scroll-behavior:auto!important}button:not(:disabled):active{transform:none}}
/* CareerOS Frame mark: the user-selected geometric C silhouette. */
body>header>.workspace-brand{flex-direction:row;align-items:center;gap:9px;max-width:none;padding-left:8px;padding-right:0;font-size:15px;letter-spacing:-.035em}
body .workspace-brand .brand-mark{flex:0 0 28px;width:28px;height:28px;border-radius:0;background:transparent;color:#f89344}
body,button,input,textarea,select,code,pre,kbd,samp{font-family:var(--font)}
${workspaceTheme}
`;
