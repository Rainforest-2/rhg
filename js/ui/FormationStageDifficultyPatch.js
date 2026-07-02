import { FormationEditor } from './FormationEditor.js';
import {
  BCU_MAX_CROWN_STAR,
  crownStarIndexFromUiStar,
  crownStarsForData,
  normalizeCrownStar,
  resolveCrownMagnificationPercent,
  resolveMapCrownData
} from '../battle/bcu-runtime/BcuStageCrownRuntime.js';

const FLAG = Symbol.for('wanko-ui.formation-stage-difficulty.v2-scoped');
const STYLE_ID = 'formation-stage-difficulty-style';
const CUSTOM_LEVEL = 'custom-stage-battle';
const CROWN_INDEX_URLS = Object.freeze([
  './assets/generated/bcu-stage-crown-index.json',
  './public/assets/generated/bcu-stage-crown-index.json'
]);

function esc(v) { return String(v ?? '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c])); }
function norm(v) { return String(v ?? '').normalize('NFKC').toLowerCase(); }
function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = `.formation-stage-card.is-difficulty-filtered{display:none!important}`;
  document.head.appendChild(s);
}
function filterState(ed) {
  const f = ed.__bcuStageDifficultyFilter || {};
  return { q: norm(f.q).trim(), star: normalizeCrownStar(f.star ?? 1) };
}
function rawDraftFilter(ed) {
  return ed.__bcuStageDifficultyDraftFilter || ed.__bcuStageDifficultyFilter || {};
}
function draftFilterState(ed) {
  const f = rawDraftFilter(ed);
  return { q: norm(f.q).trim(), star: normalizeCrownStar(f.star ?? 1) };
}
function setDraftFromTarget(ed, target) {
  const q = target?.closest?.('[data-stage-search-input]');
  const star = target?.closest?.('[data-stage-crown-star]');
  if (!(q || star) || !ed.root?.contains(target)) return false;
  const previous = ed.__bcuStageDifficultyDraftFilter || ed.__bcuStageDifficultyFilter || {};
  ed.__bcuStageDifficultyDraftFilter = { ...previous, ...(q ? { q: q.value } : {}), ...(star ? { star: star.value } : {}) };
  return true;
}
function commitDraftFilter(ed) {
  const draft = ed.__bcuStageDifficultyDraftFilter || ed.__bcuStageDifficultyFilter || {};
  ed.__bcuStageDifficultyFilter = { q: draft.q || '', star: normalizeCrownStar(draft.star ?? 1) };
  ed.__bcuStageDifficultyDraftFilter = { ...ed.__bcuStageDifficultyFilter };
}
function isFiltering(f) { return !!f.q || Number.isFinite(f.star); }
function stageOptionOf(item) {
  if (!item?.stage) return item || {};
  return {
    ...item.stage,
    mapColcId: item.mapColcId ?? item.stage.mapColcId,
    mapId: item.mapNo ?? item.mapId ?? item.stage.mapId,
    mapNo: item.mapNo ?? item.stage.mapNo,
    stageNo: item.stageNo ?? item.stage.stageNo,
    stageIdNumeric: item.stageNo ?? item.stage.stageIdNumeric,
    numericAddress: {
      ...(item.stage.numericAddress || {}),
      mapColcId: item.mapColcId ?? item.stage.numericAddress?.mapColcId,
      mapId: item.mapNo ?? item.mapId ?? item.stage.numericAddress?.mapId,
      stageNo: item.stageNo ?? item.stage.numericAddress?.stageNo
    }
  };
}
function crownIndex(ed) { return ed.__bcuStageCrownIndex || null; }
function mapCrownData(ed, map) {
  return resolveMapCrownData(crownIndex(ed), { name: map?.label, mapId: map?.mapNo, mapColcId: map?.mapColcId });
}
function stageCrownData(ed, item) {
  return resolveMapCrownData(crownIndex(ed), { name: item?.mapLabel, mapId: item?.mapNo, mapColcId: item?.mapColcId });
}
function stageText(item, crownData) {
  const starText = crownStarsForData(crownData).map((star) => `★${star}`).join(' ');
  return norm([item?.key, item?.id, item?.label, item?.mapLabel, item?.collectionLabel, item?.stageNoRaw, item?.rawId, stageOptionOf(item)?.stageId, stageOptionOf(item)?.stageKey, starText].filter(Boolean).join(' '));
}
function mapCrownStats(ed, map) {
  const crownData = mapCrownData(ed, map);
  const stars = crownStarsForData(crownData);
  const min = stars[0] || 1;
  const max = stars[stars.length - 1] || 1;
  return {
    min,
    max,
    stars,
    label: min === max ? `★${min}` : `★${min}-${max}`,
    candidateCount: map?.stages?.length || 0,
    matchedCount: stars.length,
    unresolvedReason: crownData?.source === 'single-crown-default' ? null : null,
    source: crownData?.source || 'single-crown-default',
    crownCount: stars.length,
    crownMagnifications: crownData?.stars || [100]
  };
}
function mapText(map, stats) { return norm([map?.key, map?.label, map?.collectionLabel, ...(map?.collectionLabels || []), map?.mapNoRaw, stats.label].filter(Boolean).join(' ')); }
function mapMatches(ed, map, f = filterState(ed)) {
  const stats = mapCrownStats(ed, map);
  if (!stats.stars.includes(normalizeCrownStar(f.star))) return false;
  if (!f.q) return true;
  return mapText(map, stats).includes(f.q) || (map?.stages || []).some((st) => stageText(st, mapCrownData(ed, map)).includes(f.q));
}
async function ensureCrownIndex(ed) {
  if (ed.__bcuStageCrownIndexPromise) return ed.__bcuStageCrownIndexPromise;
  ed.__bcuStageCrownIndexPromise = (async () => {
    const errors = [];
    for (const url of CROWN_INDEX_URLS) {
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`stage crown index fetch failed: ${response.status}`);
        const index = await response.json();
        return { index, source: url };
      } catch (error) {
        errors.push(`${url}: ${error?.message || error}`);
      }
    }
    throw new Error(errors.join('; '));
  })()
    .then((index) => {
      ed.__bcuStageCrownIndex = index.index;
      ed.__bcuStageCrownIndexDiagnostics = { source: index.source, loadMode: 'generated-crown-index', count: index.index?.count || 0 };
      globalThis.__BCU_STAGE_CROWN_FILTER_DEBUG__ = ed.__bcuStageCrownIndexDiagnostics;
      ed.renderStageSelector?.();
      return index.index;
    })
    .catch((error) => {
      ed.__bcuStageCrownIndex = null;
      ed.__bcuStageCrownIndexDiagnostics = { source: CROWN_INDEX_URLS.join(' | '), loadMode: 'load-failed', error: String(error?.message || error) };
      return null;
    });
  return ed.__bcuStageCrownIndexPromise;
}
function currentScope(ed) {
  const catalog = ed.stageCatalog;
  const state = ed.stageSelectorState || { level: 'category' };
  if (!catalog || state.level === CUSTOM_LEVEL || state.level === 'category') return null;
  if (state.level === 'map') {
    const category = catalog.getCategory?.(state.categoryId);
    return category ? { type: 'map', label: category.label, items: category.maps || [] } : null;
  }
  if (state.level === 'stage') {
    const map = catalog.getMap?.(state.mapKey);
    return map ? { type: 'stage', label: map.label, items: map.stages || [] } : null;
  }
  return null;
}
function insertControls(ed, scope, matched, shown) {
  const list = ed.root?.querySelector?.('.formation-stage-list');
  if (!list) return;
  ensureStyle();
  list.querySelector('.formation-stage-difficulty-tools')?.remove();
  const f = filterState(ed);
  const draft = draftFilterState(ed);
  const anchor = list.querySelector('.formation-stage-backbar') || list.querySelector('.formation-stage-breadcrumb');
  const box = document.createElement('div');
  const itemLabel = scope.type === 'map' ? 'マップ' : 'ステージ';
  const placeholder = scope.type === 'map' ? 'マップ名でさがす' : 'ステージ名でさがす';
  const summary = isFiltering(f) ? `表示中 ${matched} / ${scope.items.length}` : `表示中 ${shown} / ${scope.items.length}`;
  box.className = 'formation-stage-difficulty-tools';
  const starOptions = Array.from({ length: BCU_MAX_CROWN_STAR }, (_, index) => {
    const star = index + 1;
    return `<option value='${star}' ${normalizeCrownStar(draft.star) === star ? 'selected' : ''}>★${star}</option>`;
  }).join('');
  box.innerHTML = `<label class='formation-stage-search-field'><span>${itemLabel}検索</span><input data-stage-search-input='1' placeholder='${placeholder}' value='${esc(draft.q)}'></label><div class='formation-stage-difficulty-range' aria-label='星の段階'><span class='formation-stage-filter-label'>星</span><label><span>段階</span><select data-stage-crown-star='1'>${starOptions}</select></label></div><button type='button' class='formation-stage-filter-apply' data-stage-filter-apply='1'>検索</button><button type='button' class='formation-stage-filter-reset' data-stage-filter-reset='1'>条件リセット</button><div class='formation-stage-difficulty-summary'>${esc(summary)}</div>`;
  if (anchor?.nextSibling) list.insertBefore(box, anchor.nextSibling);
  else list.prepend(box);
}
function setScopeDebug(ed, scope, detail = {}) {
  const debug = {
    source: 'FormationStageDifficultyPatch',
    scoped: !!scope,
    scopeType: scope?.type || 'none',
    scopeLabel: scope?.label || null,
    total: scope?.items?.length || 0,
    candidateCount: detail.candidateCount ?? scope?.items?.length ?? 0,
    matchedCount: detail.matchedCount ?? 0,
    shownCount: detail.shownCount ?? 0,
    unresolvedReason: detail.unresolvedReason || (scope ? null : 'category-root-or-custom-stage'),
    candidateKeys: (scope?.items || []).map((item) => item.key).slice(0, 20),
    filter: filterState(ed),
    diagnostics: ed.__bcuStageCrownIndexDiagnostics || null
  };
  ed.__bcuStageDifficultyLastScopeDebug = debug;
  globalThis.__BCU_STAGE_DIFFICULTY_FILTER_DEBUG__ = debug;
  return debug;
}
function removeHiddenDifficultyBadge(card) {
  card.querySelector('.formation-stage-difficulty-badge')?.remove();
}
function decorateMapLevel(ed, scope) {
  const f = filterState(ed);
  const matched = new Set(scope.items.filter((m) => mapMatches(ed, m, f)).map((m) => m.key));
  for (const card of ed.root.querySelectorAll('.formation-stage-card-map[data-stage-map]')) {
    const map = scope.items.find((m) => m.key === card.dataset.stageMap);
    const stats = mapCrownStats(ed, map);
    card.dataset.stageCrownStars = stats.stars.join(',');
    card.dataset.stageCrownCount = String(stats.crownCount);
    card.dataset.stageDifficultyMin = String(stats.min);
    card.dataset.stageDifficultyMax = String(stats.max);
    removeHiddenDifficultyBadge(card);
    card.classList.toggle('is-difficulty-filtered', isFiltering(f) && !matched.has(card.dataset.stageMap));
  }
  const shown = scope.items.filter((m) => !isFiltering(f) || matched.has(m.key)).length;
  insertControls(ed, scope, matched.size, shown);
  setScopeDebug(ed, scope, { candidateCount: scope.items.length, matchedCount: matched.size, shownCount: shown });
}
function decorateStageLevel(ed, scope) {
  // Stage-level search/filter UI is removed (keep map search only). The selected crown applies to
  // the whole opened map, so every stage in that map remains visible.
  for (const card of ed.root.querySelectorAll('.formation-stage-card-stage[data-stage-id]')) {
    const st = scope.items.find((s) => s.key === card.dataset.stageId || s.id === card.dataset.stageId);
    const crownData = stageCrownData(ed, st || { key: card.dataset.stageId });
    const stars = crownStarsForData(crownData);
    removeHiddenDifficultyBadge(card);
    card.dataset.stageCrownStars = stars.join(',');
    card.dataset.stageDifficulty = stars.join(',');
    card.dataset.stageDifficultyMin = String(stars[0] || 1);
    card.dataset.stageDifficultyMax = String(stars[stars.length - 1] || 1);
    card.classList.remove('is-difficulty-filtered');
  }
  setScopeDebug(ed, scope, { candidateCount: scope.items.length, matchedCount: scope.items.length, shownCount: scope.items.length });
}
function decorate(ed) {
  const scope = currentScope(ed);
  if (!scope) { setScopeDebug(ed, null); return; }
  if (scope.type === 'map') decorateMapLevel(ed, scope);
  else if (scope.type === 'stage') decorateStageLevel(ed, scope);
}
export function installFormationStageDifficultyPatch() {
  const p = FormationEditor?.prototype;
  if (!p || p[FLAG]) return;
  p[FLAG] = true;
  const load = p.loadStageOptions;
  p.loadStageOptions = async function loadStageOptionsWithScopedDifficulty(...args) {
    const r = await load.apply(this, args);
    await ensureCrownIndex(this);
    this.renderStageSelector?.();
    return r;
  };
  const render = p.renderStageSelector;
  p.renderStageSelector = function renderStageSelectorWithScopedDifficulty(...args) { void ensureCrownIndex(this); const r = render.apply(this, args); decorate(this); return r; };
  const input = p.onInput;
  p.onInput = function onInputWithScopedStageDifficulty(e) { if (setDraftFromTarget(this, e.target)) return; return input.call(this, e); };
  const select = p.selectStage;
  p.selectStage = function selectStageWithCrown(stageId, ...args) {
    const catalog = this.stageCatalog;
    const stage = catalog?.getStage?.(stageId);
    const map = stage?.mapKey ? catalog?.getMap?.(stage.mapKey) : null;
    const f = filterState(this);
    const crownData = map ? mapCrownData(this, map) : stageCrownData(this, stage || {});
    const star = normalizeCrownStar(f.star);
    const starIndex = crownStarIndexFromUiStar(star);
    const resolvedIndex = Math.min(starIndex, Math.max(0, (crownStarsForData(crownData).length || 1) - 1));
    const percent = resolveCrownMagnificationPercent(resolvedIndex, crownData?.stars || [100]);
    this.__bcuSelectedStageCrown = {
      star: resolvedIndex + 1,
      requestedStar: star,
      crownStarIndex: resolvedIndex,
      crownMagnificationPercent: percent,
      crownCount: crownStarsForData(crownData).length,
      mapLabel: map?.label || stage?.mapLabel || null,
      source: crownData?.source || 'single-crown-default'
    };
    globalThis.__BCU_SELECTED_STAGE_CROWN_DEBUG__ = this.__bcuSelectedStageCrown;
    return select.call(this, stageId, ...args);
  };
  const click = p.onClick;
  p.onClick = function onClickWithScopedStageDifficulty(e) { const apply = e.target.closest?.('[data-stage-filter-apply]'); if (apply && this.root?.contains(apply)) { e.preventDefault(); e.stopPropagation(); commitDraftFilter(this); this.renderStageSelector(); return; } const reset = e.target.closest?.('[data-stage-filter-reset]'); if (reset && this.root?.contains(reset)) { e.preventDefault(); e.stopPropagation(); this.__bcuStageDifficultyFilter = { q: '', star: 1 }; this.__bcuStageDifficultyDraftFilter = { q: '', star: 1 }; this.renderStageSelector(); return; } return click.call(this, e); };
}
installFormationStageDifficultyPatch();
