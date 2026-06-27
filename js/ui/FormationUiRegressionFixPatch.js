import { FormationEditor } from './FormationEditor.js';
import { getBcuAssetDatabase } from '../bcu/BcuAssetDatabase.js';
import { popIn, press } from './UiMotion.mjs';

const PATCH_FLAG = Symbol.for('wanko-ui.formation-regression-fix.v1');
const STYLE_ID = 'formation-ui-regression-fix-style';

function injectStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
@font-face{font-family:FormationTuningOtf;src:url('/assets/FOT-%E5%A4%A7%E6%B1%9F%E6%88%B8%E5%8B%98%E4%BA%AD%E6%B5%81%20Std%20E.otf') format('opentype');font-weight:900;font-style:normal;font-display:block}
html body.nyanko-ui-polish .formation-tuning-title,
html body.nyanko-ui-polish .formation-tuning-title strong,
html body.nyanko-ui-polish .formation-tuning-close,
html body.nyanko-ui-polish .formation-tuning-btn,
html body.nyanko-ui-polish .formation-tuning-save,
html body.nyanko-ui-polish .formation-tuning-readout,
html body.nyanko-ui-polish .formation-tuning-stat b,
html body.nyanko-ui-polish .formation-tuning-badge{font-family:FormationTuningOtf,'Hiragino Mincho ProN','Yu Mincho',system-ui,sans-serif!important}
html body.nyanko-ui-polish .formation-slot,
html body.nyanko-ui-polish .formation-slot *,
html body.nyanko-ui-polish .formation-tuning-overlay,
html body.nyanko-ui-polish .formation-tuning-overlay *,
html body.nyanko-ui-polish .formation-tuning-portrait,
html body.nyanko-ui-polish .formation-tuning-portrait *{-webkit-touch-callout:none!important;-webkit-user-select:none!important;user-select:none!important;-webkit-tap-highlight-color:transparent!important}
html body.nyanko-ui-polish .formation-slot img,
html body.nyanko-ui-polish .formation-tuning-portrait img,
html body.nyanko-ui-polish img.formation-tuning-icon{-webkit-user-drag:none!important;-webkit-touch-callout:none!important;user-select:none!important;pointer-events:none!important}
html body.nyanko-ui-polish .formation-tuning-overlay.ui-motion-fade-in{opacity:0!important}
html body.nyanko-ui-polish .formation-tuning-overlay.ui-motion-fade-in.ui-motion-run{opacity:1!important}
html body.nyanko-ui-polish .formation-tuning-panel.ui-motion-pop-in{opacity:0!important;transform:scale(.88) translateY(12px)!important}
html body.nyanko-ui-polish .formation-tuning-panel.ui-motion-pop-in.ui-motion-run{opacity:1!important;transform:scale(1) translateY(0)!important}
html body.nyanko-ui-polish .formation-tuning-panel.ui-motion-pop-out.ui-motion-run{opacity:0!important;transform:scale(.92) translateY(8px)!important}
html body.nyanko-ui-polish .formation-tuning-btn.ui-motion-press,
html body.nyanko-ui-polish .formation-tuning-save.ui-motion-press,
html body.nyanko-ui-polish .formation-tuning-reset.ui-motion-press,
html body.nyanko-ui-polish .formation-stage-card.ui-motion-press{transform:translateY(4px) scale(.96)!important;filter:brightness(.9) saturate(1.08)!important}
`;
  document.head.appendChild(style);
}

function resolveTuningIcons(editor) {
  if (!editor?.root) return;
  let provider = null;
  try { provider = getBcuAssetDatabase()?.semanticProvider; } catch {}
  if (!provider) return;
  for (const img of editor.root.querySelectorAll('.formation-tuning-portrait img[data-semantic-icon], img.formation-tuning-icon[data-semantic-icon]')) {
    if (!img.dataset.semanticIcon || img.dataset.iconResolved === '1' || img.dataset.iconPending === '1') continue;
    if (typeof editor.enqueueIcon === 'function') editor.enqueueIcon(img, provider, true);
    else {
      img.dataset.iconPending = '1';
      provider.getActorUiIconUrl(img.dataset.semanticIcon)
        .then((url) => { if (img.isConnected) { img.src = url; img.classList.remove('image-missing'); img.dataset.iconResolved = '1'; } })
        .catch(() => { if (img.isConnected) img.classList.add('image-missing'); })
        .finally(() => { delete img.dataset.iconPending; });
    }
  }
  editor.pumpIconQueue?.(provider);
}

function wireSafariGuards(editor) {
  if (!editor?.root || editor.__formationSafariCalloutGuard) return;
  editor.__formationSafariCalloutGuard = true;
  const blocked = '.formation-slot img,.formation-slot picture,.formation-tuning-portrait img,.formation-tuning-overlay img,img.formation-tuning-icon';
  editor.root.addEventListener('contextmenu', (event) => {
    if (event.target.closest?.(blocked)) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);
  editor.root.addEventListener('dragstart', (event) => {
    if (event.target.closest?.(blocked)) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);
}

function animateCurrentOverlay(editor) {
  const overlay = editor?.root?.querySelector?.('.formation-tuning-overlay.is-open');
  const panel = overlay?.querySelector?.('.formation-tuning-panel');
  if (!panel || panel.dataset.motionFixSeen === '1') return;
  panel.dataset.motionFixSeen = '1';
  popIn(panel, { duration: 175 });
}

export function installFormationUiRegressionFixPatch() {
  const proto = FormationEditor?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  const refresh = proto.refresh;
  if (typeof refresh === 'function') {
    proto.refresh = function refreshWithRegressionFix(...args) {
      const result = refresh.apply(this, args);
      injectStyle();
      wireSafariGuards(this);
      requestAnimationFrame(() => resolveTuningIcons(this));
      return result;
    };
  }

  const renderDynamic = proto.renderDynamic;
  if (typeof renderDynamic === 'function') {
    proto.renderDynamic = function renderDynamicWithRegressionFix(...args) {
      const result = renderDynamic.apply(this, args);
      injectStyle();
      wireSafariGuards(this);
      requestAnimationFrame(() => { resolveTuningIcons(this); animateCurrentOverlay(this); });
      return result;
    };
  }

  const open = proto.openCharacterTuningOverlay;
  if (typeof open === 'function') {
    proto.openCharacterTuningOverlay = function openCharacterTuningOverlayWithIconFix(...args) {
      const result = open.apply(this, args);
      injectStyle();
      wireSafariGuards(this);
      requestAnimationFrame(() => { resolveTuningIcons(this); animateCurrentOverlay(this); });
      return result;
    };
  }

  const click = proto.onClick;
  if (typeof click === 'function') {
    proto.onClick = function onClickWithRegressionFix(event) {
      const actionable = event.target.closest?.('[data-tuning-close],[data-tuning-save],[data-tuning-reset],[data-tuning-step],[data-tuning-preset],[data-custom-stage-pick-done],[data-custom-stage-pick-side],[data-stage-id]');
      if (actionable && this.root?.contains(actionable)) press(actionable);
      const result = click.call(this, event);
      requestAnimationFrame(() => { resolveTuningIcons(this); animateCurrentOverlay(this); });
      return result;
    };
  }

  const input = proto.onInput;
  if (typeof input === 'function') {
    proto.onInput = function onInputWithRegressionFix(event) {
      const result = input.call(this, event);
      requestAnimationFrame(() => resolveTuningIcons(this));
      return result;
    };
  }
}

installFormationUiRegressionFixPatch();
