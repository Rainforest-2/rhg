import assert from 'node:assert/strict';
import {
  applyCharacterModification
} from '../js/character-modification/CharacterModificationResolver.js';
import {
  normalizeBcuSummonProc
} from '../js/battle/bcu-runtime/BcuSummonRuntime.js';

function makeStats(overrides = {}) {
  const proc = {
    wave: { prob: 50, level: 2 },
    SUMMON: { id: 99, prob: 100 }
  };
  return {
    hp: 300000,
    knockbacks: 3,
    speed: 10,
    detectionRange: 400,
    range: 400,
    width: 20,
    damage: 1000,
    price: 1200,
    costOrReward: 1200,
    respawnFrames: 600,
    tbaFrames: 60,
    attackWaitFrames: 60,
    attackCount: 1,
    attackHits: [{
      hitIndex: 0,
      damage: 1000,
      preFrames: 10,
      preFramesAbsolute: 10,
      abi: 1,
      ldStartRaw: 0,
      ldRangeRaw: 0
    }],
    source: { type: 'unit' },
    traits: ['red'],
    traitFlags: { red: true },
    bcuCombatModel: {
      kind: 'unit',
      traits: { list: ['red'], flags: { red: true } },
      targetTraits: { list: ['red'], flags: { red: true } },
      ability: { abi: 0, flags: {} },
      proc
    },
    bcuProc: proc,
    ...overrides
  };
}

const normal = makeStats();
assert.equal(applyCharacterModification(normal, null), normal, 'no modification returns the exact normal stats object');
assert.equal(applyCharacterModification(normal, { schemaVersion: 1 }), normal, 'empty modification is a no-op');

const hpMod = { schemaVersion: 1, stats: { maxHp: 500000 } };
const level50 = applyCharacterModification(makeStats({ hp: 300000, damage: 1000 }), hpMod, { source: 'formation' });
const level60 = applyCharacterModification(makeStats({ hp: 360000, damage: 1200 }), hpMod, { source: 'formation' });
assert.equal(level50.hp, 500000);
assert.equal(level60.hp, 500000, 'modified HP remains absolute after level change');
assert.equal(level60.damage, 1200, 'unmodified damage follows the new normal level');

const enemyMod = { schemaVersion: 1, stats: { maxHp: 777777 } };
const enemy100 = applyCharacterModification(makeStats({
  hp: 100000,
  source: { type: 'enemy' },
  bcuCombatModel: { ...normal.bcuCombatModel, kind: 'enemy' }
}), enemyMod, { source: 'custom-stage' });
const enemy300 = applyCharacterModification(makeStats({
  hp: 300000,
  source: { type: 'enemy' },
  bcuCombatModel: { ...normal.bcuCombatModel, kind: 'enemy' }
}), enemyMod, { source: 'custom-stage' });
assert.equal(enemy100.hp, 777777);
assert.equal(enemy300.hp, 777777, 'enemy HP override remains absolute after spawn magnification change');

