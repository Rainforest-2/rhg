// BCU plays SE_DEATH_0 / SE_DEATH_1 when an entity dies (Entity.java:2618,
// CommonStatic.setSE on a 50/50 roll). rhg's enterDeadState is the single death
// chokepoint (both the HP-zero path and the final-knockback path route through
// it, and it self-guards against re-entry once state === 'dead'), so emit one
// 'bcuEntityDied' event there. BattleSoundEventPatch maps it to the death SE with
// the same per-frame de-dup BCU's setSE flag has.

import { BattleActor } from './BattleActor.js';

const PATCH_FLAG = Symbol.for('wanko-battle.actor-death-sound-patch.v1');

function resolveScene(actor) {
  return actor?.scene || globalThis.__APP__?.battleScene || globalThis.__APP__?.scene || null;
}

export function installBattleActorDeathSoundPatch() {
  const proto = BattleActor?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  const originalEnterDeadState = proto.enterDeadState;
  if (typeof originalEnterDeadState !== 'function') return;

  proto.enterDeadState = function enterDeadStateWithDeathSound(nowMs = 0) {
    const wasDead = this.state === 'dead';
    const result = originalEnterDeadState.call(this, nowMs);
    if (!wasDead && this.state === 'dead') {
      const scene = resolveScene(this);
      scene?.pushEvent?.({
        type: 'bcuEntityDied',
        actor: this.instanceId || this.label || null,
        side: this.side || null,
        source: 'BCU Entity death setSE(SE_DEATH_0/1)'
      });
    }
    return result;
  };
}

installBattleActorDeathSoundPatch();
