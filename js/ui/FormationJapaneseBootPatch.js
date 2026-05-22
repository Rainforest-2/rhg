import { FormationEditor } from './FormationEditor.js';
import { writePersistedStageId } from '../battle/StageRegistry.js';

const APPLY_READY = 'いざ出撃!!';
const APPLY_BUSY = '出撃準備中…';
const INSTALLED = Symbol.for('bcu.FormationJapaneseBootPatch.installed');
const OBSERVER = Symbol.for('bcu.FormationJapaneseBootPatch.observer');

function setText(el, text) {
  if (el && el.textContent !== text) el.textContent = text;
}

function translateHint(text) {
  const raw = String(text || '').trim();
  let m = raw.match(/^PAGE\s*(\d+)\s*selected$/i);
  if (m) return `${m[1]}ページを選択しました`;
  m = raw.match(/^PAGE\s*(\d+)\s*slot cleared$/i);
  if (m) return `${m[1]}ページの枠をはずしました`;
  m = raw.match(/^PAGE\s*(\d+)\s*selected:\s*(.+)$/i);
  if (m) return `${m[1]}ページに編成: ${m[2]}`;
  if (/^Formation reset to default$/i.test(raw)) return '初期編成に戻しました';
  if (/^Apply failed:/i.test(raw)) return raw.replace(/^Apply failed:/i, '出撃に失敗:');
  return raw;
}

function localizeFormationRoot(root) {
  if (!root?.querySelector) return;

  setText(root.querySelector('.formation-header h3'), 'キャラクター編成');
  setText(root.querySelector('.formation-header p'), 'キャラを選んで10枠の出撃デッキを作成。準備できたらステージへ出撃。');

  for (const button of root.querySelectorAll('.apply-battle-button')) {
    const current = String(button.textContent || '').trim();
    setText(button, /applying/i.test(current) || current === APPLY_BUSY ? APPLY_BUSY : APPLY_READY);
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
    setText(tab.querySelector('strong'), `${page}ページ`);
  }

  const activeLabel = root.querySelector('.formation-active-page-label');
  if (activeLabel) {
    const pageFromText = String(activeLabel.textContent || '').match(/PAGE\s*(\d+)/i)?.[1];
    const page = pageFromText || String((Number(root.querySelector('.formation-page-tab.is-active')?.dataset.page || 0) + 1));
    setText(activeLabel, `出撃スロット ${page} / 10枠編成`);
  }

  const summary = root.querySelector('.formation-catalog-summary');
  if (summary) {
    const m = String(summary.textContent || '').match(/Catalog\s+(\d+)\s+\/\s+DOG\s+(\d+)\s+\/\s+CAT\s+(\d+)/i);
    if (m) setText(summary, `表示 ${m[1]}体 / わんこ ${m[2]} / にゃんこ ${m[3]}`);
  }

  const hint = root.querySelector('.formation-action-hint');
  if (hint) {
    const translated = translateHint(hint.textContent);
    if (translated) setText(hint, translated);
  }

  for (const slot of root.querySelectorAll('.formation-slot')) {
    const empty = slot.querySelector(':scope > span');
    if (empty && empty.textContent === 'EMPTY') setText(empty, '空き枠');
  }

  for (const faction of root.querySelectorAll('.formation-character-card > span')) {
    if (faction.textContent === 'DOG') setText(faction, 'わんこ');
    if (faction.textContent === 'CAT') setText(faction, 'にゃんこ');
  }

  const emptyStages = root.querySelector('.formation-stage-empty');
  if (emptyStages && /No stage bundle entries available/i.test(emptyStages.textContent || '')) {
    setText(emptyStages, '利用できるステージがありません');
  }
}

function scheduleLocalize(root) {
  if (!root || root.__formationJapaneseBootPatchPending) return;
  root.__formationJapaneseBootPatchPending = true;
  queueMicrotask(() => {
    root.__formationJapaneseBootPatchPending = false;
    localizeFormationRoot(root);
  });
}

function installObserver(editor) {
  const root = editor?.root;
  if (!root || root[OBSERVER] || typeof MutationObserver === 'undefined') return;
  const observer = new MutationObserver(() => scheduleLocalize(root));
  observer.observe(root, { childList: true, characterData: true, subtree: true });
  root[OBSERVER] = observer;
}

function installFormationJapaneseBootPatch() {
  const proto = FormationEditor?.prototype;
  if (!proto || proto[INSTALLED]) return;
  proto[INSTALLED] = true;

  const originalSetHint = proto.setHint;
  proto.setHint = function patchedSetHint(text) {
    return originalSetHint.call(this, translateHint(text));
  };

  const originalRefresh = proto.refresh;
  proto.refresh = function patchedRefresh(...args) {
    const result = originalRefresh.apply(this, args);
    installObserver(this);
    localizeFormationRoot(this.root);
    return result;
  };

  const originalRenderDynamic = proto.renderDynamic;
  proto.renderDynamic = function patchedRenderDynamic(...args) {
    const result = originalRenderDynamic.apply(this, args);
    localizeFormationRoot(this.root);
    return result;
  };

  const originalRenderStageSelector = proto.renderStageSelector;
  proto.renderStageSelector = function patchedRenderStageSelector(...args) {
    const result = originalRenderStageSelector.apply(this, args);
    localizeFormationRoot(this.root);
    return result;
  };

  const originalSelectStage = proto.selectStage;
  proto.selectStage = function patchedSelectStage(stageId) {
    writePersistedStageId(stageId || null);
    const result = originalSelectStage.call(this, stageId);
    localizeFormationRoot(this.root);
    return result;
  };

  const originalOnClick = proto.onClick;
  proto.onClick = async function patchedOnClick(...args) {
    try {
      return await originalOnClick.apply(this, args);
    } finally {
      localizeFormationRoot(this.root);
    }
  };

  globalThis.__FORMATION_JAPANESE_BOOT_PATCH__ = {
    apply: (root = document.querySelector('.formation-ui')) => localizeFormationRoot(root),
    storageKey: 'bcu.selectedStageId'
  };
}

installFormationJapaneseBootPatch();
