import { BattleScene } from './BattleScene.js';
import { BATTLE_CONFIG } from './BattleConfig.js';
import { BattleAttackTimeline } from './BattleAttackTimeline.js';
import { KBRuntime } from './KBRuntime.js';
import { BCU_BATTLE_TIMER_PERIOD_MS } from './BattleFrameClock.js';
import { BattleCombatCoordinateRuntime } from './BattleCombatCoordinateRuntime.js';

const PATCH_FLAG = Symbol.for('wanko-battle.stagebasis-tick-patch.v5');

function shouldTickActor(actor) {
  if (!actor) return false;
  if (actor.needsLifecycleTick) return !!actor.needsLifecycleTick();
  return !!actor.isAlive?.();
}

function isActorActive(actor) {
  return !!actor && actor.state !== 'dead' && !!actor.isAlive?.();
}

function getPos(actor) {
  const n = BattleCombatCoordinateRuntime.getEntityPosBcu(actor);
  return Number.isFinite(n) ? n : (Number.isFinite(actor?.x) ? actor.x : 0);
}

function getDire(actor) {
  if (Number.isFinite(actor?.direction)) return actor.direction;
  return actor?.side === 'dog-player' ? -1 : 1;
}

function getLayer(actor) {
  return Number.isFinite(actor?.currentLayer) ? actor.currentLayer : 0;
}

function sortForBcuUpdate(actors = []) {
  actors.sort((a, b) => {
    const ad = getDire(a);
    const bd = getDire(b);
    if (ad !== bd) return ad - bd;
    const ap = getPos(a);
    const bp = getPos(b);
    if (ap !== bp) return ap - bp;
    return String(a?.instanceId || '').localeCompare(String(b?.instanceId || ''));
  });
}

function sortForBcuLayer(actors = []) {
  actors.sort((a, b) => {
    const al = getLayer(a);
    const bl = getLayer(b);
    if (al !== bl) return al - bl;
    const ap = getPos(a);
    const bp = getPos(b);
    if (ap !== bp) return ap - bp;
    return String(a?.instanceId || '').localeCompare(String(b?.instanceId || ''));
  });
}

function moveActor(scene, actor, dt) {
  const defaultDistance = actor.moveSpeed * (dt / 1000);
  if (actor?.isBcuProcStatusActive?.('freeze', scene.timeMs)) {
    if (globalThis.__BCU_DEBUG_ALLOCATIONS__ === true) {
      actor.lastBcuStopMoveDebug = {
        source: 'BCU Entity.update: status[P_STOP] prevents updateMove()',
        frame: scene.logicFrame,
        timeMs: scene.timeMs,
        defaultDistance,
        appliedDistance: 0,
        x: actor.x
      };
    }
    return;
  }
  const distance = typeof actor.getBcuMoveDistanceForDt === 'function'
    ? actor.getBcuMoveDistanceForDt(defaultDistance, dt, scene.timeMs)
    : defaultDistance;
  actor.x += actor.direction * distance;
  actor.posBcu = actor.x;
}

function isBcuStopped(scene, actor) {
  return actor?.isBcuProcStatusActive?.('freeze', scene.timeMs) === true;
}

function holdAttackForBcuStop(scene, actor, dt) {
  if (!isBcuStopped(scene, actor)) return false;
  actor.attackStartedAtMs = (actor.attackStartedAtMs || scene.timeMs) + dt;
  if (globalThis.__BCU_DEBUG_ALLOCATIONS__ === true) {
    actor.lastBcuStopAttackDebug = {
      source: 'BCU Entity.update2: atkm.updateAttack() is gated by nstop',
      frame: scene.logicFrame,
      timeMs: scene.timeMs,
      heldByMs: dt,
      attackStartedAtMs: actor.attackStartedAtMs
    };
  }
  return true;
}

function clearBcuTickScratch(scene) {
  scene.__bcuTargetSelections = new Map();
  scene.__bcuDueAttackHits = [];
}

function getSelection(scene, actor) {
  return scene.__bcuTargetSelections?.get(actor) || null;
}

