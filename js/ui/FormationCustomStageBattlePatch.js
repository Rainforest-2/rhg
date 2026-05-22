import { FormationEditor } from './FormationEditor.js';

const PATCH_FLAG = Symbol.for('wanko-formation-custom-stage-battle-patch.v1');
const GLOBAL_CONFIG_KEY = '__CUSTOM_STAGE_BATTLE_CONFIG__';

function uniqueList(values) {
  return [...new Set((values || []).filter(Boolean).map(String))];
}

function escapeAttr(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/'/g, '&#39;').replace(/\"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function ensureState(editor) {
  if (!editor.customStageBattle) {
    editor.customStageBattle = {
      enabled: false,
      enemyStageIds: editor.selectedStageId ? [editor.selectedStageId] : [],
      playerStageIds: [],
      baseSource: 'enemy'
    };
  }
  editor.customStageBattle.enemyStageIds = uniqueList(editor.customStageBattle.enemyStageIds);
  editor.customStageBattle.playerStageIds = uniqueList(editor.customStageBattle.playerStageIds);
  editor.customStageBattle.baseSource = editor.customStageBattle.baseSource === 'player' ? 'player' : 'enemy';
  return editor.customStageBattle;
}

function stageName(editor, stageId) {
  const stage = (editor.stageOptions || []).find((s) => (s.stageKey || s.stageId) === stageId || s.stageId === stageId);
  if (!stage) return stageId;
  const meta = editor.stageMeta?.get?.(stage.stageKey || stage.stageId) || {};
  try { return editor.resolveStageDisplay(stage, meta)?.displayName || stage.stageId || stageId; }
  catch { return stage.stageId || stageId; }
}

function listMarkup(editor, side, ids) {
  if (!ids.length) return `<p class='formation-custom-stage-empty'>未登録</p>`;
  return `<ol class='formation-custom-stage-list'>${ids.map((id, index) => `<li><span><strong>${escapeAttr(stageName(editor, id))}</strong><small>${escapeAttr(id)}</small></span><button type='button' data-custom-stage-remove-side='${side}' data-custom-stage-remove-index='${index}'>Remove</button></li>`).join('')}</ol>`;
}

function currentBaseStageId(state) {
  return state.baseSource === 'player'
    ? (state.playerStageIds[0] || state.enemyStageIds[0] || null)
    : (state.enemyStageIds[0] || state.playerStageIds[0] || null);
}

