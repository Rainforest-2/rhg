import assert from 'node:assert/strict';
import { BattleActor } from '../js/battle/BattleActor.js';
import { BcuCombatModel } from '../js/battle/BcuCombatModel.js';
import '../js/battle/BattleActorBarrierShieldPatch.js';
import '../js/battle/BattleActorBarrierShieldVisualPatch.js';
import '../js/battle/BattleBcuPriorityEffectRuntimePatch.js';
import { BCU_SCALE_MODE } from '../js/battle/bcu-runtime/BcuEffectTraceRuntime.js';
import {
  BCU_BARRIER_SHIELD_ICON_Y_OFFSET,
  describeBcuBarrierShieldVisual,
  processBcuBarrierShieldEffectQueue,
  spawnBcuBarrierShieldVisual
} from '../js/battle/bcu-runtime/BcuBarrierShieldEffectRuntime.js';

function raw(length, entries) {
  const out = Array.from({ length }, () => 0);
  for (const [index, value] of entries) out[index] = value;
  return out;
}

function fakeAsset(maxFrame = 4, phases = ['none', 'breaker', 'destruction', 'full', 'half', 'revive']) {
  const anim = { tracks: [], maxFrame };
  return {
    loaded: true,
    image: {},
    imgcut: { parts: [] },
    model: { parts: [], baseScale: 1000, baseAngle: 3600, baseOpacity: 255 },
    anim,
    phases: Object.fromEntries(phases.map((phase) => [phase, { tracks: [], maxFrame }])),
    source: 'test:barrier-shield'
  };
}

function fakeScene(assetsReady = true) {
  return {
    logicFrame: 1,
    timeMs: 0,
    effects: [],
    events: [],
    waveEffectAssets: assetsReady ? {
      unitBarrier: fakeAsset(3, ['none', 'breaker', 'destruction']),
      enemyBarrier: fakeAsset(3, ['none', 'breaker', 'destruction']),
      demonShield: fakeAsset(5, ['full', 'half', 'destruction', 'breaker', 'revive'])
    } : {},
    ensureWaveEffectLoading() { this.ensureCalled = (this.ensureCalled || 0) + 1; },
    pushEvent(event) { this.events.push(event); }
  };
}

function actorWithModel(model, scene, side = 'cat-enemy') {
  const actor = new BattleActor({
    assetDef: { id: `${side}-actor` },
    side,
    x: 100,
    y: 0,
    direction: side === 'dog-player' ? -1 : 1,
    stats: { hp: 1000, damage: 100, bcuCombatModel: model },
    animations: { anim00: { tracks: [], maxFrame: 1 } }
  });
  actor.scene = scene;
  actor.instanceId = `${side}-actor`;
  actor.currentLayer = 2;
  return actor;
}

const enemyBarrierModel = BcuCombatModel.parseStats({ kind: 'enemy', rawValues: raw(116, [[64, 500]]) });
const enemyShieldModel = BcuCombatModel.parseStats({ kind: 'enemy', rawValues: raw(116, [[87, 500], [88, 50]]) });
assert.equal(enemyBarrierModel.proc.barrier.health, 500, 'DataEnemy.ints[64] parses barrier HP');
assert.equal(enemyShieldModel.proc.demonShield.hp, 500, 'DataEnemy.ints[87] parses demon shield HP');
assert.equal(enemyShieldModel.proc.demonShield.regen, 50, 'DataEnemy.ints[88] parses demon shield regen percent');

const barrierSpec = describeBcuBarrierShieldVisual({ side: 'cat-enemy', direction: 1 }, { type: 'barrier-hit-blocked' });
assert.equal(barrierSpec.key, 'enemyBarrier', 'enemy barrier uses A_E_B alias');
assert.equal(barrierSpec.phase, 'none', 'blocked barrier hit uses BarrierEff.NONE');
assert.equal(barrierSpec.type, 'barrier', 'barrier visual type is actor priority barrier');

