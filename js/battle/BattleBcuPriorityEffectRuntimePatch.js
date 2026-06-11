import { BattleScene } from './BattleScene.js';
import { BattleActor } from './BattleActor.js';
import { BCU_ABI } from './BcuCombatModel.js';
import { directionForActor, spawnWaveBundleEffect } from './BcuWaveBundleEffectSpawner.js';
import { enqueueBcuSurgeFromPayload } from './BattleSurgeRuntimePatch.js';
import { processBcuBarrierShieldEffectQueue, spawnBcuBarrierShieldVisual } from './bcu-runtime/BcuBarrierShieldEffectRuntime.js';

const PATCH_FLAG = Symbol.for('wanko-battle.priority-effect-runtime.v2-barrier-shield-runtime');
const ACTOR_PATCH_FLAG = Symbol.for('wanko-battle.priority-effect-actor-runtime.v1');
const COUNTER_SURGE_FORESWING = 50;
const BCU_WARP_BATTLEBOX_Y_OFFSET = 24;
const BCU_WARP_HOLE_EXTRA_Y_OFFSET = 275;
const BCU_WARP_UNIT_SCREEN_OFFSET_X = -27;
const BCU_WARP_ENEMY_SCREEN_OFFSET_X = -24;
const DEMON_SHIELD_REGEN_BCU_REFERENCE = 'BCU Entity.KBManager.updateKB: when kbTime reaches 0, kbType == INT_HB, health > 0, and DEMONSHIELD.hp > 0, currentShield = (int)(hp * regen * shieldMagnification / 100.0), then anim.getEff(SHIELD_REGEN).';

function combatModel(actor) {
  return actor?.bcuCombatModel || actor?.rawStats?.bcuCombatModel || actor?.stats?.bcuCombatModel || null;
}

function procModel(actor) {
  return combatModel(actor)?.proc || {};
}

function hasCounterSurge(actor) {
  const model = combatModel(actor);
  const abi = Number(model?.ability?.abi || 0) || 0;
  return model?.ability?.flags?.counterSurge === true || (abi & BCU_ABI.AB_CSUR) !== 0;
}

function roll(scene) {
  const rng = scene?.getBcuRandom?.();
  return typeof rng === 'function' ? rng() : Math.random();
}

function shouldMirrorUnitSide(actor) {
  return directionForActor(actor) === -1;
}

function counterKey(actor) {
  return directionForActor(actor) === 1 ? 'enemyCounterSurge' : 'unitCounterSurge';
}

function spawnBarrierShieldVisual(scene, actor, event) {
  return spawnBcuBarrierShieldVisual(scene, actor, event, { source: 'BattleBcuPriorityEffectRuntimePatch' });
}

function spawnInvalidIfNeeded(scene, target, result, event, meta) {
  const guard = result?.bcuDamageGuard;
  if (guard?.blocked !== true) return;
  const kind = guard.kind || meta?.bcuWave || meta?.bcuSurge || meta?.bcuBlast || event?.attackKind || null;
  if (kind !== 'wave' && kind !== 'miniWave' && kind !== 'surge' && kind !== 'miniSurge' && kind !== 'blast' && kind !== 'toxic') return;
  spawnWaveBundleEffect(scene, {
    key: directionForActor(target) === 1 ? 'enemyWaveInvalid' : 'unitWaveInvalid',
    actor: target,
    type: 'waveInvalid',
    source: 'bcu-effanim-wave-invalid',
    bcuSmokeYOffset: 0,
    debug: {
      bcuReference: 'Entity.damaged IMUWAVE/IMUVOLC/IMUBLAST/IMUPOIATK mult>0 calls anim.getEff(P_WAVE); drawEff first loop draws status icons at p.y + 0 (entity baseline) with scale siz * 0.75',
      guard,
      kind
    }
  });
}

function queueDelayedEffect(scene, item) {
  if (!scene.__bcuDelayedWaveBundleEffects) scene.__bcuDelayedWaveBundleEffects = [];
  scene.__bcuDelayedWaveBundleEffects.push(item);
}

