import assert from 'node:assert/strict';
import { BattleActor } from '../js/battle/BattleActor.js';
import '../js/battle/BattleActorProcStatusPatch.js';

function makeActor() {
  const actor = new BattleActor({
    side: 'cat-enemy',
    x: 321,
    y: 0,
    direction: 1,
    stats: { hp: 1000, damage: 10, speed: 0 },
    model: { parts: [] },
    animations: {}
  });
  actor.instanceId = 'toxic-target';
  actor.currentLayer = 3;
  actor.posBcu = 321;
  actor.maxHp = 1000;
  actor.hp = 1000;
  return actor;
}

const scene = {
  timeMs: 99,
  logicFrame: 7,
  effects: [],
  waveEffectAssets: {
    toxic: {
      loaded: true,
      image: {},
      imgcut: { parts: [] },
      model: { parts: [], baseScale: 1000, baseAngle: 3600, baseOpacity: 255 },
      anim: { tracks: [], maxFrame: 4 },
      frameCount: 5,
      maxFrame: 4,
      source: 'test-toxic-asset'
    }
  },
  pushEvent(event) { this.lastEvent = event; },
  ensureWaveEffectLoading() { this.ensureCalled = true; }
};

const actor = makeActor();
const result = actor.applyBcuProc({ key: 'toxic', payload: { mult: 25 } }, { scene, nowMs: scene.timeMs, attacker: { instanceId: 'toxic-attacker' } });

assert.equal(result.applied, true, 'toxic proc applies damage');
assert.equal(result.damage, 250, 'POIATK damage is trunc(maxHp * mult / 100) when resistance is already resolved');
assert.equal(actor.hp, 750, 'toxic direct damage subtracts HP');
assert.equal(actor.bcuProcStatuses?.toxic, undefined, 'POIATK does not create persistent status[P_POISON]/toxic icon');
assert.equal(scene.effects.length, 1, 'A_POISON EAnimCont visual spawns once');
const effect = scene.effects[0];
assert.equal(effect.type, 'toxic', 'effect type is toxic');
assert.equal(effect.source, 'bcu-effanim-A_POISON-poiatk', 'effect source identifies BCU A_POISON POIATK');
assert.equal(effect.x, 321, 'effect uses target/entity pos');
assert.equal(effect.layer, 3, 'effect uses target currentLayer');
assert.equal(effect.bcuSmokeYOffset, 0, 'BCU EAnimCont(pos,currentLayer,eanim) has offsetY=0 for A_POISON');
assert.equal(effect.effectRuntimeDebug?.effectKey, 'A_POISON', 'debug effectKey is A_POISON');
assert.match(effect.effectRuntimeDebug?.bcuReference || '', /Entity\.processProcs.*POIATK.*A_POISON/, 'debug cites BCU POIATK A_POISON path');

console.log('check-bcu-toxic-effect-parity: OK');
