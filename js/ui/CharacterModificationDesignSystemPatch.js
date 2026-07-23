import { CharacterModificationRenderer } from './character-modification/CharacterModificationRenderer.js';

const PATCH_FLAG = Symbol.for('rhg.character-modification-design-system.v1');
const STYLE_ID = 'character-modification-design-system-style';

const CSS = `
.cm-host-layer{--cm-ink:#18201d;--cm-muted:#5a6560;--cm-canvas:#f3f6f4;--cm-surface:#fff;--cm-soft:#f7f9f8;--cm-line:#d4dcd7;--cm-strong:#738078;--cm-primary:#087864;--cm-primary-hover:#056451;--cm-accent:#e8ad37;--cm-accent-soft:#fff4d6;--cm-danger:#9e2d25;--cm-focus:#f0a000;--cm-r8:8px;--cm-r12:12px;color:var(--cm-ink)!important;font-family:"Hiragino Kaku Gothic ProN","Yu Gothic",system-ui,-apple-system,sans-serif!important;line-height:1.45}
.cm-host-layer .cm-dialog{overflow:hidden!important;border:1px solid rgba(24,32,29,.76)!important;border-radius:14px!important;background:var(--cm-canvas)!important;box-shadow:0 18px 54px rgba(13,28,22,.22)!important}
.cm-host-layer .cm-dialog-embedded{border:0!important;border-radius:12px!important;box-shadow:none!important}
.cm-host-layer .cm-editor{grid-template-rows:auto auto minmax(0,1fr) auto!important;min-width:0!important;min-height:0!important;overflow:hidden!important;background:var(--cm-canvas)!important;color:var(--cm-ink)!important}

/* Custom-stage game styling must never leak into the shared status editor. */
html body.nyanko-ui-polish .formation-custom-builder .cm-host-layer .cm-editor button,
html body.nyanko-ui-polish .formation-custom-spawn-modal-card .cm-host-layer .cm-editor button,
.cm-host-layer .cm-editor button{-webkit-appearance:none!important;appearance:none!important;min-width:0;min-height:44px!important;height:auto;margin:0!important;padding:0 13px!important;border:1.5px solid var(--cm-strong)!important;border-radius:var(--cm-r8)!important;background:var(--cm-surface)!important;background-image:none!important;box-shadow:none!important;color:var(--cm-ink)!important;-webkit-text-fill-color:var(--cm-ink)!important;font:inherit!important;font-size:.82rem!important;font-weight:750!important;letter-spacing:0!important;line-height:1.15!important;text-shadow:none!important;transform:none!important;cursor:pointer;touch-action:manipulation}
.cm-host-layer .cm-editor button:hover:not(:disabled){background:var(--cm-soft)!important;border-color:var(--cm-ink)!important}
.cm-host-layer .cm-editor button:active:not(:disabled){background:#eef2ef!important;transform:translateY(1px)!important}
.cm-host-layer .cm-editor button:disabled{cursor:not-allowed!important;opacity:.46!important}
.cm-host-layer .cm-editor :focus-visible{outline:3px solid var(--cm-focus)!important;outline-offset:2px!important}
.cm-host-layer .cm-icon-button{display:inline-grid!important;place-items:center!important;width:44px!important;min-width:44px!important;padding:0!important}
.cm-host-layer .cm-close{border-color:#111815!important;background:#202824!important;color:#fff!important;-webkit-text-fill-color:#fff!important}
.cm-host-layer .cm-close:hover:not(:disabled){background:#111815!important}
.cm-host-layer .cm-command.is-primary{min-width:116px!important;border-color:#075b4c!important;background:var(--cm-primary)!important;color:#fff!important;-webkit-text-fill-color:#fff!important;font-weight:850!important}
.cm-host-layer .cm-command.is-primary:hover:not(:disabled){background:var(--cm-primary-hover)!important}
.cm-host-layer .cm-utility-command{border-color:#9aa69f!important;background:var(--cm-soft)!important;color:#35403b!important;-webkit-text-fill-color:#35403b!important}
.cm-host-layer [data-cm-action='reset-all']{color:var(--cm-danger)!important;-webkit-text-fill-color:var(--cm-danger)!important}

.cm-host-layer .cm-header{display:grid!important;grid-template-columns:44px 52px minmax(0,1fr) auto!important;align-items:center!important;gap:12px!important;min-height:72px!important;padding:9px 14px!important;border:0!important;border-bottom:1px solid var(--cm-line)!important;background:var(--cm-surface)!important}
.cm-host-layer .cm-subject-icon{width:52px!important;height:52px!important;border:1.5px solid #56625c!important;border-radius:10px!important;background:#edf1ee!important;box-shadow:none!important}
.cm-host-layer .cm-identity{display:grid!important;grid-template-columns:minmax(220px,1fr) minmax(170px,.75fr)!important;align-items:center!important;gap:18px!important}
.cm-host-layer .cm-subject-name,.cm-host-layer .cm-title strong{color:var(--cm-ink)!important;-webkit-text-fill-color:var(--cm-ink)!important;font-size:1rem!important;font-weight:850!important;line-height:1.25!important}
.cm-host-layer .cm-subject-title small,.cm-host-layer .cm-title span{margin-top:2px;color:var(--cm-muted)!important;-webkit-text-fill-color:var(--cm-muted)!important;font-size:.73rem!important;font-weight:600!important}
.cm-host-layer .cm-changed-count{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-width:88px!important;min-height:36px!important;padding:5px 10px!important;border:1.5px solid #6e5317!important;border-radius:9px!important;background:var(--cm-accent-soft)!important;color:#5c430b!important;-webkit-text-fill-color:#5c430b!important;font-size:.76rem!important;font-weight:850!important;font-variant-numeric:tabular-nums}

.cm-host-layer .cm-toolbar{display:grid!important;grid-template-columns:minmax(220px,1fr) auto minmax(138px,auto) auto!important;align-items:center!important;gap:10px!important;min-height:54px!important;padding:7px 14px!important;border:0!important;border-bottom:1px solid var(--cm-line)!important;background:#eef2ef!important}
.cm-host-layer .cm-search,.cm-host-layer .cm-number-input,.cm-host-layer .cm-select{-webkit-appearance:none!important;appearance:none!important;width:100%!important;min-width:0!important;min-height:44px!important;padding:7px 11px!important;border:1.5px solid var(--cm-strong)!important;border-radius:var(--cm-r8)!important;background:var(--cm-surface)!important;background-image:none!important;box-shadow:none!important;color:var(--cm-ink)!important;-webkit-text-fill-color:var(--cm-ink)!important;font:inherit!important;font-size:.9rem!important;font-weight:650!important;line-height:1.2!important}
.cm-host-layer .cm-search::placeholder{color:#7d8983!important;opacity:1}
.cm-host-layer .cm-search:focus,.cm-host-layer .cm-number-input:focus,.cm-host-layer .cm-select:focus{border-color:var(--cm-primary)!important;box-shadow:0 0 0 3px rgba(8,120,100,.13)!important}
.cm-host-layer .cm-filter-check,.cm-host-layer .cm-boolean,.cm-host-layer .cm-option-check{gap:8px!important;min-height:44px!important;color:#303a35!important;-webkit-text-fill-color:#303a35!important;font-size:.8rem!important;font-weight:750!important}
.cm-host-layer .cm-filter-check input,.cm-host-layer .cm-boolean input,.cm-host-layer .cm-option-check input{width:22px!important;height:22px!important;min-width:22px!important;margin:0!important;accent-color:var(--cm-primary)!important}
.cm-host-layer .cm-history{gap:7px!important}

.cm-host-layer .cm-workspace{display:grid!important;grid-template-columns:minmax(180px,218px) minmax(0,1fr)!important;min-width:0!important;min-height:0!important;overflow:hidden!important;background:var(--cm-canvas)!important}
.cm-host-layer .cm-categories{display:flex!important;flex-direction:column!important;gap:5px!important;min-width:0!important;min-height:0!important;padding:12px 10px!important;overflow:auto!important;border:0!important;border-right:1px solid var(--cm-line)!important;background:#e8ede9!important;overscroll-behavior:contain!important;scrollbar-gutter:stable}
.cm-host-layer .cm-category{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;align-items:center!important;width:100%!important;min-height:43px!important;padding:8px 10px!important;border:1px solid transparent!important;border-radius:9px!important;background:transparent!important;color:#2f3934!important;-webkit-text-fill-color:#2f3934!important;box-shadow:none!important;text-align:left!important;font-size:.8rem!important;font-weight:800!important}
.cm-host-layer .cm-category:hover{background:rgba(255,255,255,.62)!important}
.cm-host-layer .cm-category.is-active{border-color:#69766f!important;background:var(--cm-surface)!important;box-shadow:inset 4px 0 0 var(--cm-primary)!important;color:#14201b!important;-webkit-text-fill-color:#14201b!important}
.cm-host-layer .cm-category-count{min-width:25px!important;height:25px!important;border:0!important;border-radius:999px!important;background:var(--cm-accent)!important;color:#2b2107!important;-webkit-text-fill-color:#2b2107!important;font-size:.68rem!important;font-weight:850!important}

.cm-host-layer .cm-content{display:grid!important;grid-template-rows:auto auto minmax(0,1fr)!important;min-width:0!important;min-height:0!important;overflow:hidden!important;background:var(--cm-surface)!important}
.cm-host-layer .cm-content-head{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:12px!important;min-height:54px!important;padding:8px 16px!important;border:0!important;border-bottom:1px solid var(--cm-line)!important;background:var(--cm-surface)!important}
.cm-host-layer .cm-content-head h2{margin:0!important;color:var(--cm-ink)!important;-webkit-text-fill-color:var(--cm-ink)!important;font-size:1rem!important;font-weight:850!important;line-height:1.25!important}
.cm-host-layer .cm-content-head [data-cm-action='reset-category']{min-height:38px!important;border-color:transparent!important;background:transparent!important;color:#59655f!important;-webkit-text-fill-color:#59655f!important;font-size:.74rem!important}
.cm-host-layer .cm-content-head [data-cm-action='reset-category']:hover:not(:disabled){background:#f2f5f3!important}
.cm-host-layer .cm-field-list{min-width:0!important;min-height:0!important;padding:14px 16px 22px!important;overflow-y:auto!important;overflow-x:hidden!important;overscroll-behavior:contain!important;-webkit-overflow-scrolling:touch;scrollbar-gutter:stable}
.cm-host-layer .cm-field{display:grid!important;grid-template-columns:minmax(180px,.72fr) minmax(260px,1.28fr)!important;column-gap:24px!important;row-gap:12px!important;margin:0 0 12px!important;padding:16px!important;border:1px solid var(--cm-line)!important;border-radius:var(--cm-r12)!important;background:var(--cm-surface)!important;box-shadow:0 1px 2px rgba(17,31,24,.04)!important}
.cm-host-layer .cm-field:last-child{margin-bottom:0!important}
.cm-host-layer .cm-field.is-changed{border-color:#b78922!important;background:linear-gradient(90deg,var(--cm-accent-soft),#fff 34%)!important;box-shadow:inset 4px 0 0 var(--cm-accent)!important}
.cm-host-layer .cm-field.has-error{border-color:#b94c43!important;box-shadow:inset 4px 0 0 #b94c43!important}
.cm-host-layer .cm-field-head{grid-column:1/-1!important;display:grid!important;grid-template-columns:minmax(0,1fr) auto auto!important;align-items:start!important;gap:10px!important}
.cm-host-layer .cm-field-title h3{margin:0!important;color:var(--cm-ink)!important;-webkit-text-fill-color:var(--cm-ink)!important;font-size:.94rem!important;font-weight:850!important;line-height:1.3!important}
.cm-host-layer .cm-field-title code{display:none!important}
.cm-host-layer .cm-badge{min-height:27px!important;padding:4px 8px!important;border:1px solid #a2aca6!important;border-radius:999px!important;background:#f0f3f1!important;color:#53605a!important;-webkit-text-fill-color:#53605a!important;font-size:.64rem!important;font-weight:800!important}
.cm-host-layer .cm-badge.is-changed{border-color:#9b741a!important;background:var(--cm-accent-soft)!important;color:#684d0d!important;-webkit-text-fill-color:#684d0d!important}
.cm-host-layer .cm-field-reset{width:40px!important;min-width:40px!important;min-height:40px!important;padding:0!important}
.cm-host-layer .cm-comparison{grid-column:1!important;align-self:start!important;display:grid!important;grid-template-columns:minmax(0,1fr)!important;gap:8px!important;width:100%!important;max-width:none!important}
.cm-host-layer .cm-comparison .cm-value-arrow{display:none!important}
.cm-host-layer .cm-comparison.is-compact-unchanged .cm-value-block:last-child{display:none!important}
.cm-host-layer .cm-value-block{display:grid!important;gap:3px!important;min-height:58px!important;padding:9px 11px!important;border:1px solid var(--cm-line)!important;border-radius:9px!important;background:var(--cm-soft)!important}
.cm-host-layer .cm-value-block>span{color:#68746e!important;-webkit-text-fill-color:#68746e!important;font-size:.65rem!important;font-weight:750!important}
.cm-host-layer .cm-value-block output{color:var(--cm-ink)!important;-webkit-text-fill-color:var(--cm-ink)!important;font-size:.94rem!important;font-weight:850!important;font-variant-numeric:tabular-nums}
.cm-host-layer .cm-field-control{grid-column:2!important;align-self:center!important;min-width:0!important}
.cm-host-layer .cm-number-stepper{display:grid!important;grid-template-columns:44px minmax(100px,360px) 44px!important;gap:8px!important;align-items:stretch!important;width:min(100%,464px)!important}
.cm-host-layer .cm-number-stepper .cm-icon-button{width:44px!important;min-width:44px!important;padding:0!important;font-size:1.05rem!important}
.cm-host-layer .cm-input-label{color:#45514b!important;-webkit-text-fill-color:#45514b!important;font-size:.73rem!important;font-weight:800!important}
.cm-host-layer .cm-structured,.cm-host-layer .cm-multi-select{border:1px solid var(--cm-line)!important;border-radius:10px!important;background:var(--cm-soft)!important}
.cm-host-layer .cm-field-problems,.cm-host-layer .cm-read-only-note,.cm-host-layer .cm-dependency-note{grid-column:1/-1!important}
.cm-host-layer .cm-empty{margin:auto!important;padding:36px 18px!important;color:var(--cm-muted)!important;-webkit-text-fill-color:var(--cm-muted)!important;font-size:.84rem!important;text-align:center!important}

.cm-host-layer .cm-footer{position:relative!important;display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;align-items:center!important;gap:12px!important;min-height:64px!important;padding:8px 14px calc(8px + env(safe-area-inset-bottom,0px))!important;border:0!important;border-top:1px solid var(--cm-line)!important;background:rgba(247,249,248,.98)!important;box-shadow:0 -6px 18px rgba(21,38,29,.06)!important}
.cm-host-layer .cm-status{min-width:0!important;color:#56625c!important;-webkit-text-fill-color:#56625c!important;font-size:.72rem!important;font-weight:700!important}
.cm-host-layer .cm-footer-commands{display:flex!important;align-items:center!important;justify-content:flex-end!important;gap:8px!important;flex-wrap:nowrap!important}
.cm-host-layer .cm-footer .cm-command{min-height:44px!important;padding:0 13px!important;white-space:nowrap!important}
.cm-host-layer .cm-cancel-command{border-color:#4d5a53!important;background:#fff!important}

html body.nyanko-ui-polish .formation-custom-spawn-modal-card.cm-embedded-container{width:min(1180px,calc(100vw - 24px))!important;max-width:calc(100vw - 24px)!important;height:min(92dvh,860px)!important;max-height:calc(100dvh - 12px)!important;border:1px solid rgba(24,32,29,.76)!important;border-radius:14px!important;background:var(--cm-canvas,#f3f6f4)!important;box-shadow:0 22px 70px rgba(0,0,0,.35)!important}
html body.nyanko-ui-polish .formation-custom-spawn-modal-card.cm-embedded-container>.cm-host-layer-embedded{width:100%!important;height:100%!important;max-height:100%!important;margin-top:0!important;border-radius:13px!important;background:var(--cm-canvas)!important}
html body.nyanko-ui-polish .formation-custom-spawn-modal-card.cm-embedded-container .cm-dialog-embedded,
html body.nyanko-ui-polish .formation-custom-spawn-modal-card.cm-embedded-container .cm-editor-root{width:100%!important;max-width:none!important;height:100%!important;max-height:100%!important}

.cm-host-layer.cm-keyboard-open .cm-editor{grid-template-rows:46px minmax(0,1fr) 0!important}
.cm-host-layer.cm-keyboard-open .cm-footer{display:none!important;height:0!important;min-height:0!important;max-height:0!important;padding:0!important;border:0!important;box-shadow:none!important}
.cm-host-layer.cm-keyboard-open .cm-header{min-height:46px!important;height:46px!important;max-height:46px!important;padding:3px 7px!important}
.cm-host-layer.cm-keyboard-open .cm-field-list{padding-top:8px!important;padding-bottom:8px!important;scroll-padding-block:8px!important}
.cm-host-layer-embedded.cm-keyboard-open{margin-top:0!important;transform:none!important}

@media(max-width:980px){.cm-host-layer .cm-identity{grid-template-columns:minmax(0,1fr) auto!important;gap:10px!important}.cm-host-layer .cm-field{grid-template-columns:minmax(150px,.62fr) minmax(230px,1.38fr)!important;column-gap:16px!important}.cm-host-layer .cm-workspace{grid-template-columns:minmax(160px,190px) minmax(0,1fr)!important}.cm-host-layer .cm-footer .cm-command{padding-inline:10px!important;font-size:.76rem!important}}
@media(max-width:820px){.cm-host-layer .cm-field{grid-template-columns:minmax(0,1fr)!important;gap:10px!important}.cm-host-layer .cm-comparison,.cm-host-layer .cm-field-control{grid-column:1!important}.cm-host-layer .cm-comparison{max-width:440px!important}.cm-host-layer .cm-toolbar{grid-template-columns:minmax(150px,1fr) auto auto!important}.cm-host-layer .cm-ability-filter{grid-column:2!important}}
@media(max-width:700px){.cm-host-layer .cm-dialog{border-radius:0!important}.cm-host-layer .cm-header{grid-template-columns:44px 44px minmax(0,1fr) auto!important;gap:8px!important;min-height:62px!important;padding:7px 9px!important}.cm-host-layer .cm-subject-icon{width:44px!important;height:44px!important}.cm-host-layer .cm-identity{display:block!important}.cm-host-layer .cm-title{display:none!important}.cm-host-layer .cm-toolbar{grid-template-columns:minmax(0,1fr) auto auto!important;gap:7px!important;padding:6px 9px!important}.cm-host-layer .cm-filter-check span{font-size:.72rem!important}.cm-host-layer .cm-workspace{grid-template-columns:minmax(0,1fr)!important;grid-template-rows:auto minmax(0,1fr)!important}.cm-host-layer .cm-categories{flex-direction:row!important;gap:6px!important;padding:7px 9px!important;overflow-x:auto!important;overflow-y:hidden!important;border-right:0!important;border-bottom:1px solid var(--cm-line)!important;scrollbar-width:none}.cm-host-layer .cm-categories::-webkit-scrollbar{display:none}.cm-host-layer .cm-category{flex:0 0 auto!important;width:auto!important;min-width:106px!important;min-height:40px!important;padding:7px 10px!important}.cm-host-layer .cm-category.is-active{box-shadow:inset 0 -4px 0 var(--cm-primary)!important}.cm-host-layer .cm-content-head{min-height:48px!important;padding:6px 10px!important}.cm-host-layer .cm-field-list{padding:10px 10px 16px!important}.cm-host-layer .cm-field{padding:13px!important;margin-bottom:9px!important}.cm-host-layer .cm-footer{grid-template-columns:minmax(0,1fr)!important;gap:4px!important;padding:6px 8px calc(6px + env(safe-area-inset-bottom,0px))!important}.cm-host-layer .cm-status:empty{display:none!important}.cm-host-layer .cm-footer-commands{width:100%!important;display:grid!important;grid-template-columns:40px 40px 40px minmax(82px,auto) minmax(88px,1fr)!important;gap:5px!important}.cm-host-layer .cm-footer .cm-command{min-height:42px!important;padding:0 7px!important;font-size:.68rem!important}.cm-host-layer .cm-utility-command{width:40px!important;min-width:40px!important;padding:0!important}html body.nyanko-ui-polish .formation-custom-spawn-modal-card.cm-embedded-container{width:calc(100vw - 10px)!important;max-width:calc(100vw - 10px)!important;height:calc(100dvh - 8px)!important;max-height:calc(100dvh - 8px)!important;border-radius:10px!important}}
@media(max-width:420px){.cm-host-layer .cm-header{grid-template-columns:42px minmax(0,1fr) auto!important}.cm-host-layer .cm-subject-icon{display:none!important}.cm-host-layer .cm-changed-count{min-width:72px!important;padding-inline:7px!important;font-size:.68rem!important}.cm-host-layer .cm-toolbar{grid-template-columns:minmax(0,1fr) auto!important}.cm-host-layer .cm-filter-check{grid-column:1!important;grid-row:2!important}.cm-host-layer .cm-ability-filter{grid-column:2!important;grid-row:2!important}.cm-host-layer .cm-history{grid-column:2!important;grid-row:1!important}.cm-host-layer .cm-number-stepper{grid-template-columns:44px minmax(0,1fr) 44px!important;width:100%!important}.cm-host-layer .cm-footer-commands{grid-template-columns:40px 40px 40px 76px minmax(82px,1fr)!important}}
@media(orientation:landscape) and (max-height:520px){.cm-host-layer .cm-editor{grid-template-rows:54px 48px minmax(0,1fr) 52px!important}.cm-host-layer .cm-header{min-height:54px!important;height:54px!important;padding:4px 8px!important}.cm-host-layer .cm-subject-icon{width:42px!important;height:42px!important}.cm-host-layer .cm-toolbar{min-height:48px!important;padding:4px 8px!important}.cm-host-layer .cm-content-head{min-height:44px!important;padding-block:4px!important}.cm-host-layer .cm-categories{padding:6px!important}.cm-host-layer .cm-category{min-height:38px!important;padding-block:5px!important}.cm-host-layer .cm-field-list{padding:8px 10px 12px!important}.cm-host-layer .cm-field{padding:11px!important;margin-bottom:8px!important}.cm-host-layer .cm-footer{min-height:52px!important;padding:4px 8px calc(4px + env(safe-area-inset-bottom,0px))!important}.cm-host-layer .cm-footer .cm-command{min-height:40px!important}.cm-host-layer.cm-keyboard-open .cm-editor{grid-template-rows:42px minmax(0,1fr) 0!important}.cm-host-layer.cm-keyboard-open .cm-header{height:42px!important;min-height:42px!important;max-height:42px!important}}
@media(prefers-reduced-motion:reduce){.cm-host-layer .cm-editor *,.cm-host-layer .cm-editor *::before,.cm-host-layer .cm-editor *::after{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important;scroll-behavior:auto!important}}
`;

function installStyles() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

function installCharacterModificationDesignSystemPatch() {
  installStyles();
  const proto = CharacterModificationRenderer?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;
  const originalMount = proto.mount;
  proto.mount = function mountWithDesignContext() {
    const result = originalMount.call(this);
    const embedded = this.root?.closest?.('.cm-host-layer')?.classList.contains('cm-host-layer-embedded');
    this.editor?.classList.add('cm-design-system');
    this.editor?.setAttribute('data-cm-design-context', embedded ? 'embedded' : 'standalone');
    this.root?.setAttribute('data-cm-design-ready', '1');
    return result;
  };
}

installCharacterModificationDesignSystemPatch();

export { CSS as CHARACTER_MODIFICATION_DESIGN_SYSTEM_CSS, installCharacterModificationDesignSystemPatch };
