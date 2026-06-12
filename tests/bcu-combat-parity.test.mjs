import test from 'node:test';
import assert from 'node:assert/strict';

import { BCU_ABI, BCU_TRAITS, BcuCombatModel } from '../js/battle/BcuCombatModel.js';
import { BattleActor } from '../js/battle/BattleActor.js';
import { BattleScene } from '../js/battle/BattleScene.js';
import { DamageAbilityResolver } from '../js/battle/DamageAbilityResolver.js';
import { ProcResolver } from '../js/battle/ProcResolver.js';
import { guardBcuDamage } from '../js/battle/bcu-runtime/BcuDamageGuardRuntime.js';

import '../js/battle/BattleActorProcStatusPatch.js';
import '../js/battle/BattleDeterministicRandomPatch.js';
import '../js/battle/BattleActorAttackNullifyPatch.js';
import '../js/battle/BattleSceneBcuAttackPhasePatch.js';
import '../js/battle/BattleSceneProcApplyPatch.js';
import '../js/battle/BattleSceneBcuProcRuntimePatch.js';
import '../js/battle/BattleSceneBcuStageBasisPhaseBridgePatch.js';
import '../js/battle/BattleSceneBcuStageBasisTickPatch.js';
import '../js/battle/BcuKnockbackRuntimePatch.js';
import '../js/battle/BcuKnockbackProcPriorityPatch.js';
import '../js/battle/BcuProcImmunityPatch.js';

function raw(length, entries) {
  const values = Array.from({ length }, () => 0);
  for (const [index, value] of Object.entries(entries)) values[Number(index)] = value;
  return values;
}

function actor(overrides = {}) {
  return new BattleActor({
    assetDef: {},
    sprite: null,
    model: null,
    side: overrides.side || 'enemy',
    x: 0,
    y: 0,
    stats: { hp: overrides.maxHp || 1000, damage: overrides.damage || 100 },
    animations: {},
    ...overrides.actorArgs
  });
}

function sceneStub() {
  return Object.assign(Object.create(BattleScene.prototype), {
    timeMs: 0,
    logicFrame: 0,
    stageId: 1,
    actors: [],
    pushEvent(event) {
      this.events = this.events || [];
      this.events.push(event);
    },
    spawnHitEffect() {}
  });
}

test('BcuCombatModel parses unit full IMU* guard fields', () => {
  const model = BcuCombatModel.parseStats({
    kind: 'unit',
    rawValues: raw(117, {
      46: 1,
      48: 1,
      49: 1,
      50: 1,
      51: 1,
      75: 1,
      79: 1,
      90: 1,
      91: 1,
      116: 1
    })
  });

  for (const field of ['IMUKB', 'IMUSTOP', 'IMUSLOW', 'IMUWEAK', 'IMUCURSE', 'IMUWARP', 'IMUPOIATK', 'IMUWAVE', 'IMUVOLC', 'IMUBLAST']) {
    assert.equal(model.proc[field].mult, 100, `${field} mult`);
    assert.equal(model.proc[field].full, true, `${field} full`);
  }
  assert.equal(model.immunity.freeze.field, 'IMUSTOP');
  assert.equal(model.immunity.slow.full, true);
  assert.equal(model.immunity.toxic.full, true);
  assert.equal(model.immunity.wave.full, true);
  assert.equal(model.immunity.surge.full, true);
  assert.equal(model.immunity.blast.full, true);
  assert.equal(model.proc.knockback.dis, 165);
  assert.equal(model.proc.knockback.time, 11);
});

test('BcuCombatModel parses enemy full IMU* guard fields with confirmed DataEnemy columns', () => {
  const model = BcuCombatModel.parseStats({
    kind: 'enemy',
    rawValues: raw(113, { 37: 1, 39: 1, 40: 1, 41: 1, 42: 1, 70: 1, 85: 1, 105: 1, 109: 1 })
  });

  for (const field of ['IMUKB', 'IMUSTOP', 'IMUSLOW', 'IMUWEAK', 'IMUCURSE', 'IMUWARP', 'IMUWAVE', 'IMUVOLC', 'IMUBLAST']) {
    assert.equal(model.proc[field].mult, 100, `${field} mult`);
  }
  assert.equal(model.proc.IMUPOIATK.mult, 0);
  assert.match(model.proc.IMUPOIATK.source, /no confirmed IMUPOIATK raw column/);
});

