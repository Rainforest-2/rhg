import { BattleScene } from './BattleScene.js';
import './BattleSceneBcuTouchPatch.js';
import { BATTLE_CONFIG } from './BattleConfig.js';
import { BattleAttackTimeline } from './BattleAttackTimeline.js';
import { KBRuntime } from './KBRuntime.js';
import { BCU_BATTLE_TIMER_PERIOD_MS } from './BattleFrameClock.js';
import { isBcuWarpLifecycleActive } from './bcu-runtime/BcuWarpLifecycleRuntime.js';

const PATCH_FLAG = Symbol.for('wanko-battle.stagebasis-tick-patch.v5');

// BCU Entity.update: kbTime > 0 runs only kb.updateKB(); Entity.update2: kbTime != 0
// short-circuits before touch/walk/attack handling. INT_WARP keeps kbTime > 0 for the
// whole warp, so a warped entity must not walk, retarget, or attack until the warp ends.
function isBcuWarpInterrupted(actor) {
  return isBcuWarpLifecycleActive(actor) || actor?.bcuWarpHidden === true || !!actor?.bcuProcStatuses?.warp;
}

function shouldTickActor(actor) {
  if (!actor) return false;
  if (actor.needsLifecycleTick) return !!actor.needsLifecycleTick();
  return !!actor.isAlive?.();
}

function isActorActive(actor) {
  return !!actor && actor.state !== 'dead' && !!actor.isAlive?.();
}

function getDire(actor) {
  if (Number.isFinite(actor?.direction)) return actor.direction;
  return actor?.side === 'dog-player' ? -1 : 1;
}

function getLayer(actor) {
  return Number.isFinite(actor?.currentLayer) ? actor.currentLayer : 0;
}

// BCU StageBasis.updateEntities: `le.sort(Comparator.comparingInt(e -> e.dire))`.
// Java's List.sort is a STABLE sort, so entities with the same direction keep their relative
// (insertion) order. Do NOT add pos/instanceId tiebreakers — that would reorder same-direction
// entities differently from BCU. JS Array.prototype.sort is also stable, so returning 0 on a
// direction tie preserves insertion order, matching BCU exactly.
function sortForBcuUpdate(actors = []) {
  actors.sort((a, b) => getDire(a) - getDire(b));
}

// BCU StageBasis.updateEntities: `le.sort(Comparator.comparingInt(e -> e.currentLayer))` — a
// stable sort by currentLayer only. Same stability contract as above.
function sortForBcuLayer(actors = []) {
  actors.sort((a, b) => getLayer(a) - getLayer(b));
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
  if (scene.__bcuTargetSelections instanceof Map) scene.__bcuTargetSelections.clear();
  else scene.__bcuTargetSelections = new Map();
  if (Array.isArray(scene.__bcuDueAttackHits)) scene.__bcuDueAttackHits.length = 0;
  else scene.__bcuDueAttackHits = [];
}

function isTargetableForBucket(actor) {
  if (!actor) return false;
  if (typeof actor.isTargetable === 'function') return !!actor.isTargetable();
  if (typeof actor.isAlive === 'function') return !!actor.isAlive();
  return false;
}

function refreshBcuTargetableActorBuckets(scene) {
  let buckets = scene.__bcuTargetableActorBuckets;
  if (!buckets) {
    buckets = { dogPlayer: [], catEnemy: [], frame: -1, source: 'BattleSceneBcuStageBasisTickPatch targetable buckets' };
    scene.__bcuTargetableActorBuckets = buckets;
  }
  buckets.dogPlayer.length = 0;
  buckets.catEnemy.length = 0;
  buckets.frame = scene.logicFrame;
  for (const actor of (scene.actors || [])) {
    if (!isTargetableForBucket(actor)) continue;
    if (actor.side === 'dog-player') buckets.dogPlayer.push(actor);
    else if (actor.side === 'cat-enemy') buckets.catEnemy.push(actor);
  }
  return buckets;
}

