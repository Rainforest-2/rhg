import { BCU_STAGE_MANIFEST } from '../data/bcuStageManifest.js';
import { getBcuAssetDatabase } from '../bcu/BcuAssetDatabase.js';
import { reportStorageFailure, clearStorageFailure } from './BcuStorageDiagnostics.js';

export const SELECTED_STAGE_STORAGE_KEY = 'bcu.selectedStageId';

function isSelectableSemanticStage(entry = {}) {
  // CH/stageNormal CSVs are MapStageData-style rows (BGM, boss threshold,
  // reward/setup metadata), not battle layouts. They are valid resolver inputs
  // for CH/stage layouts, but selecting them as stages makes battle parsing fall
  // through to catalog default music such as 000.m4a.
  if (entry.category === 'CH' && entry.groupDir === 'stageNormal') return false;
  return true;
}

function isCanonicalChMainStage(stage = {}) {
  const entry = stage.semanticEntry || {};
  return entry.category === 'CH' && entry.groupDir === 'stage' && entry.packId === '000001';
}

function resolveAmbiguousStageMatch(matches = []) {
  return matches.find(isCanonicalChMainStage) || null;
}

function semanticStages() {
  try {
    const entries = getBcuAssetDatabase()?.semanticIndexes?.stages?.entries || [];
    return entries.filter(isSelectableSemanticStage).map((e) => ({
      stageKey: e.key,
      stageId: e.stageId,
      label: e.stageId,
      packId: e.packId,
      mapPath: `${e.category}/${e.groupDir}`,
      enabled: true,
      bundleRef: e.bundleRef,
      semanticEntry: e,
      stageCsvPath: null,
      allowRawFallback: getBcuAssetDatabase()?.semanticMode === 'semantic-with-raw-fallback',
      legacyStageCsvPath: e.diagnostics?.sourceRawPath ? `./${e.diagnostics.sourceRawPath}` : null
    }));
  } catch { return []; }
}

function findStageInList(stages, stageId) {
  if (!stageId) return null;
  const exactKey = stages.find((s) => s.stageKey === stageId);
  if (exactKey) return exactKey;
  const matches = stages.filter((s) => s.stageId === stageId || s.semanticEntry?.aliases?.includes(stageId));
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) return resolveAmbiguousStageMatch(matches);
  return null;
}

export function readPersistedStageId() {
  try {
    const value = globalThis.localStorage?.getItem?.(SELECTED_STAGE_STORAGE_KEY);
    clearStorageFailure('stage', 'read');
    return value ? String(value) : null;
  } catch (error) {
    reportStorageFailure('stage', 'read', error);
    return null;
  }
}

export function writePersistedStageId(stageId) {
  const value = stageId ? String(stageId) : '';
  try {
    if (value) globalThis.localStorage?.setItem?.(SELECTED_STAGE_STORAGE_KEY, value);
    else globalThis.localStorage?.removeItem?.(SELECTED_STAGE_STORAGE_KEY);
    clearStorageFailure('stage', 'write');
  } catch (error) {
    reportStorageFailure('stage', 'write', error);
  }
  return value || null;
}

export function getAvailableStages() { return semanticStages().concat(BCU_STAGE_MANIFEST.filter((s) => s?.enabled !== false)); }
export function getStageById(stageId) {
  return findStageInList(getAvailableStages(), stageId);
}
export function scoreStageForDefault(stageDefinition = {}, availableEnemyAssets = new Set(), manifestIndex = 0) {
  const rt = stageDefinition.runtime || stageDefinition;
  const stageLen = Number(rt.stageLen || 4000);
  const hp = Number(rt.enemyBaseHp || 0);
  const rows = Array.isArray(rt.enemyRows) ? rt.enemyRows : [];
  const unsupported = rows.filter((r) => !availableEnemyAssets.has(r.enemyId)).length;
  const active = rows.length;
  return Math.abs(stageLen - 4000) + Math.abs(hp - 100000) / 10000 + active * 2 + unsupported * 5 + manifestIndex;
}
export function getDefaultStage() {
  const stages = getAvailableStages();
  const persisted = findStageInList(stages, readPersistedStageId());
  if (persisted) return persisted;
  return stages.find((s) => s.stageId === 'stageRNA001_00')
    || stages.find((s) => s.semanticEntry?.kind === 'stage-definition')
    || stages[0]
    || null;
}
export function resolveStageSelection({ preferredStageId } = {}) {
  const pref = preferredStageId ? getStageById(preferredStageId) : null;
  return pref || getDefaultStage();
}
