import { BattleScene } from './BattleScene.js';
import { BATTLE_CONFIG } from './BattleConfig.js';

const PATCH_FLAG = Symbol.for('wanko-battle.bcu-stage-spawn-patch.v1');

function hasMeaningfulGroup(group) {
  const n = Number(group);
  return Number.isFinite(n) && n !== 0;
}

function countAliveEnemiesInGroup(scene, group) {
  const g = Number(group);
  if (!Number.isFinite(g)) return 0;
  return (scene.actors || []).filter((a) => {
    if (!a || a.side !== 'cat-enemy') return false;
    if (typeof a.isAlive === 'function' && !a.isAlive()) return false;
    const actorGroup = Number(a.bcuStageGroup ?? a.stageGroup ?? a.group ?? a.stageSpawn?.group);
    return Number.isFinite(actorGroup) && actorGroup === g;
  }).length;
}

export function installBattleSceneBcuStageSpawnPatch() {
  const proto = BattleScene?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  const originalSpawnStageEnemy = proto.spawnStageEnemy;
  if (typeof originalSpawnStageEnemy !== 'function') {
    throw new Error('BattleScene.spawnStageEnemy is missing; cannot install BCU stage spawn patch');
  }

  proto.spawnStageEnemy = function spawnStageEnemyBcuStageGroup(unitDef, row) {
    const actorBefore = this.actors?.length || 0;
    const ok = originalSpawnStageEnemy.call(this, unitDef, row);
    if (!ok) return ok;
    const actor = (this.actors || [])[this.actors.length - 1];
    if (actor && (this.actors.length > actorBefore)) {
      const sourceRow = row?.row || row || {};
      actor.bcuStageRowIndex = row?.rowIndex ?? sourceRow?.rowIndex ?? null;
      actor.bcuStageGroup = sourceRow?.group ?? row?.group ?? 0;
      actor.stageSpawn = sourceRow;
      actor.group = actor.bcuStageGroup;
    }
    return ok;
  };

  proto.isBcuStageGroupAllowed = function isBcuStageGroupAllowed({ group } = {}) {
    if (!hasMeaningfulGroup(group)) return true;
    return countAliveEnemiesInGroup(this, group) <= 0;
  };

  proto.tickStageEnemySpawn = function tickStageEnemySpawnBcuGroup() {
    if (this.stageSpawnRuntime && BATTLE_CONFIG.stage?.applyStageDefinition?.replaceEnemySpawnSchedule) {
      const req = this.stageSpawnRuntime.tick(this.logicFrame, {
        logicFrame: this.logicFrame,
        aliveEnemyCount: this.actors.filter((a) => a.isAlive() && a.side === 'cat-enemy').length,
        maxEnemyCount: this.getEffectiveEnemyMaxCount(),
        enemyBaseHpPercent: this.getEnemyBaseHpPercent(),
        random: Math.random,
        isGroupAllowed: (args) => this.isBcuStageGroupAllowed(args)
      });
      for (const r of req) {
        const ok = this.spawnStageEnemy(r.unitDef, r);
        if (ok) {
          this.stageSpawnRuntime.commitSpawn(r, { random: Math.random });
        } else {
          this.stageSpawnRuntime.rejectSpawn(r, 'spawnStageEnemy-returned-false', {
            retryDelayFrame: 1,
            currentFrame: this.logicFrame
          });
        }
      }
      return;
    }

    for (const s of this.enemySpawnerState) {
      if (this.timeMs >= s.nextAtMs) {
        this.spawnEnemy(s.slotId);
        if (s.repeatMs) s.nextAtMs += s.repeatMs;
        else s.nextAtMs = Infinity;
      }
    }
  };
}

installBattleSceneBcuStageSpawnPatch();
