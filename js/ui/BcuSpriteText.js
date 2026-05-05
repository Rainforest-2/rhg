import { BcuImgCut } from './BcuImgCut.js';

const loadImage = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error(`image load failed:${src}`)); i.src = src; });

export class BcuSpriteText {
  constructor(log = console) { this.log = log; this.ready = false; this.map = null; }
  normalizeLabel(label) { return String(label || '').normalize('NFKC').replace(/\s+/g, '').trim(); }
  findByNorm(imgcut, norm) { return imgcut.parts.find((p) => this.normalizeLabel(p.label) === norm) || null; }
  async init() {
    try {
      this.img = await loadImage('assets/bcu/000001/org/page/img001.png');
      this.imgcut = await BcuImgCut.load('assets/bcu/000001/org/page/img001.imgcut');
      this.sign = await loadImage('assets/bcu/110504/org/page/moneySign.png');
      this.signcut = await BcuImgCut.load('assets/bcu/110504/org/page/moneySign.imgcut');
      this.map = this.buildSemanticMap();
      this.ready = true;
    } catch (e) { this.ready = false; this.log.warn?.('[BcuSpriteText] fallback', e); }
  }
  buildSemanticMap() {
    const bigDigits = Array.from({ length: 10 }, (_, d) => this.findByNorm(this.imgcut, `金額数字大${d}`));
    const smallDigitsOn = Array.from({ length: 10 }, (_, d) => this.findByNorm(this.imgcut, `金額数字小${d}`));
    const smallDigitsOff = Array.from({ length: 10 }, (_, d) => this.findByNorm(this.imgcut, `金額数字小(暗転)${d}`));
    return {
      bigDigits, bigSlash: this.findByNorm(this.imgcut, '金額数字大/'), bigYen: this.findByNorm(this.imgcut, '金額数字大円'),
      smallDigitsOn, smallYenOn: this.findByNorm(this.imgcut, '金額数字小円'),
      smallDigitsOff, smallYenOff: this.findByNorm(this.imgcut, '金額数字小(暗転)円'),
      moneySignOnJp: this.signcut.getByLabel('money_jp_on'), moneySignOffJp: this.signcut.getByLabel('money_jp_off'),
      costSignOnJp: this.signcut.getByLabel('cost_jp_on'), costSignOffJp: this.signcut.getByLabel('cost_jp_off')
    };
  }
  drawParts(ctx, image, parts, x, y) { let cx = x; for (const p of parts) { this.imgcut.draw(ctx, image, p, cx, y, p.w, p.h); cx += p.w; } return cx; }
  drawFallback(ctx, text, x, y, { disabled = false, small = false } = {}) { ctx.lineWidth = small ? 3 : 4; ctx.strokeStyle = '#111'; ctx.fillStyle = disabled ? '#999' : '#f6d34f'; ctx.font = small ? 'bold 14px sans-serif' : 'bold 18px sans-serif'; ctx.strokeText(text, x, y + (small ? 12 : 16)); ctx.fillText(text, x, y + (small ? 12 : 16)); }
  drawMoney(ctx, money, maxMoney, x, y, options = {}) {
    const text = `${Math.floor(money)}/${Math.floor(maxMoney)}円`; if (!this.ready || !this.map) return this.drawFallback(ctx, text, x, y, options);
    const parts = []; for (const ch of `${Math.floor(money)}/${Math.floor(maxMoney)}`) { if (ch === '/') parts.push(this.map.bigSlash); else parts.push(this.map.bigDigits[Number(ch)]); }
    const sign = options.disabled ? this.map.moneySignOffJp : this.map.moneySignOnJp;
    if (parts.some((p) => !p) || !sign) { this.log.warn?.('[BcuSpriteText] missing sprite cut for money'); return this.drawFallback(ctx, text, x, y, options); }
    const endX = this.drawParts(ctx, this.img, parts, x, y);
    this.signcut.draw(ctx, this.sign, sign, endX + 2, y, sign.w, sign.h);
  }
  drawCost(ctx, cost, x, y, { disabled = false } = {}) {
    const value = `${Math.floor(cost)}`; const text = `${value}円`; if (!this.ready || !this.map) return this.drawFallback(ctx, text, x, y, { disabled, small: true });
    const digits = disabled ? this.map.smallDigitsOff : this.map.smallDigitsOn;
    const parts = [...value].map((ch) => digits[Number(ch)]);
    const sign = disabled ? this.map.costSignOffJp : this.map.costSignOnJp;
    if (parts.some((p) => !p) || !sign) { this.log.warn?.('[BcuSpriteText] missing sprite cut for cost'); return this.drawFallback(ctx, text, x, y, { disabled, small: true }); }
    const endX = this.drawParts(ctx, this.img, parts, x, y);
    this.signcut.draw(ctx, this.sign, sign, endX + 1, y, sign.w, sign.h);
  }
}
