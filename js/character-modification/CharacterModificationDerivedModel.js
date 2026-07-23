import { AbilityModel } from '../battle/AbilityModel.js';
import {
  BCU_PROC_IMMUNITY_FIELDS
} from '../battle/BcuCombatModel.js';
import { BattleAttackProfile } from '../battle/BattleAttackProfile.js';
import {
  bcuRangeToWorld,
  bcuSpeedToWorldPerSecond,
  bcuWidthToWorld
} from '../battle/BattleWorldUnits.js';
import { BCU_BATTLE_TIMER_PERIOD_MS } from '../battle/BattleFrameClock.js';

function buildImmunity(proc = {}) {
  const immunity = {};
  const fields = { ...BCU_PROC_IMMUNITY_FIELDS, delay: 'IMUDELAY' };
  for (const [key, field] of Object.entries(fields)) {
    const mult = Number(proc?.[field]?.mult ?? proc?.[field]?.block ?? 0);
    const normalized = Number.isFinite(mult)
      ? Math.max(0, Math.min(100, Math.trunc(mult)))
      : 0;
    immunity[key] = {
      field,
      mult: normalized,
      full: normalized >= 100,
      partial: normalized > 0 && normalized < 100,
      damageMultiplier: Math.max(0, (100 - normalized) / 100)
    };
  }
  return immunity;
}

function rebuildAttackHits(stats) {
  const source = Array.isArray(stats.attackHits) && stats.attackHits.length
    ? stats.attackHits
    : [{
      hitIndex: 0,
      damage: Number.isFinite(stats.damage) ? stats.damage : 0,
      preFrames: Number.isFinite(stats.attackStartupFrames) ? stats.attackStartupFrames : 0,
      preFramesAbsolute: Number.isFinite(stats.attackStartupFrames) ? stats.attackStartupFrames : 0,
      abi: 0,
      ldStartRaw: 0,
      ldRangeRaw: 0
    }];
  const globalProc = stats?.bcuCombatModel?.proc || stats?.bcuProc || {};
  const globalProcOverrides = stats?.characterModificationGlobalProcOverrides;
  const hasGlobalProcOverrides = globalProcOverrides
    && typeof globalProcOverrides === 'object'
    && Object.keys(globalProcOverrides).length > 0;
  const globallyEnabledProcKeys = hasGlobalProcOverrides
    ? Object.entries(globalProcOverrides)
      .filter(([, value]) => value != null)
      .map(([key]) => key)
    : [];
  return source.slice(0, 3).map((rawHit, index, hits) => {
    const preFrames = Math.max(0, Number(rawHit?.preFramesAbsolute ?? rawHit?.preFrames ?? 0) || 0);
    const previousPre = index === 0
      ? 0
      : Math.max(0, Number(hits[index - 1]?.preFramesAbsolute ?? hits[index - 1]?.preFrames ?? 0) || 0);
    const ldStartRaw = Number(rawHit?.ldStartRaw || 0);
    const ldRangeRaw = Number(rawHit?.ldRangeRaw || 0);
    const procOverrides = rawHit?.characterModificationProcOverrides;
    const hasProcOverrides = procOverrides && typeof procOverrides === 'object';
    const hasCompleteProc = hasGlobalProcOverrides || hasProcOverrides;
    let hitProc = hasCompleteProc ? { ...globalProc } : null;
    if (hasCompleteProc && hasProcOverrides) {
      for (const [key, value] of Object.entries(procOverrides)) {
        if (value == null) delete hitProc[key];
        else hitProc[key] = value && typeof value === 'object' ? { ...value } : value;
      }
    }
    const hasEnabledGlobalOverride = globallyEnabledProcKeys.some((key) => hitProc?.[key] != null);
    const modificationProcEnabled = rawHit?.characterModificationProcEnabled === true
      || hasEnabledGlobalOverride;
    return {
      ...rawHit,
      hitIndex: index,
      damage: Math.max(0, Math.trunc(Number(rawHit?.damage) || 0)),
      preFrames,
      preFramesAbsolute: preFrames,
      deltaFramesFromPrevious: index === 0 ? preFrames : preFrames - previousPre,
      abi: Number.isFinite(rawHit?.abi) ? Math.trunc(rawHit.abi) : 0,
      ldStartRaw,
      ldRangeRaw,
      shortPointRaw: ldStartRaw,
      longPointRaw: ldStartRaw + ldRangeRaw,
      isLd: rawHit?.isLd === true || (ldRangeRaw > 0 && rawHit?.isOmni !== true),
      isOmni: rawHit?.isOmni === true || ldRangeRaw < 0,
      ...(rawHit?.characterModificationAbilityFlags
        ? { characterModificationAbilityFlags: { ...rawHit.characterModificationAbilityFlags } }
        : {}),
      ...(hasCompleteProc
        ? {
          bcuProc: hitProc,
          bcuProcIsComplete: true,
          ...(modificationProcEnabled ? { characterModificationProcEnabled: true } : {}),
          ...(hasProcOverrides
            ? {
              characterModificationProcOverrides: Object.fromEntries(
                Object.entries(procOverrides).map(([key, value]) => [
                  key,
                  value && typeof value === 'object' ? { ...value } : value
                ])
              )
            }
            : {})
        }
        : {})
    };
  });
}

