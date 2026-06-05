import { BattleActor } from './BattleActor.js';
import { AnimationRuntime } from '../bcu/AnimationRuntime.js';

const PATCH_FLAG = Symbol.for('wanko-battle.actor-bcu-burrow-animation-frame.v1');

export function installBattleActorBcuBurrowAnimationFramePatch() {
  const proto = BattleActor?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  const originalTick = proto.tick;
  proto.tick = function tickWithBcuBurrowAnimationFrame(dt) {
    const wasBurrow = this.bcuBurrow?.active === true || String(this.activeAnimRole || '').startsWith('burrow-');
    const result = originalTick.call(this, dt);
    if (wasBurrow) {
      AnimationRuntime.tickActor(this, dt);
      this.applyCurrentAnimationFrame?.();
      this.lastBcuBurrowAnimationFrameDebug = {
        source: 'BattleActorBcuBurrowAnimationFramePatch',
        activeAnimId: this.activeAnimId,
        activeAnimRole: this.activeAnimRole,
        frame: this.animator?.frame ?? null,
        bcuReference: 'Entity.update2 still calls anim.update() while kbTime != 0 / burrow phases are active'
      };
    }
    return result;
  };
}

installBattleActorBcuBurrowAnimationFramePatch();
