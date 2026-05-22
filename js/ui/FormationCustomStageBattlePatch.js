import { FormationEditor } from './FormationEditor.js';

const PATCH_FLAG = Symbol.for('wanko-formation-custom-stage-battle-patch.v3-persist-category-ui');
const GLOBAL_CONFIG_KEY = '__CUSTOM_STAGE_BATTLE_CONFIG__';
const STORAGE_KEY = 'wanko.customStageBattle.v1';
const CUSTOM_LEVEL = 'custom-stage-battle';

function uniqueList(values) {
  return [...new Set((values || []).filter(Boolean).map(String))];
}

function safeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch]));
}

function stateFromStorage() {
  try {
    const raw = globalThis.localStorage?.getItem?.(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.mode !== 'stage-vs-stage-multi') return null;
    return {
      enabled: !!parsed.enabled,
      enemyStageIds: uniqueList(parsed.enemyStageIds),
      playerStageIds: uniqueList(parsed.playerStageIds),
      baseSource: parsed.baseSource === 'player' ? 'player' : 'enemy',
      pickingSide: null
    };
  } catch {
    return null;
  }
}

function configFromState(state) {
  const enemyStageIds = uniqueList(state?.enemyStageIds);
  const playerStageIds = uniqueList(state?.playerStageIds);
  const valid = enemyStageIds.length > 0 && playerStageIds.length > 0;
  const baseSource = state?.baseSource === 'player' ? 'player' : 'enemy';
  const baseStageId = baseSource === 'player'
    ? (playerStageIds[0] || enemyStageIds[0] || null)
    : (enemyStageIds[0] || playerStageIds[0] || null);
  return {
    enabled: !!state?.enabled && valid,
    requestedEnabled: !!state?.enabled,
    mode: 'stage-vs-stage-multi',
    enemyStageIds,
    playerStageIds,
    baseSource,
    baseStageId,
    valid,
    invalidReason: valid ? null : 'both-enemy-and-player-stage-lists-required',
    source: 'FormationCustomStageBattlePatch'
  };
}

function persistState(editor) {
  const state = editor?.customStageBattle;
  if (!state) return;
  const payload = {
    mode: 'stage-vs-stage-multi',
    enabled: !!state.enabled,
    enemyStageIds: uniqueList(state.enemyStageIds),
    playerStageIds: uniqueList(state.playerStageIds),
    baseSource: state.baseSource === 'player' ? 'player' : 'enemy',
    updatedAt: Date.now()
  };
  try { globalThis.localStorage?.setItem?.(STORAGE_KEY, JSON.stringify(payload)); } catch {}
  globalThis[GLOBAL_CONFIG_KEY] = configFromState(payload);
}

function ensureState(editor) {
  if (!editor.customStageBattle) {
    const stored = stateFromStorage();
    editor.customStageBattle = stored || {
      enabled: false,
      enemyStageIds: editor.selectedStageId ? [editor.selectedStageId] : [],
      playerStageIds: [],
      baseSource: 'enemy',
      pickingSide: null
    };
  }
  editor.customStageBattle.enemyStageIds = uniqueList(editor.customStageBattle.enemyStageIds);
  editor.customStageBattle.playerStageIds = uniqueList(editor.customStageBattle.playerStageIds);
  editor.customStageBattle.baseSource = editor.customStageBattle.baseSource === 'player' ? 'player' : 'enemy';
  editor.customStageBattle.pickingSide = editor.customStageBattle.pickingSide === 'enemy' || editor.customStageBattle.pickingSide === 'player'
    ? editor.customStageBattle.pickingSide
    : null;
  globalThis[GLOBAL_CONFIG_KEY] = configFromState(editor.customStageBattle);
  return editor.customStageBattle;
}

function stageName(editor, stageId) {
  const stage = (editor.stageOptions || []).find((s) => (s.stageKey || s.stageId) === stageId || s.stageId === stageId);
  if (!stage) return stageId;
  const meta = editor.stageMeta?.get?.(stage.stageKey || stage.stageId) || {};
  try { return editor.resolveStageDisplay(stage, meta)?.displayName || stage.stageId || stageId; }
  catch { return stage.stageId || stageId; }
}

function currentBaseStageId(state) {
  return state.baseSource === 'player'
    ? (state.playerStageIds[0] || state.enemyStageIds[0] || null)
    : (state.enemyStageIds[0] || state.playerStageIds[0] || null);
}

function normalizedConfig(editor) {
  return configFromState(ensureState(editor));
}

function addCustomCategoryCard(editor) {
  const state = editor.stageSelectorState || {};
  if (state.level !== 'category') return;
  const list = editor.root?.querySelector?.('.formation-stage-list');
  if (!list || list.querySelector('[data-custom-stage-category]')) return;
  const custom = ensureState(editor);
  const config = normalizedConfig(editor);
  list.insertAdjacentHTML('beforeend', `<button type='button' class='formation-stage-card formation-stage-card-category formation-stage-card-custom ${custom.enabled ? 'is-active' : ''}' data-custom-stage-category='1'>
    <strong>カスタムステージ</strong>
    <small>${custom.enemyStageIds.length}敵側 / ${custom.playerStageIds.length}味方側</small>
    <span>${config.enabled ? 'ON' : 'OFF'} / 複数ステージ同士を戦わせる専用モード</span>
  </button>`);
}

