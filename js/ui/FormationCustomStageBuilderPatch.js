// Custom-stage builder UI.
//
// Extends the existing "カスタムステージ" screen (owned by FormationCustomStageBattlePatch, which keeps
// the ステージ同士バトル panel) with a "自作ステージ" section and a full builder screen, WITHOUT altering
// the existing panel's behaviour. All prototype methods are wrapped additively; the existing BCU
// stage-vs-stage flow, HP options, and stage picking are untouched.
//
// A custom stage stores only references to existing BCU assets. Adding one to a side writes an
// encoded `custom:<id>` entry into the same enemyStageIds/playerStageIds arrays the battle runtime
// already consumes (see CustomStageAdapter + BattleSceneCustomStageBattlePatch), so a custom stage
// becomes ordinary "stage material" mixed with BCU stages.
//
// NOTE: this is a DOM/UX layer; it is intentionally defensive (degrades to id inputs when the BCU
// asset database is not present) so it never crashes the editor. Visual/mobile/audio acceptance is
// verified in-browser, not by the node test suite (which covers the data/runtime layer).
import { FormationEditor } from './FormationEditor.js';
import { popIn, press } from './UiMotion.mjs';
import {
  createCustomStage, normalizeCustomStage, createSpawn,
  secondsToFrames, framesToSeconds, encodeStageRef
} from '../custom-stage/CustomStageSchema.js';
import {
  readCustomStages, getCustomStage, saveCustomStage, deleteCustomStage,
  duplicateCustomStage, createAndSaveCustomStage
} from '../custom-stage/CustomStageStore.js';
import { validateCustomStage } from '../custom-stage/CustomStageValidator.js';
import {
  readBattleConfig, writeBattleConfig
} from '../custom-stage/CustomStageBattleStore.js';
import { musicCatalog } from '../audio/MusicCatalog.js';
import { resolveThumb, thumbCacheKey, evictAsset, musicPlayable } from '../custom-stage/CustomStageAssetCatalog.js';
import { togglePreview, stopPreview, isPreviewing, onPreviewChange, previewingId } from '../custom-stage/CustomStagePreviewAudio.js';

const PATCH_FLAG = Symbol.for('wanko-formation-custom-stage-builder.v1');
const BATTLE_LEVEL = 'custom-stage-battle';
const BUILDER_LEVEL = 'custom-stage-builder';
const STYLE_ID = 'formation-custom-stage-builder-style';
const DRAFT_KEY = 'wanko.customStageDraft.v1';
const RESTORE_SCROLL_FRAMES = 2;

function safeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch]));
}

// 候補が数百件（敵は 778 体）あるピッカーを一度に全部 DOM 化すると、読み込み後もノード数だけで
// 恒常的に重くなる。初回はこの枚数だけ描画し、スクロールで下端に近づくたびに追加ロードする
// （全件はスクロール・検索で到達可能）。
const PICKER_WINDOW = 60;
function renderCardsSlice(reg, items) {
  if (reg.music) return items.map((o) => renderMusicCard(reg.field, reg.value, o)).join('');
  return items.map((o) => renderPickerCard(reg.field, reg.value, o, { kind: reg.kind })).join('');
}

function restoreScrollTop(scroller, scrollTop, frames = RESTORE_SCROLL_FRAMES) {
  if (!scroller || !Number.isFinite(scrollTop)) return;
  const run = (remaining) => {
    if (!scroller.isConnected) return;
    scroller.scrollTop = scrollTop;
    if (remaining > 0) requestAnimationFrame(() => run(remaining - 1));
  };
  requestAnimationFrame(() => run(frames));
}

function bcuDb() {
  try { return globalThis.__BCU_DB__ || null; } catch { return null; }
}

// ---- asset catalogs (degrade gracefully when the DB isn't loaded) -----------
function backgroundOptions() {
  try {
    return (bcuDb()?.backgrounds?.list?.() || []).map((b) => ({
      id: b.id,
      label: b.name?.value || `背景 ${String(b.id).padStart(3, '0')}`,
      meta: `BG ${String(b.id).padStart(3, '0')}`
    }));
  }
  catch { return []; }
}
function castleOptions() {
  try {
    const list = bcuDb()?.castles?.enemy?.list?.() || bcuDb()?.castles?.list?.() || [];
    return list.map((c) => {
      const id = c.numericId ?? c.id;
      return {
        id,
        label: c.name?.value || `敵城 ${String(id).padStart(3, '0')}`,
        meta: `Castle ${String(id).padStart(3, '0')}`
      };
    });
  }
  catch { return []; }
}
function enemyOptions() {
  try {
    const db = bcuDb();
    const list = db?.enemies?.list?.() || [];
    return list.map((e) => {
      const id = e.id ?? e.numericId;
      return { id, label: enemyName(id), meta: `Enemy ${String(id).padStart(3, '0')}` };
    });
  } catch { return []; }
}
function enemyName(id) {
  try {
    const db = bcuDb();
    const n = db?.names?.enemy?.(id) || db?.names?.unitForm?.(id, 0, db?.locale);
    return (n && n.value) ? n.value : `敵 ${String(id).padStart(3, '0')}`;
  } catch { return `敵 ${String(id).padStart(3, '0')}`; }
}
function musicOptions() {
  try {
    const manifest = musicCatalog.manifest || {};
    const min = Number.isFinite(Number(manifest.minId)) ? Math.trunc(Number(manifest.minId)) : 0;
    const max = Number.isFinite(Number(manifest.maxId)) ? Math.trunc(Number(manifest.maxId)) : 190;
    const pad = manifest.pad || 3;
    return Array.from({ length: Math.max(0, max - min + 1) }, (_, i) => min + i)
      // Only tracks the catalog can actually resolve to a file reach the picker (要件: 再生不能な曲を出さない).
      .filter((id) => musicPlayable(id))
      .map((id) => ({ id, label: `BGM ${String(id).padStart(pad, '0')}`, meta: musicCatalog.fileName(id) || '' }));
  } catch { return []; }
}
function musicLabel(id) {
  if (id == null || id === '') return null;
  try { const pad = musicCatalog.manifest?.pad || 3; return `BGM ${String(id).padStart(pad, '0')}`; }
  catch { return `BGM ${id}`; }
}

