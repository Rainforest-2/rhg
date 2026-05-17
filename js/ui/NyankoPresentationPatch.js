const ROOT_CLASS = 'nyanko-ui-polish';
const APPLY_READY = 'いざ出撃!!';
const APPLY_BUSY = '出撃準備中…';
let installed = false;
let scheduled = false;

function setText(el, text) {
  if (el && el.textContent !== text) el.textContent = text;
}

function localizeStaticLabels(root = document) {
  document.body?.classList.add(ROOT_CLASS);

  const formation = root.querySelector('.formation-ui');
  if (!formation) return;

  setText(formation.querySelector('.formation-header h3'), 'キャラクター編成');
  setText(formation.querySelector('.formation-header p'), 'キャラを選んで10枠の出撃デッキを作成。準備できたらステージへ出撃。');

  for (const button of formation.querySelectorAll('.apply-battle-button')) {
    const current = String(button.textContent || '').trim();
    if (/applying/i.test(current) || current === APPLY_BUSY) setText(button, APPLY_BUSY);
    else setText(button, APPLY_READY);
  }

  const actionLabels = {
    'stage-open': 'ステージ選択',
    'stage-close': 'とじる',
    clear: 'はずす',
    reset: '初期編成'
  };
  for (const [action, label] of Object.entries(actionLabels)) {
    for (const el of formation.querySelectorAll(`[data-action='${action}']`)) setText(el, label);
  }

  const filterLabels = { all: 'すべて', dog: 'わんこ軍', cat: 'にゃんこ軍' };
  for (const [filter, label] of Object.entries(filterLabels)) {
    for (const el of formation.querySelectorAll(`[data-filter='${filter}']`)) setText(el, label);
  }

  for (const tab of formation.querySelectorAll('.formation-page-tab')) {
    const page = Number(tab.dataset.page || 0) + 1;
    const strong = tab.querySelector('strong');
    if (strong) setText(strong, `${page}ページ`);
  }

  const activeLabel = formation.querySelector('.formation-active-page-label');
  if (activeLabel) {
    const match = String(activeLabel.textContent || '').match(/PAGE\s*(\d+)/i);
    const page = match ? match[1] : '1';
    setText(activeLabel, `出撃スロット ${page} / 10枠編成`);
  }

  const summary = formation.querySelector('.formation-catalog-summary');
  if (summary) {
    const match = String(summary.textContent || '').match(/Catalog\s+(\d+)\s+\/\s+DOG\s+(\d+)\s+\/\s+CAT\s+(\d+)/i);
    if (match) setText(summary, `表示 ${match[1]}体 / わんこ ${match[2]} / にゃんこ ${match[3]}`);
  }

  const hint = formation.querySelector('.formation-action-hint');
  if (hint) {
    const text = String(hint.textContent || '');
    if (/PAGE|selected|slot cleared|Formation reset/i.test(text)) {
      setText(hint, 'ページを切り替えて、好きなキャラをタップすると編成に入ります。');
    }
  }

  for (const slot of formation.querySelectorAll('.formation-slot')) {
    const empty = slot.querySelector(':scope > span');
    if (empty && empty.textContent === 'EMPTY') setText(empty, '空き枠');
  }
}

function schedulePolish(root = document) {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    localizeStaticLabels(root);
  });
}

function scheduleInitialRetries(root = document) {
  schedulePolish(root);
  setTimeout(() => schedulePolish(root), 80);
  setTimeout(() => schedulePolish(root), 240);
  setTimeout(() => schedulePolish(root), 800);
}

export function installNyankoPresentationPolish(root = document) {
  if (installed) return;
  installed = true;
  document.body?.classList.add(ROOT_CLASS);
  scheduleInitialRetries(root);

  root.addEventListener('click', (event) => {
    if (event.target.closest?.('.formation-ui')) schedulePolish(root);
  }, true);
  root.addEventListener('input', (event) => {
    if (event.target.closest?.('.formation-ui')) schedulePolish(root);
  }, true);
  root.addEventListener('pointerup', (event) => {
    if (event.target.closest?.('.formation-ui')) schedulePolish(root);
  }, true);

  globalThis.__NYANKO_PRESENTATION_POLISH__ = { refresh: () => scheduleInitialRetries(root) };
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => installNyankoPresentationPolish(document), { once: true });
  } else {
    installNyankoPresentationPolish(document);
  }
}