import '../bcu/SemanticUnitIconNormalizePatch.js';
import '../ui/ProductionCardCatIconCanvasCropPatch.js';
import { BattleScene } from './BattleScene.js';

const PATCH_FLAG = Symbol.for('wanko-battle.unified-damage-debug-patch.v1');

function idOf(x) {
  return x?.instanceId || x?.label || x?.id || x?.side || null;
}

function compactDamage({ scene, attacker, target, targetType, event, meta, result, calc }) {
  const ability = calc?.abilityResolver || null;
  return {
    source: 'BattleUnifiedDamageDebugPatch.queueAttackDamage',
    timeMs: scene?.timeMs ?? null,
    logicFrame: scene?.logicFrame ?? null,
    actor: idOf(attacker),
    target: idOf(target),
    targetType,
    accepted: !!result?.accepted,
    blocked: !!result?.blocked,
    blockedBy: result?.blockedBy || null,
    reason: result?.reason || null,
    hitIndex: meta?.hitIndex ?? event?.hitIndex ?? null,
    attackEventKey: meta?.key || null,
    rawAbi: event?.rawAbi ?? null,
    abilityMappingStatus: event?.abilityMappingStatus || null,
    eventAbilities: event?.abilities || event?.ability?.semantic || null,
    baseDamage: calc?.baseDamage ?? null,
    rawBaseDamage: calc?.rawBaseDamage ?? null,
    finalDamage: calc?.finalDamage ?? null,
    multiplier: calc?.multiplier ?? null,
    applied: calc?.applied || null,
    notes: calc?.modifiers?.notes || calc?.notes || [],
    abilityResolver: ability ? {
      source: ability.source || null,
      enabled: !!ability.enabled,
      applied: ability.applied || {},
      appliedDetails: ability.appliedDetails || [],
      notes: ability.notes || [],
      debug: ability.debug || null
    } : null,
    proc: calc?.proc ? {
      applied: calc.proc.applied || [],
      pending: calc.proc.pending || [],
      skipped: calc.proc.skipped || [],
      debug: calc.proc.debug || null
    } : null,
    rng: scene?.lastBcuRandomDebug || null,
    result
  };
}

export function installBattleUnifiedDamageDebugPatch() {
  const proto = BattleScene?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  const originalQueueAttackDamage = proto.queueAttackDamage;
  if (typeof originalQueueAttackDamage !== 'function') {
    throw new Error('BattleScene.queueAttackDamage is missing; cannot install unified damage debug patch');
  }

  proto.queueAttackDamage = function queueAttackDamageWithUnifiedDebug(attacker, target, targetType, event, meta = {}) {
    const result = originalQueueAttackDamage.call(this, attacker, target, targetType, event, meta);
    const calc = targetType === 'actor'
      ? (target?.lastIncomingDamageCalculation || attacker?.lastDamageCalculation || null)
      : (attacker?.lastDamageCalculation || null);
    const report = compactDamage({ scene: this, attacker, target, targetType, event, meta, result, calc });
    this.__bcuLastDamageAny = report;
    if (targetType === 'actor') this.__bcuLastActorDamage = report;
    if (targetType === 'base') this.__bcuLastBaseDamage = report;
    return result;
  };
}

installBattleUnifiedDamageDebugPatch();