const complexMod = {
  schemaVersion: 1,
  production: { cost: 50, respawnFrames: 0, deployLimit: 0 },
  attacks: {
    hitCount: 3,
    targetMode: 'area',
    hits: {
      0: { damage: 2000, preFrames: 5 },
      1: { damage: 3000, preFrames: 10, range: { type: 'ld', start: 100, end: 500 } },
      2: { damage: 4000, preFrames: 15, range: { type: 'omni', start: 200, end: -300 } }
    }
  },
  traits: ['zombie'],
  abilityFlags: { zombieKiller: true, strong: false },
  procs: {
    wave: { enabled: false },
    freeze: { enabled: true, chance: 75, durationFrames: 90 }
  }
};
const complex = applyCharacterModification(normal, complexMod, { source: 'formation', debug: true });
assert.notEqual(complex, normal);
assert.deepEqual(complex.attackHits.map((hit) => hit.damage), [2000, 3000, 4000]);
assert.equal(complex.attackHits[1].ldStartRaw, 100);
assert.equal(complex.attackHits[1].ldRangeRaw, 400);
assert.equal(complex.attackHits[2].isOmni, true);
assert.equal(complex.isRange, true);
assert.deepEqual(complex.traits, ['zombie']);
assert.equal(complex.bcuCombatModel.ability.flags.zombieKiller, true);
assert.equal(complex.bcuCombatModel.proc.wave, undefined, 'disabled proc leaves no stale runtime payload');
assert.deepEqual(complex.bcuCombatModel.proc.freeze, { prob: 75, time: 90 });
assert.deepEqual(complex.characterModificationProduction, {
  cost: 50,
  respawnFrames: 0,
  deployLimit: 0
}, 'production absolute overrides remain separate from normal production inputs');
assert.equal(complex.price, 1200, 'resolver does not pre-apply production cost before global modifiers');
assert.equal(complex.respawnFrames, 600, 'resolver does not pre-apply production cooldown before global modifiers');
assert.deepEqual(complex.bcuCombatModel.proc.SUMMON, { id: 99, prob: 100 }, 'parent modification does not rewrite summon target data');
assert.equal(normal.attackHits.length, 1, 'original attack hits are not mutated');
assert.deepEqual(normal.bcuCombatModel.proc.wave, { prob: 50, level: 2 }, 'original combat proc is not mutated');
assert.ok(complex.characterModificationDebug.appliedFields.includes('stats.maxHp') === false);
assert.ok(complex.characterModificationDebug.appliedFields.includes('attacks.hits.2.damage'));

const hitScoped = applyCharacterModification(makeStats({
  attackCount: 2,
  attackHits: [
    { hitIndex: 0, damage: 100, preFrames: 10, preFramesAbsolute: 10, abi: 1 },
    { hitIndex: 1, damage: 200, preFrames: 20, preFramesAbsolute: 20, abi: 0 }
  ]
}), {
  schemaVersion: 1,
  attackCycle: { postAttackFrames: 7 },
  attacks: {
    allowBaseHit: false,
    hits: {
      0: {
        targetMode: 'single',
        allowBaseHit: false,
        abilityFlags: { strong: true, targetOnly: false },
        procs: {
          wave: { enabled: false },
          miniWave: { enabled: true, chance: 100, level: 3 }
        }
      },
      1: {
        targetMode: 'area',
        allowBaseHit: true,
        procs: {
          freeze: { enabled: false },
          blast: { enabled: true, chance: 100, start: 0, end: 100 }
        }
      }
    }
  }
}, { source: 'formation' });
assert.equal(hitScoped.postAttackFrames, 7);
assert.equal(hitScoped.allowBaseHit, false);
assert.equal(hitScoped.attackHits[0].targetMode, 'single');
assert.equal(hitScoped.attackHits[1].targetMode, 'area');
assert.equal(hitScoped.attackHits[1].allowBaseHit, true, 'hit-specific castle flag overrides the global flag');
assert.deepEqual(hitScoped.attackHits[0].characterModificationAbilityFlags, {
  strong: true,
  targetOnly: false
});
assert.equal(hitScoped.attackHits[0].characterModificationProcOverrides.wave, null);
assert.equal(hitScoped.attackHits[0].characterModificationProcOverrides.miniWave.prob, 100);
assert.equal(hitScoped.attackHits[1].characterModificationProcOverrides.freeze, null);
assert.equal(hitScoped.attackHits[1].characterModificationProcEnabled, true, 'an enabled hit proc opens the existing BCU hit ABI gate');
assert.equal(normal.attackHits[0].targetMode, undefined, 'hit-scoped overrides keep normal hit objects immutable');

