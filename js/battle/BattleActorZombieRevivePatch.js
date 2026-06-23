import { BattleActor } from './BattleActor.js';
import { BattleScene } from './BattleScene.js';
import { BattleSceneRenderer } from './BattleSceneRenderer.js';
import { BCU_BATTLE_TIMER_PERIOD_MS } from './BattleFrameClock.js';
import { initializeBcuZombieCorpse, updateBcuZombieCorpseWindow } from './bcu-runtime/BcuZombieCorpseRuntime.js';
import { clearBcuZombieCorpseVisual, getBcuZombieReviveAnimFrames, startBcuZombieCorpseVisual, tickBcuZombieCorpseVisual } from './bcu-runtime/BcuZombieReviveVisualRuntime.js';
import { playZombieKillerSe } from '../audio/BattleSoundEffects.js';

const PATCH_FLAG = Symbol.for('wanko-battle.actor-zombie-revive-patch.v1');
const RENDER_PATCH_FLAG = Symbol.for('wanko-battle.actor-zombie-revive-render-patch.v1');

function combatModel(actor) {
  return actor?.bcuCombatModel || actor?.rawStats?.bcuCombatModel || actor?.stats?.bcuCombatModel || null;
}

function procModel(actor) {
  return combatModel(actor)?.proc || {};
}

function traits(actor) {
  const t = combatModel(actor)?.traits?.flags || actor?.abilityModel?.traits?.flags || actor?.rawStats?.abilityModel?.traits?.flags || {};
  return t || {};
}

function isZombie(actor) {
  return !!traits(actor).zombie;
}

function reviveSpec(actor) {
  const rev = procModel(actor)?.revive || {};
  const count = Number(rev.count || 0);
  const time = Number(rev.time || 0);
  const health = Number(rev.health || 0);
  if (!Number.isFinite(count) || count === 0 || !Number.isFinite(time) || !Number.isFinite(health) || health <= 0) return null;
  return { count: Math.trunc(count), timeFrames: Math.max(0, Math.trunc(time)), healthPercent: Math.max(0, health), source: 'BcuCombatModel.proc.revive' };
}

function reviveType(rev = {}) {
  return rev?.type || {};
}

function entityPosBcu(entity) {
  const p = entity?.posBcu ?? entity?.x;
  return Number.isFinite(p) ? p : null;
}

function reviveSourceWarping(source) {
  const kbType = source?.kb?.kbType;
  if (kbType === 'warp' || kbType === 'INT_WARP') return true;
  if (source?.isWarping === true) return true;
  const warp = source?.bcuProcStatuses?.warp;
  return !!(warp && (warp.active === true || (Number.isFinite(warp.framesRemaining) && warp.framesRemaining > 0)));
}

// BCU Entity.java ZombX.updateRevive source/range filtering:
//   d0 = em.pos + REVIVE.dis_0; d1 = em.pos + REVIVE.dis_1;
//   if ((d0 - e.pos) * (d1 - e.pos) > 0) continue;          // e outside [d0,d1] window
//   if (em.kb.kbType == INT_WARP) continue;                 // warping reviver excluded
//   if (!conf.revive_non_zombie && e is zombie) continue;   // zombie target needs revive_non_zombie
// The range window is only enforced when the source carries proc-object dis_0/dis_1
// data and both positions are known; CSV/explicit sources without dis keep BCU's
// unbounded "always in range" behavior.
function extraReviveSourceEligible(source, actor) {
  if (reviveSourceWarping(source)) return false;
  const rev = source?.revive || procModel(source)?.revive || {};
  const type = reviveType(rev);
  const reviveNonZombie = type.reviveNonZombie === true || type.revive_non_zombie === true || source?.reviveNonZombie === true;
  if (!reviveNonZombie && isZombie(actor)) return false;
  const dis0 = Number(rev.dis0 ?? rev.dis_0 ?? source?.dis0 ?? source?.dis_0);
  const dis1 = Number(rev.dis1 ?? rev.dis_1 ?? source?.dis1 ?? source?.dis_1);
  if (Number.isFinite(dis0) && Number.isFinite(dis1)) {
    const ePos = entityPosBcu(actor);
    const emPos = entityPosBcu(source);
    if (Number.isFinite(ePos) && Number.isFinite(emPos)) {
      const d0 = emPos + dis0;
      const d1 = emPos + dis1;
      if ((d0 - ePos) * (d1 - ePos) > 0) return false;
    }
  }
  return true;
}

