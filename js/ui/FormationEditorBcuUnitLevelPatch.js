import { FormationEditor } from './FormationEditor.js';
import { FormationStore, DOG_DEFAULT_MAGNIFICATION_PERCENT } from '../battle/FormationStore.js';
import { getCharacterById } from '../battle/CharacterCatalog.js';
import {
  BCU_DEFAULT_PREF_LEVEL,
  resolveBcuUnitLevelConfig
} from '../battle/bcu-runtime/BcuUnitLevelRuntime.js';

const PATCH_FLAG = Symbol.for('wanko-ui.formation-bcu-unit-level.v3-game-overlay');
const STYLE_ID = 'formation-character-tuning-overlay-style';

function esc(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch]));
}

function toInt(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function clampInt(value, min, max) {
  const lo = Math.trunc(Number(min) || 0);
  const hi = Math.max(lo, Math.trunc(Number(max) || lo));
  return Math.max(lo, Math.min(hi, toInt(value, lo)));
}

function getGlobalPrefLevel(formation = FormationStore.load()) {
  const opt = formation?.options?.bcuCatUnitLevel || {};
  return Math.max(1, toInt(opt.prefLevel ?? BCU_DEFAULT_PREF_LEVEL, BCU_DEFAULT_PREF_LEVEL));
}

function characterKind(characterId) {
  const character = getCharacterById(characterId);
  return character?.faction || null;
}

function getCatLevelMetadata(character) {
  if (character?.bcuUnitLevelMeta) return character.bcuUnitLevelMeta;
  const db = globalThis.__BCU_DB__ || null;
  try {
    const form = character?.form || (Number.isFinite(character?.formRow) ? character.formRow : 'f');
    const record = db?.units?.getForm?.(character?.statsId, form);
    return record?.levelMeta || record?.stats?.bcuUnitLevelMeta || record?.stats?.source?.unitLevelMeta || db?.units?.get?.(character?.statsId)?.levelMeta || null;
  } catch {
    return null;
  }
}

function resolveCatState(characterId, draft = null) {
  const character = getCharacterById(characterId);
  const formation = FormationStore.load();
  const saved = FormationStore.getCatUnitLevel(characterId);
  const metadata = getCatLevelMetadata(character) || {};
  const requested = draft?.characterId === characterId
    ? { level: draft.level, plusLevel: draft.plusLevel, prefLevel: draft.prefLevel || getGlobalPrefLevel(formation), source: 'tuning-overlay-draft' }
    : (saved || { prefLevel: getGlobalPrefLevel(formation), source: 'formation-global-pref-level' });
  const resolved = resolveBcuUnitLevelConfig({ requested, metadata, source: requested.source || 'formation-character-tuning-overlay' });
  return { character, formation, saved, metadata, resolved };
}

function resolveDogState(characterId, draft = null) {
  const character = getCharacterById(characterId);
  const saved = FormationStore.getDogUnitMagnification(characterId);
  const percent = draft?.characterId === characterId
    ? clampInt(draft.percent, 1, 999900)
    : clampInt(saved?.percent ?? DOG_DEFAULT_MAGNIFICATION_PERCENT, 1, 999900);
  return { character, saved, percent };
}

function formationSlots(editor) {
  return editor?.formation?.pages?.flat?.() || FormationStore.load()?.pages?.flat?.() || [];
}

function slotCharacterId(editor, slotIndex) {
  const slots = formationSlots(editor);
  return slots?.[slotIndex] || null;
}

function syncFormation(editor, formation, hint = '') {
  editor.formation = formation;
  editor.onFormationChanged?.(formation);
  if (hint) editor.setHint?.(hint);
  editor.renderDynamic?.();
  return formation;
}

function injectStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
@font-face{font-family:OedoKanteiryuLocal;src:url('./public/assets/FOT-%E5%A4%A7%E6%B1%9F%E6%88%B8%E5%8B%98%E4%BA%AD%E6%B5%81%20Std%20E.otf') format('opentype');font-weight:900;font-style:normal;font-display:block}
html body.nyanko-ui-polish .formation-slot{position:relative!important;overflow:visible!important}
html body.nyanko-ui-polish .formation-tuning-badge{position:absolute;right:5px;bottom:5px;z-index:6;min-width:46px;height:22px;padding:0 8px;display:inline-flex;align-items:center;justify-content:center;border:3px solid #000;border-radius:999px;background:#f15212;color:#fff;-webkit-text-fill-color:#fff;font-family:OedoKanteiryuLocal,"Hiragino Kaku Gothic ProN",system-ui,sans-serif;font-size:.72rem;font-weight:900;line-height:1;letter-spacing:.01em;box-shadow:0 2px 0 #000;text-shadow:2px 0 #000,-2px 0 #000,0 2px #000,0 -2px #000,1px 1px #000,-1px 1px #000,1px -1px #000,-1px -1px #000;pointer-events:none}
html body.nyanko-ui-polish .formation-tuning-overlay{position:fixed;inset:0;z-index:99980;display:none;place-items:center;padding:calc(10px + env(safe-area-inset-top,0px)) calc(12px + env(safe-area-inset-right,0px)) calc(10px + env(safe-area-inset-bottom,0px)) calc(12px + env(safe-area-inset-left,0px));background:rgba(0,0,0,.48);backdrop-filter:blur(2px);touch-action:none}
html body.nyanko-ui-polish .formation-tuning-overlay.is-open{display:grid;animation:formationTuningFade .12s ease-out both}
@keyframes formationTuningFade{from{opacity:0}to{opacity:1}}
html body.nyanko-ui-polish .formation-tuning-panel{width:min(920px,calc(100vw - 28px));max-height:calc(100dvh - 20px);display:grid;grid-template-columns:minmax(190px,245px) minmax(0,1fr);grid-template-rows:auto minmax(0,1fr) auto;overflow:hidden;border:6px solid #000;border-radius:22px;background:#fff4c2;box-shadow:0 10px 0 #160804,0 0 0 4px rgba(255,255,255,.12);transform-origin:center;animation:formationTuningPop .14s cubic-bezier(.2,1.18,.2,1) both}
@keyframes formationTuningPop{from{transform:scale(.94) translateY(8px)}to{transform:scale(1) translateY(0)}}
html body.nyanko-ui-polish .formation-tuning-header{grid-column:1/-1;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:10px;padding:10px 12px 9px;border-bottom:5px solid #000;background:linear-gradient(180deg,#ff6a19 0%,#f15212 48%,#e14008 100%)}
html body.nyanko-ui-polish .formation-tuning-title{min-width:0;display:grid;gap:2px;color:#fff;-webkit-text-fill-color:#fff;font-family:OedoKanteiryuLocal,"Hiragino Mincho ProN",system-ui,sans-serif;font-weight:900;text-shadow:3px 0 #000,-3px 0 #000,0 3px #000,0 -3px #000,2px 2px #000,-2px 2px #000,2px -2px #000,-2px -2px #000}
html body.nyanko-ui-polish .formation-tuning-title strong{display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:clamp(1.35rem,2vw,2.05rem);line-height:1.05;letter-spacing:.02em}
html body.nyanko-ui-polish .formation-tuning-title span{font-family:"Hiragino Kaku Gothic ProN","Yu Gothic",system-ui,sans-serif;font-size:.74rem;font-weight:900;color:#fff9e8;-webkit-text-fill-color:#fff9e8;text-shadow:none;letter-spacing:.04em}
html body.nyanko-ui-polish .formation-tuning-close{min-width:72px;height:40px;border:4px solid #000;border-radius:999px;background:#fff3a9;color:#100500;-webkit-text-fill-color:#100500;font-family:OedoKanteiryuLocal,"Hiragino Mincho ProN",system-ui,sans-serif;font-size:1rem;font-weight:900;box-shadow:0 4px 0 #000;text-shadow:none}
html body.nyanko-ui-polish .formation-tuning-close:active{transform:translateY(3px);box-shadow:0 1px 0 #000}
html body.nyanko-ui-polish .formation-tuning-hero{grid-row:2/4;display:grid;grid-template-rows:1fr auto;gap:10px;align-items:center;justify-items:center;padding:14px;border-right:5px solid #000;background:radial-gradient(circle at 50% 34%,#fffdf0 0 36%,#ffd85a 37% 58%,#c88418 59% 100%)}
html body.nyanko-ui-polish .formation-tuning-portrait{width:min(166px,28vw);aspect-ratio:1;border:5px solid #000;border-radius:18px;background:#fffdf0;display:grid;place-items:center;box-shadow:0 6px 0 #000,inset 0 2px 0 rgba(255,255,255,.8);overflow:hidden}
html body.nyanko-ui-polish .formation-tuning-portrait img{width:92%;height:92%;object-fit:contain;image-rendering:auto;filter:drop-shadow(0 3px 0 rgba(0,0,0,.45))}
html body.nyanko-ui-polish .formation-tuning-portrait img.image-missing{opacity:.22;filter:none}
html body.nyanko-ui-polish .formation-tuning-hero-meta{width:100%;display:grid;gap:6px;text-align:center}
html body.nyanko-ui-polish .formation-tuning-chip{justify-self:center;min-height:28px;display:inline-flex;align-items:center;justify-content:center;padding:0 12px;border:3px solid #000;border-radius:999px;background:#111;color:#fff8d8;-webkit-text-fill-color:#fff8d8;font-family:"Hiragino Kaku Gothic ProN","Yu Gothic",system-ui,sans-serif;font-size:.75rem;font-weight:900;text-shadow:none}
html body.nyanko-ui-polish .formation-tuning-body{min-height:0;overflow:auto;-webkit-overflow-scrolling:touch;display:grid;gap:11px;padding:13px;background:linear-gradient(180deg,#fff8d7,#ffe890)}
html body.nyanko-ui-polish .formation-tuning-control{display:grid;gap:8px;padding:10px;border:4px solid #000;border-radius:18px;background:#fff6cd;box-shadow:inset 0 2px 0 rgba(255,255,255,.85)}
html body.nyanko-ui-polish .formation-tuning-control-head{display:flex;align-items:center;justify-content:space-between;gap:10px;font-family:"Hiragino Kaku Gothic ProN","Yu Gothic",system-ui,sans-serif;color:#1b1005;-webkit-text-fill-color:#1b1005;text-shadow:none;font-weight:1000}
html body.nyanko-ui-polish .formation-tuning-control-head strong{font-size:.96rem;letter-spacing:.04em}
html body.nyanko-ui-polish .formation-tuning-control-head span{font-size:.75rem;color:#5c3510;-webkit-text-fill-color:#5c3510;text-shadow:none}
html body.nyanko-ui-polish .formation-tuning-stepper{display:grid;grid-template-columns:58px 52px minmax(86px,1fr) 52px 58px;gap:8px;align-items:center}
html body.nyanko-ui-polish .formation-tuning-btn,html body.nyanko-ui-polish .formation-tuning-save,html body.nyanko-ui-polish .formation-tuning-reset{min-height:44px;border:4px solid #000;border-radius:999px;background:linear-gradient(180deg,#ff6a19,#f15212 52%,#e14008);color:#fff;-webkit-text-fill-color:#fff;font-family:OedoKanteiryuLocal,"Hiragino Mincho ProN",system-ui,sans-serif;font-size:1.05rem;font-weight:900;line-height:1;box-shadow:0 4px 0 #000;text-shadow:2px 0 #000,-2px 0 #000,0 2px #000,0 -2px #000,1px 1px #000,-1px 1px #000,1px -1px #000,-1px -1px #000}
html body.nyanko-ui-polish .formation-tuning-btn:disabled{opacity:.42;filter:saturate(.55);transform:none;box-shadow:0 2px 0 #000}
html body.nyanko-ui-polish .formation-tuning-btn:active:not(:disabled),html body.nyanko-ui-polish .formation-tuning-save:active,html body.nyanko-ui-polish .formation-tuning-reset:active{transform:translateY(3px);box-shadow:0 1px 0 #000}
html body.nyanko-ui-polish .formation-tuning-readout{min-width:0;height:50px;border:4px solid #000;border-radius:16px;background:#111;color:#fff;-webkit-text-fill-color:#fff;font-family:OedoKanteiryuLocal,"Hiragino Mincho ProN",system-ui,sans-serif;font-size:1.55rem;font-weight:900;text-align:center;box-shadow:inset 0 2px 6px rgba(0,0,0,.7);text-shadow:2px 0 #000,-2px 0 #000,0 2px #000,0 -2px #000}
html body.nyanko-ui-polish .formation-tuning-meter{height:12px;border:3px solid #000;border-radius:999px;background:#2a1207;overflow:hidden}
html body.nyanko-ui-polish .formation-tuning-meter span{display:block;height:100%;width:calc(var(--value,0)*1%);background:linear-gradient(90deg,#ffe25a,#ff8f1c)}
html body.nyanko-ui-polish .formation-tuning-presets{display:flex;flex-wrap:wrap;gap:8px}.formation-tuning-presets .formation-tuning-btn{min-width:76px;font-size:.92rem;background:#fff2a6;color:#140700;-webkit-text-fill-color:#140700;text-shadow:none}
html body.nyanko-ui-polish .formation-tuning-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.formation-tuning-stat{min-width:0;padding:8px 9px;border:3px solid #000;border-radius:14px;background:#111;color:#fff8d8;-webkit-text-fill-color:#fff8d8;text-align:center;font-family:"Hiragino Kaku Gothic ProN","Yu Gothic",system-ui,sans-serif;font-weight:900;text-shadow:none}.formation-tuning-stat b{display:block;color:#fff;-webkit-text-fill-color:#fff;font-family:OedoKanteiryuLocal,"Hiragino Mincho ProN",system-ui,sans-serif;font-size:1.1rem;text-shadow:2px 0 #000,-2px 0 #000,0 2px #000,0 -2px #000}.formation-tuning-stat small{display:block;margin-top:2px;color:#ffe8a8;-webkit-text-fill-color:#ffe8a8;font-size:.66rem;text-shadow:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
html body.nyanko-ui-polish .formation-tuning-footer{grid-column:2;display:grid;grid-template-columns:minmax(120px,.55fr) minmax(150px,1fr);gap:10px;padding:11px 13px;border-top:5px solid #000;background:#f6c240}.formation-tuning-reset{background:#fff2a6;color:#160800;-webkit-text-fill-color:#160800;text-shadow:none}.formation-tuning-save{font-size:1.25rem}
@media (max-width:860px){html body.nyanko-ui-polish .formation-tuning-panel{grid-template-columns:1fr;grid-template-rows:auto auto minmax(0,1fr) auto;width:min(560px,calc(100vw - 18px))}.formation-tuning-hero{grid-row:auto!important;border-right:0!important;border-bottom:5px solid #000!important;grid-template-columns:auto minmax(0,1fr)!important;grid-template-rows:auto!important;justify-items:start!important;padding:10px 12px!important}.formation-tuning-portrait{width:82px!important;border-radius:14px!important}.formation-tuning-hero-meta{text-align:left!important}.formation-tuning-footer{grid-column:1!important}.formation-tuning-summary{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media (max-height:520px) and (orientation:landscape){html body.nyanko-ui-polish .formation-tuning-overlay{padding:6px calc(8px + env(safe-area-inset-right,0px)) 6px calc(8px + env(safe-area-inset-left,0px))}.formation-tuning-panel{width:min(900px,calc(100vw - 16px))!important;max-height:calc(100dvh - 12px)!important;grid-template-columns:190px minmax(0,1fr)!important;grid-template-rows:auto minmax(0,1fr) auto!important;border-width:5px!important;border-radius:18px!important}.formation-tuning-header{padding:7px 10px 6px!important}.formation-tuning-title strong{font-size:1.28rem!important}.formation-tuning-hero{grid-row:2/4!important;border-right:5px solid #000!important;border-bottom:0!important;display:grid!important;grid-template-columns:1fr!important;padding:10px!important}.formation-tuning-portrait{width:112px!important}.formation-tuning-body{padding:9px!important;gap:8px!important}.formation-tuning-control{padding:8px!important;gap:6px!important}.formation-tuning-stepper{grid-template-columns:50px 46px minmax(76px,1fr) 46px 50px!important;gap:6px!important}.formation-tuning-btn,.formation-tuning-save,.formation-tuning-reset{min-height:38px!important;font-size:.9rem!important}.formation-tuning-readout{height:42px!important;font-size:1.28rem!important}.formation-tuning-summary{grid-template-columns:repeat(3,minmax(0,1fr))!important}.formation-tuning-stat{padding:6px!important}.formation-tuning-footer{grid-column:2!important;padding:8px 10px!important}}
@media (max-width:430px){html body.nyanko-ui-polish .formation-tuning-stepper{grid-template-columns:44px 42px minmax(70px,1fr) 42px 44px;gap:5px}.formation-tuning-summary{grid-template-columns:1fr}.formation-tuning-footer{grid-template-columns:1fr 1.2fr}.formation-tuning-title strong{font-size:1.18rem!important}}
  `;
  document.head.appendChild(style);
}

function tuningOverlay(editor) {
  injectStyle();
  let overlay = editor.root.querySelector('.formation-tuning-overlay');
  if (!overlay) {
    overlay = document.createElement('section');
    overlay.className = 'formation-tuning-overlay';
    overlay.setAttribute('aria-label', 'character tuning');
    editor.root.appendChild(overlay);
  }
  return overlay;
}

function meterPercent(value, max) {
  if (!(max > 0)) return 0;
  return Math.max(0, Math.min(100, Math.round((Number(value) / Number(max)) * 100)));
}

function createDraft(editor, characterId) {
  const character = getCharacterById(characterId);
  if (!character) return null;
  if (character.faction === 'cat') {
    const state = resolveCatState(characterId);
    return {
      characterId,
      faction: 'cat',
      level: state.resolved.level,
      plusLevel: state.resolved.plusLevel,
      prefLevel: state.resolved.prefLevel
    };
  }
  return { characterId, faction: 'dog', percent: resolveDogState(characterId).percent };
}

function renderHero(editor, character, modeLabel) {
  return `<aside class='formation-tuning-hero'>
    <div class='formation-tuning-portrait'>${editor.renderIconMarkup?.(character, 'formation-tuning-icon') || ''}</div>
    <div class='formation-tuning-hero-meta'>
      <span class='formation-tuning-chip'>${esc(modeLabel)}</span>
      <span class='formation-tuning-chip'>${esc(character?.characterId || '')}</span>
    </div>
  </aside>`;
}

function stepper({ key, value, min, max, label, maxLabel, deltas = [-10, -1, 1, 10] }) {
  const pct = meterPercent(value - min, max - min);
  return `<section class='formation-tuning-control' data-tuning-control='${esc(key)}'>
    <div class='formation-tuning-control-head'><strong>${esc(label)}</strong><span>${esc(maxLabel)}</span></div>
    <div class='formation-tuning-stepper'>
      <button type='button' class='formation-tuning-btn' data-tuning-step='${esc(key)}' data-delta='${deltas[0]}' ${value <= min ? 'disabled' : ''}>${deltas[0]}</button>
      <button type='button' class='formation-tuning-btn' data-tuning-step='${esc(key)}' data-delta='${deltas[1]}' ${value <= min ? 'disabled' : ''}>${deltas[1]}</button>
      <input class='formation-tuning-readout' data-tuning-input='${esc(key)}' inputmode='numeric' type='number' min='${min}' max='${max}' value='${value}' aria-label='${esc(label)}'>
      <button type='button' class='formation-tuning-btn' data-tuning-step='${esc(key)}' data-delta='${deltas[2]}' ${value >= max ? 'disabled' : ''}>+${deltas[2]}</button>
      <button type='button' class='formation-tuning-btn' data-tuning-step='${esc(key)}' data-delta='${deltas[3]}' ${value >= max ? 'disabled' : ''}>+${deltas[3]}</button>
    </div>
    <div class='formation-tuning-meter' style='--value:${pct}'><span></span></div>
  </section>`;
}

function renderCatPanel(editor, draft) {
  const { character, metadata, resolved } = resolveCatState(draft.characterId, draft);
  if (!character) return '';
  const maxLevel = resolved.maxLevel;
  const maxPlusLevel = resolved.maxPlusLevel;
  const level = clampInt(draft.level, 1, maxLevel);
  const plusLevel = clampInt(draft.plusLevel, 0, maxPlusLevel);
  const preview = resolveBcuUnitLevelConfig({ requested: { level, plusLevel, prefLevel: draft.prefLevel || level }, metadata, source: 'formation-tuning-preview' });
  draft.level = preview.level;
  draft.plusLevel = preview.plusLevel;
  draft.prefLevel = preview.prefLevel;
  const plusControl = maxPlusLevel > 0
    ? stepper({ key: 'plusLevel', value: preview.plusLevel, min: 0, max: maxPlusLevel, label: '+Lv', maxLabel: `MAX +${maxPlusLevel}`, deltas: [-10, -1, 1, 10] })
    : `<section class='formation-tuning-control'><div class='formation-tuning-control-head'><strong>+Lv</strong><span>このキャラは+Lvなし</span></div><div class='formation-tuning-chip'>+Lv 0</div></section>`;
  return `<div class='formation-tuning-panel' role='dialog' aria-modal='true'>
    <header class='formation-tuning-header'><div class='formation-tuning-title'><strong>${esc(character.label || character.characterId)}</strong><span>キャラレベル調整</span></div><button type='button' class='formation-tuning-close' data-tuning-close='1'>閉じる</button></header>
    ${renderHero(editor, character, 'にゃんこ')}
    <main class='formation-tuning-body'>
      ${stepper({ key: 'level', value: preview.level, min: 1, max: maxLevel, label: 'Lv', maxLabel: `MAX ${maxLevel}`, deltas: [-10, -1, 1, 10] })}
      ${plusControl}
      <section class='formation-tuning-summary'>
        <div class='formation-tuning-stat'><b>${preview.level}+${preview.plusLevel}</b><small>表示Lv</small></div>
        <div class='formation-tuning-stat'><b>${preview.effectiveLevel}</b><small>有効Lv</small></div>
        <div class='formation-tuning-stat'><b>x${preview.multiplier.toFixed(2)}</b><small>BCU補正</small></div>
      </section>
      <div class='formation-tuning-presets'>
        <button type='button' class='formation-tuning-btn' data-tuning-preset='cat-max'>MAX</button>
        <button type='button' class='formation-tuning-btn' data-tuning-preset='cat-default'>既定</button>
      </div>
    </main>
    <footer class='formation-tuning-footer'><button type='button' class='formation-tuning-reset' data-tuning-reset='1'>リセット</button><button type='button' class='formation-tuning-save' data-tuning-save='1'>決定</button></footer>
  </div>`;
}

function renderDogPanel(editor, draft) {
  const { character, percent } = resolveDogState(draft.characterId, draft);
  if (!character) return '';
  draft.percent = percent;
  const meter = Math.min(100, Math.round(percent / 10));
  return `<div class='formation-tuning-panel formation-tuning-panel-dog' role='dialog' aria-modal='true'>
    <header class='formation-tuning-header'><div class='formation-tuning-title'><strong>${esc(character.label || character.characterId)}</strong><span>ワンコ軍 倍率調整</span></div><button type='button' class='formation-tuning-close' data-tuning-close='1'>閉じる</button></header>
    ${renderHero(editor, character, 'ワンコ軍')}
    <main class='formation-tuning-body'>
      <section class='formation-tuning-control'>
        <div class='formation-tuning-control-head'><strong>倍率</strong><span>初期値 100%</span></div>
        <div class='formation-tuning-stepper'>
          <button type='button' class='formation-tuning-btn' data-tuning-step='percent' data-delta='-50' ${percent <= 1 ? 'disabled' : ''}>-50</button>
          <button type='button' class='formation-tuning-btn' data-tuning-step='percent' data-delta='-10' ${percent <= 1 ? 'disabled' : ''}>-10</button>
          <input class='formation-tuning-readout' data-tuning-input='percent' inputmode='numeric' type='number' min='1' max='999900' value='${percent}' aria-label='倍率'>
          <button type='button' class='formation-tuning-btn' data-tuning-step='percent' data-delta='10'>+10</button>
          <button type='button' class='formation-tuning-btn' data-tuning-step='percent' data-delta='50'>+50</button>
        </div>
        <div class='formation-tuning-meter' style='--value:${meter}'><span></span></div>
      </section>
      <div class='formation-tuning-presets'>${[50,100,200,300,500,1000].map((p) => `<button type='button' class='formation-tuning-btn' data-tuning-preset='dog-${p}'>${p}%</button>`).join('')}</div>
      <section class='formation-tuning-summary'>
        <div class='formation-tuning-stat'><b>${percent}%</b><small>倍率</small></div>
        <div class='formation-tuning-stat'><b>x${(percent / 100).toFixed(2)}</b><small>HP/攻撃</small></div>
        <div class='formation-tuning-stat'><b>100%</b><small>初期値</small></div>
      </section>
    </main>
    <footer class='formation-tuning-footer'><button type='button' class='formation-tuning-reset' data-tuning-reset='1'>100%に戻す</button><button type='button' class='formation-tuning-save' data-tuning-save='1'>決定</button></footer>
  </div>`;
}

function renderTuningOverlay(editor) {
  const overlay = tuningOverlay(editor);
  const draft = editor.characterTuningDraft;
  if (!draft?.characterId) {
    overlay.classList.remove('is-open');
    overlay.innerHTML = '';
    return;
  }
  overlay.classList.add('is-open');
  overlay.innerHTML = draft.faction === 'cat' ? renderCatPanel(editor, draft) : renderDogPanel(editor, draft);
  editor.resolveSemanticIcons?.();
}

function openTuningOverlay(editor, characterId, slotIndex = null) {
  const character = getCharacterById(characterId);
  if (!character) return false;
  editor.activeSlot = Number.isFinite(Number(slotIndex)) ? Number(slotIndex) : editor.activeSlot;
  editor.characterTuningDraft = createDraft(editor, characterId);
  renderTuningOverlay(editor);
  return true;
}

function closeTuningOverlay(editor) {
  editor.characterTuningDraft = null;
  renderTuningOverlay(editor);
}

function stepDraft(editor, key, delta) {
  const draft = editor.characterTuningDraft;
  if (!draft) return;
  if (draft.faction === 'cat') {
    const state = resolveCatState(draft.characterId, draft);
    if (key === 'level') draft.level = clampInt((draft.level ?? state.resolved.level) + delta, 1, state.resolved.maxLevel);
    if (key === 'plusLevel') draft.plusLevel = clampInt((draft.plusLevel ?? state.resolved.plusLevel) + delta, 0, state.resolved.maxPlusLevel);
  } else if (key === 'percent') {
    draft.percent = clampInt((draft.percent ?? DOG_DEFAULT_MAGNIFICATION_PERCENT) + delta, 1, 999900);
  }
  renderTuningOverlay(editor);
}

function setDraftInput(editor, key, value) {
  const draft = editor.characterTuningDraft;
  if (!draft) return;
  if (draft.faction === 'cat') {
    const state = resolveCatState(draft.characterId, draft);
    if (key === 'level') draft.level = clampInt(value, 1, state.resolved.maxLevel);
    if (key === 'plusLevel') draft.plusLevel = clampInt(value, 0, state.resolved.maxPlusLevel);
  } else if (key === 'percent') {
    draft.percent = clampInt(value, 1, 999900);
  }
  renderTuningOverlay(editor);
}

function applyPreset(editor, preset) {
  const draft = editor.characterTuningDraft;
  if (!draft) return;
  if (preset === 'cat-max' && draft.faction === 'cat') {
    const state = resolveCatState(draft.characterId, draft);
    draft.level = state.resolved.maxLevel;
    draft.plusLevel = state.resolved.maxPlusLevel;
  } else if (preset === 'cat-default' && draft.faction === 'cat') {
    const fresh = createDraft(editor, draft.characterId);
    editor.characterTuningDraft = fresh;
  } else if (preset?.startsWith?.('dog-') && draft.faction === 'dog') {
    draft.percent = clampInt(preset.slice(4), 1, 999900);
  }
  renderTuningOverlay(editor);
}

function saveDraft(editor) {
  const draft = editor.characterTuningDraft;
  if (!draft) return;
  const character = getCharacterById(draft.characterId);
  if (!character) return closeTuningOverlay(editor);
  let formation;
  if (draft.faction === 'cat') {
    const state = resolveCatState(draft.characterId, draft);
    formation = FormationStore.setCatUnitLevel(draft.characterId, { level: state.resolved.level, plusLevel: state.resolved.plusLevel, source: 'formation-tuning-overlay-cat' });
    syncFormation(editor, formation, `${character.label || draft.characterId}: Lv${state.resolved.level}+${state.resolved.plusLevel}`);
  } else {
    const percent = clampInt(draft.percent, 1, 999900);
    formation = FormationStore.setDogUnitMagnification(draft.characterId, { percent, source: 'formation-tuning-overlay-dog' });
    syncFormation(editor, formation, `${character.label || draft.characterId}: ${percent}%`);
  }
  closeTuningOverlay(editor);
}

function resetDraft(editor) {
  const draft = editor.characterTuningDraft;
  if (!draft) return;
  const character = getCharacterById(draft.characterId);
  let formation;
  if (draft.faction === 'cat') {
    formation = FormationStore.clearCatUnitLevel(draft.characterId);
    syncFormation(editor, formation, `${character?.label || draft.characterId}: 個別Lv解除`);
  } else {
    formation = FormationStore.clearDogUnitMagnification(draft.characterId);
    syncFormation(editor, formation, `${character?.label || draft.characterId}: 100%`);
  }
  editor.characterTuningDraft = createDraft(editor, draft.characterId);
  renderTuningOverlay(editor);
}

function decorateSlotBadges(editor) {
  const slots = formationSlots(editor);
  for (const slot of editor.root.querySelectorAll('.formation-slot[data-slot]')) {
    slot.querySelector('.formation-tuning-badge')?.remove();
    const index = Number(slot.dataset.slot);
    const characterId = slots[index] || null;
    const character = characterId ? getCharacterById(characterId) : null;
    if (!character) continue;
    let label = '';
    if (character.faction === 'cat') {
      const saved = FormationStore.getCatUnitLevel(characterId);
      if (saved) {
        const state = resolveCatState(characterId);
        label = `Lv${state.resolved.level}${state.resolved.plusLevel ? `+${state.resolved.plusLevel}` : ''}`;
      }
    } else if (character.faction === 'dog') {
      const saved = FormationStore.getDogUnitMagnification(characterId);
      const percent = saved?.percent ?? DOG_DEFAULT_MAGNIFICATION_PERCENT;
      if (percent !== DOG_DEFAULT_MAGNIFICATION_PERCENT) label = `${percent}%`;
    }
    if (!label) continue;
    slot.insertAdjacentHTML('beforeend', `<b class='formation-tuning-badge'>${esc(label)}</b>`);
  }
}

export function installFormationEditorBcuUnitLevelPatch() {
  const proto = FormationEditor?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  proto.getCharacterBattleTuning = function getCharacterBattleTuning(characterId) {
    const character = getCharacterById(characterId);
    const catState = character?.faction === 'cat' ? resolveCatState(characterId) : null;
    const dogState = character?.faction === 'dog' ? resolveDogState(characterId) : null;
    return {
      characterId,
      character,
      faction: character?.faction || null,
      globalCatPrefLevel: FormationStore.load().options?.bcuCatUnitLevel || null,
      catUnitLevel: FormationStore.getCatUnitLevel(characterId),
      dogUnitMagnification: FormationStore.getDogUnitMagnification(characterId),
      catResolved: catState?.resolved || null,
      dogResolved: dogState ? { percent: dogState.percent } : null,
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

  proto.openCharacterTuningOverlay = function openCharacterTuningOverlay(characterId, slotIndex = null) {
    return openTuningOverlay(this, characterId, slotIndex);
  };

  const originalRefresh = proto.refresh;
  proto.refresh = function refreshWithCharacterTuning(...args) {
    const result = originalRefresh.apply(this, args);
    injectStyle();
    tuningOverlay(this);
    decorateSlotBadges(this);
    return result;
  };

  const originalRenderDynamic = proto.renderDynamic;
  proto.renderDynamic = function renderDynamicWithCharacterTuning(...args) {
    const result = originalRenderDynamic.apply(this, args);
    decorateSlotBadges(this);
    if (this.characterTuningDraft?.characterId) renderTuningOverlay(this);
    return result;
  };

  const originalOnInput = proto.onInput;
  proto.onInput = function onInputWithCharacterTuning(event) {
    const tuningInput = event.target.closest?.('[data-tuning-input]');
    if (tuningInput && this.root?.contains(tuningInput)) {
      event.preventDefault();
      event.stopPropagation();
      setDraftInput(this, tuningInput.dataset.tuningInput, tuningInput.value);
      return;
    }
    return originalOnInput.call(this, event);
  };

  const originalOnClick = proto.onClick;
  proto.onClick = function onClickWithCharacterTuning(event) {
    const close = event.target.closest?.('[data-tuning-close]');
    const save = event.target.closest?.('[data-tuning-save]');
    const reset = event.target.closest?.('[data-tuning-reset]');
    const step = event.target.closest?.('[data-tuning-step]');
    const preset = event.target.closest?.('[data-tuning-preset]');
    if ((close || save || reset || step || preset) && this.root?.contains(event.target)) {
      event.preventDefault();
      event.stopPropagation();
      if (close) return closeTuningOverlay(this);
      if (save) return saveDraft(this);
      if (reset) return resetDraft(this);
      if (step) return stepDraft(this, step.dataset.tuningStep, toInt(step.dataset.delta, 0));
      if (preset) return applyPreset(this, preset.dataset.tuningPreset);
    }
    const overlay = event.target.closest?.('.formation-tuning-overlay');
    if (overlay && event.target === overlay && this.root?.contains(overlay)) {
      event.preventDefault();
      event.stopPropagation();
      return closeTuningOverlay(this);
    }
    const slot = event.target.closest?.('[data-slot]');
    if (slot && this.root?.contains(slot)) {
      const slotIndex = Number(slot.dataset.slot);
      const characterId = slotCharacterId(this, slotIndex);
      if (characterId && getCharacterById(characterId)) {
        event.preventDefault();
        event.stopPropagation();
        this.activeSlot = slotIndex;
        this.activePage = Math.max(0, Math.floor(slotIndex / 5));
        decorateSlotBadges(this);
        return openTuningOverlay(this, characterId, slotIndex);
      }
    }
    return originalOnClick.call(this, event);
  };
}

installFormationEditorBcuUnitLevelPatch();