const barrierBreakSpec = describeBcuBarrierShieldVisual({ side: 'dog-player', direction: -1 }, { type: 'barrier-breaker' });
assert.equal(barrierBreakSpec.key, 'unitBarrier', 'friendly barrier uses mirrored A_B alias');
assert.equal(barrierBreakSpec.phase, 'breaker', 'barrier breaker uses BarrierEff.BREAK');

const shieldSpecFull = describeBcuBarrierShieldVisual({ side: 'cat-enemy', direction: 1, bcuDemonShieldMaxHp: 500 }, { type: 'shield-hit-absorbed', before: 500, after: 300, max: 500 });
assert.equal(shieldSpecFull.key, 'demonShield', 'demon shield uses shared A_DEMON_SHIELD bundle alias');
assert.equal(shieldSpecFull.phase, 'full', 'shield hit above half uses ShieldEff.FULL');
const shieldSpecHalf = describeBcuBarrierShieldVisual({ side: 'cat-enemy', direction: 1, bcuDemonShieldMaxHp: 500 }, { type: 'shield-hit-absorbed', before: 300, after: 200, max: 500 });
assert.equal(shieldSpecHalf.phase, 'half', 'shield hit below half uses ShieldEff.HALF');
assert.equal(describeBcuBarrierShieldVisual({ side: 'cat-enemy', direction: 1 }, { type: 'shield-broken-by-damage' }).phase, 'destruction', 'shield break by damage uses ShieldEff.BROKEN/destruction');
assert.equal(describeBcuBarrierShieldVisual({ side: 'cat-enemy', direction: 1 }, { type: 'shield-pierced' }).phase, 'breaker', 'shield pierce uses ShieldEff.BREAKER');
assert.equal(describeBcuBarrierShieldVisual({ side: 'cat-enemy', direction: 1 }, { type: 'shield-regen' }).phase, 'revive', 'shield regen uses ShieldEff.REGENERATION/revive');

const scene = fakeScene(true);
const barrierActor = actorWithModel(enemyBarrierModel, scene, 'cat-enemy');
const blocked = barrierActor.takeDamage(100, { scene });
assert.equal(blocked.accepted, false, 'insufficient barrier damage blocks current hit like BCU');
assert.equal(blocked.blockedBy, 'barrier', 'barrier block result marks barrier');
assert.equal(scene.effects.length, 1, 'barrier block spawns visual immediately');
assert.equal(scene.effects[0].effectRuntimeDebug.effectKey, 'enemyBarrier', 'barrier block uses enemyBarrier effect key');
assert.equal(scene.effects[0].effectRuntimeDebug.phase, 'none', 'barrier block uses none phase');
assert.equal(scene.effects[0].bcuSmokeYOffset, BCU_BARRIER_SHIELD_ICON_Y_OFFSET, 'barrier visual uses BCU p.y -25*siz offset');
assert.equal(scene.effects[0].scale, 0.75, 'barrier visual uses BCU actor priority scale 0.75');
assert.notEqual(scene.effects[0].scale, 0, 'barrier visual default scale must not regress to 0');
assert.equal(scene.effects[0].bcuScaleMode, BCU_SCALE_MODE.ACTOR_PRIORITY_EFFECT, 'barrier visual uses actor priority effect scale mode');
assert.equal(scene.lastBcuBarrierShieldEffectDebug.scale, 0.75, 'barrier effect debug records resolved scale');
assert.equal(scene.lastBcuBarrierShieldEffectDebug.layer, 2, 'barrier effect debug records actor priority layer');

const shieldScene = fakeScene(true);
const shieldActor = actorWithModel(enemyShieldModel, shieldScene, 'cat-enemy');
const shieldHit = shieldActor.takeDamage(300, { scene: shieldScene });
assert.equal(shieldHit.accepted, false, 'demon shield absorbs insufficient damage like BCU');
assert.equal(shieldActor.bcuDemonShieldHp, 200, 'demon shield HP is reduced by absorbed damage');
assert.equal(shieldScene.effects.length, 1, 'demon shield hit spawns visual immediately');
assert.equal(shieldScene.effects[0].effectRuntimeDebug.effectKey, 'demonShield', 'demon shield visual uses demonShield key');
assert.equal(shieldScene.effects[0].effectRuntimeDebug.phase, 'half', 'demon shield visual picks half when remaining shield is under half');
assert.equal(shieldScene.effects[0].bcuSmokeYOffset, BCU_BARRIER_SHIELD_ICON_Y_OFFSET, 'demon shield visual uses BCU p.y -25*siz offset');
assert.equal(shieldScene.effects[0].scale, 0.75, 'demon shield visual uses BCU actor priority scale 0.75');
assert.notEqual(shieldScene.effects[0].scale, 0, 'demon shield visual default scale must not regress to 0');