function explicitExtraReviveSources(actor) {
  const scene = actor?.scene || globalThis.__APP__?.scene || null;
  const direct = actor?.bcuZombieExtraReviveSources || actor?.rawStats?.bcuZombieExtraReviveSources || actor?.stats?.bcuZombieExtraReviveSources;
  const reviveOthersFlag = (source) => {
    const t = reviveType(procModel(source)?.revive);
    return t.reviveOthers === true || t.revive_others === true;
  };
  const candidates = Array.isArray(direct)
    ? direct
    : (scene?.actors || []).filter((source) => source && source !== actor && reviveOthersFlag(source));
  return candidates.filter((source) => extraReviveSourceEligible(source, actor));
}

function extraReviveSpecFromSource(source) {
  const rev = source?.revive || procModel(source)?.revive || {};
  const type = reviveType(rev);
  if (type.reviveOthers !== true && type.revive_others !== true && source?.reviveOthers !== true) return null;
  const count = Number(rev.count ?? source.count ?? 0);
  const time = Number(rev.time ?? source.timeFrames ?? 0);
  const health = Number(rev.health ?? source.healthPercent ?? 0);
  if (!Number.isFinite(count) || count === 0 || !Number.isFinite(time) || !Number.isFinite(health) || health <= 0) return null;
  return {
    count: Math.trunc(count),
    timeFrames: Math.max(0, Math.trunc(time)),
    healthPercent: Math.max(0, health),
    imuZkill: type.imuZkill === true || type.imu_zkill === true || source.imuZkill === true,
    reviveNonZombie: type.reviveNonZombie === true || type.revive_non_zombie === true || source.reviveNonZombie === true,
    source: source?.instanceId || source?.label || source?.source || 'explicit-extra-revive-source'
  };
}

function resolveRevivePlan(actor) {
  const own = reviveSpec(actor);
  if (own) return { ...own, mode: 'own-revive', zombieKillerBlocked: false };
  // explicitExtraReviveSources already applies BCU's per-source range / warp /
  // revive_non_zombie eligibility (Entity.java ZombX.updateRevive), so a zombie
  // target keeps only revive_non_zombie sources and an out-of-range source is gone.
  const extras = explicitExtraReviveSources(actor).map(extraReviveSpecFromSource).filter(Boolean);
  if (!extras.length) return null;
  if (!actor.__bcuZombieExtraReviveUsed) actor.__bcuZombieExtraReviveUsed = 0;
  const finiteTotal = extras.some((spec) => spec.count < 0) ? -1 : extras.reduce((sum, spec) => sum + Math.max(0, spec.count), 0);
  if (finiteTotal !== -1 && finiteTotal <= actor.__bcuZombieExtraReviveUsed) return null;
  return {
    count: finiteTotal < 0 ? -1 : 1,
    timeFrames: Math.min(...extras.map((spec) => spec.timeFrames)),
    healthPercent: Math.max(...extras.map((spec) => spec.healthPercent)),
    mode: 'extra-revive',
    extraSources: extras,
    zombieKillerBlocked: extras.some((spec) => spec.imuZkill),
    source: 'BCU ZombX extra revive sources'
  };
}

function hitHasZombieKiller(hit) {
  const calc = hit?.damageCalculation || null;
  const semantic = calc?.abilityDebug?.eventAbilitySemantic || hit?.event?.abilities || {};
  const procItems = [...(calc?.proc?.applied || []), ...(calc?.proc?.pending || [])];
  return semantic?.zombieKiller === true || procItems.some((p) => p?.key === 'zombieKiller');
}

function killedByZombieKillerHits(hits = []) {
  return hits.some(hitHasZombieKiller);
}

function clearReviveStatuses(actor) {
  if (actor.bcuProcStatuses) {
    delete actor.bcuProcStatuses.freeze;
    delete actor.bcuProcStatuses.slow;
    delete actor.bcuProcStatuses.weaken;
    delete actor.bcuProcStatuses.curse;
    delete actor.bcuProcStatuses.seal;
    delete actor.bcuProcStatuses.toxic;
  }
  actor.freezeUntilMs = null;
  actor.slowUntilMs = null;
  actor.weakenUntilMs = null;
  actor.weakenMultiplier = 100;
}