function assetResolvers() {
  const bgSet = new Set(backgroundOptions().map((o) => String(o.id)));
  const castleSet = new Set(castleOptions().map((o) => String(o.id)));
  const enemySet = new Set(enemyOptions().map((o) => String(o.id)));
  return {
    // When a catalog is empty (DB not loaded), fail open so validation is not falsely blocked.
    background: (id) => bgSet.size === 0 || bgSet.has(String(id)),
    castle: (id) => castleSet.size === 0 || castleSet.has(String(id)),
    enemy: (id) => enemySet.size === 0 || enemySet.has(String(id)),
    music: () => true
  };
}

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
html body.nyanko-ui-polish .formation-custom-builder-section{grid-column:1/-1;margin-top:10px;border:3px solid #000;border-radius:12px;background:#fff7dd;box-shadow:0 4px 0 #000;padding:12px;display:flex;flex-direction:column;gap:10px}
html body.nyanko-ui-polish .formation-custom-builder-section>header{display:flex;align-items:center;justify-content:space-between;gap:10px}
html body.nyanko-ui-polish .formation-custom-builder-section h3{font-weight:1000;color:#120700;margin:0}
html body.nyanko-ui-polish .formation-custom-builder-actions{display:flex;flex-wrap:wrap;gap:8px}
html body.nyanko-ui-polish .formation-custom-builder button{min-height:40px;padding:0 14px;border:3px solid #000;border-radius:999px;background:linear-gradient(180deg,#ffca45,#ffab21 60%,#f7930f);color:#120700;-webkit-text-fill-color:#120700;font-weight:1000;box-shadow:0 3px 0 #000;cursor:pointer}
html body.nyanko-ui-polish .formation-custom-builder button.is-primary{background:linear-gradient(180deg,#ff6a19,#f15212 52%,#e14008);color:#fff;-webkit-text-fill-color:#fff}
html body.nyanko-ui-polish .formation-custom-builder button.is-ghost{background:#fff;color:#5b320c;-webkit-text-fill-color:#5b320c}
html body.nyanko-ui-polish .formation-custom-stage-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
html body.nyanko-ui-polish .formation-custom-stage-tile{border:3px solid #000;border-radius:12px;background:#fff;box-shadow:0 3px 0 #000;padding:10px;display:flex;flex-direction:column;gap:6px}
html body.nyanko-ui-polish .formation-custom-stage-tile strong{font-weight:1000;color:#120700}
html body.nyanko-ui-polish .formation-custom-stage-tile .meta{font-size:.76rem;font-weight:900;color:#7a4a12}
html body.nyanko-ui-polish .formation-custom-stage-tile .row{display:flex;flex-wrap:wrap;gap:6px}
html body.nyanko-ui-polish .formation-custom-stage-tile .row button{min-height:34px;padding:0 10px;font-size:.78rem}
html body.nyanko-ui-polish .formation-custom-builder-screen{grid-column:1/-1;display:flex;flex-direction:column;gap:12px}
html body.nyanko-ui-polish .formation-custom-builder-tabs{display:flex;gap:8px;flex-wrap:wrap}
html body.nyanko-ui-polish .formation-custom-builder-tabs button.is-active{background:linear-gradient(180deg,#ff6a19,#f15212 52%,#e14008);color:#fff;-webkit-text-fill-color:#fff}
html body.nyanko-ui-polish .formation-custom-field{display:flex;flex-direction:column;gap:6px;border:3px solid #000;border-radius:10px;background:#fff;box-shadow:0 3px 0 #000;padding:10px}
html body.nyanko-ui-polish .formation-custom-field>label{font-weight:1000;color:#120700}
html body.nyanko-ui-polish .formation-custom-field .hint{font-size:.74rem;font-weight:800;color:#7a4a12}
html body.nyanko-ui-polish .formation-custom-stepper{display:flex;align-items:stretch;gap:6px;width:100%;min-width:0;max-width:100%}
html body.nyanko-ui-polish .formation-custom-stepper button{flex:0 0 44px!important;width:44px!important;min-width:44px!important;height:44px;min-height:44px!important;padding:0!important;display:inline-flex;align-items:center;justify-content:center;font-size:1.25rem;line-height:1}
html body.nyanko-ui-polish .formation-custom-stepper input{flex:1 1 auto;width:auto!important;min-width:0;min-height:44px;text-align:center;border:3px solid #000;border-radius:10px;font-weight:1000;font-size:1.05rem;background:#fffef8}
html body.nyanko-ui-polish .formation-custom-stepper .hint{flex:0 0 auto;align-self:center;white-space:nowrap}
html body.nyanko-ui-polish .formation-custom-stepper input{-moz-appearance:textfield;appearance:textfield}
html body.nyanko-ui-polish .formation-custom-stepper input::-webkit-outer-spin-button,html body.nyanko-ui-polish .formation-custom-stepper input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
html body.nyanko-ui-polish .formation-custom-input{min-height:40px;border:3px solid #000;border-radius:8px;padding:0 10px;font-weight:900}
html body.nyanko-ui-polish .formation-custom-side-badge{display:inline-block;min-width:38px;text-align:center;padding:2px 6px;border:2px solid #000;border-radius:6px;font-size:.7rem;font-weight:1000;margin-right:6px}
html body.nyanko-ui-polish .formation-custom-side-badge.bcu{background:#bfe3ff}
html body.nyanko-ui-polish .formation-custom-side-badge.custom{background:#ffe08a}
html body.nyanko-ui-polish .formation-custom-alert{border:3px solid #b00;border-radius:10px;background:#ffe3e3;color:#7a0000;font-weight:1000;padding:8px 10px}
html body.nyanko-ui-polish .formation-custom-warn{border:3px solid #cc8a00;border-radius:10px;background:#fff2cf;color:#7a5200;font-weight:900;padding:8px 10px}
html body.nyanko-ui-polish .formation-custom-status{font-weight:1000}
html body.nyanko-ui-polish .formation-custom-status.dirty{color:#b06a00}
html body.nyanko-ui-polish .formation-custom-status.saved{color:#2f8a00}
html body.nyanko-ui-polish .formation-custom-builder-screen{height:100%;min-height:0;overflow:hidden}
html body.nyanko-ui-polish .formation-custom-builder-screen>header{position:sticky;top:0;z-index:2;padding:9px;border:3px solid #000;border-radius:10px;background:linear-gradient(180deg,#fff9d8,#f7d96b);box-shadow:0 3px 0 #000;display:flex;align-items:center;gap:8px}
html body.nyanko-ui-polish .formation-custom-builder-screen>header>button{flex:0 0 auto}
html body.nyanko-ui-polish .formation-custom-builder-heading{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;align-items:center;gap:1px}
html body.nyanko-ui-polish .formation-custom-builder-name{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:1000;color:#120700;-webkit-text-fill-color:#120700;font-size:.95rem;line-height:1.1}
html body.nyanko-ui-polish .formation-custom-builder-body{flex:1 1 auto;display:grid;grid-template-columns:minmax(0,1fr);gap:10px;min-height:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding:0 4px 4px 0}
html body.nyanko-ui-polish .formation-custom-builder-screen>.formation-custom-builder-actions{flex:0 0 auto;display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;padding:8px;border:3px solid #000;border-radius:10px;background:#fff8d6;box-shadow:0 3px 0 #000}
html body.nyanko-ui-polish .formation-custom-builder-screen>.formation-custom-builder-actions button{min-width:0;min-height:34px!important;padding:0 8px!important;font-size:.76rem!important;white-space:normal;line-height:1.05}
html body.nyanko-ui-polish .formation-custom-builder-tabs{position:sticky;top:62px;z-index:2;display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr));padding:7px;border:3px solid #000;border-radius:10px;background:#17100b;box-shadow:0 3px 0 #000}
html body.nyanko-ui-polish .formation-custom-builder-tabs button{min-height:36px;border-color:#000;background:#fff8d6;color:#1b1005;-webkit-text-fill-color:#1b1005;box-shadow:0 2px 0 #000}
html body.nyanko-ui-polish .formation-custom-builder-tabs button.is-active{background:linear-gradient(180deg,#27a9e1,#127cc6 60%,#0b5598);color:#fff;-webkit-text-fill-color:#fff}
html body.nyanko-ui-polish .formation-custom-field{border-radius:8px;background:linear-gradient(180deg,#fffdf4,#fff1bd);box-shadow:0 3px 0 #000,inset 0 1px 0 rgba(255,255,255,.8)}
html body.nyanko-ui-polish .formation-custom-field.is-spawn-row{gap:7px;border-left-width:7px;border-left-color:#19a974}
html body.nyanko-ui-polish .formation-custom-field.is-spawn-row.is-open{border-left-color:#127cc6;box-shadow:0 3px 0 #000,0 0 0 3px rgba(18,124,198,.35)}
html body.nyanko-ui-polish .formation-custom-spawn-head{display:flex;align-items:center;gap:8px;min-width:0;cursor:pointer;user-select:none}
html body.nyanko-ui-polish .formation-custom-spawn-head b{display:inline-flex;min-width:28px;height:26px;align-items:center;justify-content:center;border:2px solid #000;border-radius:999px;background:#17100b;color:#fff;-webkit-text-fill-color:#fff;font-size:.75rem;flex:0 0 auto}
html body.nyanko-ui-polish .formation-custom-spawn-name{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:1000;color:#120700;-webkit-text-fill-color:#120700}
html body.nyanko-ui-polish .formation-custom-spawn-name em{font-style:normal;font-size:.68rem;padding:1px 6px;margin-left:4px;border:2px solid #000;border-radius:999px;background:#ff6a19;color:#fff;-webkit-text-fill-color:#fff}
html body.nyanko-ui-polish .formation-custom-spawn-caret{flex:0 0 auto;font-weight:1000;color:#67430e;-webkit-text-fill-color:#67430e}
html body.nyanko-ui-polish .formation-custom-spawn-summary{font-size:.74rem;font-weight:900;color:#54310f;-webkit-text-fill-color:#54310f}
html body.nyanko-ui-polish .formation-custom-spawn-ctrl{display:flex;flex-wrap:wrap;gap:6px}
html body.nyanko-ui-polish .formation-custom-spawn-ctrl button{flex:0 0 auto!important;width:auto!important;min-width:64px;min-height:36px;padding:0 14px;font-size:.78rem}
html body.nyanko-ui-polish .formation-custom-field .row{display:flex;flex-wrap:wrap;gap:6px}
html body.nyanko-ui-polish .formation-custom-field .row button{flex:0 0 auto!important;width:auto!important;min-width:64px}
html body.nyanko-ui-polish .formation-custom-field.is-condition-open{background:linear-gradient(180deg,#f2fbff,#d8f1ff);border-left-color:#127cc6}
html body.nyanko-ui-polish .formation-custom-spawn-title{display:flex;align-items:center;gap:8px;min-width:0}
html body.nyanko-ui-polish .formation-custom-spawn-title b{display:inline-flex;min-width:30px;height:26px;align-items:center;justify-content:center;border:2px solid #000;border-radius:999px;background:#17100b;color:#fff;-webkit-text-fill-color:#fff;font-size:.75rem}
html body.nyanko-ui-polish .formation-custom-chip-row{display:flex;flex-wrap:wrap;gap:6px}
html body.nyanko-ui-polish .formation-custom-chip{display:inline-flex;align-items:center;min-height:24px;padding:1px 8px;border:2px solid #000;border-radius:999px;background:#d8f1ff;color:#102236;-webkit-text-fill-color:#102236;font-size:.72rem;font-weight:1000}
html body.nyanko-ui-polish .formation-custom-row-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;align-items:end}
html body.nyanko-ui-polish .formation-custom-mini-control{display:grid;gap:4px;min-width:0}
html body.nyanko-ui-polish .formation-custom-mini-control>span:first-child{font-size:.72rem;font-weight:1000;color:#54310f;-webkit-text-fill-color:#54310f}
html body.nyanko-ui-polish .formation-custom-row-grid .formation-custom-stepper input{background:#fffef8}
html body.nyanko-ui-polish .formation-custom-condition-panel{display:grid;gap:8px;padding:9px;border:3px solid #000;border-radius:8px;background:#fff;box-shadow:inset 0 2px 0 rgba(0,0,0,.08)}
html body.nyanko-ui-polish .formation-custom-condition-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px}
html body.nyanko-ui-polish .formation-custom-condition-card{display:grid;gap:6px;padding:8px;border:2px solid #000;border-radius:8px;background:#f6fbff}
html body.nyanko-ui-polish .formation-custom-condition-card label{font-weight:1000;color:#120700;-webkit-text-fill-color:#120700}
html body.nyanko-ui-polish .formation-custom-picker{display:grid;gap:8px}
html body.nyanko-ui-polish .formation-custom-picker-head{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center}
html body.nyanko-ui-polish .formation-custom-picker-search{min-height:36px;border:3px solid #000;border-radius:8px;padding:0 10px;background:#fff;color:#120700;-webkit-text-fill-color:#120700;font-weight:900;min-width:0}
html body.nyanko-ui-polish .formation-custom-picker-count{font-size:.72rem;font-weight:1000;color:#67430e;-webkit-text-fill-color:#67430e;white-space:nowrap}
html body.nyanko-ui-polish .formation-custom-picker-scroll{max-height:236px;overflow:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;border:2px solid #000;border-radius:8px;background:#0d1620;padding:6px}
html body.nyanko-ui-polish .formation-custom-picker-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(132px,1fr));gap:7px}
html body.nyanko-ui-polish .formation-custom-picker-grid.is-compact{grid-template-columns:repeat(auto-fit,minmax(116px,1fr))}
html body.nyanko-ui-polish .formation-custom-picker-card{min-height:58px!important;height:auto;padding:7px 8px!important;border-radius:8px!important;background:linear-gradient(180deg,#fff,#e9f7ff)!important;color:#120700!important;-webkit-text-fill-color:#120700!important;text-align:left;display:grid!important;align-content:center;gap:2px;box-shadow:0 2px 0 #000!important}
/* 画面外カードのレイアウト/描画をスキップ（長い候補リストの初回描画・スクロールを軽くする） */
html body.nyanko-ui-polish .formation-custom-picker-card{content-visibility:auto;contain-intrinsic-size:auto 58px}
html body.nyanko-ui-polish .formation-custom-music-card{content-visibility:auto;contain-intrinsic-size:auto 52px}
html body.nyanko-ui-polish .formation-custom-picker-card.is-selected{background:linear-gradient(180deg,#28c785,#158a5a)!important;color:#fff!important;-webkit-text-fill-color:#fff!important}
html body.nyanko-ui-polish .formation-custom-picker-card.is-empty{background:#fff7df!important}
html body.nyanko-ui-polish .formation-custom-picker-card strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.78rem;line-height:1.05}
html body.nyanko-ui-polish .formation-custom-picker-card small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.64rem;font-weight:1000;opacity:.82}
html body.nyanko-ui-polish .formation-custom-preview{display:grid;gap:10px}
html body.nyanko-ui-polish .formation-custom-preview-hero{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;padding:12px;border:3px solid #000;border-radius:8px;background:linear-gradient(135deg,#142031,#214d64 52%,#1a6b59);color:#fff;-webkit-text-fill-color:#fff;box-shadow:0 3px 0 #000}
html body.nyanko-ui-polish .formation-custom-preview-hero strong{font-size:1.05rem}
html body.nyanko-ui-polish .formation-custom-preview-hero span{font-size:.78rem;font-weight:900;color:#e8fff8;-webkit-text-fill-color:#e8fff8}
html body.nyanko-ui-polish .formation-custom-preview-pill{display:inline-flex;align-items:center;justify-content:center;min-height:34px;padding:0 12px;border:2px solid #000;border-radius:999px;background:#ffe25a;color:#160800;-webkit-text-fill-color:#160800;font-weight:1000}
html body.nyanko-ui-polish .formation-custom-preview-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(126px,1fr));gap:8px}
html body.nyanko-ui-polish .formation-custom-preview-stat{padding:9px;border:3px solid #000;border-radius:8px;background:#fff;box-shadow:0 3px 0 #000}
html body.nyanko-ui-polish .formation-custom-preview-stat b{display:block;font-size:1rem;color:#111;-webkit-text-fill-color:#111}
html body.nyanko-ui-polish .formation-custom-preview-stat small{display:block;margin-top:2px;font-size:.68rem;font-weight:900;color:#6b4b16;-webkit-text-fill-color:#6b4b16}
html body.nyanko-ui-polish .formation-custom-timeline{display:grid;gap:6px;padding:9px;border:3px solid #000;border-radius:8px;background:#111}
html body.nyanko-ui-polish .formation-custom-timeline-row{display:grid;grid-template-columns:72px minmax(0,1fr) minmax(120px,.25fr);gap:8px;align-items:center;color:#fff;-webkit-text-fill-color:#fff;font-size:.72rem;font-weight:900}
html body.nyanko-ui-polish .formation-custom-timeline-track{height:12px;border:2px solid #000;border-radius:999px;background:#33291a;overflow:hidden}
html body.nyanko-ui-polish .formation-custom-timeline-track span{display:block;height:100%;width:calc(var(--pos,0)*1%);min-width:5px;background:linear-gradient(90deg,#19a974,#27a9e1)}
html body.nyanko-ui-polish .formation-custom-picker-card{grid-template-rows:auto auto auto}
html body.nyanko-ui-polish .formation-custom-thumb{display:block;width:100%;height:46px;border:2px solid #000;border-radius:6px;object-fit:cover;background:#0d1620;margin-bottom:3px}
html body.nyanko-ui-polish .formation-custom-thumb.kind-castle,html body.nyanko-ui-polish .formation-custom-thumb.kind-enemy{object-fit:contain;background:#11212e}
html body.nyanko-ui-polish .formation-custom-thumb.kind-enemy{height:52px}
html body.nyanko-ui-polish .formation-custom-thumb.is-missing{background:repeating-linear-gradient(45deg,#26333f,#26333f 6px,#1b2632 6px,#1b2632 12px)}
html body.nyanko-ui-polish .formation-custom-picker-card.is-selected .formation-custom-thumb{border-color:#0a4d31}
html body.nyanko-ui-polish .formation-custom-thumb.formation-custom-spawn-icon{width:34px;height:34px;margin:0;flex:0 0 auto;border:2px solid #000;border-radius:8px;object-fit:contain;background:#11212e}
html body.nyanko-ui-polish .formation-custom-thumb.formation-custom-spawn-icon.is-missing{background:repeating-linear-gradient(45deg,#26333f,#26333f 5px,#1b2632 5px,#1b2632 10px)}
html body.nyanko-ui-polish .formation-custom-field-preview{position:relative;border:3px solid #000;border-radius:10px;overflow:hidden;box-shadow:0 3px 0 #000;background:#0d1620;aspect-ratio:16/6;min-height:120px}
html body.nyanko-ui-polish .formation-custom-field-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
html body.nyanko-ui-polish .formation-custom-field-bg.is-missing{background:repeating-linear-gradient(45deg,#1c2a36,#1c2a36 10px,#132029 10px,#132029 20px)}
html body.nyanko-ui-polish .formation-custom-field-castle{position:absolute;bottom:20px;height:100%;max-height:144px;object-fit:contain;filter:drop-shadow(0 2px 2px rgba(0,0,0,.5))}
html body.nyanko-ui-polish .formation-custom-field-castle.pcastle{right:22px}
html body.nyanko-ui-polish .formation-custom-field-castle.ecastle{left:22px}
html body.nyanko-ui-polish .formation-custom-field-castle.is-missing{display:none}
html body.nyanko-ui-polish .formation-custom-field-empty{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#9fb4c4;-webkit-text-fill-color:#9fb4c4;font-weight:1000;font-size:.8rem;text-align:center;padding:8px}
html body.nyanko-ui-polish .formation-custom-music-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:7px}
html body.nyanko-ui-polish .formation-custom-music-card{display:grid;grid-template-columns:auto minmax(0,1fr);gap:6px;align-items:stretch;padding:5px;border:2px solid #000;border-radius:8px;background:#fffef6;box-shadow:0 2px 0 #000}
html body.nyanko-ui-polish .formation-custom-music-card.is-selected{background:linear-gradient(180deg,#28c785,#158a5a);color:#fff;-webkit-text-fill-color:#fff}
html body.nyanko-ui-polish .formation-custom-music-card.is-playing{outline:3px solid #27a9e1;outline-offset:1px}
html body.nyanko-ui-polish .formation-custom-music-play{min-width:40px!important;min-height:40px!important;padding:0!important;font-size:1rem!important;background:linear-gradient(180deg,#27a9e1,#127cc6 60%,#0b5598)!important;color:#fff!important;-webkit-text-fill-color:#fff!important}
html body.nyanko-ui-polish .formation-custom-music-play.is-playing{background:linear-gradient(180deg,#ff6a19,#e14008)!important}
html body.nyanko-ui-polish .formation-custom-music-pick{display:grid!important;align-content:center;text-align:left;min-height:40px!important;padding:4px 8px!important;background:transparent!important;box-shadow:none!important;border:0!important;border-radius:6px!important;color:inherit!important;-webkit-text-fill-color:currentColor!important}
html body.nyanko-ui-polish .formation-custom-music-pick strong{display:block;font-size:.8rem;line-height:1.05}
html body.nyanko-ui-polish .formation-custom-music-pick small{display:block;font-size:.64rem;font-weight:1000;opacity:.8}
html body.nyanko-ui-polish .formation-custom-spawn-caret.edit{font-size:1rem}
html body.nyanko-ui-polish .formation-custom-spawn-modal{position:fixed;inset:0;z-index:70;display:flex;align-items:center;justify-content:center;padding:16px}
html body.nyanko-ui-polish .formation-custom-spawn-modal-backdrop{position:absolute;inset:0;background:rgba(6,3,0,.58)}
html body.nyanko-ui-polish .formation-custom-spawn-modal-card{position:relative;z-index:1;display:flex;flex-direction:column;width:min(560px,100%);max-height:min(88vh,780px);border:3px solid #000;border-radius:16px;background:linear-gradient(180deg,#fffdf6,#fff1c6);box-shadow:0 8px 0 #000,0 20px 44px rgba(0,0,0,.45);overflow:hidden}
html body.nyanko-ui-polish .formation-custom-spawn-modal-head{flex:0 0 auto;display:flex;align-items:center;gap:10px;padding:11px 12px;border-bottom:3px solid #000;background:linear-gradient(180deg,#2bb0e6,#0b5598)}
html body.nyanko-ui-polish .formation-custom-modal-icon{width:46px!important;height:46px!important;margin:0!important;flex:0 0 auto;border:2px solid #000;border-radius:11px;background:#0e1d29}
html body.nyanko-ui-polish span.formation-custom-modal-icon{display:block}
html body.nyanko-ui-polish .formation-custom-spawn-modal-title{flex:1 1 auto;min-width:0;display:grid;gap:1px}
html body.nyanko-ui-polish .formation-custom-spawn-modal-title strong{font-size:1rem;color:#fff;-webkit-text-fill-color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
html body.nyanko-ui-polish .formation-custom-spawn-modal-title small{font-size:.72rem;font-weight:1000;color:#d7f1ff;-webkit-text-fill-color:#d7f1ff}
html body.nyanko-ui-polish .formation-custom-spawn-modal-x{min-width:42px!important;width:42px;min-height:42px!important;padding:0!important;flex:0 0 auto;border-radius:50%!important;font-size:1.15rem!important;background:#fff!important;color:#0b5598!important;-webkit-text-fill-color:#0b5598!important}
html body.nyanko-ui-polish .formation-custom-spawn-modal-body{flex:1 1 auto;min-height:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding:12px}
html body.nyanko-ui-polish .formation-custom-spawn-modal-foot{flex:0 0 auto;display:grid;grid-template-columns:1fr;gap:8px;padding:10px 12px;border-top:3px solid #000;background:#fff7d0}
html body.nyanko-ui-polish .formation-custom-edit{display:grid;grid-template-columns:minmax(0,1fr);gap:12px}
html body.nyanko-ui-polish .formation-custom-edit-section{display:grid;gap:10px;padding:12px;border:2px solid #000;border-radius:13px;background:#fff;box-shadow:0 3px 0 rgba(0,0,0,.13)}
html body.nyanko-ui-polish .formation-custom-edit-section>h4{margin:0;display:flex;align-items:center;gap:7px;font-size:.82rem;font-weight:1000;color:#0b5598;-webkit-text-fill-color:#0b5598}
html body.nyanko-ui-polish .formation-custom-edit-section>h4::before{content:'';flex:0 0 auto;width:7px;height:16px;border-radius:3px;background:linear-gradient(180deg,#2bb0e6,#0b5598)}
html body.nyanko-ui-polish .formation-custom-stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(148px,1fr));gap:9px}
html body.nyanko-ui-polish .formation-custom-stat{display:grid;gap:6px;padding:9px;border:2px solid #000;border-radius:11px;background:linear-gradient(180deg,#fffef8,#fff1c4);box-shadow:inset 0 2px 0 rgba(255,255,255,.75)}
html body.nyanko-ui-polish .formation-custom-stat>.lbl{display:flex;align-items:baseline;gap:4px;font-size:.72rem;font-weight:1000;color:#54310f;-webkit-text-fill-color:#54310f}
html body.nyanko-ui-polish .formation-custom-stat>.lbl em{font-style:normal;font-size:.64rem;opacity:.72}
html body.nyanko-ui-polish .formation-custom-stat .formation-custom-stepper{display:grid;grid-template-columns:38px minmax(5.2ch,1fr) 38px auto;gap:5px;align-items:stretch}
html body.nyanko-ui-polish .formation-custom-stat .formation-custom-stepper button{width:38px!important;min-width:38px!important;height:40px;min-height:40px!important;font-size:1.02rem}
html body.nyanko-ui-polish .formation-custom-stat .formation-custom-stepper input{font-size:1rem;line-height:1;min-width:0;font-variant-numeric:tabular-nums}
html body.nyanko-ui-polish .formation-custom-switch{position:relative;display:flex;align-items:center;gap:11px;min-height:46px;padding:6px 12px;border:2px solid #000;border-radius:11px;background:linear-gradient(180deg,#fbfdff,#eef6fb);font-weight:1000;color:#120700;-webkit-text-fill-color:#120700;cursor:pointer}
html body.nyanko-ui-polish .formation-custom-switch input{position:absolute;opacity:0;width:1px;height:1px;pointer-events:none}
html body.nyanko-ui-polish .formation-custom-switch .track{box-sizing:border-box;position:relative;flex:0 0 auto;width:48px;height:27px;border:2px solid #000;border-radius:999px;background:#c4ced6;transition:background .16s}
html body.nyanko-ui-polish .formation-custom-switch .track::after{box-sizing:border-box;content:'';position:absolute;top:50%;left:3px;width:21px;height:21px;border:2px solid #000;border-radius:50%;background:#fff;transform:translateY(-50%);transition:transform .16s}
html body.nyanko-ui-polish .formation-custom-switch input:checked+.track{background:linear-gradient(180deg,#2fce8a,#158a5a)}
html body.nyanko-ui-polish .formation-custom-switch input:checked+.track::after{transform:translate(21px,-50%)}
html body.nyanko-ui-polish .formation-custom-switch.is-boss input:checked+.track{background:linear-gradient(180deg,#ff7a24,#e14008)}
html body.nyanko-ui-polish .formation-custom-switch-label{flex:1 1 auto;min-width:0;display:grid;gap:1px}
html body.nyanko-ui-polish .formation-custom-switch-sub{font-size:.66rem;font-weight:900;color:#7a4a12;-webkit-text-fill-color:#7a4a12}
html body.nyanko-ui-polish .formation-custom-line{display:grid;gap:5px;min-width:0}
html body.nyanko-ui-polish .formation-custom-line>.lbl{font-size:.78rem;font-weight:1000;color:#54310f;-webkit-text-fill-color:#54310f}
html body.nyanko-ui-polish .formation-custom-builder button.is-danger{background:linear-gradient(180deg,#ff7264,#e5372a 60%,#c31d12);color:#fff;-webkit-text-fill-color:#fff}
html body.nyanko-ui-polish .formation-custom-stage-tile{gap:8px}
html body.nyanko-ui-polish .formation-custom-stage-tile .tile-main{display:grid;gap:5px;padding:6px;margin:-4px -4px 0;border-radius:10px;cursor:pointer;position:relative;-webkit-tap-highlight-color:transparent}
html body.nyanko-ui-polish .formation-custom-stage-tile .tile-main:hover{background:#fff4c9}
html body.nyanko-ui-polish .formation-custom-stage-tile .tile-main:active{transform:translateY(1px)}
html body.nyanko-ui-polish .formation-custom-stage-tile .tile-main strong{padding-right:52px}
html body.nyanko-ui-polish .formation-custom-stage-tile .tile-edit-hint{position:absolute;top:4px;right:4px;padding:1px 8px;border:2px solid #0b5598;border-radius:999px;background:#e6f3ff;font-size:.66rem;font-weight:1000;color:#0b5598;-webkit-text-fill-color:#0b5598}
html body.nyanko-ui-polish .formation-custom-stage-tile .row.is-deploy{display:grid;grid-template-columns:1fr 1fr;gap:6px}
html body.nyanko-ui-polish .formation-custom-stage-tile .row.is-deploy button,
html body.nyanko-ui-polish .formation-custom-builder-screen>.formation-custom-builder-actions [data-custom-builder-add-enemy-current],
html body.nyanko-ui-polish .formation-custom-builder-screen>.formation-custom-builder-actions [data-custom-builder-add-player-current]{width:100%;border-radius:10px!important;border-width:2px!important;min-height:38px!important;font-size:.78rem!important;line-height:1.05!important;box-shadow:0 2px 0 #092b46,inset 0 1px 0 rgba(255,255,255,.55)!important}
html body.nyanko-ui-polish .formation-custom-stage-tile .row.is-deploy [data-custom-builder-add-enemy],
html body.nyanko-ui-polish .formation-custom-builder-screen>.formation-custom-builder-actions [data-custom-builder-add-enemy-current]{background:linear-gradient(180deg,#2fc4f3,#127cc6 62%,#0b5598)!important;color:#fff!important;-webkit-text-fill-color:#fff!important}
html body.nyanko-ui-polish .formation-custom-stage-tile .row.is-deploy [data-custom-builder-add-player],
html body.nyanko-ui-polish .formation-custom-builder-screen>.formation-custom-builder-actions [data-custom-builder-add-player-current]{background:linear-gradient(180deg,#41d990,#19a974 62%,#0f704c)!important;color:#fff!important;-webkit-text-fill-color:#fff!important;box-shadow:0 2px 0 #063620,inset 0 1px 0 rgba(255,255,255,.55)!important}
html body.nyanko-ui-polish .formation-custom-stage-tile .row button.is-added{background:#e4f6ea!important;color:#1c6b3f!important;-webkit-text-fill-color:#1c6b3f!important;box-shadow:0 2px 0 #0a5a2f!important}
@media(max-width:680px) and (orientation:portrait){
html body.nyanko-ui-polish .formation-custom-spawn-modal{padding:0;align-items:stretch}
html body.nyanko-ui-polish .formation-custom-spawn-modal-card{width:100%;height:100dvh;max-height:100dvh;border-radius:0;border-left:0;border-right:0}
html body.nyanko-ui-polish .formation-custom-spawn-modal-head{gap:7px;padding:7px 8px;border-bottom-width:2px}
html body.nyanko-ui-polish .formation-custom-modal-icon{width:36px!important;height:36px!important;border-radius:8px!important}
html body.nyanko-ui-polish .formation-custom-spawn-modal-title strong{font-size:.88rem}
html body.nyanko-ui-polish .formation-custom-spawn-modal-title small{font-size:.62rem}
html body.nyanko-ui-polish .formation-custom-spawn-modal-x{min-width:36px!important;width:36px;min-height:36px!important;font-size:1rem!important}
html body.nyanko-ui-polish .formation-custom-spawn-modal-body{padding:8px}
html body.nyanko-ui-polish .formation-custom-spawn-modal-foot{gap:6px;padding:7px 8px;border-top-width:2px}
html body.nyanko-ui-polish .formation-custom-spawn-modal-foot button{min-height:38px!important}
html body.nyanko-ui-polish .formation-custom-edit{gap:8px}
html body.nyanko-ui-polish .formation-custom-edit-section{gap:7px;padding:8px;border-radius:10px}
html body.nyanko-ui-polish .formation-custom-edit-section>h4{min-height:28px;font-size:.74rem;line-height:1.1}
html body.nyanko-ui-polish .formation-custom-edit-section>h4 button{min-width:64px!important;min-height:28px!important;padding:0 9px!important;font-size:.66rem!important}
html body.nyanko-ui-polish .formation-custom-stat-grid{grid-template-columns:minmax(0,1fr);gap:7px}
html body.nyanko-ui-polish .formation-custom-stat{gap:5px;padding:7px;border-radius:9px}
html body.nyanko-ui-polish .formation-custom-stepper{display:grid;grid-template-columns:38px minmax(0,1fr) 38px auto;gap:4px;align-items:stretch}
html body.nyanko-ui-polish .formation-custom-stepper button{width:38px!important;min-width:38px!important;height:38px!important;min-height:38px!important;font-size:1rem!important}
html body.nyanko-ui-polish .formation-custom-stepper input{min-height:38px;border-width:2px;border-radius:8px;font-size:.88rem}
html body.nyanko-ui-polish .formation-custom-stepper .hint{font-size:.62rem;line-height:1}
html body.nyanko-ui-polish .formation-custom-switch{min-height:40px;padding:5px 8px;gap:8px;border-radius:9px}
html body.nyanko-ui-polish .formation-custom-switch-sub{font-size:.58rem;line-height:1.1}
html body.nyanko-ui-polish .formation-custom-picker-head{grid-template-columns:minmax(0,1fr) auto;gap:6px}
html body.nyanko-ui-polish .formation-custom-picker-search{min-height:32px;border-width:2px}
html body.nyanko-ui-polish .formation-custom-picker-scroll{max-height:38dvh;padding:5px}
html body.nyanko-ui-polish .formation-custom-picker-grid,html body.nyanko-ui-polish .formation-custom-picker-grid.is-compact{grid-template-columns:repeat(auto-fit,minmax(96px,1fr));gap:5px}
html body.nyanko-ui-polish .formation-custom-picker-card{min-height:50px!important;padding:5px!important;border-width:2px!important}
html body.nyanko-ui-polish .formation-custom-picker-card strong{font-size:.68rem}
html body.nyanko-ui-polish .formation-custom-picker-card small{font-size:.56rem}
}
@media(orientation:landscape) and (max-height:520px) and (max-width:980px){
html body.nyanko-ui-polish .formation-custom-builder-screen{gap:5px}
html body.nyanko-ui-polish .formation-custom-builder-screen>header{position:static;display:grid!important;grid-template-columns:minmax(88px,1fr) auto minmax(58px,.7fr);gap:5px!important;align-items:center!important;padding:4px 5px!important;border-width:2px;border-radius:9px;box-shadow:0 2px 0 #000}
html body.nyanko-ui-polish .formation-custom-builder-screen>header button{min-width:0!important;min-height:26px!important;padding:0 8px!important;border-width:2px!important;font-size:.58rem!important;line-height:1!important;box-shadow:0 2px 0 #000!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
html body.nyanko-ui-polish .formation-custom-status{font-size:.58rem;line-height:1;text-align:center;white-space:nowrap}
html body.nyanko-ui-polish .formation-custom-builder-tabs{position:static;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px;padding:4px;border-width:2px;border-radius:9px;box-shadow:0 2px 0 #000}
html body.nyanko-ui-polish .formation-custom-builder-tabs button{min-height:26px!important;padding:0 4px!important;border-width:2px!important;font-size:.56rem!important;line-height:1!important;box-shadow:0 1px 0 #000!important}
html body.nyanko-ui-polish .formation-custom-builder-body{gap:6px;padding:0 2px 2px 0}
html body.nyanko-ui-polish .formation-custom-field{gap:5px;padding:6px;border-width:2px;box-shadow:0 2px 0 #000}
html body.nyanko-ui-polish .formation-custom-field>label{font-size:.64rem;line-height:1.05}
html body.nyanko-ui-polish .formation-custom-builder-screen>.formation-custom-builder-actions{grid-template-columns:repeat(4,minmax(0,1fr));gap:4px;padding:4px;border-width:2px;border-radius:9px;box-shadow:0 2px 0 #000}
html body.nyanko-ui-polish .formation-custom-builder-screen>.formation-custom-builder-actions button{min-height:25px!important;padding:0 4px!important;border-width:2px!important;font-size:.52rem!important;line-height:1!important;box-shadow:0 1px 0 #000!important}
html body.nyanko-ui-polish .formation-custom-picker-scroll{max-height:128px;padding:4px}
html body.nyanko-ui-polish .formation-custom-picker-grid,html body.nyanko-ui-polish .formation-custom-picker-grid.is-compact{grid-template-columns:repeat(auto-fit,minmax(92px,1fr));gap:4px}
html body.nyanko-ui-polish .formation-custom-picker-card{min-height:48px!important;padding:5px!important}
html body.nyanko-ui-polish .formation-custom-spawn-modal{padding:4px}
html body.nyanko-ui-polish .formation-custom-spawn-modal-card{max-height:calc(100dvh - 8px);width:min(620px,100%);border-radius:10px;box-shadow:0 4px 0 #000,0 12px 28px rgba(0,0,0,.38)}
html body.nyanko-ui-polish .formation-custom-spawn-modal-head{gap:6px;padding:5px 7px;border-bottom-width:2px}
html body.nyanko-ui-polish .formation-custom-modal-icon{width:32px!important;height:32px!important;border-radius:8px!important}
html body.nyanko-ui-polish .formation-custom-spawn-modal-title strong{font-size:.74rem}
html body.nyanko-ui-polish .formation-custom-spawn-modal-title small{font-size:.54rem}
html body.nyanko-ui-polish .formation-custom-spawn-modal-x{min-width:30px!important;width:30px;min-height:30px!important;font-size:.9rem!important}
html body.nyanko-ui-polish .formation-custom-spawn-modal-body{padding:6px}
html body.nyanko-ui-polish .formation-custom-spawn-modal-foot{padding:5px 7px;border-top-width:2px}
html body.nyanko-ui-polish .formation-custom-spawn-modal-card button{min-height:28px!important;padding:0 8px!important;border-width:2px!important;border-radius:8px!important;font-size:.58rem!important;line-height:1!important;box-shadow:0 1px 0 #000!important}
html body.nyanko-ui-polish .formation-custom-spawn-modal-foot button{min-height:28px!important}
html body.nyanko-ui-polish .formation-custom-edit{gap:6px}
html body.nyanko-ui-polish .formation-custom-edit-section{gap:6px;padding:7px;border-radius:9px}
html body.nyanko-ui-polish .formation-custom-edit-section>h4{font-size:.68rem;min-height:24px}
html body.nyanko-ui-polish .formation-custom-edit-section>h4 button{min-height:24px!important;padding:0 8px!important;font-size:.58rem!important}
html body.nyanko-ui-polish .formation-custom-stat-grid{grid-template-columns:repeat(auto-fit,minmax(116px,1fr));gap:6px}
html body.nyanko-ui-polish .formation-custom-stepper{display:grid;grid-template-columns:30px minmax(5ch,1fr) 30px auto;gap:3px;align-items:stretch}
html body.nyanko-ui-polish .formation-custom-stepper button{width:30px!important;min-width:30px!important;height:30px!important;min-height:30px!important;font-size:.82rem!important}
html body.nyanko-ui-polish .formation-custom-stepper input{min-height:30px;border-width:2px;font-size:.7rem;padding:0 2px}
html body.nyanko-ui-polish .formation-custom-stepper .hint{font-size:.56rem}
}
@media(orientation:landscape) and (max-height:390px) and (max-width:900px){
html body.nyanko-ui-polish .formation-custom-builder-screen{gap:4px}
html body.nyanko-ui-polish .formation-custom-builder-screen>header{padding:3px 4px!important}
html body.nyanko-ui-polish .formation-custom-builder-screen>header button{min-height:23px!important;font-size:.52rem!important;padding:0 6px!important}
html body.nyanko-ui-polish .formation-custom-builder-tabs{padding:3px;gap:3px}
html body.nyanko-ui-polish .formation-custom-builder-tabs button{min-height:23px!important;font-size:.5rem!important}
html body.nyanko-ui-polish .formation-custom-builder-screen>.formation-custom-builder-actions{padding:3px;gap:3px}
html body.nyanko-ui-polish .formation-custom-builder-screen>.formation-custom-builder-actions button{min-height:22px!important;font-size:.46rem!important}
html body.nyanko-ui-polish .formation-custom-picker-scroll{max-height:104px}
html body.nyanko-ui-polish .formation-custom-stat-grid{grid-template-columns:repeat(auto-fit,minmax(108px,1fr));gap:5px}
html body.nyanko-ui-polish .formation-custom-stepper{grid-template-columns:27px minmax(4.8ch,1fr) 27px auto}
html body.nyanko-ui-polish .formation-custom-stepper button{width:27px!important;min-width:27px!important;height:27px!important;min-height:27px!important;font-size:.72rem!important}
html body.nyanko-ui-polish .formation-custom-stepper input{min-height:27px;font-size:.64rem}
}
@media(max-width:680px) and (orientation:portrait){html body.nyanko-ui-polish .formation-custom-builder-tabs{grid-template-columns:repeat(3,minmax(0,1fr))}html body.nyanko-ui-polish .formation-custom-builder-actions button{flex:1 1 46%}html body.nyanko-ui-polish .formation-custom-builder-screen>.formation-custom-builder-actions{grid-template-columns:repeat(2,minmax(0,1fr))}html body.nyanko-ui-polish .formation-custom-timeline-row{grid-template-columns:54px minmax(0,1fr)}html body.nyanko-ui-polish .formation-custom-condition-grid{grid-template-columns:1fr}html body.nyanko-ui-polish .formation-custom-condition-card .formation-custom-stat-grid{grid-template-columns:1fr}html body.nyanko-ui-polish .formation-custom-stat-grid{grid-template-columns:minmax(0,1fr)}html body.nyanko-ui-polish .formation-custom-stat .formation-custom-stepper input{font-size:.86rem}}`;
  document.head.appendChild(style);
}

// ---- battle-config side integration (add / detect custom refs) --------------
function readSideRefs() {
  const cfg = readBattleConfig();
  return { enemy: cfg.enemyStages, player: cfg.playerStages, config: cfg };
}

function addCustomStageToSide(customStageId, side) {
  const cfg = readBattleConfig();
  const key = side === 'player' ? 'playerStages' : 'enemyStages';
  const ref = { kind: 'custom', id: customStageId };
  const already = cfg[key].some((r) => r.kind === 'custom' && r.id === customStageId);
  if (!already) cfg[key] = [...cfg[key], ref];
  const encodedKey = side === 'player' ? 'playerStageIds' : 'enemyStageIds';
  cfg[encodedKey] = cfg[key].map(encodeStageRef).filter(Boolean);
  writeBattleConfig(cfg);
  // Keep the editor's in-memory state + global config in sync so the existing panel reflects it.
  return { added: !already };
}

// ---- draft handling ---------------------------------------------------------
function readDraft() {
  try {
    const raw = globalThis.localStorage?.getItem?.(DRAFT_KEY);
    return raw ? normalizeCustomStage(JSON.parse(raw)) : null;
  } catch { return null; }
}
function writeDraft(stage) {
  try { globalThis.localStorage?.setItem?.(DRAFT_KEY, JSON.stringify(stage)); } catch {}
}
function clearDraft() {
  try { globalThis.localStorage?.removeItem?.(DRAFT_KEY); } catch {}
}

function getBuilderState(editor) {
  if (!editor.__customBuilder) editor.__customBuilder = { stage: null, tab: 'basic', dirty: false, savedId: null, conditionOpen: null, spawnModal: null, pickerSearch: {} };
  if (!Object.prototype.hasOwnProperty.call(editor.__customBuilder, 'conditionOpen')) editor.__customBuilder.conditionOpen = null;
  if (!Object.prototype.hasOwnProperty.call(editor.__customBuilder, 'spawnModal')) editor.__customBuilder.spawnModal = null;
  if (!editor.__customBuilder.pickerSearch || typeof editor.__customBuilder.pickerSearch !== 'object') editor.__customBuilder.pickerSearch = {};
  return editor.__customBuilder;
}

function openBuilder(editor, stageId) {
  const state = getBuilderState(editor);
  if (stageId) {
    state.stage = normalizeCustomStage(getCustomStage(stageId) || {});
    state.savedId = stageId;
  } else {
    const draft = readDraft();
    state.stage = draft || createCustomStage({});
    state.savedId = null;
  }
  state.tab = 'basic';
  state.conditionOpen = null;
  state.spawnModal = null;
  state.pickerSearch = {};
  state.dirty = false;
  editor.stageSelectorState = { level: BUILDER_LEVEL, customStageId: state.stage.id };
  editor.renderStageSelector();
}

function closeBuilder(editor) {
  stopPreview();
  const state = getBuilderState(editor);
  state.spawnModal = null;
  editor.root?.querySelector?.('.formation-custom-spawn-modal')?.remove();
  editor.stageSelectorState = { level: BATTLE_LEVEL, categoryId: null, mapKey: null };
  editor.renderStageSelector();
}

function markDirty(editor) {
  const state = getBuilderState(editor);
  state.dirty = true;
  writeDraft(state.stage);
  const status = editor.root?.querySelector?.('.formation-custom-status');
  if (status) { status.textContent = '未保存'; status.className = 'formation-custom-status dirty'; }
}

// ---- section (list) render --------------------------------------------------
function stageThumbSummary(stage) {
  const bg = stage.battle.backgroundId;
  const castle = stage.battle.enemyCastleId;
  const parts = [];
  parts.push(bg == null ? '背景未設定' : `背景${String(bg).padStart(3, '0')}`);
  parts.push(castle == null ? '城未設定' : `城${String(castle).padStart(3, '0')}`);
  return parts.join(' / ');
}

function formatDate(ts) {
  try { return new Date(ts).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return ''; }
}

function renderCustomStageSection(editor) {
  ensureStyle();
  const list = editor.root?.querySelector?.('.formation-stage-list');
  const panel = editor.root?.querySelector?.('.formation-custom-stage-battle');
  if (!list || !panel || list.querySelector('.formation-custom-builder-section')) return;
  const stages = readCustomStages();
  const { enemy, player } = readSideRefs();
  const enemyCustom = new Set(enemy.filter((r) => r.kind === 'custom').map((r) => r.id));
  const playerCustom = new Set(player.filter((r) => r.kind === 'custom').map((r) => r.id));

  const cards = stages.length ? stages.map((s) => {
    const onEnemy = enemyCustom.has(s.id);
    const onPlayer = playerCustom.has(s.id);
    return `
    <div class='formation-custom-stage-tile' data-custom-stage-id='${safeHtml(s.id)}'>
      <div class='tile-main' data-custom-builder-edit='${safeHtml(s.id)}' role='button' tabindex='0'>
        <span class='tile-edit-hint'>✎ 編集</span>
        <strong>${safeHtml(s.name)}</strong>
        <span class='meta'>${safeHtml(stageThumbSummary(s))}</span>
        <span class='meta'>敵 ${s.spawns.length} 種 / ${safeHtml(formatDate(s.updatedAt))}</span>
      </div>
      <div class='row is-deploy'>
        <button type='button' class='${onEnemy ? 'is-added' : 'is-primary'}' data-custom-builder-add-enemy='${safeHtml(s.id)}'>${onEnemy ? '✓ 敵側に追加済み' : '敵側へ追加'}</button>
        <button type='button' class='${onPlayer ? 'is-added' : 'is-primary'}' data-custom-builder-add-player='${safeHtml(s.id)}'>${onPlayer ? '✓ 味方側に追加済み' : '味方側へ追加'}</button>
      </div>
      <div class='row'>
        <button type='button' class='is-ghost' data-custom-builder-duplicate='${safeHtml(s.id)}'>複製</button>
        <button type='button' class='is-ghost' data-custom-builder-export='${safeHtml(s.id)}'>書き出し</button>
        <button type='button' class='is-ghost is-danger' data-custom-builder-delete='${safeHtml(s.id)}'>削除</button>
      </div>
    </div>`;
  }).join('') : `<p class='formation-custom-stage-empty'>まだ自作ステージがありません</p>`;

  const section = document.createElement('div');
  section.className = 'formation-custom-builder-section formation-custom-builder';
  section.innerHTML = `
    <header><h3>自作ステージ</h3></header>
    <div class='formation-custom-builder-actions'>
      <button type='button' class='is-primary' data-custom-builder-new='1'>＋ 新しいステージを作る</button>
      <button type='button' class='is-ghost' data-custom-builder-import='1'>JSONを読み込む</button>
    </div>
    <div class='formation-custom-stage-grid'>${cards}</div>
    <input type='file' accept='application/json,.json' data-custom-builder-import-file='1' hidden>`;
  list.appendChild(section);
  popIn(section, { duration: 130 });
}

// ---- builder screen render --------------------------------------------------
function stepper(field, value, { min = 0, step = 1, unit = '' } = {}) {
  return `<span class='formation-custom-stepper'>
    <button type='button' data-custom-step='dec' data-custom-field='${safeHtml(field)}' data-custom-step-amt='${step}' data-custom-min='${min}'>−</button>
    <input class='formation-custom-num' type='number' inputmode='numeric' data-custom-field='${safeHtml(field)}' data-custom-min='${min}' value='${safeHtml(value)}'>
    <button type='button' data-custom-step='inc' data-custom-field='${safeHtml(field)}' data-custom-step-amt='${step}' data-custom-min='${min}'>＋</button>
    ${unit ? `<span class='hint'>${safeHtml(unit)}</span>` : ''}
  </span>`;
}

function optionSelect(field, value, options, placeholder) {
  const opts = [`<option value=''>${safeHtml(placeholder)}</option>`]
    .concat(options.map((o) => `<option value='${safeHtml(o.id)}' ${String(o.id) === String(value) ? 'selected' : ''}>${safeHtml(o.label)}</option>`));
  return `<select class='formation-custom-input' data-custom-field='${safeHtml(field)}'>${opts.join('')}</select>`;
}

// Stable order: the list NEVER reorders on selection (要件: 選んでも順番が変わらない). Search filters in
// place; every match is returned so a scroll container can show them all (要件: 全部選べる).
function filterPickerOptions(options, value, query) {
  const q = String(query || '').trim().toLowerCase();
  const matches = q
    ? options.filter((o) => `${o.id} ${o.label || ''} ${o.meta || ''}`.toLowerCase().includes(q))
    : options;
  return { items: matches, total: matches.length };
}

// A lazily-hydrated thumbnail <img>. It starts blank (.is-missing) and the builder's thumb hydrator
// swaps in the real BCU asset once it scrolls into view. No dummy image is ever shown.
function thumbImg(kind, id, extraClass = '') {
  if (kind == null || id == null || id === '') return '';
  return `<img class='formation-custom-thumb kind-${safeHtml(kind)} is-missing ${extraClass}' alt='' decoding='async'
    data-custom-thumb='1' data-thumb-kind='${safeHtml(kind)}' data-thumb-id='${safeHtml(id)}'>`;
}

function renderPickerCard(field, value, option, { empty = false, kind = null } = {}) {
  const selected = !empty && String(option.id) === String(value);
  const thumb = empty ? '' : thumbImg(kind, option.id);
  return `<button type='button' class='formation-custom-picker-card ${selected ? 'is-selected' : ''} ${empty ? 'is-empty' : ''}'
    data-custom-pick='1' data-custom-field='${safeHtml(field)}' data-custom-value='${empty ? '' : safeHtml(option.id)}'>
    ${thumb}
    <strong>${safeHtml(option.label)}</strong>
    <small>${safeHtml(option.meta || (empty ? '未設定' : `ID ${option.id}`))}</small>
  </button>`;
}

function renderAssetPicker(field, value, options, placeholder, state, { searchKey = field, compact = false, allowEmpty = false, kind = null } = {}) {
  if (kind === 'music') return renderMusicPicker(field, value, options, placeholder, state, { searchKey, allowEmpty });
  if (state) (state.__pickerReg ||= {})[searchKey] = { field, value, options, kind, allowEmpty, placeholder, music: false };
  const query = state?.pickerSearch?.[searchKey] || '';
  const { items, total } = filterPickerOptions(options, value, query);
  const shown = items.slice(0, PICKER_WINDOW);
  const cards = shown.map((option) => renderPickerCard(field, value, option, { kind })).join('');
  const emptyCard = allowEmpty ? renderPickerCard(field, value, { id: '', label: placeholder || '未設定', meta: '空欄にする' }, { empty: true }) : '';
  return `<div class='formation-custom-picker'>
    <div class='formation-custom-picker-head'>
      <input class='formation-custom-picker-search' data-custom-picker-search='${safeHtml(searchKey)}' value='${safeHtml(query)}' placeholder='検索 / ID'>
      <span class='formation-custom-picker-count'>${safeHtml(total)}件</span>
    </div>
    <div class='formation-custom-picker-scroll'><div class='formation-custom-picker-grid ${compact ? 'is-compact' : ''}' data-picker-key='${safeHtml(searchKey)}' data-shown='${shown.length}'>${emptyCard}${cards || `<span class='hint'>候補がありません</span>`}</div></div>
  </div>`;
}

// BGM picker: a play/stop button (auditions the real track) + a select button per card.
function renderMusicCard(field, value, option, { empty = false } = {}) {
  const selected = empty ? (value == null || value === '') : String(option.id) === String(value);
  const playing = !empty && isPreviewing(option.id);
  const control = empty
    ? `<button type='button' class='formation-custom-music-play' disabled style='opacity:.35'>♪</button>`
    : `<button type='button' class='formation-custom-music-play ${playing ? 'is-playing' : ''}' data-custom-music-toggle='${safeHtml(option.id)}' aria-label='試聴'>${playing ? '■' : '▶'}</button>`;
  return `<div class='formation-custom-music-card ${selected ? 'is-selected' : ''} ${playing ? 'is-playing' : ''}'>
    ${control}
    <button type='button' class='formation-custom-music-pick' data-custom-pick='1' data-custom-field='${safeHtml(field)}' data-custom-value='${empty ? '' : safeHtml(option.id)}'>
      <strong>${safeHtml(option.label)}</strong>
      <small>${safeHtml(option.meta || (empty ? '空欄にする' : `ID ${option.id}`))}</small>
    </button>
  </div>`;
}

function renderMusicPicker(field, value, options, placeholder, state, { searchKey = field, allowEmpty = false } = {}) {
  if (state) (state.__pickerReg ||= {})[searchKey] = { field, value, options, allowEmpty, placeholder, music: true };
  const query = state?.pickerSearch?.[searchKey] || '';
  const { items, total } = filterPickerOptions(options, value, query);
  const emptyCard = allowEmpty ? renderMusicCard(field, value, { id: '', label: placeholder || '未設定' }, { empty: true }) : '';
  const shown = items.slice(0, PICKER_WINDOW);
  const cards = shown.map((option) => renderMusicCard(field, value, option)).join('');
  return `<div class='formation-custom-picker'>
    <div class='formation-custom-picker-head'>
      <input class='formation-custom-picker-search' data-custom-picker-search='${safeHtml(searchKey)}' value='${safeHtml(query)}' placeholder='検索 / ID'>
      <span class='formation-custom-picker-count'>${safeHtml(total)}件</span>
    </div>
    <div class='formation-custom-picker-scroll'><div class='formation-custom-music-grid' data-picker-key='${safeHtml(searchKey)}' data-shown='${shown.length}'>${emptyCard}${cards || `<span class='hint'>候補がありません</span>`}</div></div>
    <span class='hint'>▶で試聴（音量設定を尊重・画面を離れると停止）</span>
  </div>`;
}

// Search typing only narrows one picker: re-render just that picker's card grid + count in place,
// leaving the search input (and thus its focus/caret) and every other picker untouched. This avoids
// the full-body innerHTML rebuild +全サムネ再ハイドレートが毎キーストローク走る重さ. Returns false so the
// caller can fall back to a full refresh if the picker metadata is unavailable.
function refreshPickerCards(editor, searchKey) {
  const state = getBuilderState(editor);
  const reg = state.__pickerReg?.[searchKey];
  if (!reg) return false;
  const input = editor.root?.querySelector?.(`[data-custom-picker-search='${CSS.escape(searchKey)}']`);
  const picker = input?.closest?.('.formation-custom-picker');
  const grid = picker?.querySelector?.('.formation-custom-picker-grid, .formation-custom-music-grid');
  if (!grid) return false;
  const query = state.pickerSearch?.[searchKey] || '';
  const { items, total } = filterPickerOptions(reg.options, reg.value, query);
  const shown = items.slice(0, PICKER_WINDOW);
  const noHit = `<span class='hint'>候補がありません</span>`;
  const empty = reg.music
    ? (reg.allowEmpty ? renderMusicCard(reg.field, reg.value, { id: '', label: reg.placeholder || '未設定' }, { empty: true }) : '')
    : (reg.allowEmpty ? renderPickerCard(reg.field, reg.value, { id: '', label: reg.placeholder || '未設定', meta: '空欄にする' }, { empty: true }) : '');
  grid.innerHTML = empty + (renderCardsSlice(reg, shown) || noHit);
  grid.dataset.shown = String(shown.length);
  grid.scrollTop = 0;
  const scroll = grid.closest('.formation-custom-picker-scroll');
  if (scroll) scroll.scrollTop = 0;
  const count = picker.querySelector('.formation-custom-picker-count');
  if (count) count.textContent = `${total}件`;
  const overlay = picker.closest('.formation-custom-spawn-modal');
  if (overlay) hydrateModalThumbs(editor, overlay);
  else hydrateThumbs(editor);
  refreshMusicButtons(editor);
  return true;
}

// Append the next window of cards when a picker's scroll container nears its bottom, keeping the live
// DOM small even for 数百件のリスト. Options/query are re-derived from the picker registry + state.
function growPicker(editor, grid) {
  const key = grid?.dataset?.pickerKey;
  if (!key) return;
  const state = getBuilderState(editor);
  const reg = state.__pickerReg?.[key];
  if (!reg) return;
  const already = Number(grid.dataset.shown) || 0;
  const query = state.pickerSearch?.[key] || '';
  const { items } = filterPickerOptions(reg.options, reg.value, query);
  if (already >= items.length) return;
  const next = items.slice(already, already + PICKER_WINDOW);
  grid.insertAdjacentHTML('beforeend', renderCardsSlice(reg, next));
  grid.dataset.shown = String(already + next.length);
  const overlay = grid.closest('.formation-custom-spawn-modal');
  if (overlay) hydrateModalThumbs(editor, overlay);
  else hydrateThumbs(editor);
  if (reg.music) refreshMusicButtons(editor);
}
function maybeGrowPicker(editor, scroll) {
  if (!scroll || scroll.scrollTop + scroll.clientHeight < scroll.scrollHeight - 160) return;
  const grid = scroll.querySelector('.formation-custom-picker-grid, .formation-custom-music-grid');
  if (grid) growPicker(editor, grid);
}

// カード選択時はグリッドを作り直さず、is-selected をその場で付け替える。グリッドを再構築すると
// （特にウィンドウ描画で件数が変わると）スクロール座標の復元がズレるため、選択でスクロールを一切
// 動かさない。選択に依存する表示（プレビュー帯・スポーンモーダルのヘッダ）はスクロールの外なので、
// それだけ個別に更新する。復元不能な形なら false を返し、呼び出し側が従来の全再描画にフォールバック。
function selectPickerInPlace(editor, pickEl, field, value) {
  const grid = pickEl.closest?.('.formation-custom-picker-grid, .formation-custom-music-grid');
  if (!grid) return false;
  for (const sel of grid.querySelectorAll('.is-selected')) sel.classList.remove('is-selected');
  const card = pickEl.closest('.formation-custom-picker-card, .formation-custom-music-card') || pickEl;
  card.classList.add('is-selected');
  const reg = getBuilderState(editor).__pickerReg?.[grid.dataset.pickerKey];
  if (reg) reg.value = value === '' ? null : value; // 以降の追加ロード／検索で選択状態を正しく反映
  const state = getBuilderState(editor);
  if (/^battle\.(backgroundId|enemyCastleId|musicId|bossMusicId)$/.test(field)) {
    const preview = editor.root?.querySelector?.('.formation-custom-field-preview');
    if (preview) { preview.outerHTML = renderFieldPreview(state.stage); hydrateThumbs(editor); }
  } else if (/^spawns\.\d+\.enemyId$/.test(field)) {
    const head = editor.root?.querySelector?.('.formation-custom-spawn-modal-head');
    if (head) {
      head.outerHTML = spawnModalHead(state);
      const overlay = editor.root?.querySelector?.('.formation-custom-spawn-modal');
      if (overlay) hydrateModalThumbs(editor, overlay);
    }
  }
  refreshMusicButtons(editor);
  return true;
}

// Field preview: real background + player/enemy castle assets composited into one band, with the
// key battlefield values overlaid. Uses the same assets the battle uses (no separate art path).
function renderFieldPreview(stage) {
  const b = stage.battle;
  const hasBg = b.backgroundId != null && b.backgroundId !== '';
  const hasCastle = b.enemyCastleId != null && b.enemyCastleId !== '';
  return `<div class='formation-custom-field-preview'>
    <img class='formation-custom-field-bg is-missing' alt='' ${hasBg ? `data-custom-thumb='1' data-thumb-eager='1' data-thumb-kind='background' data-thumb-id='${safeHtml(b.backgroundId)}'` : ''}>
    ${!hasBg ? `<div class='formation-custom-field-empty'>背景が未設定です</div>` : ''}
    <img class='formation-custom-field-castle pcastle is-missing' alt='' data-custom-thumb='1' data-thumb-eager='1' data-thumb-kind='player-castle' data-thumb-id='pc'>
    ${hasCastle ? `<img class='formation-custom-field-castle ecastle is-missing' alt='' data-custom-thumb='1' data-thumb-eager='1' data-thumb-kind='castle' data-thumb-id='${safeHtml(b.enemyCastleId)}'>` : ''}
  </div>`;
}

// A light label + control row used inside sectioned cards (no nested field-card border).
function labeledLine(label, inner, hint) {
  return `<div class='formation-custom-line'><span class='lbl'>${safeHtml(label)}</span>${inner}${hint ? `<span class='hint'>${safeHtml(hint)}</span>` : ''}</div>`;
}

function renderBasicTab(stage, state = {}) {
  const b = stage.battle;
  return `
    <div class='formation-custom-field'><label>戦場プレビュー</label>${renderFieldPreview(stage)}
      <span class='hint'>選択中の背景と城を実アセットで確認できます（自軍城は固定表示）</span></div>
    <section class='formation-custom-edit-section'>
      <h4>アイデンティティ</h4>
      ${labeledLine('ステージ名', `<input class='formation-custom-input' data-custom-field='name' value='${safeHtml(stage.name)}' maxlength='40'>`)}
      ${labeledLine('説明', `<input class='formation-custom-input' data-custom-field='description' value='${safeHtml(stage.description)}' maxlength='120'>`)}
    </section>
    <section class='formation-custom-edit-section'>
      <h4>見た目・サウンド</h4>
      ${labeledLine('背景', renderAssetPicker('battle.backgroundId', b.backgroundId, backgroundOptions(), '背景を選ぶ', state, { searchKey: 'background', kind: 'background' }), '実際に戦闘で使う背景から選択します')}
      ${labeledLine('敵城', renderAssetPicker('battle.enemyCastleId', b.enemyCastleId, castleOptions(), '敵城を選ぶ', state, { searchKey: 'castle', kind: 'castle' }))}
      ${labeledLine('通常BGM', renderAssetPicker('battle.musicId', b.musicId, musicOptions(), 'BGMなし', state, { searchKey: 'music', allowEmpty: true, kind: 'music' }), '未設定なら戦闘中は無音になります')}
      ${labeledLine('ボスBGM', renderAssetPicker('battle.bossMusicId', b.bossMusicId, musicOptions(), 'ボスBGMなし', state, { searchKey: 'bossMusic', allowEmpty: true, kind: 'music' }), '通常BGMありの場合、敵側ボス出現時に切り替わります')}
    </section>
    <section class='formation-custom-edit-section'>
      <h4>戦場パラメータ</h4>
      <div class='formation-custom-stat-grid'>
        ${statField('敵城HP', 'battle.enemyBaseHp', b.enemyBaseHp, { min: 1, step: 1000 })}
        ${statField('戦場の長さ', 'battle.stageLength', b.stageLength, { min: 1, step: 100 })}
        ${statField('最大敵数', 'battle.maxEnemyCount', b.maxEnemyCount, { min: 1, step: 1, unit: '体' })}
      </div>
    </section>
    <section class='formation-custom-edit-section'>
      <h4>オプション</h4>
      ${switchToggle('ボスガード', 'battle.bossGuard', b.bossGuard, { sub: 'ボス生存中、敵城ダメージを防ぐ' })}
    </section>`;
}

function renderSpawnChips(spawn) {
  const chips = [];
  if (spawn.conditions.enemyBaseHp.enabled) chips.push(`城HP ${spawn.conditions.enemyBaseHp.minPercent}〜${spawn.conditions.enemyBaseHp.maxPercent}%`);
  if (spawn.conditions.layer.enabled) chips.push(`Layer ${spawn.conditions.layer.min}〜${spawn.conditions.layer.max}`);
  return chips.length
    ? `<div class='formation-custom-chip-row'>${chips.map((chip) => `<span class='formation-custom-chip'>${safeHtml(chip)}</span>`).join('')}</div>`
    : `<div class='formation-custom-chip-row'><span class='formation-custom-chip'>常時候補</span></div>`;
}

function miniControl(label, html) {
  return `<span class='formation-custom-mini-control'><span>${safeHtml(label)}</span>${html}</span>`;
}

// A labelled ± stepper styled as a "stat card" (professional spawn-settings UI). The unit sits in the
// label so the number field stays large and legible.
function statField(label, field, value, { min = 0, step = 1, unit = '' } = {}) {
  return `<div class='formation-custom-stat'>
    <span class='lbl'>${safeHtml(label)}${unit ? `<em>${safeHtml(unit)}</em>` : ''}</span>
    ${stepper(field, value, { min, step })}
  </div>`;
}

// A toggle switch bound to the same data-custom-check contract the checkbox handler already uses.
function switchToggle(label, field, checked, { boss = false, sub = '' } = {}) {
  return `<label class='formation-custom-switch ${boss ? 'is-boss' : ''}'>
    <input type='checkbox' data-custom-check='${safeHtml(field)}' ${checked ? 'checked' : ''}>
    <span class='track'></span>
    <span class='formation-custom-switch-label'>${safeHtml(label)}${sub ? `<span class='formation-custom-switch-sub'>${safeHtml(sub)}</span>` : ''}</span>
  </label>`;
}

function renderConditionPanel(spawn, index) {
  const c = spawn.conditions;
  return `
    <div class='formation-custom-condition-panel'>
      <div class='formation-custom-condition-grid'>
        <section class='formation-custom-condition-card'>
          ${switchToggle('城HP条件', `spawns.${index}.conditions.enemyBaseHp.enabled`, c.enemyBaseHp.enabled)}
          <div class='formation-custom-stat-grid'>
            ${statField('下限', `spawns.${index}.conditions.enemyBaseHp.minPercent`, c.enemyBaseHp.minPercent, { min: 0, step: 5, unit: '%' })}
            ${statField('上限', `spawns.${index}.conditions.enemyBaseHp.maxPercent`, c.enemyBaseHp.maxPercent, { min: 0, step: 5, unit: '%' })}
          </div>
        </section>
        <section class='formation-custom-condition-card'>
          ${switchToggle('レイヤー範囲', `spawns.${index}.conditions.layer.enabled`, c.layer.enabled)}
          <div class='formation-custom-stat-grid'>
            ${statField('最小', `spawns.${index}.conditions.layer.min`, c.layer.min, { min: 0, step: 1 })}
            ${statField('最大', `spawns.${index}.conditions.layer.max`, c.layer.max, { min: 0, step: 1 })}
          </div>
        </section>
      </div>
      <span class='hint'>score / group 条件はこの編集画面では設定しません</span>
    </div>`;
}

function spawnSummaryLine(s) {
  const parts = [`合計${s.count}体`, `HP ${s.hpMultiplier}%`, `攻 ${s.attackMultiplier}%`, `初回 ${framesToSeconds(s.firstSpawn.minFrames)}s`];
  if (s.respawn.enabled) parts.push(`再出現 ${framesToSeconds(s.respawn.minFrames)}〜${framesToSeconds(s.respawn.maxFrames)}s`);
  else parts.push('再出現なし');
  return parts.join(' ・ ');
}

function renderSpawnEditor(s, i, state) {
  const conditionOpen = state.conditionOpen === i;
  return `<div class='formation-custom-edit'>
    <section class='formation-custom-edit-section'>
      <h4>出現する敵</h4>
      ${renderAssetPicker(`spawns.${i}.enemyId`, s.enemyId, enemyOptions(), '敵を検索して選ぶ', state, { searchKey: `enemy.${i}`, compact: true, kind: 'enemy' })}
    </section>
    <section class='formation-custom-edit-section'>
      <h4>倍率</h4>
      <div class='formation-custom-stat-grid'>
        ${statField('HP倍率', `spawns.${i}.hpMultiplier`, s.hpMultiplier, { min: 1, step: 10, unit: '%' })}
        ${statField('攻撃倍率', `spawns.${i}.attackMultiplier`, s.attackMultiplier, { min: 1, step: 10, unit: '%' })}
      </div>
    </section>
    <section class='formation-custom-edit-section'>
      <h4>出現タイミング</h4>
      <div class='formation-custom-stat-grid'>
        ${statField('初回 最小', `spawns.${i}.firstMin`, framesToSeconds(s.firstSpawn.minFrames), { min: 0, step: 1, unit: '秒' })}
        ${statField('初回 最大', `spawns.${i}.firstMax`, framesToSeconds(s.firstSpawn.maxFrames), { min: 0, step: 1, unit: '秒' })}
      </div>
      ${switchToggle('再出現する', `spawns.${i}.respawn.enabled`, s.respawn.enabled, { sub: '合計出撃数上限に達するまで、この間隔で繰り返し出現します' })}
      ${s.respawn.enabled ? `<div class='formation-custom-stat-grid'>
        ${statField('再出現 最小', `spawns.${i}.respawnMin`, framesToSeconds(s.respawn.minFrames), { min: 0, step: 1, unit: '秒' })}
        ${statField('再出現 最大', `spawns.${i}.respawnMax`, framesToSeconds(s.respawn.maxFrames), { min: 0, step: 1, unit: '秒' })}
      </div>` : ''}
      <div class='formation-custom-stat-grid'>
        ${statField('合計出撃数上限', `spawns.${i}.count`, s.count, { min: 1, step: 1, unit: '体' })}
      </div>
      <span class='hint'>${s.respawn.enabled ? `${framesToSeconds(s.respawn.minFrames)}秒ごとに1体ずつ、合計${s.count}体まで出現します` : '再出現OFFのため初回にまとめて出現します（合計出撃数上限までが同時出現します）'}</span>
    </section>
    <section class='formation-custom-edit-section'>
      <h4>ボス設定</h4>
      ${switchToggle('ボスとして出現', `spawns.${i}.boss`, s.boss, { boss: true, sub: '敵側ではボスBGM切替とボスガード判定に使います' })}
    </section>
    <section class='formation-custom-edit-section'>
      <h4>詳細条件<button type='button' class='is-ghost' data-custom-spawn-cond='${i}' style='margin-left:auto;min-height:32px;padding:0 14px;font-size:.74rem'>${conditionOpen ? '閉じる' : '開く'}</button></h4>
      ${conditionOpen ? renderConditionPanel(s, i) : `<span class='hint'>城HP・レイヤーで出現タイミングを絞り込めます</span>`}
    </section>
  </div>`;
}

function renderEnemyTab(stage, state = {}) {
  const rows = stage.spawns.map((s, i) => `
      <div class='formation-custom-field is-spawn-row' data-custom-spawn-index='${i}'>
        <div class='formation-custom-spawn-head' data-custom-spawn-toggle='${i}'>
          <b>${i + 1}</b>${thumbImg('enemy', s.enemyId, 'formation-custom-spawn-icon')}
          <span class='formation-custom-spawn-name' data-custom-spawn-title='${i}'>${safeHtml(enemyName(s.enemyId))}${s.boss ? ' <em>ボス</em>' : ''}</span>
          <span class='formation-custom-spawn-caret edit'>✎</span>
        </div>
        ${renderSpawnChips(s)}
        <div class='formation-custom-spawn-summary'>${safeHtml(spawnSummaryLine(s))}</div>
        <div class='formation-custom-spawn-ctrl'>
          <button type='button' class='is-ghost' data-custom-spawn-up='${i}'>▲</button>
          <button type='button' class='is-ghost' data-custom-spawn-down='${i}'>▼</button>
          <button type='button' class='is-primary' data-custom-spawn-toggle='${i}'>✎ 編集</button>
          <button type='button' class='is-ghost' data-custom-spawn-duplicate='${i}'>複製</button>
          <button type='button' class='is-ghost is-danger' data-custom-spawn-remove='${i}'>削除</button>
        </div>
      </div>`).join('');
  return `
    <div class='formation-custom-builder-actions'>
      <button type='button' class='is-primary' data-custom-spawn-add='1'>＋ 敵を追加</button>
    </div>
    ${rows || `<p class='formation-custom-stage-empty'>敵が未登録です</p>`}`;
}

function renderConfirmTab(stage) {
  const result = validateCustomStage(stage, { resolvers: assetResolvers() });
  const errors = result.errors.map((e) => `<li>${safeHtml(e.message)}</li>`).join('');
  const warnings = result.warnings.map((w) => `<li>${safeHtml(w.message)}</li>`).join('');
  const b = stage.battle;
  const firstSpawn = stage.spawns.reduce((min, s) => Math.min(min, s.firstSpawn.minFrames), Infinity);
  const timelineMax = Math.max(1, ...stage.spawns.map((s) => s.firstSpawn.maxFrames || s.firstSpawn.minFrames || 0));
  const timelineRows = stage.spawns
    .slice()
    .sort((a, bSpawn) => (a.firstSpawn.minFrames || 0) - (bSpawn.firstSpawn.minFrames || 0))
    .slice(0, 8)
    .map((s) => {
      const frame = s.firstSpawn.minFrames || 0;
      const pos = Math.max(3, Math.min(100, Math.round((frame / timelineMax) * 100)));
      return `<div class='formation-custom-timeline-row'>
        <span>${framesToSeconds(frame)}s</span>
        <span class='formation-custom-timeline-track' style='--pos:${pos}'><span></span></span>
        <span>${safeHtml(enemyName(s.enemyId))}</span>
      </div>`;
    }).join('');
  return `
    <div class='formation-custom-preview'>
      ${renderFieldPreview(stage)}
      <div class='formation-custom-preview-hero'>
        <div>
          <strong>${safeHtml(stage.name)}</strong>
        </div>
        <span class='formation-custom-preview-pill'>${errors ? '修正が必要' : '保存可能'}</span>
      </div>
      ${timelineRows ? `<div class='formation-custom-timeline'>${timelineRows}</div>` : `<p class='formation-custom-warn'>敵出現が未登録です</p>`}
    </div>
    ${errors ? `<div class='formation-custom-alert'><strong>エラー（保存不可）</strong><ul>${errors}</ul></div>` : `<div class='formation-custom-warn' style='border-color:#2f8a00;background:#e6ffd9;color:#2f6a00'>保存できます</div>`}
    ${warnings ? `<div class='formation-custom-warn'><strong>注意</strong><ul>${warnings}</ul></div>` : ''}`;
}

function renderBuilderTabBody(state) {
  const stage = state.stage;
  return state.tab === 'enemy' ? renderEnemyTab(stage, state)
    : state.tab === 'confirm' ? renderConfirmTab(stage)
    : renderBasicTab(stage, state);
}

// ---- lazy thumbnail hydration ----------------------------------------------
// Thumbnails resolve their real BCU asset only when scrolled into view (matching FormationEditor's
// icon strategy) so a picker with many candidates never bulk-loads every image at once.
function resolveThumbImg(img) {
  if (!img || img.dataset.thumbDone === '1' || img.dataset.thumbPending === '1') return;
  const kind = img.dataset.thumbKind;
  const id = img.dataset.thumbId;
  img.dataset.thumbPending = '1';
  resolveThumb(kind, id).then((url) => {
    delete img.dataset.thumbPending;
    if (!img.isConnected) return;
    if (!url) { img.dataset.thumbDone = '1'; img.classList.add('is-missing'); return; }
    img.onload = () => { img.classList.remove('is-missing'); img.dataset.thumbDone = '1'; };
    img.onerror = () => { img.classList.add('is-missing'); delete img.dataset.thumbDone; evictAsset(thumbCacheKey(kind, id)); };
    img.src = url;
  }).catch(() => { delete img.dataset.thumbPending; if (img.isConnected) img.classList.add('is-missing'); });
}

function hydrateThumbs(editor) {
  const scope = editor.root;
  if (!scope) return;
  const root = scope.querySelector('.formation-custom-builder-body') || null;
  let obs = editor.__customThumbObserver;
  if (obs && editor.__customThumbObserverRoot !== root) { obs.disconnect(); obs = null; editor.__customThumbObserver = null; }
  if (!obs && typeof IntersectionObserver !== 'undefined') {
    editor.__customThumbObserverRoot = root;
    obs = editor.__customThumbObserver = new IntersectionObserver((items, o) => {
      for (const item of items) { if (item.isIntersecting) { o.unobserve(item.target); resolveThumbImg(item.target); } }
    }, { root, rootMargin: '150px 0px 250px 0px' });
  }
  for (const img of scope.querySelectorAll('img[data-custom-thumb]')) {
    if (img.dataset.thumbDone === '1' || img.dataset.thumbPending === '1') continue;
    // Eager thumbs (the always-visible field preview) resolve immediately: they can be hidden while
    // .is-missing, which would keep an IntersectionObserver from ever firing for them.
    if (img.dataset.thumbEager === '1' || !obs) resolveThumbImg(img);
    else obs.observe(img);
  }
}

// Keep every BGM play/stop button in sync with the single active preview (only one plays at a time).
function refreshMusicButtons(editor) {
  const scope = editor.root;
  if (!scope) return;
  for (const btn of scope.querySelectorAll('[data-custom-music-toggle]')) {
    const playing = isPreviewing(btn.dataset.customMusicToggle);
    btn.textContent = playing ? '■' : '▶';
    btn.classList.toggle('is-playing', playing);
    const card = btn.closest('.formation-custom-music-card');
    if (card) card.classList.toggle('is-playing', playing);
  }
}

function ensureMusicPreviewSub(editor) {
  if (editor.__customMusicSub) return;
  editor.__customMusicSub = onPreviewChange(() => {
    if (editor.stageSelectorState?.level === BUILDER_LEVEL) refreshMusicButtons(editor);
  });
}

// Capture / restore the scroll position of every inner picker scroll container (keyed by its search
// key) so re-rendering after a selection/typing does NOT snap the card list back to the top
// (要件: 選んでもスクロール位置が初期位置に戻らない).
function captureInnerScroll(scope) {
  const map = {};
  if (!scope) return map;
  for (const scroll of scope.querySelectorAll('.formation-custom-picker-scroll')) {
    const search = scroll.closest('.formation-custom-picker')?.querySelector('[data-custom-picker-search]');
    const key = search?.dataset?.customPickerSearch;
    if (key) map[key] = scroll.scrollTop;
  }
  return map;
}
function restoreInnerScroll(scope, map) {
  if (!scope || !map) return;
  for (const [key, top] of Object.entries(map)) {
    if (!Number.isFinite(top) || top <= 0) continue;
    const search = scope.querySelector(`[data-custom-picker-search='${CSS.escape(key)}']`);
    const scroll = search?.closest('.formation-custom-picker')?.querySelector('.formation-custom-picker-scroll');
    if (scroll) { scroll.scrollTop = top; restoreScrollTop(scroll, top); }
  }
}

// Restore focus + caret into a picker search input after a re-render (typing keeps focus).
function restoreSearchFocus(scope, state, focusSearchKey) {
  if (!focusSearchKey) return;
  const input = scope.querySelector(`[data-custom-picker-search='${CSS.escape(focusSearchKey)}']`);
  if (!input) return;
  input.focus();
  const pos = String(state.pickerSearch?.[focusSearchKey] || '').length;
  try { input.setSelectionRange(pos, pos); } catch {}
}

function refreshBuilderBody(editor, focusSearchKey = null) {
  const state = getBuilderState(editor);
  const body = editor.root?.querySelector?.('.formation-custom-builder-body');
  if (body) {
    const scrollTop = body.scrollTop;
    const innerScroll = captureInnerScroll(body);
    body.innerHTML = renderBuilderTabBody(state);
    restoreSearchFocus(body, state, focusSearchKey);
    body.scrollTop = scrollTop;
    restoreScrollTop(body, scrollTop);
    restoreInnerScroll(body, innerScroll);
    hydrateThumbs(editor);
    refreshMusicButtons(editor);
  }
}

// ---- spawn-editor overlay (キャラ編集はオーバーレイに出す) ---------------------
function enemyModalIcon(id) {
  if (id == null || id === '') return `<span class='formation-custom-thumb kind-enemy is-missing formation-custom-modal-icon'></span>`;
  return `<img class='formation-custom-thumb kind-enemy is-missing formation-custom-modal-icon' alt=''
    data-custom-thumb='1' data-thumb-eager='1' data-thumb-kind='enemy' data-thumb-id='${safeHtml(id)}'>`;
}

function hydrateModalThumbs(editor, overlay) {
  const scrollRoot = overlay.querySelector('.formation-custom-spawn-modal-body');
  if (editor.__customModalThumbObserver) editor.__customModalThumbObserver.disconnect();
  let obs = null;
  if (typeof IntersectionObserver !== 'undefined') {
    obs = editor.__customModalThumbObserver = new IntersectionObserver((items, o) => {
      for (const item of items) if (item.isIntersecting) { o.unobserve(item.target); resolveThumbImg(item.target); }
    }, { root: scrollRoot, rootMargin: '150px 0px 250px 0px' });
  }
  for (const img of overlay.querySelectorAll('img[data-custom-thumb]')) {
    if (img.dataset.thumbDone === '1' || img.dataset.thumbPending === '1') continue;
    if (img.dataset.thumbEager === '1' || !obs) resolveThumbImg(img);
    else obs.observe(img);
  }
}

function spawnModalHead(state) {
  const i = state.spawnModal;
  const s = state.stage.spawns[i];
  return `<header class='formation-custom-spawn-modal-head'>
      ${enemyModalIcon(s.enemyId)}
      <div class='formation-custom-spawn-modal-title'>
        <strong>${safeHtml(enemyName(s.enemyId))}</strong>
        <small>敵${i + 1} の設定${s.boss ? ' ・ ボス' : ''}</small>
      </div>
      <button type='button' class='formation-custom-spawn-modal-x' data-custom-spawn-modal-close='1' aria-label='閉じる'>×</button>
    </header>`;
}

function renderSpawnModal(editor) {
  const state = getBuilderState(editor);
  const screen = editor.root?.querySelector?.('.formation-custom-builder-screen');
  const i = state.spawnModal;
  if (!screen || i == null || state.stage?.spawns?.[i] == null) return;
  let overlay = screen.querySelector(':scope > .formation-custom-spawn-modal');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'formation-custom-spawn-modal formation-custom-builder';
    screen.appendChild(overlay);
  }
  overlay.innerHTML = `
    <div class='formation-custom-spawn-modal-backdrop' data-custom-spawn-modal-close='1'></div>
    <div class='formation-custom-spawn-modal-card'>
      ${spawnModalHead(state)}
      <div class='formation-custom-spawn-modal-body'>${renderSpawnEditor(state.stage.spawns[i], i, state)}</div>
      <footer class='formation-custom-spawn-modal-foot'>
        <button type='button' class='is-primary' data-custom-spawn-modal-close='1'>完了</button>
      </footer>
    </div>`;
  popIn(overlay.querySelector('.formation-custom-spawn-modal-card'), { duration: 140 });
  hydrateModalThumbs(editor, overlay);
  refreshMusicButtons(editor);
}

function refreshSpawnModal(editor, focusSearchKey = null) {
  const state = getBuilderState(editor);
  const overlay = editor.root?.querySelector?.('.formation-custom-spawn-modal');
  const i = state.spawnModal;
  if (!overlay || i == null || state.stage?.spawns?.[i] == null) return false;
  const bodyEl = overlay.querySelector('.formation-custom-spawn-modal-body');
  if (!bodyEl) return false;
  const innerScroll = captureInnerScroll(bodyEl);
  const outerTop = bodyEl.scrollTop;
  bodyEl.innerHTML = renderSpawnEditor(state.stage.spawns[i], i, state);
  restoreSearchFocus(bodyEl, state, focusSearchKey);
  bodyEl.scrollTop = outerTop;
  restoreScrollTop(bodyEl, outerTop);
  restoreInnerScroll(bodyEl, innerScroll);
  // Header follows enemy / boss changes made inside the modal.
  const head = overlay.querySelector('.formation-custom-spawn-modal-head');
  if (head) head.outerHTML = spawnModalHead(state);
  hydrateModalThumbs(editor, overlay);
  refreshMusicButtons(editor);
  return true;
}

// Refresh whichever editing surface is active: the spawn overlay when open, else the tab body.
function refreshActiveEditor(editor, focusSearchKey = null) {
  const state = getBuilderState(editor);
  if (state.spawnModal != null && refreshSpawnModal(editor, focusSearchKey)) return;
  refreshBuilderBody(editor, focusSearchKey);
}

function openSpawnModal(editor, index) {
  const state = getBuilderState(editor);
  if (state.stage?.spawns?.[index] == null) return;
  state.spawnModal = index;
  state.conditionOpen = null;
  renderSpawnModal(editor);
}

function closeSpawnModal(editor) {
  const state = getBuilderState(editor);
  state.spawnModal = null;
  state.conditionOpen = null;
  editor.root?.querySelector?.('.formation-custom-spawn-modal')?.remove();
  if (editor.__customModalThumbObserver) { editor.__customModalThumbObserver.disconnect(); editor.__customModalThumbObserver = null; }
  refreshBuilderBody(editor);
}

function setBuilderTab(editor, tab) {
  const state = getBuilderState(editor);
  if (state.spawnModal != null) { state.spawnModal = null; editor.root?.querySelector?.('.formation-custom-spawn-modal')?.remove(); }
  state.tab = tab || 'basic';
  if (state.tab !== 'enemy') state.conditionOpen = null;
  const tabs = editor.root?.querySelectorAll?.('[data-custom-builder-tab]') || [];
  for (const button of tabs) button.classList.toggle('is-active', button.dataset.customBuilderTab === state.tab);
  refreshBuilderBody(editor);
}

function renderBuilderScreen(editor) {
  ensureStyle();
  const state = getBuilderState(editor);
  if (!state.stage) state.stage = createCustomStage({});
  const stage = state.stage;
  const list = editor.root?.querySelector?.('.formation-stage-list');
  if (!list) return;
  const title = editor.root.querySelector('.formation-stage-dialog header strong');
  if (title) title.textContent = '自作ステージ編集';
  const tabs = [['basic', '基本'], ['enemy', '敵出現'], ['confirm', '確認']];
  const body = renderBuilderTabBody(state);
  const statusText = state.dirty ? '未保存' : (state.savedId ? '保存済み' : '下書き');
  const statusClass = state.dirty ? 'dirty' : (state.savedId ? 'saved' : '');
  list.innerHTML = `
    <section class='formation-custom-builder-screen formation-custom-builder'>
      <header>
        <button type='button' class='is-ghost' data-custom-builder-back='1'>＜ 戻る</button>
        <div class='formation-custom-builder-heading'>
          <strong class='formation-custom-builder-name'>${safeHtml(stage.name?.trim() || '無題のステージ')}</strong>
          <span class='formation-custom-status ${statusClass}'>${safeHtml(statusText)}</span>
        </div>
        <button type='button' class='is-primary' data-custom-builder-save='1'>保存</button>
      </header>
      <div class='formation-custom-builder-tabs'>
        ${tabs.map(([id, label]) => `<button type='button' data-custom-builder-tab='${id}' class='${state.tab === id ? 'is-active' : ''}'>${safeHtml(label)}</button>`).join('')}
      </div>
      <div class='formation-custom-builder-body'>${body}</div>
    </section>`;
  popIn(list.querySelector('.formation-custom-builder-screen'), { duration: 130 });
  ensureMusicPreviewSub(editor);
  hydrateThumbs(editor);
  refreshMusicButtons(editor);
  // A full re-render rebuilds list.innerHTML (dropping any overlay); re-open the spawn editor if it
  // was open so an external re-render never silently closes it.
  if (state.spawnModal != null && state.stage?.spawns?.[state.spawnModal] != null) renderSpawnModal(editor);
}

// ---- field mutation ---------------------------------------------------------
function setField(stage, field, rawValue) {
  // Frame fields are entered in seconds; convert on write.
  const spawnFrame = field.match(/^spawns\.(\d+)\.(firstMin|firstMax|respawnMin|respawnMax)$/);
  if (spawnFrame) {
    const idx = Number(spawnFrame[1]);
    const s = stage.spawns[idx];
    if (!s) return;
    const frames = secondsToFrames(rawValue);
    if (spawnFrame[2] === 'firstMin') s.firstSpawn.minFrames = frames;
    else if (spawnFrame[2] === 'firstMax') s.firstSpawn.maxFrames = frames;
    else if (spawnFrame[2] === 'respawnMin') s.respawn.minFrames = frames;
    else if (spawnFrame[2] === 'respawnMax') s.respawn.maxFrames = frames;
    if (spawnFrame[2] === 'firstMin' && s.firstSpawn.maxFrames < s.firstSpawn.minFrames) {
      s.firstSpawn.maxFrames = s.firstSpawn.minFrames;
    } else if (spawnFrame[2] === 'firstMax' && s.firstSpawn.minFrames > s.firstSpawn.maxFrames) {
      s.firstSpawn.minFrames = s.firstSpawn.maxFrames;
    } else if (spawnFrame[2] === 'respawnMin' && s.respawn.maxFrames < s.respawn.minFrames) {
      s.respawn.maxFrames = s.respawn.minFrames;
    } else if (spawnFrame[2] === 'respawnMax' && s.respawn.minFrames > s.respawn.maxFrames) {
      s.respawn.minFrames = s.respawn.maxFrames;
    }
    return;
  }
  const path = field.split('.');
  let target = stage;
  for (let i = 0; i < path.length - 1; i++) {
    const key = /^\d+$/.test(path[i]) ? Number(path[i]) : path[i];
    target = target?.[key];
    if (!target) return;
  }
  const leaf = path[path.length - 1];
  const numericLeaves = new Set(['stageLength', 'enemyBaseHp', 'maxEnemyCount', 'count', 'hpMultiplier', 'attackMultiplier',
    'enemyId', 'backgroundId', 'enemyCastleId', 'musicId', 'bossMusicId',
    'minPercent', 'maxPercent', 'value', 'min', 'max']);
  if (leaf === 'name' || leaf === 'description') target[leaf] = String(rawValue);
  else if (numericLeaves.has(leaf)) {
    const nullable = leaf === 'musicId' || leaf === 'bossMusicId';
    target[leaf] = rawValue === '' ? (nullable ? null : target[leaf]) : Number(rawValue);
  } else target[leaf] = rawValue;
}

function syncSpawnFrameInputs(editor, field) {
  const match = String(field || '').match(/^spawns\.(\d+)\.(firstMin|firstMax|respawnMin|respawnMax)$/);
  if (!match) return;
  const index = Number(match[1]);
  const spawn = getBuilderState(editor).stage?.spawns?.[index];
  if (!spawn) return;
  const values = {
    [`spawns.${index}.firstMin`]: framesToSeconds(spawn.firstSpawn.minFrames),
    [`spawns.${index}.firstMax`]: framesToSeconds(spawn.firstSpawn.maxFrames),
    [`spawns.${index}.respawnMin`]: framesToSeconds(spawn.respawn.minFrames),
    [`spawns.${index}.respawnMax`]: framesToSeconds(spawn.respawn.maxFrames)
  };
  for (const input of editor.root?.querySelectorAll?.('.formation-custom-num[data-custom-field]') || []) {
    if (Object.prototype.hasOwnProperty.call(values, input.dataset.customField)) {
      input.value = String(values[input.dataset.customField]);
    }
  }
}

function toggleCheck(stage, field) {
  const path = field.split('.');
  let target = stage;
  for (let i = 0; i < path.length - 1; i++) {
    const key = /^\d+$/.test(path[i]) ? Number(path[i]) : path[i];
    target = target?.[key];
    if (!target) return;
  }
  const leaf = path[path.length - 1];
  target[leaf] = !target[leaf];
}

function updateChangedFieldDom(editor, field) {
  if (field === 'name') {
    const nameEl = editor.root?.querySelector?.('.formation-custom-builder-name');
    if (nameEl) nameEl.textContent = getBuilderState(editor).stage?.name?.trim() || '無題のステージ';
    return;
  }
  const match = String(field || '').match(/^spawns\.(\d+)\.enemyId$/);
  if (!match) return;
  const index = Number(match[1]);
  const spawn = getBuilderState(editor).stage?.spawns?.[index];
  const title = editor.root?.querySelector?.(`[data-custom-spawn-title='${index}'] span`);
  if (title && spawn) title.textContent = `${enemyName(spawn.enemyId)}${spawn.boss ? ' / ボス' : ''}`;
}

function exportStage(stage) {
  const json = JSON.stringify({ ...normalizeCustomStage(stage) }, null, 2);
  try {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(stage.name || 'custom-stage').replace(/[^\w\-一-龠ぁ-んァ-ヶ]/g, '_')}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {}
}

// ---- install ----------------------------------------------------------------
export function installFormationCustomStageBuilderPatch() {
  const proto = FormationEditor?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  const originalRender = proto.renderStageSelector;
  proto.renderStageSelector = function renderStageSelectorWithBuilder(...args) {
    // Bind a single delegated change listener (for the JSON import <input type=file>) once.
    if (!this.__customBuilderChangeBound && this.root) {
      this.__customBuilderChangeBound = true;
      this.root.addEventListener('change', (e) => rootChangeHandler(this, e));
      // scroll doesn't bubble → listen in the capture phase; grow the windowed picker near its bottom.
      this.root.addEventListener('scroll', (e) => {
        const scroll = e.target?.closest?.('.formation-custom-picker-scroll');
        if (scroll) maybeGrowPicker(this, scroll);
      }, true);
    }
    // Any render that is not the builder screen means we navigated away — never let a preview BGM
    // leak into another screen or into battle.
    if (this.stageSelectorState?.level !== BUILDER_LEVEL && previewingId() != null) stopPreview();
    if (this.stageSelectorState?.level === BUILDER_LEVEL) {
      // Render base scaffold, then replace the list with the builder screen.
      const result = originalRender.apply(this, args);
      try { renderBuilderScreen(this); } catch (e) { this.log?.('warn', `custom builder render failed: ${e?.message}`); }
      return result;
    }
    const result = originalRender.apply(this, args);
    if (this.stageSelectorState?.level === BATTLE_LEVEL) {
      try { renderCustomStageSection(this); } catch (e) { this.log?.('warn', `custom section render failed: ${e?.message}`); }
    }
    return result;
  };

  const originalInput = proto.onInput;
  proto.onInput = function onInputWithBuilder(e) {
    if (this.stageSelectorState?.level === BUILDER_LEVEL) {
      const searchKey = e.target?.dataset?.customPickerSearch;
      if (searchKey != null && this.root?.contains(e.target)) {
        const state = getBuilderState(this);
        state.pickerSearch[searchKey] = e.target.value;
        // Fast path: re-render only this picker's grid; fall back to a full refresh if unavailable.
        if (!refreshPickerCards(this, searchKey)) refreshActiveEditor(this, searchKey);
        return;
      }
      const field = e.target?.dataset?.customField;
      if (field && this.root?.contains(e.target)) {
        setField(getBuilderState(this).stage, field, e.target.value);
        syncSpawnFrameInputs(this, field);
        markDirty(this);
        updateChangedFieldDom(this, field);
        return;
      }
    }
    return originalInput?.call(this, e);
  };

  const originalOnClick = proto.onClick;
  proto.onClick = async function onClickWithBuilder(e) {
    const t = e.target;
    if (!this.root?.contains(t)) return originalOnClick.call(this, e);

    // ---- checkbox toggles (builder) ----
    const check = t.closest?.('[data-custom-check]');
    if (check && this.stageSelectorState?.level === BUILDER_LEVEL && t === check) {
      toggleCheck(getBuilderState(this).stage, check.dataset.customCheck);
      markDirty(this);
      refreshActiveEditor(this);
      return;
    }
    // ---- steppers ----
    const step = t.closest?.('[data-custom-step]');
    if (step) {
      e.preventDefault();
      const field = step.dataset.customField;
      const amt = Number(step.dataset.customStepAmt) || 1;
      const min = Number(step.dataset.customMin) || 0;
      const input = this.root.querySelector(`.formation-custom-num[data-custom-field='${field}']`);
      const current = Number(input?.value) || 0;
      const next = Math.max(min, current + (step.dataset.customStep === 'inc' ? amt : -amt));
      setField(getBuilderState(this).stage, field, next);
      if (input) input.value = String(next);
      syncSpawnFrameInputs(this, field);
      markDirty(this);
      updateChangedFieldDom(this, field);
      return;
    }

    // ---- BGM preview play/stop ----
    const musicToggle = t.closest?.('[data-custom-music-toggle]');
    if (musicToggle && this.stageSelectorState?.level === BUILDER_LEVEL && this.root.contains(musicToggle)) {
      e.preventDefault();
      e.stopPropagation();
      press(musicToggle);
      togglePreview(musicToggle.dataset.customMusicToggle).finally(() => refreshMusicButtons(this));
      return;
    }

    // ---- card pickers ----
    const pick = t.closest?.('[data-custom-pick]');
    if (pick && this.stageSelectorState?.level === BUILDER_LEVEL && this.root.contains(pick)) {
      e.preventDefault();
      e.stopPropagation();
      const field = pick.dataset.customField;
      const value = pick.dataset.customValue ?? '';
      setField(getBuilderState(this).stage, field, value);
      markDirty(this);
      updateChangedFieldDom(this, field);
      // Update the highlight in place so the scroll position stays exact; full re-render only as fallback.
      if (!selectPickerInPlace(this, pick, field, value)) refreshActiveEditor(this);
      return;
    }

    const clickActions = [
      ['data-custom-builder-new', () => { clearDraft(); openBuilder(this, null); }],
      ['data-custom-builder-back', () => closeBuilder(this)],
      ['data-custom-builder-tab', (el) => setBuilderTab(this, el.dataset.customBuilderTab)],
      ['data-custom-builder-edit', (el) => openBuilder(this, el.dataset.customBuilderEdit)],
      ['data-custom-builder-duplicate', (el) => { duplicateCustomStage(el.dataset.customBuilderDuplicate); this.renderStageSelector(); }],
      ['data-custom-builder-delete', (el) => { if (globalThis.confirm?.('この自作ステージを削除しますか？')) { deleteCustomStage(el.dataset.customBuilderDelete); this.renderStageSelector(); } }],
      ['data-custom-builder-export', (el) => { const s = getCustomStage(el.dataset.customBuilderExport); if (s) exportStage(s); }],
      ['data-custom-builder-add-enemy', (el) => { const r = addCustomStageToSide(el.dataset.customBuilderAddEnemy, 'enemy'); syncEditorSide(this); this.renderStageSelector(); if (!r.added) toast(this, '既に敵側に追加されています'); }],
      ['data-custom-builder-add-player', (el) => { const r = addCustomStageToSide(el.dataset.customBuilderAddPlayer, 'player'); syncEditorSide(this); this.renderStageSelector(); if (!r.added) toast(this, '既に味方側に追加されています'); }],
      ['data-custom-builder-import', () => this.root.querySelector('[data-custom-builder-import-file]')?.click()],
    ];
    for (const [attr, handler] of clickActions) {
      const el = t.closest?.(`[${attr}]`);
      if (el && this.root.contains(el)) { e.preventDefault(); e.stopPropagation(); press(el); handler(el); return; }
    }

    // ---- builder-current actions ----
    const builderActions = {
      'data-custom-builder-save': () => saveFromBuilder(this),
      'data-custom-spawn-add': () => { const st = getBuilderState(this); st.stage.spawns.push(createSpawn({ enemyId: enemyOptions()[0]?.id ?? 0 })); st.conditionOpen = null; markDirty(this); refreshBuilderBody(this); openSpawnModal(this, st.stage.spawns.length - 1); },
    };
    for (const [attr, handler] of Object.entries(builderActions)) {
      const el = t.closest?.(`[${attr}]`);
      if (el && this.root.contains(el)) { e.preventDefault(); e.stopPropagation(); press(el); handler(); return; }
    }

    // ---- spawn editor overlay ----
    const modalClose = t.closest?.('[data-custom-spawn-modal-close]');
    if (modalClose && this.root.contains(modalClose)) { e.preventDefault(); e.stopPropagation(); press(modalClose); closeSpawnModal(this); return; }
    // ---- spawn row ops ----
    const spawnToggle = t.closest?.('[data-custom-spawn-toggle]');
    if (spawnToggle && this.stageSelectorState?.level === BUILDER_LEVEL) { e.preventDefault(); e.stopPropagation(); press(spawnToggle); openSpawnModal(this, Number(spawnToggle.dataset.customSpawnToggle)); return; }
    const spawnDup = t.closest?.('[data-custom-spawn-duplicate]');
    if (spawnDup) { e.preventDefault(); const st = getBuilderState(this); const i = Number(spawnDup.dataset.customSpawnDuplicate); const src = st.stage.spawns[i]; if (src) { const copy = { ...JSON.parse(JSON.stringify(src)), id: createSpawn({}).id }; st.stage.spawns.splice(i + 1, 0, copy); st.spawnOpen = i + 1; } markDirty(this); refreshBuilderBody(this); return; }
    const spawnRemove = t.closest?.('[data-custom-spawn-remove]');
    if (spawnRemove) { e.preventDefault(); const st = getBuilderState(this); const i = Number(spawnRemove.dataset.customSpawnRemove); st.stage.spawns.splice(i, 1); st.spawnOpen = null; st.conditionOpen = null; markDirty(this); refreshBuilderBody(this); return; }
    const spawnUp = t.closest?.('[data-custom-spawn-up]');
    if (spawnUp) { e.preventDefault(); const st = getBuilderState(this); const i = Number(spawnUp.dataset.customSpawnUp); moveSpawn(st.stage, i, -1); if (st.spawnOpen === i) st.spawnOpen = Math.max(0, i - 1); st.conditionOpen = null; markDirty(this); refreshBuilderBody(this); return; }
    const spawnDown = t.closest?.('[data-custom-spawn-down]');
    if (spawnDown) { e.preventDefault(); const st = getBuilderState(this); const i = Number(spawnDown.dataset.customSpawnDown); moveSpawn(st.stage, i, 1); if (st.spawnOpen === i) st.spawnOpen = Math.min(st.stage.spawns.length - 1, i + 1); st.conditionOpen = null; markDirty(this); refreshBuilderBody(this); return; }
    const spawnCond = t.closest?.('[data-custom-spawn-cond]');
    if (spawnCond) {
      e.preventDefault();
      const state = getBuilderState(this);
      const index = Number(spawnCond.dataset.customSpawnCond);
      state.conditionOpen = state.conditionOpen === index ? null : index;
      refreshActiveEditor(this);
      return;
    }

    // ---- import file ----
    if (t.matches?.('[data-custom-builder-import-file]')) { /* change handled below */ }

    return originalOnClick.call(this, e);
  };

}

// JSON import via change event (delegated on the editor root). Imports always mint a new id so an
// existing stage is never silently overwritten.
function rootChangeHandler(editor, e) {
  const input = e.target;
  if (!input?.dataset || input.dataset.customBuilderImportFile === undefined) return;
  const file = input.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      const stage = createAndSaveCustomStage({ ...normalizeCustomStage(parsed), id: undefined });
      toast(editor, `「${stage.name}」を読み込みました`);
      editor.renderStageSelector();
    } catch { toast(editor, 'JSONの読み込みに失敗しました'); }
  };
  reader.readAsText(file);
  input.value = '';
}

function moveSpawn(stage, index, dir) {
  const j = index + dir;
  if (j < 0 || j >= stage.spawns.length) return;
  const [item] = stage.spawns.splice(index, 1);
  stage.spawns.splice(j, 0, item);
}

function saveFromBuilder(editor) {
  const state = getBuilderState(editor);
  const result = validateCustomStage(state.stage, { resolvers: assetResolvers() });
  if (!result.ok) { state.tab = 'confirm'; editor.renderStageSelector(); toast(editor, '保存できません: 確認タブを見てください'); return; }
  const saved = saveCustomStage(state.stage);
  state.stage = saved;
  state.savedId = saved.id;
  state.dirty = false;
  clearDraft();
  const status = editor.root?.querySelector?.('.formation-custom-status');
  if (status) { status.textContent = '保存済み'; status.className = 'formation-custom-status saved'; }
  toast(editor, '保存しました');
}

// Sync the existing panel's in-memory state with storage so its list reflects added custom stages.
function syncEditorSide(editor) {
  const cfg = readBattleConfig();
  if (editor.customStageBattle) {
    editor.customStageBattle.enemyStageIds = cfg.enemyStageIds;
    editor.customStageBattle.playerStageIds = cfg.playerStageIds;
  }
  try {
    const built = typeof editor.getCustomStageBattleConfig === 'function' ? editor.getCustomStageBattleConfig() : null;
    if (built) globalThis['__CUSTOM_STAGE_BATTLE_CONFIG__'] = built;
  } catch {}
}

function toast(editor, message) {
  try {
    const host = editor.root;
    if (!host) return;
    let el = host.querySelector('.formation-custom-toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'formation-custom-toast';
      el.style.cssText = 'position:absolute;left:50%;bottom:16px;transform:translateX(-50%);z-index:50;background:#120700;color:#fff;font-weight:1000;padding:10px 16px;border:3px solid #000;border-radius:999px;box-shadow:0 4px 0 #000;pointer-events:none;max-width:90%';
      host.appendChild(el);
    }
    el.textContent = message;
    el.style.opacity = '1';
    clearTimeout(el.__t);
    el.__t = setTimeout(() => { el.style.opacity = '0'; }, 1800);
  } catch {}
}

installFormationCustomStageBuilderPatch();
