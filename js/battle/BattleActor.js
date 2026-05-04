import { BcuAnimator } from '../bcu/BcuAnimator.js';

export class BattleActor {
  constructor({ assetDef, sprite, model, side, x, y, scale = 1, facing = 1, direction = 1, renderFlipX = false, currentAnimId = 'anim00', stats = null, animations = {}, attackAnimId = 'anim02', moveAnimId = 'anim00', idleAnimId = 'anim00', knockbackAnimId = 'anim03', fps = 30, logs = [], collisionRadius = 42 }) {
    this.assetDef = assetDef; this.sprite = sprite; this.model = model; this.side = side; this.x = x; this.y = y; this.scale = scale;
    this.facing = facing; this.direction = direction; this.renderFlipX = renderFlipX;
    this.currentAnimId = currentAnimId; this.rawStats = stats; this.animations = new Map(Object.entries(animations));
    this.animator = new BcuAnimator(this.animations.get(currentAnimId) || { tracks: [], maxFrame: 1 });
    this.logs = logs;

    this.maxHp = stats?.hp ?? 100; this.hp = this.maxHp; this.damage = stats?.damage ?? 0;
    this.moveSpeed = 0; this.detectionRangePx = 0; this.collisionRadius = collisionRadius;
    this.attackWaitFrames = stats?.attackWaitFrames ?? 0; this.attackStartupFrames = stats?.attackStartupFrames ?? 0; this.attackType = stats?.attackType ?? 0;
    this.attackWaitMs = (this.attackWaitFrames / fps) * 1000;
    this.attackPostHitWaitMs = this.attackWaitMs;
    this.nextAttackReadyMs = this.attackWaitMs;
    this.attackStartupMs = Math.max(0, (this.attackStartupFrames / fps) * 1000);
    this.attackElapsedMs = 0; this.attackWaitElapsedMs = 0; this.hasHitInCurrentAttack = false; this.attackCycleId = 0;
    this.targetId = null; this.state = 'move'; this.isAliveFlag = true;

    this.moveAnimId = moveAnimId; this.idleAnimId = idleAnimId; this.attackAnimId = attackAnimId; this.knockbackAnimId = knockbackAnimId;
    this.attackAnimDurationMs = this.deriveAnimDurationMs(attackAnimId, fps, 250, 'attackAnimDuration fallback to 250ms');
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


  getCenterDistanceTo(other) { return Math.abs(this.x - other.x); }
  getBodyDistanceTo(other) { return Math.max(0, this.getCenterDistanceTo(other) - this.collisionRadius - (other?.collisionRadius || 0)); }
  getEngageDistanceTo(other) { return Math.min(this.detectionRangePx, other?.detectionRangePx || this.detectionRangePx); }

  isAlive() { return this.isAliveFlag && this.hp > 0 && this.state !== 'dead'; }
  setAnimation(animId, role, restart = false) {
    if (!animId) return;
    if (this.currentAnimId === animId && !restart) return;
    this.animator = new BcuAnimator(this.animations.get(animId) || this.animations.get('anim00') || { tracks: [], maxFrame: 1 });
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
    this.setAnimation(this.knockbackAnimId, 'knockback', true);
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

  tick(dt) {
    if (!this.model || !this.isAlive() || this.state === 'dead') return;
    this.animator.tick(dt); this.model.reset(); this.animator.apply(this.model);
  }
}
