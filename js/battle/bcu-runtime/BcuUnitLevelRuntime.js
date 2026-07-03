export const BCU_DEFAULT_PREF_LEVEL = 50;
export const BCU_DEFAULT_UNIT_MAX_LEVEL = 20;
export const BCU_UNIT_LEVEL_SOURCE = 'BCU Unit.getPrefLvs / UnitLevel.getMult / EForm.getEntity';

const DEFAULT_LEVEL_CURVE = Object.freeze(Array(20).fill(0));

function toFiniteNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function truncInt(value, fallback = 0) {
  const n = toFiniteNumber(value, fallback);
  return Math.trunc(n);
}

function positiveInt(value, fallback = 1) {
  const n = truncInt(value, fallback);
  return n > 0 ? n : truncInt(fallback, 1);
}

function clampInt(value, min, max) {
  const n = truncInt(value, min);
  const lo = truncInt(min, 0);
  const hi = Math.max(lo, truncInt(max, lo));
  return Math.max(lo, Math.min(hi, n));
}

function cloneJson(value) {
  if (value == null || typeof value !== 'object') return value;
  return JSON.parse(JSON.stringify(value));
}

export function normalizeBcuUnitLevelCurve(lvs) {
  const src = Array.isArray(lvs) ? lvs : [];
  return Array.from({ length: 20 }, (_, i) => truncInt(src[i], DEFAULT_LEVEL_CURVE[i] || 0));
}

function metadataScore(metadata) {
  if (!metadata || typeof metadata !== 'object') return -1;
  let score = 0;
  const maxLevel = truncInt(metadata.maxLevel ?? metadata.max, 0);
  const maxPlusLevel = truncInt(metadata.maxPlusLevel ?? metadata.maxp, 0);
  if (maxPlusLevel > 0) score += 100000 + maxPlusLevel;
  if (maxLevel > 0) score += 1000 + maxLevel;
  if (Array.isArray(metadata.levelCurve?.lvs) || Array.isArray(metadata.lvs)) score += 100;
  if (Number.isFinite(Number(metadata.rarity))) score += 10;
  return score;
}

export function selectBcuUnitLevelMetadata(...candidates) {
  let best = null;
  let bestScore = -1;
  for (const candidate of candidates.flat()) {
    const score = metadataScore(candidate);
    if (score > bestScore) {
      best = candidate || null;
      bestScore = score;
    }
  }
  return best;
}

export function getBcuUnitLevelMultiplier(level, lvs) {
  const curve = normalizeBcuUnitLevelCurve(lvs);
  let dec = Math.max(0, truncInt(level, 1));
  let multiplier = 1 - curve[0] * 0.01;
  for (const mul of curve) {
    if (dec >= 10) {
      multiplier += mul * 0.1;
      dec -= 10;
    } else {
      multiplier += mul * dec * 0.01;
      break;
    }
  }
  return multiplier;
}

export function getBcuPreferredPlusLevel({ prefLevel = BCU_DEFAULT_PREF_LEVEL, rarity = 0, maxPlusLevel = 0 } = {}) {
  const pref = Math.max(1, truncInt(prefLevel, BCU_DEFAULT_PREF_LEVEL));
  const maxp = Math.max(0, truncInt(maxPlusLevel, 0));
  const r = truncInt(rarity, 0);
  if (!(r < 2) || maxp <= 0) return 0;
  return Math.min(Math.trunc(((pref - 1) / 49.0) * maxp), maxp);
}

export function resolveBcuUnitLevelConfig({ requested = {}, metadata = {}, source = 'runtime' } = {}) {
  const maxLevel = Math.max(1, positiveInt(metadata.maxLevel ?? metadata.max, BCU_DEFAULT_UNIT_MAX_LEVEL));
  const maxPlusLevel = Math.max(0, truncInt(metadata.maxPlusLevel ?? metadata.maxp, 0));
  const rarity = truncInt(metadata.rarity, 0);
  const prefLevel = Math.max(1, truncInt(requested.prefLevel ?? requested.level ?? BCU_DEFAULT_PREF_LEVEL, BCU_DEFAULT_PREF_LEVEL));
  const level = clampInt(requested.level ?? Math.min(prefLevel, maxLevel), 1, maxLevel);
  const plusLevel = clampInt(requested.plusLevel ?? getBcuPreferredPlusLevel({ prefLevel, rarity, maxPlusLevel }), 0, maxPlusLevel);
  const effectiveLevel = level + plusLevel;
  const lvs = normalizeBcuUnitLevelCurve(metadata.levelCurve?.lvs || metadata.lvs);
  const multiplier = getBcuUnitLevelMultiplier(effectiveLevel, lvs);
  return {
    source,
    bcuReference: BCU_UNIT_LEVEL_SOURCE,
    prefLevel,
    level,
    plusLevel,
    effectiveLevel,
    maxLevel,
    maxPlusLevel,
    rarity,
    lvs,
    multiplier,
    metadataSource: metadata.source || metadata.levelCurve?.source || null,
    curveMissing: !(metadata.levelCurve?.lvs || metadata.lvs)
  };
}

function scaleHp(value, multiplier, min = 1) {
  const n = toFiniteNumber(value, min);
  return Math.max(min, Math.round(n * multiplier));
}

function scaleAttack(value, multiplier, min = 0) {
  const n = toFiniteNumber(value, min);
  return Math.max(min, Math.trunc(Math.round(n) * multiplier));
}

