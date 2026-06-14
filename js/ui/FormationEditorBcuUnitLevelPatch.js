import { FormationEditor } from './FormationEditor.js';
import { press } from './UiMotion.mjs';
import { FormationStore, DOG_DEFAULT_MAGNIFICATION_PERCENT, LINEUP_COLS } from '../battle/FormationStore.js';
import { getCharacterById } from '../battle/CharacterCatalog.js';
import { getBcuAssetDatabase } from '../bcu/BcuAssetDatabase.js';
import {
  BCU_DEFAULT_PREF_LEVEL,
  resolveBcuUnitLevelConfig
} from '../battle/bcu-runtime/BcuUnitLevelRuntime.js';
import { ORB_ID, ORB_TRAIT_NAMES } from '../battle/bcu-runtime/BcuOrbModifier.js';
import { PC_CORRES, getTalentAbilityName, getTalentInfoForUnit, isTalentAbilityNameRegistryLoaded, isTalentRegistryLoaded } from '../battle/bcu-runtime/BcuTalentInfoData.js';
import { PC_CATEGORY, PC_SUBTYPE } from '../battle/bcu-runtime/BcuTalentModifier.js';
import { loadBcuTalentAbilityNames, loadBcuTalentRegistry } from '../battle/bcu-runtime/BcuTalentRegistryLoader.js';

const PATCH_FLAG = Symbol.for('wanko-ui.formation-bcu-unit-level.v4-premium-motion');
const STYLE_ID = 'formation-character-tuning-overlay-style';
const LONG_PRESS_MS = 520;
// Quick taps stay invisible: the ring only fades in after this delay.
const LONG_PRESS_RING_DELAY_MS = 120;
const LONG_PRESS_MOVE_TOLERANCE_PX = 12;
const DOG_MAGNIFICATION_MAX = 999900;
const ORB_SLOT_COUNT = 1;
const ORB_TYPE_OPTIONS = Object.freeze([
  { code: 0, type: null, label: 'なし' },
  { code: 1, type: ORB_ID.ATK, label: '攻撃' },
  { code: 2, type: ORB_ID.RES, label: '体力' },
  { code: 3, type: ORB_ID.STRONG, label: 'めっぽう強い' },
  { code: 4, type: ORB_ID.MASSIVE, label: '超ダメージ' },
  { code: 5, type: ORB_ID.RESISTANT, label: '打たれ強い' }
]);
const ORB_TYPE_CODE_BY_ID = Object.freeze(Object.fromEntries(ORB_TYPE_OPTIONS.filter((o) => o.type != null).map((o) => [o.type, o.code])));
const ORB_TRAIT_LABELS = Object.freeze(['赤', '浮', '黒', 'メタル', '天使', 'エイリアン', 'ゾンビ', '古代種', '白', 'エヴァ', '魔女', '悪魔']);
const ORB_GRADE_LABELS = Object.freeze(['D', 'C', 'B', 'A', 'S']);

