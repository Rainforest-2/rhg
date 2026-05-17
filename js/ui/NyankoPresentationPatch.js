const ROOT_CLASS = 'nyanko-ui-polish';
const APPLY_READY = 'いざ出撃!!';
const APPLY_BUSY = '出撃準備中…';

function setText(el, text) {
  if (el && el.textContent !== text) el.textContent = text;
}

function localizeStaticLabels(root = document) {
  document.body?.classList.add(ROOT_CLASS);

  setText(root.querySelector('.formation-header h3'), 'キャラクター編成');
  setText(root.querySelector('.formation-header p'), 'キャラを選んで10枠の出撃デッキを作成。準備できたらステージへ出撃。');

  for (const button of root.querySelectorAll('.apply-battle-button')) {
    const current = String(button.textContent || '').trim();
    if (/applying/i.test(current) || current === '出撃準備中…') setText(button, APPLY_BUSY);
    else setText(button, APPLY_READY);
  }

  const actionLabels = {
    'stage-open': 'ステージ選択',
    'stage-close': 'とじる',
    clear: 'はずす',
    reset: '初期編成'
  };
  for (const [action, label] of Object.entries(actionLabels)) {
    for (const el of root.querySelectorAll(`[data-action='${action}']`)) setText(el, label);
  }

  const filterLabels = { all: 'すべて', dog: 'わんこ軍', cat: 'にゃんこ軍' };
  for (const [filter, label] of Object.entries(filterLabels)) {
    for (const el of root.querySelectorAll(`[data-filter='${filter}']`)) setText(el, label);
  }

  for (const tab of root.querySelectorAll('.formation-page-tab')) {
    const page = Number(tab.dataset.page || 0) + 1;
    const strong = tab.querySelector('strong');
    if (strong) setText(strong, `${page}ページ`);
  }

  const activeLabel = root.querySelector('.formation-active-page-label');
  if (activeLabel) {
    const match = String(activeLabel.textContent || '').match(/PAGE\s*(\d+)/i);
    const page = match ? match[1] : '1';
    setText(activeLabel, `出撃スロット ${page} / 10枠編成`);
  }

  const summary = root.querySelector('.formation-catalog-summary');
  if (summary) {
    const match = String(summary.textContent || '').match(/Catalog\s+(\d+)\s+\/\s+DOG\s+(\d+)\s+\/\s+CAT\s+(\d+)/i);
    if (match) setText(summary, `表示 ${match[1]}体 / わんこ ${match[2]} / にゃんこ ${match[3]}`);
  }

  const hint = root.querySelector('.formation-action-hint');
  if (hint) {
    const text = String(hint.textContent || '');
    if (/PAGE|selected|slot cleared|Formation reset/i.test(text)) {
      setText(hint, 'ページを切り替えて、好きなキャラをタップすると編成に入ります。');
    }
  }

  for (const card of root.querySelectorAll('.formation-character-card')) {
    const faction = card.dataset.faction;
    const label = card.querySelector(':scope > span');
    if (label) setText(label, faction === 'dog' ? 'わんこ' : 'にゃんこ');
    card.setAttribute('aria-label', `${faction === 'dog' ? 'わんこ' : 'にゃんこ'} ${card.querySelector('strong')?.textContent || ''}`.trim());
  }

  for (const slot of root.querySelectorAll('.formation-slot')) {
    const empty = slot.querySelector(':scope > span');
    if (empty && empty.textContent === 'EMPTY') setText(empty, '空き枠');
  }

  const stageTitle = root.querySelector('.formation-stage-dialog header strong');
  setText(stageTitle, 'ステージ選択');
  const stageLead = root.querySelector('.formation-stage-dialog header span');
  setText(stageLead, '遊ぶステージを選択してください');

  for (const card of root.querySelectorAll('.formation-stage-card')) {
    const details = card.querySelectorAll('span');
    const primary = details[0];
    const match = String(primary?.textContent || '').match(/BG\s+([^/]+)\s+\/\s+HP\s+([^/]+)\s+\/\s+rows\s+(.+)/i);
    if (primary && match) setText(primary, `背景 ${match[1].trim()} / 城HP ${match[2].trim()} / 敵 ${match[3].trim()}種`);
    if (details[1]) details[1].setAttribute('hidden', '');
    const em = card.querySelector('em');
    if (em) em.setAttribute('hidden', '');
  }
}

let scheduled = false;
function schedulePolish(root = document) {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    localizeStaticLabels(root);
  });
}

export function installNyankoPresentationPolish(root = document) {
  localizeStaticLabels(root);
  const observer = new MutationObserver(() => schedulePolish(root));
  observer.observe(root.body || root.documentElement, { childList: true, subtree: true, characterData: true });
  globalThis.__NYANKO_PRESENTATION_POLISH__ = { observer, refresh: () => localizeStaticLabels(root) };
  return observer;
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => installNyankoPresentationPolish(document), { once: true });
  } else {
    installNyankoPresentationPolish(document);
  }
}
