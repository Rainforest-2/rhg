import { FormationEditor } from './FormationEditor.js';

const PATCH_FLAG = Symbol.for('wanko-ui.formation-phone-landscape-layout.v1');
const STYLE_ID = 'formation-phone-landscape-layout-style';
const PHONE_LANDSCAPE_QUERY = '(orientation: landscape) and (max-height: 520px) and (max-width: 980px)';
const TINY_PHONE_LANDSCAPE_QUERY = '(orientation: landscape) and (max-height: 390px) and (max-width: 900px)';

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
      rowHeight: isTinyPhoneLandscape() ? 82 : 92,
      overscanRows: isTinyPhoneLandscape() ? 5 : 6
    };
  }
}

function stabilizeCatalogAfterLayout(editor) {
  if (!isPhoneLandscape() || !editor?.root || editor.__phoneLandscapeCatalogFrame) return;
  editor.__phoneLandscapeCatalogFrame = requestAnimationFrame(() => {
    editor.__phoneLandscapeCatalogFrame = null;
    if (!isPhoneLandscape() || !editor.root?.isConnected) return;
    const scroller = editor.root.querySelector('.formation-catalog-scroll');
    if (!scroller || scroller.clientWidth <= 0 || scroller.clientHeight <= 0) return;
    applyMetrics(editor);
    editor.renderCatalogWindow?.();
    editor.resolveSemanticIcons?.();
    editor.updateFormationIconDebug?.();
  });
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
  html body.nyanko-ui-polish .formation-main{grid-template-rows:36px 96px minmax(0,1fr)!important;gap:5px!important;min-width:0!important;min-height:0!important;overflow:hidden!important}
  html body.nyanko-ui-polish .formation-header{min-height:36px!important;padding:4px 9px!important;border-width:3px!important;border-radius:11px!important;box-shadow:0 3px 0 rgba(0,0,0,.76),inset 0 1px 0 rgba(255,255,255,.42)!important;grid-template-columns:minmax(0,1fr) auto!important;align-items:center!important}
  html body.nyanko-ui-polish .formation-header::before{display:none!important}
  html body.nyanko-ui-polish .formation-header h3{font-size:1rem!important;line-height:1!important;letter-spacing:.02em!important;white-space:nowrap!important}
  html body.nyanko-ui-polish .formation-header h3::before{min-width:49px!important;height:22px!important;margin-right:7px!important;border-width:2px!important;font-size:.5em!important;box-shadow:0 2px 0 #3d1707,inset 0 1px 0 rgba(255,255,255,.75)!important}
  html body.nyanko-ui-polish .formation-header p{display:none!important}
  html body.nyanko-ui-polish .formation-active-page-label{min-height:24px!important;padding:4px 8px!important;border-width:2px!important;font-size:.58rem!important;letter-spacing:.03em!important;white-space:nowrap!important}
  html body.nyanko-ui-polish .formation-slots-wrap{display:grid!important;grid-template-columns:minmax(0,1fr) 50px!important;grid-template-rows:minmax(0,1fr)!important;gap:5px!important;padding:5px!important;border-width:2px!important;border-radius:11px!important;min-height:0!important;overflow:visible!important}
  html body.nyanko-ui-polish .formation-page-tabs{grid-column:2!important;grid-row:1!important;align-self:stretch!important;display:grid!important;grid-template-columns:1fr!important;grid-template-rows:repeat(2,minmax(0,1fr))!important;gap:5px!important;min-height:0!important}
  html body.nyanko-ui-polish .formation-page-tab{min-height:0!important;height:auto!important;width:100%!important;padding:3px 4px!important;border-width:2px!important;border-radius:10px!important;box-shadow:0 2px 0 #3a1506,inset 0 1px 0 rgba(255,255,255,.72)!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:3px!important;text-align:center!important}
  html body.nyanko-ui-polish .formation-page-tab strong{font-size:.54rem!important;line-height:1.05!important;white-space:normal!important}
  html body.nyanko-ui-polish .formation-page-tab span{min-width:0!important;font-size:.5rem!important;border-width:1px!important;padding:1px 3px!important;line-height:1!important}
  html body.nyanko-ui-polish .formation-slots{grid-column:1!important;grid-row:1!important;height:100%!important;gap:5px!important;align-items:stretch!important;overflow:visible!important}
  html body.nyanko-ui-polish .formation-slot{position:relative!important;min-height:0!important;height:100%!important;border-width:2px!important;border-radius:10px!important;padding:5px 4px 4px!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 3px 7px rgba(0,0,0,.32)!important;overflow:visible!important}
  html body.nyanko-ui-polish .formation-slot::after{left:5px!important;top:4px!important;font-size:8px!important}
  html body.nyanko-ui-polish .formation-slot img{width:34px!important;height:34px!important;margin:0 0 3px!important;filter:drop-shadow(0 3px 4px rgba(0,0,0,.55))!important}
  html body.nyanko-ui-polish .formation-slot span{display:-webkit-box!important;max-width:100%!important;min-height:1.95em!important;font-size:.5rem!important;line-height:1.02!important;white-space:normal!important;overflow:hidden!important;text-overflow:ellipsis!important;-webkit-line-clamp:2!important;-webkit-box-orient:vertical!important;color:#fff8df!important;-webkit-text-fill-color:#fff8df!important;text-shadow:0 1px 0 #000,0 0 3px #000!important}
  html body.nyanko-ui-polish .formation-slot small{display:none!important}
  html body.nyanko-ui-polish .formation-slot-charge{inset:-5px!important;padding:4px!important;border-radius:14px!important;z-index:20!important;pointer-events:none!important}
  html body.nyanko-ui-polish .formation-tuning-badge{right:2px!important;bottom:2px!important;min-width:34px!important;height:16px!important;padding:0 5px!important;border-width:2px!important;font-size:.5rem!important;box-shadow:0 1px 0 #000!important}
  html body.nyanko-ui-polish .formation-catalog-section{display:grid!important;grid-template-columns:clamp(112px,14vw,126px) minmax(0,1fr)!important;grid-template-rows:auto minmax(0,1fr)!important;gap:5px!important;padding:5px!important;border-width:2px!important;border-radius:11px!important;min-height:0!important;overflow:hidden!important}
  html body.nyanko-ui-polish .formation-catalog-tabs{grid-column:1!important;grid-row:1!important;display:grid!important;grid-template-columns:1fr!important;grid-auto-rows:28px!important;gap:4px!important;min-width:0!important;flex-wrap:nowrap!important}
  html body.nyanko-ui-polish .formation-catalog-tabs button{width:100%!important;min-width:0!important;min-height:28px!important;height:28px!important;padding:3px 6px!important;border-width:2px!important;border-radius:999px!important;font-size:.62rem!important;letter-spacing:.02em!important;box-shadow:0 2px 0 #3a1506,inset 0 1px 0 rgba(255,255,255,.72)!important}
  html body.nyanko-ui-polish .formation-catalog-toolbar{grid-column:1!important;grid-row:2!important;height:auto!important;display:grid!important;grid-template-columns:1fr!important;grid-auto-rows:30px!important;align-content:start!important;gap:4px!important;min-width:0!important}
  html body.nyanko-ui-polish .formation-search-input{height:30px!important;min-height:30px!important;border-width:2px!important;border-radius:999px!important;padding:4px 11px!important;font-size:.72rem!important}
  html body.nyanko-ui-polish .formation-search-button{width:100%!important;min-width:0!important;min-height:30px!important;height:30px!important;padding:3px 8px!important;border-width:2px!important;font-size:.62rem!important;box-shadow:0 2px 0 #3a1506,inset 0 1px 0 rgba(255,255,255,.72)!important}
  html body.nyanko-ui-polish .formation-catalog-summary{display:none!important}
  html body.nyanko-ui-polish .formation-catalog-scroll{grid-column:2!important;grid-row:1 / span 2!important;min-height:0!important;height:100%!important;padding:4px!important;overflow-y:auto!important;overscroll-behavior:contain!important}
  html body.nyanko-ui-polish .formation-catalog-grid{grid-template-columns:repeat(auto-fill,minmax(96px,1fr))!important;gap:5px!important;align-content:start!important}
  html body.nyanko-ui-polish .formation-character-card{min-height:86px!important;height:86px!important;padding:4px!important;border-width:2px!important;border-radius:11px!important;gap:1px!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.72),0 4px 8px rgba(0,0,0,.28)!important;overflow:hidden!important}
  html body.nyanko-ui-polish .formation-character-card::before{inset:4px 4px auto!important;height:34px!important;border-radius:8px!important}
  html body.nyanko-ui-polish .formation-character-card img{width:34px!important;height:34px!important;margin-top:1px!important;filter:drop-shadow(0 3px 4px rgba(0,0,0,.50))!important}
  html body.nyanko-ui-polish .formation-character-card span{font-size:.48rem!important;line-height:1!important;min-height:0!important}
  html body.nyanko-ui-polish .formation-character-card strong{max-width:100%!important;min-height:1.35em!important;margin:0!important;padding:2px 4px!important;border-width:2px!important;border-radius:8px!important;font-size:.58rem!important;line-height:1.1!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
  html body.nyanko-ui-polish .formation-character-card .character-id{display:none!important}
  html body.nyanko-ui-polish .formation-card-meta{width:100%!important;display:grid!important;grid-template-columns:1fr 1fr!important;gap:3px!important;margin-top:1px!important}
  html body.nyanko-ui-polish .formation-card-meta span{min-height:17px!important;padding:1px 3px!important;border-width:1px!important;border-radius:6px!important;font-size:.48rem!important;line-height:1!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
  html body.nyanko-ui-polish .formation-action-rail{min-width:0!important;padding:6px!important;border-width:2px!important;border-radius:11px!important;gap:6px!important;display:grid!important;grid-template-columns:1fr!important;grid-template-rows:minmax(52px,0.9fr) 32px minmax(44px,1fr) 30px 30px 32px!important;align-content:stretch!important;overflow:hidden!important}
  html body.nyanko-ui-polish .formation-action-rail button{min-height:0!important;width:100%!important;border-width:2px!important;border-radius:10px!important;padding:3px 6px!important;font-size:.62rem!important;line-height:1.05!important;box-shadow:0 2px 0 #3a1506,inset 0 1px 0 rgba(255,255,255,.55)!important}
  html body.nyanko-ui-polish .apply-battle-button{height:100%!important;min-height:0!important;font-size:.92rem!important;letter-spacing:.04em!important}
  html body.nyanko-ui-polish .stage-select-button{min-height:0!important;height:100%!important}
  html body.nyanko-ui-polish .formation-current-stage{height:100%!important;min-height:0!important;max-height:none!important;padding:5px 7px!important;border-width:2px!important;border-radius:9px!important;font-size:.55rem!important;line-height:1.18!important;overflow:hidden!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;text-align:center!important;white-space:normal!important;word-break:break-word!important;color:#261005!important;-webkit-text-fill-color:#261005!important;background:rgba(255,250,218,.92)!important}
  html body.nyanko-ui-polish .formation-action-hint{display:none!important}
}
@media ${TINY_PHONE_LANDSCAPE_QUERY}{
  html body.nyanko-ui-polish .formation-ui{padding:4px!important}
  html body.nyanko-ui-polish .formation-panel{grid-template-columns:minmax(0,1fr) 126px!important;gap:5px!important;padding:5px!important;border-width:3px!important;border-radius:13px!important}
  html body.nyanko-ui-polish .formation-main{grid-template-rows:32px 84px minmax(0,1fr)!important;gap:4px!important}
  html body.nyanko-ui-polish .formation-header{min-height:32px!important;padding:3px 7px!important;border-width:2px!important;border-radius:10px!important}
  html body.nyanko-ui-polish .formation-header h3{font-size:.9rem!important}
  html body.nyanko-ui-polish .formation-header h3::before{min-width:42px!important;height:19px!important;margin-right:5px!important}
  html body.nyanko-ui-polish .formation-active-page-label{display:none!important}
  html body.nyanko-ui-polish .formation-slots-wrap{grid-template-columns:minmax(0,1fr) 42px!important;grid-template-rows:minmax(0,1fr)!important;padding:4px!important;gap:4px!important}
  html body.nyanko-ui-polish .formation-page-tab{height:auto!important;min-height:0!important;padding:2px 3px!important}
  html body.nyanko-ui-polish .formation-page-tab strong{font-size:.48rem!important}
  html body.nyanko-ui-polish .formation-page-tab span{font-size:.45rem!important;padding:1px 2px!important}
  html body.nyanko-ui-polish .formation-slot{padding:4px 3px 3px!important}
  html body.nyanko-ui-polish .formation-slot img{width:28px!important;height:28px!important;margin-bottom:2px!important}
  html body.nyanko-ui-polish .formation-slot span{font-size:.45rem!important;min-height:1.85em!important}
  html body.nyanko-ui-polish .formation-slot-charge{inset:-4px!important;padding:3px!important;border-radius:12px!important}
  html body.nyanko-ui-polish .formation-catalog-section{grid-template-columns:104px minmax(0,1fr)!important;grid-template-rows:auto minmax(0,1fr)!important;padding:4px!important;gap:4px!important}
  html body.nyanko-ui-polish .formation-catalog-tabs button{height:25px!important;min-height:25px!important;font-size:.56rem!important;padding:2px 4px!important}
  html body.nyanko-ui-polish .formation-search-input{height:28px!important;min-height:28px!important;font-size:.66rem!important}
  html body.nyanko-ui-polish .formation-catalog-toolbar{grid-auto-rows:28px!important}
  html body.nyanko-ui-polish .formation-catalog-grid{grid-template-columns:repeat(auto-fill,minmax(84px,1fr))!important;gap:4px!important}
  html body.nyanko-ui-polish .formation-character-card{height:78px!important;min-height:78px!important;padding:3px!important;border-radius:9px!important}
  html body.nyanko-ui-polish .formation-character-card::before{height:29px!important;inset:3px 3px auto!important}
  html body.nyanko-ui-polish .formation-character-card img{width:30px!important;height:30px!important}
  html body.nyanko-ui-polish .formation-character-card strong{font-size:.52rem!important;padding:1px 3px!important}
  html body.nyanko-ui-polish .formation-card-meta span{min-height:15px!important;font-size:.43rem!important}
  html body.nyanko-ui-polish .formation-action-rail{grid-template-rows:minmax(44px,0.9fr) 27px minmax(36px,1fr) 26px 26px 28px!important;padding:5px!important;gap:5px!important}
  html body.nyanko-ui-polish .apply-battle-button{min-height:0!important;height:100%!important;font-size:.8rem!important}
  html body.nyanko-ui-polish .formation-action-rail button{font-size:.56rem!important;border-radius:8px!important;padding:2px 4px!important}
  html body.nyanko-ui-polish .formation-current-stage{min-height:0!important;max-height:none!important;font-size:.5rem!important;padding:3px 5px!important}
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
        const cardWidth = isTinyPhoneLandscape() ? 88 : 101;
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
      stabilizeCatalogAfterLayout(this);
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
      stabilizeCatalogAfterLayout(this);
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