test('applyBcuProc rejects full immunity status procs without state side effects', () => {
  const target = actor();
  target.bcuCombatModel = BcuCombatModel.parseStats({
    kind: 'unit',
    rawValues: raw(117, { 48: 1, 49: 1, 50: 1, 51: 1, 75: 1, 79: 1, 90: 1 })
  });
  target.pendingDamage = 0;
  target.pendingHits = [];

  const items = [
    ['knockbackProc', {}],
    ['freeze', { time: 90, timeFrames: 90 }],
    ['slow', { time: 90, timeFrames: 90 }],
    ['weaken', { time: 90, timeFrames: 90, mult: 50 }],
    ['curse', { time: 90, timeFrames: 90 }],
    ['warp', { time: 90, timeFrames: 90, dis0: 10, dis1: 20 }],
    ['toxic', { mult: 30 }]
  ];

  for (const [key, payload] of items) {
    const result = target.applyBcuProc({ key, payload }, { nowMs: 0, tuning: {} });
    assert.equal(result.applied, false, key);
    assert.equal(result.immune, true, key);
  }
  assert.deepEqual(target.bcuProcStatuses || {}, {});
  assert.equal(target.pendingDamage, 0);
  assert.equal(target.state, 'move');
});

test('applyBcuProc applies partial resistance to status duration and toxic damage', () => {
  const target = actor({ maxHp: 1000 });
  target.bcuCombatModel = {
    kind: 'unit',
    proc: {
      IMUSTOP: { mult: 50 },
      IMUPOIATK: { mult: 50 }
    }
  };
  target.pendingDamage = 0;
  target.pendingHits = [];

  const freeze = target.applyBcuProc({ key: 'freeze', payload: { time: 100, timeFrames: 100 } }, { nowMs: 0, tuning: {} });
  assert.equal(freeze.applied, true);
  assert.equal(freeze.status.framesRemaining, 50);
  assert.equal(freeze.bcuProcResistance.field, 'IMUSTOP');

  const toxic = target.applyBcuProc({ key: 'toxic', payload: { mult: 40 } }, { nowMs: 0, tuning: {} });
  assert.equal(toxic.applied, true);
  assert.equal(toxic.damage, 200);
  // Standalone toxic resolves immediately (BCU processProcs POIATK damage is applied in the
  // same tick's postUpdate); pendingDamage is flushed into hp by resolvePostDamage.
  assert.equal(target.pendingDamage, 0);
  assert.equal(target.hp, 800);
});

test('IMUWEAK smartImu follows BCU checkSmartImu direction', () => {
  const target = actor({ maxHp: 1000 });
  target.bcuCombatModel = { kind: 'unit', proc: { IMUWEAK: { mult: 100, smartImu: -1 } } };

  let result = target.applyBcuProc({ key: 'weaken', payload: { time: 90, timeFrames: 90, mult: 50 } }, { nowMs: 0, tuning: {} });
  assert.equal(result.applied, true);
  assert.equal(result.immune, undefined);

  target.bcuProcStatuses = {};
  target.bcuCombatModel.proc.IMUWEAK.smartImu = 1;
  result = target.applyBcuProc({ key: 'weaken', payload: { time: 90, timeFrames: 90, mult: 50 } }, { nowMs: 0, tuning: {} });
  assert.equal(result.applied, false);
  assert.equal(result.immune, true);
});

test('applyBcuProc applies partial knockback resistance to proc KB distance', () => {
  const target = actor({ maxHp: 1000 });
  target.bcuCombatModel = { kind: 'unit', proc: { IMUKB: { mult: 50 } } };

  const result = target.applyBcuProc({ key: 'knockbackProc', payload: { dis: 165, time: 11, timeFrames: 11 } }, { nowMs: 0, tuning: {} });
  assert.equal(result.applied, true);
  assert.equal(result.dis, 82.5);
  assert.equal(target.bcuTempKbDist, 82.5);
});

test('ProcResolver suppresses curse and seal proc groups before runtime apply', () => {
  const target = { side: 'enemy', traits: ['red'], traitFlags: { red: true } };
  const attacker = {
    side: 'dog-player',
    bcuCombatModel: {
      kind: 'unit',
      targetTraits: { list: ['red'] },
      proc: {
        freeze: { prob: 100, time: 90 },
        barrierBreaker: { prob: 100 }
      }
    },
    bcuProcStatuses: { curse: { framesRemaining: 3 } }
  };

  let result = ProcResolver.resolve({ attacker, target, targetType: 'actor', event: {}, context: { random: () => 0 } });
  assert.equal(result.pending.some((item) => item.key === 'freeze'), false);
  assert.equal(result.skipped.some((item) => item.key === 'freeze' && item.reason === 'attacker-curse-suppressed-proc'), true);

  attacker.bcuProcStatuses = { seal: { framesRemaining: 3 } };
  result = ProcResolver.resolve({ attacker, target, targetType: 'actor', event: {}, context: { random: () => 0 } });
  assert.equal(result.pending.some((item) => item.key === 'barrierBreaker'), false);
  assert.equal(result.skipped.some((item) => item.key === 'barrierBreaker' && item.reason === 'attacker-seal-suppressed-proc'), true);
});

