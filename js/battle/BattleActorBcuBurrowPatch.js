import { BattleActor } from './BattleActor.js';
import { BattleScene } from './BattleScene.js';
import {
  clearBcuBurrow,
  canStartBcuBurrow,
  getBcuBurrowTouchMask,
  isBcuBurrowNormallyTargetable,
  isBcuBurrowTargetableForEvent,
  startBcuBurrow,
  tickBcuBurrow
} from './bcu-runtime/BcuBurrowLifecycleRuntime.js';

const ACTOR_PATCH_FLAG = Symbol.for('wanko-battle.actor-bcu-burrow.v1');
const SCENE_PATCH_FLAG = Symbol.for('wanko-battle.scene-bcu-burrow.v1');

export function installBattleActorBcuBurrowPatch() {
  const proto = BattleActor?.prototype;
  if (proto && !proto[ACTOR_PATCH_FLAG]) {
    proto[ACTOR_PATCH_FLAG] = true;

    proto.getBcuTouchMask = function getBcuTouchMask() {
      return getBcuBurrowTouchMask(this);
    };

    proto.isBcuTargetableForEvent = function isBcuTargetableForEvent(event = null) {
      if (this.bcuBurrow?.active) return isBcuBurrowTargetableForEvent(this, event);
      if (typeof this.isTargetable === 'function') return this.isTargetable();
      return this.hp > 0;
    };

    const originalIsTargetable = proto.isTargetable;
    proto.isTargetable = function isTargetableWithBcuBurrow() {
      if (this.bcuBurrow?.active && !isBcuBurrowNormallyTargetable(this)) return false;
      return originalIsTargetable.call(this);
    };

    const originalIsTouchable = proto.isTouchable;
    proto.isTouchable = function isTouchableWithBcuBurrow() {
      if (this.bcuBurrow?.active && !isBcuBurrowNormallyTargetable(this)) return false;
      return originalIsTouchable.call(this);
    };

    const originalTick = proto.tick;
    proto.tick = function tickWithBcuBurrow(dt) {
      if (this.bcuBurrow?.active) {
        tickBcuBurrow(this, dt, { scene: this.scene || globalThis.__APP__?.scene || null });
        return;
      }
      return originalTick.call(this, dt);
    };

    const originalEnterDeadState = proto.enterDeadState;
    proto.enterDeadState = function enterDeadStateClearingBcuBurrow(nowMs = 0) {
      clearBcuBurrow(this, 'death');
      return originalEnterDeadState.call(this, nowMs);
    };
  }

  const sceneProto = BattleScene?.prototype;
  if (sceneProto && !sceneProto[SCENE_PATCH_FLAG]) {
    sceneProto[SCENE_PATCH_FLAG] = true;
    const originalStartActorAttack = sceneProto.startActorAttack;
    sceneProto.startActorAttack = function startActorAttackWithBcuBurrow(actor, target, targetType) {
      const start = canStartBcuBurrow(this, actor, target);
      if (start.ok) {
        startBcuBurrow(actor, { scene: this });
        return true;
      }
      return originalStartActorAttack.call(this, actor, target, targetType);
    };
  }
}

installBattleActorBcuBurrowPatch();
