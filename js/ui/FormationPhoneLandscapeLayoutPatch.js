import { FormationEditor } from './FormationEditor.js';

const PATCH_FLAG = Symbol.for('wanko-ui.formation-phone-landscape-layout.v1');
const STYLE_ID = 'formation-phone-landscape-layout-style';
const PHONE_LANDSCAPE_QUERY = '(orientation: landscape) and (max-height: 520px) and (max-width: 980px) and (pointer: coarse)';
const TINY_PHONE_LANDSCAPE_QUERY = '(orientation: landscape) and (max-height: 390px) and (max-width: 900px) and (pointer: coarse)';

function isPhoneLandscape() {
  return globalThis.matchMedia?.(PHONE_LANDSCAPE_QUERY)?.matches === true;
}

function isTinyPhoneLandscape() {
  return globalThis.matchMedia?.(TINY_PHONE_LANDSCAPE_QUERY)?.matches === true;
}

function applyMetrics(editor) {
  if (!editor?.catalogVirtual) return;
  if (isPhoneLandscape()) {
    editor.catalogVirtual = {
      ...editor.catalogVirtual,
      rowHeight: isTinyPhoneLandscape() ? 100 : 112,
      overscanRows: isTinyPhoneLandscape() ? 5 : 6
    };
  }
}

function injectStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
@media ${PHONE_LANDSCAPE_QUERY}{
  html body.nyanko-ui-polish .formation-ui{padding:calc(env(safe-area-inset-top,0px) + 5px) calc(env(safe-area-inset-right,0px) + 6px) calc(env(safe-area-inset-bottom,0px) + 5px) calc(env(safe-area-inset-left,0px) + 6px)!important;background:rgba(2,6,23,.74)!important;backdrop-filter:blur(3px) saturate(1.08)!important}
  html body.nyanko-ui-polish .formation-panel{width:100%!important;height:100%!important;display:grid!important;grid-template-columns:minmax(0,1fr) clamp(136px,17vw,158px)!important;gap:6px!important;padding:6px!important;border-width:4px!important;border-radius:15px!important;background:linear-gradient(180deg,#bd7338 0 44px,#351305 44px 52px,#fff8d1 53px calc(100% - 12px),#351305 calc(100% - 12px) 100%)!important;box-shadow:0 5px 0 #150704,0 0 0 2px rgba(255,255,255,.12)!important;overflow:hidden!important}
  html body.nyanko-ui-polish .formation-panel::before{inset:54px 8px 12px!important;background-size:34px 34px,34px 34px,auto!important;opacity:.46!important}
  html body.nyanko-ui-polish .formation-main{grid-template-rows:36px 78px minmax(0,1fr)!important;gap:5px!important;min-width:0!important;min-height:0!important;overflow:hidden!important}
  html body.nyanko-ui-polish .formation-header{min-height:36px!important;padding:4px 9px!important;border-width:3px!important;border-radius:11px!important;box-shadow:0 3px 0 rgba(0,0,0,.76),inset 0 1px 0 rgba(255,255,255,.42)!important;grid-template-columns:minmax(0,1fr) auto!important;align-items:center!important}
  html body.nyanko-ui-polish .formation-header::before{display:none!important}
  html body.nyanko-ui-polish .formation-header h3{font-size:1rem!important;line-height:1!important;letter-spacing:.02em!important;white-space:nowrap!important}
  html body.nyanko-ui-polish .formation-header h3::before{min-width:49px!important;height:22px!important;margin-right:7px!important;border-width:2px!important;font-size:.5em!important;box-shadow:0 2px 0 #3d1707,inset 0 1px 0 rgba(255,255,255,.75)!important}
  html body.nyanko-ui-polish .formation-header p{display:none!important}
  html body.nyanko-ui-polish .formation-active-page-label{min-height:24px!important;padding:4px 8px!important;border-width:2px!important;font-size:.58rem!important;letter-spacing:.03em!important;white-space:nowrap!important}
  html body.nyanko-ui-polish .formation-slots-wrap{grid-template-rows:24px minmax(0,1fr)!important;gap:4px!important;padding:5px!important;border-width:2px!important;border-radius:11px!important;min-height:0!important;overflow:hidden!important}
  html body.nyanko-ui-polish .formation-page-tabs{gap:4px!important}
  html body.nyanko-ui-polish .formation-page-tab{min-height:24px!important;height:24px!important;padding:2px 7px!important;border-width:2px!important;border-radius:999px!important;box-shadow:0 2px 0 #3a1506,inset 0 1px 0 rgba(255,255,255,.72)!important}
  html body.nyanko-ui-polish .formation-page-tab strong{font-size:.58rem!important;line-height:1!important}
  html body.nyanko-ui-polish .formation-page-tab span{min-width:28px!important;font-size:.56rem!important;border-width:1px!important;padding:1px 4px!important}
  html body.nyanko-ui-polish .formation-slots{height:100%!important;gap:4px!important;align-items:stretch!important}
  html body.nyanko-ui-polish .formation-slot{min-height:0!important;height:100%!important;border-width:2px!important;border-radius:10px!important;padding:3px 4px!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 3px 7px rgba(0,0,0,.32)!important}
  html body.nyanko-ui-polish .formation-slot::after{left:5px!important;top:4px!important;font-size:8px!important}
  html body.nyanko-ui-polish .formation-slot img{width:30px!important;height:30px!important;margin:0!important;filter:drop-shadow(0 3px 4px rgba(0,0,0,.55))!important}
  html body.nyanko-ui-polish .formation-slot span{max-width:100%!important;font-size:.52rem!important;line-height:1.05!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;text-shadow:0 1px 0 #000!important}
  html body.nyanko-ui-polish .formation-slot small{display:none!important}
  html body.nyanko-ui-polish .formation-tuning-badge{right:2px!important;bottom:2px!important;min-width:34px!important;height:16px!important;padding:0 5px!important;border-width:2px!important;font-size:.5rem!important;box-shadow:0 1px 0 #000!important}
  html body.nyanko-ui-polish .formation-catalog-section{grid-template-columns:1fr!important;grid-template-rows:28px 30px minmax(0,1fr)!important;gap:4px!important;padding:5px!important;border-width:2px!important;border-radius:11px!important;min-height:0!important;overflow:hidden!important}
  html body.nyanko-ui-polish .formation-catalog-tabs{grid-column:1!important;grid-row:1!important;display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:4px!important;min-width:0!important;flex-wrap:nowrap!important}
  html body.nyanko-ui-polish .formation-catalog-tabs button{width:100%!important;min-width:0!important;min-height:28px!important;height:28px!important;padding:3px 6px!important;border-width:2px!important;border-radius:999px!important;font-size:.62rem!important;letter-spacing:.02em!important;box-shadow:0 2px 0 #3a1506,inset 0 1px 0 rgba(255,255,255,.72)!important}
  html body.nyanko-ui-polish .formation-catalog-toolbar{grid-column:1!important;grid-row:2!important;height:30px!important;display:grid!important;grid-template-columns:1fr!important;gap:0!important;min-width:0!important}
  html body.nyanko-ui-polish .formation-search-input{height:30px!important;min-height:30px!important;border-width:2px!important;border-radius:999px!important;padding:4px 11px!important;font-size:.72rem!important}
  html body.nyanko-ui-polish .formation-catalog-summary{display:none!important}
  html body.nyanko-ui-polish .formation-catalog-scroll{grid-column:1!important;grid-row:3!important;min-height:0!important;height:100%!important;padding:4px!important;overflow-y:auto!important;overscroll-behavior:contain!important}
  html body.nyanko-ui-polish .formation-catalog-grid{grid-template-columns:repeat(auto-fill,minmax(104px,1fr))!important;gap:5px!important;align-content:start!important}
  html body.nyanko-ui-polish .formation-character-card{min-height:94px!important;height:94px!important;padding:4px!important;border-width:2px!important;border-radius:11px!important;gap:1px!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.72),0 4px 8px rgba(0,0,0,.28)!important;overflow:hidden!important}
  html body.nyanko-ui-polish .formation-character-card::before{inset:4px 4px auto!important;height:34px!important;border-radius:8px!important}
  html body.nyanko-ui-polish .formation-character-card img{width:38px!important;height:38px!important;margin-top:1px!important;filter:drop-shadow(0 3px 4px rgba(0,0,0,.50))!important}
  html body.nyanko-ui-polish .formation-character-card span{font-size:.48rem!important;line-height:1!important;min-height:0!important}
  html body.nyanko-ui-polish .formation-character-card strong{max-width:100%!important;min-height:1.35em!important;margin:0!important;padding:2px 4px!important;border-width:2px!important;border-radius:8px!important;font-size:.58rem!important;line-height:1.1!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
  html body.nyanko-ui-polish .formation-character-card .character-id{display:none!important}
  html body.nyanko-ui-polish .formation-card-meta{width:100%!important;display:grid!important;grid-template-columns:1fr 1fr!important;gap:3px!important;margin-top:1px!important}
  html body.nyanko-ui-polish .formation-card-meta span{min-height:17px!important;padding:1px 3px!important;border-width:1px!important;border-radius:6px!important;font-size:.48rem!important;line-height:1!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
  html body.nyanko-ui-polish .formation-action-rail{min-width:0!important;padding:6px!important;border-width:2px!important;border-radius:11px!important;gap:5px!important;display:grid!important;grid-template-rows:40px 31px minmax(34px,auto) 29px 29px minmax(0,1fr)!important;align-content:start!important;overflow:hidden!important}
  html body.nyanko-ui-polish .formation-action-rail button{min-height:0!important;width:100%!important;border-width:2px!important;border-radius:10px!important;padding:3px 6px!important;font-size:.62rem!important;line-height:1.05!important;box-shadow:0 2px 0 #3a1506,inset 0 1px 0 rgba(255,255,255,.55)!important}
  html body.nyanko-ui-polish .apply-battle-button{min-height:40px!important;font-size:.82rem!important;letter-spacing:.02em!important}
  html body.nyanko-ui-polish .stage-select-button{min-height:31px!important}
  html body.nyanko-ui-polish .formation-current-stage{min-height:34px!important;max-height:48px!important;padding:4px 6px!important;border-width:2px!important;border-radius:9px!important;font-size:.52rem!important;line-height:1.12!important;overflow:hidden!important;display:block!important;color:#261005!important;-webkit-text-fill-color:#261005!important;background:rgba(255,250,218,.92)!important}
  html body.nyanko-ui-polish .formation-action-hint{display:none!important}
}
@media ${TINY_PHONE_LANDSCAPE_QUERY}{
  html body.nyanko-ui-polish .formation-ui{padding:4px!important}
  html body.nyanko-ui-polish .formation-panel{grid-template-columns:minmax(0,1fr) 126px!important;gap:5px!important;padding:5px!important;border-width:3px!important;border-radius:13px!important}
  html body.nyanko-ui-polish .formation-main{grid-template-rows:32px 70px minmax(0,1fr)!important;gap:4px!important}
  html body.nyanko-ui-polish .formation-header{min-height:32px!important;padding:3px 7px!important;border-width:2px!important;border-radius:10px!important}
  html body.nyanko-ui-polish .formation-header h3{font-size:.9rem!important}
  html body.nyanko-ui-polish .formation-header h3::before{min-width:42px!important;height:19px!important;margin-right:5px!important}
  html body.nyanko-ui-polish .formation-active-page-label{display:none!important}
  html body.nyanko-ui-polish .formation-slots-wrap{grid-template-rows:21px minmax(0,1fr)!important;padding:4px!important;gap:3px!important}
  html body.nyanko-ui-polish .formation-page-tab{height:21px!important;min-height:21px!important;padding:1px 6px!important}
  html body.nyanko-ui-polish .formation-slot img{width:26px!important;height:26px!important}
  html body.nyanko-ui-polish .formation-slot span{font-size:.47rem!important}
  html body.nyanko-ui-polish .formation-catalog-section{grid-template-rows:25px 28px minmax(0,1fr)!important;padding:4px!important;gap:3px!important}
  html body.nyanko-ui-polish .formation-catalog-tabs button{height:25px!important;min-height:25px!important;font-size:.56rem!important;padding:2px 4px!important}
  html body.nyanko-ui-polish .formation-search-input{height:28px!important;min-height:28px!important;font-size:.66rem!important}
  html body.nyanko-ui-polish .formation-catalog-grid{grid-template-columns:repeat(auto-fill,minmax(92px,1fr))!important;gap:4px!important}
  html body.nyanko-ui-polish .formation-character-card{height:84px!important;min-height:84px!important;padding:3px!important;border-radius:9px!important}
  html body.nyanko-ui-polish .formation-character-card::before{height:29px!important;inset:3px 3px auto!important}
  html body.nyanko-ui-polish .formation-character-card img{width:33px!important;height:33px!important}
  html body.nyanko-ui-polish .formation-character-card strong{font-size:.52rem!important;padding:1px 3px!important}
  html body.nyanko-ui-polish .formation-card-meta span{min-height:15px!important;font-size:.43rem!important}
  html body.nyanko-ui-polish .formation-action-rail{grid-template-rows:34px 28px minmax(30px,auto) 26px 26px minmax(0,1fr)!important;padding:5px!important;gap:4px!important}
  html body.nyanko-ui-polish .apply-battle-button{min-height:34px!important;font-size:.72rem!important}
  html body.nyanko-ui-polish .formation-action-rail button{font-size:.56rem!important;border-radius:8px!important;padding:2px 4px!important}
  html body.nyanko-ui-polish .formation-current-stage{min-height:30px!important;max-height:38px!important;font-size:.46rem!important;padding:3px 4px!important}
}
`;
  document.head.appendChild(style);
}

export function installFormationPhoneLandscapeLayoutPatch() {
  const proto = FormationEditor?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  const originalEstimate = proto.estimateCatalogColumns;
  if (typeof originalEstimate === 'function') {
    proto.estimateCatalogColumns = function estimateCatalogColumnsPhoneLandscape(scroller) {
      if (isPhoneLandscape()) {
        const width = Math.max(1, scroller?.clientWidth || 1);
        const cardWidth = isTinyPhoneLandscape() ? 96 : 110;
        return Math.max(3, Math.floor(width / cardWidth));
      }
      return originalEstimate.call(this, scroller);
    };
  }

  const refresh = proto.refresh;
  if (typeof refresh === 'function') {
    proto.refresh = function refreshWithPhoneLandscapeLayout(...args) {
      injectStyle();
      applyMetrics(this);
      const result = refresh.apply(this, args);
      applyMetrics(this);
      return result;
    };
  }

  const renderDynamic = proto.renderDynamic;
  if (typeof renderDynamic === 'function') {
    proto.renderDynamic = function renderDynamicWithPhoneLandscapeLayout(...args) {
      injectStyle();
      applyMetrics(this);
      const result = renderDynamic.apply(this, args);
      applyMetrics(this);
      return result;
    };
  }

  const renderCatalogWindow = proto.renderCatalogWindow;
  if (typeof renderCatalogWindow === 'function') {
    proto.renderCatalogWindow = function renderCatalogWindowWithPhoneLandscapeLayout(...args) {
      applyMetrics(this);
      return renderCatalogWindow.apply(this, args);
    };
  }

  globalThis.matchMedia?.(PHONE_LANDSCAPE_QUERY)?.addEventListener?.('change', () => {
    for (const root of document.querySelectorAll('.formation-ui')) {
      const editor = root.__formationEditor;
      editor?.renderDynamic?.({ resetCatalogScroll: false });
    }
  });
}

installFormationPhoneLandscapeLayoutPatch();
