import { PRODUCTION_CARD_CANVAS, PRODUCTION_CARD_VIEW, PRODUCTION_CARD_SKIN } from './ProductionCardSkin.js';

const ok = (details = null) => ({ ok: true, errors: [], details });
const ng = (...errors) => ({ ok: false, errors, details: null });
const read = async (p, enc='utf8') => (await import('node:fs/promises')).readFile(new URL(`../../${p}`, import.meta.url), enc);
const mustNotMatch = (s, re, msg) => (re.test(s) ? [msg] : []);

export async function verifyProductionCardIsNotSquare() { return (PRODUCTION_CARD_CANVAS.w !== PRODUCTION_CARD_CANVAS.h && PRODUCTION_CARD_VIEW.w !== PRODUCTION_CARD_VIEW.h) ? ok({ canvas: PRODUCTION_CARD_CANVAS, view: PRODUCTION_CARD_VIEW }) : ng('production card is square'); }
export async function verifyCardCssUsesNonSquareDimensions() { const c = await read('css/style.css'); const errs=[]; errs.push(...mustNotMatch(c,/aspect-ratio\s*:\s*1\s*\/\s*1/i,'aspect-ratio 1/1 found')); errs.push(...mustNotMatch(c,/height\s*:\s*var\(--prod-card-w\)/i,'height tied to width')); return errs.length?ng(...errs):ok(); }
export async function verifyNoGrayCssCardBackground() { const c = await read('css/style.css'); const errs=[]; if(/\.prod-card[^\n]*\{[^}]*background\s*:\s*rgba\([^)]*(?:128|120|100)/is.test(c)) errs.push('prod-card gray rgba background found'); if(/\.prod-card\.is-front[^\n]*\{[^}]*opacity\s*:\s*\./is.test(c)) errs.push('front card opacity should stay full'); return errs.length?ng(...errs):ok(); }
export async function verifyNoInnerIconWindowOrCostBand() { const s = await read('js/ui/ProductionCardSkin.js'); const errs=[]; errs.push(...mustNotMatch(s,/drawIconWindow\s*\(/,'drawIconWindow still exists')); errs.push(...mustNotMatch(s,/drawCostBand\s*\(/,'drawCostBand still exists')); errs.push(...mustNotMatch(s,/strokeRect\s*\(/,'strokeRect inner frame found')); return errs.length?ng(...errs):ok(); }
export async function verifyCatPngDirectDrawAndNoUniComposite() { const s = await read('js/ui/ProductionCardSkin.js'); const errs=[]; if(!/unitDef\.faction === 'cat'/.test(s)) errs.push('cat path split missing'); if(!/drawCatCard\([\s\S]*ctx\.drawImage\(icon, 0, 0, PRODUCTION_CARD_CANVAS\.w, PRODUCTION_CARD_CANVAS\.h\)/.test(s)) errs.push('cat png direct draw missing'); if(/uni_box|uni_c|uni_f|uni_s/.test(s)) errs.push('forbidden uni composite asset still referenced'); return errs.length?ng(...errs):ok(); }
export async function verifyDogAndEmptyCardWhiteBackgroundAndSharedSize() { const [skin, bar] = await Promise.all([read('js/ui/ProductionCardSkin.js'), read('js/ui/PlayerProductionBar.js')]); const errs=[]; if(!/drawDogCard[\s\S]*fillStyle = '#fff'/.test(skin)) errs.push('dog white background missing'); if(!/drawEmptyCard\(ctx\) \{ this\.drawDogCard\(ctx, null\); \}/.test(skin)) errs.push('empty card shared dog ratio path missing'); if(!/backCanvas\.width = PRODUCTION_CARD_CANVAS\.w[\s\S]*frontCanvas\.width = PRODUCTION_CARD_CANVAS\.w/.test(bar)) errs.push('front/back canvas width mismatch risk'); if(!/backCanvas\.height = PRODUCTION_CARD_CANVAS\.h[\s\S]*frontCanvas\.height = PRODUCTION_CARD_CANVAS\.h/.test(bar)) errs.push('front/back canvas height mismatch risk'); return errs.length?ng(...errs):ok(); }
export async function verifyCooldownDirectionAndColor() { const s = await read('js/ui/ProductionCardSkin.js'); const errs=[]; if(/1\s*-\s*cooldownRatio|1\s*-\s*ratio/.test(s)) errs.push('reverse cooldown math found'); if(!/Math\.floor\(s\.cooldownBarW \* ratio\)/.test(s)) errs.push('left-to-right fill width formula missing'); if(!/cooldownFillColor:\s*'#35d8ff'/.test(s)) errs.push('cyan cooldown fill color missing'); if(!/cooldownTrackColor:\s*'#050505'/.test(s)) errs.push('dark cooldown track missing'); if(!/ratio < 1 && !state\.cooldownReady/.test(s)) errs.push('overlay should not appear in normal ready state'); return errs.length?ng(...errs):ok(); }
export async function verifyFrontBackInteractionAndCooldownFeed() { const s = await read('js/ui/PlayerProductionBar.js'); const errs=[]; if(!/front:\s*\{[\s\S]*interactive:\s*!!frontUnit/.test(s)) errs.push('front interactivity rule missing'); if(!/back:\s*\{[\s\S]*interactive:\s*false/.test(s)) errs.push('back noninteractive rule missing'); if(!/cooldownRatio:\s*backStatus\?\.cooldownRatio \?\? 0/.test(s)) errs.push('back cooldown ratio feed missing'); if(!/cooldownRatio:\s*frontStatus\?\.cooldownRatio \?\? 0/.test(s)) errs.push('front cooldown ratio feed missing'); return errs.length?ng(...errs):ok(); }
export async function verifyApplyBattlePathNotTouched() { const s = await read('js/ui/PlayerProductionBar.js'); return /requestPlayerSpawn/.test(s) ? ok() : ng('requestPlayerSpawn path missing'); }

export async function verifyProductionCardAssetPresence() {
  const fs = await import('node:fs/promises');
  const files = ['public/assets/bcu/000001/org/page/uni.png','public/assets/bcu/000001/org/page/uni_box.png','public/assets/bcu/000001/org/page/uni_c.png','public/assets/bcu/000001/org/page/uni_f.png','public/assets/bcu/000001/org/page/uni_s.png','public/assets/bcu/000001/org/data/uni.imgcut'];
  const missing=[];
  for (const f of files) { try { await fs.access(new URL(`../../${f}`, import.meta.url)); } catch { missing.push(f); } }
  return missing.length?ng(...missing.map((m)=>`missing asset: ${m}`)):ok();
}

export async function runProductionCardSkinVerifier() {
  const checks = [
    verifyProductionCardIsNotSquare, verifyCardCssUsesNonSquareDimensions, verifyNoGrayCssCardBackground,
    verifyNoInnerIconWindowOrCostBand, verifyCatPngDirectDrawAndNoUniComposite,
    verifyDogAndEmptyCardWhiteBackgroundAndSharedSize, verifyCooldownDirectionAndColor,
    verifyFrontBackInteractionAndCooldownFeed, verifyApplyBattlePathNotTouched, verifyProductionCardAssetPresence
  ];
  const results = await Promise.all(checks.map(async (fn) => ({ name: fn.name, ...(await fn()) })));
  const failed = results.filter((r) => !r.ok);
  return { ok: failed.length === 0, results, failed };
}
