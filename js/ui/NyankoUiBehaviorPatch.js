const RESTORE_DELAY_FRAMES = 3;

function getCatalogScroller(target) {
  return target?.closest?.('.formation-ui')?.querySelector?.('.formation-catalog-scroll') || null;
}

function restoreCatalogScroll(scroller, scrollTop, frames = RESTORE_DELAY_FRAMES) {
  if (!scroller) return;
  const tick = () => {
    if (!scroller.isConnected) return;
    scroller.scrollTop = scrollTop;
    scroller.dispatchEvent(new Event('scroll', { bubbles: true }));
    if (frames > 0) requestAnimationFrame(() => restoreCatalogScroll(scroller, scrollTop, frames - 1));
  };
  requestAnimationFrame(tick);
}

function installCatalogScrollPreserver(root = document) {
  root.addEventListener('pointerdown', (event) => {
    const card = event.target.closest?.('[data-character]');
    if (!card) return;
    const scroller = getCatalogScroller(card);
    card.dataset.restoreCatalogScrollTop = String(scroller?.scrollTop || 0);
  }, true);

  root.addEventListener('click', (event) => {
    const card = event.target.closest?.('[data-character]');
    if (!card) return;
    const scrollTop = Number(card.dataset.restoreCatalogScrollTop || 0);
    const scroller = getCatalogScroller(card);
    if (Number.isFinite(scrollTop)) restoreCatalogScroll(scroller, scrollTop);
  }, true);
}

function beautifyStageSelector(root = document) {
  for (const dialog of root.querySelectorAll('.formation-stage-dialog')) {
    dialog.setAttribute('aria-label', 'ステージ選択');
    const title = dialog.querySelector('header strong');
    if (title) title.textContent = 'ステージを選ぶ';
    const lead = dialog.querySelector('header span');
    if (lead) lead.textContent = '遊びたいステージをタップ';
  }

  for (const card of root.querySelectorAll('.formation-stage-card')) {
    const name = card.querySelector('strong');
    const stageId = card.dataset.stageId || card.querySelector('small')?.textContent || '';
    if (name && !name.dataset.cleanedStageName) {
      name.dataset.cleanedStageName = '1';
      name.textContent = String(name.textContent || '').replace(/name unresolved/i, 'ステージ').trim() || 'ステージ';
    }

    const code = card.querySelector('small');
    if (code) {
      code.textContent = 'ステージ';
      code.setAttribute('aria-label', stageId);
    }

    const details = card.querySelectorAll('span');
    if (details[0]) details[0].textContent = card.classList.contains('is-active') ? '選択中' : 'タップして選択';
    for (let i = 1; i < details.length; i += 1) details[i].setAttribute('hidden', '');
    card.querySelector('em')?.setAttribute('hidden', '');
  }
}

function installStageSelectorCleaner(root = document) {
  let scheduled = false;
  const run = () => {
    scheduled = false;
    beautifyStageSelector(root);
  };
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(run);
  };

  beautifyStageSelector(root);
  const observer = new MutationObserver(schedule);
  observer.observe(root.body || root.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class'] });
  globalThis.__NYANKO_UI_BEHAVIOR_PATCH__ = { observer, refresh: () => beautifyStageSelector(root) };
}

export function installNyankoUiBehaviorPatch(root = document) {
  installCatalogScrollPreserver(root);
  installStageSelectorCleaner(root);
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => installNyankoUiBehaviorPatch(document), { once: true });
  } else {
    installNyankoUiBehaviorPatch(document);
  }
}