function scheduleRevive(actor, spec, nowMs) {
  if (!actor.__bcuZombieReviveRemainingInitialized) {
    actor.__bcuZombieReviveRemainingInitialized = true;
    actor.bcuZombieReviveRemaining = spec.count < 0 ? -1 : spec.count;
  }
  if (actor.bcuZombieReviveRemaining === 0) return false;
  if (actor.bcuZombieReviveRemaining > 0) actor.bcuZombieReviveRemaining -= 1;
  if (spec.mode === 'extra-revive') actor.__bcuZombieExtraReviveUsed = (actor.__bcuZombieExtraReviveUsed || 0) + 1;
  actor.bcuZombieRevivePending = true;
  // BCU ZombX.doRevive: status[P_REVIVE][1] = revive.time + A_ZOMBIE REVIVE anim length.
  const scene = actor.scene || globalThis.__APP__?.scene || null;
  const reviveAnimFrames = getBcuZombieReviveAnimFrames(scene);
  actor.bcuZombieReviveReadyAtMs = nowMs + (spec.timeFrames + reviveAnimFrames) * BCU_BATTLE_TIMER_PERIOD_MS;
  actor.bcuZombieReviveHealthPercent = spec.healthPercent;
  actor.state = 'dead';
  actor.isAliveFlag = false;
  actor.deathPending = false;
  actor.deathResolved = false;
  actor.deathAfterKnockback = false;
  actor.deadAtMs = nowMs;
  actor.removeAfterMs = Math.max(actor.removeAfterMs || 0, spec.timeFrames * BCU_BATTLE_TIMER_PERIOD_MS + 1000);
  clearReviveStatuses(actor);
  initializeBcuZombieCorpse(actor, { nowMs, reviveTimeFrames: spec.timeFrames, healthPercent: spec.healthPercent });
  startBcuZombieCorpseVisual(actor, { scene, reviveTimeFrames: spec.timeFrames });
  actor.lastBcuZombieReviveDebug = {
    source: 'BCU ZombX.prekill/doRevive parity',
    scheduled: true,
    readyAtMs: actor.bcuZombieReviveReadyAtMs,
    timeFrames: spec.timeFrames,
    reviveHp: actor.hp,
    healthPercent: spec.healthPercent,
    remaining: actor.bcuZombieReviveRemaining,
    mode: spec.mode || 'own-revive',
    extraSources: spec.extraSources || null,
    zombieKillerBlocked: false
  };
  return true;
}

function reviveTouchSelection(actor) {
  const scene = actor.scene || globalThis.__APP__?.scene || null;
  if (typeof scene?.findTargetForActor !== 'function' || typeof scene?.canAttack !== 'function') return null;
  const selection = scene.findTargetForActor(actor);
  if (!selection?.target || !scene.canAttack(actor, selection.target)) return null;
  return selection;
}

function performRevive(actor, nowMs) {
  if (!actor.bcuZombieRevivePending || nowMs < actor.bcuZombieReviveReadyAtMs) return false;
  const hp = Math.trunc(actor.maxHp * actor.bcuZombieReviveHealthPercent / 100);
  actor.hp = hp;
  actor.isAliveFlag = true;
  actor.deathPending = false;
  actor.deathResolved = false;
  actor.deathAfterKnockback = false;
  actor.bcuZombieRevivePending = false;
  actor.bcuZombieCorpse = false;
  actor.deadAtMs = null;
  clearBcuZombieCorpseVisual(actor, { reason: 'revived' });
  // BCU Entity.update2: on the frame status[P_REVIVE][1] reaches 0 the normal flow resumes —
  // checkTouch() true -> setAnim(IDLE) and atkm.startAttack() once waitTime == 0; WALK is only
  // entered when no enemy is in touch range. The attack-start scene phase starts the attack in
  // this same frame from the attack-wait state.
  const touchSelection = reviveTouchSelection(actor);
  if (touchSelection) {
    actor.state = 'attack-wait';
    actor.attackWaitElapsedMs = 0;
    actor.setAnimation?.(actor.idleAnimId || actor.moveAnimId, 'attack-wait', true);
  } else {
    actor.state = 'move';
    actor.setAnimation?.(actor.moveAnimId, 'move', true);
  }
  actor.lastBcuZombieReviveDebug = {
    ...(actor.lastBcuZombieReviveDebug || {}),
    revived: true,
    revivedAtMs: nowMs,
    revivedHp: hp,
    reviveTouchTarget: touchSelection?.target?.instanceId || touchSelection?.target?.label || null,
    reviveState: actor.state,
    source: 'BCU status[P_REVIVE][1] countdown finished; update2 checkTouch decides IDLE/attack vs WALK'
  };
  return true;
}