function normalizedConfig(editor) {
  const state = ensureState(editor);
  const enemyStageIds = uniqueList(state.enemyStageIds);
  const playerStageIds = uniqueList(state.playerStageIds);
  const valid = enemyStageIds.length > 0 && playerStageIds.length > 0;
  const baseSource = state.baseSource === 'player' ? 'player' : 'enemy';
  const baseStageId = baseSource === 'player'
    ? (playerStageIds[0] || enemyStageIds[0] || null)
    : (enemyStageIds[0] || playerStageIds[0] || null);
  return {
    enabled: !!state.enabled && valid,
    requestedEnabled: !!state.enabled,
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

function insertPanel(editor) {
  const dialog = editor.root?.querySelector?.('.formation-stage-dialog');
  if (!dialog || dialog.querySelector('.formation-custom-stage-battle')) return;
  const panel = document.createElement('section');
  panel.className = 'formation-custom-stage-battle';
  panel.innerHTML = `
    <header class='formation-custom-stage-header'>
      <div><strong>カスタム: ステージ同士バトル</strong><span>敵側・味方側に複数ステージを登録して同時スポーン</span></div>
      <button type='button' data-action='custom-stage-toggle'></button>
    </header>
    <div class='formation-custom-stage-controls'>
      <button type='button' data-action='custom-stage-base-enemy'>背景/長さ: 敵1番目</button>
      <button type='button' data-action='custom-stage-base-player'>背景/長さ: 味方1番目</button>
      <button type='button' data-action='custom-stage-clear'>登録クリア</button>
    </div>
    <div class='formation-custom-stage-columns'>
      <section><h4>敵側ステージ</h4><div data-custom-stage-list='enemy'></div></section>
      <section><h4>味方側ステージ</h4><div data-custom-stage-list='player'></div></section>
    </div>
    <p class='formation-custom-stage-note'></p>`;
  const header = dialog.querySelector('header');
  header?.insertAdjacentElement('afterend', panel);
}

function addStageButtons(editor) {
  for (const card of editor.root?.querySelectorAll?.('.formation-stage-card[data-stage-id]') || []) {
    if (card.querySelector('.formation-stage-custom-actions')) continue;
    const id = card.dataset.stageId;
    const box = document.createElement('div');
    box.className = 'formation-stage-custom-actions';
    box.innerHTML = `<button type='button' data-custom-stage-add-side='enemy' data-custom-stage-id='${escapeAttr(id)}'>敵に追加</button><button type='button' data-custom-stage-add-side='player' data-custom-stage-id='${escapeAttr(id)}'>味方に追加</button>`;
    card.appendChild(box);
  }
}

function updatePanel(editor) {
  insertPanel(editor);
  addStageButtons(editor);
  const state = ensureState(editor);
  const config = normalizedConfig(editor);
  const panel = editor.root?.querySelector?.('.formation-custom-stage-battle');
  if (!panel) return;
  panel.classList.toggle('is-enabled', !!state.enabled);
  const toggle = panel.querySelector('[data-action="custom-stage-toggle"]');
  if (toggle) toggle.textContent = state.enabled ? 'Custom ON' : 'Custom OFF';
  const enemyBase = panel.querySelector('[data-action="custom-stage-base-enemy"]');
  const playerBase = panel.querySelector('[data-action="custom-stage-base-player"]');
  enemyBase?.classList.toggle('is-active', state.baseSource !== 'player');
  playerBase?.classList.toggle('is-active', state.baseSource === 'player');
  const enemyList = panel.querySelector('[data-custom-stage-list="enemy"]');
  const playerList = panel.querySelector('[data-custom-stage-list="player"]');
  if (enemyList) enemyList.innerHTML = listMarkup(editor, 'enemy', state.enemyStageIds);
  if (playerList) playerList.innerHTML = listMarkup(editor, 'player', state.playerStageIds);
  const note = panel.querySelector('.formation-custom-stage-note');
  if (note) {
    const baseStageId = currentBaseStageId(state);
    note.textContent = state.enabled
      ? (config.valid ? `有効: 背景・ステージ長・城は ${stageName(editor, baseStageId)} を使用` : 'ONですが、敵側と味方側の両方に1つ以上ステージ登録が必要です')
      : 'OFF時は通常の単一ステージ戦闘です。';
  }
}

function addStage(editor, side, id) {
  const state = ensureState(editor);
  const key = side === 'player' ? 'playerStageIds' : 'enemyStageIds';
  if (!state[key].includes(id)) state[key].push(id);
  state[key] = uniqueList(state[key]);
  if (!state.enemyStageIds.length && editor.selectedStageId) state.enemyStageIds.push(editor.selectedStageId);
  updatePanel(editor);
}

function removeStage(editor, side, index) {
  const state = ensureState(editor);
  const key = side === 'player' ? 'playerStageIds' : 'enemyStageIds';
  state[key].splice(Number(index), 1);
  state[key] = uniqueList(state[key]);
  updatePanel(editor);
}

function patchFormationEditor() {
  const proto = FormationEditor?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  proto.getCustomStageBattleConfig = function getCustomStageBattleConfig() {
    return normalizedConfig(this);
  };

  const originalRenderStageSelector = proto.renderStageSelector;
  proto.renderStageSelector = function renderStageSelectorWithCustomStageBattle(...args) {
    const result = originalRenderStageSelector.apply(this, args);
    updatePanel(this);
    return result;
  };

  const originalRefresh = proto.refresh;
  proto.refresh = function refreshWithCustomStageBattle(...args) {
    const result = originalRefresh.apply(this, args);
    updatePanel(this);
    return result;
  };

  const originalSelectStage = proto.selectStage;
  proto.selectStage = function selectStageWithCustomStageBattle(stageId) {
    const result = originalSelectStage.call(this, stageId);
    const state = ensureState(this);
    if (state.enabled && !state.enemyStageIds.length && stageId) state.enemyStageIds = [stageId];
    updatePanel(this);
    return result;
  };

  const originalOnClick = proto.onClick;
  proto.onClick = async function onClickWithCustomStageBattle(e) {
    const add = e.target.closest?.('[data-custom-stage-add-side]');
    if (add) {
      e.preventDefault();
      e.stopPropagation();
      const id = add.dataset.customStageId || add.closest('[data-stage-id]')?.dataset.stageId;
      addStage(this, add.dataset.customStageAddSide, id);
      return;
    }

    const remove = e.target.closest?.('[data-custom-stage-remove-side]');
    if (remove) {
      e.preventDefault();
      e.stopPropagation();
      removeStage(this, remove.dataset.customStageRemoveSide, remove.dataset.customStageRemoveIndex);
      return;
    }

    const action = e.target.closest?.('[data-action]');
    const type = action?.dataset?.action;
    if (type === 'custom-stage-toggle') {
      e.preventDefault();
      e.stopPropagation();
      const state = ensureState(this);
      state.enabled = !state.enabled;
      if (state.enabled && !state.enemyStageIds.length && this.selectedStageId) state.enemyStageIds = [this.selectedStageId];
      updatePanel(this);
      return;
    }
    if (type === 'custom-stage-base-enemy' || type === 'custom-stage-base-player') {
      e.preventDefault();
      e.stopPropagation();
      ensureState(this).baseSource = type === 'custom-stage-base-player' ? 'player' : 'enemy';
      updatePanel(this);
      return;
    }
    if (type === 'custom-stage-clear') {
      e.preventDefault();
      e.stopPropagation();
      this.customStageBattle = { enabled: false, enemyStageIds: this.selectedStageId ? [this.selectedStageId] : [], playerStageIds: [], baseSource: 'enemy' };
      updatePanel(this);
      return;
    }

    if (type === 'apply' && !this.applying) {
      const config = normalizedConfig(this);
      if (config.requestedEnabled && !config.valid) {
        e.preventDefault();
        e.stopPropagation();
        this.setHint('Custom stage battle requires at least one enemy-side stage and one player-side stage.');
        updatePanel(this);
        return;
      }
      if (config.enabled && config.baseStageId) {
        this.selectedStageId = config.baseStageId;
        this.onStageChanged(this.selectedStageId);
      }
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
