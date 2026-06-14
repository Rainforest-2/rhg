import assert from 'node:assert/strict';
import {
  activateBcuCatCannon,
  computeBcuCannonWaveAnimDraw,
  initializeBcuCatCannon,
  requestBcuCatCannonFire,
  tickBcuCatCannonAttack,
  tickBcuCatCannonCharge
} from '../js/battle/bcu-runtime/BcuCatCannonRuntime.js';

// BCU evidence (this checkout):
//   util/pack/NyCastle.java: cannon t ATK eanim = nyankoCastle_001_0<t>_00.mamodel/.maanim (BASE = _01).
//   androidutil/battle/BattleBox.java drawEff: p = getX(wc.pos) - wave(28)*siz ; y = midh-(road_h-dep)*siz (layer 9).
//   battle/attack/ContWaveCanon.java draw (canid 0): psiz*=1.25; pus=P(9,40); anim.draw(p.plus(pus,-psiz), psiz*2).
//   sprite=0.8 so sprite*1.25==1.0 -> pus*(-psiz) collapses to *siz: offsetX=-(28+9)=-37, offsetY=-40, scale=siz*sprite*2.5.
const BCU_ROAD_H = 156, BCU_DEP = 4, BCU_SPRITE = 0.8;
const GROUND_Y = 500;
const PLAYER_BASE_SCREEN_X = 1180;
const bcuLayerScreenY = (groundY, layer, siz) => groundY - (BCU_ROAD_H - layer * BCU_DEP) * siz;

// 1. computeBcuCannonWaveAnimDraw reproduces BattleBox.drawEff + ContWaveCanon.draw closed form.
for (const siz of [1, 0.75, 1.5, 2]) {
  const baseY9 = bcuLayerScreenY(GROUND_Y, 9, siz);
  const draw = computeBcuCannonWaveAnimDraw({ baseX: PLAYER_BASE_SCREEN_X, baseY9, cameraScale: siz, spriteScale: BCU_SPRITE, offsetX: -37, offsetY: -40, scaleMul: 2.5 });
  // BCU: x = getX(pos) - 28*siz - 9*siz ; y = (midh-120*siz) - 40*siz ; scale = siz*sprite*2.5
  assert.ok(Math.abs(draw.x - (PLAYER_BASE_SCREEN_X - 37 * siz)) < 1e-9, `wave x siz=${siz}`);
  assert.ok(Math.abs(draw.y - (baseY9 - 40 * siz)) < 1e-9, `wave y siz=${siz}`);
  assert.ok(Math.abs(draw.scale - siz * BCU_SPRITE * 2.5) < 1e-9, `wave scale siz=${siz}`);
  // sprite*1.25 == 1.0 identity (why pus collapses to *siz)
  assert.ok(Math.abs(BCU_SPRITE * 1.25 - 1) < 1e-9, 'sprite*1.25 == 1.0');
}

// 2. The basic cannon runtime spawns the real traveling-wave anim through the scene hook (not the
// no-image trace fallback) when the scene provides spawnCatCannonWaveEffect.
const waveCalls = [];
const enemy = {
  side: 'cat-enemy', instanceId: 'e1', posBcu: 3467.5, x: 3467.5, hp: 99999, state: 'move',
  isAlive() { return true; }, isTargetable() { return true; },
  takeDamage() { return { accepted: true }; },
  getKnockbackConfig() { return {}; }, startKnockback() { return { ok: true }; }
};
const scene = {
  logicFrame: 0, timeMs: 0,
  bases: [{ side: 'dog-player', getBattlePosBcu: () => 4000 }],
  actors: [enemy], effects: [], debugEvents: [],
  pushEvent(e) { this.debugEvents.push(e); },
  spawnCatCannonWaveEffect(center, waveIndex) { waveCalls.push({ center, waveIndex }); return true; }
};

initializeBcuCatCannon(scene, { maxCannonFrames: 3, startChargeFrames: 2 });
tickBcuCatCannonCharge(scene);
requestBcuCatCannonFire(scene);
tickBcuCatCannonCharge(scene); // activates
for (let i = 0; i < 80 && !waveCalls.length; i++) tickBcuCatCannonAttack(scene);

assert.ok(waveCalls.length >= 1, 'basic cannon must spawn at least one traveling-wave ATK anim');
assert.ok(Number.isFinite(waveCalls[0].center), 'wave anim is spawned at a finite band center');
assert.equal(waveCalls[0].waveIndex, 0, 'first wave anim is band 0');
// When the scene hook spawns the real anim, the no-image trace fallback must NOT be pushed.
assert.equal(scene.effects.filter((e) => e.source === 'bcu-effanim-cat-cannon-basic').length, 0,
  'real wave anim spawned -> no-image trace fallback is not used');

console.log('check-bcu-cat-cannon-wave-anim-parity: OK');
