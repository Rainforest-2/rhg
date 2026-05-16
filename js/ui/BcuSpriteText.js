import { BcuImgCut } from './BcuImgCut.js';
import { getBcuAssetDatabase } from '../bcu/BcuAssetDatabase.js';

const BCU_BATTLE_UI_BUNDLE_REF = Object.freeze({ bundleKey: 'ui:battle', bundlePath: 'public/assets/bundles/ui/battle-ui.zip' });

const loadImage = (src) => new Promise((res, rej) => {
  const i = new Image();
  i.onload = () => res(i);
  i.onerror = () => rej(new Error(`image load failed:${src}`));
  i.src = src;
});

function getSemanticProvider() {
  try { return getBcuAssetDatabase()?.semanticProvider || null; } catch { return null; }
}

async function loadBundleImage(provider, internalPath) {
  const url = await provider.createObjectUrl(BCU_BATTLE_UI_BUNDLE_REF, internalPath, 'image/png');
  try {
    const image = await loadImage(url);
    image.bcuObjectUrl = url;
    return image;
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

export class BcuSpriteText {
  constructor(log = console, resolveAssetPath = (v) => v) {
    this.log = log;
    this.resolveAssetPath = resolveAssetPath;
    this.ready = false;
    this.map = null;
    this.source = null;
  }
  normalizeLabel(label) { return String(label || '').normalize('NFKC').replace(/\s+/g, '').trim(); }
  findByNormExact(imgcut, norm) { return imgcut.parts.find((p) => this.normalizeLabel(p.label) === norm) || null; }
  findByNormIncludes(imgcut, required, excluded = []) {
    return imgcut.parts.find((p) => {
      const n = this.normalizeLabel(p.label);
      return required.every((r) => n.includes(r)) && excluded.every((x) => !n.includes(x));
    }) || null;
  }

  async init() {
    try {
      const provider = getSemanticProvider();
      if (provider) {
        this.img = await loadBundleImage(provider, 'img001.png');
        this.imgcut = BcuImgCut.parse(await provider.readTextByBundleRef(BCU_BATTLE_UI_BUNDLE_REF, 'img001.imgcut'));
        this.sign = await loadBundleImage(provider, 'moneySign.png');
        this.signcut = BcuImgCut.parse(await provider.readTextByBundleRef(BCU_BATTLE_UI_BUNDLE_REF, 'moneySign.imgcut'));
        this.source = 'semantic-bundle:ui:battle';
      } else {
        if (globalThis.__BCU_DB__?.semanticMode === 'semantic-strict') throw new Error('semantic provider missing for ui:battle');
        this.img = await loadImage(this.resolveAssetPath('./public/assets/bcu/000001/org/page/img001.png'));
        this.imgcut = await BcuImgCut.load(this.resolveAssetPath('./public/assets/bcu/000001/org/page/img001.imgcut'));
        this.sign = await loadImage(this.resolveAssetPath('./public/assets/bcu/110504/org/page/moneySign.png'));
        this.signcut = await BcuImgCut.load(this.resolveAssetPath('./public/assets/bcu/110504/org/page/moneySign.imgcut'));
        this.source = 'raw-diagnostics:public/assets/bcu/page';
      }
      this.map = this.buildSemanticMap();
      this.ready = true;
      globalThis.__BCU_SPRITE_TEXT_DEBUG__ = { ready: true, source: this.source, missing: this.getMissingMapParts() };
    } catch (e) {
      this.ready = false;
      this.log.warn?.('[BcuSpriteText] fallback', e);
      globalThis.__BCU_SPRITE_TEXT_DEBUG__ = { ready: false, source: this.source, reason: e?.message || String(e) };
    }
  }

  buildSemanticMap() {
    const bigDigits = Array.from({ length: 10 }, (_, d) => this.findByNormExact(this.imgcut, `金額数字大${d}`));
    const smallDigitsOn = Array.from({ length: 10 }, (_, d) => this.findByNormExact(this.imgcut, `金額数字小${d}`));
    const smallDigitsOff = Array.from({ length: 10 }, (_, d) => this.findByNormExact(this.imgcut, `金額数字小(暗転)${d}`));
    return {
      bigDigits,
      bigSlash: this.findByNormExact(this.imgcut, '金額数字大/'),
      bigYen: this.findByNormIncludes(this.imgcut, ['金額数字大円'], ['光る', 'お金']),
      smallDigitsOn,
      smallDigitsOff,
      smallYenOn: this.findByNormIncludes(this.imgcut, ['金額数字小円'], ['暗転']),
      smallYenOff: this.findByNormIncludes(this.imgcut, ['金額数字小', '暗転', '円']),
      moneySignOnJp: this.signcut.getByLabel('money_jp_on')
    };
  }
  getMissingMapParts() {
    if (!this.map) return ['map'];
    const missing = [];
    for (const key of ['bigSlash', 'bigYen', 'smallYenOn', 'smallYenOff', 'moneySignOnJp']) if (!this.map[key]) missing.push(key);
    for (const key of ['bigDigits', 'smallDigitsOn', 'smallDigitsOff']) this.map[key].forEach((p, i) => { if (!p) missing.push(`${key}[${i}]`); });
    return missing;
  }
  measureParts(parts, scale = 1) { return (parts || []).reduce((sum, p) => sum + ((p?.w || 0) * scale), 0); }
  measurePartBounds(parts, scale = 1) {
    return {
      width: this.measureParts(parts, scale),
      height: (parts || []).reduce((m, p) => Math.max(m, (p?.h || 0) * scale), 0)
    };
  }
  drawParts(ctx, image, parts, x, y, scale = 1) {
    let cx = x;
    for (const p of parts) {
      if (!p) continue;
      ctx.drawImage(image, p.x, p.y, p.w, p.h, cx, y, p.w * scale, p.h * scale);
      cx += p.w * scale;
    }
    return cx;
  }

  drawFallback(ctx, text, x, y, { disabled = false, small = false } = {}) {
    ctx.lineWidth = small ? 4 : 5;
    ctx.strokeStyle = '#000';
    ctx.fillStyle = disabled ? '#999' : '#ffd400';
    ctx.font = small ? 'bold 14px sans-serif' : 'bold 18px sans-serif';
    const baseY = y + (small ? 12 : 16);
    ctx.strokeText(text, x, baseY);
    ctx.fillText(text, x, baseY);
  }

  measureMoney(money, maxMoney) {
    const value = `${Math.floor(money)}/${Math.floor(maxMoney)}`;
    if (!this.ready || !this.map) return value.length * 16;
    const parts = [...value].map((ch) => (ch === '/' ? this.map.bigSlash : this.map.bigDigits[Number(ch)]));
    parts.push(this.map.bigYen || this.map.moneySignOnJp);
    return this.measureParts(parts);
  }
  measureCost(cost, { disabled = false, scale = 1 } = {}) {
    const value = `${Math.floor(cost)}`;
    if (!this.ready || !this.map) return (value.length + 1) * 12;
    const digits = disabled ? this.map.smallDigitsOff : this.map.smallDigitsOn;
    const parts = [...value].map((ch) => digits[Number(ch)]);
    parts.push(disabled ? this.map.smallYenOff : this.map.smallYenOn);
    return this.measureParts(parts, scale);
  }
  measureCostBox(cost, { disabled = false, scale = 1 } = {}) {
    const value = `${Math.floor(cost)}`;
    const digits = disabled ? this.map?.smallDigitsOff : this.map?.smallDigitsOn;
    const parts = (digits ? [...value].map((ch) => digits[Number(ch)]) : []).concat([disabled ? this.map?.smallYenOff : this.map?.smallYenOn]);
    if (!this.ready || !this.map || parts.some((p) => !p)) return { width: (value.length + 1) * 12 * scale, height: 14 * scale };
    return this.measurePartBounds(parts, scale);
  }

  drawMoney(ctx, money, maxMoney, x, y, options = {}) {
    const text = `${Math.floor(money)}/${Math.floor(maxMoney)}円`;
    if (!this.ready || !this.map) return this.drawFallback(ctx, text, x, y, options);
    const parts = [...`${Math.floor(money)}/${Math.floor(maxMoney)}`].map((ch) => (ch === '/' ? this.map.bigSlash : this.map.bigDigits[Number(ch)]));
    const yen = this.map.bigYen || this.map.moneySignOnJp;
    if (parts.some((p) => !p) || !yen) {
      this.log.warn?.('[BcuSpriteText] money sprite missing', { hasYen: Boolean(yen), missingDigits: parts.map((p, i) => (!p ? i : -1)).filter((v) => v >= 0) });
      return this.drawFallback(ctx, text, x, y, options);
    }
    const endX = this.drawParts(ctx, this.img, parts, x, y);
    if (this.map.bigYen) this.imgcut.draw(ctx, this.img, yen, endX + 2, y, yen.w, yen.h);
    else this.signcut.draw(ctx, this.sign, yen, endX + 2, y, yen.w, yen.h);
  }

  drawCost(ctx, cost, x, y, { disabled = false, scale = 1 } = {}) {
    const value = `${Math.floor(cost)}`;
    const text = `${value}円`;
    if (!this.ready || !this.map) return this.drawFallback(ctx, text, x, y, { disabled, small: true });
    const digits = disabled ? this.map.smallDigitsOff : this.map.smallDigitsOn;
    const parts = [...value].map((ch) => digits[Number(ch)]);
    const yen = disabled ? this.map.smallYenOff : this.map.smallYenOn;
    if (parts.some((p) => !p) || !yen) {
      this.log.warn?.('[BcuSpriteText] cost sprite missing', { hasYen: Boolean(yen), disabled, missingDigits: parts.map((p, i) => (!p ? i : -1)).filter((v) => v >= 0) });
      return this.drawFallback(ctx, text, x, y, { disabled, small: true });
    }
    const endX = this.drawParts(ctx, this.img, parts, x, y, scale);
    this.drawParts(ctx, this.img, [yen], endX + scale, y, scale);
  }

  drawMoneyRight(ctx, money, maxMoney, rightX, y, options = {}) { const w = this.measureMoney(money, maxMoney, options); this.drawMoney(ctx, money, maxMoney, rightX - w, y, options); }
  drawCostRight(ctx, cost, rightX, y, options = {}) { const w = this.measureCost(cost, options); this.drawCost(ctx, cost, rightX - w, y, options); }
}