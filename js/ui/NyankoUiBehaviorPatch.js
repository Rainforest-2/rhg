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

function polishVisibleStageSelector(root = document) {
  const dialog = root.querySelector('.formation-stage-dialog');
  if (!dialog) return;
  const title = dialog.querySelector('header strong');
  if (title) title.textContent = 'ステージを選ぶ';
  const lead = dialog.querySelector('header span');
  if (lead) lead.textContent = '遊びたいステージをタップ';

  for (const card of dialog.querySelectorAll('.formation-stage-card')) {
    const code = card.querySelector('small');
    if (code) code.textContent = card.classList.contains('is-active') ? '選択中' : 'ステージ';
    const details = card.querySelectorAll('span');
    if (details[0]) details[0].textContent = card.classList.contains('is-active') ? '選択中' : 'タップして選択';
    for (let i = 1; i < details.length; i += 1) details[i].hidden = true;
    const reason = card.querySelector('em');
    if (reason) reason.hidden = true;
  }
}

function scheduleStagePolish(root = document) {
  requestAnimationFrame(() => polishVisibleStageSelector(root));
  setTimeout(() => polishVisibleStageSelector(root), 80);
  setTimeout(() => polishVisibleStageSelector(root), 240);
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
    if (character) {
      restoreCatalogScroll(getCatalogScroller(character), lastCatalogScrollTop);
      return;
    }

    if (event.target.closest?.('[data-action="stage-open"], [data-stage-id], [data-action="stage-close"]')) {
      scheduleStagePolish(root);
    }
  }, true);

  root.addEventListener('pointerup', (event) => {
    if (event.target.closest?.('[data-action="stage-open"], [data-stage-id]')) scheduleStagePolish(root);
  }, true);

  scheduleStagePolish(root);
  globalThis.__NYANKO_UI_BEHAVIOR_PATCH__ = { refresh: () => scheduleStagePolish(root) };
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => installNyankoUiBehaviorPatch(document), { once: true });
  } else {
    installNyankoUiBehaviorPatch(document);
  }
}
