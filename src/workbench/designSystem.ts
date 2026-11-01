/** Shared visual tokens for the local productivity workspace. */
export const designSystem = `
@font-face{font-family:Inter;src:url('/assets/InterVariable.woff2') format('woff2');font-weight:100 900;font-style:normal;font-display:swap}
:root{--font:Inter,Arial,sans-serif;--paper:#fff;--panel:#fff;--ink:#171717;--muted:#737373;--line:#e5e5e5;--green:#171717;--soft:#f5f5f5;--safe:#236340;--warn:#8a571c;--accent-0:#171717;--accent-1:#737373;--accent-2:#a3a3a3;--accent-3:#d4d4d4}
html{-webkit-font-smoothing:antialiased;font-variant-numeric:tabular-nums}
body{margin:0;background:#fff;color:#171717;font-family:var(--font);font-size:14px;line-height:1.6}
button,input,textarea,select{font-family:var(--font)}
h1,h2,h3,h4,legend{font-family:var(--font);text-wrap:balance}h1{font-weight:600;letter-spacing:-.04em}p{ text-wrap:pretty }
a,button,input,textarea,select,summary{outline-color:#171717}button,summary,a{touch-action:manipulation}
:is(a,button,input,textarea,select,summary):focus-visible{outline:2px solid #171717;outline-offset:3px}
summary{min-height:40px;align-content:center}button{cursor:pointer}button:disabled{cursor:default}input[type=checkbox],input[type=radio]{accent-color:#171717}
[hidden]{display:none!important}
:is(.workspace-top,.status-top,.review-top){min-height:72px;padding:0 clamp(20px,4vw,64px);display:flex;align-items:center;justify-content:space-between;gap:28px;background:#fff;border-bottom:1px solid #ededed}
:is(.workspace-top,.status-top,.review-top)>.workspace-brand{font:600 16px/1.4 var(--font);letter-spacing:-.04em;text-decoration:none;white-space:nowrap}
.workspace-brand span{display:none}
:is(.workspace-top,.status-top,.review-top) nav{display:flex;align-items:center;gap:24px;flex-wrap:wrap}
:is(.workspace-top,.status-top,.review-top) nav a{display:inline-flex;align-items:center;min-height:72px;min-width:40px;padding:0;border-radius:0;border-bottom:2px solid transparent;font:400 12px/1.4 var(--font);color:#737373;background:none;text-decoration:none}
:is(.workspace-top,.status-top,.review-top) nav a[aria-current=page]{background:none;border-bottom-color:#171717;color:#171717;font-weight:550}
.eyebrow{font:500 11px/1.5 var(--font);text-transform:none;letter-spacing:0;color:#737373}
.primary,.intake-primary,.plan-action button,.primary-link,.workflow-primary{background:#171717;color:#fff;border-color:#171717;min-height:40px;border-radius:7px;font-size:13px}
:is(.primary,.intake-primary,.plan-action button,.workflow-primary):not(:disabled):hover{background:#333}
.empty-state h3,.detail h1,.role-heading,.detail-body h2,.simulation h3,.simulation-section>.section-title h3{font-family:var(--font);font-weight:600}
@media(max-width:900px){:is(.workspace-top,.status-top,.review-top){align-items:flex-start;flex-direction:column;gap:0;padding-top:16px}:is(.workspace-top,.status-top,.review-top) nav{gap:20px;max-width:100%;flex-wrap:nowrap;overflow-x:auto}:is(.workspace-top,.status-top,.review-top) nav a{min-height:48px;white-space:nowrap;flex-shrink:0}}
`;