function scaleAttackHits(attackHits, multiplier) {
  if (!Array.isArray(attackHits)) return attackHits;
  return attackHits.map((hit, index) => {
    const baseDamage = Number.isFinite(hit?.baseDamage) ? hit.baseDamage : (Number.isFinite(hit?.damage) ? hit.damage : 0);
    const damage = scaleAttack(baseDamage, multiplier, 0);
    return {
      ...hit,
      hitIndex: Number.isFinite(hit?.hitIndex) ? hit.hitIndex : index,
      baseDamage,
      damage,
      bcuUnitLevelDamageMultiplier: multiplier
    };
  });
}

function scaleUnitCombatModel(combatModel, multiplier) {
  if (!combatModel || typeof combatModel !== 'object') return combatModel;
  const out = cloneJson(combatModel);
  const proc = out?.proc || null;
  if (proc?.demonShield && Number.isFinite(proc.demonShield.hp)) {
    proc.demonShield.baseHp = proc.demonShield.baseHp ?? proc.demonShield.hp;
    proc.demonShield.hp = scaleAttack(proc.demonShield.baseHp, multiplier, 0);
    proc.demonShield.bcuUnitLevelDamageMultiplier = multiplier;
  }
  if (proc?.barrier && Number.isFinite(proc.barrier.health) && proc.barrier?.type?.magnif === true) {
    proc.barrier.baseHealth = proc.barrier.baseHealth ?? proc.barrier.health;
    proc.barrier.health = scaleAttack(proc.barrier.baseHealth, multiplier, 0);
    proc.barrier.bcuUnitLevelDamageMultiplier = multiplier;
  }
  if (proc?.DMGCUT && Number.isFinite(proc.DMGCUT.dmg) && proc.DMGCUT?.type?.magnif === true) {
    proc.DMGCUT.baseDmg = proc.DMGCUT.baseDmg ?? proc.DMGCUT.dmg;
    proc.DMGCUT.dmg = scaleAttack(proc.DMGCUT.baseDmg, multiplier, 0);
  }
  if (proc?.DMGCAP && Number.isFinite(proc.DMGCAP.dmg) && proc.DMGCAP?.type?.magnif === true) {
    proc.DMGCAP.baseDmg = proc.DMGCAP.baseDmg ?? proc.DMGCAP.dmg;
    proc.DMGCAP.dmg = scaleAttack(proc.DMGCAP.baseDmg, multiplier, 0);
  }
  if (proc?.HPREGEN && Number.isFinite(proc.HPREGEN.amount) && proc.HPREGEN?.scaleWithBuff === true) {
    proc.HPREGEN.baseAmount = proc.HPREGEN.baseAmount ?? proc.HPREGEN.amount;
    proc.HPREGEN.amount = scaleAttack(proc.HPREGEN.baseAmount, multiplier, 0);
  }
  out.source = `${combatModel.source || 'BCU DataUnit'} + ${BCU_UNIT_LEVEL_SOURCE}`;
  out.unitLevelMultiplier = multiplier;
  return out;
}

export function applyBcuUnitLevelToStats(baseStats, levelConfig = {}) {
  if (!baseStats || typeof baseStats !== 'object') return baseStats;
  const metadata = levelConfig.metadata || baseStats.bcuUnitLevelMeta || baseStats.source?.unitLevelMeta || {};
  const resolved = resolveBcuUnitLevelConfig({ requested: levelConfig, metadata, source: levelConfig.source || 'unitDef.bcuUnitLevel' });
  const multiplier = resolved.multiplier;
  const scaledHits = scaleAttackHits(baseStats.attackHits, multiplier);
  const scaledHp = scaleHp(baseStats.hp, multiplier, 1);
  const scaledDamage = scaleAttack(baseStats.damage, multiplier, 0);
  const source = {
    ...(baseStats.source || {}),
    bcuUnitLevelApplied: true,
    bcuUnitLevel: resolved,
    baseHp: baseStats.hp,
    baseDamage: baseStats.damage,
    mapping: `${baseStats.source?.mapping || 'bcu-dataunit'}+bcu-unit-level`
  };
  const bcuCombatModel = scaleUnitCombatModel(baseStats.bcuCombatModel, multiplier);
  const bcuProc = bcuCombatModel?.proc || baseStats.bcuProc;
  const debug = {
    source: 'BcuUnitLevelRuntime.applyBcuUnitLevelToStats',
    bcuReference: BCU_UNIT_LEVEL_SOURCE,
    baseHp: baseStats.hp ?? null,
    scaledHp,
    baseDamage: baseStats.damage ?? null,
    scaledDamage,
    level: resolved.level,
    plusLevel: resolved.plusLevel,
    effectiveLevel: resolved.effectiveLevel,
    multiplier,
    curveMissing: resolved.curveMissing,
    attackHits: Array.isArray(scaledHits)
      ? scaledHits.map((hit, index) => ({ hitIndex: hit.hitIndex ?? index, baseDamage: hit.baseDamage ?? null, scaledDamage: hit.damage ?? null }))
      : []
  };
  const finalStats = {
    ...baseStats,
    baseHp: baseStats.hp,
    baseDamage: baseStats.damage,
    hp: scaledHp,
    damage: scaledDamage,
    attackHits: scaledHits,
    source,
    bcuCombatModel,
    bcuProc,
    abilities: baseStats.abilities ? { ...baseStats.abilities, proc: bcuProc } : baseStats.abilities,
    bcuUnitLevel: resolved,
    statsModelDebug: {
      ...(baseStats.statsModelDebug || {}),
      ...debug,
      bcuUnitLevelApplied: true
    }
  };
  finalStats.actorStatsModel = {
    source: 'bcu-unit-level-runtime',
    baseStats,
    finalStats,
    levelMagnification: resolved,
    stageMagnification: baseStats.stageMagnification || null,
    warnings: resolved.curveMissing ? ['missing-bcu-unit-level-curve'] : [],
    debug: finalStats.statsModelDebug
  };
  return finalStats;
}