const shieldBreakScene = fakeScene(true);
const shieldBreakActor = actorWithModel(enemyShieldModel, shieldBreakScene, 'cat-enemy');
const shieldBreak = shieldBreakActor.takeDamage(500, { scene: shieldBreakScene });
assert.equal(shieldBreak.accepted, false, 'demon shield break by damage cancels body damage like BCU');
assert.equal(shieldBreak.blockedBy, 'shield', 'demon shield break by damage is still a shield block');
assert.equal(shieldBreakScene.effects[0].effectRuntimeDebug.phase, 'destruction', 'demon shield break by damage spawns destruction phase');

const shieldPierceScene = fakeScene(true);
const shieldPierceActor = actorWithModel(enemyShieldModel, shieldPierceScene, 'cat-enemy');
const shieldPierce = shieldPierceActor.takeDamage(200, {
  scene: shieldPierceScene,
  damageCalculation: { proc: { applied: [{ key: 'shieldPierce' }] } }
});
assert.equal(shieldPierce.accepted, true, 'shield pierce breaks shield and lets body damage through like BCU');
assert.equal(shieldPierceActor.bcuDemonShieldHp, 0, 'shield pierce clears current shield HP');
assert.equal(shieldPierceScene.effects[0].effectRuntimeDebug.phase, 'breaker', 'shield pierce spawns breaker phase');

const friendlyBarrierScene = fakeScene(true);
const friendlyBarrierActor = actorWithModel(enemyBarrierModel, friendlyBarrierScene, 'dog-player');
const friendlyBarrier = friendlyBarrierActor.takeDamage(100, { scene: friendlyBarrierScene });
assert.equal(friendlyBarrier.accepted, false, 'friendly barrier blocks insufficient damage');
assert.equal(friendlyBarrierScene.effects[0].effectRuntimeDebug.effectKey, 'unitBarrier', 'friendly barrier uses unitBarrier key');
assert.equal(friendlyBarrierScene.effects[0].renderFlipX, true, 'friendly barrier keeps unit-side render flip');

const missingScene = fakeScene(false);
const missingActor = actorWithModel(enemyBarrierModel, missingScene, 'cat-enemy');
const event = { type: 'barrier-hit-blocked', before: 500, after: 500 };
const queued = spawnBcuBarrierShieldVisual(missingScene, missingActor, event, { source: 'test-missing-asset' });
assert.ok(queued && !queued.id, 'missing barrier asset queues retry item instead of dropping visual permanently');
assert.equal(missingScene.__bcuBarrierShieldEffectQueue.length, 1, 'retry queue stores missing barrier visual');
assert.equal(missingScene.ensureCalled, 1, 'missing visual requests wave effect loading');
missingScene.waveEffectAssets = { enemyBarrier: fakeAsset(3, ['none', 'breaker', 'destruction']) };
const retry = processBcuBarrierShieldEffectQueue(missingScene);
assert.equal(retry.spawned, 1, 'queued barrier visual spawns after asset becomes available');
assert.equal(missingScene.effects.length, 1, 'retry path adds effect');
assert.equal(event.__bcuBarrierShieldVisualSpawned, true, 'event is marked spawned to prevent duplicates');
assert.equal(spawnBcuBarrierShieldVisual(missingScene, missingActor, event, { source: 'duplicate-test' }), missingScene.effects[0], 'duplicate spawn returns existing effect');
assert.equal(missingScene.effects.length, 1, 'duplicate spawn does not add a second effect');

console.log('check-bcu-barrier-shield-effect-parity: OK');
