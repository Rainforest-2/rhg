import { FormationEditor } from './FormationEditor.js';
import { normalizeCrownStar } from '../battle/bcu-runtime/BcuStageCrownRuntime.js';
// This stylesheet is injected lazily (only when the stage filter UI opens) rather
// than linked from index.html, so Vite would otherwise never emit it into dist and
// the runtime href would 404 in production. Importing it with `?url` makes Vite
// emit the file as a hashed dist asset and hands back a deployment-relative URL.
import PRO_STYLE_HREF from '../../css/nyanko-stage-selector-pro.css?url';

const PATCH_FLAG = Symbol.for('wanko-ui.formation-stage-difficulty-filter-controls.v3');
const DIFFICULTY_FLAG = Symbol.for('wanko-ui.formation-stage-difficulty.v2-scoped');
const PRO_STYLE_ID = 'nyanko-stage-selector-pro-css';

function ensureProStyles() {
  if (document.getElementById(PRO_STYLE_ID)) return;
  const link = document.createElement('link');
  link.id = PRO_STYLE_ID;
  link.rel = 'stylesheet';
  link.href = PRO_STYLE_HREF;
  document.head.appendChild(link);
}

function norm(value) {
  return String(value ?? '').normalize('NFKC').toLowerCase().trim();
}

function filterState(editor) {
  const f = editor.__bcuStageDifficultyFilter || {};
  return {
    q: norm(f.q),
    star: normalizeCrownStar(f.star ?? 1)
  };
}

function isFiltering(f) {
  return !!f.q || Number.isFinite(f.star);
}

function parseCrownStars(card) {
  const rawStars = String(card.dataset.stageCrownStars || '').split(',').map((value) => Number(value)).filter(Number.isFinite);
  if (rawStars.length) {
    const stars = [...new Set(rawStars.map((value) => normalizeCrownStar(value)))].sort((a, b) => a - b);
    return { stars, text: stars.map((star) => `★${star}`).join(' ') };
  }
  const rawMin = card.dataset.stageDifficultyMin ?? card.dataset.stageDifficulty;
  const rawMax = card.dataset.stageDifficultyMax ?? card.dataset.stageDifficulty;
  const dataMin = rawMin === '' || rawMin == null ? NaN : Number(rawMin);
  const dataMax = rawMax === '' || rawMax == null ? NaN : Number(rawMax);
  if (Number.isFinite(dataMin) && Number.isFinite(dataMax)) {
    const min = Math.min(dataMin, dataMax);
    const max = Math.max(dataMin, dataMax);
    const stars = Array.from({ length: Math.max(1, max - min + 1) }, (_, index) => normalizeCrownStar(min + index));
    return { stars, text: stars.map((star) => `★${star}`).join(' ') };
  }
  const text = card.querySelector('.formation-stage-difficulty-badge')?.textContent || '';
  const match = text.match(/★\s*(\d+)(?:\s*-\s*(\d+))?/);
  if (!match) return { stars: [1], text: '★1' };
  const min = Number(match[1]);
  const max = Number(match[2] ?? match[1]);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { stars: [1], text: '★1' };
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return { stars: Array.from({ length: Math.max(1, hi - lo + 1) }, (_, index) => normalizeCrownStar(lo + index)), text };
}

function cardMatchesFilter(card, f) {
  if (!isFiltering(f)) return true;
  const crown = parseCrownStars(card);
  if (!crown.stars.includes(normalizeCrownStar(f.star))) return false;
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
  if (editor.stageSelectorVirtual?.active === true) return;
  // Stage search removed: only map cards are filtered. Stage cards are always shown in full.
  const cards = [...root.querySelectorAll('.formation-stage-card-map[data-stage-map]')];
  let matched = 0;
  let hidden = 0;
  for (const card of cards) {
    const ok = cardMatchesFilter(card, f);
    if (ok) matched += 1;
    else hidden += 1;
    setCardFiltered(card, isFiltering(f) && !ok);
  }
  const summary = root.querySelector('.formation-stage-difficulty-summary');
  if (summary && editor.stageSelectorVirtual?.active !== true) {
    summary.textContent = isFiltering(f) ? `表示中 ${matched} / ${cards.length}` : `表示中 ${cards.length - hidden} / ${cards.length}`;
  }
  if (globalThis.__BCU_STAGE_DIFFICULTY_DOM_FILTER_DEBUG_ENABLED__ !== true) return;
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
      crown: parseCrownStars(card),
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
  const star = target?.closest?.('[data-stage-crown-star]');
  if (!(q || star) || !editor.root?.contains(target)) return false;

  const previous = editor.__bcuStageDifficultyDraftFilter || editor.__bcuStageDifficultyFilter || {};
  editor.__bcuStageDifficultyDraftFilter = {
    ...previous,
    ...(q ? { q: q.value } : {}),
    ...(star ? { star: star.value } : {})
  };
  return true;
}

function commitFilterFromControls(editor) {
  const root = editor.root;
  const draft = editor.__bcuStageDifficultyDraftFilter || editor.__bcuStageDifficultyFilter || {};
  editor.__bcuStageDifficultyFilter = {
    q: root?.querySelector?.('[data-stage-search-input]')?.value ?? draft.q ?? '',
    star: normalizeCrownStar(root?.querySelector?.('[data-stage-crown-star]')?.value ?? draft.star ?? 1)
  };
  editor.__bcuStageDifficultyDraftFilter = { ...editor.__bcuStageDifficultyFilter };
  if (editor.stageSelectorVirtual?.active === true) editor.renderStageSelector?.();
  else applyDomDifficultyFilter(editor);
}

function wireFilterControls(editor) {
  ensureProStyles();
  const root = editor.root;
  if (!root) return;
  const selector = '[data-stage-search-input],[data-stage-crown-star]';
  for (const input of root.querySelectorAll(selector)) {
    if (input.dataset.bcuDifficultyFilterWired === '1') continue;
    input.dataset.bcuDifficultyFilterWired = '1';
    // Typing only updates the draft — no filter pass / re-render per keystroke (kept light).
    input.addEventListener('input', (event) => {
      event.stopPropagation();
      updateFilterFromTarget(editor, event.target);
    });
    // Commit (filter + render) only on value commit (blur) and Enter.
    const commit = (event) => {
      event.stopPropagation();
      updateFilterFromTarget(editor, event.target);
      commitFilterFromControls(editor);
    };
    input.addEventListener('change', commit);
    input.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      commit(event);
    });
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
    if (updateFilterFromTarget(this, event.target)) {
      // Draft-only while typing; commit happens on Enter / blur / 検索 button.
      return;
    }
    return onInput.call(this, event);
  };
  const onClick = proto.onClick;
  proto.onClick = function onClickWithDifficultyFilterControls(event) {
    const apply = event.target.closest?.('[data-stage-filter-apply]');
    if (apply && this.root?.contains(apply)) {
      event.preventDefault();
      event.stopPropagation();
      commitFilterFromControls(this);
      return;
    }
    return onClick.call(this, event);
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
