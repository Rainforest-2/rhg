import { DamageAbilityResolver } from './DamageAbilityResolver.js';
import { BCU_ABI } from './BcuCombatModel.js';

const PATCH_FLAG = Symbol.for('wanko-battle.damage-metal-abi-patch.v1');

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
  return entity?.traitFlags || entity?.abilityModel?.traits?.flags || entity?.rawStats?.traitFlags || entity?.rawStats?.abilityModel?.traits?.flags || {};
}

function attackerProc(entity) {
  return combatModel(entity)?.proc || entity?.bcuProc || entity?.rawStats?.bcuProc || entity?.abilityModel?.bcuProc || {};
}

function bcuInt(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function roll(prob, rng = Math.random) {
  const p = Number(prob) || 0;
  if (p <= 0) return false;
  if (p >= 100) return true;
  return rng() * 100 < p;
}

function patchMetalAbiResult(result, { attacker, target, targetType, context }) {
  if (!result || targetType !== 'actor') return result;
  const flags = traitFlags(target);
  if (flags?.metal === true) return result;
  if (!hasAbi(target, BCU_ABI.AB_METALIC)) return result;

  const proc = attackerProc(attacker);
  const rng = typeof context?.random === 'function' ? context.random : Math.random;
  const criticalProb = Number(proc?.critical?.prob || 0);
  const metalKillerMult = Number(proc?.metalKiller?.mult || 0);
  const before = Number.isFinite(result.finalDamage) ? result.finalDamage : result.baseDamage || 0;
  let ans = before;
  const details = [];

  if (result?.applied?.critical === true) {
    details.push({ key: 'metalAbi', before, after: ans, note: 'target has AB_METALIC; original non-metal critical result kept' });
  } else {
    const crit = roll(criticalProb, rng);
    if (crit) {
      ans = bcuInt(before * 0.01 * 200);
      result.applied.critical = true;
      result.modifiers.critical = before === 0 ? 1 : ans / before;
      details.push({ key: 'critical', before, after: ans, note: 'BCU critCalc AB_METALIC target critical CRIT.mult=200', prob: criticalProb });
    } else {
      ans = before > 0 ? 1 : 0;
      result.applied.metal = true;
      result.modifiers.metal = before === 0 ? 1 : ans / before;
      details.push({ key: 'metal', before, after: ans, note: 'BCU critCalc AB_METALIC non-critical damage to 1' });
    }
  }

  if (metalKillerMult > 0) {
    const mkBefore = ans;
    const targetHealth = Math.max(0, Number(target?.hp ?? target?.health ?? 0));
    ans += bcuInt(Math.max(targetHealth * metalKillerMult / 100, 1));
    result.applied.metalKiller = true;
    result.modifiers.metalKiller = mkBefore === 0 ? 1 : ans / mkBefore;
    details.push({ key: 'metalKiller', before: mkBefore, after: ans, note: 'BCU Entity.damaged METALKILL add health-percent damage on AB_METALIC target', targetHealth, mult: metalKillerMult });
  }

  result.finalDamage = Math.max(0, bcuInt(ans));
  result.multiplier = result.baseDamage === 0 ? 1 : result.finalDamage / result.baseDamage;
  result.notes = Array.isArray(result.notes) ? result.notes : [];
  result.notes.push('BCU AB_METALIC target handled by DamageAbilityResolverMetalAbiPatch');
  result.appliedDetails = Array.isArray(result.appliedDetails) ? result.appliedDetails : [];
  result.appliedDetails.push(...details);
  result.debug = { ...(result.debug || {}), targetIsMetalByAbi: true, metalAbi: abi(target), metalAbiPatch: true };
  return result;
}

export function installDamageAbilityResolverMetalAbiPatch() {
  if (!DamageAbilityResolver || DamageAbilityResolver[PATCH_FLAG]) return;
  DamageAbilityResolver[PATCH_FLAG] = true;
  const originalResolve = DamageAbilityResolver.resolve;
  if (typeof originalResolve !== 'function') throw new Error('DamageAbilityResolver.resolve is missing; cannot install AB_METALIC patch');
  DamageAbilityResolver.resolve = function resolveWithMetalAbi(args = {}) {
    const result = originalResolve.call(this, args);
    return patchMetalAbiResult(result, args);
  };
}

installDamageAbilityResolverMetalAbiPatch();
