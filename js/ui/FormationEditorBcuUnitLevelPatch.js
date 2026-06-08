import { FormationEditor } from './FormationEditor.js';
import { FormationStore, DOG_DEFAULT_MAGNIFICATION_PERCENT } from '../battle/FormationStore.js';
import { getCharacterById } from '../battle/CharacterCatalog.js';
import { BCU_DEFAULT_PREF_LEVEL } from '../battle/bcu-runtime/BcuUnitLevelRuntime.js';

const PATCH_FLAG = Symbol.for('wanko-ui.formation-bcu-unit-level.v2-character-tuning-api');
const STYLE_ID = 'formation-bcu-unit-level-style';

function injectStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .formation-bcu-level-box{display:grid;gap:6px;padding:10px;border:1px solid rgba(250,204,21,.34);border-radius:14px;background:rgba(2,6,23,.48);box-shadow:inset 0 1px 0 rgba(255,255,255,.06)}
    .formation-bcu-level-box label{display:grid;gap:5px;color:#fde68a;font-weight:1000;font-size:.78rem;letter-spacing:.04em;text-shadow:0 1px 0 #000}
    .formation-bcu-level-box input{width:100%;height:38px;border-radius:11px;border:1px solid rgba(250,204,21,.52);background:#090d15;color:#fff;font-weight:1000;font-size:1.05rem;text-align:center;box-shadow:inset 0 1px 8px rgba(0,0,0,.45)}
    .formation-bcu-level-box small{color:#bfdbfe;font-size:.65rem;line-height:1.25}
  `;
  document.head.appendChild(style);
}

function currentPrefLevel(editor) {
  const formation = editor?.formation || FormationStore.load();
  const opt = formation?.options?.bcuCatUnitLevel || {};
  return Math.max(1, Math.trunc(Number(opt.prefLevel ?? BCU_DEFAULT_PREF_LEVEL) || BCU_DEFAULT_PREF_LEVEL));
}

function ensureLevelControl(editor) {
  if (!editor?.root) return;
  injectStyle();
  const rail = editor.root.querySelector('.formation-action-rail');
  if (!rail) return;
  let box = rail.querySelector('.formation-bcu-level-box');
  if (!box) {
    box = document.createElement('div');
    box.className = 'formation-bcu-level-box';
    box.innerHTML = `<label>にゃんこ Lv<input type="number" inputmode="numeric" min="1" max="999" step="1" data-cat-pref-level="1"></label><small>BCU CommonStatic.prefLevel。個別Lv未指定のにゃんこにだけ使います。</small>`;
    const stageButton = rail.querySelector('[data-action="stage-open"]');
    rail.insertBefore(box, stageButton || rail.firstChild);
  }
  const input = box.querySelector('[data-cat-pref-level]');
  const value = String(currentPrefLevel(editor));
  if (input && document.activeElement !== input && input.value !== value) input.value = value;
}

function syncFormation(editor, formation, hint = '') {
  editor.formation = formation;
  editor.onFormationChanged?.(formation);
  if (hint) editor.setHint?.(hint);
  ensureLevelControl(editor);
  return formation;
}

function handleLevelInput(editor, input) {
  const next = FormationStore.setCatUnitPrefLevel(input.value);
  syncFormation(editor, next, `にゃんこ既定Lv ${currentPrefLevel(editor)} を保存`);
}

function characterKind(characterId) {
  const character = getCharacterById(characterId);
  return character?.faction || null;
}

export function installFormationEditorBcuUnitLevelPatch() {
  const proto = FormationEditor?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  proto.getCharacterBattleTuning = function getCharacterBattleTuning(characterId) {
    const character = getCharacterById(characterId);
    const formation = FormationStore.load();
    return {
      characterId,
      character,
      faction: character?.faction || null,
      globalCatPrefLevel: formation.options?.bcuCatUnitLevel || null,
      catUnitLevel: FormationStore.getCatUnitLevel(characterId),
      dogUnitMagnification: FormationStore.getDogUnitMagnification(characterId),
      source: 'FormationEditorBcuUnitLevelPatch.getCharacterBattleTuning'
    };
  };

  proto.setCatCharacterLevel = function setCatCharacterLevel(characterId, config = {}) {
    if (characterKind(characterId) !== 'cat') return this.formation || FormationStore.load();
    const next = FormationStore.setCatUnitLevel(characterId, config);
    return syncFormation(this, next, `個別にゃんこLvを保存: ${characterId}`);
  };

  proto.clearCatCharacterLevel = function clearCatCharacterLevel(characterId) {
    const next = FormationStore.clearCatUnitLevel(characterId);
    return syncFormation(this, next, `個別にゃんこLvを解除: ${characterId}`);
  };

  proto.setDogCharacterMagnification = function setDogCharacterMagnification(characterId, percent = DOG_DEFAULT_MAGNIFICATION_PERCENT) {
    if (characterKind(characterId) !== 'dog') return this.formation || FormationStore.load();
    const next = FormationStore.setDogUnitMagnification(characterId, percent);
    return syncFormation(this, next, `ワンコ倍率を保存: ${characterId}`);
  };

  proto.clearDogCharacterMagnification = function clearDogCharacterMagnification(characterId) {
    const next = FormationStore.clearDogUnitMagnification(characterId);
    return syncFormation(this, next, `ワンコ倍率を100%に戻す: ${characterId}`);
  };

  const originalRefresh = proto.refresh;
  proto.refresh = function refreshWithBcuUnitLevel(...args) {
    const result = originalRefresh.apply(this, args);
    ensureLevelControl(this);
    return result;
  };

  const originalRenderDynamic = proto.renderDynamic;
  proto.renderDynamic = function renderDynamicWithBcuUnitLevel(...args) {
    const result = originalRenderDynamic.apply(this, args);
    ensureLevelControl(this);
    return result;
  };

  const originalOnInput = proto.onInput;
  proto.onInput = function onInputWithBcuUnitLevel(event) {
    const input = event.target.closest?.('[data-cat-pref-level]');
    if (input && this.root?.contains(input)) {
      handleLevelInput(this, input);
      return;
    }
    return originalOnInput.call(this, event);
  };
}

installFormationEditorBcuUnitLevelPatch();
