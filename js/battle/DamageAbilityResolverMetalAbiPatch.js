import { DamageAbilityResolver } from './DamageAbilityResolver.js';
import { BCU_ABI } from './BcuCombatModel.js';

const PATCH_FLAG = Symbol.for('wanko-battle.damage-metal-abi-patch.v2');

function combatModel(entity) {
  return entity?.bcuCombatModel || entity?.rawStats?.bcuCombatModel || entity?.stats?.bcuCombatModel || null;
}

function abi(entity) {
  return Number(combatModel(entity)?.ability?.abi ?? entity?.bcuAbi ?? entity?.rawStats?.bcuAbi ?? entity?.abilityModel?.bcuAbi ?? 0) || 0;
}

function hasAbi(entity, bit) {
  return (abi(entity) & bit) !== 0;
}

function traitFlags(entity) {
  const model = combatModel(entity);
  const source = entity?.traitFlags
    || entity?.abilityModel?.traits?.flags
    || entity?.rawStats?.traitFlags
    || entity?.rawStats?.abilityModel?.traits?.flags
    || model?.traits?.flags
    || {};
  return { ...source };
}

function entityKind(entity) {
  const kind = String(
    combatModel(entity)?.kind
      ?? entity?.rawStats?.source?.type
      ?? entity?.stats?.source?.type
      ?? entity?.statsType
      ?? ''
  ).toLowerCase();
  if (kind === 'unit' || kind === 'enemy') return kind;
  return null;
}

function normalizedTargetForMetalDamage(target) {
  if (!target || typeof target !== 'object') return { target, classification: 'not-an-actor' };
  const kind = entityKind(target);
  if (!kind) return { target, classification: 'unknown-kind-unchanged' };

  const flags = traitFlags(target);
  if (kind === 'unit') {
    if (hasAbi(target, BCU_ABI.AB_METALIC)) flags.metal = true;
    else delete flags.metal;
  }

  const normalized = Object.assign(
    Object.create(Object.getPrototypeOf(target)),
    target,
    { traitFlags: flags }
  );
  return {
    target: normalized,
    classification: kind === 'unit'
      ? (flags.metal === true ? 'unit-ab-metalic' : 'unit-non-metallic')
      : (flags.metal === true ? 'enemy-metal-trait' : 'enemy-non-metal')
  };
}

export function installDamageAbilityResolverMetalAbiPatch() {
  if (!DamageAbilityResolver || DamageAbilityResolver[PATCH_FLAG]) return;
  const originalResolve = DamageAbilityResolver.resolve;
  if (typeof originalResolve !== 'function') {
    throw new Error('DamageAbilityResolver.resolve is missing; cannot install AB_METALIC classification patch');
  }

  DamageAbilityResolver[PATCH_FLAG] = true;
  DamageAbilityResolver.resolve = function resolveWithMetalBodyClassification(args = {}) {
    if (args?.targetType !== 'actor') return originalResolve.call(this, args);
    const normalized = normalizedTargetForMetalDamage(args.target);
    const result = originalResolve.call(this, { ...args, target: normalized.target });
    if (result && typeof result === 'object') {
      result.debug = {
        ...(result.debug || {}),
        metalBodyClassification: normalized.classification,
        metalAbiPatch: true,
        criticalRollOwner: 'DamageAbilityResolver.resolve-single-roll'
      };
    }
    return result;
  };
}

installDamageAbilityResolverMetalAbiPatch();

export { normalizedTargetForMetalDamage };
