import assert from 'node:assert/strict';
import '../js/battle/BcuDelayRuntimePatch.js';
import { BattleActor } from '../js/battle/BattleActor.js';
import { BattleEconomy } from '../js/battle/BattleEconomy.js';
import { BcuCombatModel } from '../js/battle/BcuCombatModel.js';
import { ProcResolver } from '../js/battle/ProcResolver.js';
import {
  applyBcuDelayProc,
  applyBcuPlayerCooldownDelay,
  applyBcuStageLineDelay,
  buildBcuDelayVector,
  flushBcuDelayProcQueues,
  getBcuDelayStrength,
  queueBcuDelayProc
} from '../js/battle/bcu-runtime/BcuDelayRuntime.js';

function raw(length, entries) {
  const out = Array.from({ length }, () => 0);
  for (const [index, value] of entries) out[index] = value;
  return out;
}

assert.deepEqual(buildBcuDelayVector({ strength: 45 }), { type: 0, strength: 45, delay: [45, 0, 0] }, 'default delay type is BCU type 0 percentage-progress delay');
assert.deepEqual(buildBcuDelayVector({ strength: 8, type: 1 }), { type: 1, strength: 8, delay: [0, 8, 0] }, 'delay type 1 maps direct value');
assert.deepEqual(buildBcuDelayVector({ strength: 25, type: 2 }), { type: 2, strength: 25, delay: [0, 0, 25] }, 'delay type 2 maps percentage-of-max cooldown');
assert.equal(getBcuDelayStrength(40, 100, [50, 0, 0]), 30, 'BCU getDelayStrength type0 uses progress percentage');
assert.equal(getBcuDelayStrength(40, 100, [0, 8, 0]), 8, 'BCU getDelayStrength type1 uses direct value capped by current');
assert.equal(getBcuDelayStrength(40, 100, [0, 0, 25]), 25, 'BCU getDelayStrength type2 uses max percentage');
assert.equal(getBcuDelayStrength(1, 100, [-50, 0, 0]), -49, 'BCU getDelayStrength keeps Java integer percentage result when nonzero');
assert.equal(getBcuDelayStrength(99, 100, [-50, 0, 0]), -1, 'BCU getDelayStrength preserves minimum -1 for zero negative percentage delay');

const catalog = ProcResolver.getProcCatalog();
assert.equal(catalog.delay.implemented, true, 'ProcResolver catalog exposes delay after BcuDelayRuntimePatch import');
assert.equal(catalog.delay.runtime.includes('BcuDelayRuntime'), true, 'delay catalog points at BcuDelayRuntime');

const delayEnemyModel = BcuCombatModel.parseStats({ kind: 'enemy', rawValues: raw(116, [[111, 100], [112, 50]]) });
assert.equal(delayEnemyModel.proc.delay.prob, 100, 'enemy delay parser still reads probability');
assert.equal(delayEnemyModel.proc.delay.strength, 50, 'enemy delay parser still reads strength');

const economy = new BattleEconomy({ startMoney: 1000, maxMoney: 1000, incomePerSecond: 0 });
economy.cooldownFrames.set('prod-u', 40);
economy.cooldowns.set('prod-u', 40 * 33);
const playerScene = {
  economy,
  logicFrame: 10,
  timeMs: 330,
  findPlayerProductionUnit: (slotId) => slotId === 'prod-u' ? { slotId, bcuRespawnFrames: 100, cooldownMs: 3300 } : null,
  events: [],
  pushEvent(event) { this.events.push(event); }
};
const playerActor = { side: 'dog-player', slotId: 'prod-u', scene: playerScene, instanceId: 'unit-delay-target' };
const playerDelay = applyBcuPlayerCooldownDelay({ actor: playerActor, scene: playerScene, payload: { strength: 50, type: 0 } });
assert.equal(playerDelay.applied, true, 'player cooldown delay applies when cooldown is active');
assert.equal(playerDelay.current, 40, 'player delay uses current cooldown frames');
assert.equal(playerDelay.max, 100, 'player delay uses bcuRespawnFrames as max cooldown');
assert.equal(playerDelay.inc, 30, 'player delay increment follows BCU getDelayStrength');
assert.equal(economy.getCooldownFrames('prod-u'), 70, 'player cooldown frames updated by delay');
assert.equal(playerScene.events.some((event) => event.type === 'bcuDelayCooldownApplied'), true, 'player delay emits debug event');

const stageRuntime = {
  lastTickFrame: 10,
  rows: [{ rowIndex: 2, nextFrame: 50, row: { respawnMinFrame: 20, respawnMaxFrame: 100 }, exhausted: false, done: false, disabled: false }]
};
const stageScene = { stageSpawnRuntime: stageRuntime, logicFrame: 10, events: [], pushEvent(event) { this.events.push(event); } };
const enemyActor = { side: 'cat-enemy', stageSpawnRowIndex: 2, scene: stageScene, instanceId: 'enemy-delay-target' };
const enemyDelay = applyBcuStageLineDelay({ actor: enemyActor, scene: stageScene, payload: { strength: 50, type: 0 } });
assert.equal(enemyDelay.applied, true, 'stage line delay applies when rem is active');
assert.equal(enemyDelay.current, 40, 'stage line delay uses nextFrame - current frame as rem');
assert.equal(enemyDelay.max, 100, 'stage line delay uses max respawn as BCU EStage.delay max');
assert.equal(enemyDelay.inc, 30, 'stage line delay increment follows BCU getDelayStrength');
assert.equal(stageRuntime.rows[0].nextFrame, 80, 'stage row nextFrame updated by delay');
assert.equal(stageScene.events.some((event) => event.type === 'bcuDelayStageLineApplied'), true, 'stage line delay emits debug event');

