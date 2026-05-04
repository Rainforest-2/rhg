import { BcuAnimator } from '../bcu/BcuAnimator.js';

export class BattleActor {
  constructor({ assetDef, sprite, model, anim, side, x, y, scale = 1, facing = 1, currentAnimId = 'anim00', stats = null }) {
    this.assetDef = assetDef;
    this.sprite = sprite;
    this.model = model;
    this.anim = anim;
    this.animator = new BcuAnimator(anim || { tracks: [], maxFrame: 1 });
    this.side = side;
    this.x = x;
    this.y = y;
    this.scale = scale;
    this.facing = facing;
    this.currentAnimId = currentAnimId;
    this.rawStats = stats;
    this.maxHp = stats?.hp ?? 100;
    this.hp = this.maxHp;
    this.damage = stats?.damage ?? 0;
    this.moveSpeed = 0;
    this.attackRange = 0;
    this.attackIntervalFrames = stats?.attackIntervalFrames ?? 0;
    this.attackDurationMs = 700;
    this.state = 'idle';
  }

  tick(dt) {
    if (!this.model) return;
    this.animator.tick(dt);
    this.model.reset();
    this.animator.apply(this.model);
  }
}
