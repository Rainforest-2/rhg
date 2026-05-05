import { BcuAnimator } from '../bcu/BcuAnimator.js';
import { BattleBodyResolver } from './BattleBodyResolver.js';
import { BattleAttackProfile } from './BattleAttackProfile.js';

export class BattleActor {
  constructor({ assetDef, sprite, model, side, x, y, scale = 1, facing = 1, direction = 1, renderFlipX = false, currentAnimId = 'anim00', stats = null, animations = {}, attackAnimId = 'anim02', moveAnimId = 'anim00', idleAnimId = 'anim00', knockbackAnimId = 'anim03', fps = 30, logs = [], collisionRadius = 42, attackWaitMultiplier = 1, attackPhaseTimeMultiplier = 1, attackAnimationSpeedMultiplier = 1, postAttackIdleHoldMs = 0, minAttackWaitMs = 0, combatBodyHalfWidthPx = null, combatBodyHeightPx = null, combatBodyYOffsetPx = 0, combatBodyWidthPx = null, combatPositionOffsetPx = 0, combatPositionSource = 'visual-leading-edge', combatEdgeInsetPx = 0, combatPositionMode = 'screen-combat-point' }) {
    this.assetDef = assetDef; this.sprite = sprite; this.model = model; this.side = side; this.x = x; this.y = y; this.scale = scale;
    this.facing = facing; this.direction = direction; this.renderFlipX = renderFlipX;
    this.currentAnimId = currentAnimId; this.rawStats = stats; this.animations = new Map(Object.entries(animations));
    this.animator = new BcuAnimator(this.animations.get(currentAnimId) || { tracks: [], maxFrame: 1 });
    this.fps = fps;
    this.logs = logs;

    this.maxHp = stats?.hp ?? 100; this.hp = this.maxHp; this.damage = stats?.damage ?? 0;
    this.moveSpeed = 0; this.detectionRangePx = 0; this.collisionRadius = collisionRadius;
    this.combatBodyWidthPx = Number.isFinite(combatBodyWidthPx) ? combatBodyWidthPx : 44;
    this.combatBodyHeightPx = Number.isFinite(combatBodyHeightPx) ? combatBodyHeightPx : 72;
    this.combatBodyYOffsetPx = Number.isFinite(combatBodyYOffsetPx) ? combatBodyYOffsetPx : 0;
    this.combatBodyFrontOffsetLocalX = 0;
    this.combatBodyFrontInitialized = false;
    this.combatBodyFrontSource = 'actor-x';
    this.combatPositionOffsetPx = Number.isFinite(combatPositionOffsetPx) ? combatPositionOffsetPx : 0;
    this.combatPositionSource = combatPositionSource || 'visual-leading-edge';
    this.combatEdgeInsetPx = Number.isFinite(combatEdgeInsetPx) ? combatEdgeInsetPx : 0;
    this.combatPositionMode = combatPositionMode || 'screen-combat-point';
    this.autoCombatPositionOffsetLocalX = 0;
    this.autoCombatPositionOffsetWorldPx = 0;
    this.autoCombatPositionInitialized = false;
    this.autoCombatPositionSource = 'not-initialized';
    this.autoCombatPositionCandidateCount = 0;
    this.autoCombatPositionRejectedCount = 0;
    this.autoCombatPositionDebug = null;
    this.resolvedCombatEdgeLocalX = 0;
    this.resolvedCombatEdgeWorldOffsetPx = 0;
    this.resolvedCombatEdgeInitialized = false;
    this.resolvedCombatEdgeSource = 'not-initialized';
    this.resolvedCombatEdgeCandidateCount = 0;
    this.resolvedCombatEdgeRejectedCount = 0;
    this.resolvedCombatEdgeDebug = null;
    this.combatPositionDebug = {
      mode: this.combatPositionMode,
      edgeInsetPx: this.combatEdgeInsetPx,
      source: this.combatPositionSource
    };
    this.attackWaitFrames = stats?.attackWaitFrames ?? 0; this.attackStartupFrames = stats?.attackStartupFrames ?? 0; this.attackType = stats?.attackType ?? 0;
    this.attackWaitMultiplier = Number.isFinite(attackWaitMultiplier) ? attackWaitMultiplier : 1;
    this.attackPhaseTimeMultiplier = Number.isFinite(attackPhaseTimeMultiplier) ? attackPhaseTimeMultiplier : 1;
    this.attackAnimationSpeedMultiplier = Number.isFinite(attackAnimationSpeedMultiplier) ? attackAnimationSpeedMultiplier : 1;
    this.postAttackIdleHoldMs = Number.isFinite(postAttackIdleHoldMs) ? postAttackIdleHoldMs : 0;
    this.minAttackWaitMs = Number.isFinite(minAttackWaitMs) ? minAttackWaitMs : 0;
    const rawAttackWaitMs = (this.attackWaitFrames / fps) * 1000;
    const scaledAttackWaitMs = rawAttackWaitMs * this.attackWaitMultiplier;
    const scaledMinAttackWaitMs = this.minAttackWaitMs * this.attackWaitMultiplier;
    this.attackWaitMs = Math.max(scaledAttackWaitMs, scaledMinAttackWaitMs, this.postAttackIdleHoldMs);
    this.attackPostHitWaitMs = this.attackWaitMs;
    this.nextAttackReadyMs = this.attackWaitMs;
    this.attackStartupMs = Math.max(0, (this.attackStartupFrames / fps) * 1000) * this.attackPhaseTimeMultiplier;
    this.attackElapsedMs = 0; this.attackWaitElapsedMs = 0; this.hasHitInCurrentAttack = false; this.attackCycleId = 0;
    this.attackProfile = null;
    this.resolvedAttackEventKeys = new Set();
    this.targetId = null; this.attackTarget = null; this.attackTargetType = null; this.attackStartedAtMs = 0; this.state = 'move'; this.isAliveFlag = true;

    this.moveAnimId = moveAnimId; this.idleAnimId = idleAnimId; this.attackAnimId = attackAnimId; this.knockbackAnimId = knockbackAnimId;
    const rawAttackAnimDurationMs = this.deriveAnimDurationMs(attackAnimId, fps, 250, 'attackAnimDuration fallback to 250ms');
    this.attackAnimDurationMs = rawAttackAnimDurationMs * this.attackPhaseTimeMultiplier;
    this.knockbackAnimDurationMs = this.deriveAnimDurationMs(knockbackAnimId, fps, 250, 'knockbackAnimDuration fallback to 250ms');
    this.knockbackAnimVerified = this.verifyKnockbackAnim(knockbackAnimId);
    this.knockbackAnimSource = this.knockbackAnimVerified ? 'verified' : 'provisional';

    this.knockbacks = Math.max(1, Number(stats?.knockbacks) || 1);
    this.knockbackCount = 0;
    this.knockbackHpStep = this.maxHp / this.knockbacks;
    this.nextKnockbackHp = this.maxHp - this.knockbackHpStep;
    this.knockbackPositionElapsedMs = 0;
    this.knockbackPositionDurationMs = this.knockbackAnimDurationMs;
    this.knockbackPositionDistance = 60;
    this.knockbackFromX = this.x;
    this.knockbackToX = this.x;

    this.pendingDamage = 0;
    this.pendingHits = [];
    this.lastHitBy = null;
    this.lastKilledBy = null;
    this.pendingKnockback = null;
    this.deathPending = false;
    this.deadAtMs = null;
    this.deathElapsedMs = 0;
    this.deathHoldMs = 650;
    this.removeAfterMs = 1000;
    this.deathResolved = false;
    this.knockbackType = null;
    this.knockbackReason = null;
    this.deathAfterKnockback = false;
    this.visualRenderOffsetLocalX = 0;
    this.visualRenderOffsetWorldPx = 0;
    this.visualRenderOffsetInitialized = false;
    this.visualRenderOffsetSource = 'not-initialized';
    this.visualRenderOffsetDebug = null;

    this.lastCaptureDebug = null;
    this.lastHitQueueDebug = null;
    this.lastDamageDebug = null;

    this.activeAnimId = currentAnimId;
    this.activeAnimRole = 'move';
  }