test('guardBcuDamage rejects wave, surge, blast, and toxic queue before damage is pending', () => {
  const target = actor();
  target.bcuCombatModel = BcuCombatModel.parseStats({
    kind: 'unit',
    rawValues: raw(117, { 46: 1, 90: 1, 91: 1, 116: 1 })
  });

  for (const kind of ['wave', 'miniWave', 'surge', 'miniSurge', 'blast', 'toxic']) {
    const result = guardBcuDamage({ target, attack: { attackKind: kind }, kind });
    assert.equal(result.accepted, false, kind);
    assert.match(result.reason, /^immunity:/);
  }
});

test('queueAttackDamage applies partial wave resistance before enqueueing damage', () => {
  const attacker = actor({ side: 'dog-player', damage: 200 });
  const target = actor({ side: 'enemy', maxHp: 1000 });
  target.bcuCombatModel = { kind: 'unit', immunity: { wave: { field: 'IMUWAVE', mult: 50 } }, proc: {} };
  const scene = sceneStub();

  const result = BattleScene.prototype.queueAttackDamage.call(scene, attacker, target, 'actor', { attackKind: 'wave', damage: 200 }, { key: 'wave:partial' });
  assert.equal(result.accepted, true);
  assert.equal(target.pendingDamage, 100);
});

test('queueAttackDamage guard rejection does not enqueue pending damage or procs', () => {
  const attacker = actor({ side: 'dog-player', damage: 200 });
  const target = actor({ side: 'enemy', maxHp: 1000 });
  target.bcuCombatModel = BcuCombatModel.parseStats({ kind: 'unit', rawValues: raw(117, { 46: 1 }) });
  const scene = sceneStub();

  const result = BattleScene.prototype.queueAttackDamage.call(scene, attacker, target, 'actor', { attackKind: 'wave', damage: 200 }, { key: 'wave:0' });
  assert.equal(result.accepted, false);
  assert.equal(result.procAccepted, false);
  assert.equal(target.pendingDamage, 0);
  assert.equal(target.hp, target.maxHp);
});

test('normal queueAttackDamage still enqueues regular attack damage', () => {
  const attacker = actor({ side: 'dog-player', damage: 120 });
  const target = actor({ side: 'enemy', maxHp: 1000 });
  const scene = sceneStub();

  const result = BattleScene.prototype.queueAttackDamage.call(scene, attacker, target, 'actor', { attackKind: 'normal', damage: 120 }, { key: 'normal:0' });
  assert.equal(result.accepted, true);
  assert.equal(target.pendingDamage, 120);
  assert.equal(target.hp, target.maxHp);
});


test('curse and seal suppress DamageAbilityResolver trait ability multipliers and restore when expired', () => {
  const attackerModel = {
    kind: 'unit',
    targetTraits: { list: [BCU_TRAITS.red] },
    traits: { list: [BCU_TRAITS.red], flags: { [BCU_TRAITS.red]: true } },
    ability: { abi: BCU_ABI.AB_MASSIVE },
    proc: {}
  };
  const attacker = { side: 'dog-player', bcuCombatModel: attackerModel, bcuProcStatuses: {} };
  const enemy = { side: 'enemy', traits: [BCU_TRAITS.red], traitFlags: { [BCU_TRAITS.red]: true } };

  assert.equal(DamageAbilityResolver.resolve({ attacker, target: enemy, targetType: 'actor', baseDamage: 100 }).finalDamage, 400);
  attacker.bcuProcStatuses.curse = { framesRemaining: 3 };
  assert.equal(DamageAbilityResolver.resolve({ attacker, target: enemy, targetType: 'actor', baseDamage: 100 }).finalDamage, 100);
  attacker.bcuProcStatuses.curse.framesRemaining = 0;
  assert.equal(DamageAbilityResolver.resolve({ attacker, target: enemy, targetType: 'actor', baseDamage: 100 }).finalDamage, 400);

  const enemyAttacker = { side: 'enemy', traits: [BCU_TRAITS.red], traitFlags: { [BCU_TRAITS.red]: true } };
  const unitTarget = {
    side: 'dog-player',
    bcuCombatModel: {
      kind: 'unit',
      targetTraits: { list: [BCU_TRAITS.red] },
      traits: { list: [BCU_TRAITS.red], flags: { [BCU_TRAITS.red]: true } },
      ability: { abi: BCU_ABI.AB_RESIST },
      proc: {}
    },
    bcuProcStatuses: {}
  };
  assert.equal(DamageAbilityResolver.resolve({ attacker: enemyAttacker, target: unitTarget, targetType: 'actor', baseDamage: 100 }).finalDamage, 20);
  unitTarget.bcuProcStatuses.seal = { framesRemaining: 3 };
  assert.equal(DamageAbilityResolver.resolve({ attacker: enemyAttacker, target: unitTarget, targetType: 'actor', baseDamage: 100 }).finalDamage, 100);
});

