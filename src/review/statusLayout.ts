/** Status-only composition. Other workspaces keep their current presentation. */
export const statusLayout = `
body.status-workspace{--rail:208px;--ink:#202020;--muted:#202020;background:#fafbfc;font-weight:500}
body.status-workspace>.status-top{background:#eff1f3;border-right:1px solid #e0e4e8;padding:30px 16px 24px}
body.status-workspace>.status-top>.workspace-brand{color:#202020;font-size:16px;gap:8px;padding:0 5px 48px}
body.status-workspace>.status-top nav{gap:8px}
body.status-workspace>.status-top nav a{color:#202020;font-weight:550;font-size:14px;padding:12px 14px;border-radius:8px;gap:12px}
body.status-workspace>.status-top nav a:hover{background:#f5f7fa;color:#202020}
body.status-workspace>.status-top nav a[aria-current=page]{background:#fff;border-color:#e1e6eb;color:#202020;box-shadow:none;font-weight:600}
body.status-workspace>.status-page{max-width:1512px;padding:48px clamp(28px,4vw,64px) 104px}
body.status-workspace .status-head{display:flex;justify-content:space-between;align-items:center;gap:40px;padding:0;margin:0 0 32px}
body.status-workspace .status-head h1{font:650 clamp(32px,3vw,42px)/1.15 var(--font);letter-spacing:-.045em;margin:0;color:#202020}
body.status-workspace .status-overview{display:flex;gap:36px;margin:0;flex-shrink:0}
body.status-workspace .status-overview>div{display:grid;grid-template-rows:auto 1fr;gap:9px}
body.status-workspace .status-overview dt{grid-row:2;font-size:12px;color:#202020;line-height:1.5}
body.status-workspace .status-overview dd{grid-row:1;font-size:36px;font-weight:500;letter-spacing:-.04em;line-height:1;margin:0;color:#202020;font-variant-numeric:tabular-nums}
body.status-workspace .status-overview>div:nth-child(2) dd{color:#b75918}
body.status-workspace .search-refresh{display:flex;flex-direction:row;align-items:center;gap:24px;background:#fff0df;border:1px solid #f2d3b2;border-radius:10px;margin:0 0 28px;padding:18px 20px;box-shadow:none}
body.status-workspace .search-refresh-copy{display:grid;grid-template-columns:auto 1fr;column-gap:20px;row-gap:6px;align-items:baseline}
body.status-workspace .search-refresh #search-last-updated{font-size:16px;font-weight:650}
body.status-workspace .search-refresh #search-refresh-message{font-size:15px;font-weight:550;color:#202020}
body.status-workspace .search-refresh strong{font-size:13px;font-weight:600;color:#202020}
body.status-workspace .search-refresh .search-source{font-size:12px;color:#202020;margin:0}
body.status-workspace .search-refresh p{grid-column:1 / -1;margin:0;font-size:15px;font-weight:550;line-height:1.65;color:#202020}
body.status-workspace .search-refresh .search-cadence{font-size:12px;color:#202020}
body.status-workspace .search-refresh button{font-size:15px;font-weight:650;background:#fff;border-color:#dfe6ed;border-radius:7px;min-height:40px;padding:8px 13px;align-self:center}
body.status-workspace .status-list{background:#fff;border:1px solid #e4e9ee;border-radius:12px;box-shadow:0 4px 20px #24364703;overflow:hidden}
body.status-workspace .pipeline-heading{display:flex;align-items:center;gap:12px;padding:26px 26px 8px}
body.status-workspace .pipeline-heading h2{font-size:18px;font-weight:600;letter-spacing:-.02em;line-height:1.5;margin:0;color:#202020}
body.status-workspace .pipeline-heading .total{display:flex;align-items:baseline;gap:4px;font-size:12px;color:#202020;border:0;background:none;padding:0;line-height:1.5}
body.status-workspace .pipeline-heading .total strong{font-size:12px;font-weight:500;line-height:1.5}
body.status-workspace .pipeline-heading .total span{font-size:12px;text-transform:none;letter-spacing:0;line-height:1.5}
body.status-workspace .lifecycle-guide{margin:0;padding:0 26px;border:0;overflow:auto;scrollbar-width:thin}
body.status-workspace .lifecycle-stages{gap:22px;min-width:max-content;border-radius:0;background:transparent;padding:0}
body.status-workspace .status-filter{position:relative;min-height:54px;padding:13px 0 15px;border:0;border-radius:0;background:transparent;color:#202020;font:550 13px/1.5 var(--font)}
body.status-workspace .status-filter:hover{background:transparent;color:#202020}
body.status-workspace .status-filter[aria-pressed=true]{background:transparent;color:#202020;box-shadow:inset 0 -2px #ee9148;font-weight:600}
body.status-workspace .status-table{min-width:880px;width:100%;table-layout:fixed}
body.status-workspace .status-table th{background:#f8fafb;border-top:1px solid #e9edf1;border-bottom:1px solid #e9edf1;padding:13px 12px;font-size:12px;letter-spacing:.015em;font-weight:600;color:#202020}
body.status-workspace .status-table th:first-child{width:38px;padding-left:14px}
body.status-workspace .status-table th:nth-child(2){width:42px}
body.status-workspace .status-table th:nth-child(3){width:24%}
body.status-workspace .status-table th:nth-child(5){width:130px}
body.status-workspace .status-table th:nth-child(6){width:116px}
body.status-workspace .status-table th:last-child{width:70px}
body.status-workspace .status-table td{padding:20px 12px;border-bottom:1px solid #eef1f4;vertical-align:middle}
body.status-workspace .status-table tr:last-child td{border-bottom:0}
body.status-workspace .company-line{font-size:15px;font-weight:600;line-height:1.5;color:#202020}
body.status-workspace .row-location{font-size:12px;line-height:1.6;margin-top:5px;color:#202020}
body.status-workspace .row-stage{display:inline-block;padding:2px 7px;border-radius:4px;background:#edf0f3;color:#37424a;font:550 12px/1.5 var(--font)}
body.status-workspace .row-role .role{font-size:14px;font-weight:500;line-height:1.65;color:#202020;text-decoration:none}
body.status-workspace .row-role .role:hover{color:#202020;text-decoration:underline;text-underline-offset:3px}
body.status-workspace .row-link{font-size:12px;color:#202020}
body.status-workspace .row-category{background:transparent;padding:0;color:#202020;font-size:12px;font-weight:500}
body.status-workspace .resume-tag{font-size:12px;min-height:25px;padding:3px 8px;border-radius:5px;background:#f0f5f9;border-color:#e1eaf2;color:#202020}
body.status-workspace .resume-unresolved{color:#202020;background:#fcf7ef;border-color:#f0e5d5}
body.status-workspace time{font-size:12px;color:#202020;font-weight:500}
body.status-workspace .row-interview-link{font-size:12px;min-height:40px;margin-top:4px}
body.status-workspace .empty{padding:36px 26px;font-size:14px;color:#202020}
body.status-workspace .workflow-actions{background:#fffffff5;border-color:#e6ebf0}
body.status-workspace :is(.row-interview-link,.demo-interview-button,.demo-interview-message,.preparation-retry,.workflow-primary){color:#202020}
@media(min-width:901px) and (max-width:1120px){body.status-workspace .status-head{align-items:flex-start;flex-direction:column;gap:30px}body.status-workspace .status-overview{gap:52px}}
@media(max-width:900px){
 body.status-workspace{padding-left:0}
 body.status-workspace>.status-top{position:static;width:100%;min-height:0;padding:22px 28px 0;border-right:0;border-bottom:1px solid #e8ecf0}
 body.status-workspace>.status-top>.workspace-brand{padding:0 0 20px}
 body.status-workspace>.status-top nav{flex-direction:row;gap:6px;overflow-x:auto;padding-bottom:12px}
 body.status-workspace>.status-top nav a{min-height:40px;padding:9px 12px;font-size:13px}
 body.status-workspace>.status-page{padding:38px 28px 90px}
 body.status-workspace .status-head{gap:26px;align-items:flex-start;flex-direction:column;margin-bottom:30px}
 body.status-workspace .status-overview{width:100%;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
 body.status-workspace .status-overview dd{grid-row:1;font-size:30px}
 body.status-workspace .status-overview dt{grid-row:2;font-size:12px}
 body.status-workspace .search-refresh{margin-bottom:28px}
}
@media(max-width:520px){
 body.status-workspace>.status-top{padding:22px 20px 0}
 body.status-workspace>.status-page{padding:32px 20px 88px}
 body.status-workspace .status-head h1{font-size:36px}
 body.status-workspace .search-refresh{gap:12px;align-items:flex-start}
 body.status-workspace .search-refresh-copy{display:block}
 body.status-workspace .search-refresh .search-source{display:none}
 body.status-workspace .search-refresh button{padding:10px 12px;font-size:15px;font-weight:650;align-self:flex-start;white-space:nowrap}
 body.status-workspace .pipeline-heading{padding:22px 18px 6px}
 body.status-workspace .lifecycle-guide{padding:0 18px}
 body.status-workspace .lifecycle-stages{gap:20px}
 body.status-workspace .status-filter{font-size:12px;min-height:50px}
}
`;
