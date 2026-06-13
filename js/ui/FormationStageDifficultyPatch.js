import { FormationEditor } from './FormationEditor.js';
import { getBcuAssetDatabase } from '../bcu/BcuAssetDatabase.js';
import { loadBcuStageDifficultyTable, resolveStageDifficulty } from '../bcu/BcuStageDifficultyRuntime.js';

const FLAG = Symbol.for('wanko-ui.formation-stage-difficulty.v2-scoped');
const STYLE_ID = 'formation-stage-difficulty-style';
const CUSTOM_LEVEL = 'custom-stage-battle';

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
  return { q: norm(f.q).trim(), min: f.min === '' || f.min == null ? null : Number(f.min), max: f.max === '' || f.max == null ? null : Number(f.max) };
}
function rawDraftFilter(ed) {
  return ed.__bcuStageDifficultyDraftFilter || ed.__bcuStageDifficultyFilter || {};
}
function draftFilterState(ed) {
  const f = rawDraftFilter(ed);
  return { q: norm(f.q).trim(), min: f.min === '' || f.min == null ? null : Number(f.min), max: f.max === '' || f.max == null ? null : Number(f.max) };
}
function setDraftFromTarget(ed, target) {
  const q = target?.closest?.('[data-stage-search-input]');
  const min = target?.closest?.('[data-stage-difficulty-min]');
  const max = target?.closest?.('[data-stage-difficulty-max]');
  if (!(q || min || max) || !ed.root?.contains(target)) return false;
  const previous = ed.__bcuStageDifficultyDraftFilter || ed.__bcuStageDifficultyFilter || {};
  ed.__bcuStageDifficultyDraftFilter = { ...previous, ...(q ? { q: q.value } : {}), ...(min ? { min: min.value } : {}), ...(max ? { max: max.value } : {}) };
  return true;
}
function commitDraftFilter(ed) {
  const draft = ed.__bcuStageDifficultyDraftFilter || ed.__bcuStageDifficultyFilter || {};
  ed.__bcuStageDifficultyFilter = { q: draft.q || '', min: draft.min ?? null, max: draft.max ?? null };
  ed.__bcuStageDifficultyDraftFilter = { ...ed.__bcuStageDifficultyFilter };
}
function isFiltering(f) { return !!f.q || Number.isFinite(f.min) || Number.isFinite(f.max); }
function table(ed) { return ed.__bcuStageDifficultyTable || null; }
function db() { try { return getBcuAssetDatabase(); } catch { return null; } }
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
function diffOf(ed, item) { return resolveStageDifficulty(stageOptionOf(item), { table: table(ed), db: db() }); }
function stageText(item, d) { return norm([item?.key, item?.id, item?.label, item?.mapLabel, item?.collectionLabel, item?.stageNoRaw, item?.rawId, stageOptionOf(item)?.stageId, stageOptionOf(item)?.stageKey, d?.diff >= 0 ? `★${d.diff}` : ''].filter(Boolean).join(' ')); }
function stageMatches(ed, item, f = filterState(ed)) {
  const d = diffOf(ed, item);
  if (Number.isFinite(f.min) && (!(d.diff >= 0) || d.diff < f.min)) return false;
  if (Number.isFinite(f.max) && (!(d.diff >= 0) || d.diff > f.max)) return false;
  return !f.q || stageText(item, d).includes(f.q);
}
function mapDifficultyStats(ed, map) {
  const resolutions = (map?.stages || []).map((st) => diffOf(ed, st));
  const values = resolutions.map((r) => r.diff).filter((n) => Number.isFinite(n) && n >= 0);
  const unresolved = resolutions.find((r) => !(Number.isFinite(r?.diff) && r.diff >= 0));
  if (!values.length) return { min: -1, max: -1, label: '', candidateCount: resolutions.length, matchedCount: 0, unresolvedReason: unresolved?.unresolvedReason || unresolved?.fallbackReason || 'difficulty-not-defined' };
  const min = Math.min(...values), max = Math.max(...values);
  return { min, max, label: min === max ? `★${min}` : `★${min}-${max}`, candidateCount: resolutions.length, matchedCount: values.length, unresolvedReason: unresolved?.unresolvedReason || unresolved?.fallbackReason || null };
}
function mapText(map, stats) { return norm([map?.key, map?.label, map?.collectionLabel, ...(map?.collectionLabels || []), map?.mapNoRaw, stats.label].filter(Boolean).join(' ')); }
function mapMatches(ed, map, f = filterState(ed)) {
  const stats = mapDifficultyStats(ed, map);
  if (Number.isFinite(f.min) && !(stats.max >= f.min)) return false;
  if (Number.isFinite(f.max) && !(stats.min >= 0 && stats.min <= f.max)) return false;
  if (!f.q) return true;
  return mapText(map, stats).includes(f.q) || (map?.stages || []).some((st) => stageText(st, diffOf(ed, st)).includes(f.q));
}
async function ensureDifficulty(ed) {
  if (ed.__bcuStageDifficultyPromise) return ed.__bcuStageDifficultyPromise;
  ed.__bcuStageDifficultyPromise = loadBcuStageDifficultyTable().then((r) => { ed.__bcuStageDifficultyTable = r.table; ed.__bcuStageDifficultyDiagnostics = r.diagnostics; globalThis.__BCU_STAGE_DIFFICULTY_DEBUG__ = r.diagnostics; ed.renderStageSelector?.(); return r; });
  return ed.__bcuStageDifficultyPromise;
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
  box.innerHTML = `<label class='formation-stage-search-field'><span>${itemLabel}検索</span><input data-stage-search-input='1' placeholder='${placeholder}' value='${esc(draft.q)}'></label><div class='formation-stage-difficulty-range' aria-label='難易度の範囲'><span class='formation-stage-filter-label'>難易度</span><label><span>下限</span><input type='number' inputmode='numeric' data-stage-difficulty-min='1' placeholder='★1' min='0' max='12' value='${draft.min ?? ''}'></label><span class='formation-stage-range-sep'>から</span><label><span>上限</span><input type='number' inputmode='numeric' data-stage-difficulty-max='1' placeholder='★12' min='0' max='12' value='${draft.max ?? ''}'></label></div><button type='button' class='formation-stage-filter-apply' data-stage-filter-apply='1'>検索</button><button type='button' class='formation-stage-filter-reset' data-stage-filter-reset='1'>条件リセット</button><div class='formation-stage-difficulty-summary'>${esc(summary)}</div>`;
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
    diagnostics: ed.__bcuStageDifficultyDiagnostics || null
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
  const unresolved = [];
  for (const card of ed.root.querySelectorAll('.formation-stage-card-map[data-stage-map]')) {
    const map = scope.items.find((m) => m.key === card.dataset.stageMap);
    const stats = mapDifficultyStats(ed, map);
    if (stats.unresolvedReason) unresolved.push(stats.unresolvedReason);
    card.dataset.stageDifficultyMin = stats.min >= 0 ? String(stats.min) : '';
    card.dataset.stageDifficultyMax = stats.max >= 0 ? String(stats.max) : '';
    removeHiddenDifficultyBadge(card);
    card.classList.toggle('is-difficulty-filtered', isFiltering(f) && !matched.has(card.dataset.stageMap));
  }
  const shown = scope.items.filter((m) => !isFiltering(f) || matched.has(m.key)).length;
  insertControls(ed, scope, matched.size, shown);
  setScopeDebug(ed, scope, { candidateCount: scope.items.length, matchedCount: matched.size, shownCount: shown, unresolvedReason: unresolved[0] || null });
}
function decorateStageLevel(ed, scope) {
  const f = filterState(ed);
  const matched = new Set(scope.items.filter((s) => stageMatches(ed, s, f)).map((s) => s.key));
  const unresolved = [];
  for (const card of ed.root.querySelectorAll('.formation-stage-card-stage[data-stage-id]')) {
    const st = scope.items.find((s) => s.key === card.dataset.stageId || s.id === card.dataset.stageId);
    const d = diffOf(ed, st || { key: card.dataset.stageId });
    if (d.unresolvedReason || d.fallbackReason) unresolved.push(d.unresolvedReason || d.fallbackReason);
    removeHiddenDifficultyBadge(card);
    card.dataset.stageDifficulty = d.diff >= 0 ? String(d.diff) : '';
    card.dataset.stageDifficultyMin = d.diff >= 0 ? String(d.diff) : '';
    card.dataset.stageDifficultyMax = d.diff >= 0 ? String(d.diff) : '';
    card.classList.toggle('is-difficulty-filtered', isFiltering(f) && !matched.has(card.dataset.stageId));
  }
  const shown = scope.items.filter((s) => !isFiltering(f) || matched.has(s.key)).length;
  insertControls(ed, scope, matched.size, shown);
  setScopeDebug(ed, scope, { candidateCount: scope.items.length, matchedCount: matched.size, shownCount: shown, unresolvedReason: unresolved[0] || null });
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
    await ensureDifficulty(this);
    this.renderStageSelector?.();
    return r;
  };
  const render = p.renderStageSelector;
  p.renderStageSelector = function renderStageSelectorWithScopedDifficulty(...args) { void ensureDifficulty(this); const r = render.apply(this, args); decorate(this); return r; };
  const input = p.onInput;
  p.onInput = function onInputWithScopedStageDifficulty(e) { if (setDraftFromTarget(this, e.target)) return; return input.call(this, e); };
  const click = p.onClick;
  p.onClick = function onClickWithScopedStageDifficulty(e) { const apply = e.target.closest?.('[data-stage-filter-apply]'); if (apply && this.root?.contains(apply)) { e.preventDefault(); e.stopPropagation(); commitDraftFilter(this); this.renderStageSelector(); return; } const reset = e.target.closest?.('[data-stage-filter-reset]'); if (reset && this.root?.contains(reset)) { e.preventDefault(); e.stopPropagation(); this.__bcuStageDifficultyFilter = { q: '', min: null, max: null }; this.__bcuStageDifficultyDraftFilter = { q: '', min: null, max: null }; this.renderStageSelector(); return; } return click.call(this, e); };
}
installFormationStageDifficultyPatch();
