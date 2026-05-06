import { hasBcuEnemyAsset } from '../data/bcuAvailableEnemyAssets.js';
export function formatBcuId(id) {
  const n = Number(id);
  if (!Number.isFinite(n)) return '000';
  return String(Math.max(0, Math.floor(n))).padStart(3, '0');
}

export function getStageEnemySlotId(enemyId) {
  return `stage-enemy-${formatBcuId(enemyId)}`;
}

export function buildBcuEnemyAssetDef(enemyId) {
  const bcuId = formatBcuId(enemyId);
  return {
    id: `enemy-${bcuId}`,
    label: `敵${bcuId}`,
    role: 'stage-enemy',
    group: 'stage-enemies',
    renderMode: 'animated-unit',
    baseDir: `./public/assets/bcu/000002/org/enemy/${bcuId}/`,
    image: `${bcuId}_e.png`,
    imgcut: `${bcuId}_e.imgcut`,
    model: `${bcuId}_e.mamodel`,
    animations: ['00', '01', '02', '03'].map((n) => ({ id: `anim${n}`, file: `${bcuId}_e${n}.maanim` }))
  };
}

export function buildStageEnemyUnitDef(row) {
  const bcuId = formatBcuId(row?.enemyId);
  const available = hasBcuEnemyAsset(row?.enemyId);
  return {
    slotId: `stage-enemy-${bcuId}`,
    label: `敵${bcuId}`,
    assetId: `enemy-${bcuId}`,
    assetDef: buildBcuEnemyAssetDef(row.enemyId),
    statsType: 'enemy',
    statsId: row.enemyId,
    sourceKind: 'enemy',
    source: 'bcu-stage-csv',
    side: 'cat-enemy',
    direction: 1,
    facing: 1,
    renderFlipX: false,
    collisionRadius: 46,
    scale: 1.12,
    idleAnimId: 'anim01',
    moveAnimId: 'anim00',
    attackAnimId: 'anim02',
    knockbackAnimId: 'anim03',
    unavailable: !available, stageSpawn: { ...row }
  };
}

export function buildStageEnemyUnitDefs(stageRuntime) {
  const rows = Array.isArray(stageRuntime?.enemyRows) ? stageRuntime.enemyRows : [];
  return rows.filter((r) => Number.isFinite(r?.enemyId) && r.enemyId >= 0).map((r) => buildStageEnemyUnitDef(r)).filter((u)=>!u.unavailable);
}
