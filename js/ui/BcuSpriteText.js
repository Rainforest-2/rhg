import { BcuImgCut } from './BcuImgCut.js';

const loadImage = (src) => new Promise((res, rej) => {
  const i = new Image();
  i.onload = () => res(i);
  i.onerror = () => rej(new Error(`image load failed:${src}`));
  i.src = src;
});

export class BcuSpriteText {
  constructor(log = console, resolveAssetPath = (v) => v) {
    this.log = log;
    this.resolveAssetPath = resolveAssetPath;
    this.ready = false;
    this.map = null;
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
      this.img = await loadImage(this.resolveAssetPath('./public/assets/bcu/000001/org/page/img001.png'));
      this.imgcut = await BcuImgCut.load(this.resolveAssetPath('./public/assets/bcu/000001/org/page/img001.imgcut'));
      this.sign = await loadImage(this.resolveAssetPath('./public/assets/bcu/110504/org/page/moneySign.png'));
      this.signcut = await BcuImgCut.load(this.resolveAssetPath('./public/assets/bcu/110504/org/page/moneySign.imgcut'));
      this.map = this.buildSemanticMap();
      this.ready = true;
    } catch (e) { this.ready = false; this.log.warn?.('[BcuSpriteText] fallback', e); }
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
  measureParts(parts) { return (parts || []).reduce((sum, p) => sum + (p?.w || 0), 0); }
  drawParts(ctx, image, parts, x, y) { let cx = x; for (const p of parts) { this.imgcut.draw(ctx, image, p, cx, y, p.w, p.h); cx += p.w; } return cx; }

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
  measureCost(cost, { disabled = false } = {}) {
    const value = `${Math.floor(cost)}`;
    if (!this.ready || !this.map) return (value.length + 1) * 12;
    const digits = disabled ? this.map.smallDigitsOff : this.map.smallDigitsOn;
    const parts = [...value].map((ch) => digits[Number(ch)]);
    parts.push(disabled ? this.map.smallYenOff : this.map.smallYenOn);
    return this.measureParts(parts);
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

  drawCost(ctx, cost, x, y, { disabled = false } = {}) {
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
    const endX = this.drawParts(ctx, this.img, parts, x, y);
    this.imgcut.draw(ctx, this.img, yen, endX + 1, y, yen.w, yen.h);
  }

  drawMoneyRight(ctx, money, maxMoney, rightX, y, options = {}) { const w = this.measureMoney(money, maxMoney, options); this.drawMoney(ctx, money, maxMoney, rightX - w, y, options); }
  drawCostRight(ctx, cost, rightX, y, options = {}) { const w = this.measureCost(cost, options); this.drawCost(ctx, cost, rightX - w, y, options); }
}
