import { FormationEditor } from './FormationEditor.js';
import { getBcuAssetDatabase } from '../bcu/BcuAssetDatabase.js';
import { formatBcuStageDifficulty, loadBcuStageDifficultyTable, resolveStageDifficulty } from '../bcu/BcuStageDifficultyRuntime.js';

const FLAG = Symbol.for('wanko-ui.formation-stage-difficulty.v2-scoped');
const STYLE_ID = 'formation-stage-difficulty-style';
const CUSTOM_LEVEL = 'custom-stage-battle';

function esc(v) { return String(v ?? '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c])); }
function norm(v) { return String(v ?? '').normalize('NFKC').toLowerCase(); }
function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = `.formation-stage-difficulty-tools{grid-column:1/-1;display:grid;grid-template-columns:minmax(120px,1fr) 72px 72px auto;align-items:center;gap:6px;margin:0 0 6px;padding:6px 8px;border:1px solid rgba(96,165,250,.28);border-radius:10px;background:rgba(15,23,42,.64)}.formation-stage-difficulty-tools input{min-width:0;height:30px;border-radius:8px;border:1px solid rgba(147,197,253,.42);background:#06101f;color:#e5f0ff;font-size:.72rem;font-weight:800;padding:0 8px}.formation-stage-difficulty-summary{color:#bfdbfe;font-size:.66rem;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.formation-stage-difficulty-badge{display:inline-flex;justify-self:start;max-width:100%;padding:2px 6px;border-radius:999px;background:rgba(250,204,21,.14);border:1px solid rgba(250,204,21,.36);color:#fde68a;font-size:.58rem;line-height:1;font-weight:1000;text-shadow:0 1px 0 #000;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.formation-stage-card.is-difficulty-filtered{display:none!important}@media(max-width:640px){.formation-stage-difficulty-tools{grid-template-columns:1fr 58px 58px}.formation-stage-difficulty-summary{grid-column:1/-1}}`;
  document.head.appendChild(s);
}
function filterState(ed) {
  const f = ed.__bcuStageDifficultyFilter || {};
  return { q: norm(f.q).trim(), min: f.min === '' || f.min == null ? null : Number(f.min), max: f.max === '' || f.max == null ? null : Number(f.max) };
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
  const values = (map?.stages || []).map((st) => diffOf(ed, st).diff).filter((n) => Number.isFinite(n) && n >= 0);
  if (!values.length) return { min: -1, max: -1, label: '---' };
  const min = Math.min(...values), max = Math.max(...values);
  return { min, max, label: min === max ? `★${min}` : `★${min}-${max}` };
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
  const crumb = list.querySelector('.formation-stage-breadcrumb');
  const box = document.createElement('div');
  box.className = 'formation-stage-difficulty-tools';
  box.innerHTML = `<input data-stage-search-input='1' placeholder='${scope.type === 'map' ? 'カテゴリ内検索' : 'マップ内検索'}' value='${esc(f.q)}'><input type='number' data-stage-difficulty-min='1' placeholder='★min' value='${f.min ?? ''}'><input type='number' data-stage-difficulty-max='1' placeholder='★max' value='${f.max ?? ''}'><div class='formation-stage-difficulty-summary'>${esc(scope.label)} ${shown}/${scope.items.length} (${matched})</div>`;
  if (crumb?.nextSibling) list.insertBefore(box, crumb.nextSibling);
  else list.prepend(box);
}
function decorateMapLevel(ed, scope) {
  const f = filterState(ed);
  const matched = new Set(scope.items.filter((m) => mapMatches(ed, m, f)).map((m) => m.key));
  for (const card of ed.root.querySelectorAll('.formation-stage-card-map[data-stage-map]')) {
    const map = scope.items.find((m) => m.key === card.dataset.stageMap);
    const stats = mapDifficultyStats(ed, map);
    let b = card.querySelector('.formation-stage-difficulty-badge');
    if (!b) { b = document.createElement('b'); b.className = 'formation-stage-difficulty-badge'; card.appendChild(b); }
    b.textContent = `難易度 ${stats.label}`;
    card.classList.toggle('is-difficulty-filtered', isFiltering(f) && !matched.has(card.dataset.stageMap));
  }
  insertControls(ed, scope, matched.size, scope.items.filter((m) => !isFiltering(f) || matched.has(m.key)).length);
}
function decorateStageLevel(ed, scope) {
  const f = filterState(ed);
  const matched = new Set(scope.items.filter((s) => stageMatches(ed, s, f)).map((s) => s.key));
  for (const card of ed.root.querySelectorAll('.formation-stage-card-stage[data-stage-id]')) {
    const st = scope.items.find((s) => s.key === card.dataset.stageId || s.id === card.dataset.stageId);
    const d = diffOf(ed, st || { key: card.dataset.stageId });
    let b = card.querySelector('.formation-stage-difficulty-badge');
    if (!b) { b = document.createElement('b'); b.className = 'formation-stage-difficulty-badge'; card.appendChild(b); }
    b.textContent = `難易度 ${formatBcuStageDifficulty(d.diff)}`;
    card.dataset.stageDifficulty = d.diff >= 0 ? String(d.diff) : '';
    card.classList.toggle('is-difficulty-filtered', isFiltering(f) && !matched.has(card.dataset.stageId));
  }
  insertControls(ed, scope, matched.size, scope.items.filter((s) => !isFiltering(f) || matched.has(s.key)).length);
}
function decorate(ed) {
  const scope = currentScope(ed);
  if (!scope) return;
  if (scope.type === 'map') decorateMapLevel(ed, scope);
  else if (scope.type === 'stage') decorateStageLevel(ed, scope);
  globalThis.__BCU_STAGE_DIFFICULTY_FILTER_DEBUG__ = { source: 'FormationStageDifficultyPatch', scoped: true, scopeType: scope.type, scopeLabel: scope.label, total: scope.items.length, candidateKeys: scope.items.map((item) => item.key).slice(0, 20), filter: filterState(ed), diagnostics: ed.__bcuStageDifficultyDiagnostics || null };
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
  p.onInput = function onInputWithScopedStageDifficulty(e) { const q = e.target.closest?.('[data-stage-search-input]'), min = e.target.closest?.('[data-stage-difficulty-min]'), max = e.target.closest?.('[data-stage-difficulty-max]'); if ((q || min || max) && this.root?.contains(e.target)) { const f = this.__bcuStageDifficultyFilter || {}; this.__bcuStageDifficultyFilter = { ...f, ...(q ? { q: q.value } : {}), ...(min ? { min: min.value } : {}), ...(max ? { max: max.value } : {}) }; this.renderStageSelector(); return; } return input.call(this, e); };
}
installFormationStageDifficultyPatch();
