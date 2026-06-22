import { BattleScene } from './BattleScene.js';
import { BATTLE_CONFIG } from './BattleConfig.js';

const PATCH_FLAG = Symbol.for('wanko-battle.bcu-stage-spawn-patch.v2');
const BCU_SUMMON_STAGE_ALLOW_SOURCE = 'BCU SCDef.allow(StageBasis, AbEnemy) via smap/sdef/sub group limits';

function finiteInt(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

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

function stageStar(scene) {
  const star = finiteInt(
    scene?.stage?.runtime?.star
      ?? scene?.stage?.runtime?.stageStar
      ?? scene?.stage?.definition?.star
      ?? scene?.stage?.definition?.stageStar,
    0
  );
  return Math.max(0, Math.min(3, star));
}

function groupLimitValue(raw, star = 0) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number' || typeof raw === 'string') {
    const n = finiteInt(raw, null);
    return Number.isFinite(n) ? n : null;
  }
  const max = Array.isArray(raw) ? raw : (Array.isArray(raw?.max) ? raw.max : null);
  if (max) {
    const start = Math.max(0, Math.min(3, star));
    for (let i = start; i >= 0; i -= 1) {
      const n = finiteInt(max[i], null);
      if (!Number.isFinite(n)) continue;
      if (n !== -1 || i === 0) return n;
    }
    return null;
  }
  const direct = finiteInt(raw?.limit ?? raw?.maxCount ?? raw?.value, null);
  return Number.isFinite(direct) ? direct : null;
}

function getGroupLimits(scene) {
  return scene?.stage?.runtime?.groupLimits
    ?? scene?.stage?.runtime?.sub
    ?? scene?.stage?.definition?.groupLimits
    ?? scene?.stage?.definition?.sub
    ?? null;
}

