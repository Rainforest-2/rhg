import { BattleScene } from './BattleScene.js';
import { StageRuntimeSceneAdapter } from './StageRuntimeSceneAdapter.js';

function wrapMethod(proto, name, wrapper) {
  const original = proto?.[name];
  if (typeof original !== 'function') return false;
  if (original.__stageRuntimeWired) return true;
  const wrapped = wrapper(original);
  wrapped.__stageRuntimeWired = true;
  proto[name] = wrapped;
  return true;
}

function wireBattleSceneStageRuntime() {
  const proto = BattleScene?.prototype;
  if (!proto || proto.__stageRuntimeSceneAdapterWired) return;

  wrapMethod(proto, 'buildStageRuntime', (original) => function buildStageRuntimeWithAdapter(stageDefinition, options = {}) {
    const runtime = StageRuntimeSceneAdapter.build(this, stageDefinition || this?.stage?.definition, options);
    const legacyRuntime = original.apply(this, arguments);
    const mergedRuntime = {
      ...(legacyRuntime || {}),
      ...runtime,
      warnings: [
        ...((legacyRuntime?.warnings || [])),
        ...((runtime?.warnings || []))
      ]
    };
    if (this.stage) this.stage.runtime = mergedRuntime;
    this.pushEvent?.({
      type: 'stageRuntimeBuilt',
      source: 'StageRuntimeSceneAdapter',
      stageLen: mergedRuntime.stageLen,
      bgId: mergedRuntime.bgId,
      castleId: mergedRuntime.castleId,
      animBaseId: mergedRuntime.animBaseId,
      enemyBaseHp: mergedRuntime.enemyBaseHp,
      maxEnemyCount: mergedRuntime.maxEnemyCount,
      effectiveMaxEnemyCount: mergedRuntime.effectiveMaxEnemyCount,
      enemySpawnWorldX: mergedRuntime.enemySpawnWorldX,
      playerSpawnWorldX: mergedRuntime.playerSpawnWorldX
    });
    return mergedRuntime;
  });

  proto.getEnemyBaseHpPercent = function getEnemyBaseHpPercent() {
    return StageRuntimeSceneAdapter.getEnemyBaseHpPercent(this);
  };
  proto.getStageSpawnTickContext = function getStageSpawnTickContext(overrides = {}) {
    return StageRuntimeSceneAdapter.buildSpawnTickContext(this, overrides);
  };

  wrapMethod(proto, 'tickStageEnemySpawn', (original) => function tickStageEnemySpawnWithRuntimeContext(...args) {
    this.lastStageSpawnTickContext = StageRuntimeSceneAdapter.buildSpawnTickContext(this);
    return original.apply(this, args);
  });

  wrapMethod(proto, 'spawnStageEnemy', (original) => function spawnStageEnemyWithRuntimeDebug(unitDef, row) {
    const result = original.apply(this, arguments);
    const debug = row?.spawnResolveDebug || row?.row?.spawnResolveDebug || this.lastSpawnResolveDebug || null;
    if (result && debug) {
      this.pushEvent?.({
        type: 'stageEnemySpawnRuntimeDebug',
        rowIndex: row?.rowIndex ?? row?.row?.rowIndex ?? null,
        spawnWorldX: debug.worldX ?? row?.spawnWorldX ?? row?.worldX ?? null,
        spawnWorldXSource: debug.source ?? row?.spawnWorldXSource ?? null,
        stageLen: debug.stageLen ?? this.stage?.runtime?.stageLen ?? null,
        baseFrontX: debug.baseFrontX ?? null,
        bossFlag: debug.bossFlag ?? row?.bossFlag ?? row?.row?.bossFlag ?? null,
        fallbackReason: debug.fallbackReason ?? null
      });
    }
    return result;
  });

  proto.__stageRuntimeSceneAdapterWired = true;
}

wireBattleSceneStageRuntime();

export { wireBattleSceneStageRuntime };