const aggregateEconomy = new BattleEconomy({ startMoney: 1000, maxMoney: 1000, incomePerSecond: 0 });
aggregateEconomy.cooldownFrames.set('prod-agg', 40);
aggregateEconomy.cooldowns.set('prod-agg', 40 * 33);
const aggregateScene = {
  economy: aggregateEconomy,
  logicFrame: 20,
  timeMs: 660,
  findPlayerProductionUnit: (slotId) => slotId === 'prod-agg' ? { slotId, bcuRespawnFrames: 100 } : null,
  events: [],
  pushEvent(event) { this.events.push(event); }
};
const aggregateActor = { side: 'dog-player', slotId: 'prod-agg', scene: aggregateScene, instanceId: 'unit-delay-aggregate' };
assert.equal(queueBcuDelayProc(aggregateActor, { key: 'delay', payload: { strength: 25, type: 0 } }, { scene: aggregateScene }).queued, true, 'first same-tick delay queues');
assert.equal(queueBcuDelayProc(aggregateActor, { key: 'delay', payload: { strength: 25, type: 0 } }, { scene: aggregateScene }).queued, true, 'second same-tick delay queues');
const aggregateFlush = flushBcuDelayProcQueues(aggregateScene, 'test-same-tick');
assert.equal(aggregateFlush.processed, 2, 'same-tick delay flush processes both queued procs');
assert.equal(aggregateEconomy.getCooldownFrames('prod-agg'), 70, 'same-tick type0 delays aggregate before applying percentage to current cooldown');
assert.equal(aggregateScene.events.some((event) => event.type === 'bcuDelayQueueFlushed' && event.processed === 2), true, 'same-tick delay emits aggregate flush trace');

const immuneActor = new BattleActor({ side: 'dog-player', x: 0, y: 0, stats: { hp: 100 } });
immuneActor.instanceId = 'delay-immune';
immuneActor.slotId = 'prod-u';
immuneActor.bcuCombatModel = { kind: 'unit', proc: { IMUDELAY: { mult: 100, block: 100 } }, immunity: { delay: { mult: 100 } }, ability: { abi: 0 } };
const immuneResult = immuneActor.applyBcuProc({ key: 'delay', payload: { strength: 50, type: 0 } }, { scene: playerScene });
assert.equal(immuneResult.immune, true, 'full IMUDELAY blocks delay runtime');
assert.equal(economy.getCooldownFrames('prod-u'), 70, 'full IMUDELAY does not change cooldown');

const partialEconomy = new BattleEconomy({ startMoney: 1000, maxMoney: 1000, incomePerSecond: 0 });
partialEconomy.cooldownFrames.set('prod-partial', 40);
partialEconomy.cooldowns.set('prod-partial', 40 * 33);
const partialScene = {
  economy: partialEconomy,
  logicFrame: 21,
  timeMs: 693,
  effects: [],
  waveEffectAssets: {},
  ensureWaveEffectLoading() {},
  findPlayerProductionUnit: (slotId) => slotId === 'prod-partial' ? { slotId, bcuRespawnFrames: 100 } : null,
  events: [],
  pushEvent(event) { this.events.push(event); }
};
const partialActor = new BattleActor({ side: 'dog-player', x: 0, y: 0, stats: { hp: 100 } });
partialActor.instanceId = 'delay-partial';
partialActor.slotId = 'prod-partial';
partialActor.scene = partialScene;
partialActor.bcuCombatModel = { kind: 'unit', proc: { IMUDELAY: { mult: 50, block: 50 } }, immunity: { delay: { mult: 50 } }, ability: { abi: 0 } };
const partialResult = partialActor.applyBcuProc({ key: 'delay', payload: { strength: 60, type: 0 } }, { scene: partialScene });
assert.equal(partialResult.queued, true, 'partial IMUDELAY still queues adjusted delay');
flushBcuDelayProcQueues(partialScene, 'test-partial-resistance');
assert.equal(partialEconomy.getCooldownFrames('prod-partial'), 58, 'partial IMUDELAY reduces delay strength before aggregate application');

const noCooldown = applyBcuDelayProc({ side: 'dog-player', slotId: 'missing', scene: playerScene, isAlive: () => true }, { key: 'delay', payload: { strength: 50, type: 0 } }, { scene: playerScene });
assert.equal(noCooldown.applied, false, 'delay does not apply when no active cooldown/rem target exists');

console.log('check-bcu-delay-runtime: OK');
