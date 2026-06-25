import { BattleActor } from './BattleActor.js';
import { BattleScene } from './BattleScene.js';
import {
  getBcuSpiritProductionState,
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
      // BCU StageBasis.produce sets unitRespawnTime = 1 after a spirit conjure and bails
      // (`if (unitRespawnTime > 0) return false`) until update decrements it once per
      // frame. So a successful conjure locks ALL production for the rest of that frame.
      if (Number.isFinite(this.logicFrame) && this.bcuUnitRespawnLockFrame === this.logicFrame) {
        this.pushEvent?.({ type: 'bcuSpiritSummonBlocked', slotId: resolvedSlotId, reason: 'unit-respawn-lock' });
        return false;
      }
      const spirit = requestBcuSpiritSpawn(this, resolvedSlotId);
      if (spirit.ok) {
        if (Number.isFinite(this.logicFrame)) this.bcuUnitRespawnLockFrame = this.logicFrame;
        return true;
      }
      // BCU StageBasis 527: once a conjurer is on the field, tapping its card is a
      // spirit-summon attempt. While the spirit is on cooldown / still loading / one
      // is already out, the tap is consumed (SE_SPEND_FAIL) and must NOT deploy a
      // second summoner. Only fall through for the initial summoner deployment.
      if (spirit.spiritAttempt) {
        this.pushEvent?.({ type: 'bcuSpiritSummonBlocked', slotId: resolvedSlotId, reason: spirit.reason });
        return false;
      }
      return originalRequestPlayerSpawn.call(this, slotId, row, col);
    };

    // Surface the per-conjurer cooldown / ready-emphasize state into the production-roster
    // data model so the card layer can render the BCU "spirit ready" flash. The pixel
    // appearance of that flash remains a manual visual-review item; the data is exposed here.
    const originalGetStatsSourceReport = sceneProto.getStatsSourceReport;
    if (typeof originalGetStatsSourceReport === 'function') {
      sceneProto.getStatsSourceReport = function getStatsSourceReportWithBcuSpirit() {
        const report = originalGetStatsSourceReport.call(this);
        if (Array.isArray(report?.productionRoster)) {
          for (const entry of report.productionRoster) {
            if (!entry || entry.empty) continue;
            const spiritState = getBcuSpiritProductionState(this, entry.slotId);
            if (spiritState) entry.bcuSpirit = spiritState;
          }
        }
        return report;
      };
    }

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
