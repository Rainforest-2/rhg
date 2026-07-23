import { BattleScene } from './BattleScene.js';
import { resolveBcuStageHealthWindow } from './BcuStageSpawnRuntime.js';

const PATCH_FLAG = Symbol.for('wanko-battle.custom-stage-trail-parity.v1');
const SUPPRESS_OLD_KC = Symbol('custom-stage-old-kc-suppressed');

function baseMetrics(scene, side) {
  const base = (scene?.bases || []).find((candidate) => candidate?.side === side) || null;
  const hp = Number(base?.hp ?? base?.health);
  const maxHp = Number(base?.maxHp ?? base?.maxH);
  if (!Number.isFinite(hp) || !Number.isFinite(maxHp) || maxHp <= 0) {
    return { base, hp: null, maxHp: null, hpPercent: 100, damage: 0, fallback: true };
  }
  return {
    base,
    hp,
    maxHp,
    hpPercent: Math.max(0, Math.min(100, (hp / maxHp) * 100)),
    damage: Math.max(0, maxHp - hp),
    fallback: false
  };
}

function healthContextForStage(scene, stageState) {
  const metrics = baseMetrics(scene, stageState?.side);
  const trail = stageState?.runtime?.trail === true || stageState?.definition?.trail === true;
  return {
    trail,
    enemyBaseHpPercent: metrics.hpPercent,
    enemyBaseDamage: metrics.damage,
    triggerDomain: trail ? 'accumulated-enemy-base-damage' : 'enemy-base-hp-percent',
    baseSide: stageState?.side || null,
    metrics
  };
}

function oppositeSide(side) {
  return side === 'dog-player' ? 'cat-enemy' : 'dog-player';
}

export function decrementCustomStageKillCountersWithCanonicalHealth(scene, deadActor) {
  if (!deadActor || deadActor.customStageBattleKillCountParityApplied === true) return [];
  if (deadActor.side !== 'dog-player' && deadActor.side !== 'cat-enemy') return [];
  deadActor.customStageBattleKillCountParityApplied = true;
  const targetSide = oppositeSide(deadActor.side);
  const states = (scene?.customStageBattle?.stageStates || []).filter((state) => state?.side === targetSide);
  const changed = [];
  for (const stageState of states) {
    const context = healthContextForStage(scene, stageState);
    for (const row of stageState?.runtime?.enemyRows || []) {
      const rowIndex = Number(row?.rowIndex);
      if (!Number.isFinite(rowIndex)) continue;
      const before = Number(stageState?.killCounterByRowIndex?.[rowIndex] || 0);
      const castle0 = Number(row?.baseHpTriggerPercent ?? row?.baseHpTriggerLowerPercent ?? row?.baseHpTrigger ?? 100);
      if (before <= 0 || castle0 === 0) continue;
      const healthWindow = resolveBcuStageHealthWindow(row, context);
      if (!healthWindow.inRange) continue;
      const after = Math.max(0, before - 1);
      stageState.killCounterByRowIndex[rowIndex] = after;
      changed.push({
        stageKey: stageState.stageKey,
        side: stageState.side,
        rowIndex,
        before,
        after,
        healthWindow
      });
    }
  }
  if (changed.length) {
    scene.pushEvent?.({
      type: 'customStageBattleKillCounterDecremented',
      actor: deadActor.instanceId || deadActor.label || null,
      deadSide: deadActor.side,
      source: 'canonical-resolveBcuStageHealthWindow',
      changed
    });
  }
  return changed;
}

function installSpawnContextAdapter(scene) {
  const restores = [];
  const healthByStage = [];
  for (const stageState of scene?.customStageBattle?.stageStates || []) {
    const runtime = stageState?.spawnRuntime;
    if (!runtime || typeof runtime.tick !== 'function') continue;
    const original = runtime.tick;
    const context = healthContextForStage(scene, stageState);
    runtime.tick = function tickWithCanonicalCustomStageHealth(frame, supplied = {}) {
      return original.call(this, frame, {
        ...supplied,
        trail: context.trail,
        enemyBaseHpPercent: context.enemyBaseHpPercent,
        enemyBaseDamage: context.enemyBaseDamage
      });
    };
    restores.push(() => { runtime.tick = original; });
    healthByStage.push({
      stageKey: stageState.stageKey,
      side: stageState.side,
      trail: context.trail,
      triggerDomain: context.triggerDomain,
      triggerValue: context.trail ? context.enemyBaseDamage : context.enemyBaseHpPercent,
      enemyBaseHpPercent: context.enemyBaseHpPercent,
      enemyBaseDamage: context.enemyBaseDamage,
      fallback: context.metrics.fallback
    });
  }
  return { restores, healthByStage };
}

export function installBattleSceneCustomStageTrailParityPatch() {
  const proto = BattleScene?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  const originalTickStageEnemySpawn = proto.tickStageEnemySpawn;
  if (typeof originalTickStageEnemySpawn === 'function') {
    proto.tickStageEnemySpawn = function tickStageEnemySpawnWithCanonicalCustomTrail(...args) {
      if (!this.customStageBattle?.enabled) return originalTickStageEnemySpawn.apply(this, args);
      const adapter = installSpawnContextAdapter(this);
      try {
        const result = originalTickStageEnemySpawn.apply(this, args);
        if (this.customStageBattle) {
          this.customStageBattle.spawnTickDebug = {
            ...(this.customStageBattle.spawnTickDebug || {}),
            healthWindows: adapter.healthByStage,
            healthWindowSource: 'resolveBcuStageHealthWindow'
          };
        }
        if (globalThis.__CUSTOM_STAGE_BATTLE_RUNTIME_DEBUG__) {
          globalThis.__CUSTOM_STAGE_BATTLE_RUNTIME_DEBUG__.spawnTick = this.customStageBattle?.spawnTickDebug || null;
        }
        return result;
      } finally {
        for (const restore of adapter.restores) restore();
      }
    };
  }

  // The original custom-stage cleanup wrapper decrements KC in percentage space.
  // Suppress only that private legacy callback, then apply the canonical health
  // function after the same actors have actually been removed.
  const originalCleanupDead = proto.cleanupDead;
  if (typeof originalCleanupDead === 'function') {
    proto.cleanupDead = function cleanupDeadWithCanonicalCustomStageKc() {
      const before = Array.isArray(this.actors) ? [...this.actors] : [];
      for (const actor of before) {
        if (!actor?.customStageBattle || actor.customStageBattleKillCountApplied === true) continue;
        actor[SUPPRESS_OLD_KC] = true;
        actor.customStageBattleKillCountApplied = true;
      }
      const result = originalCleanupDead.apply(this, arguments);
      const after = new Set(Array.isArray(this.actors) ? this.actors : []);
      for (const actor of before) {
        if (!actor?.[SUPPRESS_OLD_KC]) continue;
        delete actor[SUPPRESS_OLD_KC];
        if (after.has(actor)) {
          actor.customStageBattleKillCountApplied = false;
          continue;
        }
        decrementCustomStageKillCountersWithCanonicalHealth(this, actor);
      }
      return result;
    };
  }
}

installBattleSceneCustomStageTrailParityPatch();

export { baseMetrics, healthContextForStage };
