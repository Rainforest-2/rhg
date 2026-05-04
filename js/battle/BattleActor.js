import { BcuAnimator } from '../bcu/BcuAnimator.js';

export class BattleActor {
  constructor({ assetDef, sprite, model, side, x, y, scale = 1, facing = 1, direction = 1, renderFlipX = false, currentAnimId = 'anim00', stats = null, animations = {}, attackAnimId = 'anim02', moveAnimId = 'anim00', idleAnimId = 'anim00', knockbackAnimId = 'anim03', fps = 30, logs = [], collisionRadius = 42, attackWaitMultiplier = 1, attackPhaseTimeMultiplier = 1, attackAnimationSpeedMultiplier = 1, postAttackIdleHoldMs = 0, minAttackWaitMs = 0, combatBodyHalfWidthPx = null, combatBodyHeightPx = null, combatBodyYOffsetPx = 0, combatBodyWidthPx = null }) {
    this.assetDef = assetDef; this.sprite = sprite; this.model = model; this.side = side; this.x = x; this.y = y; this.scale = scale;
    this.facing = facing; this.direction = direction; this.renderFlipX = renderFlipX;
    this.currentAnimId = currentAnimId; this.rawStats = stats; this.animations = new Map(Object.entries(animations));
    this.animator = new BcuAnimator(this.animations.get(currentAnimId) || { tracks: [], maxFrame: 1 });
    this.logs = logs;

    this.maxHp = stats?.hp ?? 100; this.hp = this.maxHp; this.damage = stats?.damage ?? 0;
    this.moveSpeed = 0; this.detectionRangePx = 0; this.collisionRadius = collisionRadius;
    this.combatBodyWidthPx = Number.isFinite(combatBodyWidthPx) ? combatBodyWidthPx : 44;
    this.combatBodyHeightPx = Number.isFinite(combatBodyHeightPx) ? combatBodyHeightPx : 72;
    this.combatBodyYOffsetPx = Number.isFinite(combatBodyYOffsetPx) ? combatBodyYOffsetPx : 0;
    this.combatBodyFrontOffsetLocalX = 0;
    this.combatBodyFrontInitialized = false;
    this.combatBodyFrontSource = 'actor-x';
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
    const partIndex = p.partIndex ?? p.current?.partIndex ?? p.rawPart?.partIndex;
    const imgcutIndex = p.imgcutIndex ?? p.current?.imgcutIndex ?? p.rawPart?.imgcutIndex;
    if (!Number.isInteger(partIndex) || partIndex < 0) return null;
    if ((imgcutIndex ?? 0) < 0) return null;
    const opacity = Number.isFinite(p.opacity) ? p.opacity : (p.world?.o ?? 1);
    if (opacity <= 0) return null;
    const part = this.sprite?.imgcut?.parts?.[partIndex];
    if (!part || part.w <= 0 || part.h <= 0) return null;
    const m = Array.isArray(p.matrix) && p.matrix.length === 6 ? p.matrix : null;
    if (!m) return null;
    const pivotX = Number.isFinite(p.pivotX) ? p.pivotX : part.w * 0.5;
    const pivotY = Number.isFinite(p.pivotY) ? p.pivotY : part.h * 0.5;
    const corners = [[-pivotX, -pivotY], [part.w - pivotX, -pivotY], [-pivotX, part.h - pivotY], [part.w - pivotX, part.h - pivotY]];
    let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
    for (const [x, y] of corners) { const rx = m[0] * x + m[2] * y + m[4]; const ry = m[1] * x + m[3] * y + m[5]; minX = Math.min(minX, rx); minY = Math.min(minY, ry); maxX = Math.max(maxX, rx); maxY = Math.max(maxY, ry); }
    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) return null;
    return { left: minX, top: minY, right: maxX, bottom: maxY, width: maxX - minX, height: maxY - minY };
  }

  initializeCombatBodyFrontFromModel() {
    if (this.combatBodyFrontInitialized) return;
    this.combatBodyFrontInitialized = true;
    if (!this.model || !this.sprite || typeof this.model.getBattleDrawList !== 'function') { this.combatBodyFrontOffsetLocalX = 0; this.combatBodyFrontSource = 'fallback-no-model'; return; }
    const drawList = this.model.getBattleDrawList();
    const partBounds = [];
    for (const p of drawList) { const b = this.getBattlePartLocalBoundsForCombat(p); if (!b) continue; if (b.width < 2 || b.height < 2) continue; partBounds.push(b); }
    if (!partBounds.length) { this.combatBodyFrontOffsetLocalX = 0; this.combatBodyFrontSource = 'fallback-no-bounds'; return; }
    let minX = Infinity; let maxX = -Infinity;
    for (const b of partBounds) { minX = Math.min(minX, b.left); maxX = Math.max(maxX, b.right); }
    if (!Number.isFinite(minX) || !Number.isFinite(maxX)) { this.combatBodyFrontOffsetLocalX = 0; this.combatBodyFrontSource = 'fallback-invalid-bounds'; return; }
    const flip = this.renderFlipX ? -1 : 1;
    const dir = Number.isFinite(this.direction) ? this.direction : 1;
    const worldMinFromLocalMin = minX * flip;
    const worldMinFromLocalMax = maxX * flip;
    if (dir < 0) this.combatBodyFrontOffsetLocalX = worldMinFromLocalMin <= worldMinFromLocalMax ? minX : maxX;
    else this.combatBodyFrontOffsetLocalX = worldMinFromLocalMin >= worldMinFromLocalMax ? minX : maxX;
    this.combatBodyFrontSource = 'reference-visual-front';
  }

  getCombatBodyFrontX() {
    const localOffset = Number.isFinite(this.combatBodyFrontOffsetLocalX) ? this.combatBodyFrontOffsetLocalX : 0;
    const s = Number.isFinite(this.scale) ? this.scale : 1;
    const flip = this.renderFlipX ? -1 : 1;
    return this.x + localOffset * s * flip;
  }

  getCombatBodyBox() {
    const width = Number.isFinite(this.combatBodyWidthPx) ? this.combatBodyWidthPx : 44;
    const height = Number.isFinite(this.combatBodyHeightPx) ? this.combatBodyHeightPx : 72;
    const bottom = this.y + (Number.isFinite(this.combatBodyYOffsetPx) ? this.combatBodyYOffsetPx : 0);
    const frontX = this.getCombatBodyFrontX();
    const dir = Number.isFinite(this.direction) ? this.direction : 1;
    let left; let right;
    if (dir < 0) { left = frontX; right = frontX + width; }
    else { right = frontX; left = frontX - width; }
    const centerX = (left + right) * 0.5;
    return { left, right, top: bottom - height, bottom, centerX, centerY: bottom - height * 0.5, width, height, frontX, backX: dir < 0 ? right : left };
  }

  getCombatBodyDistanceTo(other) {
    const a = this.getCombatBodyBox();
    const b = typeof other?.getCombatBodyBox === 'function' ? other.getCombatBodyBox() : null;
    if (!b) {
      const radius = other?.collisionRadius || 0;
      const otherLeft = other.x - radius;
      const otherRight = other.x + radius;
      if (a.right < otherLeft) return otherLeft - a.right;
      if (otherRight < a.left) return a.left - otherRight;
      return 0;
    }
    if (a.right < b.left) return b.left - a.right;
    if (b.right < a.left) return a.left - b.right;
    return 0;
  }

  getCenterDistanceTo(other) { return Math.abs(this.x - other.x); }
  getBodyDistanceTo(other) { return Math.max(0, this.getCenterDistanceTo(other) - this.collisionRadius - (other?.collisionRadius || 0)); }
  getEngageDistanceTo(other) { return Math.min(this.detectionRangePx, other?.detectionRangePx || this.detectionRangePx); }

  isAlive() { return this.isAliveFlag && this.hp > 0 && this.state !== 'dead'; }
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
    if (nextState === 'attack') { this.attackElapsedMs = 0; this.hasHitInCurrentAttack = false; this.attackCycleId += 1; }
    if (nextState === 'attack-wait') this.attackWaitElapsedMs = 0;
    return true;
  }

  startKnockback() {
    this.setState('knockback');
    this.attackElapsedMs = 0; this.attackWaitElapsedMs = 0; this.hasHitInCurrentAttack = false;
    this.knockbackPositionElapsedMs = 0;
    this.knockbackPositionDurationMs = this.knockbackAnimDurationMs;
    this.knockbackFromX = this.x;
    this.knockbackToX = this.x - this.direction * this.knockbackPositionDistance;
    this.setAnimation(this.knockbackAnimId, 'knockback', true); this.applyCurrentAnimationFrame();
  }

  takeDamage(amount) {
    if (!this.isAlive()) return { dead: false, knockedBack: false };
    this.hp = Math.max(0, this.hp - Math.max(0, amount));
    if (this.hp <= 0) { this.isAliveFlag = false; this.state = 'dead'; return { dead: true, knockedBack: false }; }
    if (this.hp <= this.nextKnockbackHp) {
      this.startKnockback();
      this.knockbackCount += 1;
      this.nextKnockbackHp = Math.max(0, this.maxHp - this.knockbackHpStep * (this.knockbackCount + 1));
      return { dead: false, knockedBack: true };
    }
    return { dead: false, knockedBack: false };
  }

  applyCurrentAnimationFrame() { if (!this.model) return; this.model.reset(); this.animator.apply(this.model); }

  tick(dt) {
    if (!this.model || !this.isAlive() || this.state === 'dead') return;
    this.animator.tick(dt); this.model.reset(); this.animator.apply(this.model);
  }
}
