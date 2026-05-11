import { BCU_STAGE_MANIFEST } from '../data/bcuStageManifest.js';
import { getBcuAssetDatabase } from '../bcu/BcuAssetDatabase.js';

function semanticStages() {
  try {
    const entries = getBcuAssetDatabase()?.semanticIndexes?.stages?.entries || [];
    return entries.map((e) => ({
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

export function getAvailableStages() { return semanticStages().concat(BCU_STAGE_MANIFEST.filter((s) => s?.enabled !== false)); }
export function getStageById(stageId) {
  const stages = getAvailableStages();
  const exactKey = stages.find((s) => s.stageKey === stageId);
  if (exactKey) return exactKey;
  const matches = stages.filter((s) => s.stageId === stageId || s.semanticEntry?.aliases?.includes(stageId));
  return matches.length === 1 ? matches[0] : null;
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
export function getDefaultStage() { return getAvailableStages()[0] || null; }
export function resolveStageSelection({ preferredStageId } = {}) {
  const pref = preferredStageId ? getStageById(preferredStageId) : null;
  return pref || getDefaultStage();
}
