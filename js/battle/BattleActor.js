import { BcuAnimator } from '../bcu/BcuAnimator.js';

export class BattleActor {
  constructor({ assetDef, sprite, model, side, x, y, scale = 1, facing = 1, direction = 1, renderFlipX = false, currentAnimId = 'anim00', stats = null, animations = {} }) {
    this.assetDef = assetDef; this.sprite = sprite; this.model = model; this.side = side; this.x = x; this.y = y; this.scale = scale;
    this.facing = facing; this.direction = direction; this.renderFlipX = renderFlipX;
    this.currentAnimId = currentAnimId; this.rawStats = stats;
    this.animations = new Map(Object.entries(animations));
    const startAnim = this.animations.get(currentAnimId) || { tracks: [], maxFrame: 1 };
    this.animator = new BcuAnimator(startAnim);

    this.maxHp = stats?.hp ?? 100; this.hp = this.maxHp; this.damage = stats?.damage ?? 0;
    this.moveSpeed = 0; this.detectionRangePx = 0;
    this.attackWaitFrames = stats?.attackWaitFrames ?? 0;
    this.attackStartupFrames = stats?.attackStartupFrames ?? 0;
    this.attackType = stats?.attackType ?? 0;
    this.attackCycleMs = 700; this.hitAtMs = 0;
    this.attackElapsedMs = 0; this.hasHitInCurrentAttack = false;
    this.targetId = null; this.state = 'move'; this.isAliveFlag = true;
  }

  isAlive() { return this.isAliveFlag && this.hp > 0 && this.state !== 'dead'; }

  setAnimation(animId, restart = false) {
    if (!animId || this.currentAnimId === animId && !restart) return;
    const anim = this.animations.get(animId) || this.animations.get('anim00') || { tracks: [], maxFrame: 1 };
    this.animator = new BcuAnimator(anim);
    this.currentAnimId = animId;
  }

  setState(nextState) {
    if (this.state === nextState) return;
    this.state = nextState;
    if (nextState === 'attack') {
      this.attackElapsedMs = 0;
      this.hasHitInCurrentAttack = false;
    }
  }

  takeDamage(amount) {
    if (!this.isAlive()) return;
    this.hp = Math.max(0, this.hp - Math.max(0, amount));
    if (this.hp <= 0) { this.isAliveFlag = false; this.state = 'dead'; }
  }

  startAttack(target) {
    this.targetId = target?.assetDef?.id || null;
    this.attackElapsedMs = 0;
    this.hasHitInCurrentAttack = false;
    this.setState('attack');
  }

  finishAttackCycle() { this.attackElapsedMs = 0; this.hasHitInCurrentAttack = false; }

  tick(dt) {
    if (!this.model || !this.isAlive()) return;
    this.animator.tick(dt); this.model.reset(); this.animator.apply(this.model);
  }
}
