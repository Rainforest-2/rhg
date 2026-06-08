import { FormationEditor } from './FormationEditor.js';

const PATCH_FLAG = Symbol.for('wanko-ui.character-tuning-mobile-landscape.v1');
const STYLE_ID = 'formation-character-tuning-mobile-landscape-style';

function injectMobileLandscapeStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
@font-face{font-family:OedoKanteiryuTuning;src:url('./public/assets/FOT-%E5%A4%A7%E6%B1%9F%E6%88%B8%E5%8B%98%E4%BA%AD%E6%B5%81%20Std%20E.ttf') format('truetype'),url('./public/assets/FOT-大江戸勘亭流 Std E.ttf') format('truetype'),url('./public/assets/FOT-%E5%A4%A7%E6%B1%9F%E6%88%B8%E5%8B%98%E4%BA%AD%E6%B5%81%20Std%20E.otf') format('opentype');font-weight:900;font-style:normal;font-display:block}
@media (orientation:landscape) and (max-height:520px) and (max-width:980px){
  html body.nyanko-ui-polish .formation-tuning-overlay{padding:4px calc(6px + env(safe-area-inset-right,0px)) 4px calc(6px + env(safe-area-inset-left,0px))!important;place-items:center!important;background:rgba(0,0,0,.42)!important;backdrop-filter:blur(1px)!important}
  html body.nyanko-ui-polish .formation-tuning-panel{width:min(948px,calc(100vw - 12px))!important;max-height:calc(100dvh - 8px)!important;grid-template-columns:104px minmax(0,1fr) 148px!important;grid-template-rows:38px minmax(0,1fr) 42px!important;border-width:4px!important;border-radius:15px!important;box-shadow:0 4px 0 #120603,0 0 0 2px rgba(255,255,255,.14)!important;overflow:hidden!important}
  html body.nyanko-ui-polish .formation-tuning-header{grid-column:1/-1!important;min-height:0!important;padding:4px 7px!important;gap:6px!important;border-bottom-width:4px!important}
  html body.nyanko-ui-polish .formation-tuning-title{gap:0!important;font-family:OedoKanteiryuTuning,OedoKanteiryuLocal,'Hiragino Mincho ProN',system-ui,sans-serif!important;text-shadow:2px 0 #000,-2px 0 #000,0 2px #000,0 -2px #000,1px 1px #000,-1px 1px #000,1px -1px #000,-1px -1px #000!important}
  html body.nyanko-ui-polish .formation-tuning-title strong{font-size:clamp(.98rem,3.6vh,1.16rem)!important;line-height:1.02!important;letter-spacing:.01em!important}
  html body.nyanko-ui-polish .formation-tuning-title span{display:none!important}
  html body.nyanko-ui-polish .formation-tuning-close{min-width:58px!important;height:29px!important;min-height:29px!important;border-width:3px!important;font-size:.74rem!important;box-shadow:0 2px 0 #000!important}
  html body.nyanko-ui-polish .formation-tuning-hero{grid-column:1!important;grid-row:2/4!important;display:grid!important;grid-template-columns:1fr!important;grid-template-rows:auto minmax(0,1fr)!important;align-content:start!important;justify-items:center!important;gap:5px!important;padding:7px 6px!important;border-right:4px solid #000!important;border-bottom:0!important;background:radial-gradient(circle at 50% 28%,#fffdf0 0 34%,#ffd85a 35% 57%,#c88418 58% 100%)!important}
  html body.nyanko-ui-polish .formation-tuning-portrait{width:70px!important;border-width:3px!important;border-radius:12px!important;box-shadow:0 3px 0 #000,inset 0 1px 0 rgba(255,255,255,.8)!important}
  html body.nyanko-ui-polish .formation-tuning-portrait img{width:94%!important;height:94%!important;filter:drop-shadow(0 2px 0 rgba(0,0,0,.45))!important}
  html body.nyanko-ui-polish .formation-tuning-hero-meta{align-self:start!important;width:100%!important;display:grid!important;gap:4px!important;text-align:center!important}
  html body.nyanko-ui-polish .formation-tuning-hero-meta .formation-tuning-chip:nth-child(2){display:none!important}
  html body.nyanko-ui-polish .formation-tuning-chip{min-height:20px!important;padding:0 7px!important;border-width:2px!important;font-size:.54rem!important;line-height:1!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
  html body.nyanko-ui-polish .formation-tuning-body{grid-column:2/4!important;grid-row:2!important;min-height:0!important;display:grid!important;grid-template-columns:minmax(0,1fr) 146px!important;grid-auto-rows:min-content!important;align-content:start!important;gap:6px!important;padding:7px!important;overflow:hidden!important;background:linear-gradient(180deg,#fff8d7,#ffe890)!important}
  html body.nyanko-ui-polish .formation-tuning-body>.formation-tuning-control{grid-column:1!important;min-width:0!important;padding:6px!important;gap:4px!important;border-width:3px!important;border-radius:12px!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.85)!important}
  html body.nyanko-ui-polish .formation-tuning-control-head{min-height:15px!important;gap:5px!important}
  html body.nyanko-ui-polish .formation-tuning-control-head strong{font-size:.72rem!important;letter-spacing:.03em!important;line-height:1!important}
  html body.nyanko-ui-polish .formation-tuning-control-head span{font-size:.56rem!important;line-height:1!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
  html body.nyanko-ui-polish .formation-tuning-stepper{grid-template-columns:42px 38px minmax(62px,1fr) 38px 42px!important;gap:4px!important;align-items:center!important}
  html body.nyanko-ui-polish .formation-tuning-btn,html body.nyanko-ui-polish .formation-tuning-save,html body.nyanko-ui-polish .formation-tuning-reset{min-height:31px!important;border-width:3px!important;font-size:.72rem!important;box-shadow:0 2px 0 #000!important;font-family:OedoKanteiryuTuning,OedoKanteiryuLocal,'Hiragino Mincho ProN',system-ui,sans-serif!important;text-shadow:1.5px 0 #000,-1.5px 0 #000,0 1.5px #000,0 -1.5px #000,1px 1px #000,-1px 1px #000,1px -1px #000,-1px -1px #000!important}
  html body.nyanko-ui-polish .formation-tuning-btn:active:not(:disabled),html body.nyanko-ui-polish .formation-tuning-save:active,html body.nyanko-ui-polish .formation-tuning-reset:active{transform:translateY(2px)!important;box-shadow:0 0 0 #000!important}
  html body.nyanko-ui-polish .formation-tuning-readout{height:34px!important;border-width:3px!important;border-radius:11px!important;font-size:1.02rem!important;line-height:1!important;font-family:OedoKanteiryuTuning,OedoKanteiryuLocal,'Hiragino Mincho ProN',system-ui,sans-serif!important;text-shadow:1.5px 0 #000,-1.5px 0 #000,0 1.5px #000,0 -1.5px #000!important}
  html body.nyanko-ui-polish .formation-tuning-meter{height:7px!important;border-width:2px!important}
  html body.nyanko-ui-polish .formation-tuning-summary{grid-column:2!important;grid-row:1!important;display:grid!important;grid-template-columns:1fr!important;gap:4px!important;align-self:start!important;min-width:0!important}
  html body.nyanko-ui-polish .formation-tuning-stat{padding:5px 4px!important;border-width:2px!important;border-radius:10px!important;min-height:0!important}
  html body.nyanko-ui-polish .formation-tuning-stat b{font-size:.86rem!important;line-height:1!important;font-family:OedoKanteiryuTuning,OedoKanteiryuLocal,'Hiragino Mincho ProN',system-ui,sans-serif!important;text-shadow:1.5px 0 #000,-1.5px 0 #000,0 1.5px #000,0 -1.5px #000!important}
  html body.nyanko-ui-polish .formation-tuning-stat small{margin-top:1px!important;font-size:.52rem!important;line-height:1.05!important}
  html body.nyanko-ui-polish .formation-tuning-presets{grid-column:2!important;grid-row:2!important;align-self:end!important;display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:4px!important;min-width:0!important}
  html body.nyanko-ui-polish .formation-tuning-presets .formation-tuning-btn{min-width:0!important;min-height:27px!important;border-width:2px!important;font-size:.62rem!important;padding:0 4px!important;box-shadow:0 1px 0 #000!important;text-shadow:none!important;font-family:'Hiragino Kaku Gothic ProN','Yu Gothic',system-ui,sans-serif!important;font-weight:1000!important}
  html body.nyanko-ui-polish .formation-tuning-footer{grid-column:2/4!important;grid-row:3!important;display:grid!important;grid-template-columns:minmax(112px,.52fr) minmax(132px,1fr)!important;gap:6px!important;align-items:center!important;padding:5px 7px!important;border-top-width:4px!important;background:#f6c240!important}
  html body.nyanko-ui-polish .formation-tuning-footer .formation-tuning-reset{font-family:'Hiragino Kaku Gothic ProN','Yu Gothic',system-ui,sans-serif!important;font-size:.66rem!important;font-weight:1000!important;text-shadow:none!important;color:#160800!important;-webkit-text-fill-color:#160800!important}
  html body.nyanko-ui-polish .formation-tuning-footer .formation-tuning-save{font-size:.92rem!important;min-height:31px!important}
  html body.nyanko-ui-polish .formation-tuning-panel-dog .formation-tuning-body{grid-template-rows:min-content minmax(0,1fr)!important}
  html body.nyanko-ui-polish .formation-tuning-panel-dog .formation-tuning-summary{grid-row:1!important}
  html body.nyanko-ui-polish .formation-tuning-panel-dog .formation-tuning-presets{grid-row:2!important;align-self:stretch!important;align-content:start!important}
}
  `;
  document.head.appendChild(style);
}

export function installFormationCharacterTuningMobileLandscapePatch() {
  const proto = FormationEditor?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  const originalRefresh = proto.refresh;
  if (typeof originalRefresh === 'function') {
    proto.refresh = function refreshWithMobileLandscapeTuning(...args) {
      const result = originalRefresh.apply(this, args);
      injectMobileLandscapeStyle();
      return result;
    };
  }

  const originalRenderDynamic = proto.renderDynamic;
  if (typeof originalRenderDynamic === 'function') {
    proto.renderDynamic = function renderDynamicWithMobileLandscapeTuning(...args) {
      const result = originalRenderDynamic.apply(this, args);
      injectMobileLandscapeStyle();
      return result;
    };
  }
}

installFormationCharacterTuningMobileLandscapePatch();
