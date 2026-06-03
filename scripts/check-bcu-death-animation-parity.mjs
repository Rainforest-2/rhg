import assert from 'node:assert/strict';
import { BattleActor } from '../js/battle/BattleActor.js';
import { BattleScene } from '../js/battle/BattleScene.js';
import '../js/battle/BattleBcuDeathAnimationRuntimePatch.js';
import '../js/battle/BattleActorGlassPatch.js';
import { BcuCombatModel, BCU_ABI } from '../js/battle/BcuCombatModel.js';
import { BCU_DEATH_SOUL_FALLBACK_FRAMES, BCU_DEATH_SOUL_Y_OFFSET, BCU_DEATH_SURGE_TRIGGER_FRAME, startBcuDeathAnimation, tickBcuDeathAnimation } from '../js/battle/bcu-runtime/BcuDeathAnimationRuntime.js';

function raw(length, entries) {
  const out = Array.from({ length }, () => 0);
  for (const [index, value] of entries) out[index] = value;
  return out;
}

function fakeAsset(maxFrame = 4) {
  return {
    loaded: true,
    image: {},
    imgcut: { parts: [] },
    model: { parts: [], baseScale: 1000, baseAngle: 3600, baseOpacity: 255 },
    anim: { tracks: [], maxFrame },
    source: 'test:soul'
  };
}

function fakeScene() {
  return {
    logicFrame: 1,
    timeMs: 0,
    effects: [],
    soulEffectAssets: {
      'soul-003': fakeAsset(4),
      'soul-007': fakeAsset(5),
      'soul-009': fakeAsset(6),
      demonSoulEnemy: fakeAsset(24),
      demonSoulUnit: fakeAsset(24)
    },
    waveEffectAssets: {},
    __bcuSurgeContainers: [],
    getBcuRandom: () => () => 0,
    ensureBcuSoulEffectLoading() {},
    ensureWaveEffectLoading() {},
    pushEvent(event) { this.lastEvent = event; }
  };
}

function actorWithModel(model, scene, side = 'cat-enemy') {
  const actor = new BattleActor({
    assetDef: { id: 'test' },
    sprite: null,
    model: { parts: [] },
    side,
    x: 100,
    y: 0,
    direction: side === 'dog-player' ? -1 : 1,
    stats: { hp: 10, damage: 100, bcuCombatModel: model },
    animations: { anim00: { tracks: [], maxFrame: 1 } }
  });
  actor.scene = scene;
  actor.instanceId = `${side}-actor`;
  actor.currentLayer = 2;
  actor.hp = 0;
  actor.isAliveFlag = false;
  return actor;
}

const unit = BcuCombatModel.parseStats({ kind: 'unit', rawValues: raw(120, [[67, 3]]) });
assert.equal(unit.deathAnimation.soulId, 3, 'unit death soul index reads DataUnit.ints[67]');
assert.equal(unit.deathAnimation.source, 'DataUnit.ints[67]', 'unit death source documented');

const legacyUnit = BcuCombatModel.parseStats({ kind: 'unit', rawValues: raw(20, []) });
assert.equal(legacyUnit.deathAnimation.soulId, 0, 'legacy unit fallback is Soul 0 when ints.length < 68');
assert.equal(legacyUnit.deathAnimation.fallbackApplied, true, 'legacy unit fallback records source');

const enemy = BcuCombatModel.parseStats({ kind: 'enemy', rawValues: raw(116, [[54, 7]]) });
assert.equal(enemy.deathAnimation.soulId, 7, 'enemy death soul index reads DataEnemy.ints[54]');

const fallbackEnemy = BcuCombatModel.parseStats({ kind: 'enemy', rawValues: raw(116, [[54, -1], [63, 1]]) });
assert.equal(fallbackEnemy.deathAnimation.soulId, 9, 'enemy fallback -1 + ints[63] == 1 maps to Soul 9');
assert.equal(fallbackEnemy.deathAnimation.fallbackApplied, true, 'enemy fallback records source');

const scene = fakeScene();
const normalActor = actorWithModel(unit, scene, 'dog-player');
normalActor.enterDeadState(0);
assert.equal(normalActor.bcuDeathAnimation.active, true, 'normal death starts BCU soul animation');
assert.equal(normalActor.bcuDeathAnimation.hideBaseActor, true, 'normal death hides base actor');
assert.equal(normalActor.bcuDeathAnimation.bcuYOffset, BCU_DEATH_SOUL_Y_OFFSET, 'normal death uses BCU soul y offset');
assert.equal(normalActor.bcuDeathAnimation.frameCount, 5, 'normal death frameCount comes from loaded soul asset');
assert.equal(scene.effects.length, 1, 'normal death spawns one soul effect');
assert.equal(scene.effects[0].effectRuntimeDebug.effectKey, 'soul-003', 'soul effect uses parsed soul id');
assert.equal(normalActor.isRenderable(), true, 'dead actor remains renderable only for render override/cleanup retention');
assert.equal(normalActor.isRemovable(100000), false, 'active soul prevents fixed removeAfterMs cleanup');
for (let i = 0; i < 5; i += 1) {
  normalActor.lastSceneLogicFrame = i + 2;
  normalActor.tick(33);
}
assert.equal(normalActor.bcuDeathAnimation.active, false, 'soul animation ends after asset frameCount');
assert.equal(normalActor.isRemovable(normalActor.deadAtMs), true, 'actor cleanup becomes immediate after soul duration');

