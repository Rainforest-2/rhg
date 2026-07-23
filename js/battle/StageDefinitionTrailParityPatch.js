import { StageDefinitionLoader } from './StageDefinitionLoader.js';

const PATCH_FLAG = Symbol.for('wanko-battle.stage-definition-trail-parity.v1');
export const BCU_TRAIL_BASE_HP = 0x7fffffff;

const CSV_C0 = 5;
const CSV_M = 9;
const CSV_M1 = 11;
const SPECIAL_BASE_317 = 317;

function finite(value, fallback = null) {
  if (value === undefined || value === null || String(value).trim() === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function patchCastle0(row, castle0, warning = null) {
  if (!row) return row;
  Object.assign(row, {
    baseHpTrigger: castle0,
    baseHpTriggerPercent: castle0,
    baseHpTriggerLowerPercent: castle0
  });
  if (row.scdef) {
    Object.assign(row.scdef, {
      baseHpTriggerLowerPercent: castle0,
      castle_0: castle0
    });
  }
  if (row.scdefRaw?.internal) row.scdefRaw.internal.C0 = castle0;
  if (warning && Array.isArray(row.warnings) && !row.warnings.includes(warning)) row.warnings.push(warning);
  if (warning && Array.isArray(row.debug?.warnings) && !row.debug.warnings.includes(warning)) row.debug.warnings.push(warning);
  return row;
}

function patchSpecialBase317(definition) {
  if (!definition?.ok) return definition;
  const rawBaseId = finite(definition.runtime?.headerRawRow?.[6], null);
  if (rawBaseId !== SPECIAL_BASE_317) return definition;

  const warning = 'special base 317 forced first CSV enemy row castle_0=0';
  const collections = [
    definition.enemyRows,
    definition.activeEnemies,
    definition.enemies,
    definition.runtime?.enemyRows,
    definition.runtime?.sourceEnemyRows
  ];
  const seen = new Set();
  let patched = 0;
  for (const rows of collections) {
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      if (!row || seen.has(row) || Number(row.originalCsvOrderIndex ?? row.sourceOrder) !== 0) continue;
      seen.add(row);
      patchCastle0(row, 0, warning);
      patched += 1;
    }
  }

  definition.debug = {
    ...(definition.debug || {}),
    specialBase317: {
      source: 'BCU Stage.java: header base id 317 forces the first original CSV enemy row castle_0=0',
      rawBaseId,
      patchedRepresentations: patched
    }
  };
  return definition;
}

function patchTrailRow(row) {
  if (!row || !Array.isArray(row.raw)) return row;
  const rawCastle0 = finite(row.raw[CSV_C0], 100);
  const rawMagnification = finite(row.raw[CSV_M], 100);
  const rawAttackMagnification = finite(row.raw[CSV_M1], null);
  const castle0 = row.baseEnemy === true || row.isBcuEnemyEntityBase === true ? 0 : rawCastle0;
  const attackMagnification = Number.isFinite(rawAttackMagnification) && rawAttackMagnification !== 0
    ? rawAttackMagnification
    : rawMagnification;

  Object.assign(row, {
    baseHpTrigger: castle0,
    baseHpTriggerPercent: castle0,
    baseHpTriggerLowerPercent: castle0,
    baseHpTriggerMode: 'accumulated-enemy-base-damage',
    magnification: rawMagnification,
    hpMagnification: rawMagnification,
    attackMagnification
  });

  if (row.scdef) {
    Object.assign(row.scdef, {
      baseHpTriggerLowerPercent: castle0,
      castle_0: castle0,
      magnification: rawMagnification,
      multiple: rawMagnification,
      attackMagnification,
      mult_atk: attackMagnification
    });
  }
  if (row.scdefRaw?.internal) {
    Object.assign(row.scdefRaw.internal, {
      C0: castle0,
      M: rawMagnification,
      M1: attackMagnification
    });
  }
  if (Array.isArray(row.warnings)) {
    row.warnings = row.warnings.filter((warning) => !String(warning).includes('C0>100 moved to magnification'));
  }
  if (Array.isArray(row.debug?.warnings)) {
    row.debug.warnings = row.debug.warnings.filter((warning) => !String(warning).includes('C0>100 moved to magnification'));
  }
  return row;
}

function patchDefinition(definition) {
  if (!definition?.ok) return definition;
  const timeLimit = Math.max(0, finite(definition.timeLimit ?? definition.runtime?.headerRawRow?.[7], 0));
  const trail = timeLimit !== 0;
  const rawEnemyBaseHp = finite(
    definition.rawEnemyBaseHp ?? definition.runtime?.headerRawRow?.[1] ?? definition.enemyBaseHp,
    null
  );

  definition.timeLimit = timeLimit;
  definition.trail = trail;
  definition.drop = !trail;
  definition.rawEnemyBaseHp = rawEnemyBaseHp;

  if (trail) {
    definition.enemyBaseHp = BCU_TRAIL_BASE_HP;
    const seen = new Set();
    for (const rows of [
      definition.enemyRows,
      definition.activeEnemies,
      definition.enemies,
      definition.runtime?.enemyRows,
      definition.runtime?.sourceEnemyRows
    ]) {
      if (!Array.isArray(rows)) continue;
      for (const row of rows) {
        if (!row || seen.has(row)) continue;
        seen.add(row);
        patchTrailRow(row);
      }
    }
    if (Array.isArray(definition.warnings)) {
      definition.warnings = definition.warnings.filter((warning) => !String(warning).includes('normalized baseHpTrigger>100 into magnification'));
    }
  }

  patchSpecialBase317(definition);

  definition.runtime = {
    ...(definition.runtime || {}),
    timeLimit,
    trail,
    drop: !trail,
    rawEnemyBaseHp,
    enemyBaseHp: definition.enemyBaseHp,
    triggerDomain: trail ? 'accumulated-enemy-base-damage' : 'enemy-base-hp-percent'
  };
  definition.meta = {
    ...(definition.meta || {}),
    timeLimit,
    trail,
    rawEnemyBaseHp,
    enemyBaseHp: definition.enemyBaseHp
  };
  definition.debug = {
    ...(definition.debug || {}),
    trailParity: {
      source: 'BCU Stage.java trail=timeLimit!=0; EStage.inHealth accumulated damage domain',
      timeLimit,
      trail,
      rawEnemyBaseHp,
      runtimeEnemyBaseHp: definition.enemyBaseHp
    }
  };
  return definition;
}

export function installStageDefinitionTrailParityPatch() {
  const proto = StageDefinitionLoader?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  const originalParse = proto.parse;
  if (typeof originalParse !== 'function') throw new Error('StageDefinitionLoader.parse is missing');
  proto[PATCH_FLAG] = true;
  proto.parse = function parseWithTrailParity(...args) {
    return patchDefinition(originalParse.apply(this, args));
  };
}

installStageDefinitionTrailParityPatch();

export { patchDefinition as patchTrailStageDefinition };
