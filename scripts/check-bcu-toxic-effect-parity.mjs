import assert from 'node:assert/strict';
import fs from 'node:fs';
import { BattleActor } from '../js/battle/BattleActor.js';
import { readStoreZipEntries } from './bcu-semantic-utils.mjs';
import '../js/battle/BattleActorProcStatusPatch.js';

const loaderSource = fs.readFileSync('js/battle/BattleWaveEffectLoader.js', 'utf8');
assert.match(loaderSource, /key: 'toxic'.+all-skill-effects\/000001\/org\/battle\/s8/s, 'BattleWaveEffectLoader maps toxic to existing A_POISON s8 bundle entries');
assert.match(loaderSource, /usesSourceNamedBundleFiles\(def\)/, 'BattleWaveEffectLoader recognizes source-named all-skill-effects bundle entries');
assert.match(loaderSource, /bundleAssetPath\(def, 'image'\)/, 'BattleWaveEffectLoader resolves bundle image paths through entry filenames');
assert.match(loaderSource, /kind === 'image'\) return `\$\{base\}\/\$\{def\.image\}`/, 'A_POISON bundle image lookup uses skill008.png instead of image.png');
const waveZip = await readStoreZipEntries('public/assets/bundles/effect/wave.zip');
for (const internalPath of [
  'all-skill-effects/000001/org/battle/s8/skill008.png',
  'all-skill-effects/000001/org/battle/s8/skill008.imgcut',
  'all-skill-effects/000001/org/battle/s8/skill_percentage_attack.mamodel',
  'all-skill-effects/000001/org/battle/s8/skill_percentage_attack.maanim'
]) {
  assert.ok(waveZip.has(internalPath), `wave.zip contains A_POISON internalPath ${internalPath}`);
}

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
assert.ok(Number.isFinite(effect.y), 'effect y is finite');
assert.equal(effect.layer, 3, 'effect uses target currentLayer');
assert.equal(effect.bcuSmokeYOffset, 0, 'BCU EAnimCont(pos,currentLayer,eanim) has offsetY=0 for A_POISON');
assert.equal(effect.scale, 1, 'A_POISON uses EAnimCont psiz scale without attack-smoke 1.2 multiplier');
assert.equal(effect.bcuScaleMode, 'actor-priority-effect', 'A_POISON uses actor priority EAnimCont scale mode');
assert.ok(effect.image, 'effect has image');
assert.ok(effect.model, 'effect has model');
assert.ok(effect.animator, 'effect has animator');
assert.ok(effect.durationMs > 0, 'effect durationMs is positive');
assert.equal(effect.effectRuntimeDebug?.effectKey, 'A_POISON', 'debug effectKey is A_POISON');
assert.equal(effect.effectRuntimeDebug?.assetLoaded, true, 'debug records assetLoaded');
assert.equal(effect.effectRuntimeDebug?.hasImage, true, 'debug records hasImage');
assert.equal(effect.effectRuntimeDebug?.hasModel, true, 'debug records hasModel');
assert.equal(effect.effectRuntimeDebug?.hasAnimator, true, 'debug records hasAnimator');
assert.equal(effect.effectRuntimeDebug?.rendererReached, false, 'spawn debug starts rendererReached=false until renderer draws it');
assert.equal(effect.effectRuntimeDebug?.bcuScaleMode, 'actor-priority-effect', 'debug records actor priority EAnimCont scale mode');
assert.match(effect.effectRuntimeDebug?.bcuReference || '', /Entity\.processProcs.*POIATK.*A_POISON/, 'debug cites BCU POIATK A_POISON path');

const queuedScene = {
  timeMs: 101,
  logicFrame: 8,
  effects: [],
  waveEffectAssets: {},
  pushEvent(event) { this.lastEvent = event; },
  ensureWaveEffectLoading() {
    this.ensureCalled = true;
    const loaded = scene.waveEffectAssets.toxic;
    this.loadPromise = Promise.resolve().then(() => {
      this.waveEffectAssets.toxic = loaded;
      return this.waveEffectAssets;
    });
    return this.loadPromise;
  }
};
const queuedActor = makeActor();
const queuedResult = queuedActor.applyBcuProc({ key: 'toxic', payload: { mult: 10 } }, { scene: queuedScene, nowMs: queuedScene.timeMs, attacker: { instanceId: 'toxic-attacker' } });
assert.equal(queuedResult.applied, true, 'toxic damage applies even while A_POISON asset is loading');
assert.equal(queuedScene.effects.length, 0, 'A_POISON is not pushed before the asset load resolves');
assert.equal(queuedScene.ensureCalled, true, 'toxic effect starts wave effect loading when asset is not ready');
assert.equal(queuedScene.lastBcuToxicEffectDebug?.spawned, false, 'not-ready toxic effect records skipped debug');
assert.equal(queuedScene.lastBcuToxicEffectDebug?.retryScheduled, true, 'not-ready toxic effect schedules a retry');
assert.equal(queuedScene.lastBcuToxicEffectDebug?.reason, 'effect-asset-not-ready', 'not-ready reason is explicit');
await queuedScene.loadPromise;
await Promise.resolve();
assert.equal(queuedScene.effects.length, 1, 'A_POISON EAnimCont visual spawns after wave effect assets load');
assert.equal(queuedScene.lastBcuToxicEffectDebug?.spawned, true, 'retry debug records spawned=true');
assert.equal(queuedScene.lastBcuToxicEffectDebug?.retryResolved, true, 'retry debug records load resolution');
assert.equal(queuedScene.lastBcuToxicEffectDebug?.assetLoaded, true, 'retry debug records loaded asset');
assert.equal(queuedScene.lastBcuToxicEffectDebug?.durationMs > 0, true, 'retry-spawned A_POISON has positive duration');

console.log('check-bcu-toxic-effect-parity: OK');
