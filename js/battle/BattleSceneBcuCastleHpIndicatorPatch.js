import { BattleSceneRenderer } from './BattleSceneRenderer.js';

const PATCH_FLAG = Symbol.for('wanko-battle.bcu-castle-hp-indicator.v1');

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

function getBaseIndicatorPosition(renderer, base) {
  const scene = renderer._scene;
  const scale = renderer.getCameraScale?.(scene) || 1;
  const renderY = renderer.getEntityRenderY(scene, base, base?.y || 0);
  const screenX = renderer.projectBcuX?.(scene, base?.x || base?.posBcu || 0) ?? renderer.projectBattleX(scene, base?.x || 0);

  if (base?.side === 'cat-enemy') {
    const width = Number(base?.visualBoundsPx?.width || base?.castleAsset?.visualBounds?.width || base?.castleAsset?.crop?.w || 160) * (Number(base?.scale) || 1) * scale;
    const height = Number(base?.visualBoundsPx?.height || base?.castleAsset?.visualBounds?.height || base?.castleAsset?.crop?.h || 220) * (Number(base?.scale) || 1) * scale;
    return {
      x: screenX - width * 1.15,
      y: renderY - height * 0.95,
      align: 'left',
      source: 'BCU BattleBox.drawCastleHealthIndicator enemy castle numeric anchor approximation'
    };
  }

  const width = Number(base?.visualBoundsPx?.width || 160) * (Number(base?.scale) || 1) * scale;
  const height = Number(base?.visualBoundsPx?.height || 220) * (Number(base?.scale) || 1) * scale;
  return {
    x: screenX - width * 0.05,
    y: renderY - height - 18 * scale,
    align: 'right',
    source: 'BCU BattleBox.drawCastleHealthIndicator player castle numeric anchor approximation'
  };
}

function drawBcuCastleHpIndicator(c, renderer, base) {
  const text = formatBcuBaseHp(base);
  const pos = getBaseIndicatorPosition(renderer, base);
  const scale = renderer.getCameraScale?.(renderer._scene) || 1;
  const paddingX = Math.max(4, 5 * scale);
  const paddingY = Math.max(2, 3 * scale);
  const fontPx = Math.max(10, Math.round(14 * scale));

  c.save();
  c.font = `700 ${fontPx}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
  c.textBaseline = 'top';
  c.textAlign = pos.align;
  const metrics = c.measureText(text);
  const w = metrics.width + paddingX * 2;
  const h = fontPx + paddingY * 2;
  const x = pos.align === 'right' ? pos.x - w : pos.x;
  const y = pos.y;
  c.fillStyle = '#000000cc';
  c.fillRect(x, y, w, h);
  c.strokeStyle = '#ffffffd9';
  c.lineWidth = Math.max(1, scale);
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
    side: base?.side || null
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
