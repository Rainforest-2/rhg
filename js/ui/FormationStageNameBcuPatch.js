import { FormationEditor } from './FormationEditor.js';
import { stageKey as makeStageKey, stageMapKey } from '../bcu/BcuIdentifier.js';
import { getBcuAssetDatabase } from '../bcu/BcuAssetDatabase.js';

/*
 * Compatibility-only name resolver patch.
 *
 * The stage selector UI is owned by FormationEditorPerformancePatch + BcuStageCatalogBuilder.
 * Do not override loadStageOptions/selectStage/renderStageSelector here; doing so flattens the
 * selector back into a heavy all-stage list.
 */

const FLAG = Symbol.for('wanko-battle.formation-stage-name-bcu-patch.compat-v2');
const COLLECTION = Object.freeze({ N: 0, S: 1, C: 2, CH: 3, E: 4, T: 6, V: 7, R: 11, M: 12, A: 13, B: 14, RA: 24, H: 25, CA: 27, Q: 31, L: 33, ND: 34, SR: 36, G: 37 });

const text = (v) => String(v || '').replace(/\.csv$/i, '');
const basenameOf = (s) => text(s?.stageId || s?.basename || s?.semanticEntry?.basename);
const categoryOf = (s) => String(s?.category || s?.semanticEntry?.category || '');
const groupOf = (s) => String(s?.groupDir || s?.semanticEntry?.groupDir || '');

function normalTriplet(s) {
  const c = categoryOf(s);
  const mapColcId = COLLECTION[c];
  if (!Number.isInteger(mapColcId)) return null;
  const seg = basenameOf(s).replace(/^stage[A-Z]+/i, '').split('_');
  const mapId = Number(seg[0]);
  const stageId = Number(seg[1]);
  if (!Number.isInteger(mapId) || !Number.isInteger(stageId)) return null;
  return { mapColcId, mapId, stageId, source: `BCU collection ${c}`, category: c, groupDir: groupOf(s), basename: basenameOf(s) };
}

function chapterTriplet(s) {
  if (categoryOf(s) !== 'CH') return null;
  const g = groupOf(s);
  const b = basenameOf(s);
  let m;
  if (g === 'stageZ') {
    m = b.match(/^stageZ(\d{2})_(\d{2})$/i);
    if (!m) return null;
    const id0 = Number(m[1]);
    const id1 = Number(m[2]);
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

function triplet(stage) {
  return chapterTriplet(stage) || dmTriplet(stage) || normalTriplet(stage);
}

if (!FormationEditor.prototype[FLAG]) {
  FormationEditor.prototype[FLAG] = true;

  FormationEditor.prototype.parseStageTripletFromEntry = function parseStageTripletFromEntry(stage) {
    return triplet(stage);
  };

  FormationEditor.prototype.resolveStageDisplay = function resolveStageDisplay(stage, meta = {}) {
    const db = getBcuAssetDatabase();
    const direct = db?.stages?.get?.(stage?.stageKey || stage?.key);
    if (direct?.name?.source === 'lang' && direct.name.value) {
      return { displayName: direct.name.value, source: direct.name.file || 'BcuStageRepository.name', unresolvedNameReason: null };
    }
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

  globalThis.__FORMATION_STAGE_NAME_BCU_PATCH_DEBUG__ = { installed: true, mode: 'name-resolver-only', doesNotOverrideStageSelector: true, confirmedCollections: COLLECTION, timestamp: Date.now() };
}
