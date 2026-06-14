import { FormationEditor } from './FormationEditor.js';
import { popIn, press, pulseAdded } from './UiMotion.mjs';

const PATCH_FLAG = Symbol.for('wanko-formation-custom-stage-battle-patch.v4-hide-internal-ids');
const GLOBAL_CONFIG_KEY = '__CUSTOM_STAGE_BATTLE_CONFIG__';
const STORAGE_KEY = 'wanko.customStageBattle.v1';
const CUSTOM_LEVEL = 'custom-stage-battle';
const STYLE_ID = 'formation-custom-stage-multi-add-style';

function uniqueList(values) {
  return [...new Set((values || []).filter(Boolean).map(String))];
}

function safeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch]));
}

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
html body.nyanko-ui-polish .formation-custom-stage-pickbar{grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 10px;border:3px solid #000;border-radius:8px;background:#fff2a6;box-shadow:0 3px 0 #000}
html body.nyanko-ui-polish .formation-custom-stage-pickbar strong{font-weight:1000;color:#120700}
html body.nyanko-ui-polish .formation-custom-stage-pickbar span{font-size:.82rem;font-weight:900;color:#5b320c}
html body.nyanko-ui-polish .formation-custom-stage-pickbar button{min-height:36px;padding:0 16px;border:3px solid #000;border-radius:999px;background:linear-gradient(180deg,#ff6a19,#f15212 52%,#e14008);color:#fff;-webkit-text-fill-color:#fff;font-weight:1000;box-shadow:0 3px 0 #000}
html body.nyanko-ui-polish .formation-stage-card.is-custom-stage-added{position:relative;outline:4px solid #ffdf36;outline-offset:-6px;filter:saturate(1.05) brightness(1.03)}
html body.nyanko-ui-polish .formation-stage-card.is-custom-stage-added::after{content:'追加済み';position:absolute;right:8px;bottom:7px;z-index:4;padding:3px 8px;border:2px solid #000;border-radius:999px;background:#ffdf36;color:#120700;font-size:.72rem;font-weight:1000;box-shadow:0 2px 0 #000;pointer-events:none}
html body.nyanko-ui-polish .formation-stage-card.is-custom-stage-just-added{filter:brightness(1.12) saturate(1.12)}
html body.nyanko-ui-polish .formation-stage-card.is-custom-stage-duplicate{filter:brightness(1.08) saturate(.9)}
html body.nyanko-ui-polish .formation-custom-stage-columns>section{min-height:0}
html body.nyanko-ui-polish .formation-custom-stage-list{max-height:min(42dvh,360px);overflow:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding-right:3px!important}
@media (max-width:680px){html body.nyanko-ui-polish .formation-custom-stage-pickbar{align-items:stretch;flex-direction:column}.formation-custom-stage-pickbar button{width:100%}}`;
  document.head.appendChild(style);
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
  // The custom-stage HP options (城HP固定 / 毎FPS両城HP減少) are written by sibling
  // patches under the SAME STORAGE_KEY. Preserve any previously stored fields so a
  // stage pick/toggle here does not silently erase those HP options on reload.
  let previous = {};
  try {
    const raw = globalThis.localStorage?.getItem?.(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && parsed.mode === 'stage-vs-stage-multi') previous = parsed;
  } catch {}
  const payload = {
    ...previous,
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
  try { return editor.resolveStageDisplay(stage, meta)?.displayName || stage?.name?.value || stage?.label || stage.stageId || stageId; }
  catch { return stage?.name?.value || stage?.label || stage.stageId || stageId; }
}

function currentBaseStageId(state) {
  return state.baseSource === 'player'
    ? (state.playerStageIds[0] || state.enemyStageIds[0] || null)
    : (state.enemyStageIds[0] || state.playerStageIds[0] || null);
}

function normalizedConfig(editor) {
  return configFromState(ensureState(editor));
}

function updateCurrentStageLabel(editor, stageId) {
  const current = editor.root?.querySelector?.('.formation-current-stage');
  if (!current || !stageId) return;
  current.textContent = stageName(editor, stageId);
}

function addCustomCategoryCard(editor) {
  ensureStyle();
  const state = editor.stageSelectorState || {};
  if (state.level !== 'category') return;
  const list = editor.root?.querySelector?.('.formation-stage-list');
  if (!list || list.querySelector('[data-custom-stage-category]')) return;
  const custom = ensureState(editor);
  const config = normalizedConfig(editor);
  list.insertAdjacentHTML('beforeend', `<button type='button' class='formation-stage-card formation-stage-card-category formation-stage-card-custom ${custom.enabled ? 'is-active' : ''}' data-custom-stage-category='1'>
    <strong>カスタムステージ</strong>
    <span class='formation-stage-card-meta'><b>${config.enabled ? 'ON' : 'OFF'}</b></span>
  </button>`);
}

function renderList(editor, side, ids) {
  if (!ids.length) return `<p class='formation-custom-stage-empty'>未登録</p>`;
  return `<ol class='formation-custom-stage-list'>${ids.map((id, index) => `<li><span><strong>${safeHtml(stageName(editor, id))}</strong></span><button type='button' data-custom-stage-remove-side='${side}' data-custom-stage-remove-index='${index}'>はずす</button></li>`).join('')}</ol>`;
}

function renderCustomStageBattleView(editor) {
  ensureStyle();
  const state = ensureState(editor);
  const config = normalizedConfig(editor);
  const baseStageId = currentBaseStageId(state);
  const list = editor.root?.querySelector?.('.formation-stage-list');
  if (!list) return;
  updateCurrentStageLabel(editor, baseStageId || editor.selectedStageId);
  const title = editor.root.querySelector('.formation-stage-dialog header strong');
  const lead = editor.root.querySelector('.formation-stage-dialog header span');
  if (title) title.textContent = 'カスタムステージ';
  if (lead) {
    lead.textContent = '';
    lead.hidden = true;
  }
  list.innerHTML = `<section class='formation-custom-stage-battle is-category-view ${state.enabled ? 'is-enabled' : ''}'>
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
  const added = !!id && !state[key].includes(id);
  if (added) state[key].push(id);
  state[key] = uniqueList(state[key]);
  persistState(editor);
  editor.__customStageLastPick = { id, side, added, timestamp: Date.now() };
  editor.renderStageSelector();
  requestAnimationFrame(() => {
    const card = [...(editor.root?.querySelectorAll?.('[data-stage-id]') || [])].find((item) => item.dataset.stageId === id);
    if (!card) return;
    card.classList.add(added ? 'is-custom-stage-just-added' : 'is-custom-stage-duplicate');
    pulseAdded(card, !added);
    setTimeout(() => card.classList.remove('is-custom-stage-just-added', 'is-custom-stage-duplicate'), 220);
  });
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
  ensureStyle();
  const state = ensureState(editor);
  if (editor.stageSelectorState?.level === CUSTOM_LEVEL) {
    renderCustomStageBattleView(editor);
    popIn(editor.root?.querySelector?.('.formation-custom-stage-battle'), { duration: 135 });
    return;
  }
  updateCurrentStageLabel(editor, currentBaseStageId(state) || editor.selectedStageId);
  addCustomCategoryCard(editor);
  decoratePickingMode(editor, state);
  const lead = editor.root?.querySelector?.('.formation-stage-dialog header span');
  if (lead && state.pickingSide && editor.stageSelectorState?.level !== CUSTOM_LEVEL) {
    lead.textContent = '';
    lead.hidden = true;
  }
}

function decoratePickingMode(editor, state = ensureState(editor)) {
  if (!state.pickingSide || editor.stageSelectorState?.level === CUSTOM_LEVEL) return;
  const list = editor.root?.querySelector?.('.formation-stage-list');
  if (!list) return;
  const label = state.pickingSide === 'player' ? '味方側' : '敵側';
  if (!list.querySelector('[data-custom-stage-pick-done]')) {
    list.insertAdjacentHTML('afterbegin', `<div class='formation-custom-stage-pickbar'>
      <div><strong>${safeHtml(label)}にステージを追加</strong><span>ステージをタップすると追加します。続けて複数追加できます。</span></div>
      <button type='button' data-custom-stage-pick-done='1'>完了</button>
    </div>`);
    popIn(list.querySelector('.formation-custom-stage-pickbar'), { duration: 130 });
  }
  const selected = new Set(state.pickingSide === 'player' ? state.playerStageIds : state.enemyStageIds);
  for (const card of list.querySelectorAll('.formation-stage-card-stage[data-stage-id]')) {
    card.classList.toggle('is-custom-stage-added', selected.has(card.dataset.stageId));
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
      press(customCategory);
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
      press(pick);
      ensureState(this).pickingSide = pick.dataset.customStagePickSide === 'player' ? 'player' : 'enemy';
      this.stageSelectorState = { level: 'category', categoryId: null, mapKey: null };
      this.renderStageSelector();
      return;
    }

    const done = e.target.closest?.('[data-custom-stage-pick-done]');
    if (done && this.root?.contains(done)) {
      e.preventDefault();
      e.stopPropagation();
      press(done);
      ensureState(this).pickingSide = null;
      persistState(this);
      this.stageSelectorState = { level: CUSTOM_LEVEL, categoryId: null, mapKey: null };
      this.renderStageSelector();
      return;
    }

    const remove = e.target.closest?.('[data-custom-stage-remove-side]');
    if (remove && this.root?.contains(remove)) {
      e.preventDefault();
      e.stopPropagation();
      press(remove);
      removeStage(this, remove.dataset.customStageRemoveSide, remove.dataset.customStageRemoveIndex);
      return;
    }

    const toggle = e.target.closest?.('[data-action="custom-stage-toggle"]');
    if (toggle && this.root?.contains(toggle)) {
      e.preventDefault();
      e.stopPropagation();
      press(toggle);
      const state = ensureState(this);
      state.enabled = !state.enabled;
      persistState(this);
      this.renderStageSelector();
      return;
    }

    const baseEnemy = e.target.closest?.('[data-action="custom-stage-base-enemy"]');
    if (baseEnemy && this.root?.contains(baseEnemy)) {
      e.preventDefault();
      e.stopPropagation();
      press(baseEnemy);
      ensureState(this).baseSource = 'enemy';
      persistState(this);
      this.renderStageSelector();
      return;
    }

    const basePlayer = e.target.closest?.('[data-action="custom-stage-base-player"]');
    if (basePlayer && this.root?.contains(basePlayer)) {
      e.preventDefault();
      e.stopPropagation();
      press(basePlayer);
      ensureState(this).baseSource = 'player';
      persistState(this);
      this.renderStageSelector();
      return;
    }

    const clear = e.target.closest?.('[data-action="custom-stage-clear"]');
    if (clear && this.root?.contains(clear)) {
      e.preventDefault();
      e.stopPropagation();
      press(clear);
      const state = ensureState(this);
      state.enemyStageIds = [];
      state.playerStageIds = [];
      state.enabled = false;
      state.pickingSide = null;
      persistState(this);
      this.renderStageSelector();
      return;
    }

    const stageCard = e.target.closest?.('[data-stage-id]');
    const state = ensureState(this);
    if (stageCard && state.pickingSide && this.root?.contains(stageCard)) {
      e.preventDefault();
      e.stopPropagation();
      press(stageCard);
      addStage(this, state.pickingSide, stageCard.dataset.stageId);
      return;
    }

    return originalOnClick.call(this, e);
  };
}

patchFormationEditor();
