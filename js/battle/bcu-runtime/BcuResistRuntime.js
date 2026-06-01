import { BCU_ABI, BCU_TRAITS } from '../BcuCombatModel.js';

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
  const resist = clampPercent(procResist ?? target?.bcuProcResist?.[procName] ?? 0);
  let factor = Math.max(0, 1 - resist / 100);
  const notes = [];

  if (SUPER_SAGE_RESIST_TYPES.has(String(procName || ''))) {
    if (kind === 'enemy' && hasTrait(target, BCU_TRAITS.sage) && (getAbi(attacker || attack?.attacker) & BCU_ABI.AB_SKILL) === 0) {
      factor *= Math.max(0, 100 - SUPER_SAGE_RESIST) / 100;
      notes.push('enemy-sage-status-resist-applied');
    }
    if (kind === 'unit' && getAttackTraitList(attack, attacker).includes(BCU_TRAITS.sage) && (getAbi(target) & BCU_ABI.AB_SKILL) !== 0) {
      factor *= 1 - SUPER_SAGE_HUNTER_RESIST;
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
