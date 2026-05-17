import { BattleActor } from './BattleActor.js';
import { BattleScene } from './BattleScene.js';
import { BCU_KNOCKBACK_SPECS, convertBcuDistanceToWorld, getDefaultSpecTypeForKind } from './BcuKnockbackSpec.js';

const ACTOR_FLAG = Symbol.for('wanko-battle.bcu-entity-kb-actor.v1');
const SCENE_FLAG = Symbol.for('wanko-battle.bcu-entity-kb-scene.v1');
const KB_PRI = Object.freeze({ INT_KB: 2, INT_HB: 4, INT_SW: 5, INT_ASS: 1, INT_WARP: 3 });
const KB_STATUS_TIME = Object.freeze({ INT_KB: 11, INT_HB: 23, INT_SW: 47, INT_ASS: 11 });
const KB_DIS = Object.freeze({ INT_KB: 165, INT_HB: 345, INT_SW: 705, INT_ASS: 55 });

function finite(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function stageLenForActor(actor) {
  return finite(actor?.scene?.stage?.runtime?.stageLen, finite(actor?.scene?.stage?.definition?.stageLen, 0));
}

function getActorLimit(actor) {
  const raw = actor?.rawStats || {};
  const side = actor?.side;
  const pos = finite(actor?.x, 0);
  const limit = finite(raw.limit, 0);
  if (side === 'dog-player') {
    const stageLen = stageLenForActor(actor);
    return Math.max(0, stageLen > 0 ? stageLen - pos - limit : Infinity);
  }
  if (side === 'cat-enemy') {
    const bossSpawn = actor?.bcuBossSpawnOffset || 0;
    return Math.max(0, pos - (limit + bossSpawn));
  }
  return Infinity;
}

function easeOut(time, start, end, duration, dire) {
  const t = duration === 0 ? 1 : time / duration;
  return -end * t * (t - 2) * dire + start;
}

function kbMove(actor, mov) {
  const lim = getActorLimit(actor);
  const step = Math.min(Math.max(0, finite(mov, 0)), lim);
  actor.x -= step * finite(actor.direction, 1);
  actor.posBcu = actor.x;
  return step;
}

function resolveSpec(kb = {}, actor = null) {
  const specType = kb.specType || kb.knockbackSpecType || getDefaultSpecTypeForKind(kb.type || actor?.knockbackType || 'hp');
  return BCU_KNOCKBACK_SPECS[specType] || BCU_KNOCKBACK_SPECS.HP_KB;
}

function stopAttackLikeBcu(actor) {
  actor.attackElapsedMs = 0;
  actor.attackWaitElapsedMs = 0;
  actor.hasHitInCurrentAttack = false;
  actor.resolvedAttackEventKeys = new Set();
  actor.attackTarget = null;
  actor.attackTargetType = null;
  actor.attackStartedAtMs = 0;
}

function updateKbDebug(actor, extra = {}) {
  actor.lastBcuEntityKbDebug = {
    source: 'BcuKnockbackRuntimePatch; mirrors BCU Entity.KBManager fields/updateKB movement rules',
    state: actor.state,
    kbType: actor.kbBcuType,
    kbTime: actor.bcuKbTime,
    kbTimeInitial: actor.bcuKbTimeInitial,
    kbDis: actor.bcuKbDis,
    tempKBtype: actor.bcuTempKbType || null,
    tempKBdist: actor.bcuTempKbDist || 0,
    initPos: actor.bcuKbInitPos,
    kbDuration: actor.bcuKbDuration,
    easeTime: actor.bcuKbEaseTime,
    x: actor.x,
    hp: actor.hp,
    deathAfterKnockback: actor.deathAfterKnockback === true,
    touchState: actor.getTouchState?.() || null,
    ...extra
  };
}

if (!BattleActor.prototype[ACTOR_FLAG]) {
  BattleActor.prototype[ACTOR_FLAG] = true;

  BattleActor.prototype.queueBcuInterrupt = function queueBcuInterrupt(type, dist, detail = {}) {
    const t = String(type || '');
    if (!Object.prototype.hasOwnProperty.call(KB_PRI, t)) return false;
    if (this.state === 'dead' || this.state === 'removed') return false;
    const prev = this.bcuTempKbType || null;
    if (!prev || KB_PRI[t] >= KB_PRI[prev]) {
      this.bcuTempKbType = t;
      this.bcuTempKbDist = finite(dist, KB_DIS[t] ?? 0);
      this.bcuTempKbDetail = detail;
      updateKbDebug(this, { queued: true, queuedType: t, queuedDistance: this.bcuTempKbDist, queueReason: detail.reason || null });
      return true;
    }
    updateKbDebug(this, { queued: false, rejectedType: t, previousQueuedType: prev, reason: 'BCU KB_PRI rejected lower priority interrupt' });
    return false;
  };

  const originalStartKnockback = BattleActor.prototype.startKnockback;
  BattleActor.prototype.startKnockback = function startKnockbackBcuEntity(knockback = null) {
    const kb = knockback || {};
    const spec = resolveSpec(kb, this);
    const bcuType = kb.bcuType || spec.bcuType || 'INT_HB';
    const statusFrames = finite(kb.bcuStatusFrames, finite(spec.statusFrames, KB_STATUS_TIME[bcuType] ?? spec.motionFrames ?? 0));
    const distanceBcu = finite(kb.bcuDistance, finite(spec.distanceBcu, KB_DIS[bcuType] ?? 0));
    const distance = finite(kb.distancePx, convertBcuDistanceToWorld(distanceBcu, kb.tuning || {}));

    this.knockbackSerial += 1;
    this.setState('knockback');
    stopAttackLikeBcu(this);
    this.walking = false;
    this.knockbackType = kb.type || (bcuType === 'INT_KB' ? 'proc' : 'hp');
    this.knockbackReason = kb.reason || 'bcu-entity-kb';
    this.deathAfterKnockback = !!kb.deathAfterKnockback;
    this.kbStartedAtMs = Number.isFinite(kb.nowMs) ? kb.nowMs : null;
    this.kbEndedAtMs = null;

    // BCU doInterrupt(): kbTime = KB_TIME[type], kbDis = d, initPos = pos, kbDuration = kbTime;
    // BCU AnimManager.kbAnim(): if non-warp, kbTime += 1. We store that actual countdown here.
    this.kbSpecType = spec.type;
    this.kbBcuType = bcuType;
    this.kbBcuDistance = distanceBcu;
    this.bcuKbType = bcuType;
    this.bcuKbDis = distance;
    this.bcuKbInitialDis = distance;
    this.bcuKbInitPos = this.x;
    this.bcuKbDuration = statusFrames;
    this.bcuKbEaseTime = 1;
    this.bcuKbTime = statusFrames + (bcuType === 'INT_WARP' ? 0 : 1);
    this.bcuKbTimeInitial = this.bcuKbTime;

    this.kbMotionFramesTotal = this.bcuKbTimeInitial;
    this.kbMotionFrameIndex = 0;
    this.kbRetreatFramesTotal = statusFrames;
    this.kbRetreatFramesRemaining = statusFrames;
    this.kbBcuTimeFrames = this.bcuKbTimeInitial;
    this.kbFramesTotal = this.bcuKbTimeInitial;
    this.kbFramesRemaining = this.bcuKbTimeInitial;
    this.kbMoveFramesTotal = statusFrames;
    this.kbMoveFramesRemaining = statusFrames;
    this.kbFrameIndex = 0;
    this.kbFrameAccumulatorMs = 0;
    this.kbDistanceTotalPx = distance;
    this.kbRemainingDistancePx = distance;
    this.kbDistanceTotalWorld = distance;
    this.kbRemainingDistanceWorld = distance;
    this.kbStartX = this.x;
    this.kbLastFrameX = this.x;
    this.kbMoveMode = bcuType === 'INT_KB' ? 'bcu-easeOut' : 'bcu-linearRemaining';
    this.kbTouchState = this.deathAfterKnockback ? 'finalKb' : 'kb';
    this.kbTargetable = false;
    this.kbTouchable = false;
    this.knockbackFromX = this.x;
    this.knockbackToX = this.x - this.direction * distance;
    this.kbCombatEasing = this.kbMoveMode;
    this.kbVisualEasing = 'none';
    this.kbDisableSyntheticBounce = true;
    this.resetKnockbackVisual?.();
    this.detachKbeff?.();

    const useKbeffParent = this.isKbeffParentKbType?.(bcuType);
    const useUnitKbAnim = this.isUnitKnockbackAnimType?.(bcuType);
    if (kb.kbeffRuntime && useKbeffParent) {
      this.kbeffRuntime = kb.kbeffRuntime;
      this.kbeffRuntime.reset();
      if (kb.kbeffInitialUpdate !== false) this.kbeffRuntime.stepFrame();
      this.kbeffEnabled = true;
      this.kbeffType = bcuType;
      this.kbeffSource = 'BCU A_KB runtime if explicitly verified/enabled';
      this.updateKbeffTransform?.();
    }
    if (useKbeffParent) {
      if (this.activeAnimRole === 'attack') {
        this.setAnimation(this.idleAnimId || this.moveAnimId || this.currentAnimId, 'knockback-kbeff-base', true);
      } else {
        this.activeAnimRole = 'knockback-kbeff-base';
      }
      this.applyCurrentAnimationFrame?.();
    } else if (useUnitKbAnim) {
      this.setAnimation(this.knockbackAnimId, 'knockback', true);
      this.applyCurrentAnimationFrame?.();
    } else {
      this.applyCurrentAnimationFrame?.();
    }

    this.lastKnockbackDebug = {
      serial: this.knockbackSerial,
      type: this.knockbackType,
      reason: this.knockbackReason,
      bcuType,
      specType: spec.type,
      fromX: this.knockbackFromX,
      toX: this.knockbackToX,
      distancePx: distance,
      bcuDistance: distanceBcu,
      bcuStatusFrames: statusFrames,
      framesTotal: this.kbFramesTotal,
      moveFramesTotal: this.kbMoveFramesTotal,
      moveMode: this.kbMoveMode,
      targetableDuringKb: false,
      touchableDuringKb: false,
      deathAfterKnockback: this.deathAfterKnockback,
      bcuReference: 'Entity.KBManager.doInterrupt + AnimManager.kbAnim non-warp + updateKB'
    };
    updateKbDebug(this, { started: true });
    return undefined;
  };

  BattleActor.prototype.stepKnockbackFrame = function stepKnockbackFrameBcuEntity() {
    if (this.state !== 'knockback') return { active: false, done: true, moved: 0 };
    if (!(this.bcuKbTime > 0)) return { active: false, done: true, moved: 0 };

    this.bcuKbTime -= 1;
    this.kbMotionFrameIndex += 1;
    this.kbFrameIndex = this.kbMotionFrameIndex;
    let moved = 0;

    if (this.bcuKbTime === 0) {
      this.kbFramesRemaining = 0;
      this.kbMoveFramesRemaining = 0;
      this.kbRetreatFramesRemaining = 0;
      this.kbRemainingDistancePx = Math.max(0, this.bcuKbDis || 0);
      this.kbRemainingDistanceWorld = this.kbRemainingDistancePx;
      this.kbLastFrameX = this.x;
      this.kbEndedAtMs = this.lastSceneTimeMs ?? this.kbEndedAtMs;
      this.detachKbeff?.();
      if (this.deathAfterKnockback || this.deathPending || this.hp <= 0) {
        this.enterDeadState?.(this.lastSceneTimeMs ?? 0);
      } else {
        this.setState('move');
        this.setAnimation(this.moveAnimId || this.idleAnimId || this.currentAnimId, 'move', true);
        this.kbTouchState = 'normal';
        this.kbTargetable = true;
        this.kbTouchable = true;
      }
      this.applyCurrentAnimationFrame?.();
      updateKbDebug(this, { ended: true, moved: 0 });
      return { active: false, done: true, moved: 0, progress: 1 };
    }

    if (this.kbBcuType !== 'INT_WARP') {
      if (this.kbBcuType !== 'INT_KB') {
        const divisor = Math.max(1, this.bcuKbTime);
        const mov = this.bcuKbDis / divisor;
        this.bcuKbDis -= mov;
        moved = kbMove(this, mov);
      } else {
        if (this.bcuKbEaseTime === 1) this.bcuKbDuration = this.bcuKbTime;
        const target = easeOut(this.bcuKbEaseTime, this.bcuKbInitPos, this.bcuKbDis, Math.max(1, this.bcuKbDuration), -this.direction);
        const mov = (target - this.x) * -this.direction;
        moved = kbMove(this, mov);
        this.bcuKbEaseTime += 1;
      }
    }

    this.kbFramesRemaining = this.bcuKbTime;
    this.kbRetreatFramesRemaining = Math.max(0, this.bcuKbTime - 1);
    this.kbMoveFramesRemaining = this.kbRetreatFramesRemaining;
    this.kbRemainingDistancePx = Math.max(0, this.bcuKbDis || 0);
    this.kbRemainingDistanceWorld = this.kbRemainingDistancePx;
    this.kbLastFrameX = this.x;
    const progress = this.kbFramesTotal > 0 ? this.kbFrameIndex / this.kbFramesTotal : 1;
    this.updateKnockbackVisual?.(progress);
    if (this.kbeffEnabled && this.kbeffRuntime) {
      this.kbeffRuntime.stepFrame();
      this.updateKbeffTransform?.();
    }
    this.lastKnockbackFrameDebug = {
      frameIndex: this.kbFrameIndex,
      framesRemaining: this.kbFramesRemaining,
      moveFramesRemaining: this.kbMoveFramesRemaining,
      moved,
      x: this.x,
      remainingDistancePx: this.kbRemainingDistancePx,
      progress,
      moveMode: this.kbMoveMode,
      bcuType: this.kbBcuType,
      bcuTimeFrames: this.kbBcuTimeFrames,
      kbeffFrame: this.kbeffFrame,
      bcuReference: 'Entity.KBManager.updateKB'
    };
    updateKbDebug(this, { moved, progress });
    return { active: true, done: false, moved, progress };
  };

  BattleActor.prototype.isKbTargetableNow = function isKbTargetableNowBcu() {
    return this.state !== 'knockback';
  };

  BattleActor.prototype.getTouchState = function getTouchStateBcu() {
    if (this.state === 'dead') return 'dead';
    if (this.state === 'knockback') return 'kb';
    return 'normal';
  };

  const originalResolvePostDamage = BattleActor.prototype.resolvePostDamage;
  BattleActor.prototype.resolvePostDamage = function resolvePostDamageBcuEntity({ nowMs = 0, tuning = {} } = {}) {
    if (this.pendingDamage <= 0) return { damaged: false, dead: false, knockedBack: false };
    if (!this.isAlive()) { this.clearPendingDamage?.(); return { damaged: false, dead: false, knockedBack: false }; }
    const damage = Math.max(0, this.pendingDamage);
    const hpBefore = this.hp;
    const hb = Math.max(1, this.knockbacks || 1);
    let ext = (hpBefore * hb) % this.maxHp;
    if (ext === 0) ext = this.maxHp;
    const shouldHb = !this.isBase && damage > 0 && this.state !== 'knockback' && ext <= damage * hb;
    const hpAfter = Math.max(0, hpBefore - damage);
    this.hp = hpAfter;
    this.lastDamageResolveDebug = {
      serial: ++this.damageResolveSerial,
      source: 'BcuKnockbackRuntimePatch.resolvePostDamageBcuEntity',
      bcuReference: 'Entity.postUpdate ext <= damage * hb || health < damage before health -= damage',
      hpBefore,
      hpAfter,
      damage,
      hb,
      ext,
      shouldHb,
      pendingHitCount: this.pendingHits.length
    };
    const deathReached = hpAfter <= 0;
    if (deathReached) {
      this.deathPending = true;
      this.isAliveFlag = false;
      this.lastKilledBy = this.pendingHits.slice();
    }
    this.clearPendingDamage?.();
    const result = { damaged: true, hpBefore, hpAfter, damage, dead: false, deathPending: deathReached, knockedBack: false };
    if (shouldHb) {
      this.startKnockback({ type: deathReached ? 'final' : 'hp', reason: deathReached ? 'final-hp-death' : 'hp-threshold', deathAfterKnockback: deathReached, bcuType: 'INT_HB', bcuDistance: KB_DIS.INT_HB, bcuStatusFrames: KB_STATUS_TIME.INT_HB, specType: 'HP_KB', tuning, nowMs });
      result.knockedBack = true;
    } else if (deathReached) {
      this.enterDeadState?.(nowMs);
      result.dead = true;
    }
    this.lastKbRuntimePostDamageDebug = {
      source: 'BcuKnockbackRuntimePatch.resolvePostDamageBcuEntity',
      damaged: result.damaged,
      dead: result.dead,
      deathPending: result.deathPending,
      knockedBack: result.knockedBack,
      hp: this.hp,
      maxHp: this.maxHp,
      knockbackType: this.knockbackType,
      knockbackReason: this.knockbackReason
    };
    return result;
  };
}

if (BattleScene?.prototype && !BattleScene.prototype[SCENE_FLAG]) {
  BattleScene.prototype[SCENE_FLAG] = true;
  const originalSpawnActor = BattleScene.prototype.spawnActor;
  BattleScene.prototype.spawnActor = function spawnActorWithBcuKbScene(unitDef, side, isPlayerProduced = false, options = {}) {
    const actor = originalSpawnActor.call(this, unitDef, side, isPlayerProduced, options);
    if (actor) {
      actor.scene = this;
      actor.isBase = false;
      actor.bcuBossSpawnOffset = options?.row?.bossFlag ? (this.stage?.runtime?.bossSpawnWorldX || this.stage?.runtime?.boss_spawn || 0) : 0;
      if (Number.isFinite(actor.rawStats?.limit) === false) actor.rawStats = { ...(actor.rawStats || {}), limit: 0 };
    }
    return actor;
  };
}

export function getBcuKnockbackPatchDebug() {
  return { installed: true, actorPatched: !!BattleActor.prototype[ACTOR_FLAG], scenePatched: !!BattleScene?.prototype?.[SCENE_FLAG], KB_PRI, KB_STATUS_TIME, KB_DIS };
}

globalThis.__BCU_KNOCKBACK_RUNTIME_PATCH_DEBUG__ = getBcuKnockbackPatchDebug();
