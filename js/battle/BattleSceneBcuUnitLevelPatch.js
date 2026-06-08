import { BattleScene } from './BattleScene.js';
import { FormationStore, DOG_DEFAULT_MAGNIFICATION_PERCENT } from './FormationStore.js';
import { BCU_DEFAULT_PREF_LEVEL, resolveBcuUnitLevelConfig } from './bcu-runtime/BcuUnitLevelRuntime.js';

const PATCH_FLAG = Symbol.for('wanko-battle.scene-bcu-unit-level-production.v2-per-character');

function getFormationLevelOptions() {
  const formation = FormationStore.load();
  const opt = formation?.options?.bcuCatUnitLevel || {};
  return {
    formation,
    global: {
      enabled: opt.enabled !== false,
      prefLevel: Math.max(1, Math.trunc(Number(opt.prefLevel ?? BCU_DEFAULT_PREF_LEVEL) || BCU_DEFAULT_PREF_LEVEL)),
      source: opt.source || 'formation.options.bcuCatUnitLevel'
    },
    perCat: formation?.options?.bcuCatUnitLevels || {},
    dogMagnifications: formation?.options?.dogUnitMagnifications || {}
  };
}

function characterKeys(unitDef = {}) {
  return [...new Set([
    unitDef.characterId,
    unitDef.sourceSlotId,
    unitDef.baseCharacterId,
    unitDef.slotId?.replace(/^prod-/, '')
  ].filter((value) => typeof value === 'string' && value.trim()))];
}

function firstOptionHit(map = {}, unitDef = {}) {
  for (const key of characterKeys(unitDef)) {
    if (map[key]) return { key, value: map[key] };
  }
  return { key: null, value: null };
}

function levelMetadataFor(scene, unitDef = {}) {
  if (unitDef?.bcuUnitLevelMeta) return unitDef.bcuUnitLevelMeta;
  const db = scene?.bcuDb || globalThis.__BCU_DB__ || null;
  const form = unitDef.form || (Number.isFinite(unitDef.formRow) ? unitDef.formRow : 'f');
  try {
    const record = db?.units?.getForm?.(unitDef.statsId, form);
    return record?.levelMeta || record?.stats?.bcuUnitLevelMeta || record?.stats?.source?.unitLevelMeta || db?.units?.get?.(unitDef.statsId)?.levelMeta || null;
  } catch {
    return null;
  }
}

function buildCatLevelRequest(unitDef, metadata, opts) {
  const hit = firstOptionHit(opts.perCat, unitDef);
  const override = hit.value;
  if (!override || override.enabled === false) {
    return {
      request: { prefLevel: opts.global.prefLevel, source: opts.global.source, metadata },
      hitKey: null,
      mode: 'global-pref-level'
    };
  }
  const hasExplicitLevel = override.level != null || override.plusLevel != null;
  if (hasExplicitLevel) {
    return {
      request: {
        prefLevel: Math.max(1, Math.trunc(Number(override.prefLevel ?? override.level ?? opts.global.prefLevel) || opts.global.prefLevel)),
        level: override.level != null ? Math.max(1, Math.trunc(Number(override.level) || 1)) : undefined,
        plusLevel: override.plusLevel != null ? Math.max(0, Math.trunc(Number(override.plusLevel) || 0)) : 0,
        source: override.source || 'formation.options.bcuCatUnitLevels.explicit-level',
        metadata
      },
      hitKey: hit.key,
      mode: 'per-character-explicit-level'
    };
  }
  return {
    request: {
      prefLevel: Math.max(1, Math.trunc(Number(override.prefLevel ?? opts.global.prefLevel) || opts.global.prefLevel)),
      source: override.source || 'formation.options.bcuCatUnitLevels.pref-level',
      metadata
    },
    hitKey: hit.key,
    mode: 'per-character-pref-level'
  };
}

