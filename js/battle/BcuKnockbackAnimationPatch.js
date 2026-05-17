import { BattleActor } from './BattleActor.js';

const PATCH_FLAG = Symbol.for('wanko-battle.bcu-kb-unit-animation.v1');
const NON_WARP_KB_TYPES = new Set(['INT_KB', 'INT_HB', 'INT_SW', 'INT_ASS']);

function hasAnim(actor, animId) {
  return !!animId && !!actor?.animations?.get?.(animId);
}

function forceKnockbackAnimation(actor, bcuType, reason = 'bcu-kb') {
  if (!actor || !NON_WARP_KB_TYPES.has(String(bcuType || ''))) return false;
  const animId = actor.knockbackAnimId;
  const ok = hasAnim(actor, animId);
  actor.lastBcuKnockbackAnimationDebug = {
    source: 'BcuKnockbackAnimationPatch.forceKnockbackAnimation',
    bcuReference: 'BCU AnimManager.kbAnim sets unit HB/knockback animation and then paraTo(back) for KBEff types',
    bcuType,
    requestedAnimId: animId || null,
    previousAnimId: actor.currentAnimId || null,
    previousRole: actor.activeAnimRole || null,
    hasKnockbackAnim: ok,
    reason,
    kbeffEnabledBefore: !!actor.kbeffEnabled,
    kbeffType: actor.kbeffType || null
  };
  if (!ok) return false;
  actor.setAnimation(animId, 'knockback', true);
  actor.applyCurrentAnimationFrame?.();
  actor.lastBcuKnockbackAnimationDebug.currentAnimId = actor.currentAnimId;
  actor.lastBcuKnockbackAnimationDebug.activeAnimRole = actor.activeAnimRole;
  actor.lastBcuKnockbackAnimationDebug.kbeffEnabledAfter = !!actor.kbeffEnabled;
  return true;
}

if (!BattleActor.prototype[PATCH_FLAG]) {
  BattleActor.prototype[PATCH_FLAG] = true;
  const previousStartKnockback = BattleActor.prototype.startKnockback;
  BattleActor.prototype.startKnockback = function startKnockbackWithBcuUnitKbAnimation(knockback = null) {
    const result = previousStartKnockback.call(this, knockback);
    const bcuType = this.kbBcuType || this.bcuKbType || knockback?.bcuType || null;
    forceKnockbackAnimation(this, bcuType, knockback?.reason || this.knockbackReason || 'bcu-kb');
    return result;
  };
  globalThis.__BCU_KNOCKBACK_ANIMATION_PATCH_DEBUG__ = {
    installed: true,
    source: 'BcuKnockbackAnimationPatch',
    nonWarpKbTypes: [...NON_WARP_KB_TYPES],
    note: 'Loaded after KBEff paraTo patch so the actor keeps KBEff parent transform while using unit knockback/HB animation.'
  };
}