function lifecycleInitialState(proc = {}) {
  return {
    barrierHp: Math.max(0, Math.trunc(Number(proc?.barrier?.health) || 0)),
    demonShieldHp: Math.max(0, Math.trunc(Number(proc?.demonShield?.hp) || 0)),
    demonShieldRegenPercent: Math.max(0, Number(proc?.demonShield?.regen) || 0),
    revive: proc?.revive ? { ...proc.revive } : null,
    burrow: proc?.burrow ? { ...proc.burrow } : null,
    summon: proc?.SUMMON || proc?.summon ? { ...(proc.SUMMON || proc.summon) } : null,
    spirit: proc?.spirit ? { ...proc.spirit } : null
  };
}

function rebuildActorStatsModel(out, previousModel) {
  const previousDebug = previousModel?.debug || out.statsModelDebug || {};
  const baseStats = previousModel?.baseStats || out.baseStats || null;
  const normalFinalStats = previousModel?.finalStats || null;
  const debug = {
    ...previousDebug,
    source: 'character-modification-post-normal-final',
    baseHp: previousDebug.baseHp ?? baseStats?.hp ?? null,
    baseDamage: previousDebug.baseDamage ?? baseStats?.damage ?? null,
    normalFinalHp: previousDebug.scaledHp ?? normalFinalStats?.hp ?? null,
    normalFinalDamage: previousDebug.scaledDamage ?? normalFinalStats?.damage ?? null,
    scaledHp: out.hp,
    scaledDamage: out.damage,
    modifiedFinalHp: out.hp,
    modifiedFinalDamage: out.damage,
    characterModificationHash: out.characterModificationHash || null,
    characterModificationApplied: true,
    attackHits: out.attackHits.map((hit) => ({
      hitIndex: hit.hitIndex,
      baseDamage: hit.baseDamage ?? null,
      scaledDamage: hit.damage,
      modifiedFinalDamage: hit.damage
    }))
  };
  const model = {
    ...(previousModel || {}),
    source: 'character-modification-post-normal-final',
    rawStats: previousModel?.rawStats || out.rawValues || null,
    baseStats,
    finalStats: null,
    stageMagnification: previousModel?.stageMagnification || out.stageMagnification || null,
    levelMagnification: previousModel?.levelMagnification || out.bcuUnitLevel || null,
    warnings: Array.isArray(previousModel?.warnings) ? previousModel.warnings.slice() : [],
    debug
  };
  out.statsModelDebug = debug;
  out.actorStatsModel = model;
  model.finalStats = out;
  return model;
}

