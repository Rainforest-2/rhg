import { FormationEditor } from './FormationEditor.js';
import { debounce, withFocusRestore } from './UiMotion.mjs';

const PATCH_FLAG = Symbol.for('wanko-ui.formation-stage-difficulty-filter-controls.v3');
const DIFFICULTY_FLAG = Symbol.for('wanko-ui.formation-stage-difficulty.v2-scoped');
const PRO_STYLE_ID = 'nyanko-stage-selector-pro-css';

function ensureProStyles() {
  if (document.getElementById(PRO_STYLE_ID)) return;
  const link = document.createElement('link');
  link.id = PRO_STYLE_ID;
  link.rel = 'stylesheet';
  link.href = './css/nyanko-stage-selector-pro.css';
  document.head.appendChild(link);
}

function norm(value) {
  return String(value ?? '').normalize('NFKC').toLowerCase().trim();
}

function filterState(editor) {
  const f = editor.__bcuStageDifficultyFilter || {};
  return {
    q: norm(f.q),
    min: f.min === '' || f.min == null ? null : Number(f.min),
    max: f.max === '' || f.max == null ? null : Number(f.max)
  };
}

function isFiltering(f) {
  return !!f.q || Number.isFinite(f.min) || Number.isFinite(f.max);
}

function parseDifficultyRange(card) {
  const rawMin = card.dataset.stageDifficultyMin ?? card.dataset.stageDifficulty;
  const rawMax = card.dataset.stageDifficultyMax ?? card.dataset.stageDifficulty;
  const dataMin = rawMin === '' || rawMin == null ? NaN : Number(rawMin);
  const dataMax = rawMax === '' || rawMax == null ? NaN : Number(rawMax);
  if (Number.isFinite(dataMin) && Number.isFinite(dataMax)) {
    return { min: Math.min(dataMin, dataMax), max: Math.max(dataMin, dataMax), text: `★${dataMin}${dataMax === dataMin ? '' : `-${dataMax}`}` };
  }
  const text = card.querySelector('.formation-stage-difficulty-badge')?.textContent || '';
  const match = text.match(/★\s*(\d+)(?:\s*-\s*(\d+))?/);
  if (!match) return null;
  const min = Number(match[1]);
  const max = Number(match[2] ?? match[1]);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  return { min: Math.min(min, max), max: Math.max(min, max), text };
}

function cardMatchesFilter(card, f) {
  if (!isFiltering(f)) return true;
  const range = parseDifficultyRange(card);
  if (Number.isFinite(f.min) && (!range || range.max < f.min)) return false;
  if (Number.isFinite(f.max) && (!range || range.min > f.max)) return false;
  if (!f.q) return true;
  return norm(card.textContent).includes(f.q) || norm(card.dataset.stageMap || card.dataset.stageId || '').includes(f.q);
}

function setCardFiltered(card, hidden) {
  card.classList.toggle('is-difficulty-filtered', hidden);
  card.hidden = hidden;

  if (hidden) {
    card.style.setProperty('display', 'none', 'important');
  } else {
    card.style.removeProperty('display');
  }
}

function applyDomDifficultyFilter(editor) {
  ensureProStyles();
  const root = editor.root;
  if (!root) return;
  const f = filterState(editor);
  const cards = [...root.querySelectorAll('.formation-stage-card-map[data-stage-map],.formation-stage-card-stage[data-stage-id]')];
  let matched = 0;
  let hidden = 0;
  for (const card of cards) {
    const ok = cardMatchesFilter(card, f);
    if (ok) matched += 1;
    else hidden += 1;
    setCardFiltered(card, isFiltering(f) && !ok);
  }
  const summary = root.querySelector('.formation-stage-difficulty-summary');
  if (summary) summary.textContent = isFiltering(f) ? `表示中 ${matched} / ${cards.length}` : `表示中 ${cards.length - hidden} / ${cards.length}`;
  const debug = {
    source: 'FormationStageDifficultyFilterControlPatch',
    filter: f,
    cardCount: cards.length,
    matchedCount: matched,
    hiddenCount: hidden,
    active: isFiltering(f),
    sample: cards.slice(0, 12).map((card) => ({
      key: card.dataset.stageMap || card.dataset.stageId || null,
      text: card.textContent,
      range: parseDifficultyRange(card),
      hidden: card.hidden,
      classHidden: card.classList.contains('is-difficulty-filtered'),
      display: getComputedStyle(card).display
    }))
  };
  editor.__bcuStageDifficultyDomFilterDebug = debug;
  globalThis.__BCU_STAGE_DIFFICULTY_DOM_FILTER_DEBUG__ = debug;
}