function processDelayedEffects(scene) {
  const q = Array.isArray(scene.__bcuDelayedWaveBundleEffects) ? scene.__bcuDelayedWaveBundleEffects : [];
  if (!q.length) return;
  const rest = [];
  for (const item of q) {
    item.delay -= 1;
    if (item.delay > 0) {
      rest.push(item);
      continue;
    }
    spawnWaveBundleEffect(scene, item);
  }
  scene.__bcuDelayedWaveBundleEffects = rest;
}

function effectPhaseLength(scene, key, phase) {
  const anim = scene?.waveEffectAssets?.[key]?.phases?.[phase] || null;
  const maxFrame = Number(anim?.maxFrame);
  return Number.isFinite(maxFrame) ? Math.max(1, Math.trunc(maxFrame) + 1) : 0;
}

function warpExitDelay(scene, status) {
  const effectEnterLen = effectPhaseLength(scene, 'warp', 'entrance');
  const baseFrames = Math.max(1, Math.trunc(Number(status?.durationFrames || status?.timeFrames || 1)));
  return Math.max(1, baseFrames + effectEnterLen + 1);
}

function warpEffectPlacement(actor, key) {
  const dire = directionForActor(actor);
  return {
    bcuScreenOffsetX: dire === -1 ? BCU_WARP_UNIT_SCREEN_OFFSET_X : BCU_WARP_ENEMY_SCREEN_OFFSET_X,
    bcuSmokeYOffset: BCU_WARP_BATTLEBOX_Y_OFFSET + (key === 'warp' ? BCU_WARP_HOLE_EXTRA_Y_OFFSET : 0),
    placement: key === 'warp' ? 'hole' : 'chara'
  };
}

function spawnWarpVisuals(scene, target, result) {
  const applied = (result?.procApply || []).find((p) => p?.key === 'warp' && (p?.applied === true || p?.result?.applied === true));
  const status = applied?.result?.status || target?.bcuProcStatuses?.warp || null;
  if (status?.bcuLifecycleManaged === true || target?.bcuWarpLifecycle?.active === true) return;
  if (!applied || !status || status.__bcuWarpVisualQueued) return;
  status.__bcuWarpVisualQueued = true;
  const exitDelay = warpExitDelay(scene, status);
  for (const key of ['warp', 'warpChara']) {
    const placement = warpEffectPlacement(target, key);
    spawnWaveBundleEffect(scene, {
      key,
      phase: 'entrance',
      actor: target,
      type: 'warp',
      source: 'bcu-effanim-warp',
      bcuSmokeYOffset: placement.bcuSmokeYOffset,
      bcuScreenOffsetX: placement.bcuScreenOffsetX,
      renderFlipX: key === 'warpChara' && shouldMirrorUnitSide(target),
      debug: { bcuReference: 'BattleBox draws WaprCont at getX(pos)+dx and y-24*siz; WaprCont.draw then draws A_W at y-275*psiz and A_W_C at the WaprCont anchor', status, placement: placement.placement, exitDelay }
    });
    queueDelayedEffect(scene, {
      key,
      phase: 'exit',
      actor: target,
      type: 'warp',
      source: 'bcu-effanim-warp',
      delay: exitDelay,
      bcuSmokeYOffset: placement.bcuSmokeYOffset,
      bcuScreenOffsetX: placement.bcuScreenOffsetX,
      renderFlipX: key === 'warpChara' && shouldMirrorUnitSide(target),
      debug: { bcuReference: 'Entity.KBManager.updateKB: when kbTime+1 == A_W EXIT length, kbmove(kbDis), anim.getEff(P_WARP), status[P_WARP][2]=0; BattleBox/WaprCont offsets match ENTER', status, placement: placement.placement, exitDelay }
    });
  }
}