  deriveAnimDurationMs(animId, fps, fallbackMs, warnMsg) {
    const anim = this.animations.get(animId);
    if (anim && Number.isFinite(anim.maxFrame) && anim.maxFrame > 0) return (anim.maxFrame / fps) * 1000;
    this.logs?.push({ level: 'warn', msg: `${this.assetDef?.id || '-'} ${warnMsg}` });
    return fallbackMs;
  }

  verifyKnockbackAnim(animId) {
    const anim = this.animations.get(animId);
    if (!anim) return false;
    return (anim.tracks || []).some((t) => String(t?.name || '').includes('ノックバック') || String(t?.rawHeader || '').includes('ノックバック'));
  }


  getBattlePartLocalBoundsForCombat(p) {
    return BattleBodyResolver.getPartLocalBounds(this, p);
  }

  initializeCombatBodyFrontFromModel() {
    return BattleBodyResolver.initializeActorCombatFront(this);
  }

  getCombatBodyFrontX() {
    return BattleBodyResolver.getActorFrontX(this);
  }

  getCombatBodyBox() {
    return BattleBodyResolver.getActorCombatBodyBox(this);
  }

  getCombatBodyDistanceTo(other) {
    return BattleBodyResolver.getCombatBodyDistance(this, other);
  }

  getCenterDistanceTo(other) { return Math.abs(this.x - other.x); }
  getBodyDistanceTo(other) { return Math.max(0, this.getCenterDistanceTo(other) - this.collisionRadius - (other?.collisionRadius || 0)); }
  getEngageDistanceTo(other) { return Math.min(this.detectionRangePx, other?.detectionRangePx || this.detectionRangePx); }

