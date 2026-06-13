import { BCU_ABI, BCU_TRAITS } from '../BcuCombatModel.js';
import { getOrbStatusResistance } from './BcuOrbModifier.js';

const SUPER_SAGE_RESIST = 70;
const SUPER_SAGE_HUNTER_RESIST = 0.7;
const SUPER_SAGE_RESIST_TYPES = new Set(['IMUWEAK', 'IMUSTOP', 'IMUSLOW', 'IMUCURSE', 'IMUKB', 'IMUWARP', 'IMUDELAY']);

function clampPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.trunc(n)));
}

function getCombatModel(entity) {
  return entity?.bcuCombatModel || entity?.rawStats?.bcuCombatModel || entity?.stats?.bcuCombatModel || null;
}

function getAbi(entity) {
  const cm = getCombatModel(entity);
  return Number(cm?.ability?.abi ?? entity?.bcuAbi ?? entity?.rawStats?.bcuAbi ?? entity?.abilityModel?.bcuAbi ?? 0) || 0;
}

function getTraitFlags(entity) {
  const flags = entity?.traitFlags || entity?.abilityModel?.traits?.flags || entity?.rawStats?.traitFlags || entity?.rawStats?.abilityModel?.traits?.flags || getCombatModel(entity)?.traits?.flags || {};
  if (flags && typeof flags === 'object') return flags;
  return {};
}

function getAttackTraitList(attack = null, attacker = null) {
  const traits = attack?.traits || attack?.trait || attack?.targetTraits || attack?.event?.traits || attacker?.traits || attacker?.rawStats?.traits || [];
  if (Array.isArray(traits)) return traits;
  if (traits && typeof traits === 'object') return Object.keys(traits).filter((key) => traits[key]);
  return [];
}

function getTalentOrbResistance(entity, procName) {
  const sources = [
    entity?.bcuTalentOrbResistance,
    entity?.talentOrbResistance,
    entity?.rawStats?.bcuTalentOrbResistance,
    entity?.rawStats?.talentOrbResistance
  ];
  for (const source of sources) {
    if (!source || typeof source !== 'object') continue;
    const value = source[procName] ?? source[String(procName || '').toLowerCase()];
    const n = Number(value);
    if (Number.isFinite(n)) return clampPercent(n);
  }
  return null;
}

function getEquippedOrbs(entity) {
  const orbs = entity?.bcuEquippedOrbs || entity?.stats?.bcuEquippedOrbs || entity?.rawStats?.bcuEquippedOrbs || getCombatModel(entity)?.bcuEquippedOrbs;
  return Array.isArray(orbs) ? orbs : [];
}

// Combo-granted wave/surge full immunity (EUnit.processComboAbilities) attached to
// stats by BcuComboStatModifier. Only IMUWAVE/IMUVOLC are combo-grantable.
function getComboImmunity(entity, procName) {
  const src = entity?.bcuComboImmunities || entity?.stats?.bcuComboImmunities || entity?.rawStats?.bcuComboImmunities || null;
  if (!src || typeof src !== 'object') return 0;
  return clampPercent(src[procName] ?? 0);
}

function hasTrait(entity, trait) {
  return getTraitFlags(entity)?.[trait] === true || (Array.isArray(entity?.traits) && entity.traits.includes(trait));
}

function sideKind(entity) {
  const cm = getCombatModel(entity);
  if (cm?.kind === 'enemy') return 'enemy';
  if (cm?.kind === 'unit') return 'unit';
  if (entity?.side === 'dog-player') return 'unit';
  if (entity?.side) return 'enemy';
  return 'unknown';
}

