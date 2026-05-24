import { BattleSceneRenderer } from './BattleSceneRenderer.js';

const PATCH_FLAG = Symbol.for('wanko-battle.bcu-castle-hp-indicator.v2');
const BCU_HP_NUM_SCALE = 0.8;

function clampHp(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.trunc(n));
}

function maxHp(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 1;
  return Math.max(1, Math.trunc(n));
}

function formatBcuBaseHp(base) {
  const current = clampHp(base?.hp);
  const max = maxHp(base?.maxHp);
  return `${current}/${max}`;
}

function finiteNumber(...values) {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function getVisualSize(base, scale) {
  const baseScale = Number(base?.scale) || 1;
  return {
    width: finiteNumber(base?.visualBoundsPx?.width, base?.castleAsset?.visualBounds?.width, base?.castleAsset?.crop?.w, 160) * baseScale * scale,
    height: finiteNumber(base?.visualBoundsPx?.height, base?.castleAsset?.visualBounds?.height, base?.castleAsset?.crop?.h, 220) * baseScale * scale
  };
}

function getBaseScreenX(renderer, scene, base) {
  const x = finiteNumber(base?.x, base?.posBcu, 0);
  if (typeof renderer.projectBcuX === 'function') return renderer.projectBcuX(scene, x);
  return renderer.projectBattleX(scene, x);
}

function getBaseIndicatorPosition(renderer, base, indicatorHeight = 0) {
  const scene = renderer._scene;
  const scale = renderer.getCameraScale?.(scene) || 1;
  const renderY = renderer.getEntityRenderY(scene, base, base?.y || 0);
  const screenX = getBaseScreenX(renderer, scene, base);
  const { width, height } = getVisualSize(base, scale);

  if (base?.side === 'cat-enemy') {
    return {
      // BCU PC BattleBox.drawCastleHealthIndicator:
      // generic enemy castle: posx -= castw * siz * 1.15;
      // posy -= casth * siz * 0.95 - digitHeight is compensated by Res.getBase top-left drawing.
      x: screenX - width * 1.15,
      y: renderY - height * 0.95 + indicatorHeight,
      align: 'left',
      source: 'BCU PC BattleBox.drawCastleHealthIndicator enemy castle anchor'
    };
  }

  return {
    // BCU PC BattleBox.drawCastleHealthIndicator:
    // player castle HP starts at the player castle left-bottom anchor x and sits one HP-number
    // height above the castle top.
    x: screenX,
    y: renderY - height - indicatorHeight,
    align: 'left',
    source: 'BCU PC BattleBox.drawCastleHealthIndicator player castle anchor'
  };
}

function drawBcuCastleHpIndicator(c, renderer, base) {
  const text = formatBcuBaseHp(base);
  const scale = renderer.getCameraScale?.(renderer._scene) || 1;
  const fontScale = Math.max(0.01, scale * BCU_HP_NUM_SCALE);
  const paddingX = Math.max(3, 4 * fontScale);
  const paddingY = Math.max(1, 2 * fontScale);
  const fontPx = Math.max(10, Math.round(14 * fontScale));
  const indicatorHeight = fontPx + paddingY * 2;
  const pos = getBaseIndicatorPosition(renderer, base, indicatorHeight);

  c.save();
  c.font = `700 ${fontPx}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
  c.textBaseline = 'top';
  c.textAlign = pos.align;
  const metrics = c.measureText(text);
  const w = metrics.width + paddingX * 2;
  const h = indicatorHeight;
  const x = pos.align === 'right' ? pos.x - w : pos.x;
  const y = pos.y;
  c.fillStyle = '#000000cc';
  c.fillRect(x, y, w, h);
  c.strokeStyle = '#ffffffd9';
  c.lineWidth = Math.max(1, fontScale);
  c.strokeRect(x, y, w, h);
  c.fillStyle = '#ffffff';
  c.fillText(text, pos.align === 'right' ? x + w - paddingX : x + paddingX, y + paddingY);
  c.restore();

  base.lastBcuCastleHpIndicator = {
    source: pos.source,
    hp: clampHp(base?.hp),
    maxHp: maxHp(base?.maxHp),
    text,
    x,
    y,
    side: base?.side || null,
    fontScale,
    indicatorHeight
  };
}

export function installBattleSceneBcuCastleHpIndicatorPatch() {
  const proto = BattleSceneRenderer?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  proto.drawBaseHpBar = function drawBaseHpBarAsBcuCastleHpIndicator(c, base) {
    drawBcuCastleHpIndicator(c, this, base);
  };
}

installBattleSceneBcuCastleHpIndicatorPatch();

export { formatBcuBaseHp };