export function rebuildModifiedDerivedModels(stats, context = {}) {
  if (!stats || typeof stats !== 'object') {
    throw new TypeError('rebuildModifiedDerivedModels requires a stats object.');
  }
  if (!stats.characterModificationDebug?.appliedFields?.length) return stats;

  const attackHits = rebuildAttackHits(stats);
  const combatModel = stats.bcuCombatModel
    ? {
      ...stats.bcuCombatModel,
      traits: stats.bcuCombatModel.traits
        ? {
          ...stats.bcuCombatModel.traits,
          list: Array.isArray(stats.bcuCombatModel.traits.list)
            ? stats.bcuCombatModel.traits.list.slice()
            : [],
          flags: { ...(stats.bcuCombatModel.traits.flags || {}) }
        }
        : stats.bcuCombatModel.traits,
      targetTraits: stats.bcuCombatModel.targetTraits
        ? {
          ...stats.bcuCombatModel.targetTraits,
          list: Array.isArray(stats.bcuCombatModel.targetTraits.list)
            ? stats.bcuCombatModel.targetTraits.list.slice()
            : [],
          flags: { ...(stats.bcuCombatModel.targetTraits.flags || {}) }
        }
        : stats.bcuCombatModel.targetTraits,
      ability: {
        ...(stats.bcuCombatModel.ability || {}),
        flags: { ...(stats.bcuCombatModel.ability?.flags || {}) }
      },
      proc: Object.fromEntries(
        Object.entries(stats.bcuCombatModel.proc || {}).map(([key, value]) => [
          key,
          value && typeof value === 'object' ? { ...value } : value
        ])
      )
    }
    : null;

  if (combatModel) {
    combatModel.immunity = buildImmunity(combatModel.proc);
    combatModel.resistance = Object.fromEntries(
      Object.entries(combatModel.immunity).filter(([, value]) => value.partial)
    );
  }

  const out = {
    ...stats,
    attackHits,
    attackCount: attackHits.length,
    damage: attackHits[0]?.damage ?? 0,
    representativeDamage: attackHits[0]?.damage ?? 0,
    totalNominalDamage: attackHits.reduce((sum, hit) => sum + hit.damage, 0),
    attackStartupFrames: attackHits[0]?.preFrames ?? 0,
    longPreFrames: Math.max(...attackHits.map((hit) => hit.preFramesAbsolute || 0)),
    bcuCombatModel: combatModel || stats.bcuCombatModel
  };

  if (combatModel) {
    out.bcuProc = combatModel.proc;
    out.bcuAbi = combatModel.ability?.abi ?? out.bcuAbi;
    out.bcuAbilityFlags = combatModel.ability?.flags || out.bcuAbilityFlags;
    out.traits = combatModel.traits?.list || out.traits || [];
    out.traitFlags = combatModel.traits?.flags || out.traitFlags || {};
  }

  out.abilityModel = AbilityModel.buildStatsAbilityModel({
    stats: out,
    rawValues: out.rawValues,
    kind: combatModel?.kind || out.source?.type || context.kind || 'unknown',
    bcuCombatModel: combatModel
  });
  out.abilities = {
    model: out.abilityModel,
    attackAbilities: out.abilityModel.attackAbilities,
    hasRawAbi: out.abilityModel.hasRawAbi,
    mappingStatus: out.abilityModel.mappingStatus,
    bcuAbi: out.bcuAbi,
    bcuFlags: out.bcuAbilityFlags,
    proc: out.bcuProc
  };
  out.respawnSeconds = Number.isFinite(out.respawnFrames)
    ? Math.max(0, out.respawnFrames) * BCU_BATTLE_TIMER_PERIOD_MS / 1000
    : out.respawnSeconds;
  out.characterModificationWorldValues = {
    moveSpeedWorldPerSecond: bcuSpeedToWorldPerSecond(out.speed),
    detectionRangeWorld: bcuRangeToWorld(out.detectionRange),
    attackWidthWorld: bcuWidthToWorld(out.width || 0)
  };
  out.characterModificationInitialState = lifecycleInitialState(out.bcuProc || {});
  rebuildActorStatsModel(out, stats.actorStatsModel || null);
  out.characterModificationDerived = {
    revision: out.characterModificationHash || null,
    attackProfileRequiresRebuild: true,
    production: out.characterModificationProduction
      ? { ...out.characterModificationProduction }
      : null,
    rebuiltModels: [
      'attackHits',
      'representativeDamage',
      'bcuCombatModel.proc',
      'bcuProc',
      'abilityModel',
      'abilities',
      'actorStatsModel',
      'worldValues',
      'actorInitialState'
    ]
  };
  return out;
}

export function rebuildModifiedBattleAttackProfile(actor) {
  if (!actor) throw new TypeError('rebuildModifiedBattleAttackProfile requires an actor.');
  const profile = BattleAttackProfile.fromActor(actor);
  actor.attackProfile = profile;
  return profile;
}
