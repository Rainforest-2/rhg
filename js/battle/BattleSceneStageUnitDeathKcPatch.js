import { BattleScene } from './BattleScene.js';
import { notifyStageSpawnKillCountersOnUnitDeath } from './BattleSceneStageRuntimeWiring.js';

const PATCH_FLAG = Symbol.for('wanko-battle.stage-unit-death-kc.v1');

function isResolvedUnitDeath(actor) {
  if (!actor || actor.side !== 'dog-player') return false;
  return actor.deathPending === true
    || actor.deathAfterKnockback === true
    || actor.deathResolved === true
    || actor.state === 'dead'
    || (Number.isFinite(actor.hp) && actor.hp <= 0 && actor.isAliveFlag === false);
}

export function installBattleSceneStageUnitDeathKcPatch() {
  const proto = BattleScene?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  const original = proto.runTickPhase;
  if (typeof original !== 'function') throw new Error('BattleScene.runTickPhase is missing');
  proto[PATCH_FLAG] = true;
  proto.runTickPhase = function runTickPhaseWithStageUnitDeathNotification(phase, fn) {
    const result = original.call(this, phase, fn);
    // Damage/KB/death resolution completes in this phase. Notify here, before the
    // next enemy-spawn phase, rather than waiting for the corpse removal timeout.
    if (phase === 'knockback-death') {
      for (const actor of this.actors || []) {
        if (isResolvedUnitDeath(actor)) notifyStageSpawnKillCountersOnUnitDeath(this, actor);
      }
    }
    return result;
  };
}

installBattleSceneStageUnitDeathKcPatch();

export { isResolvedUnitDeath };
