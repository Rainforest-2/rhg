import { PreviewApp } from './PreviewApp.js';

const PATCH_FLAG = Symbol.for('wanko-preview.custom-stage-config-before-apply.v1');
const GLOBAL_CONFIG_KEY = '__CUSTOM_STAGE_BATTLE_CONFIG__';
const FIXED_HP = 10000000;
const DRAIN_PER_FRAME = 100;

function uniqueList(values) {
  return [...new Set((values || []).filter(Boolean).map(String))];
}

function normalizeConfig(config = {}) {
  const enemyStageIds = uniqueList(config.enemyStageIds);
  const playerStageIds = uniqueList(config.playerStageIds);
  const valid = enemyStageIds.length > 0 && playerStageIds.length > 0;
  const baseSource = config.baseSource === 'player' ? 'player' : 'enemy';
  const baseStageId = config.baseStageId || (baseSource === 'player'
    ? (playerStageIds[0] || enemyStageIds[0] || null)
    : (enemyStageIds[0] || playerStageIds[0] || null));
  const fixed = !!config.fixedBaseHpEnabled;
  return {
    ...config,
    mode: 'stage-vs-stage-multi',
    enabled: !!config.enabled && valid,
    requestedEnabled: !!config.requestedEnabled || !!config.enabled,
    enemyStageIds,
    playerStageIds,
    baseSource,
    baseStageId,
    valid,
    invalidReason: valid ? null : 'both-enemy-and-player-stage-lists-required',
    fixedBaseHpEnabled: fixed,
    fixedBaseHpValue: Number.isFinite(Number(config.fixedBaseHpValue)) ? Number(config.fixedBaseHpValue) : FIXED_HP,
    baseHpDrainEnabled: fixed && !!config.baseHpDrainEnabled,
    baseHpDrainPerFrame: Number.isFinite(Number(config.baseHpDrainPerFrame)) ? Number(config.baseHpDrainPerFrame) : DRAIN_PER_FRAME,
    source: 'PreviewAppCustomStageBattleConfigPatch.normalizeConfig'
  };
}

export function installPreviewAppCustomStageBattleConfigPatch() {
  const proto = PreviewApp?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  const originalApply = proto.applyFormationToBattle;
  proto.applyFormationToBattle = async function applyFormationToBattleWithCustomStageConfig(...args) {
    const editorConfig = typeof this.formationEditor?.getCustomStageBattleConfig === 'function'
      ? this.formationEditor.getCustomStageBattleConfig()
      : null;
    const config = normalizeConfig(editorConfig || globalThis[GLOBAL_CONFIG_KEY] || {});
    if (config.requestedEnabled || config.enabled) {
      globalThis[GLOBAL_CONFIG_KEY] = config;
      this.customStageBattleConfig = config;
      if (config.enabled && config.baseStageId) {
        this.selectedStageId = config.baseStageId;
        this.formationEditor && (this.formationEditor.selectedStageId = config.baseStageId);
      }
      globalThis.__CUSTOM_STAGE_BATTLE_APPLY_DEBUG__ = {
        source: 'PreviewAppCustomStageBattleConfigPatch.applyFormationToBattle',
        config,
        selectedStageId: this.selectedStageId,
        timestamp: Date.now()
      };
      this.ui?.log?.('info', `Custom stage config applied: enabled=${config.enabled} base=${config.baseStageId || '-'} fixedHp=${config.fixedBaseHpEnabled} drain=${config.baseHpDrainEnabled}`);
    }
    return originalApply.apply(this, args);
  };
}

installPreviewAppCustomStageBattleConfigPatch();