  refreshAttackProfile() {
    this.attackProfile = BattleAttackProfile.fromActor(this);
    return this.attackProfile;
  }

  getAttackProfile() {
    return BattleAttackProfile.ensure(this);
  }

  isAlive() { return this.isAliveFlag && this.hp > 0 && this.state !== 'dead' && this.state !== 'dying'; }
  isFinalKnockback() { return this.state === 'knockback' && (this.deathAfterKnockback || this.deathPending || this.hp <= 0); }
  needsLifecycleTick() { return this.isAlive() || this.state === 'knockback' || this.state === 'dead' || this.deathPending || this.deathAfterKnockback; }
  isTargetable() { return this.isAlive(); }
  isCombatAlive() { return this.isAlive(); }
  isRenderable() {
    if (this.state === 'removed') return false;
    if (this.isAlive()) return true;
    if (this.state === 'knockback' && (this.deathAfterKnockback || this.deathPending || this.hp <= 0)) return true;
    if (this.state === 'dying' || this.state === 'dead') return true;
    return false;
  }
  isRemovable(nowMs = 0) { if (this.state !== 'dead') return false; if (!Number.isFinite(this.deadAtMs)) return false; const removeAfter = Number.isFinite(this.removeAfterMs) ? this.removeAfterMs : 1000; return nowMs - this.deadAtMs >= removeAfter; }
  setAnimation(animId, role, restart = false) {
    if (!animId) return;
    if (this.currentAnimId === animId && !restart) return;
    this.animator = new BcuAnimator(this.animations.get(animId) || this.animations.get('anim00') || { tracks: [], maxFrame: 1 });
    if (role === 'attack') { this.animator.setSpeed(this.attackAnimationSpeedMultiplier); this.animator.setLoop(false); }
    else { this.animator.setSpeed(1); this.animator.setLoop(true); }
    this.currentAnimId = animId;
    this.activeAnimId = animId;
    this.activeAnimRole = role || this.activeAnimRole;
  }

  setState(nextState) {
    if (this.state === nextState) return false;
    this.state = nextState;
    if (nextState === 'attack') { this.attackElapsedMs = 0; this.hasHitInCurrentAttack = false; this.resolvedAttackEventKeys = new Set(); this.attackCycleId += 1; }
    if (nextState === 'attack-wait') this.attackWaitElapsedMs = 0;
    return true;
  }

  startKnockback(knockback = null) {
    const kb = knockback || {};
    this.setState('knockback');
    this.attackElapsedMs = 0; this.attackWaitElapsedMs = 0; this.hasHitInCurrentAttack = false;
    this.resolvedAttackEventKeys = new Set();
    this.knockbackType = kb.type || 'hp';
    this.knockbackReason = kb.reason || 'hp-threshold';
    this.deathAfterKnockback = !!kb.deathAfterKnockback;
    this.knockbackPositionElapsedMs = 0;
    this.knockbackPositionDurationMs = Number.isFinite(kb.durationMs) ? kb.durationMs : this.knockbackAnimDurationMs;
    const distance = Number.isFinite(kb.distancePx) ? kb.distancePx : this.knockbackPositionDistance;
    this.knockbackFromX = this.x;
    this.knockbackToX = this.x - this.direction * distance;
    if (this.deathAfterKnockback || kb.deathAfterKnockback) { this.attackTarget = null; this.attackTargetType = null; }
    this.setAnimation(this.knockbackAnimId, 'knockback', true); this.applyCurrentAnimationFrame();
  }