export function installBattleActorZombieRevivePatch() {
  const proto = BattleActor?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  const originalResolvePostDamage = proto.resolvePostDamage;
  if (typeof originalResolvePostDamage !== 'function') {
    throw new Error('BattleActor.resolvePostDamage is missing; cannot install zombie revive patch');
  }
  proto.__bcuZombieReviveResolvePostDamageWrapped = true;
  proto.__bcuZombieReviveWrappedResolvePostDamageName = originalResolvePostDamage?.name || null;

  proto.resolvePostDamage = function resolvePostDamageWithZombieRevive(args = {}) {
    this.lastBcuZombieReviveWrapperDebug = {
      source: 'BattleActorZombieRevivePatch.resolvePostDamageWithZombieRevive',
      wrapped: true,
      wrappedFunctionName: proto.__bcuZombieReviveWrappedResolvePostDamageName
    };
    const pendingHitsBeforeResolve = Array.isArray(this.pendingHits) ? this.pendingHits.slice() : [];
    const result = originalResolvePostDamage.call(this, args);
    if (!result?.deathPending && !result?.dead) return result;
    const spec = resolveRevivePlan(this);
    const nowMs = Number.isFinite(args?.nowMs) ? args.nowMs : 0;
    const zk = killedByZombieKillerHits(pendingHitsBeforeResolve);
    if ((isZombie(this) || spec?.mode === 'extra-revive') && spec && !(zk && spec.zombieKillerBlocked !== true)) {
      if (result.knockedBack === true && result.deathPending === true) {
        // BCU Entity.KBManager: the final KB plays fully; ZombX.preKill/doRevive only
        // runs at updateKB kbTime==0. Arm here and schedule at finishKnockback.
        this.__bcuZombieReviveArmed = { spec, armedAtMs: nowMs };
        result.zombieReviveArmed = true;
      } else {
        const scheduled = scheduleRevive(this, spec, nowMs);
        if (scheduled) {
          result.dead = false;
          result.deathPending = false;
          result.zombieReviveScheduled = true;
          result.knockedBack = false;
        }
      }
    } else if ((isZombie(this) || spec?.mode === 'extra-revive') && spec && zk) {
      this.lastBcuZombieReviveDebug = { source: 'BCU ZombX.prekill tempZK blocks revive', scheduled: false, zombieKillerBlocked: true, mode: spec.mode || 'own-revive' };
      // BCU/Battle-Cats: Zombie Killer has no unique sprite — "発動時は特有の効果音が
      // 鳴る". This is the moment it actually denies a revive, so play the sting.
      try { playZombieKillerSe(); } catch {}
    }
    return result;
  };

  const originalTick = proto.tick;
  proto.tick = function tickWithZombieRevive(dt) {
    const nowMs = Number.isFinite(this.lastSceneTimeMs) ? this.lastSceneTimeMs : null;
    if (this.bcuZombieRevivePending && Number.isFinite(nowMs)) {
      updateBcuZombieCorpseWindow(this, dt);
      const remainingFrames = Math.max(0, Math.ceil(((this.bcuZombieReviveReadyAtMs || 0) - nowMs) / BCU_BATTLE_TIMER_PERIOD_MS));
      tickBcuZombieCorpseVisual(this, { remainingFrames });
      if (performRevive(this, nowMs)) return originalTick.call(this, dt);
      this.deathElapsedMs += dt;
      // BCU keeps AnimManager updating through the P_REVIVE[1] countdown: the base
      // actor shown under the corpse for the last REVIVE_SHOW_TIME frames walks in
      // the WALK anim set at KB end instead of holding a frozen pose.
      this.animator?.tick?.(dt);
      this.applyCurrentAnimationFrame?.();
      this.lastBcuZombieCorpseDebug = { source: 'BCU status[P_REVIVE][1] corpse countdown', nowMs, readyAtMs: this.bcuZombieReviveReadyAtMs };
      return;
    }
    return originalTick.call(this, dt);
  };

  const originalIsAlive = proto.isAlive;
  proto.isAlive = function isAliveWithZombieCorpse() {
    if (this.bcuZombieRevivePending) return false;
    return originalIsAlive.call(this);
  };

  const originalIsRenderable = proto.isRenderable;
  proto.isRenderable = function isRenderableWithZombieCorpse() {
    if (this.bcuZombieRevivePending || this.bcuZombieCorpse) return true;
    return originalIsRenderable.call(this);
  };

  const originalIsRemovable = proto.isRemovable;
  proto.isRemovable = function isRemovableWithZombieRevive(nowMs = 0) {
    if (this.bcuZombieRevivePending) return false;
    return originalIsRemovable.call(this, nowMs);
  };
}