function readMappedGroup(map, enemyId) {
  if (!map || enemyId === null || enemyId === undefined) return null;
  const keys = [enemyId, String(enemyId), `enemy:${enemyId}`, `AbEnemy:${enemyId}`];
  if (typeof map.get === 'function') {
    for (const key of keys) {
      const v = map.get(key);
      const n = finiteInt(v?.group ?? v, null);
      if (Number.isFinite(n)) return n;
    }
  }
  if (Array.isArray(map)) {
    for (const item of map) {
      const key = Array.isArray(item) ? item[0] : (item?.enemyId ?? item?.id ?? item?.key);
      if (!keys.includes(key) && !keys.includes(String(key))) continue;
      const value = Array.isArray(item) ? item[1] : (item?.group ?? item?.value);
      const n = finiteInt(value, null);
      if (Number.isFinite(n)) return n;
    }
  }
  if (typeof map === 'object') {
    for (const key of keys) {
      const v = map[key];
      const n = finiteInt(v?.group ?? v, null);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

function resolveSummonGroup(scene, proc = {}, unitDef = {}) {
  const enemyId = finiteInt(proc?.statsId ?? proc?.enemyId ?? unitDef?.statsId ?? unitDef?.enemyId, null);
  const runtime = scene?.stage?.runtime || {};
  const definition = scene?.stage?.definition || {};
  const map = runtime.summonGroupMap ?? runtime.smap ?? definition.summonGroupMap ?? definition.smap ?? null;
  const mapped = readMappedGroup(map, enemyId);
  if (Number.isFinite(mapped)) {
    return { group: mapped, requestedGroup: mapped, enemyId, groupSource: 'SCDef.smap' };
  }
  const fallback = finiteInt(runtime.summonGroupDefault ?? runtime.sdef ?? definition.summonGroupDefault ?? definition.sdef, 0);
  return { group: Number.isFinite(fallback) ? fallback : 0, requestedGroup: Number.isFinite(fallback) ? fallback : 0, enemyId, groupSource: 'SCDef.sdef' };
}

function resolveBcuStageGroupAllowed(scene, { group, side = 'cat-enemy' } = {}) {
  const groupId = finiteInt(group, null);
  if (!Number.isFinite(groupId) || groupId < 0 || groupId > 1000) {
    return { allowed: true, group: groupId, limit: null, aliveInGroup: 0, source: 'SCDef.allow val outside sub range' };
  }
  const limits = getGroupLimits(scene);
  const rawLimit = limits ? limits[groupId] ?? limits[String(groupId)] : null;
  const limit = groupLimitValue(rawLimit, stageStar(scene));
  if (!Number.isFinite(limit)) {
    return { allowed: true, group: groupId, limit: null, aliveInGroup: 0, source: 'SCDef.allow no SCGroup limit for group' };
  }
  const aliveInGroup = (scene?.actors || []).filter((a) => {
    if (!a || a.side !== side) return false;
    if (typeof a.isAlive === 'function' && !a.isAlive()) return false;
    return Number(a.bcuStageGroup ?? a.bcuSummonGroup ?? a.stageGroup ?? a.group ?? a.stageSpawn?.group) === groupId;
  }).length;
  return {
    allowed: aliveInGroup < limit,
    group: groupId,
    limit,
    aliveInGroup,
    source: 'SCDef.sub SCGroup.getMax'
  };
}

export function getBcuSummonStageAllowForScene(scene, { proc = {}, unitDef = {}, side = 'cat-enemy' } = {}) {
  const resolved = resolveSummonGroup(scene, proc, unitDef);
  const gate = resolveBcuStageGroupAllowed(scene, { group: resolved.group, side });
  return {
    allowed: gate.allowed,
    allow: gate.allowed,
    group: gate.allowed ? resolved.group : -1,
    requestedGroup: resolved.group,
    enemyId: resolved.enemyId,
    groupSource: resolved.groupSource,
    limit: gate.limit,
    aliveInGroup: gate.aliveInGroup,
    source: BCU_SUMMON_STAGE_ALLOW_SOURCE,
    gateSource: gate.source
  };
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
    return resolveBcuStageGroupAllowed(this, { group, side: 'cat-enemy' }).allowed;
  };

  proto.getBcuSummonStageAllow = function getBcuSummonStageAllow(args = {}) {
    return getBcuSummonStageAllowForScene(this, args);
  };

  proto.tickStageEnemySpawn = function tickStageEnemySpawnBcuStage() {
    if (this.stageSpawnRuntime && BATTLE_CONFIG.stage?.applyStageDefinition?.replaceEnemySpawnSchedule) {
      const counters = ensureKillCounter(this);
      const req = this.stageSpawnRuntime.tick(this.logicFrame, {
        logicFrame: this.logicFrame,
        aliveEnemyCount: this.actors.filter((a) => a.isAlive() && a.side === 'cat-enemy').length,
        maxEnemyCount: this.getEffectiveEnemyMaxCount(),
        enemyBaseHpPercent: this.getEnemyBaseHpPercent(),
        // tick() itself draws no RNG (it only gates/emits); the scene CopRand is consumed in
        // commitSpawn (row respawn -> spawn layer -> global respawn), matching BCU EStage.allow.
        random: typeof this.getBcuCopRand === 'function' ? () => this.getBcuCopRand().nextFloat() : Math.random,
        killCounterByRowIndex: counters,
        isGroupAllowed: (args) => this.isBcuStageGroupAllowed(args)
      });
      const commitRandom = typeof this.getBcuRandom === 'function' ? this.getBcuRandom() : Math.random;
      for (const r of req) {
        const ok = this.spawnStageEnemy(r.unitDef, r);
        if (ok) {
          const spawned = this.actors[this.actors.length - 1] || null;
          const commit = this.stageSpawnRuntime.commitSpawn(r, { random: commitRandom });
          // BCU EEnemy assigns currentLayer from the spawn-layer draw; apply it to the actor.
          // The actor was just created (no battle RNG drawn during creation), so the
          // row-respawn -> spawn-layer -> global-respawn draw order in commitSpawn is preserved.
          if (spawned && commit && Number.isFinite(commit.currentLayer)) {
            spawned.currentLayer = commit.currentLayer;
            spawned.bcuRenderLayerSource = 'bcu-stage-spawn-layer';
            r.currentLayer = commit.currentLayer;
          }
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
