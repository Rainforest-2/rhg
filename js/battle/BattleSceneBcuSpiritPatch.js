import { BattleActor } from './BattleActor.js';
import { BattleScene } from './BattleScene.js';
import {
  getBcuSpiritSpec,
  markBcuSummonerSpawned,
  rejectBcuSpiritDamage,
  requestBcuSpiritSpawn,
  tickBcuSpiritState
} from './bcu-runtime/BcuSpiritLifecycleRuntime.js';

const ACTOR_PATCH_FLAG = Symbol.for('wanko-battle.actor-spirit.v1');
const SCENE_PATCH_FLAG = Symbol.for('wanko-battle.scene-spirit.v1');

export function installBattleSceneBcuSpiritPatch() {
  const actorProto = BattleActor?.prototype;
  if (actorProto && !actorProto[ACTOR_PATCH_FLAG]) {
    actorProto[ACTOR_PATCH_FLAG] = true;
    const originalTakeDamage = actorProto.takeDamage;
    actorProto.takeDamage = function takeDamageWithBcuSpirit(amount, meta = {}) {
      const rejected = rejectBcuSpiritDamage(this, meta);
      if (rejected.rejected) return rejected;
      return originalTakeDamage.call(this, amount, meta);
    };
  }

  const sceneProto = BattleScene?.prototype;
  if (sceneProto && !sceneProto[SCENE_PATCH_FLAG]) {
    sceneProto[SCENE_PATCH_FLAG] = true;

    const originalSpawnActor = sceneProto.spawnActor;
    sceneProto.spawnActor = function spawnActorWithBcuSpiritMarkers(unitDef, side, isPlayerProduced = false, options = {}) {
      const actor = originalSpawnActor.call(this, unitDef, side, isPlayerProduced, options);
      if (!actor) return actor;
      actor.scene = this;
      if (options?.bcuSpirit === true) {
        actor.bcuIsSpirit = true;
      } else if (isPlayerProduced && getBcuSpiritSpec(actor)) {
        markBcuSummonerSpawned(this, actor, { slotId: unitDef?.slotId || actor.slotId });
      }
      return actor;
    };

    const originalRequestPlayerSpawn = sceneProto.requestPlayerSpawn;
    sceneProto.requestPlayerSpawn = function requestPlayerSpawnWithBcuSpirit(slotId, row = this.frontLineup, col = null) {
      const resolvedSlotId = (col === null ? slotId : this.getPlayerLineupRows?.()?.[row]?.[col]?.slotId) || slotId;
      const spirit = requestBcuSpiritSpawn(this, resolvedSlotId);
      if (spirit.ok) return true;
      return originalRequestPlayerSpawn.call(this, slotId, row, col);
    };

    const originalRunTickPhase = sceneProto.runTickPhase;
    sceneProto.runTickPhase = function runTickPhaseWithBcuSpirit(phase, fn = () => {}) {
      if (phase === 'player-production-requests') tickBcuSpiritState(this);
      const result = originalRunTickPhase.call(this, phase, fn);
      if (phase === 'cleanup' || phase === 'actor-state-update') tickBcuSpiritState(this);
      return result;
    };
  }
}

installBattleSceneBcuSpiritPatch();