function updateFilterFromTarget(editor, target) {
  const q = target?.closest?.('[data-stage-search-input]');
  const min = target?.closest?.('[data-stage-difficulty-min]');
  const max = target?.closest?.('[data-stage-difficulty-max]');
  if (!(q || min || max) || !editor.root?.contains(target)) return false;

  const previous = editor.__bcuStageDifficultyFilter || {};
  editor.__bcuStageDifficultyFilter = {
    ...previous,
    ...(q ? { q: q.value } : {}),
    ...(min ? { min: min.value } : {}),
    ...(max ? { max: max.value } : {})
  };
  scheduleDomDifficultyFilter(editor, target);
  return true;
}

function scheduleDomDifficultyFilter(editor, target, immediate = false) {
  if (!editor.__bcuStageDifficultyDomFilterDebounced) {
    editor.__bcuStageDifficultyDomFilterDebounced = debounce((input) => withFocusRestore(input, () => applyDomDifficultyFilter(editor)), 220);
  }
  if (immediate) return editor.__bcuStageDifficultyDomFilterDebounced.flush(target);
  return editor.__bcuStageDifficultyDomFilterDebounced(target);
}

function wireFilterControls(editor) {
  ensureProStyles();
  const root = editor.root;
  if (!root) return;
  const selector = '[data-stage-search-input],[data-stage-difficulty-min],[data-stage-difficulty-max]';
  for (const input of root.querySelectorAll(selector)) {
    if (input.dataset.bcuDifficultyFilterWired === '1') continue;
    input.dataset.bcuDifficultyFilterWired = '1';
    const handler = (event) => {
      event.stopPropagation();
      updateFilterFromTarget(editor, event.target);
    };
    const immediate = (event) => {
      event.stopPropagation();
      const previous = editor.__bcuStageDifficultyFilter || {};
      editor.__bcuStageDifficultyFilter = {
        ...previous,
        ...(input.matches('[data-stage-search-input]') ? { q: input.value } : {}),
        ...(input.matches('[data-stage-difficulty-min]') ? { min: input.value } : {}),
        ...(input.matches('[data-stage-difficulty-max]') ? { max: input.value } : {})
      };
      scheduleDomDifficultyFilter(editor, event.target, true);
    };
    input.addEventListener('input', handler);
    input.addEventListener('change', immediate);
    input.addEventListener('blur', immediate);
    input.addEventListener('keydown', (event) => { if (event.key === 'Enter') immediate(event); });
  }
}

export function installFormationStageDifficultyFilterControlPatch() {
  ensureProStyles();
  const proto = FormationEditor?.prototype;
  if (!proto || proto[PATCH_FLAG]) return !!proto?.[PATCH_FLAG];
  if (!proto[DIFFICULTY_FLAG]) return false;
  proto[PATCH_FLAG] = true;

  const render = proto.renderStageSelector;
  proto.renderStageSelector = function renderStageSelectorWithDifficultyFilterControls(...args) {
    const result = render.apply(this, args);
    wireFilterControls(this);
    applyDomDifficultyFilter(this);
    return result;
  };

  const onInput = proto.onInput;
  proto.onInput = function onInputWithDifficultyFilterControls(event) {
    if (updateFilterFromTarget(this, event.target)) return;
    return onInput.call(this, event);
  };
  return true;
}

if (!installFormationStageDifficultyFilterControlPatch()) {
  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    if (installFormationStageDifficultyFilterControlPatch() || attempts >= 120) clearInterval(timer);
  }, 50);
}
