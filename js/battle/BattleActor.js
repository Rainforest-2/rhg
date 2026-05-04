import { BcuAnimator } from '../bcu/BcuAnimator.js';

export class BattleActor {
  constructor({ assetDef, sprite, model, side, x, y, scale = 1, facing = 1, direction = 1, renderFlipX = false, currentAnimId = 'anim00', stats = null, animations = {} }) {
    this.assetDef = assetDef; this.sprite = sprite; this.model = model; this.side = side; this.x = x; this.y = y; this.scale = scale;
    this.facing = facing; this.direction = direction; this.renderFlipX = renderFlipX;
    this.currentAnimId = currentAnimId; this.rawStats = stats; this.animations = new Map(Object.entries(animations));
    this.animator = new BcuAnimator(this.animations.get(currentAnimId) || { tracks: [], maxFrame: 1 });

    this.maxHp = stats?.hp ?? 100; this.hp = this.maxHp; this.damage = stats?.damage ?? 0;
    this.moveSpeed = 0; this.detectionRangePx = 0;
    this.attackWaitFrames = stats?.attackWaitFrames ?? 0; this.attackStartupFrames = stats?.attackStartupFrames ?? 0; this.attackType = stats?.attackType ?? 0;
    this.attackCycleMs = 700; this.hitAtMs = 0; this.attackElapsedMs = 0; this.hasHitInCurrentAttack = false;
    this.targetId = null; this.state = 'move'; this.isAliveFlag = true;

    this.knockbacks = Math.max(1, Number(stats?.knockbacks) || 1);
    this.knockbackCount = 0;
    this.knockbackHpStep = this.maxHp / this.knockbacks;
    this.nextKnockbackHp = this.maxHp - this.knockbackHpStep;
    this.isKnockbacking = false;
    this.knockbackElapsedMs = 0;
    this.knockbackDurationMs = 250;
    this.knockbackDistance = 60;
    this.knockbackFromX = this.x;
    this.knockbackToX = this.x;
  }

  isAlive() { return this.isAliveFlag && this.hp > 0 && this.state !== 'dead'; }
  setAnimation(animId, restart = false) { if (!animId || (this.currentAnimId === animId && !restart)) return; this.animator = new BcuAnimator(this.animations.get(animId) || this.animations.get('anim00') || { tracks: [], maxFrame: 1 }); this.currentAnimId = animId; }
  setState(nextState) { if (this.state === nextState) return; this.state = nextState; if (nextState === 'attack') { this.attackElapsedMs = 0; this.hasHitInCurrentAttack = false; } }

  startKnockback() {
    this.setState('knockback');
    this.isKnockbacking = true;
    this.knockbackElapsedMs = 0;
    this.knockbackFromX = this.x;
    this.knockbackToX = this.x - this.direction * this.knockbackDistance;
  }

  takeDamage(amount) {
    if (!this.isAlive()) return;
    this.hp = Math.max(0, this.hp - Math.max(0, amount));
    if (this.hp <= 0) { this.isAliveFlag = false; this.state = 'dead'; this.isKnockbacking = false; return; }
    if (this.hp <= this.nextKnockbackHp) {
      this.startKnockback();
      this.knockbackCount += 1;
      this.nextKnockbackHp = Math.max(0, this.maxHp - this.knockbackHpStep * (this.knockbackCount + 1));
    }
  }

  startAttack(target) { this.targetId = target?.assetDef?.id || null; this.attackElapsedMs = 0; this.hasHitInCurrentAttack = false; this.setState('attack'); }
  finishAttackCycle() { this.attackElapsedMs = 0; this.hasHitInCurrentAttack = false; }

  tick(dt) {
    if (!this.model || !this.isAlive() || this.state === 'dead') return;
    this.animator.tick(dt); this.model.reset(); this.animator.apply(this.model);
  }
}