test('seal suppresses strongAttack and critical procs in damage resolver', () => {
  const target = { side: 'enemy', traits: [], traitFlags: {} };
  const attacker = {
    side: 'dog-player',
    bcuCombatModel: {
      kind: 'unit',
      ability: { abi: 0 },
      proc: {
        strongAttack: { prob: 100, mult: 100 },
        critical: { prob: 100, mult: 200 }
      }
    },
    bcuProcStatuses: {}
  };

  assert.equal(DamageAbilityResolver.resolve({ attacker, target, targetType: 'actor', baseDamage: 100, context: { random: () => 0 } }).finalDamage, 400);
  attacker.bcuProcStatuses.seal = { framesRemaining: 3 };
  const sealed = DamageAbilityResolver.resolve({ attacker, target, targetType: 'actor', baseDamage: 100, context: { random: () => 0 } });
  assert.equal(sealed.finalDamage, 100);
  assert.equal(sealed.applied.strongAttack, false);
  assert.equal(sealed.applied.critical, false);
});

test('critical BattleScene wrapper chain remains callable after parity imports', () => {
  assert.equal(typeof BattleScene.prototype.queueAttackDamage, 'function');
  assert.equal(typeof BattleScene.prototype.runTickPhase, 'function');
  assert.equal(typeof BattleScene.prototype.resolveAttackHitEvent, 'function');
  assert.equal(typeof BattleScene.prototype.cleanupDead, 'function');
  assert.match(BattleScene.prototype.queueAttackDamage.name, /queueAttackDamageWith/);

  const scene = sceneStub();
  scene.beginTickPhase = (phase) => { scene.started = phase; };
  scene.endTickPhase = (phase) => { scene.ended = phase; };
  const value = BattleScene.prototype.runTickPhase.call(scene, 'smoke', () => 42);
  assert.equal(value, 42);
  assert.equal(scene.started, 'smoke');
  assert.equal(scene.ended, 'smoke');
});

test('BattleAttackProfile maps per-hit abi flags onto attack events as bcuHitAbi', async () => {
  const { BattleAttackProfile } = await import('../js/battle/BattleAttackProfile.js');
  const hits = [
    { hitIndex: 0, damage: 100, preFrames: 5, preFramesAbsolute: 5, abi: 0 },
    { hitIndex: 1, damage: 100, preFrames: 8, preFramesAbsolute: 8, abi: 0 },
    { hitIndex: 2, damage: 100, preFrames: 11, preFramesAbsolute: 11, abi: 1 }
  ];
  const profile = BattleAttackProfile.fromActor({ rawStats: { attackHits: hits, isRange: false, tbaFrames: 10 } });
  assert.equal(profile.source, 'bcu-stats-attackHits');
  assert.deepEqual(profile.events.map((e) => e.bcuHitAbi), [0, 0, 1]);
});

test('ProcResolver gates attack procs per hit on bcuHitAbi != 1 (BCU abis[ind] == 1 setProc gate)', () => {
  const attacker = actor({ side: 'dog-player' });
  attacker.bcuCombatModel = { kind: 'unit', proc: { wave: { prob: 100, level: 2 }, miniWave: { prob: 100, level: 1, mult: 20 } }, traits: { flags: {} } };
  const target = actor({ side: 'enemy' });

  const gated = ProcResolver.resolve({ attacker, target, targetType: 'actor', event: { hitIndex: 0, bcuHitAbi: 0 }, context: { random: () => 0 } });
  assert.equal(gated.pending.length, 0);
  assert.equal(gated.skipped.filter((item) => item.reason === 'bcu-hit-abi-disabled').map((item) => item.key).sort().join(','), 'miniWave,wave');
  assert.equal(gated.notes.includes('bcu-hit-abi-disabled-attack-procs'), true);

  const open = ProcResolver.resolve({ attacker, target, targetType: 'actor', event: { hitIndex: 2, bcuHitAbi: 1 }, context: { random: () => 0 } });
  assert.equal(open.pending.some((item) => item.key === 'wave'), true);
  assert.equal(open.pending.some((item) => item.key === 'miniWave'), true);

  const legacyEventWithoutHitAbi = ProcResolver.resolve({ attacker, target, targetType: 'actor', event: { hitIndex: 0 }, context: { random: () => 0 } });
  assert.equal(legacyEventWithoutHitAbi.pending.some((item) => item.key === 'wave'), true);
});

