import { BattleScene } from './BattleScene.js';
import { applyBcuWaveInvalidValue, resolveBcuWaveInvalid, spawnBcuWaveInvalidIcon } from './bcu-runtime/BcuWaveInvalidRuntime.js';

const PATCH_FLAG = Symbol.for('wanko-battle.bcu-wave-invalid-apply.v1');

function isProjectileMeta(meta = {}) {
  return !!(meta?.bcuWave || meta?.bcuSurge || meta?.bcuBlast);
}

function resultForFullInvalid(scene, attacker, target, targetType, event, meta, invalid) {
  spawnBcuWaveInvalidIcon(scene, target, invalid, {
    attacker: attacker?.instanceId || attacker?.label || null,
    targetType,
    hitIndex: meta?.hitIndex ?? event?.hitIndex ?? null,
    attackEventKey: meta?.key ?? null,
    phase: 'full-invalid'
  });
  const result = {
    accepted: false,
    reason: `bcu-${invalid.field}-full-invalid`,
    bcuWaveInvalid: invalid,
    damageCalculation: null,
    source: 'BattleSceneBcuWaveInvalidApplyPatch.full-invalid',
    bcuReference: invalid.bcuReference
  };
  scene?.pushEvent?.({
    type: 'bcuWaveInvalidFull',
    attacker: attacker?.instanceId || attacker?.label || null,
    target: target?.instanceId || target?.label || null,
    kind: invalid.kind,
    field: invalid.field,
    percent: invalid.percent,
    hitIndex: meta?.hitIndex ?? event?.hitIndex ?? null,
    attackEventKey: meta?.key ?? null,
    bcuReference: invalid.bcuReference
  });
  target && (target.lastBcuWaveInvalidDamageDebug = result);
  return result;
}

function wrapTakeDamageForPartial(scene, target, invalid, meta = {}) {
  const original = target?.takeDamage;
  if (typeof original !== 'function' || !invalid?.partial) return null;
  let lastAdjustment = null;
  target.takeDamage = function takeDamageWithBcuWaveInvalid(damage, info = {}) {
    const adjusted = applyBcuWaveInvalidValue(damage, invalid);
    lastAdjustment = {
      source: 'BattleSceneBcuWaveInvalidApplyPatch.partial-invalid',
      before: adjusted.before,
      after: adjusted.after,
      invalid,
      meta,
      bcuReference: invalid.bcuReference
    };
    spawnBcuWaveInvalidIcon(scene, target, invalid, {
      beforeDamage: adjusted.before,
      afterDamage: adjusted.after,
      phase: 'partial-invalid',
      hitIndex: meta?.hitIndex ?? null,
      attackEventKey: meta?.key ?? null
    });
    return original.call(this, adjusted.after, {
      ...info,
      bcuWaveInvalid: lastAdjustment,
      finalDamageBeforeBcuWaveInvalid: adjusted.before,
      finalDamageAfterBcuWaveInvalid: adjusted.after
    });
  };
  return {
    restore() { target.takeDamage = original; },
    getLastAdjustment() { return lastAdjustment; }
  };
}

export function installBattleSceneBcuWaveInvalidApplyPatch() {
  const proto = BattleScene?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  const originalQueueAttackDamage = proto.queueAttackDamage;
  if (typeof originalQueueAttackDamage !== 'function') throw new Error('BattleScene.queueAttackDamage missing for BCU wave invalid apply patch');

  proto.queueAttackDamage = function queueAttackDamageWithBcuWaveInvalid(attacker, target, targetType, event, meta = {}) {
    if (!isProjectileMeta(meta) || targetType !== 'actor') {
      return originalQueueAttackDamage.call(this, attacker, target, targetType, event, meta);
    }

    const invalid = resolveBcuWaveInvalid({ target, targetType, meta });
    if (!invalid.applies) {
      const result = originalQueueAttackDamage.call(this, attacker, target, targetType, event, meta);
      if (target) target.lastBcuWaveInvalidDamageDebug = { source: 'BattleSceneBcuWaveInvalidApplyPatch.no-invalid', invalid, resultAccepted: result?.accepted === true };
      return result;
    }

    if (invalid.full) return resultForFullInvalid(this, attacker, target, targetType, event, meta, invalid);

    const wrapper = wrapTakeDamageForPartial(this, target, invalid, meta);
    try {
      const result = originalQueueAttackDamage.call(this, attacker, target, targetType, event, meta);
      const adjustment = wrapper?.getLastAdjustment?.() || null;
      if (adjustment) {
        result.bcuWaveInvalid = adjustment;
        result.finalDamageBeforeBcuWaveInvalid = adjustment.before;
        result.finalDamageAfterBcuWaveInvalid = adjustment.after;
        target.lastBcuWaveInvalidDamageDebug = { ...adjustment, resultAccepted: result?.accepted === true };
        this.pushEvent?.({
          type: 'bcuWaveInvalidPartialDamage',
          attacker: attacker?.instanceId || attacker?.label || null,
          target: target?.instanceId || target?.label || null,
          kind: invalid.kind,
          field: invalid.field,
          percent: invalid.percent,
          before: adjustment.before,
          after: adjustment.after,
          resultAccepted: result?.accepted === true,
          hitIndex: meta?.hitIndex ?? event?.hitIndex ?? null,
          attackEventKey: meta?.key ?? null,
          bcuReference: invalid.bcuReference
        });
      }
      return result;
    } finally {
      wrapper?.restore?.();
    }
  };
}

installBattleSceneBcuWaveInvalidApplyPatch();
