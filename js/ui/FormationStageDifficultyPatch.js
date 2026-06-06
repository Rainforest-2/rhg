import { FormationEditor } from './FormationEditor.js';
import { getAvailableStages } from '../battle/StageRegistry.js';
import { getBcuAssetDatabase } from '../bcu/BcuAssetDatabase.js';
import { formatBcuStageDifficulty, loadBcuStageDifficultyTable, resolveStageDifficulty } from '../bcu/BcuStageDifficultyRuntime.js';

const FLAG = Symbol.for('wanko-ui.formation-stage-difficulty.v1');
const STYLE_ID = 'formation-stage-difficulty-style';
const DEFAULT_LIMIT = 80;
const FILTER_LIMIT = 240;
const CUSTOM_LEVEL = 'custom-stage-battle';

function esc(v) { return String(v ?? '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c])); }
function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = `.formation-stage-difficulty-tools{display:grid;grid-template-columns:minmax(150px,1fr) 84px 84px;gap:8px;margin:0 0 10px;padding:10px;border:1px solid rgba(96,165,250,.32);border-radius:14px;background:rgba(15,23,42,.72)}.formation-stage-difficulty-tools input{min-width:0;height:36px;border-radius:10px;border:1px solid rgba(147,197,253,.45);background:#06101f;color:#e5f0ff;font-weight:800;padding:0 10px}.formation-stage-difficulty-summary{grid-column:1/-1;color:#bfdbfe;font-size:.72rem;font-weight:800}.formation-stage-difficulty-badge{display:inline-flex;width:max-content;margin-top:5px;padding:3px 8px;border-radius:999px;background:rgba(250,204,21,.16);border:1px solid rgba(250,204,21,.42);color:#fde68a;font-weight:1000;text-shadow:0 1px 0 #000}`;
  document.head.appendChild(s);
}
function filterState(ed) {
  const f = ed.__bcuStageDifficultyFilter || {};
  return { q: String(f.q || '').trim().toLowerCase(), min: f.min === '' || f.min == null ? null : Number(f.min), max: f.max === '' || f.max == null ? null : Number(f.max) };
}
function isFiltering(f) { return !!f.q || Number.isFinite(f.min) || Number.isFinite(f.max); }
function table(ed) { return ed.__bcuStageDifficultyTable || null; }
function diffOf(ed, st) { let db = null; try { db = getBcuAssetDatabase(); } catch {} return resolveStageDifficulty(st, { table: table(ed), db }); }
function nameOf(ed, st) { const id = st?.stageKey || st?.stageId; try { return ed.resolveStageDisplay(st, ed.stageMeta?.get?.(id) || {})?.displayName || st?.stageId || id || ''; } catch { return st?.stageId || id || ''; } }
function textOf(ed, st, d) { return [st?.stageKey, st?.stageId, st?.semanticEntry?.key, st?.semanticEntry?.legacyStageKey, st?.semanticEntry?.basename, ...(st?.semanticEntry?.aliases || []), nameOf(ed, st), d?.diff >= 0 ? `★${d.diff}` : ''].filter(Boolean).join(' ').toLowerCase(); }
function choose(ed) {
  const all = ed.__bcuAllStageOptions || ed.stageOptions || [];
  const f = filterState(ed);
  const matched = all.filter((st) => {
    const d = diffOf(ed, st);
    if (Number.isFinite(f.min) && (!(d.diff >= 0) || d.diff < f.min)) return false;
    if (Number.isFinite(f.max) && (!(d.diff >= 0) || d.diff > f.max)) return false;
    return !f.q || textOf(ed, st, d).includes(f.q);
  });
  const limit = isFiltering(f) ? FILTER_LIMIT : DEFAULT_LIMIT;
  const shown = matched.slice(0, limit);
  const sel = ed.selectedStageId;
  if (sel && !shown.some((s) => (s.stageKey || s.stageId) === sel || s.stageId === sel)) {
    const hit = all.find((s) => (s.stageKey || s.stageId) === sel || s.stageId === sel);
    if (hit) shown.unshift(hit);
  }
  ed.__bcuStageDifficultyLastSelection = { source: 'FormationStageDifficultyPatch', total: all.length, matched: matched.length, displayed: shown.length, limit, filter: f, difficultyLoaded: !!table(ed), diagnostics: ed.__bcuStageDifficultyDiagnostics || null };
  globalThis.__BCU_STAGE_DIFFICULTY_FILTER_DEBUG__ = ed.__bcuStageDifficultyLastSelection;
  return shown;
}
async function ensureDifficulty(ed) {
  if (ed.__bcuStageDifficultyPromise) return ed.__bcuStageDifficultyPromise;
  ed.__bcuStageDifficultyPromise = loadBcuStageDifficultyTable().then((r) => { ed.__bcuStageDifficultyTable = r.table; ed.__bcuStageDifficultyDiagnostics = r.diagnostics; globalThis.__BCU_STAGE_DIFFICULTY_DEBUG__ = r.diagnostics; ed.renderStageSelector?.(); return r; });
  return ed.__bcuStageDifficultyPromise;
}
function decorate(ed) {
  const list = ed.root?.querySelector?.('.formation-stage-list');
  if (!list || list.querySelector('.formation-custom-stage-battle')) return;
  ensureStyle();
  list.querySelector('.formation-stage-difficulty-tools')?.remove();
  const f = filterState(ed), dbg = ed.__bcuStageDifficultyLastSelection || {};
  const box = document.createElement('div');
  box.className = 'formation-stage-difficulty-tools';
  box.innerHTML = `<input data-stage-search-input='1' placeholder='ステージ名 / ID / ★難易度' value='${esc(f.q)}'><input type='number' data-stage-difficulty-min='1' placeholder='★min' value='${f.min ?? ''}'><input type='number' data-stage-difficulty-max='1' placeholder='★max' value='${f.max ?? ''}'><div class='formation-stage-difficulty-summary'>BCU lang/Difficulty.txt / 表示 ${dbg.displayed ?? 0} / 一致 ${dbg.matched ?? 0} / 全 ${dbg.total ?? 0}</div>`;
  list.prepend(box);
  const byId = new Map((ed.__bcuAllStageOptions || ed.stageOptions || []).map((s) => [s.stageKey || s.stageId, s]));
  for (const card of list.querySelectorAll('button[data-stage-id]')) {
    const st = byId.get(card.dataset.stageId) || { stageKey: card.dataset.stageId };
    const d = diffOf(ed, st);
    let b = card.querySelector('.formation-stage-difficulty-badge');
    if (!b) { b = document.createElement('b'); b.className = 'formation-stage-difficulty-badge'; card.appendChild(b); }
    b.textContent = `難易度 ${formatBcuStageDifficulty(d.diff)}`;
    card.dataset.stageDifficulty = d.diff >= 0 ? String(d.diff) : '';
  }
}
async function loadStages(ed) {
  if (ed.stageLoading) return;
  ed.stageLoading = true;
  try {
    ed.__bcuAllStageOptions = getAvailableStages().filter((s) => s?.bundleRef?.bundlePath || s?.semanticEntry?.bundleRef?.bundlePath || s?.enabled !== false);
    await ensureDifficulty(ed);
    ed.stageOptions = ed.__bcuAllStageOptions;
    ed.renderStageSelector();
    for (const st of choose(ed).slice(0, 30)) {
      const id = st.stageKey || st.stageId;
      if (ed.stageMeta?.has?.(id)) continue;
      try {
        const def = await ed.stageLoader.load(st), rows = def?.runtime?.enemyRows || [];
        ed.stageMeta.set(id, { ok: !!def?.ok, displayName: null, bgId: def?.bgId ?? def?.meta?.bgId ?? null, enemyBaseHp: def?.enemyBaseHp ?? def?.meta?.enemyBaseHp ?? null, enemyRowCount: rows.length, unresolvedEnemyCount: rows.filter((r) => r?.unresolved || r?.enemyId == null).length, stageLen: def?.stageLen ?? def?.meta?.stageLen ?? null, bundleAvailability: st?.bundleRef?.bundlePath ? 'available' : 'missing', bundlePath: st?.bundleRef?.bundlePath || null });
      } catch (e) { ed.stageMeta.set(id, { ok: false, displayName: null, errorMessage: e?.message || String(e), bundleAvailability: st?.bundleRef?.bundlePath ? 'available-load-failed' : 'missing', bundlePath: st?.bundleRef?.bundlePath || null }); }
    }
    ed.renderStageSelector();
  } finally { ed.stageLoading = false; }
}
export function installFormationStageDifficultyPatch() {
  const p = FormationEditor?.prototype;
  if (!p || p[FLAG]) return;
  p[FLAG] = true;
  p.loadStageOptions = function loadStageOptionsWithDifficulty() { return loadStages(this); };
  const rr = p.renderStageSelector;
  p.renderStageSelector = function renderStageSelectorWithDifficulty(...args) { void ensureDifficulty(this); const prev = this.stageOptions; const all = this.__bcuAllStageOptions || prev || []; const custom = this.stageSelectorState?.level === CUSTOM_LEVEL; this.stageOptions = custom ? all : choose(this); const res = rr.apply(this, args); this.stageOptions = all; decorate(this); return res; };
  const oi = p.onInput;
  p.onInput = function onInputWithStageDifficulty(e) { const q = e.target.closest?.('[data-stage-search-input]'), min = e.target.closest?.('[data-stage-difficulty-min]'), max = e.target.closest?.('[data-stage-difficulty-max]'); if ((q || min || max) && this.root?.contains(e.target)) { const f = this.__bcuStageDifficultyFilter || {}; this.__bcuStageDifficultyFilter = { ...f, ...(q ? { q: q.value } : {}), ...(min ? { min: min.value } : {}), ...(max ? { max: max.value } : {}) }; this.renderStageSelector(); return; } return oi.call(this, e); };
}
installFormationStageDifficultyPatch();