function attackWaitReady(actor, nowMs) {
  const state = BattleAttackTimeline.getAttackWaitState(actor, nowMs);
  const ready = state.ready && state.canStartAttack !== false;
  if (globalThis.__BCU_DEBUG_ALLOCATIONS__ === true) {
    actor.lastStageBasisAttackWaitDebug = {
      source: 'BCU StageBasisTickPatch attack-start uses waitTime == 0 && attacksLeft != 0',
      nowMs,
      ready,
      waitReady: state.ready,
      canStartAttack: state.canStartAttack,
      remainingMs: state.remainingMs,
      remainingFrames: state.remainingFrames,
      attacksLeft: state.attacksLeft,
      readyAtMs: state.readyAtMs,
      active: state.active,
      reason: state.reason,
      bcuReference: 'Entity.update2: waitTime == 0 && touchEnemy && atkm.attacksLeft != 0'
    };
  }
  return ready;
}

export function installBattleSceneBcuStageBasisTickPatch() {
  const proto = BattleScene?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  proto.tick = function tickStageBasisPhased(dt = BCU_BATTLE_TIMER_PERIOD_MS) {
    if (this.battleState !== 'running') return;
    clearBcuTickScratch(this);

    const rawDt = Number.isFinite(dt) ? dt : (this.frameClock?.fixedStepMs || BCU_BATTLE_TIMER_PERIOD_MS);
    const scaledDt = rawDt * (BATTLE_CONFIG.tuning?.battleTimeScale ?? 1);

    this.runTickPhase('advance-clock', () => {
      const frame = this.frameClock.step(scaledDt);
      this.logicFrame = frame.logicFrame;
      this.timeMs = frame.timeMs;
    });

    this.runTickPhase('player-production-requests', () => { this.tickPlayerProductionRequests(); });
    this.runTickPhase('enemy-spawn', () => { this.tickStageEnemySpawn(); });
    this.runTickPhase('economy', () => { this.economy?.tick?.(scaledDt); });

    this.runTickPhase('actor-state-update', () => {
      sortForBcuUpdate(this.actors || []);
      for (const actor of this.actors) {
        actor.lastSceneTimeMs = this.timeMs; actor.lastSceneLogicFrame = this.logicFrame;
        if (!shouldTickActor(actor)) continue;
        // BCU Entity.update first line: if(waitTime > 0) waitTime--. This must also run while KBing.
        BattleAttackTimeline.tickBcuWait(actor, { logicFrame: this.logicFrame, nowMs: this.timeMs });
        actor.tick(scaledDt);
        if (actor.state === 'dead') continue;
        if (actor.state === 'knockback') {
          const kbTarget = actor.attackTarget && this.isTargetAliveForAttack(actor.attackTarget, actor.attackTargetType) ? actor.attackTarget : null;
          const kbDt = (BATTLE_CONFIG.tuning?.knockback?.parity?.useBattleTimeScale === false) ? rawDt : scaledDt;
          this.tickKnockback(actor, kbDt, kbTarget);
        }
      }
    });

    this.runTickPhase('movement', () => {
      for (const actor of this.actors) {
        actor.lastSceneTimeMs = this.timeMs; actor.lastSceneLogicFrame = this.logicFrame;
        if (!isActorActive(actor)) continue;
        if (actor.state === 'knockback' || actor.state === 'attack') continue;
        const selection = this.findTargetForActor(actor);
        this.__bcuTargetSelections.set(actor, selection);
        if (!selection) {
          if (actor.state === 'attack-wait') {
            actor.setState('move');
            actor.setAnimation(actor.moveAnimId, 'move', true);
          }
          if (actor.state === 'move') moveActor(this, actor, scaledDt);
          continue;
        }
        const { target, targetType } = selection;
        if (!this.canAttack(actor, target)) {
          if (actor.state === 'attack-wait') {
            actor.setState('move');
            actor.setAnimation(actor.moveAnimId, 'move', false);
          } else if (actor.state !== 'move') {
            actor.setState('move');
            actor.setAnimation(actor.moveAnimId, 'move');
          }
          moveActor(this, actor, scaledDt);
          this.__bcuTargetSelections.set(actor, { target, targetType, canAttack: false });
        } else {
          this.__bcuTargetSelections.set(actor, { target, targetType, canAttack: true });
        }
      }
    });

    this.runTickPhase('target-search', () => {
      for (const actor of this.actors) {
        actor.lastSceneTimeMs = this.timeMs; actor.lastSceneLogicFrame = this.logicFrame;
        if (!isActorActive(actor)) continue;
        if (actor.state === 'knockback' || actor.state === 'attack') continue;
        if (this.__bcuTargetSelections.has(actor)) continue;
        const selection = this.findTargetForActor(actor);
        this.__bcuTargetSelections.set(actor, selection ? { ...selection, canAttack: this.canAttack(actor, selection.target) } : null);
      }
    });

    this.runTickPhase('attack-start', () => {
      for (const actor of this.actors) {
        actor.lastSceneTimeMs = this.timeMs; actor.lastSceneLogicFrame = this.logicFrame;
        if (!isActorActive(actor)) continue;
        if (actor.state === 'knockback' || actor.state === 'attack') continue;
        if (isBcuStopped(this, actor)) continue;
        const selection = getSelection(this, actor);
        if (!selection?.target) continue;
        const { target, targetType } = selection;
        const canAttack = selection.canAttack !== false && this.canAttack(actor, target);
        if (actor.state === 'attack-wait') {
          const ready = attackWaitReady(actor, this.timeMs);
          if (ready && canAttack) {
            this.startActorAttack(actor, target, targetType);
            continue;
          }
          if (canAttack && !ready) {
            this.enterAttackWait(actor, 'cooldown-target-in-range');
          }
          continue;
        }
        if (actor.state === 'move' && canAttack) {
          if (attackWaitReady(actor, this.timeMs)) this.startActorAttack(actor, target, targetType);
          else this.enterAttackWait(actor, 'cooldown-target-in-range');
        }
      }
    });

    this.runTickPhase('attack-timeline', () => {
      this.__bcuDueAttackHits = [];
      for (const actor of this.actors) {
        actor.lastSceneTimeMs = this.timeMs; actor.lastSceneLogicFrame = this.logicFrame;
        if (!actor || actor.state !== 'attack') continue;
        if (holdAttackForBcuStop(this, actor, scaledDt)) continue;
        actor.attackElapsedMs = BattleAttackTimeline.getElapsedMs(actor, this.timeMs);
        const dueHits = BattleAttackTimeline.getDueHitEvents(actor, this.timeMs) || [];
        for (const due of dueHits) this.__bcuDueAttackHits.push({ actor, due });
      }
    });

    this.runTickPhase('hit-target-capture', () => {
      const dueHits = Array.isArray(this.__bcuDueAttackHits) ? this.__bcuDueAttackHits : [];
      for (const item of dueHits) this.resolveAttackHitEvent(item.actor, item.due);
      for (const actor of this.actors) {
        actor.lastSceneTimeMs = this.timeMs; actor.lastSceneLogicFrame = this.logicFrame;
        if (!actor || actor.state !== 'attack') continue;
        if (BattleAttackTimeline.isAttackComplete(actor, this.timeMs)) {
          this.enterAttackWait(actor, 'attack-complete');
          actor.attackTarget = null;
          actor.attackTargetType = null;
        }
      }
    });

    this.runTickPhase('damage-resolve', () => {});
    this.runTickPhase('proc-resolve', () => {});

    this.runTickPhase('knockback-death', () => {
      for (const actor of this.actors) {
        actor.lastSceneTimeMs = this.timeMs; actor.lastSceneLogicFrame = this.logicFrame;
        const res = KBRuntime.resolvePostDamage(actor, { nowMs: this.timeMs, tuning: BATTLE_CONFIG.tuning });
        if (res?.damaged) {
          this.pushEvent({
            type: 'kbRuntimePostDamage',
            actor: res.actorId,
            damaged: res.damaged,
            dead: res.dead,
            knockedBack: res.knockedBack,
            kbType: res.kbState?.knockbackType || null,
            kbReason: res.kbState?.knockbackReason || null,
            hp: res.hp,
            maxHp: res.maxHp
          });
        }
      }
    });

    this.runTickPhase('base-post-update', () => {});
    this.runTickPhase('effect-spawn', () => {});
    this.runTickPhase('effect-tick', () => { this.tickEffects(scaledDt); });
    this.runTickPhase('cleanup', () => { this.cleanupEffects(); this.cleanupDead(); this.updateBattleState(); });
    this.runTickPhase('lineup-change', () => {
      if (this.battleState === 'running') this.tickLineupChange(scaledDt);
    });
    this.runTickPhase('camera-update', () => {
      sortForBcuLayer(this.actors || []);
    });
  };
}

installBattleSceneBcuStageBasisTickPatch();