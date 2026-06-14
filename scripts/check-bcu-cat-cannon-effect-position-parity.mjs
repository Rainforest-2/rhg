import assert from 'node:assert/strict';
import {
  BCU_CAT_CANNON_DRAW_OFFSET_X,
  BCU_CAT_CANNON_DRAW_OFFSET_Y,
  computeBcuCannonBaseAnimDraw,
  getBcuCatCannonDrawOffsets
} from '../js/battle/bcu-runtime/BcuCatCannonRuntime.js';

// BCU evidence (this checkout):
//   common util/Data.java: BASE_H=0, BASE_SLOW=1, BASE_WALL=2, BASE_STOP=3, BASE_WATER=4,
//     BASE_GROUND=5, BASE_BARRIER=6, BASE_CURSE=7.
//   androidutil/battle/BattleBox.java:
//     private static final float sprite = 0.8f;
//     private static final int road_h = 156;
//     private static final int[] cany = { -134, -134, -134, -250, -250, -134, -134, -134 };
//     private static final int[] canx = { 0, 0, 0, 64, 64, 0, 0, 0 };
//     int can = cany[id]; int disp = canx[id];
//     canon.drawBase(g, setP(getX(ubase.pos) + disp*siz, midh + (can - road_h)*siz), psiz); // psiz = siz*sprite
const BCU_ROAD_H = 156;
const BCU_SPRITE = 0.8;
const BCU_CANX = [0, 0, 0, 64, 64, 0, 0, 0];
const BCU_CANY = [-134, -134, -134, -250, -250, -134, -134, -134];

// The JS renderer's getBcuLayerScreenY(layer 0) == midh - road_h*siz (groundY == midh).
function bcuLayerScreenYZero(groundY, siz) {
  return groundY - BCU_ROAD_H * siz;
}

// 1. Offset tables must match BCU canx/cany exactly (no guessed indexes).
assert.deepEqual([...BCU_CAT_CANNON_DRAW_OFFSET_X], BCU_CANX, 'canx offsets must match BattleBox.canx');
assert.deepEqual([...BCU_CAT_CANNON_DRAW_OFFSET_Y], BCU_CANY, 'cany offsets must match BattleBox.cany');
assert.equal(BCU_CAT_CANNON_DRAW_OFFSET_X.length, 8, 'one X offset per NyType cannon id');
assert.equal(BCU_CAT_CANNON_DRAW_OFFSET_Y.length, 8, 'one Y offset per NyType cannon id');

// 2. getBcuCatCannonDrawOffsets resolves per id and clamps unknown ids to BASE_H.
for (let id = 0; id < 8; id++) {
  const { offsetX, offsetY } = getBcuCatCannonDrawOffsets(id);
  assert.equal(offsetX, BCU_CANX[id], `offsetX id=${id}`);
  assert.equal(offsetY, BCU_CANY[id], `offsetY id=${id}`);
}
assert.deepEqual(getBcuCatCannonDrawOffsets(99), { offsetX: BCU_CANX[0], offsetY: BCU_CANY[0] }, 'unknown id falls back to BASE_H');
assert.deepEqual(getBcuCatCannonDrawOffsets(-1), { offsetX: BCU_CANX[0], offsetY: BCU_CANY[0] }, 'negative id falls back to BASE_H');

// 3. computeBcuCannonBaseAnimDraw reproduces BattleBox.drawBtm closed form for every cannon id and zoom.
const GROUND_Y = 500; // midh in screen px
const PLAYER_BASE_SCREEN_X = 1180; // getX(ubase.pos)
for (const siz of [1, 0.75, 1.5, 2]) {
  const baseY0 = bcuLayerScreenYZero(GROUND_Y, siz);
  for (let id = 0; id < 8; id++) {
    const { offsetX, offsetY } = getBcuCatCannonDrawOffsets(id);
    const draw = computeBcuCannonBaseAnimDraw({
      baseX: PLAYER_BASE_SCREEN_X,
      baseY0,
      cameraScale: siz,
      spriteScale: BCU_SPRITE,
      offsetX,
      offsetY
    });
    // BCU closed forms:
    const bcuX = PLAYER_BASE_SCREEN_X + BCU_CANX[id] * siz; // getX(ubase.pos) + canx*siz
    const bcuY = GROUND_Y + (BCU_CANY[id] - BCU_ROAD_H) * siz; // midh + (cany - road_h)*siz
    const bcuScale = siz * BCU_SPRITE; // psiz = siz*sprite
    assert.ok(Math.abs(draw.x - bcuX) < 1e-9, `id=${id} siz=${siz}: x ${draw.x} != BCU ${bcuX}`);
    assert.ok(Math.abs(draw.y - bcuY) < 1e-9, `id=${id} siz=${siz}: y ${draw.y} != BCU ${bcuY}`);
    assert.ok(Math.abs(draw.scale - bcuScale) < 1e-9, `id=${id} siz=${siz}: scale ${draw.scale} != BCU ${bcuScale}`);
  }
}

// 4. Regression guard: the basic cannon (id 0) firing anim must sit ABOVE the road line, not be sunk
// into the ground. BCU y = midh - 290*siz; the previous buggy path produced ~midh - 171*siz (119*siz
// too low -> "into the ground"). Assert the fixed Y is meaningfully above that old value.
{
  const siz = 1;
  const baseY0 = bcuLayerScreenYZero(GROUND_Y, siz);
  const { offsetX, offsetY } = getBcuCatCannonDrawOffsets(0);
  const draw = computeBcuCannonBaseAnimDraw({ baseX: PLAYER_BASE_SCREEN_X, baseY0, cameraScale: siz, spriteScale: BCU_SPRITE, offsetX, offsetY });
  assert.equal(draw.y, GROUND_Y - 290 * siz, 'basic cannon BASE anim Y must equal midh - 290*siz');
  assert.ok(draw.y < GROUND_Y - BCU_ROAD_H * siz, 'basic cannon anim must be above the road/ground line (not sunk in)');
}

console.log('check-bcu-cat-cannon-effect-position-parity: OK');