function renderList(editor, side, ids) {
  if (!ids.length) return `<p class='formation-custom-stage-empty'>未登録</p>`;
  return `<ol class='formation-custom-stage-list'>${ids.map((id, index) => `<li><span><strong>${safeHtml(stageName(editor, id))}</strong><small>${safeHtml(id)}</small></span><button type='button' data-custom-stage-remove-side='${side}' data-custom-stage-remove-index='${index}'>Remove</button></li>`).join('')}</ol>`;
}

function renderCustomStageBattleView(editor) {
  const state = ensureState(editor);
  const config = normalizedConfig(editor);
  const baseStageId = currentBaseStageId(state);
  const list = editor.root?.querySelector?.('.formation-stage-list');
  if (!list) return;
  const title = editor.root.querySelector('.formation-stage-dialog header strong');
  const lead = editor.root.querySelector('.formation-stage-dialog header span');
  if (title) title.textContent = 'カスタムステージ';
  if (lead) lead.textContent = 'ステージ同士バトルの敵側・味方側登録';
  list.innerHTML = `<div class='formation-stage-breadcrumb'>
      <button type='button' class='formation-stage-crumb' data-stage-root='1'>カテゴリ</button>
      <button type='button' class='formation-stage-crumb is-active' data-custom-stage-category='1'>カスタムステージ</button>
    </div>
    <section class='formation-custom-stage-battle is-category-view ${state.enabled ? 'is-enabled' : ''}'>
      <header class='formation-custom-stage-header'>
        <div><strong>ステージ同士バトル</strong><span>敵側・味方側に複数ステージを登録して同時スポーン</span></div>
        <button type='button' data-action='custom-stage-toggle'>${state.enabled ? 'Custom ON' : 'Custom OFF'}</button>
      </header>
      <div class='formation-custom-stage-controls'>
        <button type='button' class='${state.baseSource !== 'player' ? 'is-active' : ''}' data-action='custom-stage-base-enemy'>背景/長さ: 敵1番目</button>
        <button type='button' class='${state.baseSource === 'player' ? 'is-active' : ''}' data-action='custom-stage-base-player'>背景/長さ: 味方1番目</button>
        <button type='button' data-action='custom-stage-clear'>登録クリア</button>
      </div>
      <div class='formation-custom-stage-columns'>
        <section>
          <h4>敵側ステージ</h4>
          ${renderList(editor, 'enemy', state.enemyStageIds)}
          <button type='button' data-custom-stage-pick-side='enemy'>敵側にステージを追加</button>
        </section>
        <section>
          <h4>味方側ステージ</h4>
          ${renderList(editor, 'player', state.playerStageIds)}
          <button type='button' data-custom-stage-pick-side='player'>味方側にステージを追加</button>
        </section>
      </div>
      <p class='formation-custom-stage-note'>${state.enabled
        ? (config.valid ? `有効: 背景・ステージ長・城は ${safeHtml(stageName(editor, baseStageId))} を使用` : 'ONですが、敵側と味方側の両方に1つ以上ステージ登録が必要です')
        : 'OFF時は通常の単一ステージ戦闘です。'}</p>
    </section>`;
}

function addStage(editor, side, id) {
  const state = ensureState(editor);
  const key = side === 'player' ? 'playerStageIds' : 'enemyStageIds';
  if (id && !state[key].includes(id)) state[key].push(id);
  state[key] = uniqueList(state[key]);
  state.pickingSide = null;
  persistState(editor);
  editor.stageSelectorState = { level: CUSTOM_LEVEL, categoryId: null, mapKey: null };
  editor.renderStageSelector();
}

function removeStage(editor, side, index) {
  const state = ensureState(editor);
  const key = side === 'player' ? 'playerStageIds' : 'enemyStageIds';
  state[key].splice(Number(index), 1);
  state[key] = uniqueList(state[key]);
  persistState(editor);
  editor.stageSelectorState = { level: CUSTOM_LEVEL, categoryId: null, mapKey: null };
  editor.renderStageSelector();
}

function updateCustomUiAfterRender(editor) {
  const state = ensureState(editor);
  if (editor.stageSelectorState?.level === CUSTOM_LEVEL) {
    renderCustomStageBattleView(editor);
    return;
  }
  addCustomCategoryCard(editor);
  const lead = editor.root?.querySelector?.('.formation-stage-dialog header span');
  if (lead && state.pickingSide && editor.stageSelectorState?.level !== CUSTOM_LEVEL) {
    lead.textContent = `${state.pickingSide === 'enemy' ? '敵側' : '味方側'}に追加するステージを選択中`;
  }
}

