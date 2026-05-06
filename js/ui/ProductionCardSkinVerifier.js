import { PRODUCTION_CARD_CANVAS, PRODUCTION_CARD_VIEW } from './ProductionCardSkin.js';

const ok = (details = null) => ({ ok: true, errors: [], details });
const ng = (...errors) => ({ ok: false, errors, details: null });
const read = async (p, enc='utf8') => (await import('node:fs/promises')).readFile(new URL(`../../${p}`, import.meta.url), enc);

const mustNotMatch = (s, re, msg) => (re.test(s) ? [msg] : []);

export async function verifyProductionCardIsNotSquare() { return (PRODUCTION_CARD_CANVAS.w !== PRODUCTION_CARD_CANVAS.h && PRODUCTION_CARD_VIEW.w !== PRODUCTION_CARD_VIEW.h) ? ok({ canvas: PRODUCTION_CARD_CANVAS, view: PRODUCTION_CARD_VIEW }) : ng('production card is square'); }
export async function verifyCardCssUsesNonSquareDimensions() { const c = await read('css/style.css'); const errs=[]; errs.push(...mustNotMatch(c,/aspect-ratio\s*:\s*1\s*\/\s*1/i,'aspect-ratio 1/1 found')); errs.push(...mustNotMatch(c,/height\s*:\s*var\(--prod-card-w\)/i,'height tied to width')); return errs.length?ng(...errs):ok(); }
export async function verifyNoInnerIconWindowOrCostBand() { const s = await read('js/ui/ProductionCardSkin.js'); const errs=[]; errs.push(...mustNotMatch(s,/drawIconWindow\s*\(/,'drawIconWindow still exists')); errs.push(...mustNotMatch(s,/drawCostBand\s*\(/,'drawCostBand still exists')); errs.push(...mustNotMatch(s,/strokeRect\s*\(/,'strokeRect inner frame found')); return errs.length?ng(...errs):ok(); }
export async function verifyNoBlackCostBackground() { const s = await read('js/ui/ProductionCardSkin.js'); const errs=[]; errs.push(...mustNotMatch(s,/fillRect\([^\n]*cost/i,'cost background fillRect detected')); errs.push(...mustNotMatch(s,/['\"]#070707['\"]|['\"]#000000['\"]/i,'black cost band color detected')); return errs.length?ng(...errs):ok(); }
export async function verifyFallbackPolicy() { const [bar,skin] = await Promise.all([read('js/ui/PlayerProductionBar.js'),read('js/ui/ProductionCardSkin.js')]); const errs=[]; if(!/console\.warn|\.warn\?\./.test(bar+skin)) errs.push('missing warn on load failure'); if(!/iconLoadFailed/.test(bar+skin)) errs.push('fallback path not explicit'); if(/drawEmpty\([^)]*\)\s*\{[^}]*#333|#ddd/i.test(skin)) errs.push('gray placeholder in normal path'); return errs.length?ng(...errs):ok(); }
export async function verifyCooldownVisuals() { const s = await read('js/ui/ProductionCardSkin.js'); const hasGray=/rgba\(110,110,110,.42\)|gray/i.test(s); const hasBlue=/44,128,255|cooldownBar/i.test(s); return (hasGray&&hasBlue)?ok():ng('cooldown gray overlay / blue bar missing'); }
export async function verifyCatDogUseSameCardSizeAndBackRowRules() { const s = await read('js/ui/PlayerProductionBar.js'); const errs=[]; if(!/backCanvas\.width = PRODUCTION_CARD_CANVAS\.w[\s\S]*frontCanvas\.width = PRODUCTION_CARD_CANVAS\.w/.test(s)) errs.push('cat/dog canvas size mismatch risk'); if(!/is-back[\s\S]*pointer-events:none/.test(await read('css/style.css'))) errs.push('back row pointer rule missing'); if(!/getStatus\(frontUnit\)|getStatus\(backUnit\)/.test(s)) errs.push('economy status not merged'); if(!/cooldownRatio:\s*backStatus\?\.cooldownRatio/.test(s)) errs.push('back row cooldownRatio not passed'); return errs.length?ng(...errs):ok(); }

export async function verifyProductionCardAssetPresence() {
  const fs = await import('node:fs/promises');
  const files = [
    'public/assets/bcu/000001/org/page/uni.png','public/assets/bcu/000001/org/page/uni_box.png','public/assets/bcu/000001/org/page/uni_c.png','public/assets/bcu/000001/org/page/uni_f.png','public/assets/bcu/000001/org/page/uni_s.png','public/assets/bcu/000001/org/data/uni.imgcut'
  ];
  const missing=[];
  for (const f of files) { try { await fs.access(new URL(`../../${f}`, import.meta.url)); } catch { missing.push(f); } }
  return missing.length?ng(...missing.map((m)=>`missing asset: ${m}`)):ok();
}
