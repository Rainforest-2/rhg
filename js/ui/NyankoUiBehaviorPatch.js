const RESTORE_DELAY_FRAMES = 2;
let installed = false;

function getFormationRoot(target) {
  return target?.closest?.('.formation-ui') || document.querySelector('.formation-ui');
}

function getCatalogScroller(target) {
  return getFormationRoot(target)?.querySelector?.('.formation-catalog-scroll') || null;
}

function restoreCatalogScroll(scroller, scrollTop, frames = RESTORE_DELAY_FRAMES) {
  if (!scroller || !Number.isFinite(scrollTop)) return;
  const run = (remaining) => {
    if (!scroller.isConnected) return;
    scroller.scrollTop = scrollTop;
    if (remaining > 0) requestAnimationFrame(() => run(remaining - 1));
  };
  requestAnimationFrame(() => run(frames));
}

export function installNyankoUiBehaviorPatch(root = document) {
  if (installed) return;
  installed = true;

  let lastCatalogScrollTop = 0;

  root.addEventListener('pointerdown', (event) => {
    const card = event.target.closest?.('[data-character]');
    if (!card) return;
    lastCatalogScrollTop = getCatalogScroller(card)?.scrollTop || 0;
  }, true);

  root.addEventListener('click', (event) => {
    const character = event.target.closest?.('[data-character]');
    if (!character) return;
    restoreCatalogScroll(getCatalogScroller(character), lastCatalogScrollTop);
  }, true);

  globalThis.__NYANKO_UI_BEHAVIOR_PATCH__ = { refresh: () => {} };
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => installNyankoUiBehaviorPatch(document), { once: true });
  } else {
    installNyankoUiBehaviorPatch(document);
  }
}