const reduceMotion = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;

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
@font-face{font-family:HakusyuTuningLocal;src:url('./public/assets/%E7%99%BD%E8%88%9F%E8%A1%8C%E6%9B%B8%E6%95%99%E6%BC%A2.ttf') format('truetype');font-weight:900;font-style:normal;font-display:block}
html body.nyanko-ui-polish .formation-slot{position:relative!important;overflow:visible!important}
html body.nyanko-ui-polish .formation-tuning-badge{position:absolute;right:5px;bottom:5px;z-index:6;min-width:46px;height:22px;padding:0 8px;display:inline-flex;align-items:center;justify-content:center;border:3px solid #000;border-radius:999px;background:#f15212;color:#fff;-webkit-text-fill-color:#fff;font-family:HakusyuTuningLocal,"Hiragino Kaku Gothic ProN","Yu Gothic",system-ui,sans-serif;font-size:.72rem;font-weight:900;line-height:1;letter-spacing:.01em;box-shadow:0 2px 0 #000;text-shadow:2px 0 #000,-2px 0 #000,0 2px #000,0 -2px #000,1px 1px #000,-1px 1px #000,1px -1px #000,-1px -1px #000;pointer-events:none}
html body.nyanko-ui-polish .formation-tuning-overlay{position:fixed;inset:0;z-index:99980;display:none;place-items:center;padding:calc(10px + env(safe-area-inset-top,0px)) calc(12px + env(safe-area-inset-right,0px)) calc(10px + env(safe-area-inset-bottom,0px)) calc(12px + env(safe-area-inset-left,0px));background:rgba(0,0,0,.48);backdrop-filter:blur(2px);touch-action:none}
html body.nyanko-ui-polish .formation-tuning-overlay.is-open{display:grid;opacity:1!important;animation:none!important}
html body.nyanko-ui-polish .formation-tuning-overlay.is-opening{animation:formationTuningFade .14s ease-out both!important}
html body.nyanko-ui-polish .formation-tuning-overlay.is-closing{background:rgba(0,0,0,0)!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;animation:none!important}
@keyframes formationTuningFade{from{opacity:0}to{opacity:1}}
@keyframes formationTuningFadeOut{from{opacity:1}to{opacity:0}}
html body.nyanko-ui-polish .formation-tuning-panel{width:min(920px,calc(100vw - 28px));max-height:calc(100dvh - 20px);display:grid;grid-template-columns:minmax(190px,245px) minmax(0,1fr);grid-template-rows:auto minmax(0,1fr) auto;overflow:hidden;border:6px solid #000;border-radius:22px;background:#fff4c2;box-shadow:0 10px 0 #160804,0 0 0 4px rgba(255,255,255,.12);transform-origin:center}
html body.nyanko-ui-polish .formation-tuning-overlay.is-open .formation-tuning-panel{animation:none}
html body.nyanko-ui-polish .formation-tuning-overlay.is-opening .formation-tuning-panel{animation:formationTuningSpring .18s cubic-bezier(.16,1,.3,1) both}
html body.nyanko-ui-polish .formation-tuning-overlay.is-closing .formation-tuning-panel{animation:formationTuningPopOut .11s ease-in both}
@keyframes formationTuningSpring{from{opacity:0;transform:scale(.97) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}
@keyframes formationTuningPopOut{from{opacity:1;transform:scale(1) translateY(0)}to{opacity:0;transform:scale(.98) translateY(5px)}}
html body.nyanko-ui-polish .formation-tuning-overlay.is-opening .formation-tuning-header{animation:formationTuningRise .16s cubic-bezier(.16,1,.3,1) 20ms both}
html body.nyanko-ui-polish .formation-tuning-overlay.is-opening .formation-tuning-hero{animation:formationTuningRise .16s cubic-bezier(.16,1,.3,1) 35ms both}
html body.nyanko-ui-polish .formation-tuning-overlay.is-opening .formation-tuning-body>*{animation:formationTuningRise .16s cubic-bezier(.16,1,.3,1) 45ms both}
html body.nyanko-ui-polish .formation-tuning-overlay.is-opening .formation-tuning-body>*:nth-child(1){animation-delay:35ms}
html body.nyanko-ui-polish .formation-tuning-overlay.is-opening .formation-tuning-body>*:nth-child(2){animation-delay:45ms}
html body.nyanko-ui-polish .formation-tuning-overlay.is-opening .formation-tuning-body>*:nth-child(3){animation-delay:55ms}
html body.nyanko-ui-polish .formation-tuning-overlay.is-opening .formation-tuning-footer{animation:formationTuningRise .16s cubic-bezier(.16,1,.3,1) 60ms both}
@keyframes formationTuningRise{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
html body.nyanko-ui-polish .formation-tuning-overlay .formation-tuning-readout.is-ticking{animation:formationTuningTick .15s ease-out}
@keyframes formationTuningTick{0%{transform:scale(1.06);filter:brightness(1.4)}100%{transform:scale(1);filter:brightness(1)}}
@property --formation-slot-charge{syntax:'<percentage>';inherits:false;initial-value:0%}
html body.nyanko-ui-polish .formation-slot-charge{position:absolute;inset:-8px;z-index:9;border-radius:17px;padding:6px;pointer-events:none;opacity:0;background:conic-gradient(from -90deg,#ffd531 0%,#ff7a12 calc(var(--formation-slot-charge,0%) - 1%),rgba(255,122,18,0) var(--formation-slot-charge,0%)),conic-gradient(rgba(21,8,2,.55) 0 100%);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);mask-composite:exclude;filter:drop-shadow(0 1px 0 rgba(0,0,0,.65)) drop-shadow(0 0 7px rgba(255,150,40,.8))}
html body.nyanko-ui-polish .formation-slot.is-charging{animation:formationSlotChargeSqueeze var(--formation-slot-charge-ms,520ms) cubic-bezier(.3,0,.6,1) forwards}
html body.nyanko-ui-polish .formation-slot.is-charging .formation-slot-charge{animation:formationSlotChargeFade var(--formation-slot-charge-delay,120ms) ease-out forwards,formationSlotChargeSweep calc(var(--formation-slot-charge-ms,520ms) - var(--formation-slot-charge-delay,120ms)) linear var(--formation-slot-charge-delay,120ms) forwards}
@keyframes formationSlotChargeSqueeze{0%{transform:scale(1)}18%{transform:scale(.985)}100%{transform:scale(.955)}}
@keyframes formationSlotChargeFade{from{opacity:0}to{opacity:1}}
@keyframes formationSlotChargeSweep{from{--formation-slot-charge:0%}to{--formation-slot-charge:100%}}
html body.nyanko-ui-polish .formation-slot.is-charge-fired{animation:formationSlotChargeBurst .32s cubic-bezier(.2,1.3,.3,1) both}
@keyframes formationSlotChargeBurst{0%{transform:scale(.955);filter:brightness(1.45) saturate(1.2)}55%{transform:scale(1.04);filter:brightness(1.2)}100%{transform:scale(1);filter:brightness(1)}}
html body.nyanko-ui-polish .formation-slot.is-charge-fired .formation-slot-charge{opacity:1;--formation-slot-charge:100%;animation:formationSlotChargeFlash .3s ease-out forwards}
@keyframes formationSlotChargeFlash{0%{opacity:1;filter:drop-shadow(0 0 12px rgba(255,228,92,1)) brightness(1.6)}100%{opacity:0;transform:scale(1.1)}}
@media (prefers-reduced-motion: reduce){
  html body.nyanko-ui-polish .formation-tuning-overlay.is-opening,
  html body.nyanko-ui-polish .formation-tuning-overlay.is-closing,
  html body.nyanko-ui-polish .formation-tuning-overlay.is-opening .formation-tuning-panel,
  html body.nyanko-ui-polish .formation-tuning-overlay.is-closing .formation-tuning-panel,
  html body.nyanko-ui-polish .formation-tuning-overlay.is-opening .formation-tuning-header,
  html body.nyanko-ui-polish .formation-tuning-overlay.is-opening .formation-tuning-hero,
  html body.nyanko-ui-polish .formation-tuning-overlay.is-opening .formation-tuning-body>*,
  html body.nyanko-ui-polish .formation-tuning-overlay.is-opening .formation-tuning-footer,
  html body.nyanko-ui-polish .formation-tuning-overlay .formation-tuning-readout,
  html body.nyanko-ui-polish .formation-slot.is-charging,
  html body.nyanko-ui-polish .formation-slot.is-charge-fired,
  html body.nyanko-ui-polish .formation-slot-charge{animation:none!important}
}
html body.nyanko-ui-polish .formation-tuning-header{grid-column:1/-1;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:10px;padding:10px 12px 9px;border-bottom:5px solid #000;background:linear-gradient(180deg,#ff6a19 0%,#f15212 48%,#e14008 100%)}
html body.nyanko-ui-polish .formation-tuning-title{min-width:0;display:grid;gap:2px;color:#fff;-webkit-text-fill-color:#fff;font-family:HakusyuTuningLocal,"Hiragino Kaku Gothic ProN","Yu Gothic",system-ui,sans-serif;font-weight:900;text-shadow:3px 0 #000,-3px 0 #000,0 3px #000,0 -3px #000,2px 2px #000,-2px 2px #000,2px -2px #000,-2px -2px #000}
html body.nyanko-ui-polish .formation-tuning-title strong{display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:clamp(1.35rem,2vw,2.05rem);line-height:1.05;letter-spacing:.02em}
html body.nyanko-ui-polish .formation-tuning-title span{font-family:"Hiragino Kaku Gothic ProN","Yu Gothic",system-ui,sans-serif;font-size:.74rem;font-weight:900;color:#fff9e8;-webkit-text-fill-color:#fff9e8;text-shadow:none;letter-spacing:.04em}
html body.nyanko-ui-polish .formation-tuning-close{min-width:72px;height:40px;display:inline-flex;align-items:center;justify-content:center;padding:0 12px;line-height:1;border:4px solid #000;border-radius:999px;background:#fff3a9;color:#100500;-webkit-text-fill-color:#100500;font-family:HakusyuTuningLocal,"Hiragino Kaku Gothic ProN","Yu Gothic",system-ui,sans-serif;font-size:1rem;font-weight:900;box-shadow:0 4px 0 #000;text-shadow:none}
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
html body.nyanko-ui-polish .formation-tuning-btn,html body.nyanko-ui-polish .formation-tuning-save,html body.nyanko-ui-polish .formation-tuning-reset{min-height:44px;display:inline-flex;align-items:center;justify-content:center;padding:2px 8px;border:4px solid #000;border-radius:999px;background:linear-gradient(180deg,#ff6a19,#f15212 52%,#e14008);color:#fff;-webkit-text-fill-color:#fff;font-family:HakusyuTuningLocal,"Hiragino Kaku Gothic ProN","Yu Gothic",system-ui,sans-serif;font-size:1.05rem;font-weight:900;line-height:1;box-shadow:0 4px 0 #000;text-shadow:2px 0 #000,-2px 0 #000,0 2px #000,0 -2px #000,1px 1px #000,-1px 1px #000,1px -1px #000,-1px -1px #000}
html body.nyanko-ui-polish .formation-tuning-btn:disabled{opacity:.42;filter:saturate(.55);transform:none;box-shadow:0 2px 0 #000}
html body.nyanko-ui-polish .formation-tuning-btn:active:not(:disabled),html body.nyanko-ui-polish .formation-tuning-save:active,html body.nyanko-ui-polish .formation-tuning-reset:active{transform:translateY(3px);box-shadow:0 1px 0 #000}
html body.nyanko-ui-polish .formation-tuning-readout{min-width:0;height:50px;border:4px solid #000;border-radius:16px;background:#111;color:#fff;-webkit-text-fill-color:#fff;font-family:HakusyuTuningLocal,"Hiragino Kaku Gothic ProN","Yu Gothic",system-ui,sans-serif;font-size:1.55rem;font-weight:900;text-align:center;box-shadow:inset 0 2px 6px rgba(0,0,0,.7);text-shadow:2px 0 #000,-2px 0 #000,0 2px #000,0 -2px #000}
html body.nyanko-ui-polish .formation-tuning-meter{height:12px;border:3px solid #000;border-radius:999px;background:#2a1207;overflow:hidden}
html body.nyanko-ui-polish .formation-tuning-meter span{display:block;height:100%;width:calc(var(--value,0)*1%);background:linear-gradient(90deg,#ffe25a,#ff8f1c);transition:width .25s cubic-bezier(.16,1,.3,1)}
@media (hover:hover){
  html body.nyanko-ui-polish .formation-tuning-btn:hover:not(:disabled),
  html body.nyanko-ui-polish .formation-tuning-save:hover,
  html body.nyanko-ui-polish .formation-tuning-reset:hover,
  html body.nyanko-ui-polish .formation-tuning-close:hover{filter:brightness(1.08)}
}
html body.nyanko-ui-polish .formation-tuning-presets{display:grid;grid-template-columns:repeat(auto-fit,minmax(92px,1fr));gap:8px}
html body.nyanko-ui-polish .formation-tuning-presets .formation-tuning-btn{width:auto;min-width:0;font-size:.92rem;background:#fff2a6;color:#140700;-webkit-text-fill-color:#140700;text-shadow:none}
html body.nyanko-ui-polish .formation-tuning-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.formation-tuning-stat{min-width:0;padding:8px 9px;border:3px solid #000;border-radius:14px;background:#111;color:#fff8d8;-webkit-text-fill-color:#fff8d8;text-align:center;font-family:"Hiragino Kaku Gothic ProN","Yu Gothic",system-ui,sans-serif;font-weight:900;text-shadow:none}.formation-tuning-stat b{display:block;color:#fff;-webkit-text-fill-color:#fff;font-family:HakusyuTuningLocal,"Hiragino Kaku Gothic ProN","Yu Gothic",system-ui,sans-serif;font-size:1.1rem;text-shadow:2px 0 #000,-2px 0 #000,0 2px #000,0 -2px #000}.formation-tuning-stat small{display:block;margin-top:2px;color:#ffe8a8;-webkit-text-fill-color:#ffe8a8;font-size:.66rem;text-shadow:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
html body.nyanko-ui-polish .formation-tuning-footer{grid-column:2;display:grid;grid-template-columns:minmax(120px,.55fr) minmax(150px,1fr);gap:10px;padding:11px 13px;border-top:5px solid #000;background:#f6c240}.formation-tuning-reset{background:#fff2a6;color:#160800;-webkit-text-fill-color:#160800;text-shadow:none}.formation-tuning-save{font-size:1.25rem}
html body.nyanko-ui-polish .formation-tuning-body{overflow-y:auto}
html body.nyanko-ui-polish .formation-tuning-talents{display:grid;gap:8px;padding-top:4px;border-top:3px dashed rgba(0,0,0,.35)}
html body.nyanko-ui-polish .formation-tuning-orbs{display:grid;gap:8px;padding-top:4px;border-top:3px dashed rgba(0,0,0,.35)}
html body.nyanko-ui-polish .formation-tuning-orb-slot{display:grid;gap:8px;padding:9px;border:3px solid #000;border-radius:14px;background:#fff1b8}
html body.nyanko-ui-polish .formation-tuning-orb-slot-title{display:flex;align-items:center;justify-content:space-between;gap:8px;color:#1b1005;-webkit-text-fill-color:#1b1005;font-family:"Hiragino Kaku Gothic ProN","Yu Gothic",system-ui,sans-serif;font-size:.78rem;font-weight:1000;text-shadow:none}
html body.nyanko-ui-polish .formation-tuning-orb-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
html body.nyanko-ui-polish .formation-tuning-orb-grid .formation-tuning-stepper{grid-template-columns:42px minmax(48px,1fr) 42px}
html body.nyanko-ui-polish .formation-tuning-orb-grid .formation-tuning-stepper .formation-tuning-btn[data-delta='-5'],html body.nyanko-ui-polish .formation-tuning-orb-grid .formation-tuning-stepper .formation-tuning-btn[data-delta='5']{display:none}
html body.nyanko-ui-polish .formation-tuning-orb-grid .formation-tuning-readout{height:42px;font-size:1.16rem}
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

function orbTypeOption(code) {
  return ORB_TYPE_OPTIONS.find((o) => o.code === Number(code)) || ORB_TYPE_OPTIONS[0];
}

function traitIndexFromMask(mask) {
  const value = Math.trunc(Number(mask) || 0);
  for (let i = 0; i < ORB_TRAIT_NAMES.length - 1; i++) {
    if ((value & (1 << i)) !== 0) return i;
  }
  return 0;
}

function savedOrbToDraft(triple) {
  if (!Array.isArray(triple) || triple.length < 3) return { typeCode: 0, traitIndex: 0, grade: 0 };
  const typeCode = ORB_TYPE_CODE_BY_ID[Math.trunc(Number(triple[0]) || 0)] || 0;
  return {
    typeCode,
    traitIndex: clampInt(traitIndexFromMask(triple[1]), 0, ORB_TRAIT_LABELS.length - 1),
    grade: clampInt(triple[2], 0, ORB_GRADE_LABELS.length - 1)
  };
}

function draftOrbToTriple(orb) {
  const opt = orbTypeOption(orb?.typeCode);
  if (opt.type == null) return null;
  const traitIndex = clampInt(orb?.traitIndex, 0, ORB_TRAIT_LABELS.length - 1);
  const grade = clampInt(orb?.grade, 0, ORB_GRADE_LABELS.length - 1);
  return [opt.type, 1 << traitIndex, grade];
}

function ensureDraftOrbs(draft) {
  if (Array.isArray(draft.orbs) && draft.orbs.length === ORB_SLOT_COUNT) return draft.orbs;
  const saved = FormationStore.getOrbEquipment(draft.characterId) || [];
  draft.orbs = Array.from({ length: ORB_SLOT_COUNT }, (_, i) => savedOrbToDraft(saved[i]));
  return draft.orbs;
}

function orbValueLabel(kind, value) {
  if (kind === 'type') return orbTypeOption(value).label;
  if (kind === 'trait') return ORB_TRAIT_LABELS[clampInt(value, 0, ORB_TRAIT_LABELS.length - 1)] || ORB_TRAIT_LABELS[0];
  if (kind === 'grade') return ORB_GRADE_LABELS[clampInt(value, 0, ORB_GRADE_LABELS.length - 1)] || ORB_GRADE_LABELS[0];
  return String(value);
}

function renderOrbSection(draft) {
  const orbs = ensureDraftOrbs(draft);
  const slots = orbs.map((orb, i) => {
    const typeLabel = orbValueLabel('type', orb.typeCode);
    return `<section class='formation-tuning-orb-slot'>
      <div class='formation-tuning-orb-slot-title'><strong>本能玉 ${i + 1}</strong><span>${esc(typeLabel)}</span></div>
      <div class='formation-tuning-orb-grid'>
        ${stepper({ key: `orb-${i}-type`, value: orb.typeCode, min: 0, max: ORB_TYPE_OPTIONS.length - 1, label: '種類', maxLabel: typeLabel, deltas: [-5, -1, 1, 5] })}
        ${stepper({ key: `orb-${i}-trait`, value: orb.traitIndex, min: 0, max: ORB_TRAIT_LABELS.length - 1, label: '属性', maxLabel: orbValueLabel('trait', orb.traitIndex), deltas: [-5, -1, 1, 5] })}
        ${stepper({ key: `orb-${i}-grade`, value: orb.grade, min: 0, max: ORB_GRADE_LABELS.length - 1, label: '等級', maxLabel: orbValueLabel('grade', orb.grade), deltas: [-5, -1, 1, 5] })}
      </div>
    </section>`;
  }).join('');
  const equipped = orbs.filter((orb) => orbTypeOption(orb.typeCode).type != null).length;
  return `<section class='formation-tuning-orbs'><div class='formation-tuning-control-head'><strong>本能玉</strong><span>${equipped ? '装備中' : '未装備'}</span></div>${slots}</section>`;
}

function catStatsId(characterId) {
  // Catalog characters carry no statsId; the BCU unit id is in the id (cat-unit-<id>-<form>).
  const c = getCharacterById(characterId);
  if (Number.isFinite(Number(c?.statsId))) return Number(c.statsId);
  const m = /^cat-unit-(\d+)-[fcsu]$/.exec(String(characterId ?? ''));
  return m ? Number.parseInt(m[1], 10) : null;
}

function talentInfoFor(characterId) {
  const id = catStatsId(characterId);
  return id == null ? [] : (getTalentInfoForUnit(id) || []);
}

function talentEffectLabel(abilityID) {
  const localized = getTalentAbilityName(abilityID);
  if (localized) return localized;
  const row = PC_CORRES[abilityID];
  if (row && row[0] === PC_CATEGORY.PC_BASE && row[1] === PC_SUBTYPE.PC2_ATK) return '攻撃力UP';
  if (row && row[0] === PC_CATEGORY.PC_BASE && row[1] === PC_SUBTYPE.PC2_HP) return '体力UP';
  return `本能 #${abilityID}`;
}

function talentAffectsStats(abilityID) {
  const row = PC_CORRES[abilityID];
  return !!row && row[0] === PC_CATEGORY.PC_BASE && (row[1] === PC_SUBTYPE.PC2_ATK || row[1] === PC_SUBTYPE.PC2_HP);
}

// Align draft.talents to the unit's talent slots, seeding from saved levels.
function ensureDraftTalents(draft) {
  const info = talentInfoFor(draft.characterId);
  if (Array.isArray(draft.talents) && draft.talents.length === info.length) return info;
  const saved = FormationStore.getTalentLevels(draft.characterId) || [];
  const prev = Array.isArray(draft.talents) ? draft.talents : [];
  draft.talents = info.map((slot, i) => clampInt(saved[i] ?? prev[i] ?? 0, 0, Math.max(0, toInt(slot[1], 0))));
  return info;
}

function renderTalentSection(draft) {
  const info = ensureDraftTalents(draft);
  const loaded = isTalentRegistryLoaded();
  const note = info.length ? (loaded ? '攻撃/体力のみ戦闘に反映' : '読込中…') : (loaded ? 'このキャラに本能なし' : '読込中…');
  const controls = info.map((slot, i) => stepper({
    key: `talent-${i}`,
    value: draft.talents[i],
    min: 0,
    max: Math.max(0, toInt(slot[1], 0)),
    label: talentEffectLabel(slot[0]) + (talentAffectsStats(slot[0]) ? '' : '（参考）'),
    maxLabel: `MAX ${toInt(slot[1], 0)}`,
    deltas: [-5, -1, 1, 5]
  })).join('');
  return `<section class='formation-tuning-talents'><div class='formation-tuning-control-head'><strong>本能</strong><span>${esc(note)}</span></div>${controls}</section>`;
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
      ${renderTalentSection(draft)}
      ${renderOrbSection(draft)}
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
      <section class='formation-tuning-control' data-tuning-control='percent'>
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
    <footer class='formation-tuning-footer'><button type='button' class='formation-tuning-reset' data-tuning-reset='1' aria-label='100%に戻す'>リセット</button><button type='button' class='formation-tuning-save' data-tuning-save='1'>決定</button></footer>
  </div>`;
}

function primeTuningIconFromResolvedImage(editor, img) {
  const key = img?.dataset?.semanticIcon || '';
  if (!key) return false;
  for (const candidate of editor.root.querySelectorAll('img[data-semantic-icon]')) {
    if (candidate === img || candidate.dataset.semanticIcon !== key) continue;
    if (candidate.dataset.iconResolved !== '1' || !candidate.currentSrc || candidate.naturalWidth <= 0) continue;
    img.src = candidate.currentSrc;
    img.classList.remove('image-missing');
    img.dataset.iconResolved = '1';
    delete img.dataset.iconPending;
    return true;
  }
  return false;
}

function resolveTuningOverlayIcons(editor, overlay) {
  if (!editor?.root || !overlay) return;
  let provider = null;
  try { provider = getBcuAssetDatabase()?.semanticProvider || null; } catch {}
  for (const img of overlay.querySelectorAll('img[data-semantic-icon]')) {
    if (!img.dataset.semanticIcon || img.dataset.iconResolved === '1') continue;
    if (primeTuningIconFromResolvedImage(editor, img)) continue;
    if (provider && typeof editor.enqueueIcon === 'function') editor.enqueueIcon(img, provider, true);
  }
  if (provider && typeof editor.pumpIconQueue === 'function') editor.pumpIconQueue(provider);
}

// Replay the BCU "tick" pop only on the readouts whose values actually changed.
// A full panel re-render replaces every readout node, so the old approach of
// flagging the whole overlay made level, +Lv, talent and orb readouts all pop at
// once. We add the one-shot class to just the changed control's readout instead.
function flashChangedReadouts(overlay, tickKeys) {
  if (reduceMotion() || !overlay || !Array.isArray(tickKeys) || !tickKeys.length) return;
  for (const key of tickKeys) {
    if (!key) continue;
    const readout = overlay.querySelector(`[data-tuning-control='${key}'] .formation-tuning-readout`);
    if (!readout) continue;
    readout.classList.remove('is-ticking');
    void readout.offsetWidth; // restart the animation on the freshly rendered node
    readout.classList.add('is-ticking');
    setTimeout(() => readout.classList.remove('is-ticking'), 220);
  }
}

function renderTuningOverlay(editor, { tickKeys = [] } = {}) {
  const overlay = tuningOverlay(editor);
  const draft = editor.characterTuningDraft;
  if (!draft?.characterId) {
    overlay.classList.remove('is-open', 'is-opening', 'is-closing');
    delete overlay.dataset.tuningSettled;
    delete overlay.dataset.tuningCharacterId;
    overlay.innerHTML = '';
    return;
  }
  const wasOpen = overlay.classList.contains('is-open');
  const wasClosing = overlay.dataset.tuningClosing === '1';
  const previousBody = overlay.querySelector('.formation-tuning-body');
  const previousScrollTop = previousBody?.scrollTop || 0;
  const preserveBodyScroll = wasOpen && !wasClosing && overlay.dataset.tuningCharacterId === String(draft.characterId);
  delete overlay.dataset.tuningClosing;
  clearTimeout(editor.__formationTuningCloseTimer);
  overlay.classList.remove('is-closing');
  overlay.classList.add('is-open');
  overlay.innerHTML = draft.faction === 'cat' ? renderCatPanel(editor, draft) : renderDogPanel(editor, draft);
  overlay.dataset.tuningCharacterId = String(draft.characterId);
  if (preserveBodyScroll) {
    const body = overlay.querySelector('.formation-tuning-body');
    if (body) {
      body.scrollTop = previousScrollTop;
      requestAnimationFrame(() => {
        if (body.isConnected) body.scrollTop = previousScrollTop;
      });
    }
  }
  // The regression-fix patch re-pops any panel it has not seen; renders here own their motion.
  const panel = overlay.querySelector('.formation-tuning-panel');
  if (panel) panel.dataset.motionFixSeen = '1';
  resolveTuningOverlayIcons(editor, overlay);
  editor.resolveSemanticIcons?.();
  if (!wasOpen || wasClosing) {
    delete overlay.dataset.tuningSettled;
    overlay.classList.add('is-opening');
    clearTimeout(editor.__formationTuningOpenTimer);
    editor.__formationTuningOpenTimer = setTimeout(() => overlay.classList.remove('is-opening'), 220);
  } else {
    overlay.classList.remove('is-opening');
    overlay.dataset.tuningSettled = '1';
    flashChangedReadouts(overlay, tickKeys);
  }
}

function openTuningOverlay(editor, characterId, slotIndex = null) {
  const character = getCharacterById(characterId);
  if (!character) return false;
  editor.activeSlot = Number.isFinite(Number(slotIndex)) ? Number(slotIndex) : editor.activeSlot;
  editor.characterTuningDraft = createDraft(editor, characterId);
  renderTuningOverlay(editor);
  // Talent definitions load at battle boot; in the editor, fetch them on demand
  // so the 本能 section can populate, then re-render if still open for this unit.
  if (character.faction === 'cat' && (!isTalentRegistryLoaded() || !isTalentAbilityNameRegistryLoaded())) {
    const load = isTalentRegistryLoaded() ? loadBcuTalentAbilityNames() : loadBcuTalentRegistry();
    load.then(() => {
      const draft = editor.characterTuningDraft;
      if (draft?.characterId === characterId) { draft.talents = null; renderTuningOverlay(editor); }
    }).catch(() => {});
  }
  return true;
}

function closeTuningOverlay(editor) {
  const overlay = editor.root?.querySelector?.('.formation-tuning-overlay');
  editor.characterTuningDraft = null;
  if (!overlay?.classList.contains('is-open')) return renderTuningOverlay(editor);
  overlay.dataset.tuningClosing = '1';
  overlay.classList.remove('is-opening');
  overlay.classList.add('is-closing');
  clearTimeout(editor.__formationTuningCloseTimer);
  editor.__formationTuningCloseTimer = setTimeout(() => {
    if (editor.characterTuningDraft) return;
    delete overlay.dataset.tuningClosing;
    delete overlay.dataset.tuningSettled;
    delete overlay.dataset.tuningCharacterId;
    overlay.classList.remove('is-open', 'is-closing');
    overlay.innerHTML = '';
  }, reduceMotion() ? 0 : 130);
}

function stepDraft(editor, key, delta) {
  const draft = editor.characterTuningDraft;
  if (!draft) return;
  if (draft.faction === 'cat') {
    const state = resolveCatState(draft.characterId, draft);
    if (key === 'level') draft.level = clampInt((draft.level ?? state.resolved.level) + delta, 1, state.resolved.maxLevel);
    if (key === 'plusLevel') draft.plusLevel = clampInt((draft.plusLevel ?? state.resolved.plusLevel) + delta, 0, state.resolved.maxPlusLevel);
    if (key.startsWith('talent-')) {
      const info = ensureDraftTalents(draft);
      const idx = toInt(key.slice(7), -1);
      if (idx >= 0 && idx < info.length) draft.talents[idx] = clampInt((draft.talents[idx] ?? 0) + delta, 0, Math.max(0, toInt(info[idx][1], 0)));
    }
    if (key.startsWith('orb-')) {
      const m = /^orb-(\d+)-(type|trait|grade)$/.exec(key);
      if (!m) return;
      const orbs = ensureDraftOrbs(draft);
      const idx = toInt(m?.[1], -1);
      if (idx >= 0 && idx < orbs.length) {
        const field = m[2] === 'type' ? 'typeCode' : m[2] === 'trait' ? 'traitIndex' : 'grade';
        const max = m[2] === 'type' ? ORB_TYPE_OPTIONS.length - 1 : m[2] === 'trait' ? ORB_TRAIT_LABELS.length - 1 : ORB_GRADE_LABELS.length - 1;
        orbs[idx][field] = clampInt((orbs[idx][field] ?? 0) + delta, 0, max);
      }
    }
  } else if (key === 'percent') {
    draft.percent = clampInt((draft.percent ?? DOG_DEFAULT_MAGNIFICATION_PERCENT) + delta, 1, 999900);
  }
  renderTuningOverlay(editor, { tickKeys: [key] });
}

function setDraftInput(editor, key, value, { live = false } = {}) {
  const draft = editor.characterTuningDraft;
  if (!draft) return;
  // While typing, ignore transient invalid text (empty/partial) and never replace
  // the input element: a full re-render would steal focus after every keystroke.
  if (live && !Number.isFinite(Number(value))) return;
  if (draft.faction === 'cat') {
    const state = resolveCatState(draft.characterId, draft);
    if (key === 'level') draft.level = clampInt(value, 1, state.resolved.maxLevel);
    if (key === 'plusLevel') draft.plusLevel = clampInt(value, 0, state.resolved.maxPlusLevel);
    if (key.startsWith('talent-')) {
      const info = ensureDraftTalents(draft);
      const idx = toInt(key.slice(7), -1);
      if (idx >= 0 && idx < info.length) draft.talents[idx] = clampInt(value, 0, Math.max(0, toInt(info[idx][1], 0)));
    }
    if (key.startsWith('orb-')) {
      const m = /^orb-(\d+)-(type|trait|grade)$/.exec(key);
      if (!m) return;
      const orbs = ensureDraftOrbs(draft);
      const idx = toInt(m?.[1], -1);
      if (idx >= 0 && idx < orbs.length) {
        const field = m[2] === 'type' ? 'typeCode' : m[2] === 'trait' ? 'traitIndex' : 'grade';
        const max = m[2] === 'type' ? ORB_TYPE_OPTIONS.length - 1 : m[2] === 'trait' ? ORB_TRAIT_LABELS.length - 1 : ORB_GRADE_LABELS.length - 1;
        orbs[idx][field] = clampInt(value, 0, max);
      }
    }
  } else if (key === 'percent') {
    draft.percent = clampInt(value, 1, DOG_MAGNIFICATION_MAX);
  }
  if (live) updateTuningDynamic(editor);
  else renderTuningOverlay(editor, { tickKeys: [key] });
}

function updateStepperDom(overlay, key, value, min, max, meterValue) {
  const control = overlay.querySelector(`[data-tuning-control='${key}']`);
  if (!control) return;
  for (const btn of control.querySelectorAll('[data-tuning-step]')) {
    const delta = toInt(btn.dataset.delta, 0);
    btn.disabled = delta < 0 ? value <= min : value >= max;
  }
  const meter = control.querySelector('.formation-tuning-meter');
  if (meter) meter.style.setProperty('--value', String(meterValue));
}

function updateTuningDynamic(editor) {
  const overlay = editor.root?.querySelector?.('.formation-tuning-overlay.is-open');
  const draft = editor.characterTuningDraft;
  if (!overlay || !draft) return;
  const stats = overlay.querySelectorAll('.formation-tuning-summary .formation-tuning-stat b');
  if (draft.faction === 'cat') {
    const { resolved } = resolveCatState(draft.characterId, draft);
    updateStepperDom(overlay, 'level', resolved.level, 1, resolved.maxLevel, meterPercent(resolved.level - 1, resolved.maxLevel - 1));
    updateStepperDom(overlay, 'plusLevel', resolved.plusLevel, 0, resolved.maxPlusLevel, meterPercent(resolved.plusLevel, resolved.maxPlusLevel));
    if (stats[0]) stats[0].textContent = `${resolved.level}+${resolved.plusLevel}`;
    if (stats[1]) stats[1].textContent = String(resolved.effectiveLevel);
    if (stats[2]) stats[2].textContent = `x${resolved.multiplier.toFixed(2)}`;
  } else {
    const percent = clampInt(draft.percent, 1, DOG_MAGNIFICATION_MAX);
    updateStepperDom(overlay, 'percent', percent, 1, DOG_MAGNIFICATION_MAX, Math.min(100, Math.round(percent / 10)));
    if (stats[0]) stats[0].textContent = `${percent}%`;
    if (stats[1]) stats[1].textContent = `x${(percent / 100).toFixed(2)}`;
  }
}

function applyPreset(editor, preset) {
  const draft = editor.characterTuningDraft;
  if (!draft) return;
  let tickKeys = [];
  if (preset === 'cat-max' && draft.faction === 'cat') {
    const state = resolveCatState(draft.characterId, draft);
    draft.level = state.resolved.maxLevel;
    draft.plusLevel = state.resolved.maxPlusLevel;
    tickKeys = ['level', 'plusLevel'];
  } else if (preset === 'cat-default' && draft.faction === 'cat') {
    const fresh = createDraft(editor, draft.characterId);
    editor.characterTuningDraft = fresh;
    tickKeys = ['level', 'plusLevel'];
  } else if (preset?.startsWith?.('dog-') && draft.faction === 'dog') {
    draft.percent = clampInt(preset.slice(4), 1, 999900);
    tickKeys = ['percent'];
  }
  renderTuningOverlay(editor, { tickKeys });
}

function saveDraft(editor) {
  const draft = editor.characterTuningDraft;
  if (!draft) return;
  const character = getCharacterById(draft.characterId);
  if (!character) return closeTuningOverlay(editor);
  let formation;
  if (draft.faction === 'cat') {
    const state = resolveCatState(draft.characterId, draft);
    FormationStore.setCatUnitLevel(draft.characterId, { level: state.resolved.level, plusLevel: state.resolved.plusLevel, source: 'formation-tuning-overlay-cat' });
    ensureDraftTalents(draft);
    ensureDraftOrbs(draft);
    // setTalentLevels drops all-zero arrays, so this also clears talents when reset.
    FormationStore.setTalentLevels(draft.characterId, draft.talents || []);
    formation = FormationStore.setOrbEquipment(draft.characterId, (draft.orbs || []).map(draftOrbToTriple).filter(Boolean));
    const tCount = (draft.talents || []).filter((l) => l > 0).length;
    const oCount = (draft.orbs || []).filter((orb) => orbTypeOption(orb.typeCode).type != null).length;
    syncFormation(editor, formation, `${character.label || draft.characterId}: Lv${state.resolved.level}+${state.resolved.plusLevel}${tCount ? ` / 本能${tCount}` : ''}${oCount ? ` / 玉${oCount}` : ''}`);
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
    FormationStore.clearCatUnitLevel(draft.characterId);
    FormationStore.clearTalentLevels(draft.characterId);
    formation = FormationStore.clearOrbEquipment(draft.characterId);
    syncFormation(editor, formation, `${character?.label || draft.characterId}: 個別Lv/本能/本能玉解除`);
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
      const talents = FormationStore.getTalentLevels(characterId) || [];
      const orbs = FormationStore.getOrbEquipment(characterId) || [];
      if (saved) {
        const state = resolveCatState(characterId);
        label = `Lv${state.resolved.level}${state.resolved.plusLevel ? `+${state.resolved.plusLevel}` : ''}`;
      }
      if (talents.some((l) => l > 0)) label = label ? `${label}/本能` : '本能';
      if (orbs.length) label = label ? `${label}/玉${orbs.length}` : `玉${orbs.length}`;
    } else if (character.faction === 'dog') {
      const saved = FormationStore.getDogUnitMagnification(characterId);
      const percent = saved?.percent ?? DOG_DEFAULT_MAGNIFICATION_PERCENT;
      if (percent !== DOG_DEFAULT_MAGNIFICATION_PERCENT) label = `${percent}%`;
    }
    if (!label) continue;
    slot.insertAdjacentHTML('beforeend', `<b class='formation-tuning-badge'>${esc(label)}</b>`);
  }
}

function startChargeVisual(slot) {
  if (!slot || reduceMotion()) return;
  if (!slot.querySelector('.formation-slot-charge')) {
    const ring = document.createElement('i');
    ring.className = 'formation-slot-charge';
    ring.setAttribute('aria-hidden', 'true');
    slot.appendChild(ring);
  }
  slot.style.setProperty('--formation-slot-charge-ms', `${LONG_PRESS_MS}ms`);
  slot.style.setProperty('--formation-slot-charge-delay', `${LONG_PRESS_RING_DELAY_MS}ms`);
  slot.classList.remove('is-charge-fired');
  slot.classList.add('is-charging');
}

function stopChargeVisual(slot, fired = false) {
  if (!slot?.isConnected) return;
  slot.classList.remove('is-charging');
  slot.style.removeProperty('--formation-slot-charge-ms');
  slot.style.removeProperty('--formation-slot-charge-delay');
  if (fired && !reduceMotion()) {
    slot.classList.add('is-charge-fired');
    setTimeout(() => {
      slot.classList.remove('is-charge-fired');
      slot.querySelector('.formation-slot-charge')?.remove();
    }, 340);
  } else {
    slot.querySelector('.formation-slot-charge')?.remove();
  }
}

function cancelLongPress(editor) {
  const state = editor.__formationTuningLongPress;
  if (!state) return;
  clearTimeout(state.timer);
  if (!state.fired) stopChargeVisual(state.slotEl, false);
  editor.__formationTuningLongPress = null;
}

function armLongPress(editor, event) {
  const slot = event.target.closest?.('[data-slot]');
  if (!slot || !editor.root?.contains(slot)) return;
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  const slotIndex = Number(slot.dataset.slot);
  const characterId = slotCharacterId(editor, slotIndex);
  if (!characterId || !getCharacterById(characterId)) return;
  cancelLongPress(editor);
  const startX = Number(event.clientX) || 0;
  const startY = Number(event.clientY) || 0;
  const pointerId = event.pointerId;
  startChargeVisual(slot);
  editor.__formationTuningLongPress = {
    pointerId,
    slotIndex,
    characterId,
    slotEl: slot,
    startX,
    startY,
    fired: false,
    timer: setTimeout(() => {
      const state = editor.__formationTuningLongPress;
      if (!state || state.pointerId !== pointerId) return;
      state.fired = true;
      editor.__formationTuningSuppressClickUntil = Date.now() + 700;
      editor.activeSlot = slotIndex;
      editor.activePage = Math.max(0, Math.floor(slotIndex / LINEUP_COLS));
      decorateSlotBadges(editor);
      stopChargeVisual(slot, true);
      try { navigator.vibrate?.(12); } catch {}
      openTuningOverlay(editor, characterId, slotIndex);
    }, LONG_PRESS_MS)
  };
}

function moveLongPress(editor, event) {
  const state = editor.__formationTuningLongPress;
  if (!state || state.pointerId !== event.pointerId || state.fired) return;
  const dx = (Number(event.clientX) || 0) - state.startX;
  const dy = (Number(event.clientY) || 0) - state.startY;
  if (Math.hypot(dx, dy) > LONG_PRESS_MOVE_TOLERANCE_PX) cancelLongPress(editor);
}

function finishLongPress(editor, event) {
  const state = editor.__formationTuningLongPress;
  if (state?.fired && state.pointerId === event.pointerId) {
    editor.__formationTuningSuppressClickUntil = Date.now() + 700;
  }
  cancelLongPress(editor);
}

function wireLongPress(editor) {
  if (!editor?.root || editor.__formationTuningLongPressWired) return;
  editor.__formationTuningLongPressWired = true;
  editor.root.addEventListener('pointerdown', (event) => armLongPress(editor, event), true);
  editor.root.addEventListener('pointermove', (event) => moveLongPress(editor, event), true);
  editor.root.addEventListener('pointerup', (event) => finishLongPress(editor, event), true);
  editor.root.addEventListener('pointercancel', (event) => finishLongPress(editor, event), true);
  editor.root.addEventListener('contextmenu', (event) => {
    if (Date.now() <= (editor.__formationTuningSuppressClickUntil || 0) && event.target.closest?.('[data-slot]')) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);
  // Commit typed values on blur/Enter; live typing only patches numbers in place.
  editor.root.addEventListener('change', (event) => {
    const input = event.target.closest?.('[data-tuning-input]');
    if (!input || !editor.root.contains(input) || !editor.characterTuningDraft) return;
    setDraftInput(editor, input.dataset.tuningInput, input.value);
  }, true);
  editor.root.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    const input = event.target.closest?.('[data-tuning-input]');
    if (!input || !editor.root.contains(input)) return;
    event.preventDefault();
    input.blur();
  }, true);
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
      catTalentLevels: character?.faction === 'cat' ? FormationStore.getTalentLevels(characterId) : null,
      catOrbEquipment: character?.faction === 'cat' ? FormationStore.getOrbEquipment(characterId) : null,
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
    wireLongPress(this);
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
      setDraftInput(this, tuningInput.dataset.tuningInput, tuningInput.value, { live: true });
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
      press(close || save || reset || step || preset);
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
      if (Date.now() <= (this.__formationTuningSuppressClickUntil || 0)) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
    }
    return originalOnClick.call(this, event);
  };
}

installFormationEditorBcuUnitLevelPatch();
