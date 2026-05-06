import { BcuAnimator } from '../bcu/BcuAnimator.js';
import { BattleBodyResolver } from './BattleBodyResolver.js';
import { BattleAttackProfile } from './BattleAttackProfile.js';
import { getBcuKnockbackSpec, convertBcuDistanceToPx, getDefaultSpecTypeForKind } from './BcuKnockbackSpec.js';

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
    this.attackCooldownUntilMs = 0;
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
    this.knockbackSerial = 0;
    this.damageResolveSerial = 0;
    this.lastKnockbackDebug = null;
    this.lastDamageResolveDebug = null;
    this.kbStartedAtMs = null;
    this.kbEndedAtMs = null;
    this.kbTargetable = true;
    this.kbTouchable = true;
    this.kbVisualOffsetX = 0;
    this.kbVisualOffsetY = 0;
    this.kbVisualScale = 1;
    this.kbVisualProgress = 0;
    this.kbVisualSource = 'none';
    this.kbBcuType = null;
    this.kbBcuTimeFrames = 0;
    this.kbFramesTotal = 0;
    this.kbFramesRemaining = 0;
    this.kbMoveFramesTotal = 0;
    this.kbMoveFramesRemaining = 0;
    this.kbFrameIndex = 0;
    this.kbFrameAccumulatorMs = 0;
    this.kbDistanceTotalPx = 0;
    this.kbRemainingDistancePx = 0;
    this.kbStartX = this.x;
    this.kbLastFrameX = this.x;
    this.kbMoveMode = 'linearRemaining';
    this.kbDistanceSource = 'none';
    this.kbDistanceScale = null;
    this.kbDisableSyntheticBounce = false;
    this.kbTouchState = 'normal';
    this.lastKnockbackFrameDebug = null;
    this.kbeffRuntime = null;
    this.kbeffType = null;
    this.kbeffEnabled = false;
    this.kbeffParentTransform = null;
    this.kbeffParentMatrix = null;
    this.kbeffFrame = 0;
    this.kbeffSource = 'none';
    this.lastKbeffDebug = null;

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
    this.stableRenderOffsetWorldPx = 0;
    this.stableRenderOffsetLocalX = 0;
    this.stableRenderOffsetInitialized = false;
    this.stableRenderOffsetSource = 'not-initialized';
    this.stableRenderOffsetDebug = null;
    this.stableGroundAnchorLocalY = 0;
    this.stableGroundAnchorInitialized = false;
    this.stableGroundAnchorSource = 'not-initialized';
    this.stableGroundAnchorDebug = null;
    this.lastRenderOffsetWorldPx = 0;
    this.lastGroundAnchorLocalY = 0;
    this.lastGroundAnchorDebug = null;
    this.lastRenderAnchorJumpDebug = null;

    this.visualCrowdLaneIndex = 0;
    this.visualCrowdLaneCount = 1;
    this.visualCrowdYOffsetPx = 0;
    this.visualCrowdScaleMultiplier = 1;
    this.visualCrowdFanoutPx = 0;
    this.visualCrowdClusterIndex = 0;
    this.visualCrowdSource = 'none';

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
  isKnockbacking() { return this.state === 'knockback'; }
  isDyingOrDead() { return this.state === 'dying' || this.state === 'dead' || this.deathPending || this.deathAfterKnockback || this.hp <= 0; }
  isFinalKnockback() { return this.state === 'knockback' && (this.deathAfterKnockback || this.deathPending || this.hp <= 0); }
  needsLifecycleTick() { return this.isAlive() || this.state === 'knockback' || this.state === 'dead' || this.deathPending || this.deathAfterKnockback; }
  getTouchState() { if (this.state === 'dead') return 'dead'; if (this.state === 'knockback' && (this.deathAfterKnockback || this.deathPending || this.hp <= 0)) return 'finalKb'; if (this.state === 'knockback') return 'kb'; return 'normal'; }
  isKbTargetableNow() { if (this.state !== 'knockback') return true; const f = this.kbMotionFrameIndex || 0; if (this.kbFirstFrameTargetable && f === 0) return true; if (f >= (this.kbTargetableFromFrame || 0)) return true; return false; }
  isTargetable() { if (!this.isAlive()) return false; if (this.state === 'knockback') return this.isKbTargetableNow(); return true; }
  isTouchable() { if (!this.isAlive()) return false; if (this.state === 'knockback') return this.isKbTargetableNow(); return true; }
  isCombatAlive() { return this.isTargetable(); }
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


  getKnockbackConfig(tuning = {}, kind = 'hp') {
    const kb = tuning.knockback || {};
    const map = {
      hp: { config: kb.hpKb || {}, defaults: { type: 'hp', specType:'HP_KB', bcuType: 'INT_HB', bcuTimeFrames: 24, bcuDistance: 345, moveMode: 'linearRemaining', visualOffsetYMaxPx: 0, visualBackSwingPx: 0, visualScalePeak: 1, reason: 'hp-threshold' } },
      final: { config: kb.finalKb || {}, defaults: { type: 'final', specType:'HP_KB', bcuType: 'INT_HB', bcuTimeFrames: 24, bcuDistance: 345, moveMode: 'linearRemaining', visualOffsetYMaxPx: 0, visualBackSwingPx: 0, visualScalePeak: 1, reason: 'final-hp-death' } },
      proc: { config: kb.procKb || {}, defaults: { type: 'proc', specType:'PROC_KB_WHITE', bcuType: 'INT_KB', bcuTimeFrames: 12, bcuDistance: 165, moveMode: 'linearRemaining', visualOffsetYMaxPx: 0, visualBackSwingPx: 0, visualScalePeak: 1, reason: 'proc-kb' } },
      bossShockwave: { config: kb.bossShockwaveKb || {}, defaults: { type: 'bossShockwave', specType:'BOSS_SHOCKWAVE', bcuType: 'INT_SW', bcuTimeFrames: 47, bcuDistance: 704, moveMode: 'linearRemaining', visualOffsetYMaxPx: 0, visualBackSwingPx: 0, visualScalePeak: 1, reason: 'boss-shockwave' } },
      assist: { config: kb.assistKb || {}, defaults: { type: 'assist', specType:'CANNON', bcuType: 'INT_ASS', bcuTimeFrames: 12, bcuDistance: 55, moveMode: 'linearRemaining', visualOffsetYMaxPx: 0, visualBackSwingPx: 0, visualScalePeak: 1, reason: 'assist-kb' } }
    };
    const entry = map[kind] || map.hp;
    const c = entry.config || {};
    const d = entry.defaults || map.hp.defaults;
    const moveMode = c.combatEasing === 'easeOutQuad' ? 'easeOut' : (c.moveMode || d.moveMode);
    return {
      type: c.type || d.type,
      bcuType: c.bcuType || d.bcuType,
      bcuTimeFrames: c.bcuTimeFrames ?? d.bcuTimeFrames,
      bcuDistance: c.bcuDistance ?? d.bcuDistance,
      moveMode,
      durationMs: c.durationMs ?? tuning.hpKnockbackDurationMs ?? this.knockbackAnimDurationMs,
      distancePx: Number.isFinite(c.distancePx) ? c.distancePx : null,
      knockbackDistanceToPx: kb.knockbackDistanceToPx ?? tuning.rangeToPx ?? 0.27,
      tuning,
      combatEasing: c.combatEasing || (moveMode === 'easeOut' ? 'easeOutQuad' : 'linearRemaining'),
      visualEasing: c.visualEasing || 'none',
      visualOffsetYMaxPx: c.visualOffsetYMaxPx ?? d.visualOffsetYMaxPx,
      visualBackSwingPx: c.visualBackSwingPx ?? d.visualBackSwingPx,
      visualScalePeak: c.visualScalePeak ?? d.visualScalePeak,
      disableSyntheticBounce: !!c.disableSyntheticBounce,
      distanceSource: c.distanceSource || null,
      targetableDuringKb: c.targetableDuringKb ?? null,
      touchableDuringKb: c.touchableDuringKb ?? null,
      cancelAttackOnKb: c.cancelAttackOnKb !== false,
      enterDeadAfterKb: kind === 'final' ? c.enterDeadAfterKb !== false : !!c.enterDeadAfterKb
    };
  }


  isKbeffParentKbType(type) { return ['INT_HB', 'INT_SW', 'INT_ASS'].includes(type); }
  isUnitKnockbackAnimType(type) { return type === 'INT_KB'; }

  resolveKnockbackSpec(kb = {}) {
    const specType = kb.specType || kb.knockbackSpecType || getDefaultSpecTypeForKind(kb.type || this.knockbackType || 'hp');
    const spec = getBcuKnockbackSpec(specType);
    if (!spec) throw new Error(`Unknown BCU knockback spec: ${specType}`);
    return spec;
  }

  resolveKnockbackDistancePx(kb = {}, tuning = {}) {
    if (Number.isFinite(kb.distancePx)) return { distancePx: kb.distancePx, source: 'explicit-distancePx', scale: null };
    const scale = tuning?.knockback?.knockbackDistanceToPx ?? tuning?.rangeToPx ?? 0.27;
    if (Number.isFinite(kb.bcuDistance) && Number.isFinite(scale)) return { distancePx: kb.bcuDistance * scale, source: 'bcuDistance*knockbackDistanceToPx', scale };
    return { distancePx: this.knockbackPositionDistance, source: 'fallback-knockbackPositionDistance', scale };
  }

  updateKnockbackVisual(progress) { const t = Math.max(0, Math.min(1, progress)); if (this.kbDisableSyntheticBounce) { this.kbVisualOffsetX = 0; this.kbVisualOffsetY = 0; this.kbVisualScale = 1; this.kbVisualProgress = t; return; } this.kbVisualProgress = t; const sin = Math.sin(Math.PI * t); const settle = 1 - t; const yMax = Number.isFinite(this.kbVisualOffsetYMaxPx) ? this.kbVisualOffsetYMaxPx : -32; const backSwing = Number.isFinite(this.kbVisualBackSwingPx) ? this.kbVisualBackSwingPx : 8; const peak = Number.isFinite(this.kbVisualScalePeak) ? this.kbVisualScalePeak : 1.025; this.kbVisualOffsetY = yMax * sin; this.kbVisualOffsetX = -this.direction * backSwing * sin * settle; this.kbVisualScale = 1 + (peak - 1) * sin; }
  resetKnockbackVisual() { this.kbVisualOffsetX = 0; this.kbVisualOffsetY = 0; this.kbVisualScale = 1; this.kbVisualProgress = 0; }

  updateKbeffTransform() {
    if (!this.kbeffEnabled || !this.kbeffRuntime) { this.kbeffParentTransform = null;
    this.kbeffParentMatrix = null; return null; }
    const t = this.kbeffRuntime.getParentTransform(this.scale || 1);
    this.kbeffParentTransform = t; this.kbeffParentMatrix = t.matrix || null; this.kbeffFrame = t.frame;
    this.lastKbeffDebug = { bcuType: this.kbeffType, frame: t.frame, localX: t.localX, localY: t.localY, screenX: t.screenXDebug, screenY: t.screenYDebug, source: this.kbeffSource };
    return t;
  }

  detachKbeff() { this.kbeffRuntime = null; this.kbeffEnabled = false; this.kbeffType = null; this.kbeffParentTransform = null;
    this.kbeffParentMatrix = null; this.kbeffFrame = 0; this.kbeffSource = 'none'; }

  startKnockback(knockback = null) {
    const kb = knockback || {};
    this.knockbackSerial += 1;
    this.setState('knockback');
    this.attackElapsedMs = 0; this.attackWaitElapsedMs = 0; this.hasHitInCurrentAttack = false;
    this.resolvedAttackEventKeys = new Set(); this.attackTarget = null; this.attackTargetType = null;
    this.knockbackType = kb.type || 'hp'; this.knockbackReason = kb.reason || 'hp-threshold'; this.deathAfterKnockback = !!kb.deathAfterKnockback;
    this.kbStartedAtMs = Number.isFinite(kb.nowMs) ? kb.nowMs : null; this.kbEndedAtMs = null; this.kbTargetable = true; this.kbTouchable = true;
    this.knockbackPositionElapsedMs = 0; this.knockbackPositionDurationMs = Number.isFinite(kb.durationMs) ? kb.durationMs : this.knockbackAnimDurationMs;
    const spec = this.resolveKnockbackSpec(kb);
    const tuning = kb.tuning || {};
    const distance = convertBcuDistanceToPx(spec.distanceBcu, tuning);
    this.kbSpecType = spec.type; this.kbBcuType = spec.bcuType; this.kbBcuDistance = spec.distanceBcu;
    this.kbMotionFramesTotal = spec.motionFrames; this.kbMotionFrameIndex = 0;
    this.kbIntangibleFramesTotal = spec.intangibleFrames; this.kbFirstFrameTargetable = !!spec.firstFrameTargetable; this.kbTargetableFromFrame = spec.targetableFromFrame;
    this.kbRetreatFramesTotal = spec.retreatFrames; this.kbRetreatFramesRemaining = spec.retreatFrames; this.kbTimelineDebug = null;
    this.kbBcuTimeFrames = spec.motionFrames; this.kbFramesTotal = spec.motionFrames; this.kbMoveFramesTotal = spec.retreatFrames; this.kbMoveFramesRemaining = spec.retreatFrames; this.kbFramesRemaining = spec.motionFrames; this.kbFrameIndex = 0; this.kbFrameAccumulatorMs = 0;
    this.kbDistanceTotalPx = distance; this.kbRemainingDistancePx = distance; this.kbStartX = this.x; this.kbLastFrameX = this.x; this.kbMoveMode = 'linearRemaining'; this.kbTouchState = this.deathAfterKnockback ? 'finalKb' : 'kb';
    this.knockbackFromX = this.x; this.knockbackToX = this.x - this.direction * distance;
    this.kbCombatEasing = 'linearRemaining'; this.kbVisualEasing = kb.visualEasing || 'none';
    this.kbDisableSyntheticBounce = !!kb.disableSyntheticBounce;
    this.kbDistanceSource = kb.distanceSource || 'BcuKnockbackSpec.distanceBcu * knockbackDistanceToPx';
    this.kbDistanceScale = tuning?.knockback?.knockbackDistanceToPx ?? tuning?.rangeToPx ?? 0.27;
    this.kbVisualOffsetYMaxPx = 0; this.kbVisualBackSwingPx = 0; this.kbVisualScalePeak = 1;
    this.kbDisableSyntheticBounce = true; this.resetKnockbackVisual(); this.kbVisualSource = 'disabled-synthetic-bounce-v0117';
    this.detachKbeff();
    const useKbeffParent = this.isKbeffParentKbType(this.kbBcuType);
    const useUnitKbAnim = this.isUnitKnockbackAnimType(this.kbBcuType);
    if (kb.kbeffRuntime && useKbeffParent) { this.kbeffRuntime = kb.kbeffRuntime; this.kbeffRuntime.reset(); if (kb.kbeffInitialUpdate !== false) this.kbeffRuntime.stepFrame(); this.kbeffEnabled = true; this.kbeffType = this.kbBcuType; this.kbeffSource = 'bcu-a-kb-kbeff-visual-parity-v0116'; this.updateKbeffTransform(); }
    this.lastKnockbackDebug = { serial: this.knockbackSerial, type: this.knockbackType, reason: this.knockbackReason, fromX: this.knockbackFromX, toX: this.knockbackToX, distancePx: distance, durationMs: this.knockbackPositionDurationMs, combatEasing: this.kbCombatEasing, visualEasing: this.kbVisualEasing, visualOffsetYMaxPx: this.kbVisualOffsetYMaxPx, visualBackSwingPx: this.kbVisualBackSwingPx, visualScalePeak: this.kbVisualScalePeak, deathAfterKnockback: this.deathAfterKnockback, targetableDuringKb: this.kbTargetable, touchableDuringKb: this.kbTouchable, bcuType: this.kbBcuType, bcuTimeFrames: this.kbBcuTimeFrames, bcuDistance: kb.bcuDistance ?? null, framesTotal: this.kbFramesTotal, moveFramesTotal: this.kbMoveFramesTotal, moveMode: this.kbMoveMode, distanceSource: this.kbDistanceSource, knockbackDistanceToPx: this.kbDistanceScale };
    if (useKbeffParent) { if (this.activeAnimRole === 'attack') { const fallbackAnim = this.idleAnimId || this.moveAnimId || this.currentAnimId; this.setAnimation(fallbackAnim, 'knockback-kbeff-base', true); } else { this.activeAnimRole = 'knockback-kbeff-base'; } this.applyCurrentAnimationFrame(); } else if (useUnitKbAnim) { this.setAnimation(this.knockbackAnimId, 'knockback', true); this.applyCurrentAnimationFrame(); } else { this.applyCurrentAnimationFrame(); }
  }

  stepKnockbackFrame() {
    if (this.state !== 'knockback') return { active: false, done: true, moved: 0 };
    if (this.kbMotionFrameIndex >= this.kbMotionFramesTotal) return { active: false, done: true, moved: 0 };
    let nextX = this.x; let moved = 0;
    this.kbMotionFrameIndex += 1;
    if (this.kbMotionFrameIndex >= 1 && this.kbMotionFrameIndex <= this.kbRetreatFramesTotal) { const remaining = Math.max(1, this.kbRetreatFramesRemaining); const step = this.kbRemainingDistancePx / remaining; moved = -this.direction * step; this.x += moved; this.kbRemainingDistancePx = Math.max(0, this.kbRemainingDistancePx - step); this.kbRetreatFramesRemaining = Math.max(0, this.kbRetreatFramesRemaining - 1); }
    this.kbFrameIndex = this.kbMotionFrameIndex; this.kbMoveFramesRemaining = this.kbRetreatFramesRemaining; this.kbFramesRemaining = this.kbRetreatFramesRemaining; this.kbLastFrameX = this.x; const progress = this.kbMoveFramesTotal > 0 ? this.kbFrameIndex / this.kbMoveFramesTotal : 1; this.updateKnockbackVisual?.(progress);
    if (this.kbeffEnabled && this.kbeffRuntime) { this.kbeffRuntime.stepFrame(); this.updateKbeffTransform(); }
    this.lastKnockbackFrameDebug = { frameIndex: this.kbFrameIndex, moveFrameIndex: this.kbFrameIndex, framesRemaining: this.kbFramesRemaining, moveFramesRemaining: this.kbMoveFramesRemaining, moved, x: this.x, remainingDistancePx: this.kbRemainingDistancePx, progress, moveMode: this.kbMoveMode, bcuType: this.kbBcuType, bcuTimeFrames: this.kbBcuTimeFrames, kbeffFrame: this.kbeffFrame };
    const done = this.kbMotionFrameIndex >= this.kbMotionFramesTotal;
    return { active: !done, done, moved, progress };
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
    const damage = Math.max(0, this.pendingDamage); const hpBefore = this.hp; const hpAfter = Math.max(0, hpBefore - damage); const deathReached = hpAfter <= 0;
    const previousKbCount = this.knockbackCount; let crossedCount = previousKbCount;
    if (this.knockbacks > 1) crossedCount = Math.min(this.knockbacks - 1, Math.max(0, Math.floor((this.maxHp - hpAfter) / this.knockbackHpStep)));
    const crossedHpKb = !deathReached && crossedCount > previousKbCount;
    let kbRequest = null;
    if (deathReached && tuning.finalKnockbackBeforeDeath !== false) { const cfg = this.getKnockbackConfig(tuning, 'final'); kbRequest = { type: 'final', reason: 'final-hp-death', distancePx: cfg.distancePx, durationMs: cfg.durationMs, combatEasing: cfg.combatEasing, visualEasing: cfg.visualEasing, visualOffsetYMaxPx: cfg.visualOffsetYMaxPx, visualBackSwingPx: cfg.visualBackSwingPx, visualScalePeak: cfg.visualScalePeak, deathAfterKnockback: true, bcuType: cfg.bcuType, bcuTimeFrames: cfg.bcuTimeFrames, bcuDistance: cfg.bcuDistance, moveMode: cfg.moveMode, targetableDuringKb: cfg.targetableDuringKb, touchableDuringKb: cfg.touchableDuringKb, disableSyntheticBounce: cfg.disableSyntheticBounce, distanceSource: cfg.distanceSource, tuning: cfg.tuning, nowMs }; }
    else if (crossedHpKb) { this.knockbackCount = crossedCount; this.nextKnockbackHp = Math.max(0, this.maxHp - this.knockbackHpStep * (this.knockbackCount + 1)); const cfg = this.getKnockbackConfig(tuning, 'hp'); kbRequest = { type: 'hp', reason: 'hp-threshold', distancePx: cfg.distancePx, durationMs: cfg.durationMs, combatEasing: cfg.combatEasing, visualEasing: cfg.visualEasing, visualOffsetYMaxPx: cfg.visualOffsetYMaxPx, visualBackSwingPx: cfg.visualBackSwingPx, visualScalePeak: cfg.visualScalePeak, deathAfterKnockback: false, bcuType: cfg.bcuType, bcuTimeFrames: cfg.bcuTimeFrames, bcuDistance: cfg.bcuDistance, moveMode: cfg.moveMode, targetableDuringKb: cfg.targetableDuringKb, touchableDuringKb: cfg.touchableDuringKb, disableSyntheticBounce: cfg.disableSyntheticBounce, distanceSource: cfg.distanceSource, tuning: cfg.tuning, nowMs }; }
    this.hp = hpAfter;
    this.lastDamageResolveDebug = { serial: ++this.damageResolveSerial, hpBefore, hpAfter, damage, deathReached, previousKbCount, crossedCount, nextKnockbackHp: this.nextKnockbackHp, kbRequested: !!kbRequest, kbType: kbRequest?.type || null, kbReason: kbRequest?.reason || null, hitCount: this.pendingHits.length };
    const result = { damaged: true, hpBefore, hpAfter, damage, dead: false, deathPending: false, knockedBack: false };
    if (deathReached) { this.deathPending = true; this.isAliveFlag = false; this.lastKilledBy = this.pendingHits.slice(); result.deathPending = true; }
    this.clearPendingDamage();
    if (kbRequest) { this.startKnockback(kbRequest); result.knockedBack = true; }
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
