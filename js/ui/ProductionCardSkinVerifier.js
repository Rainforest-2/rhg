import {
  BCU_UNI_CARD_PART,
  BCU_UNI_IMGCUT_PATH,
  BCU_SLOT_FRAME_PATH,
  PRODUCTION_CARD_CANVAS,
  PRODUCTION_CARD_VIEW,
  PRODUCTION_CARD_SKIN
} from './ProductionCardSkin.js';
import { BattleEconomy } from '../battle/BattleEconomy.js';

const ok = (details = null) => ({ ok: true, errors: [], details });
const ng = (...errors) => ({ ok: false, errors, details: null });
const read = async (p, enc = 'utf8') => (await import('node:fs/promises')).readFile(new URL(`../../${p}`, import.meta.url), enc);
const mustNotMatch = (text, re, msg) => (re.test(text) ? [msg] : []);
const parsePngSize = (buf) => ({ w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) });

function parseUniImgcut(text) {
  return String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).map((v) => v.trim()).filter(Boolean)
    .map((line) => line.split(','))
    .filter((cols) => cols.length >= 4 && cols.slice(0, 4).every((v) => Number.isFinite(Number(v))))
    .map((cols, index) => ({ x: Number(cols[0]), y: Number(cols[1]), w: Number(cols[2]), h: Number(cols[3]), label: cols.slice(4).join(',').trim(), index }));
}

export async function verifyUniImgcutPartIsBcuCardSource() {
  const text = await read('public/assets/bcu/000001/org/data/uni.imgcut');
  const part = parseUniImgcut(text)[0];
  const expected = BCU_UNI_CARD_PART;
  const same = part && part.x === expected.x && part.y === expected.y && part.w === expected.w && part.h === expected.h;
  return same ? ok({ part, path: BCU_UNI_IMGCUT_PATH }) : ng(`uni.imgcut[0] mismatch: ${JSON.stringify(part)} expected ${JSON.stringify(expected)}`);
}

export async function verifyRepresentativeCatPngIsRaw128ButCanvasUsesCutPart() {
  const buf = await read('public/assets/bcu/000004/org/unit/000/f/uni000_f00.png', null);
  const size = parsePngSize(buf);
  const errors = [];
  if (size.w !== 128 || size.h !== 128) errors.push(`representative cat png expected raw 128x128, got ${size.w}x${size.h}`);
  if (PRODUCTION_CARD_CANVAS.w !== BCU_UNI_CARD_PART.w || PRODUCTION_CARD_CANVAS.h !== BCU_UNI_CARD_PART.h) errors.push(`canvas must use unicut card part ${BCU_UNI_CARD_PART.w}x${BCU_UNI_CARD_PART.h}`);
  return errors.length ? ng(...errors) : ok({ raw: size, canvas: PRODUCTION_CARD_CANVAS, part: BCU_UNI_CARD_PART });
}

export async function verifyProductionCardCssMatchesBcuCutRatio() {
  const css = await read('css/style.css');
  const errors = [];
  errors.push(...mustNotMatch(css, /aspect-ratio\s*:\s*1\s*\/\s*1/i, 'aspect-ratio 1/1 found'));
  errors.push(...mustNotMatch(css, /height\s*:\s*var\(--prod-card-w\)/i, 'height tied to card width'));
  if (!/--prod-card-w\s*:\s*116px/.test(css)) errors.push('prod card width should remain 116px view size');
  if (!/--prod-card-h\s*:\s*89\.64px/.test(css)) errors.push('prod card height should match 110:85 BCU cut ratio at 116px width');
  const ratio = PRODUCTION_CARD_VIEW.w / PRODUCTION_CARD_VIEW.h;
  const bcuRatio = BCU_UNI_CARD_PART.w / BCU_UNI_CARD_PART.h;
  if (Math.abs(ratio - bcuRatio) > 0.001) errors.push(`view ratio ${ratio} differs from BCU cut ratio ${bcuRatio}`);
  return errors.length ? ng(...errors) : ok({ view: PRODUCTION_CARD_VIEW, bcuRatio });
}