function patchFormationEditor() {
  const proto = FormationEditor?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  proto.getCustomStageBattleConfig = function getCustomStageBattleConfig() {
    return normalizedConfig(this);
  };

  const originalRenderStageSelector = proto.renderStageSelector;
  proto.renderStageSelector = function renderStageSelectorWithCustomStageCategory(...args) {
    const result = originalRenderStageSelector.apply(this, args);
    updateCustomUiAfterRender(this);
    return result;
  };

  const originalOnClick = proto.onClick;
  proto.onClick = async function onClickWithCustomStageCategory(e) {
    const customCategory = e.target.closest?.('[data-custom-stage-category]');
    if (customCategory && this.root?.contains(customCategory)) {
      e.preventDefault();
      e.stopPropagation();
      ensureState(this).pickingSide = null;
      persistState(this);
      this.stageSelectorState = { level: CUSTOM_LEVEL, categoryId: null, mapKey: null };
      this.renderStageSelector();
      return;
    }

    const pick = e.target.closest?.('[data-custom-stage-pick-side]');
    if (pick && this.root?.contains(pick)) {
      e.preventDefault();
      e.stopPropagation();
      ensureState(this).pickingSide = pick.dataset.customStagePickSide === 'player' ? 'player' : 'enemy';
      this.stageSelectorState = { level: 'category', categoryId: null, mapKey: null };
      this.renderStageSelector();
      return;
    }

    const remove = e.target.closest?.('[data-custom-stage-remove-side]');
    if (remove && this.root?.contains(remove)) {
      e.preventDefault();
      e.stopPropagation();
      removeStage(this, remove.dataset.customStageRemoveSide, remove.dataset.customStageRemoveIndex);
      return;
    }

    const stageCard = e.target.closest?.('[data-stage-id]');
    const state = ensureState(this);
    if (stageCard && this.root?.contains(stageCard) && state.pickingSide) {
      e.preventDefault();
      e.stopPropagation();
      addStage(this, state.pickingSide, stageCard.dataset.stageId);
      return;
    }

    const action = e.target.closest?.('[data-action]');
    const type = action?.dataset?.action;
    if (type === 'custom-stage-toggle') {
      e.preventDefault();
      e.stopPropagation();
      state.enabled = !state.enabled;
      if (state.enabled && !state.enemyStageIds.length && this.selectedStageId) state.enemyStageIds = [this.selectedStageId];
      persistState(this);
      this.stageSelectorState = { level: CUSTOM_LEVEL, categoryId: null, mapKey: null };
      this.renderStageSelector();
      return;
    }
    if (type === 'custom-stage-base-enemy' || type === 'custom-stage-base-player') {
      e.preventDefault();
      e.stopPropagation();
      state.baseSource = type === 'custom-stage-base-player' ? 'player' : 'enemy';
      persistState(this);
      this.stageSelectorState = { level: CUSTOM_LEVEL, categoryId: null, mapKey: null };
      this.renderStageSelector();
      return;
    }
    if (type === 'custom-stage-clear') {
      e.preventDefault();
      e.stopPropagation();
      this.customStageBattle = { enabled: false, enemyStageIds: this.selectedStageId ? [this.selectedStageId] : [], playerStageIds: [], baseSource: 'enemy', pickingSide: null };
      persistState(this);
      this.stageSelectorState = { level: CUSTOM_LEVEL, categoryId: null, mapKey: null };
      this.renderStageSelector();
      return;
    }

    if (type === 'apply' && !this.applying) {
      const config = normalizedConfig(this);
      if (config.requestedEnabled && !config.valid) {
        e.preventDefault();
        e.stopPropagation();
        this.setHint('Custom stage battle requires at least one enemy-side stage and one player-side stage.');
        this.stageSelectorState = { level: CUSTOM_LEVEL, categoryId: null, mapKey: null };
        this.renderStageSelector();
        return;
      }
      if (config.enabled && config.baseStageId) {
        this.selectedStageId = config.baseStageId;
        this.onStageChanged(this.selectedStageId);
      }
      persistState(this);
      globalThis[GLOBAL_CONFIG_KEY] = config;
      e.preventDefault();
      e.stopPropagation();
      const btn = this.root.querySelector('.apply-battle-button');
      this.applying = true;
      if (btn) { btn.disabled = true; btn.textContent = 'Applying...'; }
      try { await this.onApplyBattle(this.formation, config); }
      catch (err) {
        console.error('[FormationEditor] apply failed detail', { name: err?.name, message: err?.message, stack: err?.stack, cause: err?.cause, error: err });
        this.setHint(`Apply failed: ${err?.message || String(err)}`);
      }
      finally { this.applying = false; if (btn) { btn.disabled = false; btn.textContent = 'Apply Battle'; } }
      return;
    }

    return originalOnClick.call(this, e);
  };
}

patchFormationEditor();

export { patchFormationEditor };
