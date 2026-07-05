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

function safeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch]));
}

const STYLE_ID = 'wanko-custom-stage-hp-settings-style';
function ensureOverlayStyle() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
html body.nyanko-ui-polish .formation-custom-stage-controls [data-action="custom-stage-hp-settings-open"]{position:relative}
html body.nyanko-ui-polish .formation-custom-stage-controls [data-action="custom-stage-hp-settings-open"] .hpset-badge{display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;margin-left:6px;padding:0 5px;border:2px solid #000;border-radius:999px;background:#ff6a19;color:#fff;-webkit-text-fill-color:#fff;font-size:.66rem;font-weight:1000}
html body.nyanko-ui-polish .hpset-overlay{position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;padding:16px}
html body.nyanko-ui-polish .hpset-backdrop{position:absolute;inset:0;background:rgba(8,12,20,.55)}
html body.nyanko-ui-polish .hpset-card{position:relative;width:min(460px,100%);max-height:86dvh;display:flex;flex-direction:column;border:3px solid #000;border-radius:14px;background:#fff7dd;box-shadow:0 10px 0 rgba(0,0,0,.35),0 4px 0 #000;overflow:hidden}
html body.nyanko-ui-polish .hpset-head{display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:3px solid #000;background:linear-gradient(180deg,#fff9d8,#f7d96b)}
html body.nyanko-ui-polish .hpset-head strong{flex:1 1 auto;font-weight:1000;color:#120700;-webkit-text-fill-color:#120700;font-size:1.02rem}
html body.nyanko-ui-polish .hpset-x{flex:0 0 auto;min-width:36px;height:36px;border:3px solid #000;border-radius:999px;background:#fff;color:#120700;-webkit-text-fill-color:#120700;font-weight:1000;font-size:1.1rem;cursor:pointer}
html body.nyanko-ui-polish .hpset-body{padding:12px;overflow:auto;display:grid;gap:14px}
html body.nyanko-ui-polish .hpset-group{display:grid;gap:8px}
html body.nyanko-ui-polish .hpset-group>h4{margin:0;font-weight:1000;color:#7a4a12;-webkit-text-fill-color:#7a4a12;font-size:.82rem;letter-spacing:.02em}
html body.nyanko-ui-polish .hpset-row{width:100%;display:flex;align-items:center;gap:10px;text-align:left;min-height:56px;padding:9px 12px;border:3px solid #000;border-radius:10px;background:#fff;box-shadow:0 3px 0 #000;cursor:pointer}
html body.nyanko-ui-polish .hpset-row.is-on{background:linear-gradient(180deg,#28c785,#158a5a);color:#fff;-webkit-text-fill-color:#fff}
html body.nyanko-ui-polish .hpset-row[disabled]{opacity:.45;cursor:not-allowed;box-shadow:0 2px 0 #000}
html body.nyanko-ui-polish .hpset-row-main{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:2px}
html body.nyanko-ui-polish .hpset-row-title{font-weight:1000;font-size:.9rem}
html body.nyanko-ui-polish .hpset-row-desc{font-weight:800;font-size:.7rem;opacity:.82}
html body.nyanko-ui-polish .hpset-row.is-on .hpset-row-desc{color:#eafff5;-webkit-text-fill-color:#eafff5}
html body.nyanko-ui-polish .hpset-row-state{flex:0 0 auto;min-width:44px;text-align:center;padding:4px 8px;border:2px solid #000;border-radius:999px;background:#ffe25a;color:#160800;-webkit-text-fill-color:#160800;font-weight:1000;font-size:.74rem}
html body.nyanko-ui-polish .hpset-row.is-on .hpset-row-state{background:#0a4d31;color:#fff;-webkit-text-fill-color:#fff}
html body.nyanko-ui-polish .hpset-children{display:grid;gap:8px;margin-left:14px;padding-left:12px;border-left:3px dashed rgba(0,0,0,.35)}
html body.nyanko-ui-polish .hpset-children.is-locked{opacity:.5}
html body.nyanko-ui-polish .hpset-seg-row{display:grid;gap:8px;padding:10px 12px;border:3px solid #000;border-radius:10px;background:#fff;box-shadow:0 3px 0 #000}
html body.nyanko-ui-polish .hpset-seg{display:grid;grid-template-columns:1fr 1fr;gap:8px}
html body.nyanko-ui-polish .hpset-seg-btn{min-height:44px;padding:0 12px;border:3px solid #000;border-radius:999px;background:#fff;color:#120700;-webkit-text-fill-color:#120700;font-weight:1000;font-size:.82rem;cursor:pointer}
html body.nyanko-ui-polish .hpset-seg-btn.is-on{background:linear-gradient(180deg,#ff6a19,#f15212 52%,#e14008);color:#fff;-webkit-text-fill-color:#fff}`;
  document.head.appendChild(style);
}

function activeSettingCount(state) {
  return (state.fixedBaseHpEnabled ? 1 : 0) + (state.baseHpDrainEnabled ? 1 : 0) + (state.autoBarrierBreakEnabled ? 1 : 0);
}

function hpRow(action, active, title, desc, { disabled = false } = {}) {
  return `<button type="button" data-action="${action}" class="hpset-row ${active ? 'is-on' : ''}" ${disabled ? 'disabled' : ''}>
    <span class="hpset-row-main"><span class="hpset-row-title">${safeHtml(title)}</span>${desc ? `<span class="hpset-row-desc">${safeHtml(desc)}</span>` : ''}</span>
    <span class="hpset-row-state">${active ? 'ON' : 'OFF'}</span>
  </button>`;
}

// The settings are grouped by what they act on, and the per-frame drain is nested UNDER the fixed-HP
// row because the runtime only drains when HP is fixed (baseHpDrainEnabled は fixedBaseHpEnabled 依存)。
function hpSettingsBody(state) {
  const basePlayer = state.baseSource === 'player';
  return `
    <section class="hpset-group">
      <h4>全体</h4>
      <div class="hpset-seg-row">
        <span class="hpset-row-main"><span class="hpset-row-title">背景 / 戦場の長さ</span><span class="hpset-row-desc">どちらの1番目ステージから背景・戦場長を取るか</span></span>
        <div class="hpset-seg">
          <button type="button" data-action="custom-stage-base-enemy" class="hpset-seg-btn ${basePlayer ? '' : 'is-on'}">敵側 1番目</button>
          <button type="button" data-action="custom-stage-base-player" class="hpset-seg-btn ${basePlayer ? 'is-on' : ''}">味方側 1番目</button>
        </div>
      </div>
    </section>
    <section class="hpset-group">
      <h4>城HP</h4>
      ${hpRow('custom-stage-fixed-base-hp', state.fixedBaseHpEnabled, '城HPを1000万に固定', '敵味方とも城の体力を10,000,000に固定します')}
      <div class="hpset-children ${state.fixedBaseHpEnabled ? '' : 'is-locked'}">
        ${hpRow('custom-stage-base-hp-drain', state.baseHpDrainEnabled, '毎フレーム 両城HP -100', '固定HPが少しずつ減り、時間切れ決着を作れます', { disabled: !state.fixedBaseHpEnabled })}
      </div>
    </section>
    <section class="hpset-group">
      <h4>バリア</h4>
      ${hpRow('custom-stage-auto-barrier-break', state.autoBarrierBreakEnabled, 'オートバリアブレイク', `吸収ダメージが耐久${AUTO_BARRIER_BREAK_MULTIPLIER}倍に達すると自動でバリアを破壊`)}
    </section>`;
}

function findPanel(editor) {
  return editor?.root?.querySelector?.('.formation-custom-stage-battle') || null;
}

function renderHpSettingsOverlay(editor) {
  ensureOverlayStyle();
  const state = ensureHpState(editor);
  const panel = findPanel(editor);
  if (!state || !panel) return;
  let overlay = panel.querySelector(':scope > .hpset-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'hpset-overlay';
    overlay.dataset.hpsetOverlay = '1';
    panel.appendChild(overlay);
  }
  overlay.innerHTML = `
    <div class="hpset-backdrop" data-action="custom-stage-hp-settings-close"></div>
    <div class="hpset-card">
      <header class="hpset-head">
        <strong>詳細バトル設定</strong>
        <button type="button" class="hpset-x" data-action="custom-stage-hp-settings-close" aria-label="閉じる">×</button>
      </header>
      <div class="hpset-body">${hpSettingsBody(state)}</div>
    </div>`;
}

function refreshHpSettingsOverlay(editor) {
  const overlay = findPanel(editor)?.querySelector(':scope > .hpset-overlay');
  if (!overlay) return false;
  const state = ensureHpState(editor);
  const body = overlay.querySelector('.hpset-body');
  if (body) body.innerHTML = hpSettingsBody(state);
  return true;
}

function closeHpSettingsOverlay(editor) {
  findPanel(editor)?.querySelector(':scope > .hpset-overlay')?.remove();
}

function injectHpControls(editor) {
  ensureOverlayStyle();
  const state = ensureHpState(editor);
  const root = editor?.root;
  if (!state || !root || editor.stageSelectorState?.level !== 'custom-stage-battle') return;
  const controls = root.querySelector?.('.formation-custom-stage-controls');
  if (!controls) return;
  if (!controls.querySelector('[data-action="custom-stage-hp-settings-open"]')) {
    controls.insertAdjacentHTML('beforeend', `<button type="button" data-action="custom-stage-hp-settings-open"></button>`);
  }
  const trigger = controls.querySelector('[data-action="custom-stage-hp-settings-open"]');
  if (trigger) {
    const count = activeSettingCount(state);
    trigger.classList.toggle('is-active', count > 0);
    trigger.innerHTML = `<i class="bi bi-gear-wide-connected" aria-hidden="true"></i> 詳細設定${count ? `<span class="hpset-badge">${count}</span>` : ''}`;
  }
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
    if (type === 'custom-stage-hp-settings-open' && this.root?.contains(action)) {
      e.preventDefault();
      e.stopPropagation();
      renderHpSettingsOverlay(this);
      return;
    }
    if (type === 'custom-stage-hp-settings-close' && this.root?.contains(action)) {
      e.preventDefault();
      e.stopPropagation();
      closeHpSettingsOverlay(this);
      return;
    }
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
      if (!this.refreshCustomStageBattleView?.({ sides: [] })) this.renderStageSelector();
      injectHpControls(this);
      refreshHpSettingsOverlay(this);
      return;
    }
    const result = await originalOnClick.call(this, e);
    ensureHpState(this);
    persistExtendedState(this);
    injectHpControls(this);
    // Base-source (背景/長さの基準) lives in the overlay too; keep it in sync after its handler runs.
    refreshHpSettingsOverlay(this);
    return result;
  };
}

installFormationCustomStageBattleHpPatch();
