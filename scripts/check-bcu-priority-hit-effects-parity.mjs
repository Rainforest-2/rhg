import assert from 'node:assert/strict';
import fs from 'node:fs';
import { BattleActor } from '../js/battle/BattleActor.js';
import { EffectRuntime } from '../js/battle/EffectRuntime.js';
import '../js/battle/BattleCriticalEffectPatch.js';
import '../js/battle/BattleProcHitEffectPatch.js';

const evidence = fs.readFileSync('docs/ability-logic/bcu-priority-hit-effect-evidence.md', 'utf8');
assert.match(evidence, /A_CRIT\.getEAnim\(DefEff\.DEF\), -75f\)/, 'BCU evidence records A_CRIT EAnimCont offset -75f');
assert.match(evidence, /A_SATK\.getEAnim\(DefEff\.DEF\), -75f\)/, 'BCU evidence records A_SATK EAnimCont offset -75f');
assert.match(evidence, /A_E_METAL_KILLER : effas\(\)\.A_METAL_KILLER\).* -75f/s, 'BCU evidence records A_METAL_KILLER/A_E_METAL_KILLER EAnimCont offset -75f');
assert.match(evidence, /sb\.lea\.add\(new EAnimCont\(pos, 9, effas\(\)\.A_SATK/, 'BCU evidence records castle strong attack layer 9');
assert.match(evidence, /sb\.lea\.add\(new EAnimCont\(pos, 9, effas\(\)\.A_CRIT/, 'BCU evidence records castle critical layer 9');
assert.match(evidence, /psiz\s*=\s*siz \* sprite/, 'BCU evidence records StageBasis.lea psiz formula');
assert.match(evidence, /p\.y \+= offsetY \* psiz/, 'BCU evidence records EAnimCont offset sign and scale');

const critSource = fs.readFileSync('js/battle/BattleCriticalEffectPatch.js', 'utf8');
assert.match(critSource, /const BCU_CRIT_OFFSET_Y = -75/, 'critical effect uses BCU EAnimCont offset -75');
assert.match(critSource, /const BCU_CRIT_SCALE = 1/, 'critical effect does not reuse attack-smoke 1.2 scale');
assert.match(critSource, /if \(targetType === 'base'\) return BCU_BASE_EFFECT_LAYER/, 'critical base/castle effect uses layer 9');
assert.match(critSource, /bcuScaleMode: BCU_SCALE_MODE\.ACTOR_PRIORITY_EFFECT/, 'critical effect is marked as actor-priority EAnimCont');

const procSource = fs.readFileSync('js/battle/BattleProcHitEffectPatch.js', 'utf8');
assert.match(procSource, /const PROC_EFFECT_OFFSET_Y = -75/, 'strong/metal effects use BCU EAnimCont offset -75');
assert.match(procSource, /const PROC_EFFECT_SCALE = 1/, 'strong/metal effects do not reuse attack-smoke 1.2 scale');
assert.match(procSource, /if \(targetType === 'base'\) return BCU_BASE_EFFECT_LAYER/, 'strong base/castle effect uses layer 9');
assert.match(procSource, /renderFlipX: metalMirror/, 'metal killer records mirrored enemy variant when needed');
assert.match(procSource, /bcuScaleMode: BCU_SCALE_MODE\.ACTOR_PRIORITY_EFFECT/, 'strong/metal effects are marked as actor-priority EAnimCont');

const rendererSource = fs.readFileSync('js/battle/BattleSceneRendererEffectGlowPatch.js', 'utf8');
assert.match(rendererSource, /BCU_LEA_EANIMCONT_SOURCES/, 'renderer has explicit StageBasis.lea EAnimCont source list');
assert.match(rendererSource, /camera \* sprite \* effectScale/, 'renderer uses psiz=siz*sprite for BCU lea EAnimCont effects');
assert.match(rendererSource, /baseY \+ yOffset \* scale/, 'renderer applies EAnimCont offsetY with plus sign and psiz scale');
assert.match(rendererSource, /ctx\.scale\(effect\.renderFlipX === true \? -scale : scale, scale\)/, 'renderer mirrors A_E_METAL_KILLER via renderFlipX');

function makeActor({ direction = -1, layer = 3, x = 321 } = {}) {
  const actor = new BattleActor({
    side: direction === 1 ? 'cat-enemy' : 'dog-player',
    x,
    y: 0,
    direction,
    stats: { hp: 1000, damage: 10, speed: 0 },
    model: { parts: [] },
    animations: {}
  });
  actor.instanceId = `target-${direction}-${layer}`;
  actor.currentLayer = layer;
  actor.posBcu = x;
  actor.maxHp = 1000;
  actor.hp = 1000;
  return actor;
}

function fakeAsset(key) {
  return {
    loaded: true,
    image: {},
    imgcut: { parts: [] },
    model: { parts: [], baseScale: 1000, baseAngle: 3600, baseOpacity: 255 },
    anim: { tracks: [], maxFrame: 4 },
    frameCount: 5,
    maxFrame: 4,
    source: `test-${key}`
  };
}

const criticalEffect = EffectRuntime.createHitEffect({
  type: 'critical',
  x: 123,
  y: 0,
  image: {},
  imgcut: { parts: [] },
  model: {},
  animator: {},
  scale: 1,
  source: 'bcu-effanim-A_CRIT',
  layer: 2,
  bcuSmokeYOffset: -75,
  bcuScaleMode: 'actor-priority-effect',
  debug: { effectKey: 'A_CRIT' }
});
assert.equal(criticalEffect.bcuSmokeYOffset, -75, 'runtime critical effect stores -75 offset');
assert.equal(criticalEffect.scale, 1, 'runtime critical effect stores scale 1');
assert.equal(criticalEffect.bcuScaleMode, 'actor-priority-effect', 'runtime critical effect stores actor-priority mode');

const scene = {
  timeMs: 44,
  logicFrame: 5,
  effects: [],
  waveEffectAssets: {
    strongAttack: fakeAsset('strongAttack'),
    metalKiller: fakeAsset('metalKiller')
  },
  pushEvent(event) { this.lastEvent = event; },
  ensureWaveEffectLoading() { this.ensureCalled = true; }
};

const strongEffect = EffectRuntime.createHitEffect({
  type: 'strongAttack',
  x: 321,
  y: 0,
  image: scene.waveEffectAssets.strongAttack.image,
  imgcut: scene.waveEffectAssets.strongAttack.imgcut,
  model: {},
  animator: {},
  scale: 1,
  source: 'bcu-effanim-proc-hit',
  layer: 3,
  bcuSmokeYOffset: -75,
  bcuScaleMode: 'actor-priority-effect',
  debug: { effectKey: 'strongAttack' }
});
assert.equal(strongEffect.bcuSmokeYOffset, -75, 'runtime strong attack effect stores -75 offset');
assert.equal(strongEffect.scale, 1, 'runtime strong attack effect stores scale 1');
assert.equal(strongEffect.bcuScaleMode, 'actor-priority-effect', 'runtime strong attack effect stores actor-priority mode');

const metalTarget = makeActor({ direction: 1, layer: 4, x: 555 });
const metalEffect = EffectRuntime.createHitEffect({
  type: 'metalKiller',
  x: metalTarget.x,
  y: 0,
  image: scene.waveEffectAssets.metalKiller.image,
  imgcut: scene.waveEffectAssets.metalKiller.imgcut,
  model: {},
  animator: {},
  scale: 1,
  source: 'bcu-effanim-proc-hit',
  layer: metalTarget.currentLayer,
  bcuSmokeYOffset: -75,
  renderFlipX: true,
  bcuScaleMode: 'actor-priority-effect',
  debug: { effectKey: 'metalKiller' }
});
assert.equal(metalEffect.bcuSmokeYOffset, -75, 'runtime metal killer effect stores -75 offset');
assert.equal(metalEffect.scale, 1, 'runtime metal killer effect stores scale 1');
assert.equal(metalEffect.bcuScaleMode, 'actor-priority-effect', 'runtime metal killer effect stores actor-priority mode');
assert.equal(metalEffect.renderFlipX, true, 'runtime metal killer can mirror the A_E_METAL_KILLER variant');

console.log('check-bcu-priority-hit-effects-parity: OK');
