import { BattleScene } from './BattleScene.js';

const PATCH_FLAG = Symbol.for('wanko-battle.custom-stage-config-fallback.v1');
const GLOBAL_CONFIG_KEY = '__CUSTOM_STAGE_BATTLE_CONFIG__';

function hasCustomConfig(config) {
  return !!config && (config.enabled === true || config.requestedEnabled === true || config.mode === 'stage-vs-stage-multi');
}

export function installBattleSceneCustomStageConfigFallbackPatch() {
  const Original = BattleScene;
  if (Original[PATCH_FLAG]) return Original;

  class PatchedBattleScene extends Original {
    constructor(uiLog, options = {}) {
      const globalConfig = globalThis[GLOBAL_CONFIG_KEY] || null;
      const nextOptions = { ...(options || {}) };
      if (!hasCustomConfig(nextOptions.customStageBattle) && hasCustomConfig(globalConfig)) {
        nextOptions.customStageBattle = globalConfig;
        if (globalConfig.enabled && globalConfig.baseStageId && !nextOptions.selectedStageId) nextOptions.selectedStageId = globalConfig.baseStageId;
      }
      super(uiLog, nextOptions);
      if (hasCustomConfig(nextOptions.customStageBattle)) {
        this.options.customStageBattle = nextOptions.customStageBattle;
        this.lastCustomStageConfigFallbackDebug = {
          source: 'BattleSceneCustomStageConfigFallbackPatch.constructor',
          selectedStageId: this.options.selectedStageId || null,
          customStageBattle: nextOptions.customStageBattle
        };
        globalThis.__CUSTOM_STAGE_BATTLE_SCENE_DEBUG__ = this.lastCustomStageConfigFallbackDebug;
      }
    }
  }

  Object.defineProperty(PatchedBattleScene, PATCH_FLAG, { value: true });
  globalThis.__BATTLE_SCENE_CUSTOM_STAGE_CONFIG_FALLBACK_CLASS__ = PatchedBattleScene;
  return PatchedBattleScene;
}

installBattleSceneCustomStageConfigFallbackPatch();
