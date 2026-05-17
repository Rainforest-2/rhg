import { BattleActor } from './BattleActor.js';
import { parseAnim } from '../bcu/BcuAnimParser.js';
import { getBcuAssetDatabase } from '../bcu/BcuAssetDatabase.js';

const PATCH_FLAG = Symbol.for('wanko-battle.bcu-kb-unit-animation.v3');
const BCU_HB_ANIM_TYPES = new Set(['INT_KB', 'INT_HB', 'INT_ASS']);
const BCU_WALK_KB_TYPES = new Set(['INT_SW']);
const BCU_HB_ANIM_ID = 'bcu-u-type-hb';

function hasAnim(actor, animId) {
  return !!animId && !!actor?.animations?.get?.(animId);
}

function getActorEntry(actor) {
  try {
    const provider = getBcuAssetDatabase()?.semanticProvider;
    const key = actor?.semanticKey || actor?.assetDef?.semanticKey || null;
    if (!provider || !key) return null;
    const entry = provider.getActorEntry(key);
    return entry?.bundleRef ? { provider, entry, key } : null;
  } catch {
    return null;
  }
}

async function loadBcuHbAnimation(actor) {
  if (!actor || hasAnim(actor, BCU_HB_ANIM_ID)) return actor?.animations?.get?.(BCU_HB_ANIM_ID) || null;
  const found = getActorEntry(actor);
  if (!found) return null;
  const { provider, entry, key } = found;
  const text = await provider.readTextByBundleRef(entry.bundleRef, 'kb.maanim');
  const anim = parseAnim(text);
  actor.animations.set(BCU_HB_ANIM_ID, anim);
  actor.animations.set('anim03', anim);
  if (actor.knockbackAnimId) actor.animations.set(actor.knockbackAnimId, anim);
  actor.knockbackAnimId = BCU_HB_ANIM_ID;
  actor.lastBcuHbAnimLoadDebug = {
    source: 'BcuKnockbackAnimationPatch.loadBcuHbAnimation',
    bcuReference: 'AnimU.TYPE4/TYPE5/TYPE7 maps UType.HB to the fourth unit animation; semantic actor bundle stores it as kb.maanim.',
    semanticKey: key,
    bundlePath: entry.bundleRef.bundlePath || null,
    internalPath: 'kb.maanim',
    animId: BCU_HB_ANIM_ID,
    maxFrame: anim.maxFrame ?? null,
    trackCount: Array.isArray(anim.tracks) ? anim.tracks.length : null
  };
  return anim;
}

function resolveLoadedHbAnimId(actor) {
  if (hasAnim(actor, BCU_HB_ANIM_ID)) return BCU_HB_ANIM_ID;
  if (hasAnim(actor, actor.knockbackAnimId)) return actor.knockbackAnimId;
  if (hasAnim(actor, 'anim03')) return 'anim03';
  return null;
}

function desiredKbAnim(actor, bcuType) {
  const t = String(bcuType || '');
  if (BCU_HB_ANIM_TYPES.has(t)) return { animId: resolveLoadedHbAnimId(actor), role: 'knockback', bcuAnim: 'UType.HB' };
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
    hasBcuHbAnim: hasAnim(actor, BCU_HB_ANIM_ID),
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

function ensureHbAnimationAsync(actor, bcuType) {
  if (!actor || !BCU_HB_ANIM_TYPES.has(String(bcuType || ''))) return;
  if (hasAnim(actor, BCU_HB_ANIM_ID)) return;
  if (actor.__bcuHbAnimLoadPromise) return;
  actor.__bcuHbAnimLoadPromise = loadBcuHbAnimation(actor).then((anim) => {
    actor.__bcuHbAnimLoadPromise = null;
    if (anim && actor.state === 'knockback') {
      forceKnockbackAnimation(actor, bcuType, 'async-bcu-hb-loaded-during-kb', { restart: true });
    }
  }).catch((error) => {
    actor.__bcuHbAnimLoadPromise = null;
    actor.lastBcuHbAnimLoadDebug = {
      source: 'BcuKnockbackAnimationPatch.loadBcuHbAnimation',
      loaded: false,
      message: error?.message || String(error),
      semanticKey: actor.semanticKey || actor.assetDef?.semanticKey || null
    };
  });
}

function ensureDuringKnockback(actor, reason) {
  if (!actor || actor.state !== 'knockback') return false;
  const bcuType = actor.kbBcuType || actor.bcuKbType || null;
  ensureHbAnimationAsync(actor, bcuType);
  return forceKnockbackAnimation(actor, bcuType, reason, { restart: false });
}

if (!BattleActor.prototype[PATCH_FLAG]) {
  BattleActor.prototype[PATCH_FLAG] = true;
  const previousStartKnockback = BattleActor.prototype.startKnockback;
  BattleActor.prototype.startKnockback = function startKnockbackWithBcuUnitKbAnimation(knockback = null) {
    const result = previousStartKnockback.call(this, knockback);
    const bcuType = this.kbBcuType || this.bcuKbType || knockback?.bcuType || null;
    ensureHbAnimationAsync(this, bcuType);
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
    bcuHbAnimId: BCU_HB_ANIM_ID,
    note: 'KB lazy-loads semantic actor bundle kb.maanim and uses it as BCU UType.HB instead of trusting anim03 to already be loaded.'
  };
}