function withBcuCatUnitLevel(scene, unitDef, opts = getFormationLevelOptions()) {
  if (!unitDef || unitDef.statsType !== 'unit') return unitDef;
  if (!opts.global.enabled) return { ...unitDef, bcuUnitLevel: null, bcuUnitLevelDebug: { enabled: false, source: opts.global.source } };
  const metadata = levelMetadataFor(scene, unitDef) || {};
  const { request, hitKey, mode } = buildCatLevelRequest(unitDef, metadata, opts);
  const resolved = resolveBcuUnitLevelConfig({ requested: request, metadata, source: request.source });
  return {
    ...unitDef,
    bcuUnitLevelMeta: metadata,
    bcuUnitLevel: request,
    bcuUnitLevelDebug: {
      source: 'BattleSceneBcuUnitLevelPatch.withBcuCatUnitLevel',
      bcuReference: 'BCU Unit.getPrefLvs -> EForm.getEntity -> UnitLevel.getMult(level+plus)',
      optionMode: mode,
      optionKey: hitKey,
      requested: request,
      resolved,
      metadata
    }
  };
}

function dogMagnificationFor(unitDef, opts) {
  const hit = firstOptionHit(opts.dogMagnifications, unitDef);
  const raw = hit.value;
  if (!raw || raw.enabled === false) return { percent: DOG_DEFAULT_MAGNIFICATION_PERCENT, hitKey: null, source: 'default-100-percent' };
  const percent = Math.max(1, Math.min(999900, Math.trunc(Number(raw.percent ?? raw.magnification ?? DOG_DEFAULT_MAGNIFICATION_PERCENT) || DOG_DEFAULT_MAGNIFICATION_PERCENT)));
  return { percent, hitKey: hit.key, source: raw.source || 'formation.options.dogUnitMagnifications' };
}

function isPlayableDog(unitDef = {}) {
  return unitDef.statsType === 'enemy' && (unitDef.faction === 'dog' || unitDef.sourceRoster === 'dogPlayer' || unitDef.sourceKind === 'enemy' && unitDef.productionSide === 'player');
}

function withDogUnitMagnification(unitDef, opts = getFormationLevelOptions()) {
  if (!unitDef || !isPlayableDog(unitDef)) return unitDef;
  const mag = dogMagnificationFor(unitDef, opts);
  const debug = {
    source: 'BattleSceneBcuUnitLevelPatch.withDogUnitMagnification',
    optionKey: mag.hitKey,
    percent: mag.percent,
    defaultPercent: DOG_DEFAULT_MAGNIFICATION_PERCENT,
    optionSource: mag.source,
    bcuReference: 'Enemy magnification percent is applied through ActorStatsModel.applyStageEnemyMagnification-compatible hp/attack percent fields'
  };
  if (mag.percent === DOG_DEFAULT_MAGNIFICATION_PERCENT && !mag.hitKey) {
    return { ...unitDef, dogUnitMagnification: debug };
  }
  return {
    ...unitDef,
    stageStatModifiers: {
      ...(unitDef.stageStatModifiers || {}),
      source: mag.source,
      rowIndex: null,
      rawEnemyId: null,
      sourceEnemyId: unitDef.statsId ?? null,
      enemyId: unitDef.statsId ?? null,
      magnification: mag.percent,
      hpMagnification: mag.percent,
      attackMagnification: mag.percent
    },
    magnification: mag.percent,
    hpMagnification: mag.percent,
    attackMagnification: mag.percent,
    dogUnitMagnification: debug
  };
}

function withFormationCombatTuning(scene, unitDef) {
  const opts = getFormationLevelOptions();
  return withDogUnitMagnification(withBcuCatUnitLevel(scene, unitDef, opts), opts);
}

export function installBattleSceneBcuUnitLevelPatch() {
  const proto = BattleScene?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  const originalResolveProductionCharacter = proto.resolveProductionCharacter;
  if (typeof originalResolveProductionCharacter === 'function') {
    proto.resolveProductionCharacter = function resolveProductionCharacterWithFormationCombatTuning(characterId, index = 0) {
      return withFormationCombatTuning(this, originalResolveProductionCharacter.call(this, characterId, index));
    };
  }

  const originalResolveProductionUnit = proto.resolveProductionUnit;
  if (typeof originalResolveProductionUnit === 'function') {
    proto.resolveProductionUnit = function resolveProductionUnitWithFormationCombatTuning(lineupEntry, index = 0) {
      return withFormationCombatTuning(this, originalResolveProductionUnit.call(this, lineupEntry, index));
    };
  }
}

installBattleSceneBcuUnitLevelPatch();
