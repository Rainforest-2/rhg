import { BattleScene } from './BattleScene.js';
import { FormationStore } from './FormationStore.js';
import { BCU_DEFAULT_PREF_LEVEL, resolveBcuUnitLevelConfig } from './bcu-runtime/BcuUnitLevelRuntime.js';

const PATCH_FLAG = Symbol.for('wanko-battle.scene-bcu-unit-level-production.v1');

function getFormationLevelOption() {
  const formation = FormationStore.load();
  const opt = formation?.options?.bcuCatUnitLevel || {};
  return {
    enabled: opt.enabled !== false,
    prefLevel: Math.max(1, Math.trunc(Number(opt.prefLevel ?? BCU_DEFAULT_PREF_LEVEL) || BCU_DEFAULT_PREF_LEVEL)),
    source: opt.source || 'formation.options.bcuCatUnitLevel'
  };
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

function withBcuCatUnitLevel(scene, unitDef) {
  if (!unitDef || unitDef.statsType !== 'unit') return unitDef;
  const opt = getFormationLevelOption();
  if (!opt.enabled) return { ...unitDef, bcuUnitLevel: null, bcuUnitLevelDebug: { enabled: false, source: opt.source } };
  const metadata = levelMetadataFor(scene, unitDef) || {};
  const requested = { prefLevel: opt.prefLevel, source: opt.source, metadata };
  const resolved = resolveBcuUnitLevelConfig({ requested, metadata, source: opt.source });
  return {
    ...unitDef,
    bcuUnitLevelMeta: metadata,
    bcuUnitLevel: requested,
    bcuUnitLevelDebug: {
      source: 'BattleSceneBcuUnitLevelPatch.withBcuCatUnitLevel',
      bcuReference: 'BCU Unit.getPrefLvs -> EForm.getEntity -> UnitLevel.getMult(level+plus)',
      requested: opt,
      resolved,
      metadata
    }
  };
}

export function installBattleSceneBcuUnitLevelPatch() {
  const proto = BattleScene?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  const originalResolveProductionCharacter = proto.resolveProductionCharacter;
  if (typeof originalResolveProductionCharacter === 'function') {
    proto.resolveProductionCharacter = function resolveProductionCharacterWithBcuUnitLevel(characterId, index = 0) {
      return withBcuCatUnitLevel(this, originalResolveProductionCharacter.call(this, characterId, index));
    };
  }

  const originalResolveProductionUnit = proto.resolveProductionUnit;
  if (typeof originalResolveProductionUnit === 'function') {
    proto.resolveProductionUnit = function resolveProductionUnitWithBcuUnitLevel(lineupEntry, index = 0) {
      return withBcuCatUnitLevel(this, originalResolveProductionUnit.call(this, lineupEntry, index));
    };
  }
}

installBattleSceneBcuUnitLevelPatch();
