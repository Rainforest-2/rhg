export const CHARACTER_MODIFICATION_STYLE_ID = 'character-modification-responsive-style';

export const CHARACTER_MODIFICATION_RESPONSIVE_CSS = `
.cm-overlay{position:fixed;inset:0;z-index:99982;display:none;overflow:hidden;background:rgba(16,18,18,.58);letter-spacing:0}
.cm-overlay.is-open,.cm-overlay.cm-host-active{display:block}
.cm-host-layer{box-sizing:border-box;min-width:0;min-height:0;letter-spacing:0;color:#202423;font-family:"Hiragino Kaku Gothic ProN","Yu Gothic",system-ui,sans-serif}
.cm-host-layer *,.cm-host-layer *::before,.cm-host-layer *::after{box-sizing:border-box;min-width:0;letter-spacing:0}
.cm-host-layer[hidden]{display:none!important}
.cm-embedded-container{height:min(88dvh,780px);max-height:calc(100dvh - 20px);overflow:hidden;overscroll-behavior:contain;isolation:isolate}
.cm-embedded-container>[hidden]:not(.cm-host-layer){display:none!important}
.cm-host-layer-standalone{position:absolute;top:var(--cm-viewport-top,0px);right:0;bottom:auto;left:0;z-index:3;display:grid;place-items:center;height:var(--cm-viewport-height,100dvh);max-height:100dvh;padding:calc(10px + env(safe-area-inset-top,0px)) calc(10px + env(safe-area-inset-right,0px)) calc(10px + env(safe-area-inset-bottom,0px)) calc(10px + env(safe-area-inset-left,0px));overflow:hidden}
.cm-host-layer-embedded{position:relative;inset:auto;z-index:auto;display:flex;flex:0 1 auto;width:100%;height:min(100%,var(--cm-available-height,var(--cm-viewport-height,100dvh)));max-height:var(--cm-available-height,var(--cm-viewport-height,100dvh));min-height:0;margin-top:var(--cm-viewport-inset-top,0px);overflow:hidden;overscroll-behavior:contain;background:#f4f5f2}
.cm-backdrop{position:absolute;inset:0;background:rgba(16,18,18,.62);backdrop-filter:blur(2px)}
.cm-dialog{position:relative;z-index:1;width:min(1120px,100%);height:min(860px,calc(var(--cm-viewport-height,100dvh) - 20px - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px)));max-height:calc(var(--cm-viewport-height,100dvh) - 20px - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px));overflow:hidden;border:3px solid #202423;border-radius:8px;background:#f4f5f2;box-shadow:0 10px 28px rgba(0,0,0,.34)}
.cm-dialog-embedded{z-index:auto;width:100%;height:100%;max-height:none;border:0;border-radius:0;box-shadow:none}
.cm-editor-root,.cm-editor{width:100%;height:100%;min-height:0;overflow:hidden}
.cm-editor{display:grid;grid-template-rows:auto auto minmax(0,1fr) auto;background:#f4f5f2}
.cm-header{display:grid;grid-template-columns:40px 52px minmax(0,1fr) auto;align-items:center;gap:10px;padding:10px 12px;border-bottom:2px solid #202423;background:#fff}
.cm-subject-icon{display:grid;place-items:center;width:52px;height:52px;overflow:hidden;border:2px solid #202423;border-radius:6px;background:#e8ece8}
.cm-subject-icon img{display:block;width:100%;height:100%;object-fit:contain}
.cm-subject-icon>span{font-size:1.35rem;font-weight:800}
.cm-identity{display:grid;grid-template-columns:minmax(140px,.8fr) minmax(180px,1.2fr);align-items:center;gap:12px}
.cm-subject-title,.cm-title{display:grid;gap:2px;overflow-wrap:anywhere}
.cm-subject-name,.cm-title strong{font-size:1rem;font-weight:800;line-height:1.2}
.cm-subject-title small,.cm-title span{font-size:.72rem;line-height:1.25;color:#5c6461}
.cm-changed-count{display:inline-flex;align-items:center;justify-content:center;min-width:88px;min-height:34px;padding:5px 9px;border:2px solid #202423;border-radius:6px;background:#e9b44c;font-size:.78rem;font-weight:800;color:#202423}
.cm-toolbar{display:grid;grid-template-columns:minmax(180px,1fr) auto minmax(130px,auto) auto;align-items:center;gap:10px;padding:8px 12px;border-bottom:1px solid #c8ceca;background:#eef1ed}
.cm-search-label{position:relative;display:block}
.cm-search{width:100%;min-height:38px;padding:7px 10px;border:2px solid #606965;border-radius:6px;background:#fff;color:#202423;font:inherit;font-size:.85rem}
.cm-filter-check,.cm-boolean,.cm-option-check{display:inline-flex;align-items:center;gap:8px;min-height:36px;font-size:.8rem;font-weight:700;cursor:pointer}
.cm-ability-filter{display:block}
.cm-ability-filter .cm-select{min-height:36px;font-size:.76rem}
.cm-filter-check input,.cm-boolean input,.cm-option-check input{width:20px;height:20px;flex:0 0 auto;margin:0;accent-color:#0b7a65}
.cm-history{display:flex;gap:6px}
.cm-icon-button,.cm-command{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:36px;border:2px solid #202423;border-radius:6px;background:#fff;color:#202423;font:inherit;font-size:.78rem;font-weight:800;line-height:1.1;cursor:pointer;touch-action:manipulation}
.cm-icon-button{width:38px;min-width:38px;padding:0}
.cm-command{padding:7px 11px}
.cm-icon-button:hover:not(:disabled),.cm-command:hover:not(:disabled){background:#e7eee9}
.cm-icon-button:active:not(:disabled),.cm-command:active:not(:disabled){transform:translateY(1px)}
.cm-icon-button:disabled,.cm-command:disabled{cursor:not-allowed;opacity:.45}
.cm-command.is-primary{background:#0b7a65;color:#fff;border-color:#15453b}
.cm-command.is-primary:hover:not(:disabled){background:#086753}
.cm-close{background:#202423;color:#fff}
.cm-workspace{display:grid;grid-template-columns:minmax(150px,190px) minmax(0,1fr);min-height:0;overflow:hidden}
.cm-categories{display:flex;flex-direction:column;gap:4px;min-height:0;padding:10px 8px;overflow:auto;border-right:2px solid #202423;background:#e3e7e2;overscroll-behavior:contain}
.cm-category{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:6px;width:100%;min-height:38px;padding:7px 8px;border:1px solid transparent;border-radius:6px;background:transparent;color:#303633;font:inherit;font-size:.76rem;font-weight:800;text-align:left;cursor:pointer}
.cm-category:hover{background:#f7f8f5}
.cm-category.is-active{border-color:#202423;background:#fff;box-shadow:inset 4px 0 0 #0b7a65}
.cm-category-count{display:inline-grid;place-items:center;min-width:23px;height:23px;padding:0 5px;border-radius:6px;background:#e9b44c;color:#202423;font-size:.68rem}
.cm-content{display:grid;grid-template-rows:auto auto minmax(0,1fr);min-height:0;overflow:hidden;background:#fff}
.cm-content-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 12px;border-bottom:1px solid #d8ddda}
.cm-content-head h2{margin:0;font-size:1rem;line-height:1.2}
.cm-validation-summary{margin:8px 12px 0;padding:8px 10px;border:2px solid #9a3412;border-radius:6px;background:#fff4e8;font-size:.76rem}
.cm-validation-summary strong{display:block;margin-bottom:4px}
.cm-validation-summary ul{margin:0;padding-left:20px}
.cm-field-list{min-height:0;padding:0 12px 16px;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;scrollbar-gutter:stable}
.cm-field{display:grid;gap:9px;padding:13px 0;border-bottom:1px solid #d8ddda}
.cm-field:last-child{border-bottom:0}
.cm-field.is-changed{box-shadow:inset 4px 0 0 #e9b44c;padding-left:12px}
.cm-field.has-error{box-shadow:inset 4px 0 0 #b42318;padding-left:12px}
.cm-field-head{display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:start;gap:8px}
.cm-field-title{display:grid;gap:2px;overflow-wrap:anywhere}
.cm-field-title h3{margin:0;font-size:.9rem;line-height:1.25}
.cm-field-title code{font-size:.64rem;color:#69716e;overflow-wrap:anywhere}
.cm-field-badges{display:flex;align-items:center;justify-content:flex-end;gap:5px;flex-wrap:wrap}
.cm-badge{display:inline-flex;align-items:center;min-height:24px;padding:3px 6px;border:1px solid #7b8580;border-radius:5px;background:#f0f2ef;font-size:.62rem;font-weight:800;color:#4f5754}
.cm-badge.is-changed{border-color:#7a5a00;background:#fff1b8;color:#594100}
.cm-badge.is-read-only{border-color:#7b4141;background:#fbe9e7;color:#7a211d}
.cm-field-reset{width:34px;min-width:34px;min-height:34px}
.cm-comparison{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;gap:8px}
.cm-value-block{display:grid;gap:3px;min-height:52px;padding:7px 9px;border:1px solid #aeb7b2;border-radius:6px;background:#f8f9f7}
.cm-value-block>span{font-size:.62rem;font-weight:800;color:#626a67}
.cm-value-block output{font-size:.82rem;font-weight:800;line-height:1.25;overflow-wrap:anywhere}
.cm-value-arrow{color:#0b7a65}
.cm-field-control{display:grid;gap:8px}
.cm-scalar{display:grid;gap:5px}
.cm-input-label{font-size:.72rem;font-weight:800;color:#3e4642}
.cm-number-stepper{display:grid;grid-template-columns:38px minmax(72px,220px) 38px;gap:6px;align-items:stretch}
.cm-number-input,.cm-select{width:100%;min-height:38px;padding:6px 8px;border:2px solid #606965;border-radius:6px;background:#fff;color:#202423;font:inherit;font-size:.88rem;font-variant-numeric:tabular-nums}
.cm-number-input:invalid,.cm-select:invalid{border-color:#b42318}
.cm-unit-hint{font-size:.65rem;color:#626a67}
.cm-structured{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin:0;padding:10px;border:1px solid #aeb7b2;border-radius:6px;background:#f8f9f7}
.cm-structured>.cm-scalar:first-of-type{grid-column:1/-1}
.cm-scalar.is-disabled-by-dependency{opacity:.48}
.cm-multi-select{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:5px 10px;margin:0;padding:8px 10px;border:1px solid #aeb7b2;border-radius:6px;background:#f8f9f7}
.cm-read-only-note,.cm-dependency-note,.cm-error,.cm-warning{margin:0;font-size:.7rem;line-height:1.35;overflow-wrap:anywhere}
.cm-read-only-note{padding:8px;border-left:4px solid #8c4b45;background:#fbe9e7;color:#70231e}
.cm-dependency-note{padding:6px 8px;border-left:4px solid #b68616;background:#fff7d6;color:#5b450c}
.cm-field-problems{display:grid;gap:4px}
.cm-error{color:#a61b13}
.cm-warning{color:#765000}
.cm-empty{margin:auto;padding:28px 12px;color:#626a67;font-size:.82rem;text-align:center}
.cm-footer{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:10px;padding:9px 12px calc(9px + env(safe-area-inset-bottom,0px));border-top:2px solid #202423;background:#eef1ed}
.cm-status{min-height:20px;font-size:.72rem;font-weight:700;color:#4f5754;overflow-wrap:anywhere}
.cm-status.is-error{color:#a61b13}
.cm-footer-commands{display:flex;justify-content:flex-end;gap:7px;flex-wrap:wrap}
.cm-import-preview{display:grid;grid-template-rows:auto minmax(0,1fr) auto;width:100%;height:100%;min-height:0;background:#fff}
.cm-preview-head{display:grid;grid-template-columns:40px minmax(0,1fr);align-items:center;gap:10px;padding:10px 12px;border-bottom:2px solid #202423;background:#eef1ed}
.cm-preview-head h2{margin:0;font-size:1rem}
.cm-preview-body{min-height:0;padding:12px;overflow:auto;overscroll-behavior:contain}
.cm-preview-summary{display:grid;grid-template-columns:minmax(130px,1fr) minmax(80px,1fr);margin:0 0 14px;border:1px solid #aeb7b2;border-radius:6px;overflow:hidden}
.cm-preview-summary dt,.cm-preview-summary dd{margin:0;padding:8px;border-bottom:1px solid #d8ddda}
.cm-preview-summary dt{font-size:.72rem;font-weight:800;background:#eef1ed}
.cm-preview-summary dd{font-size:.8rem;font-weight:800}
.cm-preview-section{margin-bottom:12px}
.cm-preview-section h3{margin:0 0 5px;font-size:.82rem}
.cm-preview-section ul{margin:0;padding-left:20px;font-size:.74rem}
.cm-preview-foot{display:flex;justify-content:flex-end;gap:8px;padding:10px 12px calc(10px + env(safe-area-inset-bottom,0px));border-top:2px solid #202423;background:#eef1ed}
.cm-sr-only{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}
.cm-host-layer :focus-visible{outline:3px solid #d98300;outline-offset:2px}
.cm-host-layer.is-busy{cursor:progress}

@media(max-width:760px){
  .cm-embedded-container{height:100dvh;max-height:100dvh}
  .cm-host-layer-standalone{padding:0}
  .cm-dialog{width:100%;height:var(--cm-viewport-height,100dvh);max-height:100dvh;border-left:0;border-right:0;border-radius:0}
  .cm-header{grid-template-columns:38px 44px minmax(0,1fr) auto;gap:7px;padding:calc(7px + env(safe-area-inset-top,0px)) calc(8px + env(safe-area-inset-right,0px)) 7px calc(8px + env(safe-area-inset-left,0px))}
  .cm-subject-icon{width:44px;height:44px}
  .cm-identity{grid-template-columns:minmax(0,1fr)}
  .cm-title span{display:none}
  .cm-title{display:none}
  .cm-changed-count{min-width:72px;min-height:31px;padding:4px 6px;font-size:.68rem}
  .cm-toolbar{grid-template-columns:minmax(0,1fr) minmax(112px,auto) auto;gap:7px;padding:7px calc(8px + env(safe-area-inset-right,0px)) 7px calc(8px + env(safe-area-inset-left,0px))}
  .cm-search-label{grid-column:1/3}
  .cm-filter-check{grid-column:1}
  .cm-ability-filter{grid-column:2}
  .cm-history{grid-column:3;grid-row:1/3}
  .cm-workspace{grid-template-columns:minmax(0,1fr);grid-template-rows:auto minmax(0,1fr)}
  .cm-categories{flex-direction:row;padding:6px calc(6px + env(safe-area-inset-right,0px)) 6px calc(6px + env(safe-area-inset-left,0px));overflow-x:auto;overflow-y:hidden;border-right:0;border-bottom:2px solid #202423;scrollbar-width:thin}
  .cm-category{flex:0 0 auto;width:auto;min-height:34px;white-space:nowrap}
  .cm-category.is-active{box-shadow:inset 0 -4px 0 #0b7a65}
  .cm-content-head{padding:7px 8px}
  .cm-content-head .cm-command{min-height:32px;padding:5px 7px;font-size:.66rem}
  .cm-field-list{padding:0 8px 12px}
  .cm-field{gap:7px;padding:10px 0}
  .cm-field.is-changed,.cm-field.has-error{padding-left:8px}
  .cm-field-head{grid-template-columns:minmax(0,1fr) auto}
  .cm-field-badges{grid-column:1}
  .cm-field-reset{grid-column:2;grid-row:1/3}
  .cm-footer{grid-template-columns:minmax(0,1fr);gap:5px;padding:6px calc(8px + env(safe-area-inset-right,0px)) calc(6px + env(safe-area-inset-bottom,0px)) calc(8px + env(safe-area-inset-left,0px))}
  .cm-status:empty{display:none}
  .cm-footer-commands{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px}
  .cm-footer .cm-command{min-height:36px;padding:5px 4px;font-size:.65rem}
}

@media(max-width:420px){
  .cm-header{grid-template-columns:36px 40px minmax(0,1fr) auto}
  .cm-subject-icon{width:40px;height:40px}
  .cm-subject-name{font-size:.84rem}
  .cm-changed-count{min-width:64px;font-size:.62rem}
  .cm-comparison{grid-template-columns:minmax(0,1fr) 20px minmax(0,1fr);gap:4px}
  .cm-value-block{padding:6px}
  .cm-value-block output{font-size:.74rem}
  .cm-structured{grid-template-columns:minmax(0,1fr);padding:8px}
  .cm-structured>.cm-scalar:first-of-type{grid-column:auto}
  .cm-number-stepper{grid-template-columns:36px minmax(64px,1fr) 36px}
  .cm-multi-select{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
  .cm-footer-commands{grid-template-columns:repeat(2,minmax(0,1fr))}
}

@media(orientation:landscape) and (max-height:520px){
  .cm-embedded-container{height:calc(100dvh - 8px);max-height:calc(100dvh - 8px)}
  .cm-host-layer-standalone{padding:calc(4px + env(safe-area-inset-top,0px)) calc(6px + env(safe-area-inset-right,0px)) calc(4px + env(safe-area-inset-bottom,0px)) calc(6px + env(safe-area-inset-left,0px))}
  .cm-dialog{width:min(1080px,100%);height:calc(var(--cm-viewport-height,100dvh) - 8px - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px));max-height:calc(var(--cm-viewport-height,100dvh) - 8px - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px));border-radius:6px}
  .cm-dialog.cm-dialog-embedded{width:100%;height:100%;max-height:100%;border-radius:0}
  .cm-editor{grid-template-rows:auto auto minmax(0,1fr) auto}
  .cm-header{grid-template-columns:32px 36px minmax(0,1fr) auto;gap:6px;padding:4px 6px}
  .cm-subject-icon{width:36px;height:36px}
  .cm-identity{grid-template-columns:minmax(100px,.8fr) minmax(120px,1.2fr);gap:8px}
  .cm-subject-name,.cm-title strong{font-size:.76rem}
  .cm-subject-title small,.cm-title span{font-size:.56rem}
  .cm-changed-count{min-width:68px;min-height:28px;font-size:.6rem}
  .cm-icon-button{width:30px;min-width:30px;min-height:30px}
  .cm-toolbar{grid-template-columns:minmax(140px,1fr) auto minmax(110px,auto) auto;gap:6px;padding:4px 6px}
  .cm-search-label,.cm-filter-check,.cm-ability-filter,.cm-history{grid-column:auto;grid-row:auto}
  .cm-search{min-height:30px;padding-top:4px;padding-bottom:4px;font-size:.7rem}
  .cm-filter-check{min-height:30px;font-size:.66rem}
  .cm-filter-check input{width:17px;height:17px}
  .cm-workspace{grid-template-columns:142px minmax(0,1fr);grid-template-rows:minmax(0,1fr)}
  .cm-categories{flex-direction:column;padding:5px;overflow:auto;border-right:2px solid #202423;border-bottom:0}
  .cm-category{width:100%;min-height:28px;padding:4px 6px;font-size:.61rem}
  .cm-category.is-active{box-shadow:inset 4px 0 0 #0b7a65}
  .cm-category-count{min-width:19px;height:19px;font-size:.55rem}
  .cm-content-head{padding:4px 7px}
  .cm-content-head h2{font-size:.78rem}
  .cm-content-head .cm-command{min-height:28px;padding:3px 7px;font-size:.56rem}
  .cm-validation-summary{margin:4px 7px 0;padding:4px 7px;font-size:.58rem}
  .cm-field-list{padding:0 7px 8px}
  .cm-field{grid-template-columns:minmax(170px,.8fr) minmax(240px,1.2fr);gap:5px 9px;padding:6px 0}
  .cm-field.is-changed,.cm-field.has-error{padding-left:7px}
  .cm-field-head{grid-column:1;grid-template-columns:minmax(0,1fr) auto}
  .cm-field-title h3{font-size:.7rem}
  .cm-field-title code{font-size:.5rem}
  .cm-field-badges{grid-column:1}
  .cm-field-reset{grid-column:2;grid-row:1/3;width:28px;min-width:28px;min-height:28px}
  .cm-badge{min-height:19px;padding:2px 4px;font-size:.5rem}
  .cm-comparison{grid-column:1;gap:3px}
  .cm-value-block{min-height:38px;padding:3px 5px}
  .cm-value-block>span{font-size:.49rem}
  .cm-value-block output{font-size:.62rem}
  .cm-field-control{grid-column:2;grid-row:1/3;align-content:start}
  .cm-field-problems{grid-column:2}
  .cm-input-label,.cm-unit-hint,.cm-read-only-note,.cm-dependency-note,.cm-error,.cm-warning{font-size:.56rem}
  .cm-number-stepper{grid-template-columns:30px minmax(60px,1fr) 30px;gap:4px}
  .cm-number-input,.cm-select{min-height:30px;padding:3px 6px;font-size:.68rem}
  .cm-structured{grid-template-columns:repeat(3,minmax(0,1fr));gap:5px;padding:5px}
  .cm-structured>.cm-scalar:first-of-type{grid-column:1}
  .cm-multi-select{grid-template-columns:repeat(4,minmax(78px,1fr));gap:3px 6px;padding:4px 6px}
  .cm-option-check,.cm-boolean{min-height:28px;font-size:.58rem}
  .cm-option-check input,.cm-boolean input{width:16px;height:16px}
  .cm-footer{grid-template-columns:minmax(0,1fr) auto;gap:5px;padding:4px 6px calc(4px + env(safe-area-inset-bottom,0px))}
  .cm-status{font-size:.55rem;min-height:0}
  .cm-footer-commands{display:flex;gap:4px}
  .cm-footer .cm-command{min-height:29px;padding:3px 7px;font-size:.56rem}
  .cm-preview-head{padding:4px 6px}
  .cm-preview-head h2{font-size:.76rem}
  .cm-preview-body{padding:7px}
  .cm-preview-foot{padding:4px 6px calc(4px + env(safe-area-inset-bottom,0px))}
}

@media(orientation:landscape) and (max-height:390px){
  .cm-title{display:none}
  .cm-identity{grid-template-columns:minmax(0,1fr)}
  .cm-toolbar{grid-template-columns:minmax(120px,1fr) auto minmax(100px,auto) auto}
  .cm-category{min-height:24px}
  .cm-field{grid-template-columns:minmax(145px,.72fr) minmax(220px,1.28fr)}
  .cm-footer .cm-command{min-height:26px}
}

@media(prefers-reduced-motion:reduce){
  .cm-host-layer *{scroll-behavior:auto!important;transition:none!important;animation:none!important}
}
`;

export function installCharacterModificationResponsiveStyles(documentRef = globalThis.document) {
  if (!documentRef?.head) return null;
  let style = documentRef.getElementById(CHARACTER_MODIFICATION_STYLE_ID);
  if (style) return style;
  style = documentRef.createElement('style');
  style.id = CHARACTER_MODIFICATION_STYLE_ID;
  style.textContent = CHARACTER_MODIFICATION_RESPONSIVE_CSS;
  documentRef.head.appendChild(style);
  return style;
}
