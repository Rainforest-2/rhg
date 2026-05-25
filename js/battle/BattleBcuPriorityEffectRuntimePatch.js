import { BattleScene } from './BattleScene.js';
import { BattleActor } from './BattleActor.js';
import { BCU_ABI } from './BcuCombatModel.js';
import { directionForActor, spawnWaveBundleEffect } from './BcuWaveBundleEffectSpawner.js';
import { enqueueBcuSurgeFromPayload } from './BattleSurgeRuntimePatch.js';

const PATCH_FLAG = Symbol.for('wanko-battle.priority-effect-runtime.v1');
const ACTOR_PATCH_FLAG = Symbol.for('wanko-battle.priority-effect-actor-runtime.v1');
const COUNTER_SURGE_FORESWING = 50;
const BCU_WARP_HOLE_Y_OFFSET = 275;

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

function barrierKey(actor) {
  return directionForActor(actor) === 1 ? 'enemyBarrier' : 'unitBarrier';
}

function shouldMirrorUnitSide(actor) {
  return directionForActor(actor) === -1;
}

function counterKey(actor) {
  return directionForActor(actor) === 1 ? 'enemyCounterSurge' : 'unitCounterSurge';
}

function spawnBarrierShieldVisual(scene, actor, event) {
  if (!event?.type) return null;
  if (event.type.startsWith('barrier')) {
    const phase = event.type === 'barrier-breaker' ? 'breaker' : event.type === 'barrier-broken-by-damage' ? 'destruction' : 'none';
    return spawnWaveBundleEffect(scene, {
      key: barrierKey(actor),
      phase,
      actor,
      type: 'barrier',
      source: 'bcu-effanim-barrier',
      renderFlipX: shouldMirrorUnitSide(actor),
      debug: {
        bcuReference: 'Entity.Barrier.breakBarrier / anim.getEff(BREAK_NON|BREAK_ABI|BREAK_ATK); side-specific draw mirrors friendly-side effect orientation',
        barrierEvent: event
      }
    });
  }
  if (event.type.startsWith('shield')) {
    const phase = event.type === 'shield-pierced' ? 'breaker' : event.type === 'shield-broken-by-damage' ? 'destruction' : event.type === 'shield-regen' ? 'revive' : (Number(event.after || 0) > 0 && Number(event.before || 0) > Number(event.after || 0) && Number(event.after || 0) < Number(actor.bcuDemonShieldMaxHp || 0) / 2 ? 'half' : 'full');
    return spawnWaveBundleEffect(scene, {
      key: 'demonShield',
      phase,
      actor,
      type: 'demonShield',
      source: 'bcu-effanim-demon-shield',
      renderFlipX: shouldMirrorUnitSide(actor),
      debug: {
        bcuReference: 'Entity.getEff(P_DEMONSHIELD): ShieldEff FULL/HALF/BROKEN/BREAKER/REGENERATION; friendly-side shield is mirrored to distinguish side orientation',
        shieldEvent: event
      }
    });
  }
  return null;
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
    debug: {
      bcuReference: 'Entity.damaged IMUWAVE/IMUVOLC/IMUBLAST/IMUPOIATK mult>0 calls anim.getEff(P_WAVE)',
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

function warpEffectPlacement(key) {
  return key === 'warp'
    ? { bcuSmokeYOffset: BCU_WARP_HOLE_Y_OFFSET, placement: 'hole' }
    : { bcuSmokeYOffset: 0, placement: 'chara' };
}

function spawnWarpVisuals(scene, target, result) {
  const applied = (result?.procApply || []).find((p) => p?.key === 'warp' && (p?.applied === true || p?.result?.applied === true));
  const status = applied?.result?.status || target?.bcuProcStatuses?.warp || null;
  if (!applied || !status || status.__bcuWarpVisualQueued) return;
  status.__bcuWarpVisualQueued = true;
  for (const key of ['warp', 'warpChara']) {
    const placement = warpEffectPlacement(key);
    spawnWaveBundleEffect(scene, {
      key,
      phase: 'entrance',
      actor: target,
      type: 'warp',
      source: 'bcu-effanim-warp',
      bcuSmokeYOffset: placement.bcuSmokeYOffset,
      renderFlipX: shouldMirrorUnitSide(target),
      debug: { bcuReference: 'WaprCont.draw: A_W is drawn at entity pos with y -= 275*psiz; A_W_C/chara is drawn at entity pos baseline on warp enter', status, placement: placement.placement }
    });
    queueDelayedEffect(scene, {
      key,
      phase: 'exit',
      actor: target,
      type: 'warp',
      source: 'bcu-effanim-warp',
      delay: Math.max(1, Math.trunc(Number(status.durationFrames || status.framesRemaining || 1))),
      bcuSmokeYOffset: placement.bcuSmokeYOffset,
      renderFlipX: shouldMirrorUnitSide(target),
      debug: { bcuReference: 'Entity.KBManager.updateKB: exit calls kbmove(kbDis) then anim.getEff(P_WARP); WaprCont.draw uses shifted A_W hole and baseline A_W_C chara', status, placement: placement.placement }
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
    id: `${scene.logicFrame || 0}:${target.instanceId || target.label || 'counter'}:counter-surge`,
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

export function installBattleBcuPriorityEffectRuntimePatch() {
  const proto = BattleScene?.prototype;
  const actorProto = BattleActor?.prototype;
  if (actorProto && !actorProto[ACTOR_PATCH_FLAG]) {
    actorProto[ACTOR_PATCH_FLAG] = true;
    const originalResolvePostDamage = actorProto.resolvePostDamage;
    if (typeof originalResolvePostDamage === 'function') {
      actorProto.resolvePostDamage = function resolvePostDamageWithLateDemonShieldRegen(args = {}) {
        const result = originalResolvePostDamage.call(this, args);
        const proc = procModel(this);
        const maxShield = Number(this.bcuDemonShieldMaxHp || proc?.demonShield?.hp || 0) || 0;
        const regenPercent = Number(this.bcuDemonShieldRegenPercent ?? proc?.demonShield?.regen ?? 0) || 0;
        const hpKb = result?.knockedBack === true && result?.deathPending !== true && result?.dead !== true && this.hp > 0;
        if (hpKb && maxShield > 0 && regenPercent > 0) {
          const before = Number(this.bcuDemonShieldHp || 0);
          const after = Math.min(maxShield, Math.max(0, Math.trunc(maxShield * regenPercent / 100)));
          this.bcuDemonShieldMaxHp = maxShield;
          this.bcuDemonShieldRegenPercent = regenPercent;
          this.bcuDemonShieldHp = after;
          this.lastBcuDemonShieldRegenEvent = {
            type: 'shield-regen',
            before,
            after,
            source: 'BCU KBManager INT_HB regenerates DEMONSHIELD hp * regen / 100 and anim.getEff(SHIELD_REGEN)'
          };
          result.bcuBarrierShieldEvents = [...(result.bcuBarrierShieldEvents || []), this.lastBcuDemonShieldRegenEvent];
        }
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
          processDelayedEffects(this);
          processCounterSurgeQueue(this);
        }
        return res;
      });
    };
  }
}

installBattleBcuPriorityEffectRuntimePatch();
