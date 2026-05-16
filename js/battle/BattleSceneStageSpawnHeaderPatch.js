import { BattleScene } from './BattleScene.js';

const PATCH_FLAG = Symbol.for('wanko-battle.stage-spawn-header-patch.v1');

function copyHeader(scene, runtime = scene?.stage?.runtime) {
  const def = scene?.stage?.definition;
  if (!runtime || !def) return runtime;
  if (Number.isFinite(def.minSpawnFrame)) runtime.minSpawnFrame = def.minSpawnFrame;
  if (Number.isFinite(def.maxSpawnFrame)) runtime.maxSpawnFrame = def.maxSpawnFrame;
  runtime.globalRespawnSource = 'BCU StageBasis.respawnTime from stage header min/max spawn';
  return runtime;
}

export function installBattleSceneStageSpawnHeaderPatch() {
  const proto = BattleScene?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  const originalBuild = proto.buildStageRuntime;
  if (typeof originalBuild === 'function') {
    proto.buildStageRuntime = function buildStageRuntimeWithSpawnHeader(...args) {
      return copyHeader(this, originalBuild.apply(this, args));
    };
  }

  const originalInit = proto.init;
  if (typeof originalInit === 'function') {
    proto.init = async function initWithSpawnHeader(...args) {
      const result = await originalInit.apply(this, args);
      copyHeader(this);
      if (this.stageSpawnRuntime) {
        this.stageSpawnRuntime.globalRespawnTime = 0;
        this.stageSpawnRuntime.lastGlobalRespawnDebug = {
          source: 'BCU StageBasis initial respawnTime = 0',
          initialized: 0,
          minSpawnFrame: this.stage?.runtime?.minSpawnFrame ?? null,
          maxSpawnFrame: this.stage?.runtime?.maxSpawnFrame ?? null
        };
      }
      this.pushEvent?.({
        type: 'bcuStageSpawnHeaderApplied',
        minSpawnFrame: this.stage?.runtime?.minSpawnFrame ?? null,
        maxSpawnFrame: this.stage?.runtime?.maxSpawnFrame ?? null,
        globalRespawnTime: this.stageSpawnRuntime?.globalRespawnTime ?? null
      });
      return result;
    };
  }
}

installBattleSceneStageSpawnHeaderPatch();
