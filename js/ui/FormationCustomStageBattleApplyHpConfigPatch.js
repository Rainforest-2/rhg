import { FormationEditor } from './FormationEditor.js';

const PATCH_FLAG = Symbol.for('wanko-formation-custom-stage-battle-apply-hp-config.v1');
const GLOBAL_CONFIG_KEY = '__CUSTOM_STAGE_BATTLE_CONFIG__';
const STORAGE_KEY = 'wanko.customStageBattle.v1';
const FIXED_HP = 10000000;
const DRAIN_PER_FRAME = 100;

function uniqueList(values) {
  return [...new Set((values || []).filter(Boolean).map(String))];
}

function storedHpOptions() {
  try {
    const raw = globalThis.localStorage?.getItem?.(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.mode !== 'stage-vs-stage-multi') return {};
    return {
      fixedBaseHpEnabled: !!parsed.fixedBaseHpEnabled,
      baseHpDrainEnabled: !!parsed.baseHpDrainEnabled,
      fixedBaseHpValue: Number(parsed.fixedBaseHpValue || FIXED_HP),
      baseHpDrainPerFrame: Number(parsed.baseHpDrainPerFrame || DRAIN_PER_FRAME)
    };
  } catch {
    return {};
  }
}

function extendConfig(editor, config = {}) {
  const state = editor?.customStageBattle || {};
  const stored = storedHpOptions();
  const fixed = state.fixedBaseHpEnabled !== undefined ? !!state.fixedBaseHpEnabled : !!stored.fixedBaseHpEnabled;
  const drain = fixed && (state.baseHpDrainEnabled !== undefined ? !!state.baseHpDrainEnabled : !!stored.baseHpDrainEnabled);
  return {
    ...config,
    enemyStageIds: uniqueList(config.enemyStageIds || state.enemyStageIds),
    playerStageIds: uniqueList(config.playerStageIds || state.playerStageIds),
    fixedBaseHpEnabled: fixed,
    fixedBaseHpValue: Number.isFinite(Number(stored.fixedBaseHpValue)) ? Number(stored.fixedBaseHpValue) : FIXED_HP,
    baseHpDrainEnabled: drain,
    baseHpDrainPerFrame: Number.isFinite(Number(stored.baseHpDrainPerFrame)) ? Number(stored.baseHpDrainPerFrame) : DRAIN_PER_FRAME,
    baseHpPolicySource: 'FormationCustomStageBattleApplyHpConfigPatch.extendConfig'
  };
}

function persistExtendedConfig(editor, config) {
  const state = editor?.customStageBattle || {};
  const payload = {
    mode: 'stage-vs-stage-multi',
    enabled: !!state.enabled,
    enemyStageIds: uniqueList(state.enemyStageIds),
    playerStageIds: uniqueList(state.playerStageIds),
    baseSource: state.baseSource === 'player' ? 'player' : 'enemy',
    fixedBaseHpEnabled: !!config.fixedBaseHpEnabled,
    fixedBaseHpValue: Number(config.fixedBaseHpValue || FIXED_HP),
    baseHpDrainEnabled: !!config.baseHpDrainEnabled,
    baseHpDrainPerFrame: Number(config.baseHpDrainPerFrame || DRAIN_PER_FRAME),
    updatedAt: Date.now()
  };
  try { globalThis.localStorage?.setItem?.(STORAGE_KEY, JSON.stringify(payload)); } catch {}
  globalThis[GLOBAL_CONFIG_KEY] = config;
}

export function installFormationCustomStageBattleApplyHpConfigPatch() {
  const proto = FormationEditor?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  const originalOnClick = proto.onClick;
  proto.onClick = async function onClickApplyCustomStageHpConfig(e) {
    const action = e.target.closest?.('[data-action]');
    const type = action?.dataset?.action;
    if (type === 'apply' && !this.applying && this.customStageBattle?.enabled) {
      const baseConfig = typeof this.getCustomStageBattleConfig === 'function'
        ? this.getCustomStageBattleConfig()
        : globalThis[GLOBAL_CONFIG_KEY];
      const config = extendConfig(this, baseConfig || {});
      if (config.requestedEnabled && !config.valid) {
        e.preventDefault();
        e.stopPropagation();
        this.setHint?.('Custom stage battle requires at least one enemy-side stage and one player-side stage.');
        this.stageSelectorState = { level: 'custom-stage-battle', categoryId: null, mapKey: null };
        this.renderStageSelector?.();
        return;
      }
      if (config.enabled && config.baseStageId) {
        this.selectedStageId = config.baseStageId;
        this.onStageChanged?.(this.selectedStageId);
      }
      persistExtendedConfig(this, config);
      e.preventDefault();
      e.stopPropagation();
      const btn = this.root?.querySelector?.('.apply-battle-button');
      this.applying = true;
      if (btn) { btn.disabled = true; btn.textContent = 'Applying...'; }
      try {
        await this.onApplyBattle(this.formation, config);
      } catch (err) {
        console.error('[FormationEditor] custom stage apply failed detail', { name: err?.name, message: err?.message, stack: err?.stack, cause: err?.cause, error: err });
        this.setHint?.(`Apply failed: ${err?.message || String(err)}`);
      } finally {
        this.applying = false;
        if (btn) { btn.disabled = false; btn.textContent = 'Apply Battle'; }
      }
      return;
    }
    return originalOnClick.call(this, e);
  };
}

installFormationCustomStageBattleApplyHpConfigPatch();