export function getBcuResistValue({ target, attacker = null, attack = null, procName, procResist } = {}) {
  const side = target?.side || null;
  const kind = sideKind(target);
  const csvResist = clampPercent(procResist ?? target?.bcuProcResist?.[procName] ?? 0);
  // Equipped resist orbs add to the same IMU*.mult field in BCU
  // (EUnit.processAbilityOrbs), so fold them into the field immunity additively,
  // capped at 100 — identical to min(100, proc.IMU.mult + ORB_RESIST_MULT[grade]).
  const orbResist = getOrbStatusResistance(getEquippedOrbs(target), procName);
  // Combo wave/surge immunity is a full (100) grant folded into the same field.
  const comboImmunity = getComboImmunity(target, procName);
  const resist = clampPercent(csvResist + orbResist + comboImmunity);
  const fieldFactor = Math.max(0, 1 - resist / 100);
  let factor = fieldFactor;
  const notes = [];
  const unsupportedSources = [];
  // The pre-computed talent/PCoin resistance map (bcuTalentOrbResistance) has no
  // proven loader yet, so it stays gated as unsupported. The equipped-orb path
  // above is the proven, source-backed resistance contribution.
  const talentOrbValue = getTalentOrbResistance(target, procName);
  if (talentOrbValue !== null) unsupportedSources.push('talent-orb-resistance');
  if (orbResist > 0) notes.push('orb-equipment-status-resist-applied');
  if (comboImmunity > 0) notes.push('combo-wave-surge-immunity-applied');

  const breakdown = {
    fieldImmunity: {
      source: 'target getProc().IMU*.mult / combatModel.immunity proc field',
      value: csvResist >= 100 ? csvResist : 0,
      factor: csvResist >= 100 ? Math.max(0, 1 - csvResist / 100) : 1
    },
    partialResistance: {
      source: 'target getProc().IMU*.mult / combatModel.immunity proc field',
      value: csvResist > 0 && csvResist < 100 ? csvResist : 0,
      factor: csvResist > 0 && csvResist < 100 ? Math.max(0, 1 - csvResist / 100) : 1
    },
    orbEquipmentResistance: {
      source: 'EUnit.processAbilityOrbs ORB_*_RESIST -> proc.IMU*.mult += ORB_RESIST_MULT[grade] (cap 100)',
      value: orbResist,
      factor: orbResist > 0 ? Math.max(0, 1 - resist / 100) : 1,
      implemented: true
    },
    comboImmunity: {
      source: 'EUnit.processComboAbilities C_IMUWAVE/C_IMUVOLC -> proc.IMU*.mult = 100',
      value: comboImmunity,
      factor: comboImmunity > 0 ? Math.max(0, 1 - resist / 100) : 1,
      implemented: true
    },
    sageResistance: {
      source: 'Data.SUPER_SAGE_RESIST / Data.SUPER_SAGE_HUNTER_RESIST',
      value: 0,
      factor: 1,
      bypassedBySkill: false
    },
    talentOrbResistance: {
      source: 'future combo/orb/talent resistance holder',
      value: talentOrbValue,
      factor: 1,
      implemented: false
    }
  };

  if (SUPER_SAGE_RESIST_TYPES.has(String(procName || ''))) {
    const attackerHasSkill = (getAbi(attacker || attack?.attacker) & BCU_ABI.AB_SKILL) !== 0;
    if (kind === 'enemy' && hasTrait(target, BCU_TRAITS.sage)) {
      if (attackerHasSkill) {
        breakdown.sageResistance.bypassedBySkill = true;
        notes.push('enemy-sage-status-resist-bypassed-by-AB_SKILL');
      } else {
        const sageFactor = Math.max(0, 100 - SUPER_SAGE_RESIST) / 100;
        factor *= sageFactor;
        breakdown.sageResistance.value = SUPER_SAGE_RESIST;
        breakdown.sageResistance.factor = sageFactor;
        notes.push('enemy-sage-status-resist-applied');
      }
    }
    if (kind === 'unit' && getAttackTraitList(attack, attacker).includes(BCU_TRAITS.sage) && (getAbi(target) & BCU_ABI.AB_SKILL) !== 0) {
      const sageFactor = 1 - SUPER_SAGE_HUNTER_RESIST;
      factor *= sageFactor;
      breakdown.sageResistance.value = SUPER_SAGE_HUNTER_RESIST * 100;
      breakdown.sageResistance.factor = sageFactor;
      notes.push('unit-sage-hunter-status-resist-applied');
    }
  }

  const effectiveBlock = clampPercent((1 - factor) * 100);
  return {
    side,
    kind,
    procName,
    resist,
    factor,
    effectiveBlock,
    implemented: true,
    implementationScope: 'supported-field-immunity-partial-resistance-and-sage-resistance-only',
    breakdown,
    unsupportedSources,
    notes,
    bcuReference: side === 'cat-enemy' ? 'EEnemy.getResistValue' : 'EUnit.getResistValue'
  };
}

export function resolveBcuProcResistance({ target, attacker = null, item = null, procName = null, procResist = null } = {}) {
  const value = getBcuResistValue({
    target,
    attacker,
    attack: item?.attack || item?.context?.attack || null,
    procName,
    procResist
  });
  return {
    ...value,
    full: value.factor <= 0,
    partial: value.factor > 0 && value.factor < 1,
    mult: value.effectiveBlock
  };
}

export function applyBcuProcDuration({ rawTime = 0, fruit = 0, attack, resist = 0 } = {}) {
  const timeMult = attack?.isCannon ? 1 : (1 + Number(fruit || 0) * 0.2 / 3);
  const reduced = Math.max(0, Number(rawTime || 0) * timeMult * Math.max(0, 100 - clampPercent(resist)) / 100);
  return Math.trunc(reduced);
}

export function applyBcuProcDistance({ rawDistance = 0, fruit = 0, resist = 0 } = {}) {
  const distMult = 1 + Number(fruit || 0) * 0.1;
  return Number(rawDistance || 0) * distMult * Math.max(0, 100 - clampPercent(resist)) / 100;
}

export function applyBcuProcPercent({ rawPercent = 0, resist = 0 } = {}) {
  return Number(rawPercent || 0) * Math.max(0, 100 - clampPercent(resist)) / 100;
}
