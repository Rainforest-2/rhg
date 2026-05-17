import { BattleActor } from './BattleActor.js';

const PATCH_FLAG = Symbol.for('wanko-battle.bcu-kb-unit-animation.v2');
const BCU_HB_ANIM_TYPES = new Set(['INT_KB', 'INT_HB', 'INT_ASS']);
const BCU_WALK_KB_TYPES = new Set(['INT_SW']);

function hasAnim(actor, animId) {
  return !!animId && !!actor?.animations?.get?.(animId);
}

function desiredKbAnim(actor, bcuType) {
  const t = String(bcuType || '');
  if (BCU_HB_ANIM_TYPES.has(t)) return { animId: actor.knockbackAnimId, role: 'knockback', bcuAnim: 'UType.HB' };
  if (BCU_WALK_KB_TYPES.has(t)) return { animId: actor.moveAnimId || actor.idleAnimId || actor.currentAnimId, role: 'knockback-sw-walk', bcuAnim: 'UType.WALK' };
  return null;
}

function forceKnockbackAnimation(actor, bcuType, reason = 'bcu-kb', { restart = false } = {}) {
  if (!actor) return false;
  const desired = desiredKbAnim(actor, bcuType);
  if (!desired) return false;
  const ok = hasAnim(actor, desired.animId);
  actor.lastBcuKnockbackAnimationDebug = {
    source: 'BcuKnockbackAnimationPatch.forceKnockbackAnimation',
    bcuReference: 'BCU AnimManager.kbAnim: INT_KB/INT_HB/INT_ASS -> UType.HB; INT_SW -> UType.WALK; then back KBEff only for HB/SW/ASS',
    bcuType,
    bcuAnim: desired.bcuAnim,
    requestedAnimId: desired.animId || null,
    previousAnimId: actor.currentAnimId || null,
    previousRole: actor.activeAnimRole || null,
    hasRequestedAnim: ok,
    reason,
    restart,
    kbeffEnabledBefore: !!actor.kbeffEnabled,
    kbeffType: actor.kbeffType || null
  };
  if (!ok) return false;
  if (restart || actor.currentAnimId !== desired.animId || actor.activeAnimRole !== desired.role) {
    actor.setAnimation(desired.animId, desired.role, restart);
    actor.applyCurrentAnimationFrame?.();
  }
  actor.lastBcuKnockbackAnimationDebug.currentAnimId = actor.currentAnimId;
  actor.lastBcuKnockbackAnimationDebug.activeAnimRole = actor.activeAnimRole;
  actor.lastBcuKnockbackAnimationDebug.kbeffEnabledAfter = !!actor.kbeffEnabled;
  return true;
}

function ensureDuringKnockback(actor, reason) {
  if (!actor || actor.state !== 'knockback') return false;
  const bcuType = actor.kbBcuType || actor.bcuKbType || null;
  return forceKnockbackAnimation(actor, bcuType, reason, { restart: false });
}

if (!BattleActor.prototype[PATCH_FLAG]) {
  BattleActor.prototype[PATCH_FLAG] = true;
  const previousStartKnockback = BattleActor.prototype.startKnockback;
  BattleActor.prototype.startKnockback = function startKnockbackWithBcuUnitKbAnimation(knockback = null) {
    const result = previousStartKnockback.call(this, knockback);
    const bcuType = this.kbBcuType || this.bcuKbType || knockback?.bcuType || null;
    forceKnockbackAnimation(this, bcuType, knockback?.reason || this.knockbackReason || 'bcu-kb-start', { restart: true });
    return result;
  };

  const previousTick = BattleActor.prototype.tick;
  BattleActor.prototype.tick = function tickKeepingBcuKbAnimation(dt) {
    ensureDuringKnockback(this, 'before-tick-keep-bcu-kb-animation');
    const result = previousTick.call(this, dt);
    ensureDuringKnockback(this, 'after-tick-keep-bcu-kb-animation');
    return result;
  };

  const previousStepKnockbackFrame = BattleActor.prototype.stepKnockbackFrame;
  BattleActor.prototype.stepKnockbackFrame = function stepKnockbackFrameKeepingBcuKbAnimation(...args) {
    ensureDuringKnockback(this, 'before-step-keep-bcu-kb-animation');
    const result = previousStepKnockbackFrame.apply(this, args);
    ensureDuringKnockback(this, 'after-step-keep-bcu-kb-animation');
    return result;
  };

  globalThis.__BCU_KNOCKBACK_ANIMATION_PATCH_DEBUG__ = {
    installed: true,
    source: 'BcuKnockbackAnimationPatch',
    hbAnimTypes: [...BCU_HB_ANIM_TYPES],
    walkKbTypes: [...BCU_WALK_KB_TYPES],
    note: 'BCU kbAnim keeps INT_KB/INT_HB/INT_ASS on HB/knockback animation throughout KB. INT_SW uses WALK plus KBEff.SW per BCU.'
  };
}
