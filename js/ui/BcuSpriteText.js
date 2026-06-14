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
    // BCU castle-HP uses aux.num[5], the dedicated 「城ＨＰ数字」 (castle-HP digit)
    // sprites (img001 parts 57-68), NOT the 「金額数字大」 money digits used by the
    // wallet/cost displays. They are smaller (14x18) and read as the BCU base HP font.
    const castleHpDigits = Array.from({ length: 10 }, (_, d) => this.findByNormExact(this.imgcut, `城HP数字${d}`));
    // BCU worker-cat level uses the dedicated 「働きネコレベル数字」 sprites (img001 parts 13-34)
    // via Res.getWorkerLv (aux.num[1] enable / aux.num[2] disable). Index [10] = the "Lv" label.
    const workerLvDigitsOn = Array.from({ length: 10 }, (_, d) => this.findByNormExact(this.imgcut, `働きネコレベル数字${d}`));
    const workerLvDigitsOff = Array.from({ length: 10 }, (_, d) => this.findByNormExact(this.imgcut, `働きネコレベル数字(暗転)${d}`));
    return {
      bigDigits,
      bigSlash: this.findByNormExact(this.imgcut, '金額数字大/'),
      castleHpDigits,
      castleHpSlash: this.findByNormExact(this.imgcut, '城HP数字/'),
      bigYen: this.findByNormIncludes(this.imgcut, ['金額数字大円'], ['光る', 'お金']),
      smallDigitsOn,
      smallDigitsOff,
      smallYenOn: this.findByNormIncludes(this.imgcut, ['金額数字小円'], ['暗転']),
      smallYenOff: this.findByNormIncludes(this.imgcut, ['金額数字小', '暗転', '円']),
      smallMax: this.findByNormIncludes(this.imgcut, ['金額数字小', 'MAX'], ['暗転']),
      workerLvDigitsOn,
      workerLvDigitsOff,
      workerLvLabelOn: this.findByNormIncludes(this.imgcut, ['働きネコレベル数字', 'LEVEL'], ['暗転']),
      workerLvLabelOff: this.findByNormIncludes(this.imgcut, ['働きネコレベル数字', '暗転', 'LEVEL'], []),
      moneySignOnJp: this.signcut.getByLabel('money_jp_on')
    };
  }
  getMissingMapParts() {
    if (!this.map) return ['map'];
    const missing = [];
    for (const key of ['bigSlash', 'bigYen', 'castleHpSlash', 'smallYenOn', 'smallYenOff', 'moneySignOnJp']) if (!this.map[key]) missing.push(key);
    for (const key of ['bigDigits', 'castleHpDigits', 'smallDigitsOn', 'smallDigitsOff']) this.map[key].forEach((p, i) => { if (!p) missing.push(`${key}[${i}]`); });
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

  // BCU Res.getWorkerLv: aux.num[enable?1:2][10] (the "Lv" label) followed by the level digits.
  workerLvParts(level, { disabled = false } = {}) {
    const digits = disabled ? this.map?.workerLvDigitsOff : this.map?.workerLvDigitsOn;
    const label = disabled ? this.map?.workerLvLabelOff : this.map?.workerLvLabelOn;
    const value = `${Math.max(1, Math.floor(Number(level) || 1))}`;
    return [label, ...[...value].map((ch) => digits?.[Number(ch)])];
  }
  measureWorkerLv(level, options = {}) {
    if (!this.ready || !this.map) return `Lv${Math.floor(level)}`.length * 12;
    return this.measureParts(this.workerLvParts(level, options), options.scale ?? 1);
  }
  drawWorkerLv(ctx, level, x, y, { disabled = false, scale = 1 } = {}) {
    const parts = this.workerLvParts(level, { disabled });
    if (!this.ready || !this.map || parts.some((p) => !p)) return this.drawFallback(ctx, `Lv ${Math.floor(level)}`, x, y, { disabled, small: true });
    this.drawParts(ctx, this.img, parts, x, y, scale);
  }
  drawWorkerLvCentered(ctx, level, centerX, y, options = {}) { const w = this.measureWorkerLv(level, options); this.drawWorkerLv(ctx, level, centerX - w / 2, y, options); }

  // BCU Res.getCost: cost == -1 renders the 「金額数字小 MAX」 sprite (aux.battle[0][3]).
  measureCostOrMax(cost, options = {}) {
    if (cost === -1 || cost === '-1') return (this.ready && this.map?.smallMax) ? this.map.smallMax.w * (options.scale ?? 1) : 3 * 12;
    return this.measureCost(cost, options);
  }
  drawCostOrMax(ctx, cost, x, y, { disabled = false, scale = 1 } = {}) {
    if (cost === -1 || cost === '-1') {
      if (this.ready && this.map?.smallMax) return this.drawParts(ctx, this.img, [this.map.smallMax], x, y, scale);
      return this.drawFallback(ctx, 'MAX', x, y, { disabled, small: true });
    }
    return this.drawCost(ctx, cost, x, y, { disabled, scale });
  }
  drawCostOrMaxCentered(ctx, cost, centerX, y, options = {}) { const w = this.measureCostOrMax(cost, options); this.drawCostOrMax(ctx, cost, centerX - w / 2, y, options); }

  drawMoneyRight(ctx, money, maxMoney, rightX, y, options = {}) { const w = this.measureMoney(money, maxMoney, options); this.drawMoney(ctx, money, maxMoney, rightX - w, y, options); }
  drawCostRight(ctx, cost, rightX, y, options = {}) { const w = this.measureCost(cost, options); this.drawCost(ctx, cost, rightX - w, y, options); }
}