const globallyExclusive = applyCharacterModification(normal, {
  schemaVersion: 1,
  procs: {
    miniWave: { enabled: true, chance: 100, level: 4 }
  }
});
assert.equal(globallyExclusive.bcuCombatModel.proc.wave, undefined, 'enabling mini-wave removes a stale normal wave payload');
assert.equal(globallyExclusive.bcuCombatModel.proc.miniWave.level, 4);

const enemyWaveBlocker = applyCharacterModification(makeStats({
  source: { type: 'enemy' },
  bcuCombatModel: { ...normal.bcuCombatModel, kind: 'enemy' }
}), {
  schemaVersion: 1,
  abilityFlags: { waveBlocker: true }
}, { source: 'custom-stage' });
assert.equal(enemyWaveBlocker.bcuCombatModel.ability.flags.waveBlocker, true);

const summonModification = {
  schemaVersion: 1,
  summon: {
    enabled: true,
    chance: 80,
    targetKind: 'enemy',
    targetId: 42,
    multiplier: 150,
    minDistance: -100,
    maxDistance: 200,
    minLayer: 1,
    maxLayer: 3,
    delayFrames: 12,
    postSpawnTbaFrames: -1,
    animType: 2,
    ignoreLimit: true,
    fixBuff: true,
    onHit: true
  }
};
const summonModified = applyCharacterModification(normal, summonModification, {
  source: 'formation',
  requireResolvedReferences: true,
  resolvers: { enemy: (id) => id === 42 }
});
assert.deepEqual(summonModified.bcuCombatModel.proc.SUMMON, {
  form: 1,
  dis: -100,
  maxDis: 200,
  minLayer: 1,
  maxLayer: 3,
  time: 12,
  tba: -1,
  type: 2,
  ignoreLimit: true,
  fixBuff: true,
  sameHealth: false,
  bondHp: false,
  onHit: true,
  onKill: false,
  prob: 80,
  kind: 'enemy',
  statsId: 42,
  mult: 150
});
const normalizedSummon = normalizeBcuSummonProc(summonModified.bcuProc);
assert.equal(normalizedSummon.exists, true);
assert.equal(normalizedSummon.kind, 'enemy');
assert.equal(normalizedSummon.statsId, 42);
assert.equal(normalizedSummon.type.animType, 2);
assert.equal(normalizedSummon.type.onHit, true);
assert.equal(
  Object.prototype.hasOwnProperty.call(summonModified.bcuCombatModel.proc.SUMMON, 'spawnModification'),
  false,
  'summon runtime payload never inherits or references the parent modification'
);
assert.deepEqual(normal.bcuCombatModel.proc.SUMMON, { id: 99, prob: 100 }, 'summon override leaves normal proc immutable');

const disabledSummon = applyCharacterModification(makeStats({
  bcuCombatModel: {
    ...normal.bcuCombatModel,
    proc: {
      ...normal.bcuCombatModel.proc,
      summon: { id: 41, prob: 100 }
    }
  }
}), {
  schemaVersion: 1,
  summon: { enabled: false }
});
assert.equal(disabledSummon.bcuCombatModel.proc.SUMMON, undefined);
assert.equal(disabledSummon.bcuCombatModel.proc.summon, undefined, 'disabling summon removes stale aliases');

assert.throws(() => applyCharacterModification(normal, summonModification, {
  requireResolvedReferences: true,
  resolvers: { enemy: () => false }
}), /does not resolve/, 'runtime can enforce the same summon catalog validation');

assert.throws(() => applyCharacterModification(makeStats({
  attackCount: 2,
  attackHits: [
    { hitIndex: 0, damage: 100, preFrames: 10, preFramesAbsolute: 10 },
    { hitIndex: 1, damage: 100, preFrames: 20, preFramesAbsolute: 20 }
  ]
}), {
  schemaVersion: 1,
  attacks: { hits: { 1: { preFrames: 5 } } }
}), /previous hit frame/, 'resolver rejects non-monotonic absolute multi-hit timing');

console.log('check-character-modification-resolver: OK');
