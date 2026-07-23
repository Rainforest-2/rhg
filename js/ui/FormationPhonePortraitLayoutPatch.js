import { FormationEditor } from './FormationEditor.js';

// Portrait companion to FormationPhoneLandscapeLayoutPatch: the portrait card
// geometry lives in css/mobile-portrait-fit.css (linked from index.html), and
// this patch only keeps the catalog virtual-scroll metrics in sync with it.
// Without it the portrait catalog keeps the desktop rowHeight (194px) while
// the painted cards are 132px + 6px gap, so long catalogs drift: the spacer
// math overshoots and scrolled-to rows render blank until the next re-render.
const PATCH_FLAG = Symbol.for('wanko-ui.formation-phone-portrait-layout.v1');
const PHONE_PORTRAIT_QUERY = '(orientation: portrait) and (max-width: 760px)';

// css/mobile-portrait-fit.css: .formation-character-card height 132px,
// .formation-catalog-grid gap 6px, grid-template-columns repeat(3, ...).
const PORTRAIT_CARD_HEIGHT = 132;
const PORTRAIT_GRID_GAP = 6;
const PORTRAIT_COLUMNS = 3;

function isPhonePortrait() {
  return globalThis.matchMedia?.(PHONE_PORTRAIT_QUERY)?.matches === true;
}

function applyMetrics(editor) {
  if (!editor?.catalogVirtual || !isPhonePortrait()) return;
  editor.catalogVirtual = {
    ...editor.catalogVirtual,
    rowHeight: PORTRAIT_CARD_HEIGHT + PORTRAIT_GRID_GAP,
    overscanRows: 6
  };
}

// The catalog's first render happens while .formation-ui is still display:none
// (boot constructs the editor before PreviewApp shows it), so the virtual-DOM
// column estimate falls back to 1 (clientWidth 0) and the initial window only
// covers a third of the portrait grid until the first scroll re-render. Once
// the editor becomes visible, re-render the window against real layout — same
// idea as stabilizeCatalogAfterLayout in the landscape patch.
function stabilizeAfterShow(editor) {
  if (!isPhonePortrait() || !editor?.root || editor.__phonePortraitStabilizeFrame) return;
  editor.__phonePortraitStabilizeFrame = requestAnimationFrame(() => {
    editor.__phonePortraitStabilizeFrame = null;
    if (!isPhonePortrait() || !editor.root?.isConnected) return;
    const scroller = editor.root.querySelector('.formation-catalog-scroll');
    if (!scroller || scroller.clientWidth <= 0 || scroller.clientHeight <= 0) return;
    applyMetrics(editor);
    editor.renderCatalogWindow?.();
    editor.resolveSemanticIcons?.();
    editor.updateFormationIconDebug?.();
  });
}

export function installFormationPhonePortraitLayoutPatch() {
  const proto = FormationEditor?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  const originalEstimate = proto.estimateCatalogColumns;
  if (typeof originalEstimate === 'function') {
    proto.estimateCatalogColumns = function estimateCatalogColumnsPhonePortrait(scroller) {
      if (isPhonePortrait()) return PORTRAIT_COLUMNS;
      return originalEstimate.call(this, scroller);
    };
  }

  for (const method of ['refresh', 'renderDynamic', 'renderCatalogWindow']) {
    const original = proto[method];
    if (typeof original !== 'function') continue;
    proto[method] = function withPhonePortraitMetrics(...args) {
      applyMetrics(this);
      return original.apply(this, args);
    };
  }

  const originalSetVisible = proto.setVisible;
  if (typeof originalSetVisible === 'function') {
    proto.setVisible = function setVisibleWithPhonePortraitStabilize(visible) {
      const result = originalSetVisible.call(this, visible);
      if (visible) stabilizeAfterShow(this);
      return result;
    };
  }

  // Re-render on rotation so the virtual window switches metric sets together
  // with the orientation-guarded stylesheets (mirrors the landscape patch).
  globalThis.matchMedia?.(PHONE_PORTRAIT_QUERY)?.addEventListener?.('change', () => {
    for (const root of document.querySelectorAll('.formation-ui')) {
      if (root.querySelector('.cm-host-layer.is-open')) continue;
      root.__formationEditor?.renderDynamic?.({ resetCatalogScroll: false });
    }
  });
}

installFormationPhonePortraitLayoutPatch();
