import { FormationEditor } from './FormationEditor.js';

/*
 * Premium motion pass for the non-battle shell.
 * Adds staggered catalog entrances plus spring open/close + hierarchy
 * transitions for the stage selector overlay.
 * All effects are transient CSS classes consumed by css/nyanko-premium-polish.css;
 * no DOM structure or data flow changes. Honors prefers-reduced-motion.
 * Must be installed after every other FormationEditor patch so its wrappers run outermost.
 */

const PATCH_FLAG = Symbol.for('wanko-ui.formation-premium-motion.v1');
const STAGE_CLOSE_MS = 120;
const SETTINGS_CLOSE_MS = 140;
const PAGE_CLOSE_MS = 170;

const reduceMotion = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;

function transientClass(el, cls, ms) {
  if (!el || reduceMotion()) return;
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
  const timers = (el.__premiumMotionTimers ||= {});
  clearTimeout(timers[cls]);
  timers[cls] = setTimeout(() => el.classList.remove(cls), ms);
}

function stageViewSignature(editor) {
  const state = editor.stageSelectorState || {};
  return `${state.level || ''}:${state.categoryId || ''}:${state.mapKey || ''}`;
}

// Hierarchy depth of each selector view, so a drill can slide in the direction
// of travel: deeper (category -> map -> stage) reads as forward, popping back
// up a level reads as backward.
const STAGE_LEVEL_DEPTH = { category: 0, map: 1, stage: 2, 'custom-stage-battle': 2 };

function stageViewLevel(editor) {
  return editor.stageSelectorState?.level || 'category';
}

function stageViewDir(prevLevel, nextLevel) {
  const prev = STAGE_LEVEL_DEPTH[prevLevel] ?? 0;
  const next = STAGE_LEVEL_DEPTH[nextLevel] ?? 0;
  return next < prev ? 'back' : 'fwd';
}

export function installFormationPremiumMotionPatch() {
  const proto = FormationEditor?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  const originalSetVisible = proto.setVisible;
  proto.setVisible = function setVisibleWithPremiumPageMotion(visible, ...args) {
    if (!this.root) return originalSetVisible.call(this, visible, ...args);
    clearTimeout(this.__premiumFormationCloseTimer);
    if (visible) {
      const result = originalSetVisible.call(this, true, ...args);
      this.root.classList.remove('is-page-leaving');
      transientClass(this.root, 'is-page-opening', 220);
      return result;
    }
    if (reduceMotion() || !this.root.classList.contains('is-visible')) {
      this.root.classList.remove('is-page-opening', 'is-page-leaving');
      return originalSetVisible.call(this, false, ...args);
    }
    this.root.classList.remove('is-page-opening');
    this.root.classList.add('is-visible', 'is-page-leaving');
    this.__premiumFormationCloseTimer = setTimeout(() => {
      this.root?.classList.remove('is-page-leaving');
      originalSetVisible.call(this, false, ...args);
    }, PAGE_CLOSE_MS);
    return undefined;
  };

  const originalOnClick = proto.onClick;
  proto.onClick = function onClickWithPremiumMotion(event) {
    const filter = event?.target?.closest?.('[data-filter]');
    if (filter && this.root?.contains(filter)) this.__premiumCatalogEnter = true;
    return originalOnClick.call(this, event);
  };

  const originalRenderDynamic = proto.renderDynamic;
  proto.renderDynamic = function renderDynamicWithPremiumMotion(...args) {
    const previousCount = this.__premiumCatalogCount || 0;
    const result = originalRenderDynamic.apply(this, args);
    const count = this.catalogItems?.length || 0;
    this.__premiumCatalogCount = count;
    // Stagger entrances when the faction filter swaps the list or when the
    // catalog first fills after the BCU database loads; never on scroll re-renders.
    if (this.__premiumCatalogEnter || (previousCount === 0 && count > 0)) {
      this.__premiumCatalogEnter = false;
      transientClass(this.root?.querySelector?.('.formation-catalog-grid'), 'is-catalog-enter', 260);
    }
    return result;
  };

  const originalRenderStageSelector = proto.renderStageSelector;
  proto.renderStageSelector = function renderStageSelectorWithPremiumMotion(...args) {
    const wasOpen = this.__premiumStageOpen === true;
    const result = originalRenderStageSelector.apply(this, args);
    const overlay = this.root?.querySelector?.('.formation-stage-overlay');
    const isOpen = this.stageOverlayOpen === true;
    this.__premiumStageOpen = isOpen;
    if (!overlay) return result;
    if (isOpen) {
      clearTimeout(this.__premiumStageCloseTimer);
      overlay.classList.remove('is-closing');
      const signature = stageViewSignature(this);
      const level = stageViewLevel(this);
      const list = overlay.querySelector('.formation-stage-list');
      if (!wasOpen) {
        this.__premiumStageViewSignature = signature;
        this.__premiumStageViewLevel = level;
        if (list) list.dataset.viewDir = 'fwd';
        // Timers outlast the longest child animation (header .34s, last staggered
        // card ~.43s) so `both` never snaps mid-flight when the class is removed.
        transientClass(overlay, 'is-opening', 380);
        transientClass(list, 'is-view-enter', 480);
      } else if (signature !== this.__premiumStageViewSignature) {
        // Hierarchy changed (category -> map -> stage); scroll/filter re-renders keep the same signature.
        if (list) list.dataset.viewDir = stageViewDir(this.__premiumStageViewLevel, level);
        this.__premiumStageViewSignature = signature;
        this.__premiumStageViewLevel = level;
        transientClass(list, 'is-view-enter', 480);
      }
    } else if (wasOpen && !reduceMotion()) {
      overlay.classList.add('is-open', 'is-closing');
      clearTimeout(this.__premiumStageCloseTimer);
      this.__premiumStageCloseTimer = setTimeout(() => {
        if (this.__premiumStageOpen) return;
        overlay.classList.remove('is-open', 'is-closing');
      }, STAGE_CLOSE_MS);
    }
    return result;
  };

  // Settings overlay: same spring-open / fade-close treatment as the stage
  // selector so opening and closing the settings page reads as a smooth
  // transition instead of an instant display:none flip.
  const originalRenderSettingsOverlay = proto.renderSettingsOverlay;
  if (typeof originalRenderSettingsOverlay === 'function') {
    proto.renderSettingsOverlay = function renderSettingsOverlayWithPremiumMotion(...args) {
      const wasOpen = this.__premiumSettingsOpen === true;
      const result = originalRenderSettingsOverlay.apply(this, args);
      const overlay = this.root?.querySelector?.('.formation-settings-overlay');
      const isOpen = this.settingsOverlayOpen === true;
      this.__premiumSettingsOpen = isOpen;
      if (!overlay) return result;
      if (isOpen) {
        clearTimeout(this.__premiumSettingsCloseTimer);
        overlay.classList.remove('is-closing');
        if (!wasOpen) transientClass(overlay, 'is-opening', 240);
      } else if (wasOpen && !reduceMotion()) {
        overlay.classList.add('is-open', 'is-closing');
        clearTimeout(this.__premiumSettingsCloseTimer);
        this.__premiumSettingsCloseTimer = setTimeout(() => {
          if (this.__premiumSettingsOpen) return;
          overlay.classList.remove('is-open', 'is-closing');
        }, SETTINGS_CLOSE_MS);
      }
      return result;
    };
  }
}

installFormationPremiumMotionPatch();