export async function verifyProductionCardSkinUsesBcuCutNotFullRawPng() {
  const source = await read('js/ui/ProductionCardSkin.js');
  const errors = [];
  if (!/import \{ BcuImgCut \} from '\.\/BcuImgCut\.js';/.test(source)) errors.push('ProductionCardSkin must load uni.imgcut through BcuImgCut');
  if (!/BCU_UNI_CARD_PART = Object\.freeze\(\{ x: 9, y: 21, w: 110, h: 85/.test(source)) errors.push('BCU unicut card part constant missing');
  if (!/ctx\.drawImage\(image, part\.x, part\.y, part\.w, part\.h, 0, 0, PRODUCTION_CARD_CANVAS\.w, PRODUCTION_CARD_CANVAS\.h\)/.test(source)) errors.push('card draw must crop with uni.imgcut part into same-ratio canvas');
  errors.push(...mustNotMatch(source, /cardSourceRect:\s*\{\s*x:\s*0,\s*y:\s*0,\s*w:\s*128,\s*h:\s*128/, 'raw 128x128 cardSourceRect must not be used'));
  errors.push(...mustNotMatch(source, /cardCanvasSize:\s*\{\s*w:\s*128,\s*h:\s*128/, 'raw 128x128 canvas must not be used'));
  errors.push(...mustNotMatch(source, /drawImage\(icon,\s*0,\s*0,\s*PRODUCTION_CARD_CANVAS\.w,\s*PRODUCTION_CARD_CANVAS\.h\)/, 'full icon stretched to canvas'));
  return errors.length ? ng(...errors) : ok();
}

export async function verifyDogAndEmptyUseSameBcuFrameAndGeometryAsCat() {
  const source = await read('js/ui/ProductionCardSkin.js');
  const errors = [];
  if (!source.includes(BCU_SLOT_FRAME_PATH)) errors.push('BCU slot frame asset path is not used');
  if (!/drawDogCard\(ctx, icon\) \{\s*this\.drawSlotFrame\(ctx\);\s*this\.drawContainedIcon\(ctx, icon, PRODUCTION_CARD_SKIN\.contentRect\);\s*\}/s.test(source)) errors.push('dog card must draw same slot frame then contained enemy icon');
  if (!/drawEmptyCard\(ctx\) \{\s*this\.drawSlotFrame\(ctx\);\s*\}/s.test(source)) errors.push('empty card must draw same BCU slot frame');
  if (PRODUCTION_CARD_SKIN.cardCanvasSize.w !== PRODUCTION_CARD_CANVAS.w || PRODUCTION_CARD_SKIN.cardCanvasSize.h !== PRODUCTION_CARD_CANVAS.h) errors.push('skin cardCanvasSize must equal production canvas');
  return errors.length ? ng(...errors) : ok({ frame: BCU_SLOT_FRAME_PATH, canvas: PRODUCTION_CARD_CANVAS, contentRect: PRODUCTION_CARD_SKIN.contentRect });
}

export async function verifyEnemyIconContainKeepsAspectRatio() {
  const source = await read('js/ui/ProductionCardSkin.js');
  const errors = [];
  if (!/const fit = Math\.min\(rect\.w \/ sw, rect\.h \/ sh\)/.test(source)) errors.push('enemy icon must use contain fit ratio');
  if (!/ctx\.drawImage\(icon, 0, 0, sw, sh, dx, dy, dw, dh\)/.test(source)) errors.push('enemy icon must use source full image and contained destination');
  return errors.length ? ng(...errors) : ok({ contentRect: PRODUCTION_CARD_SKIN.contentRect });
}

export async function verifyCooldownProgressIsLeftToRightAndBcuSized() {
  const econ = new BattleEconomy({ startMoney: 9999 });
  const unit = { slotId: 'unit-0', cost: 10, cooldownMs: 3000 };
  econ.produce(unit);
  const s1 = econ.getStatus(unit);
  econ.tick(1500);
  const s2 = econ.getStatus(unit);
  econ.tick(1500);
  const s3 = econ.getStatus(unit);
  const fill = PRODUCTION_CARD_SKIN.cooldownFillRect;
  const w1 = Math.floor(fill.w * s1.cooldownProgressRatio);
  const w2 = Math.floor(fill.w * s2.cooldownProgressRatio);
  const w3 = Math.floor(fill.w * s3.cooldownProgressRatio);
  const errors = [];
  if (s1.cooldownRemainingRatio !== 1 || s1.cooldownProgressRatio !== 0 || w1 !== 0) errors.push('cooldown at 3000ms should be 0% fill');
  if (Math.abs(s2.cooldownRemainingRatio - 0.5) > 1e-9 || Math.abs(s2.cooldownProgressRatio - 0.5) > 1e-9 || w2 !== Math.floor(fill.w * 0.5)) errors.push('cooldown at 1500ms should be 50% fill');
  if (s3.cooldownRemainingRatio !== 0 || s3.cooldownProgressRatio !== 1 || w3 !== fill.w) errors.push('cooldown at 0ms should be 100% progress');
  return errors.length ? ng(...errors) : ok({ fillRect: fill, widths: [w1, w2, w3] });
}

export async function verifyProductionCardSkinDrawsCooldownFromLeftEdgeOnly() {
  const source = await read('js/ui/ProductionCardSkin.js');
  const errors = [];
  if (!/const fillW = Math\.floor\(fill\.w \* progress\)/.test(source)) errors.push('cooldown fill width formula missing');
  if (!/ctx\.fillRect\(fill\.x, fill\.y, fillW, fill\.h\)/.test(source)) errors.push('cooldown fill must start at fill.x and grow width');
  errors.push(...mustNotMatch(source, /barX \+ barW - fillW|fill\.x \+ fill\.w - fillW|1\s*-\s*cooldownProgressRatio/, 'right-to-left cooldown drawing found'));
  return errors.length ? ng(...errors) : ok();
}

export async function verifyPlayerBarFeedsProgressRatioToBothRows() {
  const source = await read('js/ui/PlayerProductionBar.js');
  const errors = [];
  if (!/cooldownProgressRatio: backStatus\?\.cooldownProgressRatio \?\? 1/.test(source)) errors.push('back row cooldownProgressRatio feed missing');
  if (!/cooldownProgressRatio: frontStatus\?\.cooldownProgressRatio \?\? 1/.test(source)) errors.push('front row cooldownProgressRatio feed missing');
  if (/cooldownRatio:\s*entry\./.test(source)) errors.push('legacy cooldownRatio still passed to skin');
  if (!/backCanvas\.width = PRODUCTION_CARD_CANVAS\.w[\s\S]*frontCanvas\.height = PRODUCTION_CARD_CANVAS\.h/.test(source)) errors.push('canvas intrinsic size must come from production card constants');
  return errors.length ? ng(...errors) : ok();
}

export async function verifyNoInnerFrameOrCostBandRegression() {
  const source = await read('js/ui/ProductionCardSkin.js');
  const errors = [];
  errors.push(...mustNotMatch(source, /drawIconWindow\s*\(/, 'drawIconWindow regression'));
  errors.push(...mustNotMatch(source, /drawCostBand\s*\(/, 'drawCostBand regression'));
  errors.push(...mustNotMatch(source, /strokeRect\s*\(/, 'strokeRect inner frame regression'));
  return errors.length ? ng(...errors) : ok();
}

export async function runProductionCardSkinVerifier() {
  const checks = [
    verifyUniImgcutPartIsBcuCardSource,
    verifyRepresentativeCatPngIsRaw128ButCanvasUsesCutPart,
    verifyProductionCardCssMatchesBcuCutRatio,
    verifyProductionCardSkinUsesBcuCutNotFullRawPng,
    verifyDogAndEmptyUseSameBcuFrameAndGeometryAsCat,
    verifyEnemyIconContainKeepsAspectRatio,
    verifyCooldownProgressIsLeftToRightAndBcuSized,
    verifyProductionCardSkinDrawsCooldownFromLeftEdgeOnly,
    verifyPlayerBarFeedsProgressRatioToBothRows,
    verifyNoInnerFrameOrCostBandRegression
  ];
  const results = await Promise.all(checks.map(async (fn) => ({ name: fn.name, ...(await fn()) })));
  const failed = results.filter((r) => !r.ok);
  return { ok: failed.length === 0, results, failed };
}
