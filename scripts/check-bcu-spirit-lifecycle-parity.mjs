import assert from 'node:assert/strict';
import { BattleActor } from '../js/battle/BattleActor.js';
import '../js/battle/BattleSceneBcuSpiritPatch.js';
import { BcuCombatModel } from '../js/battle/BcuCombatModel.js';
import {
  SPIRIT_SUMMON_DELAY,
  SPIRIT_SUMMON_RANGE,
  markBcuSummonerSpawned,
  requestBcuSpiritSpawn,
  tickBcuSpiritState
} from '../js/battle/bcu-runtime/BcuSpiritLifecycleRuntime.js';

function raw(length, entries) {
  const out = Array.from({ length }, () => 0);
  for (const [index, value] of entries) out[index] = value;
  return out;
}

function makeActor(id, model, x = 3000) {
  const actor = new BattleActor({
    assetDef: { id },
    sprite: null,
    model: { parts: [] },
    side: 'dog-player',
    x,
    y: 0,
    direction: -1,
    stats: { hp: 100, damage: 10, speed: 0, range: 100, detectionRange: 100, bcuCombatModel: model },
    animations: {
      anim00: { tracks: [], maxFrame: 1 },
      anim01: { tracks: [], maxFrame: 1 },
      anim02: { tracks: [], maxFrame: 6 }
    },
    attackAnimId: 'anim02'
  });
  actor.instanceId = id;
  actor.slotId = id;
  actor.detectionRangeBcu = 100;
  return actor;
}

const summonerModel = BcuCombatModel.parseStats({ kind: 'unit', rawValues: raw(120, [[110, 77]]) });
assert.equal(summonerModel.proc.spirit.id, 77, 'DataUnit.ints[110] parses SPIRIT.id');

const spiritModel = BcuCombatModel.parseStats({ kind: 'unit', rawValues: raw(120, []) });
const summoner = makeActor('summoner-slot', summonerModel, 3000);
const scene = {
  logicFrame: 0,
  timeMs: 0,
  actors: [summoner],
  bases: [
    { side: 'cat-enemy', posBcu: 800, getBattlePosBcu() { return this.posBcu; } },
    { side: 'dog-player', posBcu: 3200, getBattlePosBcu() { return this.posBcu; } }
  ],
  actorFactory: { templates: new Map([['spirit-slot', { unitDef: { slotId: 'spirit-slot' }, loadingLevel: 'spawn-ready' }]]) },
  bcuSpiritUnitDefs: new Map([['summoner-slot', { slotId: 'spirit-slot', statsType: 'unit', statsId: 77, side: 'dog-player', direction: -1, facing: -1, renderFlipX: true, moveAnimId: 'anim00', idleAnimId: 'anim01', attackAnimId: 'anim02', knockbackAnimId: 'anim03', bcuCombatModel: spiritModel }]]),
  spawnActor(unitDef, side, isPlayerProduced, options) {
    const a = makeActor(`spirit-${this.actors.length}`, spiritModel, options.x);
    a.slotId = unitDef.slotId;
    a.side = side;
    this.actors.push(a);
    return a;
  },
  pushEvent(event) { (this.events ||= []).push(event); }
};

markBcuSummonerSpawned(scene, summoner, { slotId: 'summoner-slot' });
assert.equal(scene.bcuSpiritState.get('summoner-slot').cooldownFrames, SPIRIT_SUMMON_DELAY, 'summoner spawn sets cooldown 15');
assert.equal(requestBcuSpiritSpawn(scene, 'summoner-slot').ok, false, 'spirit cannot spawn before cooldown');
for (let i = 0; i < SPIRIT_SUMMON_DELAY; i += 1) { scene.logicFrame += 1; tickBcuSpiritState(scene); }
assert.equal(scene.bcuSpiritState.get('summoner-slot').cooldownFrames, 0, 'cooldown ticks to zero');

const spawned = requestBcuSpiritSpawn(scene, 'summoner-slot');
assert.equal(spawned.ok, true, 'spirit spawns after cooldown');
assert.equal(spawned.spawned.length, 1, 'one spirit per living summoner is spawned');
const spirit = spawned.spawned[0];
assert.equal(spirit.bcuIsSpirit, true, 'spawned actor is marked as spirit role');
assert.equal(spirit.x, Math.max(800 + spirit.detectionRangeBcu, Math.min(3000 + SPIRIT_SUMMON_RANGE, 3200)), 'spirit spawn position matches BCU clamp formula');
assert.equal(spirit.state, 'attack', 'spirit starts attack on add');
assert.equal(spirit.currentAnimId, 'anim02', 'spirit switches to attack animation on add');
assert.equal(spirit.activeAnimRole, 'attack', 'spirit active animation role is attack on add');
assert.equal(requestBcuSpiritSpawn(scene, 'summoner-slot').ok, false, 'second spirit is rejected while one is alive');

