import assert from 'node:assert/strict';
import { EffectRuntime } from '../js/battle/EffectRuntime.js';

const effect = EffectRuntime.createEffect({
  id: 'trace-fixture',
  type: 'wave',
  x: 123,
  y: 0,
  source: 'bcu-effanim-wave-cont-wave-def',
  layer: 2,
  scale: 1,
  bcuSmokeYOffset: -50,
  bcuScreenOffsetX: 16,
  renderFlipX: true,
  debug: {
    effectKey: 'unitWave',
    phase: 'attack',
    screenOffsetX: 16,
    scaleMode: 'stage-projectile',
    bcuReference: 'BCU ContWaveDef.draw A_WAVE'
  }
});

const trace = effect.effectRuntimeDebug || effect.debug || {};
for (const key of ['effectKey', 'phase', 'worldX', 'screenOffsetX', 'bcuSmokeYOffset', 'layer', 'scaleMode', 'renderFlipX', 'bcuReference']) {
  assert.equal(Object.prototype.hasOwnProperty.call(trace, key), true, `trace includes ${key}`);
}
assert.equal(trace.worldX, 123, 'trace worldX is BCU world coordinate');
assert.equal(trace.screenOffsetX, 16, 'trace screen offset is explicit');
assert.equal(trace.renderFlipX, true, 'trace records render direction flip');

console.log('check-effect-coordinate-traces: OK');