test('ProcResolver keeps entity-level zombieKiller/soulstrike exempt from the hit abi gate', () => {
  const attacker = actor({ side: 'dog-player' });
  attacker.bcuCombatModel = { kind: 'unit', proc: {}, traits: { flags: {} } };
  const target = actor({ side: 'enemy' });
  const result = ProcResolver.resolve({
    attacker,
    target,
    targetType: 'actor',
    event: { hitIndex: 1, bcuHitAbi: 0, abilities: { zombieKiller: true, soulstrike: true } },
    context: { random: () => 0 }
  });
  assert.equal(result.pending.some((item) => item.key === 'zombieKiller'), true);
  assert.equal(result.pending.some((item) => item.key === 'soulstrike'), true);
  assert.equal(result.skipped.some((item) => item.key === 'zombieKiller'), false);
});

test('DamageAbilityResolver gates strongAttack/critical procs per hit on bcuHitAbi != 1', () => {
  const target = { side: 'enemy', traits: [], traitFlags: {} };
  const attacker = {
    side: 'dog-player',
    bcuCombatModel: {
      kind: 'unit',
      ability: { abi: 0 },
      proc: {
        strongAttack: { prob: 100, mult: 100 },
        critical: { prob: 100, mult: 200 }
      }
    },
    bcuProcStatuses: {}
  };

  const open = DamageAbilityResolver.resolve({ attacker, target, targetType: 'actor', event: { bcuHitAbi: 1 }, baseDamage: 100, context: { random: () => 0 } });
  assert.equal(open.finalDamage, 400);

  const gated = DamageAbilityResolver.resolve({ attacker, target, targetType: 'actor', event: { bcuHitAbi: 0 }, baseDamage: 100, context: { random: () => 0 } });
  assert.equal(gated.finalDamage, 100);
  assert.equal(gated.applied.strongAttack, false);
  assert.equal(gated.applied.critical, false);
  assert.equal(gated.notes.includes('bcu-hit-abi-disabled-strongAttack-proc'), true);
  assert.equal(gated.notes.includes('bcu-hit-abi-disabled-critical-proc'), true);
});

test('zombie revive enters attack-wait immediately when an enemy is in touch range (BCU update2 checkTouch)', async () => {
  await import('../js/battle/BattleActorZombieRevivePatch.js');
  const enemyTarget = actor({ side: 'enemy' });
  enemyTarget.instanceId = 'touch-enemy';

  const makeRevivingZombie = () => {
    const zombie = actor({ side: 'enemy', maxHp: 1000 });
    zombie.maxHp = 1000;
    zombie.state = 'dead';
    zombie.isAliveFlag = false;
    zombie.bcuZombieRevivePending = true;
    zombie.bcuZombieReviveReadyAtMs = 50;
    zombie.bcuZombieReviveHealthPercent = 100;
    zombie.lastSceneTimeMs = 100;
    return zombie;
  };

  const touching = makeRevivingZombie();
  touching.scene = {
    findTargetForActor: () => ({ target: enemyTarget, targetType: 'actor' }),
    canAttack: () => true
  };
  touching.tick(1000 / 30);
  assert.equal(touching.state, 'attack-wait');
  assert.equal(touching.isAliveFlag, true);
  assert.equal(touching.hp, 1000);
  assert.equal(touching.lastBcuZombieReviveDebug.reviveTouchTarget, 'touch-enemy');

  const alone = makeRevivingZombie();
  alone.scene = {
    findTargetForActor: () => null,
    canAttack: () => false
  };
  alone.tick(1000 / 30);
  assert.equal(alone.state, 'move');
  assert.equal(alone.isAliveFlag, true);

  const outOfRange = makeRevivingZombie();
  outOfRange.scene = {
    findTargetForActor: () => ({ target: enemyTarget, targetType: 'actor' }),
    canAttack: () => false
  };
  outOfRange.tick(1000 / 30);
  assert.equal(outOfRange.state, 'move');
});
