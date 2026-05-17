import { FormationEditor } from './FormationEditor.js';
import { getAvailableStages } from '../battle/StageRegistry.js';
import { stageKey as makeStageKey, stageMapKey } from '../bcu/BcuIdentifier.js';
import { getBcuAssetDatabase } from '../bcu/BcuAssetDatabase.js';

const FLAG = Symbol.for('wanko-battle.formation-stage-name-bcu-patch.v1');
const COLLECTION = Object.freeze({ N: 0, S: 1, C: 2, E: 4, T: 6, V: 7, R: 11, M: 12, A: 13, B: 14, RA: 24, H: 25, CA: 27, Q: 31, L: 33, ND: 34, SR: 36, G: 37 });
const META_LIMIT = 30;

const text = (v) => String(v || '').replace(/\.csv$/i, '');
const basenameOf = (s) => text(s?.stageId || s?.basename || s?.semanticEntry?.basename);
const categoryOf = (s) => String(s?.category || s?.semanticEntry?.category || '');
const groupOf = (s) => String(s?.groupDir || s?.semanticEntry?.groupDir || '');
const stageIdentity = (s) => s?.stageKey || s?.key || s?.semanticEntry?.key || s?.stageId || basenameOf(s);

function escapeHtml(v) {
  return String(v ?? '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

function excluded(s) {
  const b = basenameOf(s), c = categoryOf(s), g = groupOf(s);
  return /^MapStageData/i.test(b) || /^stageNormal/i.test(b) || /^RandomDungeon/i.test(b) || /^PlayDungeon/i.test(b) || c === 'D' || (c === 'N' && /stageRN-1/i.test(`${g}/${b}`));
}

function normalTriplet(s) {
  const c = categoryOf(s);
  const mapColcId = COLLECTION[c];
  if (!Number.isInteger(mapColcId)) return null;
  const seg = basenameOf(s).replace(/^stage[A-Z]+/i, '').split('_');
  const mapId = Number(seg[0]);
  const stageId = Number(seg[1]);
  if (!Number.isInteger(mapId) || !Number.isInteger(stageId)) return null;
  return { mapColcId, mapId, stageId, source: `BCU normal collection ${c}`, category: c, groupDir: groupOf(s), basename: basenameOf(s) };
}

function chapterTriplet(s) {
  if (categoryOf(s) !== 'CH') return null;
  const g = groupOf(s), b = basenameOf(s);
  let m;
  if (g === 'stageZ') {
    m = b.match(/^stageZ(\d{2})_(\d{2})$/i);
    if (!m) return null;
    const id0 = Number(m[1]), id1 = Number(m[2]);
    const mapId = id0 < 3 ? id0 : ({ 4: 10, 5: 12, 6: 13, 7: 15, 8: 16, 9: 17 })[id0];
    return Number.isInteger(mapId) ? { mapColcId: 3, mapId, stageId: id1, source: 'BCU CH stageZ', category: 'CH', groupDir: g, basename: b } : null;
  }
  if (g === 'stageW') {
    m = b.match(/^stageW(\d{2})_(\d{2})$/i);
    return m ? { mapColcId: 3, mapId: Number(m[1]) - 1, stageId: Number(m[2]), source: 'BCU CH stageW', category: 'CH', groupDir: g, basename: b } : null;
  }
  if (g === 'stageSpace') {
    if (b === 'stageSpace09_Invasion_00') return { mapColcId: 3, mapId: 11, stageId: 0, source: 'BCU CH space special', category: 'CH', groupDir: g, basename: b };
    if (b === 'stageSpace09_Invasion_Z_00') return { mapColcId: 3, mapId: 18, stageId: 0, source: 'BCU CH space special zombie', category: 'CH', groupDir: g, basename: b };
    m = b.match(/^stageSpace(\d{2})_(\d{2})$/i);
    return m ? { mapColcId: 3, mapId: Number(m[1]) - 1, stageId: Number(m[2]), source: 'BCU CH stageSpace', category: 'CH', groupDir: g, basename: b } : null;
  }
  if (g === 'stage') {
    m = b.match(/^stage(\d{2})$/i);
    return m ? { mapColcId: 3, mapId: 9, stageId: Number(m[1]), source: 'BCU CH stage', category: 'CH', groupDir: g, basename: b } : null;
  }
  return null;
}

function dmTriplet(s) {
  if (categoryOf(s) !== 'DM' || groupOf(s) !== 'StageDM') return null;
  const m = basenameOf(s).match(/^stageDM\d{3}_(\d{2})$/i);
  return m ? { mapColcId: 3, mapId: 14, stageId: Number(m[1]), source: 'BCU DM StageDM', category: 'DM', groupDir: 'StageDM', basename: basenameOf(s) } : null;
}

function triplet(s) { return excluded(s) ? null : (chapterTriplet(s) || dmTriplet(s) || normalTriplet(s)); }
function selectable(s) { return !!s && !excluded(s) && (!!triplet(s) || (!s.semanticEntry && (s.bundleRef?.bundlePath || s.stageCsvPath || s.legacyStageCsvPath))); }

async function loadMeta(editor, stage) {
  const id = stageIdentity(stage);
  if (!id || editor.stageMeta.has(id)) return;
  try {
    const def = await editor.stageLoader.load(stage);
    const rows = def?.runtime?.enemyRows || [];
    editor.stageMeta.set(id, { ok: !!def?.ok, bgId: def?.bgId ?? def?.meta?.bgId ?? null, enemyBaseHp: def?.enemyBaseHp ?? def?.meta?.enemyBaseHp ?? null, enemyRowCount: rows.length, unresolvedEnemyCount: rows.filter((r) => r?.unresolved || r?.enemyId == null).length, stageLen: def?.stageLen ?? def?.meta?.stageLen ?? null, bundleAvailability: stage?.bundleRef?.bundlePath ? 'available' : 'missing', bundlePath: stage?.bundleRef?.bundlePath || null });
  } catch (e) {
    editor.stageMeta.set(id, { ok: false, errorMessage: e?.message || String(e), bundleAvailability: stage?.bundleRef?.bundlePath ? 'available-load-failed' : 'missing', bundlePath: stage?.bundleRef?.bundlePath || null });
  }
}

if (!FormationEditor.prototype[FLAG]) {
  FormationEditor.prototype[FLAG] = true;
  FormationEditor.prototype.parseStageTripletFromEntry = function (stage) { return triplet(stage); };
  FormationEditor.prototype.resolveStageDisplay = function (stage, meta = {}) {
    const db = getBcuAssetDatabase();
    const direct = db?.stages?.get?.(stage?.stageKey || stage?.key);
    if (direct?.name?.source === 'lang' && direct.name.value) return { displayName: direct.name.value, source: direct.name.file || 'BcuStageRepository.name', unresolvedNameReason: null };
    const t = this.parseStageTripletFromEntry(stage);
    if (t && db?.names) {
      const mk = stageMapKey(t.mapColcId, t.mapId);
      const sk = makeStageKey(t.mapColcId, t.mapId, t.stageId);
      const map = db.names.resolve('stageMap', mk, db.locale);
      const st = db.names.resolve('stage', sk, db.locale);
      const mapOk = map?.source === 'lang' && map.value;
      const stOk = st?.source === 'lang' && st.value;
      if (mapOk && stOk) return { displayName: `${map.value} - ${st.value}`, source: `${map.file}; ${st.file}`, unresolvedNameReason: null, nameTriplet: t };
      if (stOk) return { displayName: st.value, source: st.file, unresolvedNameReason: mapOk ? null : `map name missing for ${mk}`, nameTriplet: t };
      return { displayName: null, source: t.source, unresolvedNameReason: `lang missing for ${sk}`, nameTriplet: t };
    }
    const fallback = meta.displayName || stage?.name?.value || stage?.label || null;
    return { displayName: fallback, source: stage?.name?.source || 'stage-index', unresolvedNameReason: fallback ? null : 'not covered by confirmed BCU stage mapping' };
  };
  FormationEditor.prototype.loadStageOptions = async function () {
    if (this.stageLoading) return;
    this.stageLoading = true;
    try {
      const all = getAvailableStages();
      const stages = all.filter((s) => (s?.bundleRef?.bundlePath || s?.semanticEntry?.bundleRef?.bundlePath || s?.enabled !== false)).filter(selectable);
      this.stageOptions = stages;
      this.renderStageSelector();
      for (const stage of stages.slice(0, META_LIMIT)) await loadMeta(this, stage);
      this.renderStageSelector();
      globalThis.__FORMATION_STAGE_SELECTOR_DEBUG__ = { installed: true, source: 'FormationStageNameBcuPatch', removedHardCap80: true, totalAvailable: all.length, selectable: stages.length, knownTriplet: stages.filter((s) => !!triplet(s)).length, excludedMetadata: all.filter(excluded).length, excludedUnknown: all.filter((s) => !excluded(s) && !selectable(s)).length, metaPreloadLimit: META_LIMIT, timestamp: Date.now() };
    } finally { this.stageLoading = false; }
  };
  FormationEditor.prototype.selectStage = function (stageId) {
    this.selectedStageId = stageId || null;
    this.onStageChanged(this.selectedStageId);
    this.stageOverlayOpen = false;
    const selected = (this.stageOptions || []).find((s) => stageIdentity(s) === this.selectedStageId || s.stageId === this.selectedStageId);
    if (selected) loadMeta(this, selected).then(() => this.renderStageSelector());
    globalThis.__BCU_STAGE_SELECT_DEBUG__ = { selectedStageId: this.selectedStageId, triplet: selected ? triplet(selected) : null, meta: this.stageMeta.get(this.selectedStageId) || null, source: 'BCU known stage mapping selector', timestamp: Date.now() };
    this.renderStageSelector();
  };
  FormationEditor.prototype.renderStageSelector = function () {
    const overlay = this.root.querySelector('.formation-stage-overlay');
    if (overlay) overlay.classList.toggle('is-open', this.stageOverlayOpen);
    const current = this.root.querySelector('.formation-current-stage');
    const selectedStage = (this.stageOptions || []).find((s) => stageIdentity(s) === this.selectedStageId || s.stageId === this.selectedStageId);
    const selectedMeta = selectedStage ? this.stageMeta.get(stageIdentity(selectedStage)) || {} : {};
    const selectedName = selectedStage ? this.resolveStageDisplay(selectedStage, selectedMeta).displayName || selectedStage.stageId : '未選択';
    if (current) current.textContent = selectedName;
    const list = this.root.querySelector('.formation-stage-list');
    if (!list) return;
    list.innerHTML = (this.stageOptions || []).map((s) => {
      const id = stageIdentity(s);
      const meta = this.stageMeta.get(id) || {};
      const active = id === this.selectedStageId || s.stageId === this.selectedStageId;
      const resolved = this.resolveStageDisplay(s, meta);
      const t = resolved.nameTriplet || triplet(s);
      const name = resolved.displayName || s.stageId || s.stageKey || 'name unresolved';
      const reason = resolved.unresolvedNameReason || '';
      const tri = t ? `BCU ${t.mapColcId}/${t.mapId}/${t.stageId}` : 'BCU triplet unresolved';
      return `<button type='button' class='formation-stage-card ${active ? 'is-active' : ''}' data-stage-id='${escapeHtml(id)}'><strong>${escapeHtml(name)}</strong><small>${escapeHtml(s.stageKey || id)}</small><span>${escapeHtml(tri)} / BG ${escapeHtml(meta.bgId ?? '---')} / HP ${escapeHtml(meta.enemyBaseHp ?? '---')} / rows ${escapeHtml(meta.enemyRowCount ?? '---')}</span><span>unresolved enemies ${escapeHtml(meta.unresolvedEnemyCount ?? '---')} / bundle ${escapeHtml(meta.bundleAvailability || (s.bundleRef?.bundlePath ? 'available' : 'missing'))}</span>${reason ? `<em>${escapeHtml(reason)}</em>` : ''}</button>`;
    }).join('') || `<p class='formation-stage-empty'>No confirmed BCU stage entries available</p>`;
  };
  globalThis.__FORMATION_STAGE_NAME_BCU_PATCH_DEBUG__ = { installed: true, removedHardCap80: true, confirmedCollections: COLLECTION, timestamp: Date.now() };
}
