import { BcuAnimator } from '../bcu/BcuAnimator.js';

export class BattleActor {
  constructor({ assetDef, sprite, model, anim, side, x, y, scale = 1, facing = 1, currentAnimId = 'anim00' }) {
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
    this.maxHp = 100;
    this.hp = this.maxHp;
    this.state = 'idle';
  }

  tick(dt) {
    if (!this.model) return;
    this.animator.tick(dt);
    this.model.reset();
    this.animator.apply(this.model);
  }
}