function invalidateBcuTargetableActorBuckets(scene) {
  const buckets = scene?.__bcuTargetableActorBuckets;
  if (!buckets) return;
  buckets.frame = -1;
  buckets.dogPlayer.length = 0;
  buckets.catEnemy.length = 0;
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

function selectionFromTouchState(touchState) {
  const attackTarget = touchState?.attackTarget || null;
  const fallbackTarget = attackTarget || touchState?.firstCandidate || (Array.isArray(touchState?.candidates) ? touchState.candidates[0] : null);
  return {
    target: fallbackTarget?.target || null,
    targetType: fallbackTarget?.targetType || null,
    touch: touchState?.touch === true,
    touchEnemy: touchState?.touchEnemy === true,
    attackTarget,
    canAttack: touchState?.touch === true
  };
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
      refreshBcuTargetableActorBuckets(this);
      for (const actor of this.actors) {
        actor.lastSceneTimeMs = this.timeMs; actor.lastSceneLogicFrame = this.logicFrame;
        if (!isActorActive(actor)) continue;
        // BCU Entity.update: kbTime < -1 (burrow) runs updateBurrow only —
        // no normal walk movement or animation while underground.
        if (actor.state === 'knockback' || actor.state === 'attack' || actor.state === 'burrow' || actor.bcuBurrow?.active) continue;
        if (isBcuWarpInterrupted(actor)) continue;
        // BCU Entity.checkTouch(): `touch` (anything in range) drives stop/idle vs walk;
        // `touchEnemy` (Target Only trait gate) drives attack-start. Selection target is the
        // nominal walk-direction target; the real attack target is re-captured at hit time.
        const touchState = this.computeBcuTouchState(actor);
        this.__bcuTargetSelections.set(actor, selectionFromTouchState(touchState));
        if (!touchState.touch) {
          // BCU update2: !checkTouch() => walking = true, walk anim. update(): walking && !checkTouch() => move.
          if (actor.state === 'attack-wait') {
            actor.setState('move');
            actor.setAnimation(actor.moveAnimId, 'move', true);
          } else if (actor.state !== 'move') {
            actor.setState('move');
            actor.setAnimation(actor.moveAnimId, 'move');
          }
          moveActor(this, actor, scaledDt);
        } else if (actor.state === 'move') {
          // BCU update2: checkTouch() => walking = false, idle anim. Do NOT move this frame,
          // even if touchEnemy is false (Target Only stopped in front of an incompatible enemy).
          actor.setState('attack-wait');
          actor.setAnimation(actor.idleAnimId || actor.moveAnimId, 'attack-wait', true);
        }
      }
    });

    this.runTickPhase('target-search', () => {
      for (const actor of this.actors) {
        actor.lastSceneTimeMs = this.timeMs; actor.lastSceneLogicFrame = this.logicFrame;
        if (!isActorActive(actor)) continue;
        if (actor.state === 'knockback' || actor.state === 'attack' || actor.state === 'burrow' || actor.bcuBurrow?.active) continue;
        if (isBcuWarpInterrupted(actor)) continue;
        if (this.__bcuTargetSelections.has(actor)) continue;
        const touchState = this.computeBcuTouchState(actor);
        this.__bcuTargetSelections.set(actor, selectionFromTouchState(touchState));
      }
    });

    this.runTickPhase('attack-start', () => {
      for (const actor of this.actors) {
        actor.lastSceneTimeMs = this.timeMs; actor.lastSceneLogicFrame = this.logicFrame;
        if (!isActorActive(actor)) continue;
        if (actor.state === 'knockback' || actor.state === 'attack' || actor.state === 'burrow' || actor.bcuBurrow?.active) continue;
        if (isBcuWarpInterrupted(actor)) continue;
        if (isBcuStopped(this, actor)) continue;
        const selection = getSelection(this, actor);
        if (!selection) continue;
        // BCU update2: attack-start gate is `waitTime == 0 && touchEnemy && atksLeft != 0`.
        // touchEnemy already encodes the Target Only trait gate; do NOT use raw geometric
        // canAttack here, or a Target Only unit would attack incompatible enemies.
        const touchEnemy = selection.touchEnemy === true;
        // Prefer a trait-compatible attack target for animation; the real damage target is
        // re-captured at hit time, so this only affects which way the attack faces.
        const chosen = selection.attackTarget || (selection.target ? { target: selection.target, targetType: selection.targetType } : null);
        if (touchEnemy && !chosen) continue;
        if (actor.state === 'attack-wait') {
          const ready = attackWaitReady(actor, this.timeMs);
          if (ready && touchEnemy) {
            this.startActorAttack(actor, chosen.target, chosen.targetType);
            continue;
          }
          if (touchEnemy && !ready) {
            this.enterAttackWait(actor, 'cooldown-target-in-range');
          }
          continue;
        }
        if (actor.state === 'move' && touchEnemy) {
          if (attackWaitReady(actor, this.timeMs)) this.startActorAttack(actor, chosen.target, chosen.targetType);
          else this.enterAttackWait(actor, 'cooldown-target-in-range');
        }
      }
    });

    this.runTickPhase('attack-timeline', () => {
      this.__bcuDueAttackHits.length = 0;
      for (const actor of this.actors) {
        actor.lastSceneTimeMs = this.timeMs; actor.lastSceneLogicFrame = this.logicFrame;
        if (!actor || actor.state !== 'attack') continue;
        if (isBcuWarpInterrupted(actor)) continue;
        if (holdAttackForBcuStop(this, actor, scaledDt)) continue;
        actor.attackElapsedMs = BattleAttackTimeline.getElapsedMs(actor, this.timeMs);
        const dueHits = BattleAttackTimeline.getDueHitEvents(actor, this.timeMs) || [];
        for (const due of dueHits) this.__bcuDueAttackHits.push({ actor, due });
      }
    });

    this.runTickPhase('hit-target-capture', () => {
      refreshBcuTargetableActorBuckets(this);
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

    this.runTickPhase('damage-resolve', () => { invalidateBcuTargetableActorBuckets(this); });
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

// Exported for parity tests: BCU stable direction-only / currentLayer-only entity sorts.
export { sortForBcuUpdate, sortForBcuLayer };

installBattleSceneBcuStageBasisTickPatch();
