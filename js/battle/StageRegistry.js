import { BCU_STAGE_MANIFEST } from '../data/bcuStageManifest.js';

export function getAvailableStages() { return BCU_STAGE_MANIFEST.filter((s) => s?.enabled !== false); }
export function getStageById(stageId) { return getAvailableStages().find((s) => s.stageId === stageId) || null; }
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
