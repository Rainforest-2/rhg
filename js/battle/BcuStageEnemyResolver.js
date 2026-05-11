import { hasBcuEnemyAsset } from '../data/bcuAvailableEnemyAssets.js';
import { getBcuAssetDatabase } from '../bcu/BcuAssetDatabase.js';
export function formatBcuId(id) {
  const n = Number(id);
  if (!Number.isFinite(n)) return '000';
  return String(Math.max(0, Math.floor(n))).padStart(3, '0');
}

function normalizePercent(value, fallback = 100) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function getStageEnemySlotId(enemyId, rowIndex = null) {
  const bcuId = formatBcuId(enemyId);
  return Number.isFinite(rowIndex) ? `stage-enemy-${bcuId}-row-${rowIndex}` : `stage-enemy-${bcuId}`;
}

export function buildBcuEnemyAssetDef(enemyId) {
  const bcuId = formatBcuId(enemyId);
  const semanticKey = `enemy:${Number(enemyId)}`;
  try {
    const db = getBcuAssetDatabase();
    const resolved = db?.assets?.resolveEnemyAsset?.(enemyId);
    const entry = db?.semanticProvider?.getActorEntry?.(semanticKey);
    if (resolved?.semanticKey && resolved?.bundleRef) {
      return { ...resolved, id: `enemy-${bcuId}`, label: `敵${bcuId}`, role: 'stage-enemy', group: 'stage-enemies', renderMode: 'animated-unit', semanticKey, bundleRef: resolved.bundleRef };
    }
    if (entry?.bundleRef) {
      return {
        id: `enemy-${bcuId}`,
        label: `敵${bcuId}`,
        role: 'stage-enemy',
        group: 'stage-enemies',
        renderMode: 'animated-unit',
        semanticKey,
        bundleRef: entry.bundleRef,
        image: `${bcuId}_e.png`,
        imgcut: `${bcuId}_e.imgcut`,
        model: `${bcuId}_e.mamodel`,
        animations: ['00', '01', '02', '03'].map((n) => ({ id: `anim${n}`, file: `${bcuId}_e${n}.maanim` }))
      };
    }
    if (entry && entry.status !== 'rawOnly') throw new Error(`BCU semantic actor exists without bundle: ${semanticKey}`);
  } catch (error) {
    if (!String(error?.message || error).includes('BCU asset database is not loaded')) throw error;
  }
  return {
    id: `enemy-${bcuId}`,
    label: `敵${bcuId}`,
    role: 'stage-enemy',
    group: 'stage-enemies',
    renderMode: 'animated-unit',
    semanticKey,
    allowRawOnly: true,
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
  const rowIndex = Number.isFinite(row?.rowIndex) ? row.rowIndex : null;
  const magnification = normalizePercent(row?.magnification, 100);
  const hpMagnification = normalizePercent(row?.hpMagnification ?? row?.magnification, 100);
  const attackMagnification = normalizePercent(row?.attackMagnification ?? row?.magnification, 100);
  return {
    slotId: getStageEnemySlotId(row?.enemyId, rowIndex),
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
    unavailable: !available,
    stageSpawn: { ...row },
    stageStatModifiers: {
      source: 'bcu-stage-csv-row',
      rowIndex,
      rawEnemyId: row?.rawEnemyId ?? null,
      sourceEnemyId: row?.sourceEnemyId ?? null,
      enemyId: row?.enemyId ?? null,
      magnification,
      hpMagnification,
      attackMagnification
    },
    magnification,
    hpMagnification,
    attackMagnification
  };
}

export function buildStageEnemyUnitDefs(stageRuntime) {
  const rows = Array.isArray(stageRuntime?.enemyRows) ? stageRuntime.enemyRows : [];
  return rows.filter((r) => Number.isFinite(r?.enemyId) && r.enemyId >= 0).map((r) => buildStageEnemyUnitDef(r));
}