function queueCounterSurge(scene, target, incomingEvent, meta = {}) {
  if (!hasCounterSurge(target) || !meta?.bcuSurge || meta?.bcuCounterSurge) return;
  const incomingKind = meta.bcuSurge === 'miniSurge' ? 'miniSurge' : 'surge';
  const payload = incomingEvent?.bcuCounterSurgePayload || {
    dis0: Number(meta.bcuRangeStart ?? 0) || 0,
    dis1: Number(meta.bcuRangeEnd ?? meta.bcuRangeStart ?? 0) || 0,
    time: Number(incomingEvent?.bcuSurgeAliveTime ?? incomingEvent?.time ?? 20) || 20,
    timeFrames: Number(incomingEvent?.bcuSurgeAliveTime ?? incomingEvent?.timeFrames ?? incomingEvent?.time ?? 20) || 20
  };
  if (!scene.__bcuCounterSurgeQueue) scene.__bcuCounterSurgeQueue = [];
  const item = {
    target,
    payload,
    kind: incomingKind,
    delay: COUNTER_SURGE_FORESWING,
    damage: Math.max(1, Math.trunc(Number(target.damage || incomingEvent?.damage || 1) || 1)),
    id: `${scene.logicFrame || 0}:${target.instanceId || target.label || 'actor'}:counter-surge`,
    source: 'BCU SurgeSummoner COUNTER_SURGE_FORESWING'
  };
  scene.__bcuCounterSurgeQueue.push(item);
  spawnWaveBundleEffect(scene, {
    key: counterKey(target),
    actor: target,
    type: 'counterSurge',
    source: 'bcu-effanim-counter-surge',
    debug: {
      bcuReference: 'Entity.damaged: AB_CSUR + AttackVolcano adds SurgeSummoner with A_COUNTERSURGE/A_E_COUNTERSURGE',
      delay: COUNTER_SURGE_FORESWING,
      incomingKind
    }
  });
}

function processCounterSurgeQueue(scene) {
  const q = Array.isArray(scene.__bcuCounterSurgeQueue) ? scene.__bcuCounterSurgeQueue : [];
  if (!q.length) return;
  const rest = [];
  for (const item of q) {
    item.delay -= 1;
    if (item.delay > 0) {
      rest.push(item);
      continue;
    }
    enqueueBcuSurgeFromPayload(scene, item.target, {
      key: item.kind,
      payload: item.payload,
      damage: item.damage,
      event: { damage: item.damage, attackKind: item.kind, bcuCounterSurge: true },
      id: item.id
    });
  }
  scene.__bcuCounterSurgeQueue = rest;
}

function maybeDeathSurge(scene, actor) {
  if (!actor || actor.__bcuDeathSurgeDone) return;
  if (actor.__bcuDeathSurgeManagedByDeathRuntime === true || actor.bcuDeathAnimation?.active === true) return;
  if (!(actor.hp <= 0 || actor.deathPending || actor.state === 'dead' || actor.state === 'dying')) return;
  const ds = procModel(actor)?.deathSurge || null;
  const prob = Number(ds?.prob || 0);
  if (!ds || prob <= 0) return;
  actor.__bcuDeathSurgeDone = true;
  if (roll(scene) * 100 >= prob) {
    scene.pushEvent?.({ type: 'bcuDeathSurgeSkipped', actor: actor.instanceId || actor.label || null, prob, source: 'BattleBcuPriorityEffectRuntimePatch' });
    return;
  }
  enqueueBcuSurgeFromPayload(scene, actor, {
    key: 'surge',
    payload: ds,
    damage: Math.max(1, Math.trunc(Number(actor.damage || 1) || 1)),
    event: { damage: Math.max(1, Math.trunc(Number(actor.damage || 1) || 1)), attackKind: 'surge', bcuDeathSurge: true },
    id: `${scene.logicFrame || 0}:${actor.instanceId || actor.label || 'actor'}:death-surge`
  });
  scene.pushEvent?.({
    type: 'bcuDeathSurgeCreated',
    actor: actor.instanceId || actor.label || null,
    prob,
    payload: ds,
    source: 'BattleBcuPriorityEffectRuntimePatch',
    bcuReference: 'AtkModelEntity death surge creates ContVolcano with WT_VOLC|WT_SOUL'
  });
}

