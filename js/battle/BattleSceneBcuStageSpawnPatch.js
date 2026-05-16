import { BattleScene } from './BattleScene.js';
import { BATTLE_CONFIG } from './BattleConfig.js';

const PATCH_FLAG = Symbol.for('wanko-battle.bcu-stage-spawn-patch.v2');

function getEnemyBaseHpPercent(scene) {
  if (typeof scene?.getEnemyBaseHpPercent === 'function') return scene.getEnemyBaseHpPercent();
  return 100;
}

function getCastle0(row = {}) {
  return Number(row.baseHpTriggerPercent ?? row.baseHpTriggerLowerPercent ?? row.baseHpTrigger ?? 100);
}

function getCastle1(row = {}) {
  const c1 = Number(row.baseHpTriggerUpperPercent ?? row.scdef?.baseHpTriggerUpperPercent ?? row.scdef?.castle_1 ?? 0);
  return Number.isFinite(c1) ? c1 : 0;
}

function getKillCount(row = {}) {
  const n = Number(row.killCountTrigger ?? row.killCount ?? row.scdef?.killCountTrigger ?? row.scdef?.kill_count ?? 0);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function shouldDecrementKillCounter(row = {}, enemyBaseHpPercent = 100) {
  const c0 = getCastle0(row);
  const c1 = getCastle1(row);
  if (!Number.isFinite(c0) || c0 === 0) return false;
  const percentage = Number(enemyBaseHpPercent);
  if (!Number.isFinite(percentage)) return false;
  if (c0 === c1) return percentage <= c0;
  return percentage >= Math.min(c0, c1) && percentage <= Math.max(c0, c1);
}

function ensureKillCounter(scene) {
  if (scene.bcuStageKillCounterByRowIndex) return scene.bcuStageKillCounterByRowIndex;
  const rows = scene.stage?.runtime?.enemyRows || [];
  const counters = {};
  for (const row of rows) {
    const rowIndex = row?.rowIndex;
    if (!Number.isFinite(rowIndex)) continue;
    counters[rowIndex] = getCastle0(row) !== 0 ? getKillCount(row) : 0;
  }
  scene.bcuStageKillCounterByRowIndex = counters;
  return counters;
}

function notifyBcuUnitDeath(scene, actor) {
  if (!actor || actor.side !== 'dog-player') return;
  if (actor.__bcuStageUnitDeathNotified) return;
  const isDeadLike = actor.hp <= 0 || actor.deathPending || actor.deathAfterKnockback || actor.state === 'dead' || actor.state === 'dying';
  if (!isDeadLike) return;

  actor.__bcuStageUnitDeathNotified = true;
  const counters = ensureKillCounter(scene);
  const rows = scene.stage?.runtime?.enemyRows || [];
  const percentage = getEnemyBaseHpPercent(scene);
  const changed = [];

  for (const row of rows) {
    const rowIndex = row?.rowIndex;
    if (!Number.isFinite(rowIndex)) continue;
    const before = Number(counters[rowIndex] || 0);
    if (before <= 0) continue;
    if (!shouldDecrementKillCounter(row, percentage)) continue;
    counters[rowIndex] = before - 1;
    changed.push({ rowIndex, before, after: counters[rowIndex], castle0: getCastle0(row), castle1: getCastle1(row) });
  }

  if (changed.length) {
    scene.pushEvent?.({
      type: 'bcuStageKillCounterDecremented',
      source: 'BCU StageBasis.notifyUnitDeath / EUnit.onLastBreathe',
      actor: actor.instanceId || actor.label || null,
      enemyBaseHpPercent: percentage,
      changed
    });
  }
}

export function installBattleSceneBcuStageSpawnPatch() {
  const proto = BattleScene?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  const originalInit = proto.init;
  if (typeof originalInit === 'function') {
    proto.init = async function initWithBcuStageKillCounter(...args) {
      const result = await originalInit.apply(this, args);
      this.bcuStageKillCounterByRowIndex = null;
      ensureKillCounter(this);
      this.pushEvent?.({
        type: 'bcuStageKillCounterInitialized',
        source: 'BCU EStage.killCounter initialized from SCDef.Line.kill_count when castle_0 != 0',
        counters: { ...(this.bcuStageKillCounterByRowIndex || {}) }
      });
      return result;
    };
  }

  const originalCleanupDead = proto.cleanupDead;
  if (typeof originalCleanupDead !== 'function') {
    throw new Error('BattleScene.cleanupDead is missing; cannot install BCU stage spawn patch');
  }
  proto.cleanupDead = function cleanupDeadWithBcuUnitDeathNotify() {
    for (const actor of (this.actors || [])) notifyBcuUnitDeath(this, actor);
    return originalCleanupDead.call(this);
  };

  const originalSpawnStageEnemy = proto.spawnStageEnemy;
  if (typeof originalSpawnStageEnemy !== 'function') {
    throw new Error('BattleScene.spawnStageEnemy is missing; cannot install BCU stage spawn patch');
  }

  proto.spawnStageEnemy = function spawnStageEnemyBcuStageMetadata(unitDef, row) {
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
    const groupId = Number(group);
    if (!Number.isFinite(groupId) || groupId < 0 || groupId > 1000) return true;
    const limits = this.stage?.runtime?.groupLimits || this.stage?.definition?.groupLimits || null;
    const limit = limits ? Number(limits[groupId]) : NaN;
    if (!Number.isFinite(limit)) return true;
    const aliveInGroup = (this.actors || []).filter((a) => {
      if (!a || a.side !== 'cat-enemy') return false;
      if (typeof a.isAlive === 'function' && !a.isAlive()) return false;
      return Number(a.bcuStageGroup ?? a.stageGroup ?? a.group ?? a.stageSpawn?.group) === groupId;
    }).length;
    return aliveInGroup < limit;
  };

  proto.tickStageEnemySpawn = function tickStageEnemySpawnBcuStage() {
    if (this.stageSpawnRuntime && BATTLE_CONFIG.stage?.applyStageDefinition?.replaceEnemySpawnSchedule) {
      const counters = ensureKillCounter(this);
      const req = this.stageSpawnRuntime.tick(this.logicFrame, {
        logicFrame: this.logicFrame,
        aliveEnemyCount: this.actors.filter((a) => a.isAlive() && a.side === 'cat-enemy').length,
        maxEnemyCount: this.getEffectiveEnemyMaxCount(),
        enemyBaseHpPercent: this.getEnemyBaseHpPercent(),
        random: Math.random,
        killCounterByRowIndex: counters,
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
