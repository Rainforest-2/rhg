import { FormationEditor } from './FormationEditor.js';

const PATCH_FLAG = Symbol.for('wanko-formation-custom-stage-battle-hp-patch.v1');
const GLOBAL_CONFIG_KEY = '__CUSTOM_STAGE_BATTLE_CONFIG__';
const STORAGE_KEY = 'wanko.customStageBattle.v1';
const FIXED_HP = 10000000;
const DRAIN_PER_FRAME = 100;
// Auto barrier break: when enabled, cumulative damage absorbed by a barrier breaks it once it reaches
// this multiple of the barrier's durability (max HP). User spec: バリア耐久値の5倍。
const AUTO_BARRIER_BREAK_MULTIPLIER = 5;

function uniqueList(values) {
  return [...new Set((values || []).filter(Boolean).map(String))];
}

function readStoredPayload() {
  try {
    const raw = globalThis.localStorage?.getItem?.(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && parsed.mode === 'stage-vs-stage-multi' ? parsed : null;
  } catch {
    return null;
  }
}

function ensureHpState(editor) {
  if (!editor?.customStageBattle) return null;
  const stored = readStoredPayload() || {};
  if (editor.customStageBattle.fixedBaseHpEnabled === undefined) editor.customStageBattle.fixedBaseHpEnabled = !!stored.fixedBaseHpEnabled;
  if (editor.customStageBattle.baseHpDrainEnabled === undefined) editor.customStageBattle.baseHpDrainEnabled = !!stored.baseHpDrainEnabled;
  if (editor.customStageBattle.autoBarrierBreakEnabled === undefined) editor.customStageBattle.autoBarrierBreakEnabled = !!stored.autoBarrierBreakEnabled;
  editor.customStageBattle.fixedBaseHpEnabled = !!editor.customStageBattle.fixedBaseHpEnabled;
  editor.customStageBattle.baseHpDrainEnabled = !!editor.customStageBattle.baseHpDrainEnabled && editor.customStageBattle.fixedBaseHpEnabled;
  editor.customStageBattle.autoBarrierBreakEnabled = !!editor.customStageBattle.autoBarrierBreakEnabled;
  return editor.customStageBattle;
}

function buildExtendedConfig(config, state) {
  const fixedBaseHpEnabled = !!state?.fixedBaseHpEnabled;
  return {
    ...(config || {}),
    fixedBaseHpEnabled,
    fixedBaseHpValue: FIXED_HP,
    baseHpDrainEnabled: fixedBaseHpEnabled && !!state?.baseHpDrainEnabled,
    baseHpDrainPerFrame: DRAIN_PER_FRAME,
    autoBarrierBreakEnabled: !!state?.autoBarrierBreakEnabled,
    autoBarrierBreakMultiplier: AUTO_BARRIER_BREAK_MULTIPLIER,
    baseHpPolicySource: 'FormationCustomStageBattleHpPatch'
  };
}

function persistExtendedState(editor) {
  const state = ensureHpState(editor);
  if (!state) return;
  const previous = readStoredPayload() || {};
  const payload = {
    ...previous,
    mode: 'stage-vs-stage-multi',
    enabled: !!state.enabled,
    enemyStageIds: uniqueList(state.enemyStageIds),
    playerStageIds: uniqueList(state.playerStageIds),
    baseSource: state.baseSource === 'player' ? 'player' : 'enemy',
    fixedBaseHpEnabled: !!state.fixedBaseHpEnabled,
    baseHpDrainEnabled: !!state.fixedBaseHpEnabled && !!state.baseHpDrainEnabled,
    autoBarrierBreakEnabled: !!state.autoBarrierBreakEnabled,
    fixedBaseHpValue: FIXED_HP,
    baseHpDrainPerFrame: DRAIN_PER_FRAME,
    autoBarrierBreakMultiplier: AUTO_BARRIER_BREAK_MULTIPLIER,
    updatedAt: Date.now()
  };
  try { globalThis.localStorage?.setItem?.(STORAGE_KEY, JSON.stringify(payload)); } catch {}
  const baseConfig = typeof editor.getCustomStageBattleConfig === 'function' ? editor.getCustomStageBattleConfig() : globalThis[GLOBAL_CONFIG_KEY];
  globalThis[GLOBAL_CONFIG_KEY] = buildExtendedConfig(baseConfig, state);
}

function updateButton(button, active, label) {
  if (!button) return;
  button.classList.toggle('is-active', !!active);
  button.textContent = label;
}

function injectHpControls(editor) {
  const state = ensureHpState(editor);
  const root = editor?.root;
  if (!state || !root || editor.stageSelectorState?.level !== 'custom-stage-battle') return;
  const controls = root.querySelector?.('.formation-custom-stage-controls');
  if (!controls) return;
  if (!controls.querySelector('[data-action="custom-stage-fixed-base-hp"]')) {
    controls.insertAdjacentHTML('beforeend', `
      <button type="button" data-action="custom-stage-fixed-base-hp"></button>
      <button type="button" data-action="custom-stage-base-hp-drain"></button>
      <button type="button" data-action="custom-stage-auto-barrier-break"></button>
    `);
  }
  updateButton(
    controls.querySelector('[data-action="custom-stage-fixed-base-hp"]'),
    state.fixedBaseHpEnabled,
    state.fixedBaseHpEnabled ? '城HP: 1000万固定 ON' : '城HP: 1000万固定 OFF'
  );
  updateButton(
    controls.querySelector('[data-action="custom-stage-base-hp-drain"]'),
    state.baseHpDrainEnabled,
    state.baseHpDrainEnabled ? '毎FPS: 両城HP -100 ON' : '毎FPS: 両城HP -100 OFF'
  );
  updateButton(
    controls.querySelector('[data-action="custom-stage-auto-barrier-break"]'),
    state.autoBarrierBreakEnabled,
    state.autoBarrierBreakEnabled ? `オートバリアブレイク: 耐久${AUTO_BARRIER_BREAK_MULTIPLIER}倍で破壊 ON` : 'オートバリアブレイク OFF'
  );
  const note = root.querySelector?.('.formation-custom-stage-note');
  if (note && state.fixedBaseHpEnabled) {
    const drain = state.baseHpDrainEnabled ? ' / 毎FPS両城HPを100減少' : '';
    note.textContent = `${note.textContent} / 城HPは敵味方とも1000万固定${drain}`;
  }
}

export function installFormationCustomStageBattleHpPatch() {
  const proto = FormationEditor?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  const originalGetConfig = proto.getCustomStageBattleConfig;
  proto.getCustomStageBattleConfig = function getCustomStageBattleConfigWithHpPolicy(...args) {
    const config = typeof originalGetConfig === 'function' ? originalGetConfig.apply(this, args) : globalThis[GLOBAL_CONFIG_KEY];
    return buildExtendedConfig(config, ensureHpState(this));
  };

  const originalRender = proto.renderStageSelector;
  proto.renderStageSelector = function renderStageSelectorWithCustomHpPolicy(...args) {
    const result = originalRender.apply(this, args);
    injectHpControls(this);
    return result;
  };

  const originalOnClick = proto.onClick;
  proto.onClick = async function onClickWithCustomHpPolicy(e) {
    const action = e.target.closest?.('[data-action]');
    const type = action?.dataset?.action;
    if ((type === 'custom-stage-fixed-base-hp' || type === 'custom-stage-base-hp-drain' || type === 'custom-stage-auto-barrier-break') && this.root?.contains(action)) {
      e.preventDefault();
      e.stopPropagation();
      const state = ensureHpState(this);
      if (type === 'custom-stage-fixed-base-hp') {
        state.fixedBaseHpEnabled = !state.fixedBaseHpEnabled;
        if (!state.fixedBaseHpEnabled) state.baseHpDrainEnabled = false;
      } else if (type === 'custom-stage-auto-barrier-break') {
        state.autoBarrierBreakEnabled = !state.autoBarrierBreakEnabled;
      } else {
        if (!state.fixedBaseHpEnabled) state.fixedBaseHpEnabled = true;
        state.baseHpDrainEnabled = !state.baseHpDrainEnabled;
      }
      persistExtendedState(this);
      this.stageSelectorState = { level: 'custom-stage-battle', categoryId: null, mapKey: null };
      this.renderStageSelector();
      return;
    }
    const result = await originalOnClick.call(this, e);
    ensureHpState(this);
    persistExtendedState(this);
    injectHpControls(this);
    return result;
  };
}

installFormationCustomStageBattleHpPatch();
