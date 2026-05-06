import { PRODUCTION_CARD_CANVAS, PRODUCTION_CARD_VIEW } from './ProductionCardSkin.js';

const ok = (details = null) => ({ ok: true, errors: [], details });
const ng = (...errors) => ({ ok: false, errors, details: null });
const read = async (p) => {
  const fs = await import('node:fs/promises');
  return fs.readFile(new URL(`../../${p}`, import.meta.url), 'utf8');
};

export async function verifyProductionCardIsNotSquare() { return (PRODUCTION_CARD_CANVAS.w !== PRODUCTION_CARD_CANVAS.h && PRODUCTION_CARD_VIEW.w !== PRODUCTION_CARD_VIEW.h) ? ok({ canvas: PRODUCTION_CARD_CANVAS, view: PRODUCTION_CARD_VIEW }) : ng('production card is square'); }
export async function verifyUniImgcutIconPartIsNotUsedAsFullCardFrame() { const [p, s] = await Promise.all([read('js/ui/PlayerProductionBar.js'), read('js/ui/ProductionCardSkin.js')]); return /uniCut\.parts\[0\].*CARD|uniCut\.parts\[0\].*PRODUCTION_CARD_CANVAS|this\.uniCut\.draw\(/.test(p + s) ? ng('uni.imgcut icon crop used as full card frame') : ok(); }
export async function verifyProductionCardLoadsBoxAndFrameAssets() { const [p, s] = await Promise.all([read('js/ui/PlayerProductionBar.js'), read('js/ui/ProductionCardSkin.js')]); return (s.includes('uni_box.png') && s.includes('uni.png') && s.includes('uni.imgcut') && p.includes('ProductionCardSkin')) ? ok() : ng('missing production card assets / usage'); }
export async function verifyProductionCardDrawsBlackFrameWhiteIconWindowAndCostBand() { const s = await read('js/ui/ProductionCardSkin.js'); return (s.includes('drawFrame') && s.includes('drawIconWindow') && s.includes('drawCostBand') && s.includes("'#050505'") && s.includes("'#f4f4f4'") && s.includes("'#070707'")) ? ok() : ng('missing frame/window/cost band drawing'); }
export async function verifyRealUnitCardNeverUsesGrayPlaceholder() { const s = await read('js/ui/ProductionCardSkin.js'); return (s.includes('#333') || s.includes('#ddd')) ? ng('gray placeholder colors detected') : ok(); }
export async function verifyCostIsDrawnInYellowOrBcuSprite() { const s = await read('js/ui/ProductionCardSkin.js'); return (s.includes('drawCostRight') && s.includes("'#ffd400'") && s.includes('strokeText')) ? ok() : ng('missing cost draw policy'); }
export async function verifyEmptyCardIsSubtleNotFullGraySquare() { const s = await read('js/ui/ProductionCardSkin.js'); return (s.includes('drawEmpty') && !s.includes("fillStyle = '#333'") && !s.includes("fillStyle = '#ddd'")) ? ok() : ng('empty card gray square detected'); }
export async function verifyCardCssUsesNonSquareDimensions() { const c = await read('css/style.css'); return (c.includes('--prod-card-w:116px') && c.includes('--prod-card-h:88px') && c.includes('height:var(--prod-card-h)') && !c.includes('aspect-ratio:1/1') && !c.includes('height:var(--prod-card-w')) ? ok() : ng('css still square or inconsistent'); }
