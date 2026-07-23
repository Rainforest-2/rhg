import assert from 'node:assert/strict';
import {
  applyCharacterModification
} from '../js/character-modification/CharacterModificationResolver.js';
import {
  rebuildModifiedBattleAttackProfile,
  rebuildModifiedDerivedModels
} from '../js/character-modification/CharacterModificationDerivedModel.js';

const stats = {
  hp: 1000,
  knockbacks: 2,
  speed: 12,
  detectionRange: 450,
  range: 450,
  width: 30,
  damage: 100,
  tbaFrames: 50,
  attackWaitFrames: 50,
  attackCount: 1,
  attackHits: [{
    hitIndex: 0,
    damage: 100,
    preFrames: 12,
    preFramesAbsolute: 12,
    abi: 1,
    ldStartRaw: 0,
    ldRangeRaw: 0
  }],
  rawValues: [],
  source: { type: 'enemy' },
  bcuCombatModel: {
    kind: 'enemy',
    traits: { list: ['zombie'], flags: { zombie: true } },
    ability: { abi: 0, flags: {} },
    proc: {}
  }
};
stats.actorStatsModel = {
  source: 'bcu-stage-csv-row',
  baseStats: { hp: 500, damage: 50 },
  finalStats: stats,
  stageMagnification: { hpMagnification: 200, attackMagnification: 200 },
  warnings: [],
  debug: { baseHp: 500, scaledHp: 1000, baseDamage: 50, scaledDamage: 100 }
};
assert.equal(rebuildModifiedDerivedModels(stats), stats, 'derived rebuild is a no-op without applied modification provenance');

const modified = applyCharacterModification(stats, {
  schemaVersion: 1,
  attacks: {
    hitCount: 2,
    hits: {
      0: { damage: 700, preFrames: 20 },
      1: { damage: 300, preFrames: 35 }
    }
  },
  procs: {
    wave: { enabled: true, chance: 100, level: 4 },
    immuneFreeze: { enabled: true, strength: 50 }
  },
  lifecycle: {
    barrier: { enabled: true, health: 5000 },
    demonShield: { enabled: true, health: 9000, regenPercent: 25 },
    revive: { enabled: true, count: 2, delayFrames: 60, healthPercent: 40 },
    burrow: { enabled: true, count: 1, distance: 250 }
  },
  summon: {
    enabled: true,
    chance: 100,
    targetKind: 'enemy',
    targetId: 8,
    multiplier: 200
  }
  }, { source: 'custom-stage' });
const rebuilt = rebuildModifiedDerivedModels(modified);

assert.equal(rebuilt.damage, 700, 'representative damage follows hit 0');
assert.equal(rebuilt.representativeDamage, 700);
assert.equal(rebuilt.totalNominalDamage, 1000);
assert.equal(rebuilt.attackCount, 2);
assert.deepEqual(rebuilt.attackHits.map((hit) => hit.deltaFramesFromPrevious), [20, 15]);
assert.equal(rebuilt.attackStartupFrames, 20);
assert.equal(rebuilt.longPreFrames, 35);
assert.deepEqual(rebuilt.bcuProc.wave, { prob: 100, level: 4 });
assert.equal(rebuilt.bcuCombatModel.immunity.freeze.mult, 50);
assert.equal(rebuilt.bcuCombatModel.resistance.freeze.partial, true);
assert.equal(rebuilt.abilityModel.bcuProcSemantic.wave, true);
assert.equal(rebuilt.abilities.proc, rebuilt.bcuProc);
assert.equal(
  rebuilt.attackHits.every((hit) => hit.bcuProcIsComplete === true),
  true,
  'a global proc modification rebuilds a complete event proc for every hit'
);
assert.equal(
  rebuilt.attackHits.every((hit) => hit.characterModificationProcEnabled === true),
  true,
  'an enabled global proc modification opens the existing BCU proc gate for every hit'
);
assert.equal(rebuilt.attackHits[1].bcuProc.wave.level, 4);
assert.deepEqual(rebuilt.characterModificationInitialState, {
  barrierHp: 5000,
  demonShieldHp: 9000,
  demonShieldRegenPercent: 25,
  revive: { count: 2, time: 60, health: 40 },
  burrow: { count: 1, dis: 250 },
  summon: {
    form: 1,
    dis: 0,
    maxDis: 0,
    minLayer: -1,
    maxLayer: -1,
    time: 0,
    tba: 0,
    type: 0,
    ignoreLimit: false,
    fixBuff: false,
    sameHealth: false,
    bondHp: false,
    onHit: false,
    onKill: false,
    prob: 100,
    kind: 'enemy',
    statsId: 8,
    mult: 200
  },
  spirit: null
});
assert.equal(rebuilt.characterModificationWorldValues.detectionRangeWorld, 450);
assert.equal(rebuilt.characterModificationDerived.attackProfileRequiresRebuild, true);
assert.notEqual(rebuilt.actorStatsModel, stats.actorStatsModel, 'actorStatsModel is rebuilt instead of retaining the normal-final cycle');
assert.equal(rebuilt.actorStatsModel.finalStats, rebuilt);
assert.equal(rebuilt.statsModelDebug.normalFinalHp, 1000);
assert.equal(rebuilt.statsModelDebug.modifiedFinalDamage, 700);
assert.equal(stats.actorStatsModel.finalStats, stats, 'source ActorStatsModel remains unchanged');
assert.equal(stats.bcuCombatModel.proc.barrier, undefined, 'source combat model remains immutable');

const actor = {
  rawStats: rebuilt,
  fps: 1000 / 33,
  damage: rebuilt.damage,
  detectionRangeBcu: rebuilt.detectionRange,
  attackWaitMs: rebuilt.tbaFrames * 33,
  attackAnimDurationMs: 1000,
  battleCoordinate: { lengthToPx: (value) => value }
};
const profile = rebuildModifiedBattleAttackProfile(actor);
assert.equal(profile.events.length, 2);
assert.deepEqual(profile.events.map((event) => event.damage), [700, 300]);
assert.deepEqual(profile.events.map((event) => event.bcuHitAbi), [1, 1]);
assert.equal(profile.events[1].bcuProcIsComplete, true);
assert.equal(actor.attackProfile, profile);

const staleHitStats = {
  ...stats,
  bcuCombatModel: {
    ...stats.bcuCombatModel,
    proc: {
      wave: { prob: 100, level: 2 },
      freeze: { prob: 100, time: 30 }
    }
  },
  bcuProc: {
    wave: { prob: 100, level: 2 },
    freeze: { prob: 100, time: 30 }
  },
  attackHits: [{
    ...stats.attackHits[0],
    abi: 0,
    bcuProc: {
      freeze: { prob: 100, time: 999 },
      miniWave: { prob: 100, level: 99, mult: 20 }
    }
  }]
};
const globallyDisabled = rebuildModifiedDerivedModels(applyCharacterModification(staleHitStats, {
  schemaVersion: 1,
  procs: {
    freeze: { enabled: false }
  }
}, { source: 'custom-stage' }));
assert.equal(globallyDisabled.attackHits[0].bcuProcIsComplete, true);
assert.equal(globallyDisabled.attackHits[0].bcuProc.freeze, undefined);
assert.equal(
  globallyDisabled.attackHits[0].bcuProc.miniWave,
  undefined,
  'global proc modification does not leak a stale unmarked hit payload into the complete event model'
);
assert.equal(
  globallyDisabled.attackHits[0].characterModificationProcEnabled,
  undefined,
  'a disable-only global modification does not open the raw ABI gate for unrelated normal procs'
);

console.log('check-character-modification-derived-model: OK');