function maybeSpawnShieldRegen(scene, actor) {
  const event = actor?.lastBcuDemonShieldRegenEvent;
  if (!event || actor.__lastBcuDemonShieldRegenVisual === event) return;
  actor.__lastBcuDemonShieldRegenVisual = event;
  spawnBarrierShieldVisual(scene, actor, event);
}

function demonShieldBasis(actor) {
  const proc = procModel(actor);
  const maxShield = Number(actor?.bcuDemonShieldMaxHp ?? proc?.demonShield?.hp ?? 0) || 0;
  const regenPercent = Number(actor?.bcuDemonShieldRegenPercent ?? proc?.demonShield?.regen ?? 0) || 0;
  return {
    maxShield: Math.max(0, Math.trunc(maxShield)),
    regenPercent
  };
}

function queuePendingDemonShieldRegen(actor, result, args = {}) {
  const { maxShield, regenPercent } = demonShieldBasis(actor);
  const hpKb = result?.knockedBack === true
    && result?.deathPending !== true
    && result?.dead !== true
    && actor?.hp > 0
    && actor?.kbBcuType === 'INT_HB';
  if (!hpKb || maxShield <= 0) return;
  actor.bcuDemonShieldMaxHp = maxShield;
  actor.bcuDemonShieldRegenPercent = regenPercent;
  actor.bcuDemonShieldRegenPending = {
    source: 'BattleBcuPriorityEffectRuntimePatch.resolvePostDamage',
    triggerReason: result?.knockbackReason || actor?.knockbackReason || 'hp-threshold',
    queuedLogicFrame: actor?.scene?.logicFrame ?? null,
    queuedTimeMs: args?.nowMs ?? actor?.lastSceneTimeMs ?? null,
    beforeShieldHp: Number(actor?.bcuDemonShieldHp || 0),
    maxShieldHp: maxShield,
    regenPercent,
    bcuReference: DEMON_SHIELD_REGEN_BCU_REFERENCE
  };
  actor.lastBcuDemonShieldRegenTimingDebug = {
    ...actor.bcuDemonShieldRegenPending,
    pending: true,
    delayed: true,
    phase: 'queued-after-post-damage',
    visualEffectId: null,
    revivePhase: 'revive'
  };
}

function consumePendingDemonShieldRegen(actor, stepResult = {}) {
  const pending = actor?.bcuDemonShieldRegenPending;
  if (!pending || stepResult?.done !== true) return null;
  if (actor?.kbBcuType !== 'INT_HB' || actor?.hp <= 0 || actor?.deathPending === true || actor?.deathAfterKnockback === true || actor?.state === 'dead') {
    actor.bcuDemonShieldRegenPending = null;
    actor.lastBcuDemonShieldRegenTimingDebug = {
      ...(actor.lastBcuDemonShieldRegenTimingDebug || pending),
      pending: false,
      skipped: true,
      skipReason: 'not-live-INT_HB-at-kb-end',
      hp: actor?.hp ?? null,
      state: actor?.state || null,
      bcuReference: DEMON_SHIELD_REGEN_BCU_REFERENCE
    };
    return null;
  }
  const before = Number(actor.bcuDemonShieldHp || 0);
  const maxShield = Math.max(0, Math.trunc(Number(pending.maxShieldHp || 0) || 0));
  const regenPercent = Number(pending.regenPercent || 0) || 0;
  const after = Math.min(maxShield, Math.max(0, Math.trunc(maxShield * regenPercent / 100)));
  actor.bcuDemonShieldHp = after;
  actor.bcuDemonShieldMaxHp = Math.max(maxShield, after);
  actor.bcuDemonShieldRegenPercent = regenPercent;
  actor.bcuDemonShieldRegenPending = null;
  const event = {
    type: 'shield-regen',
    before,
    after,
    max: actor.bcuDemonShieldMaxHp,
    regenPercent,
    triggerReason: pending.triggerReason,
    phase: 'revive',
    delayed: true,
    pendingUsed: true,
    logicFrame: actor?.scene?.logicFrame ?? null,
    visualEffectId: 'demonShield:revive',
    source: 'BattleBcuPriorityEffectRuntimePatch.stepKnockbackFrame',
    bcuReference: DEMON_SHIELD_REGEN_BCU_REFERENCE
  };
  actor.lastBcuDemonShieldRegenEvent = event;
  actor.lastBcuDemonShieldRegenTimingDebug = {
    source: 'BattleBcuPriorityEffectRuntimePatch.stepKnockbackFrame',
    logicFrame: event.logicFrame,
    beforeShieldHp: before,
    afterShieldHp: after,
    maxShieldHp: actor.bcuDemonShieldMaxHp,
    regenPercent,
    triggerReason: pending.triggerReason,
    bcuReference: DEMON_SHIELD_REGEN_BCU_REFERENCE,
    visualEffectId: event.visualEffectId,
    phase: 'revive',
    delayed: true,
    pendingUsed: true,
    bcuKbTimeAtFire: actor?.bcuKbTime ?? null,
    kbMotionFrameIndex: actor?.kbMotionFrameIndex ?? null
  };
  return event;
}

