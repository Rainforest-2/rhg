import { BattleActor } from './BattleActor.js';

const PATCH_FLAG = Symbol.for('wanko-battle.actor-bcu-kb-target-patch.v1');

function getKbFrame(actor) {
  const n = Number(actor?.kbMotionFrameIndex ?? actor?.kbFrameIndex ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function isKbFrameTargetable(actor) {
  if (!actor || actor.state !== 'knockback') return true;
  const frame = getKbFrame(actor);
  const first = !!actor.kbFirstFrameTargetable && frame === 0;
  const from = Number(actor.kbTargetableFromFrame ?? actor.kbMotionFramesTotal ?? actor.kbFramesTotal ?? 0);
  const after = Number.isFinite(from) && frame >= from;
  actor.lastKbTargetableDebug = {
    source: 'BCU KB target window parity',
    frame,
    firstFrameTargetable: !!actor.kbFirstFrameTargetable,
    targetableFromFrame: Number.isFinite(from) ? from : null,
    motionFramesTotal: actor.kbMotionFramesTotal ?? actor.kbFramesTotal ?? null,
    targetable: first || after,
    deathAfterKnockback: !!actor.deathAfterKnockback,
    hp: actor.hp
  };
  return first || after;
}

export function installBattleActorBcuKbTargetPatch() {
  const proto = BattleActor?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  proto.isKbTargetableNow = function isKbTargetableNowBcu() {
    return isKbFrameTargetable(this);
  };

  proto.isTargetable = function isTargetableBcu() {
    if (!this.isAlive()) return false;
    if (this.state === 'knockback') return isKbFrameTargetable(this);
    return true;
  };

  proto.isTouchable = function isTouchableBcu() {
    if (!this.isAlive()) return false;
    if (this.state === 'knockback') return isKbFrameTargetable(this);
    return true;
  };

  proto.isCombatAlive = function isCombatAliveBcu() {
    return this.isTargetable();
  };
}

installBattleActorBcuKbTargetPatch();