const rejected = spirit.takeDamage(50, { timeMs: 1 });
assert.equal(rejected.accepted, false, 'spirit rejects incoming damage');
assert.equal(rejected.bcuSpiritDamageRejected, true, 'damage rejection is identified as spirit P_IMUATK path');
assert.equal(spirit.bcuProcStatuses.attackNullify.framesRemaining > 0, true, 'spirit damage rejection exposes A_IMUATK/status trace');

spirit.state = 'attack-wait';
tickBcuSpiritState(scene);
assert.equal(spirit.state, 'dead', 'spirit self-kills after attack completion');
scene.actors = [];
tickBcuSpiritState(scene);
assert.equal(scene.bcuSpiritState.get('summoner-slot').summonerSummoned, false, 'cleanup resets summoner flag when summoner disappears');
assert.equal(scene.bcuSpiritState.get('summoner-slot').spiritSummoned, false, 'cleanup resets spirit flag when spirit disappears');

// Live-play regression: the spirit must spawn through a real loading factory.
// Before this fix the spirit template was never preloaded, so BattleScene.spawnActor
// returned null and the conjure never appeared. spiritAttempt must also classify the
// tap so cooldown/loading taps are consumed instead of deploying a second summoner.
{
  const sModel = BcuCombatModel.parseStats({ kind: 'unit', rawValues: raw(120, [[110, 77]]) });
  const spModel = BcuCombatModel.parseStats({ kind: 'unit', rawValues: raw(120, []) });
  const summoner2 = makeActor('summoner2', sModel, 3000);
  const templates = new Map();
  let allowLoad = false;
  const factory = {
    templates,
    preloadTemplate(def) {
      if (allowLoad) templates.set(def.slotId, { unitDef: def, loadingLevel: 'spawn-ready' });
      return Promise.resolve();
    }
  };
  const scene2 = {
    logicFrame: 0,
    timeMs: 0,
    actors: [summoner2],
    bases: [
      { side: 'cat-enemy', posBcu: 800, getBattlePosBcu() { return this.posBcu; } },
      { side: 'dog-player', posBcu: 3200, getBattlePosBcu() { return this.posBcu; } }
    ],
    actorFactory: factory,
    bcuSpiritUnitDefs: new Map([['summoner2', { slotId: 'spirit-slot-2', statsType: 'unit', statsId: 77, side: 'dog-player', direction: -1, facing: -1, moveAnimId: 'anim00', idleAnimId: 'anim01', attackAnimId: 'anim02', knockbackAnimId: 'anim03', bcuCombatModel: spModel }]]),
    spawnActor(unitDef, side, isPlayerProduced, options) {
      if (!templates.has(unitDef.slotId)) return null;
      const a = makeActor(`spirit2-${this.actors.length}`, spModel, options.x);
      a.slotId = unitDef.slotId;
      a.side = side;
      this.actors.push(a);
      return a;
    },
    pushEvent() {}
  };

  const preSummon = requestBcuSpiritSpawn(scene2, 'summoner2');
  assert.equal(preSummon.spiritAttempt, false, 'first tap (no summoner) is not a spirit attempt and may deploy the summoner');

  markBcuSummonerSpawned(scene2, summoner2, { slotId: 'summoner2' });
  const onCooldown = requestBcuSpiritSpawn(scene2, 'summoner2');
  assert.equal(onCooldown.ok, false, 'spirit cannot spawn during cooldown');
  assert.equal(onCooldown.spiritAttempt, true, 'cooldown tap is a consumed spirit attempt, not a second summoner deploy');

  for (let i = 0; i < SPIRIT_SUMMON_DELAY; i += 1) { scene2.logicFrame += 1; tickBcuSpiritState(scene2); }
  const loading = requestBcuSpiritSpawn(scene2, 'summoner2');
  assert.equal(loading.ok, false, 'spirit does not spawn while its template is still loading');
  assert.equal(loading.reason, 'spirit-template-loading', 'unready spirit template yields an explicit loading reason');
  assert.equal(loading.spiritAttempt, true, 'loading tap is consumed and must not deploy a second summoner');

  allowLoad = true;
  requestBcuSpiritSpawn(scene2, 'summoner2'); // warms the template through the factory
  const ready = requestBcuSpiritSpawn(scene2, 'summoner2');
  assert.equal(ready.ok, true, 'spirit spawns once the preloaded template is ready (live spawnActor path)');
  assert.equal(ready.spawned[0].bcuIsSpirit, true, 'live-path spirit is marked as a spirit actor');
}