export function installBattleBcuPriorityEffectRuntimePatch() {
  const proto = BattleScene?.prototype;
  const actorProto = BattleActor?.prototype;
  if (actorProto && !actorProto[ACTOR_PATCH_FLAG]) {
    actorProto[ACTOR_PATCH_FLAG] = true;
    const originalResolvePostDamage = actorProto.resolvePostDamage;
    if (typeof originalResolvePostDamage === 'function') {
      actorProto.resolvePostDamage = function resolvePostDamageWithPendingDemonShieldRegen(args = {}) {
        const result = originalResolvePostDamage.call(this, args);
        queuePendingDemonShieldRegen(this, result, args);
        return result;
      };
    }
    const originalStepKnockbackFrame = actorProto.stepKnockbackFrame;
    if (typeof originalStepKnockbackFrame === 'function') {
      actorProto.stepKnockbackFrame = function stepKnockbackFrameWithDemonShieldRegen(...args) {
        const result = originalStepKnockbackFrame.call(this, ...args);
        consumePendingDemonShieldRegen(this, result);
        return result;
      };
    }
  }

  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  const originalQueueAttackDamage = proto.queueAttackDamage;
  if (typeof originalQueueAttackDamage === 'function') {
    proto.queueAttackDamage = function queueAttackDamageWithBcuPriorityEffects(attacker, target, targetType, event, meta = {}) {
      const result = originalQueueAttackDamage.call(this, attacker, target, targetType, event, meta);
      if (targetType === 'actor') {
        for (const barrierEvent of result?.bcuBarrierShieldEvents || []) spawnBarrierShieldVisual(this, target, barrierEvent);
        spawnInvalidIfNeeded(this, target, result, event, meta);
        spawnWarpVisuals(this, target, result);
        if (result?.accepted) queueCounterSurge(this, target, event, meta);
      }
      return result;
    };
  }

  const originalRunTickPhase = proto.runTickPhase;
  if (typeof originalRunTickPhase === 'function') {
    proto.runTickPhase = function runTickPhaseWithBcuPriorityEffects(phase, fn = () => {}) {
      if (phase !== 'knockback-death' && phase !== 'proc-resolve') return originalRunTickPhase.call(this, phase, fn);
      return originalRunTickPhase.call(this, phase, () => {
        const res = fn();
        if (phase === 'knockback-death') for (const actor of this.actors || []) {
          maybeSpawnShieldRegen(this, actor);
          maybeDeathSurge(this, actor);
        }
        if (phase === 'proc-resolve') {
          processBcuBarrierShieldEffectQueue(this);
          processDelayedEffects(this);
          processCounterSurgeQueue(this);
        }
        return res;
      });
    };
  }
}

installBattleBcuPriorityEffectRuntimePatch();