const missingScene = fakeScene();
missingScene.soulEffectAssets = {};
const missingActor = actorWithModel(unit, missingScene, 'dog-player');
missingActor.enterDeadState(0);
assert.equal(missingScene.effects.length, 0, 'missing soul asset does not spawn a fake effect');
assert.equal(missingActor.bcuDeathAnimation.active, true, 'missing soul asset still starts guarded death lifecycle');
assert.equal(missingActor.bcuDeathAnimation.frameCount, BCU_DEATH_SOUL_FALLBACK_FRAMES, 'missing soul asset gets safe fallback frameCount');
assert.equal(missingActor.bcuDeathAnimation.visualMissing, true, 'missing soul asset records visualMissing');
assert.equal(missingActor.bcuDeathAnimation.visualFallback, true, 'missing soul asset records visualFallback');
assert.equal(missingActor.isRemovable(100000), false, 'fallback lifecycle still blocks fixed removeAfterMs before fallback duration');
for (let i = 0; i < BCU_DEATH_SOUL_FALLBACK_FRAMES; i += 1) {
  missingActor.lastSceneLogicFrame = i + 100;
  missingActor.tick(33);
}
assert.equal(missingActor.bcuDeathAnimation.active, false, 'missing soul fallback ends after fallback frameCount');
assert.equal(missingActor.isRemovable(missingActor.deadAtMs), true, 'missing soul fallback allows cleanup instead of permanent retention');

const glassModel = BcuCombatModel.parseStats({ kind: 'enemy', rawValues: raw(116, [[52, 2], [54, 7]]) });
const glassActor = actorWithModel(glassModel, fakeScene(), 'cat-enemy');
glassActor.enterDeadState(0);
assert.equal(glassActor.bcuDeathAnimation.kind, 'glass', 'AB_GLASS records glass death branch');
assert.equal(glassActor.bcuDeathAnimation.active, false, 'AB_GLASS skips soul animation');
assert.equal(glassActor.isRemovable(0), true, 'AB_GLASS remains immediate cleanup');

const glassScene = Object.create(BattleScene.prototype);
glassScene.timeMs = 1234;
glassScene.events = [];
glassScene.pushEvent = function pushEvent(event) { this.events.push(event); };
const glassPathActor = actorWithModel(glassModel, fakeScene(), 'cat-enemy');
glassPathActor.hp = 1;
glassPathActor.isAliveFlag = true;
glassPathActor.state = 'attack';
glassPathActor.bcuAttacksLeft = 0;
glassScene.enterAttackWait(glassPathActor, 'attack-complete');
assert.equal(glassPathActor.bcuGlassSelfRemoved, true, 'AB_GLASS self-remove path runs from BattleScene.enterAttackWait attack-complete');
assert.equal(glassPathActor.bcuDeathAnimation?.active === true, false, 'AB_GLASS self-remove path does not start normal soul animation');
assert.equal(glassPathActor.removeAfterMs, 0, 'AB_GLASS self-remove path remains immediate cleanup');
assert.equal(glassScene.events.some((event) => event.type === 'bcuGlassSelfRemoved'), true, 'AB_GLASS self-remove path emits debug event');

const dsModel = BcuCombatModel.parseStats({ kind: 'enemy', rawValues: raw(116, [[54, 7], [89, 100], [90, 40], [91, 120], [92, 3]]) });
const dsScene = fakeScene();
const dsActor = actorWithModel(dsModel, dsScene, 'cat-enemy');
const dsState = startBcuDeathAnimation(dsActor, { scene: dsScene, nowMs: 0 });
assert.equal(dsState.kind, 'deathSurge', 'death surge success uses demon soul branch');
assert.equal(dsState.assetKey, 'demonSoulEnemy', 'enemy death surge uses enemy demon soul asset');
for (let i = 0; i < BCU_DEATH_SURGE_TRIGGER_FRAME; i += 1) {
  dsActor.lastSceneLogicFrame = i + 1;
  tickBcuDeathAnimation(dsActor, 33, { scene: dsScene, nowMs: i * 33 });
}
assert.equal(dsActor.__bcuDeathSurgeDone, true, 'death surge marked done after BCU 21-frame trigger');
assert.equal(dsScene.__bcuSurgeContainers.length, 1, 'death surge container is enqueued at BCU trigger frame');

const zombieModel = BcuCombatModel.parseStats({ kind: 'enemy', rawValues: raw(116, [[54, 7], [19, 1], [45, 1], [46, 120], [47, 50]]) });
const zombieActor = actorWithModel(zombieModel, fakeScene(), 'cat-enemy');
zombieActor.bcuZombieCorpse = { active: true };
zombieActor.enterDeadState(0);
assert.equal(zombieActor.bcuDeathAnimation.active, true, 'zombie death still starts soul runtime in this JS lifecycle');
assert.equal(zombieActor.bcuDeathAnimation.zombieCorpseInteractionVerified === true, false, 'zombie corpse/soulstrike remains documented partial, not silently marked verified');

console.log('check-bcu-death-animation-parity: OK');