{
  const sModel = BcuCombatModel.parseStats({ kind: 'unit', rawValues: raw(120, [[110, 77]]) });
  const spModel = BcuCombatModel.parseStats({ kind: 'unit', rawValues: raw(120, []) });
  const warpedSummoner = makeActor('warped-summoner', sModel, 2600);
  warpedSummoner.bcuWarpLifecycle = { active: true, worldXBefore: 3000, worldXAfter: 2600, moved: true };
  const scene3 = {
    logicFrame: 0,
    timeMs: 0,
    actors: [warpedSummoner],
    bases: [
      { side: 'cat-enemy', posBcu: 800, getBattlePosBcu() { return this.posBcu; } },
      { side: 'dog-player', posBcu: 3200, getBattlePosBcu() { return this.posBcu; } }
    ],
    actorFactory: { templates: new Map([['spirit-slot-3', { unitDef: { slotId: 'spirit-slot-3' }, loadingLevel: 'spawn-ready' }]]) },
    bcuSpiritUnitDefs: new Map([['warped-summoner', { slotId: 'spirit-slot-3', statsType: 'unit', statsId: 77, side: 'dog-player', direction: -1, facing: -1, moveAnimId: 'anim00', idleAnimId: 'anim01', attackAnimId: 'anim02', knockbackAnimId: 'anim03', bcuCombatModel: spModel }]]),
    spawnActor(unitDef, side, isPlayerProduced, options) {
      const a = makeActor(`spirit3-${this.actors.length}`, spModel, options.x);
      a.slotId = unitDef.slotId;
      a.side = side;
      this.actors.push(a);
      return a;
    },
    pushEvent() {}
  };
  markBcuSummonerSpawned(scene3, warpedSummoner, { slotId: 'warped-summoner' });
  for (let i = 0; i < SPIRIT_SUMMON_DELAY; i += 1) { scene3.logicFrame += 1; tickBcuSpiritState(scene3); }
  const warped = requestBcuSpiritSpawn(scene3, 'warped-summoner');
  assert.equal(warped.ok, true, 'warped summoner can still conjure after cooldown');
  assert.equal(warped.spawned[0].x, Math.max(800 + 100, Math.min(3000 + SPIRIT_SUMMON_RANGE, 3200)), 'warped summoner uses pre-warp position for spirit spawn');
}

{
  const sModel = BcuCombatModel.parseStats({ kind: 'unit', rawValues: raw(120, [[110, 77]]) });
  const spModel = BcuCombatModel.parseStats({ kind: 'unit', rawValues: raw(120, []) });
  const cappedSummoner = makeActor('capacity-summoner', sModel, 3000);
  const scene4 = {
    logicFrame: 0,
    timeMs: 0,
    maxAliveActorsPerSide: 1,
    actors: [cappedSummoner],
    bases: [
      { side: 'cat-enemy', posBcu: 800, getBattlePosBcu() { return this.posBcu; } },
      { side: 'dog-player', posBcu: 3200, getBattlePosBcu() { return this.posBcu; } }
    ],
    actorFactory: { templates: new Map([['spirit-slot-4', { unitDef: { slotId: 'spirit-slot-4' }, loadingLevel: 'spawn-ready' }]]) },
    bcuSpiritUnitDefs: new Map([['capacity-summoner', { slotId: 'spirit-slot-4', statsType: 'unit', statsId: 77, side: 'dog-player', direction: -1, facing: -1, moveAnimId: 'anim00', idleAnimId: 'anim01', attackAnimId: 'anim02', knockbackAnimId: 'anim03', bcuCombatModel: spModel }]]),
    spawnActor() { throw new Error('capacity-full spirit must not spawn'); },
    pushEvent() {}
  };
  markBcuSummonerSpawned(scene4, cappedSummoner, { slotId: 'capacity-summoner' });
  for (let i = 0; i < SPIRIT_SUMMON_DELAY; i += 1) { scene4.logicFrame += 1; tickBcuSpiritState(scene4); }
  const capped = requestBcuSpiritSpawn(scene4, 'capacity-summoner');
  assert.equal(capped.ok, false, 'spirit spawn is rejected when BCU side capacity is full');
  assert.equal(capped.reason, 'spirit-capacity-full', 'capacity rejection is explicit');
  assert.equal(capped.capacityUsed, 1, 'summoner itself occupies one BCU side-capacity slot');
}

console.log('check-bcu-spirit-lifecycle-parity: OK');
