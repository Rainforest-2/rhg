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
for (let i = 0; i < SPIRIT_SUMMON_DELAY; i += 1) tickBcuSpiritState(scene);
assert.equal(scene.bcuSpiritState.get('summoner-slot').cooldownFrames, 0, 'cooldown ticks to zero');

const spawned = requestBcuSpiritSpawn(scene, 'summoner-slot');
assert.equal(spawned.ok, true, 'spirit spawns after cooldown');
assert.equal(spawned.spawned.length, 1, 'one spirit per living summoner is spawned');
const spirit = spawned.spawned[0];
assert.equal(spirit.bcuIsSpirit, true, 'spawned actor is marked as spirit role');
assert.equal(spirit.x, Math.max(800 + spirit.detectionRangeBcu, Math.min(3000 + SPIRIT_SUMMON_RANGE, 3200)), 'spirit spawn position matches BCU clamp formula');
assert.equal(spirit.state, 'attack', 'spirit starts attack on add');
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

console.log('check-bcu-spirit-lifecycle-parity: OK');
