import assert from 'node:assert/strict';
import { BattleActor } from '../js/battle/BattleActor.js';
import { BattleScene } from '../js/battle/BattleScene.js';
import { BcuCombatModel } from '../js/battle/BcuCombatModel.js';
import '../js/battle/BattleActorBarrierShieldPatch.js';
import '../js/battle/BattleActorBarrierShieldVisualPatch.js';
import '../js/battle/BcuKnockbackRuntimePatch.js';
import '../js/battle/BcuKnockbackProcPriorityPatch.js';
import '../js/battle/BattleActorStrengthenLethalPatch.js';
import '../js/battle/BattleActorZombieRevivePatch.js';
import '../js/battle/BattleBcuPriorityEffectRuntimePatch.js';
import { BCU_BARRIER_SHIELD_ICON_Y_OFFSET } from '../js/battle/bcu-runtime/BcuBarrierShieldEffectRuntime.js';
import { BCU_SCALE_MODE } from '../js/battle/bcu-runtime/BcuEffectTraceRuntime.js';

function raw(length, entries) {
  const out = Array.from({ length }, () => 0);
  for (const [index, value] of entries) out[index] = value;
  return out;
}

function fakeAsset(maxFrame = 5, phases = ['full', 'half', 'destruction', 'breaker', 'revive']) {
  const anim = { tracks: [], maxFrame };
  return {
    loaded: true,
    image: {},
    imgcut: { parts: [] },
    model: { parts: [], baseScale: 1000, baseAngle: 3600, baseOpacity: 255 },
    anim,
    phases: Object.fromEntries(phases.map((phase) => [phase, { tracks: [], maxFrame }])),
    source: 'test:demon-shield-regen'
  };
}

function makeScene() {
  const scene = new BattleScene();
  scene.logicFrame = 10;
  scene.timeMs = 0;
  scene.effects = [];
  scene.events = [];
  scene.waveEffectAssets = { demonShield: fakeAsset() };
  scene.ensureWaveEffectLoading = () => {};
  scene.pushEvent = (event) => scene.events.push(event);
  return scene;
}

function makeShieldActor(scene) {
  const model = BcuCombatModel.parseStats({ kind: 'enemy', rawValues: raw(116, [[87, 500], [88, 50]]) });
  const actor = new BattleActor({
    assetDef: { id: 'demon-shield-target' },
    side: 'cat-enemy',
    x: 120,
    y: 0,
    direction: 1,
    stats: { hp: 1000, damage: 100, knockbacks: 4, bcuCombatModel: model },
    animations: { anim00: { tracks: [], maxFrame: 1 } }
  });
  actor.scene = scene;
  actor.instanceId = 'demon-shield-target';
  actor.currentLayer = 3;
  actor.bcuDemonShieldHp = 0;
  actor.bcuDemonShieldMaxHp = 500;
  actor.bcuDemonShieldRegenPercent = 50;
  return actor;
}

const scene = makeScene();
const actor = makeShieldActor(scene);
scene.actors = [actor];

const hit = actor.takeDamage(300, { scene });
assert.equal(hit.accepted, true, 'body damage is accepted after current shield is already gone');
const resolved = actor.resolvePostDamage({ nowMs: 0, tuning: {} });
assert.equal(resolved.knockedBack, true, 'HP threshold damage starts INT_HB knockback');
assert.equal(actor.kbBcuType, 'INT_HB', 'regen is tied to BCU INT_HB, not proc KB or warp');
assert.equal(actor.bcuDemonShieldHp, 0, 'shield is not restored immediately after resolvePostDamage');
assert.ok(actor.bcuDemonShieldRegenPending, 'shield regen is queued pending KB completion');
assert.equal(actor.lastBcuDemonShieldRegenTimingDebug.pending, true, 'timing debug records pending state');

let safety = 100;
while (actor.state === 'knockback' && safety-- > 1) {
  if (actor.bcuKbTime > 1) assert.equal(actor.bcuDemonShieldHp, 0, 'shield remains down during KB animation before BCU kbTime == 0');
  actor.stepKnockbackFrame();
}

assert.equal(actor.state, 'move', 'actor returns to movement state at KB end');
assert.equal(actor.bcuDemonShieldHp, 250, 'shield HP restores with trunc(maxShield * regen / 100) at KB end');
assert.equal(actor.lastBcuDemonShieldRegenEvent.type, 'shield-regen', 'KB end creates shield-regen event');
assert.equal(actor.lastBcuDemonShieldRegenEvent.phase, 'revive', 'shield regen event requests revive phase');
assert.equal(actor.lastBcuDemonShieldRegenTimingDebug.beforeShieldHp, 0, 'timing debug records before shield HP');
assert.equal(actor.lastBcuDemonShieldRegenTimingDebug.afterShieldHp, 250, 'timing debug records restored shield HP');
assert.equal(actor.lastBcuDemonShieldRegenTimingDebug.maxShieldHp, 500, 'timing debug records max shield HP');
assert.equal(actor.lastBcuDemonShieldRegenTimingDebug.regenPercent, 50, 'timing debug records regen percent');
assert.equal(actor.lastBcuDemonShieldRegenTimingDebug.delayed, true, 'timing debug records delayed/pending path');
assert.equal(actor.lastBcuDemonShieldRegenTimingDebug.pendingUsed, true, 'timing debug records pending consumption');

scene.runTickPhase('knockback-death', () => {});
assert.equal(scene.effects.length, 1, 'knockback-death phase spawns delayed SHIELD_REGEN visual');
const effect = scene.effects[0];
assert.equal(effect.effectRuntimeDebug.effectKey, 'demonShield', 'regen visual uses demonShield key');
assert.equal(effect.effectRuntimeDebug.phase, 'revive', 'regen visual uses revive phase');
assert.equal(effect.scale, 0.75, 'regen visual uses actor priority default scale 0.75');
assert.notEqual(effect.scale, 0, 'regen visual scale must not regress to 0');
assert.equal(effect.bcuSmokeYOffset, BCU_BARRIER_SHIELD_ICON_Y_OFFSET, 'regen visual uses BCU p.y -25*siz offset');
assert.equal(effect.bcuScaleMode, BCU_SCALE_MODE.ACTOR_PRIORITY_EFFECT, 'regen visual uses actor priority scale mode');
assert.equal(effect.currentLayer, 3, 'regen visual uses actor current layer');
assert.equal(scene.lastBcuBarrierShieldEffectDebug.scale, 0.75, 'scene debug records regen visual scale');
assert.equal(scene.lastBcuBarrierShieldEffectDebug.phase, 'revive', 'scene debug records regen visual phase');
assert.equal(scene.lastBcuBarrierShieldEffectDebug.layer, 3, 'scene debug records regen visual layer');

const deadScene = makeScene();
const deadActor = makeShieldActor(deadScene);
deadScene.actors = [deadActor];
deadActor.takeDamage(1000, { scene: deadScene });
const deadResolved = deadActor.resolvePostDamage({ nowMs: 0, tuning: {} });
assert.equal(deadResolved.deathPending || deadResolved.dead, true, 'lethal damage reaches death path');
assert.equal(deadActor.bcuDemonShieldRegenPending, undefined, 'death/final KB does not queue live shield regen');

console.log('check-bcu-demon-shield-regen-timing: OK');