  clearPendingDamage() { this.pendingDamage = 0; this.pendingHits = []; }

  takeDamage(amount, meta = {}) {
    if (!this.isAlive()) return { accepted: false, dead: false, knockedBack: false, pending: false };
    const damage = Math.max(0, Number.isFinite(amount) ? amount : 0);
    if (damage <= 0) return { accepted: false, dead: false, knockedBack: false, pending: false };
    this.pendingDamage += damage;
    this.pendingHits.push({ amount: damage, attacker: meta.attacker || null, hitIndex: meta.hitIndex ?? null, attackEventKey: meta.attackEventKey || null, timeMs: meta.timeMs ?? null });
    this.lastHitBy = meta.attacker || this.lastHitBy;
    return { accepted: true, pending: true, damage, dead: false, knockedBack: false };
  }

  resolvePostDamage({ nowMs = 0, tuning = {} } = {}) {
    if (this.pendingDamage <= 0) return { damaged: false, dead: false, knockedBack: false };
    if (!this.isAlive()) { this.clearPendingDamage(); return { damaged: false, dead: false, knockedBack: false }; }
    const damage = Math.max(0, this.pendingDamage);
    const hpBefore = this.hp;
    const hpAfter = Math.max(0, hpBefore - damage);
    let shouldKnockback = false;
    const deathReached = hpAfter <= 0;
    if (!deathReached && this.knockbacks > 1 && hpAfter <= this.nextKnockbackHp) shouldKnockback = true;
    if (!deathReached && this.knockbacks > 1) {
      const crossedCount = Math.min(this.knockbacks - 1, Math.max(0, Math.floor((this.maxHp - hpAfter) / this.knockbackHpStep)));
      if (crossedCount > this.knockbackCount) {
        shouldKnockback = true;
        this.knockbackCount = crossedCount;
        this.nextKnockbackHp = Math.max(0, this.maxHp - this.knockbackHpStep * (this.knockbackCount + 1));
      }
    }
    const finalKb = !!tuning.finalKnockbackBeforeDeath;
    if (deathReached && finalKb && this.state !== 'knockback') shouldKnockback = true;
    this.hp = hpAfter;
    const result = { damaged: true, hpBefore, hpAfter, damage, dead: false, deathPending: false, knockedBack: false };
    if (shouldKnockback) {
      this.pendingKnockback = {
        type: 'hp', reason: deathReached ? 'final-hp-death' : 'hp-threshold',
        distancePx: Number.isFinite(tuning.hpKnockbackDistancePx) ? tuning.hpKnockbackDistancePx : (this.knockbackPositionDistance || 60),
        durationMs: Number.isFinite(tuning.hpKnockbackDurationMs) ? tuning.hpKnockbackDurationMs : this.knockbackAnimDurationMs,
        deathAfterKnockback: deathReached
      };
    }
    if (deathReached) { this.deathPending = true; this.isAliveFlag = false; this.lastKilledBy = this.pendingHits.slice(); result.deathPending = true; }
    this.clearPendingDamage();
    if (this.pendingKnockback) { this.startKnockback(this.pendingKnockback); result.knockedBack = true; this.pendingKnockback = null; }
    else if (deathReached) { this.enterDeadState(nowMs); result.dead = true; }
    return result;
  }

  enterDeadState(nowMs = 0) {
    if (this.state === 'dead') return;
    this.state = 'dead';
    this.isAliveFlag = false;
    this.deadAtMs = Number.isFinite(nowMs) ? nowMs : 0;
    this.deathElapsedMs = 0;
    this.attackTarget = null;
    this.attackTargetType = null;
    this.pendingKnockback = null;
    this.deathPending = false;
    this.deathResolved = true;
    this.deathAfterKnockback = false;
    this.knockbackReason = this.knockbackReason || 'death';
  }

  applyCurrentAnimationFrame() { if (!this.model) return; this.model.reset(); this.animator.apply(this.model); }

  tick(dt) {
    if (!this.model || this.state === 'removed') return;
    if (this.state === 'dead') { this.deathElapsedMs += dt; return; }
    if (!this.isAlive() && this.state !== 'knockback') return;
    this.animator.tick(dt); this.model.reset(); this.animator.apply(this.model);
  }

  getRenderOriginOffsetPx() {
    return Number.isFinite(this.visualRenderOffsetWorldPx) ? this.visualRenderOffsetWorldPx : 0;
  }
}
