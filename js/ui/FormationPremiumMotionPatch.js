import { FormationEditor } from './FormationEditor.js';

/*
 * Premium motion pass for the non-battle shell.
 * Adds direction-aware page-switch slides, staggered catalog entrances, and
 * spring open/close + hierarchy transitions for the stage selector overlay.
 * All effects are transient CSS classes consumed by css/nyanko-premium-polish.css;
 * no DOM structure or data flow changes. Honors prefers-reduced-motion.
 * Must be installed after every other FormationEditor patch so its wrappers run outermost.
 */

const PATCH_FLAG = Symbol.for('wanko-ui.formation-premium-motion.v1');
const STAGE_CLOSE_MS = 190;

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

export function installFormationPremiumMotionPatch() {
  const proto = FormationEditor?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  const originalSwitchPage = proto.switchPage;
  proto.switchPage = function switchPageWithPremiumMotion(page, reason) {
    const previousPage = this.activePage;
    const result = originalSwitchPage.call(this, page, reason);
    if (this.activePage !== previousPage) {
      const slots = this.root?.querySelector?.('.formation-slots');
      if (slots) {
        slots.dataset.pageDir = this.activePage > previousPage ? 'fwd' : 'back';
        transientClass(slots, 'is-page-enter', 460);
      }
    }
    return result;
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
      transientClass(this.root?.querySelector?.('.formation-catalog-grid'), 'is-catalog-enter', 620);
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
      if (!wasOpen) {
        this.__premiumStageViewSignature = signature;
        transientClass(overlay, 'is-opening', 460);
        transientClass(overlay.querySelector('.formation-stage-list'), 'is-view-enter', 460);
      } else if (signature !== this.__premiumStageViewSignature) {
        // Hierarchy changed (category -> map -> stage); scroll/filter re-renders keep the same signature.
        this.__premiumStageViewSignature = signature;
        transientClass(overlay.querySelector('.formation-stage-list'), 'is-view-enter', 460);
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
}

installFormationPremiumMotionPatch();