const SCENE_PATCH_FLAG = Symbol.for('wanko-battle.actor-zombie-revive-scene-patch.v1');

export function installBattleActorZombieReviveScenePatch() {
  const proto = BattleScene?.prototype;
  if (!proto || proto[SCENE_PATCH_FLAG]) return;
  proto[SCENE_PATCH_FLAG] = true;
  const originalFinishKnockback = proto.finishKnockback;
  if (typeof originalFinishKnockback !== 'function') return;
  proto.finishKnockback = function finishKnockbackWithZombieRevive(actor, target, ...rest) {
    const armed = actor?.__bcuZombieReviveArmed;
    if (armed && (actor.deathAfterKnockback || actor.deathPending || actor.hp <= 0)) {
      actor.__bcuZombieReviveArmed = null;
      actor.x = Number.isFinite(actor.knockbackToX) ? actor.knockbackToX : actor.x;
      actor.kbEndedAtMs = this.timeMs;
      actor.detachKbeff?.();
      actor.resetKnockbackVisual?.();
      // BCU Entity.KBManager.updateKB kbTime==0: anim.back=null + setAnim(WALK) runs
      // before ZombX.preKill starts the corpse REVIVE countdown, so the base actor
      // never holds a KB pose under the corpse anim.
      actor.setAnimation?.(actor.moveAnimId, 'move', true);
      const scheduled = scheduleRevive(actor, armed.spec, this.timeMs);
      if (scheduled) {
        actor.applyCurrentAnimationFrame?.();
        this.pushEvent?.({
          type: 'zombieReviveScheduledAfterFinalKnockback',
          actor: actor.instanceId || actor.label,
          readyAtMs: actor.bcuZombieReviveReadyAtMs,
          x: Math.round(actor.x)
        });
        return;
      }
      // Revive count exhausted: fall through to the normal final-KB death path.
    }
    return originalFinishKnockback.call(this, actor, target, ...rest);
  };
}

export function installBattleActorZombieReviveRenderPatch() {
  const proto = BattleSceneRenderer?.prototype;
  if (!proto || proto[RENDER_PATCH_FLAG]) return;
  proto[RENDER_PATCH_FLAG] = true;
  const originalDrawActor = proto.drawActor;
  if (typeof originalDrawActor !== 'function') return;
  proto.drawActor = function drawActorWithZombieCorpseOverride(ctx, actor, ...rest) {
    // BCU Entity.AnimManager.draw: while corpse != null && status[P_REVIVE][1] >= REVIVE_SHOW_TIME
    // the corpse effect replaces the base actor; below REVIVE_SHOW_TIME the base actor draws again.
    if (actor?.bcuRenderOverride?.mode === 'zombie-corpse' && actor.bcuRenderOverride.hideBaseActor === true) {
      actor.lastBcuRenderOverrideTrace = {
        mode: 'zombie-corpse',
        hideBaseActor: true,
        renderable: actor.isRenderable?.() === true,
        source: actor.bcuRenderOverride.source,
        bcuReference: actor.bcuZombieCorpseVisual?.bcuReference || null
      };
      return;
    }
    return originalDrawActor.call(this, ctx, actor, ...rest);
  };
}

installBattleActorZombieRevivePatch();
installBattleActorZombieReviveScenePatch();
installBattleActorZombieReviveRenderPatch();
