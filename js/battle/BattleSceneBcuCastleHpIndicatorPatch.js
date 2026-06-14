import { BattleSceneRenderer } from './BattleSceneRenderer.js';
import { BcuSpriteText } from '../ui/BcuSpriteText.js';

const PATCH_FLAG = Symbol.for('wanko-battle.bcu-castle-hp-indicator.v3');
// BCU PC/Android BattleBox.drawCastleHealthIndicator draws the castle health via
// Res.getBase using the aux.num[5] gold digit sprites at setSym(siz * 0.8):
//   <health digits> <slash> <maxHealth digits>
// There is NO background box and NO border rectangle in BCU. This patch reproduces
// that with the equivalent gold digit sprites already bundled in BcuSpriteText
// (金額数字大 0-9 / 金額数字大/), falling back to outlined gold text only when the
// sprite sheet has not finished loading.
const BCU_HP_NUM_SCALE = 0.8;
// BCU BattleBox layout constants, in BCU pre-siz pixels (BattleBox.java fields):
//   road_h = 156, castw = 128, casth = 256.
// drawCastleHealthIndicator anchors the gold digits to these fixed values and the
// road baseline (midh - road_h*siz), NOT to each castle's actual sprite bounds.
const BCU_ROAD_H = 156;
const BCU_CASTW = 128;
const BCU_CASTH = 256;

let sharedSpriteText = null;
let spriteInitStarted = false;

function getSpriteText() {
  if (!sharedSpriteText) sharedSpriteText = new BcuSpriteText();
  if (!spriteInitStarted) {
    spriteInitStarted = true;
    Promise.resolve(sharedSpriteText.init?.()).catch(() => {});
  }
  return sharedSpriteText;
}

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

function getBaseScreenX(renderer, scene, base) {
  const x = finiteNumber(base?.x, base?.posBcu, 0);
  if (typeof renderer.projectBcuX === 'function') return renderer.projectBcuX(scene, x);
  return renderer.projectBattleX(scene, x);
}

function getRoadBaselineY(renderer, scene, siz) {
  // BCU posy origin: midh - road_h*siz (the road line). getBcuStageGroundY returns
  // the camera midh; matches BattleSceneRenderer.getBcuLayerScreenY(layer 0).
  const midh = typeof renderer.getBcuStageGroundY === 'function'
    ? renderer.getBcuStageGroundY(scene, 720)
    : finiteNumber(scene?.camera?.midh, 720);
  return midh - BCU_ROAD_H * siz;
}

function getBaseIndicatorPosition(renderer, base, siz, numHeightPx = 0) {
  const scene = renderer._scene;
  const roadBaseY = getRoadBaselineY(renderer, scene, siz);
  const screenX = getBaseScreenX(renderer, scene, base);

  if (base?.side === 'cat-enemy') {
    return {
      // BCU BattleBox.drawCastleHealthIndicator (generic enemy castle, else-branch):
      //   posx = getX(ebase.pos) - castw * siz * 1.15
      //   posy = (midh - road_h*siz) - (casth * siz * 0.95 + numHeight * siz)
      x: screenX - BCU_CASTW * siz * 1.15,
      y: roadBaseY - (BCU_CASTH * siz * 0.95 + numHeightPx),
      source: 'BCU BattleBox.drawCastleHealthIndicator enemy castle anchor'
    };
  }

  return {
    // BCU BattleBox.drawCastleHealthIndicator (player castle / ubase):
    //   posx = getX(len-800)  (player castle left edge)
    //   posy = midh - road_h*siz - casth*siz - numHeight*siz
    x: screenX,
    y: roadBaseY - BCU_CASTH * siz - numHeightPx,
    source: 'BCU BattleBox.drawCastleHealthIndicator player castle anchor'
  };
}

// Build the BCU digit-sprite sequence: <health> <slash> <maxHealth>.
function buildHpSpriteParts(sprite, hpText) {
  const map = sprite?.map;
  if (!sprite?.ready || !map?.bigDigits || !map.bigSlash) return null;
  const parts = [];
  for (const ch of hpText) {
    if (ch === '/') { parts.push(map.bigSlash); continue; }
    const digit = map.bigDigits[Number(ch)];
    if (!digit) return null;
    parts.push(digit);
  }
  return parts;
}

function drawBcuCastleHpIndicator(c, renderer, base) {
  const text = formatBcuBaseHp(base);
  const siz = renderer.getCameraScale?.(renderer._scene) || 1;
  // BCU draws the digits with setSym(siz * 0.8); the positioning offset uses the
  // digit's natural height * siz (aux.num[5][0].getImg().getHeight() * siz).
  const fontScale = Math.max(0.01, siz * BCU_HP_NUM_SCALE);
  const sprite = getSpriteText();
  const parts = buildHpSpriteParts(sprite, text);

  let indicatorWidth = 0;
  let glyphHeight = 0;
  let mode = 'sprite';

  if (parts) {
    const bounds = sprite.measurePartBounds(parts, fontScale);
    indicatorWidth = bounds.width;
    glyphHeight = bounds.height;
  } else {
    mode = 'text-fallback';
    glyphHeight = Math.max(10, Math.round(14 * fontScale));
  }

  // glyphHeight is measured at fontScale (= siz*0.8); convert back to the BCU
  // numHeight*siz offset by dividing out the 0.8 sprite scale.
  const numHeightPx = glyphHeight / BCU_HP_NUM_SCALE;
  const pos = getBaseIndicatorPosition(renderer, base, siz, numHeightPx);

  c.save();
  if (parts) {
    sprite.drawParts(c, sprite.img, parts, pos.x, pos.y, fontScale);
  } else {
    // BCU has no box behind the HP; emulate the gold digit look with an
    // outlined fill until the sprite sheet finishes loading.
    const fontPx = glyphHeight;
    c.font = `900 ${fontPx}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
    c.textBaseline = 'top';
    c.textAlign = 'left';
    c.lineJoin = 'round';
    c.lineWidth = Math.max(2, fontScale * 2.5);
    c.strokeStyle = '#1a1207';
    c.strokeText(text, pos.x, pos.y);
    c.fillStyle = '#ffd400';
    c.fillText(text, pos.x, pos.y);
    indicatorWidth = c.measureText(text).width;
  }
  c.restore();

  base.lastBcuCastleHpIndicator = {
    source: pos.source,
    mode,
    hp: clampHp(base?.hp),
    maxHp: maxHp(base?.maxHp),
    text,
    x: pos.x,
    y: pos.y,
    width: indicatorWidth,
    side: base?.side || null,
    fontScale,
    glyphHeight,
    numHeightPx
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
