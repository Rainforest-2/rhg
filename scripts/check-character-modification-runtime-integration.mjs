import assert from 'node:assert/strict';
import { AbilityModel } from '../js/battle/AbilityModel.js';
import {
  BattleActorFactory,
  TEMPLATE_LOAD_LEVEL
} from '../js/battle/BattleActorFactory.js';
import { BattleAttackResolver } from '../js/battle/BattleAttackResolver.js';
import { BattleScene } from '../js/battle/BattleScene.js';
import { BCU_ABI, BCU_TRAITS } from '../js/battle/BcuCombatModel.js';
import {
  ProcResolver,
  getBcuEventProcModel
} from '../js/battle/ProcResolver.js';
import { hasTargetOnly } from '../js/battle/BcuTraitCompatibility.js';
import {
  canStartBcuBurrow
} from '../js/battle/bcu-runtime/BcuBurrowLifecycleRuntime.js';
import {
  enqueueBcuSummonSpawn,
  normalizeBcuSummonProc
} from '../js/battle/bcu-runtime/BcuSummonRuntime.js';
import { hasBcuWaveStopper } from '../js/battle/bcu-runtime/BcuWaveStopperRuntime.js';
import '../js/battle/BattleActorProcStatusPatch.js';
import '../js/battle/BcuProcImmunityPatch.js';
import '../js/battle/BattleActorBarrierShieldPatch.js';
import '../js/battle/BattleActorZombieRevivePatch.js';
import '../js/battle/BattleSoulstrikePatch.js';
import '../js/battle/BattleActorBcuBurrowPatch.js';

function traitBag(list) {
  return {
    list: list.slice(),
    flags: Object.fromEntries(list.map((trait) => [trait, true]))
  };
}

function baseStats({
  kind,
  traits,
  targetTraits = traits,
  abilityFlags = {},
  abi = 0,
  proc = {},
  hits = null
}) {
  const attackHits = hits || [{
    hitIndex: 0,
    damage: 100,
    preFrames: 3,
    preFramesAbsolute: 3,
    deltaFramesFromPrevious: 3,
    abi: 1,
    ldStartRaw: 0,
    ldRangeRaw: 0,
    shortPointRaw: 0,
    longPointRaw: 0,
    isLd: false,
    isOmni: false
  }];
  return {
    hp: 5000,
    knockbacks: 1,
    speed: 10,
    detectionRange: 500,
    range: 500,
    width: 20,
    damage: attackHits[0].damage,
    price: 100,
    costOrReward: 100,
    respawnFrames: 300,
    tbaFrames: 20,
    attackWaitFrames: 20,
    attackStartupFrames: attackHits[0].preFrames,
    longPreFrames: Math.max(...attackHits.map((hit) => hit.preFramesAbsolute)),
    attackCount: attackHits.length,
    attackHits,
    attackType: 1,
    isRange: true,
    traits: traits.slice(),
    traitFlags: traitBag(traits).flags,
    bcuAbi: abi,
    bcuAbilityFlags: { ...abilityFlags },
    bcuProc: proc,
    source: { type: kind, mapping: 'character-modification-runtime-check' },
    bcuCombatModel: {
      kind,
      traits: traitBag(traits),
      ...(kind === 'unit' ? { targetTraits: traitBag(targetTraits) } : {}),
      ability: { abi, flags: { ...abilityFlags } },
      proc
    }
  };
}

const primaryHits = [0, 1, 2].map((hitIndex) => ({
  hitIndex,
  damage: 100 * (hitIndex + 1),
  preFrames: hitIndex + 1,
  preFramesAbsolute: hitIndex + 1,
  deltaFramesFromPrevious: 1,
  abi: 0,
  ldStartRaw: 0,
  ldRangeRaw: 0,
  shortPointRaw: 0,
  longPointRaw: 0,
  isLd: false,
  isOmni: false,
  ...(hitIndex === 0
    ? { bcuProc: { miniSurge: { prob: 100, level: 99 } } }
    : {})
}));
const primaryUnitStats = baseStats({
  kind: 'unit',
  traits: [BCU_TRAITS.red],
  targetTraits: [BCU_TRAITS.red],
  abilityFlags: {
    strong: true,
    targetOnly: true,
    soulstrike: true
  },
  abi: BCU_ABI.AB_GOOD | BCU_ABI.AB_ONLY | BCU_ABI.AB_CKILL,
  proc: {
    wave: { prob: 25, level: 1 }
  },
  hits: primaryHits
});
const optInUnitStats = baseStats({
  kind: 'unit',
  traits: [BCU_TRAITS.red],
  targetTraits: [BCU_TRAITS.red],
  abilityFlags: {},
  abi: 0,
  proc: {}
});
const redZombieStats = baseStats({
  kind: 'enemy',
  traits: [BCU_TRAITS.red, BCU_TRAITS.zombie],
  abilityFlags: {},
  proc: {}
});
const blackEnemyStats = baseStats({
  kind: 'enemy',
  traits: [BCU_TRAITS.black],
  abilityFlags: {},
  proc: {}
});

const statsLoader = {
  loadUnitStats: async (id) => {
    if (Number(id) === 1) return primaryUnitStats;
    if (Number(id) === 2) return optInUnitStats;
    throw new Error(`missing unit stats ${id}`);
  },
  loadEnemyStats: async (id) => {
    if (Number(id) === 10) return redZombieStats;
    if (Number(id) === 11) return blackEnemyStats;
    if (Number(id) === 99) return redZombieStats;
    throw new Error(`missing enemy stats ${id}`);
  },
  applyStageEnemyMagnification: (stats) => stats,
  describeStats: () => ({ source: 'character-modification-runtime-check' })
};

function unitDef({
  slotId,
  statsType,
  statsId,
  modification = null,
  source = null
}) {
  return {
    slotId,
    statsType,
    statsId,
    formRow: 0,
    assetId: slotId,
    assetDef: {
      id: slotId,
      semanticKey: `${statsType}:${statsId}`,
      animations: []
    },
    idleAnimId: 'idle',
    moveAnimId: 'move',
    attackAnimId: 'attack',
    knockbackAnimId: 'kb',
    collisionRadius: 20,
    ...(modification ? {
      characterModification: modification,
      characterModificationSource: source
    } : {})
  };
}

const primaryModification = {
  schemaVersion: 1,
  attackCycle: {
    postAttackFrames: 5
  },
  attacks: {
    allowBaseHit: false,
    hits: {
      0: {
        targetMode: 'area',
        allowBaseHit: false,
        abilityFlags: {
          strong: false,
          targetOnly: false,
          soulstrike: false
        },
        procs: {
          miniWave: { enabled: true, chance: 100, level: 3 }
        }
      },
      1: {
        targetMode: 'area',
        allowBaseHit: true,
        procs: {
          freeze: { enabled: false },
          surge: {
            enabled: true,
            chance: 100,
            level: 2,
            start: 0,
            end: 100
          },
          blast: {
            enabled: true,
            chance: 100,
            start: 0,
            end: 100
          }
        }
      },
      2: {
        targetMode: 'area',
        procs: {
          miniSurge: {
            enabled: true,
            chance: 100,
            level: 2,
            start: 0,
            end: 100
          }
        }
      }
    }
  },
  procs: {
    freeze: {
      enabled: true,
      chance: 100,
      durationFrames: 30
    },
    wave: {
      enabled: true,
      chance: 100,
      level: 4
    }
  },
  summon: {
    enabled: true,
    chance: 100,
    targetKind: 'enemy',
    targetId: 99,
    multiplier: 100,
    ignoreLimit: true
  }
};
const optInModification = {
  schemaVersion: 1,
  attacks: {
    hits: {
      0: {
        targetMode: 'area',
        abilityFlags: {
          strong: true,
          targetOnly: true,
          soulstrike: true
        }
      }
    }
  }
};
const lifecycleModification = {
  schemaVersion: 1,
  abilityFlags: {
    waveBlocker: true
  },
  procs: {
    immuneFreeze: {
      enabled: true,
      strength: 100
    }
  },
  lifecycle: {
    revive: {
      enabled: true,
      count: 1,
      delayFrames: 30,
      healthPercent: 50
    },
    burrow: {
      enabled: true,
      count: 1,
      distance: 200
    }
  }
};
const barrierModification = {
  schemaVersion: 1,
  lifecycle: {
    barrier: {
      enabled: true,
      health: 500
    }
  }
};
const shieldModification = {
  schemaVersion: 1,
  lifecycle: {
    demonShield: {
      enabled: true,
      health: 500,
      regenPercent: 25
    }
  }
};
const criticalModification = {
  schemaVersion: 1,
  procs: {
    critical: {
      enabled: true,
      chance: 100,
      multiplier: 500
    }
  }
};

const primaryDef = unitDef({
  slotId: 'modified-unit-primary',
  statsType: 'unit',
  statsId: 1,
  modification: primaryModification,
  source: 'formation'
});
const optInDef = unitDef({
  slotId: 'modified-unit-opt-in',
  statsType: 'unit',
  statsId: 2,
  modification: optInModification,
  source: 'formation'
});
const lifecycleDef = unitDef({
  slotId: 'modified-enemy-lifecycle',
  statsType: 'enemy',
  statsId: 10,
  modification: lifecycleModification,
  source: 'custom-stage'
});
const barrierDef = unitDef({
  slotId: 'modified-enemy-barrier',
  statsType: 'enemy',
  statsId: 10,
  modification: barrierModification,
  source: 'custom-stage'
});
const shieldDef = unitDef({
  slotId: 'modified-enemy-shield',
  statsType: 'enemy',
  statsId: 10,
  modification: shieldModification,
  source: 'custom-stage'
});
const criticalDef = unitDef({
  slotId: 'modified-unit-critical',
  statsType: 'unit',
  statsId: 2,
  modification: criticalModification,
  source: 'formation'
});
const blackDef = unitDef({
  slotId: 'normal-enemy-black',
  statsType: 'enemy',
  statsId: 11
});

const factory = new BattleActorFactory(statsLoader, {});
const definitions = [
  primaryDef,
  optInDef,
  lifecycleDef,
  barrierDef,
  shieldDef,
  criticalDef,
  blackDef
];
for (const definition of definitions) {
  const template = await factory.preloadTemplateStats(definition);
  template.animations = {
    idle: { tracks: [], maxFrame: 1 },
    move: { tracks: [], maxFrame: 1 },
    attack: { tracks: [], maxFrame: 30 },
    kb: { tracks: [], maxFrame: 1 }
  };
  template.loadingLevel = TEMPLATE_LOAD_LEVEL.RENDER_CORE;
}

let actorSerial = 0;
function createActor(definition, overrides = {}) {
  const actor = factory.createActor(definition, {
    side: definition.statsType === 'unit' ? 'dog-player' : 'cat-enemy',
    x: 0,
    y: 0,
    direction: 1,
    facing: 1,
    currentAnimId: 'move',
    ...overrides
  });
  actor.instanceId = `${definition.slotId}-${++actorSerial}`;
  return actor;
}

const attacker = createActor(primaryDef);
const optInAttacker = createActor(optInDef);
const criticalAttacker = createActor(criticalDef);
const redTarget = createActor(lifecycleDef, { x: 100 });
const blackTarget = createActor(blackDef, { x: 120 });
const profile = attacker.attackProfile;
const optInProfile = optInAttacker.attackProfile;

assert.equal(profile.events.length, 3);
assert.equal(profile.bcuTiming.source, 'character-modification-bcu-getItv');
assert.equal(profile.bcuTiming.rawPostAttackFrames, 5);
assert.equal(profile.visualAnimationMs, 990);
assert.deepEqual(
  profile.events.map((event) => event.bcuHitAbi),
  [1, 1, 1],
  'enabled global proc modifications apply to every hit even when all raw ABI values are zero'
);
assert.equal(
  profile.events.every((event) => event.bcuProcIsComplete === true),
  true,
  'modified events carry complete proc models'
);
assert.equal(profile.events[0].bcuProc.wave, undefined);
assert.equal(profile.events[0].bcuProc.miniWave.level, 3);
assert.equal(
  profile.events[0].bcuProc.miniSurge,
  undefined,
  'a stale unmarked raw hit payload is not merged into a modified complete proc model'
);
assert.equal(profile.events[1].bcuProc.freeze, undefined);
assert.equal(profile.events[1].bcuProc.wave.level, 4);
assert.equal(profile.events[1].bcuProc.volcano.level, 2);
assert.equal(profile.events[1].bcuProc.blast.prob, 100);
assert.equal(profile.events[2].bcuProc.miniVolcano.level, 2);

assert.equal(hasTargetOnly(attacker, profile.events[0]), false);
assert.equal(
  hasTargetOnly(optInAttacker, optInProfile.events[0]),
  true,
  'hit override true wins over a false actor-level target-only flag'
);
const enemyBase = {
  label: 'enemy-base',
  x: 140,
  y: 0,
  collisionRadius: 20,
  isAlive: () => true,
  getBattlePosBcu() {
    return this.x;
  }
};
const optOutCapture = BattleAttackResolver.captureTargets({
  attacker,
  enemyActors: [redTarget, blackTarget],
  enemyBase,
  event: profile.events[0]
});
assert.deepEqual(
  optOutCapture.map((item) => item.target),
  [redTarget, blackTarget],
  'hit override false wins over actor target-only and the per-hit base flag remains false'
);
const incompatibleTarget = {
  label: 'incompatible-black-target',
  side: 'cat-player',
  x: 120,
  y: 0,
  collisionRadius: 20,
  traits: [BCU_TRAITS.black],
  traitFlags: { [BCU_TRAITS.black]: true },
  isAlive: () => true,
  getBattlePosBcu() {
    return this.x;
  }
};
const optInCapture = BattleAttackResolver.captureTargets({
  attacker: optInAttacker,
  enemyActors: [incompatibleTarget],
  enemyBase: null,
  event: optInProfile.events[0]
});
assert.equal(optInCapture.length, 0, 'hit override true enforces trait targeting');

const corpse = createActor(lifecycleDef, { x: 90 });
corpse.bcuZombieRevivePending = true;
corpse.bcuZombieCorpse = true;
corpse.bcuZombieCorpseTargetable = true;
assert.equal(corpse.isBcuSoulstrikeTargetable(profile.events[0], attacker), false);
assert.equal(corpse.isBcuSoulstrikeTargetable(profile.events[1], attacker), true);
assert.equal(
  corpse.isBcuSoulstrikeTargetable(optInProfile.events[0], optInAttacker),
  true,
  'hit soulstrike true wins over the false actor-level ability flag'
);

const scene = new BattleScene(() => {});
scene.actorFactory = factory;
scene.computeBcuSmoke = () => null;
scene.spawnHitEffect = () => null;
scene.timeMs = 0;
scene.logicFrame = 1;

function resolveSceneEvent(sourceActor, target, event) {
  scene.queueAttackDamage(sourceActor, target, 'actor', event, {
    key: event.key,
    hitIndex: event.hitIndex
  });
  return sourceActor.lastDamageCalculation;
}

const hit0Damage = resolveSceneEvent(attacker, redTarget, profile.events[0]);
assert.equal(
  hit0Damage.finalDamage,
  profile.events[0].damage,
  'hit strong=false suppresses the true actor-level strong ability in DamageAbilityResolver'
);
assert.deepEqual(
  hit0Damage.proc.pending.map((item) => item.key).sort(),
  ['freeze', 'miniWave'],
  'complete event proc replaces global wave with hit mini-wave'
);

const hit1Damage = resolveSceneEvent(attacker, redTarget, profile.events[1]);
assert.ok(hit1Damage.finalDamage > profile.events[1].damage);
assert.equal(hit1Damage.abilityResolver.applied.strong, true);
const hit1ProcKeys = hit1Damage.proc.pending.map((item) => item.key);
assert.equal(hit1ProcKeys.includes('wave'), true);
assert.equal(hit1ProcKeys.includes('surge'), true);
assert.equal(hit1ProcKeys.includes('blast'), true);
assert.equal(hit1ProcKeys.includes('freeze'), false);

const hit2Damage = resolveSceneEvent(attacker, redTarget, profile.events[2]);
const hit2ProcKeys = hit2Damage.proc.pending.map((item) => item.key);
assert.equal(hit2ProcKeys.includes('wave'), true);
assert.equal(hit2ProcKeys.includes('freeze'), true);
assert.equal(hit2ProcKeys.includes('miniSurge'), true);

const optInDamage = resolveSceneEvent(optInAttacker, redTarget, optInProfile.events[0]);
assert.ok(
  optInDamage.finalDamage > optInProfile.events[0].damage,
  'hit strong=true applies in DamageAbilityResolver with a false actor-level strong flag'
);
assert.equal(optInDamage.abilityResolver.applied.strong, true);

const criticalEvent = criticalAttacker.attackProfile.events[0];
const criticalDamage = resolveSceneEvent(criticalAttacker, blackTarget, criticalEvent);
assert.equal(criticalEvent.bcuProc.critical.mult, 500);
assert.equal(
  criticalDamage.finalDamage,
  criticalEvent.damage * 5,
  'registry critical.multiplier=500 reaches the runtime as a 500% nominal critical'
);
assert.equal(
  criticalDamage.abilityResolver.appliedDetails.find((item) => item.key === 'critical')?.mult,
  500
);

const noModificationProc = {
  wave: { prob: 100, level: 2 }
};
const noModificationStats = baseStats({
  kind: 'unit',
  traits: [BCU_TRAITS.red],
  targetTraits: [BCU_TRAITS.red],
  proc: noModificationProc,
  hits: [{
    ...primaryHits[0],
    abi: 1,
    bcuProc: {
      miniWave: { prob: 100, level: 9, mult: 20 }
    }
  }]
});
const noModificationAbilityModel = AbilityModel.buildStatsAbilityModel({
  stats: noModificationStats,
  kind: 'unit',
  bcuCombatModel: noModificationStats.bcuCombatModel
});
const noModificationEvent = {
  key: 'hit-0',
  hitIndex: 0,
  rawAbi: 1,
  bcuHitAbi: 1,
  bcuProc: noModificationStats.attackHits[0].bcuProc,
  abilities: noModificationAbilityModel.attackAbilities[0].semantic,
  ability: noModificationAbilityModel.attackAbilities[0]
};
const noModificationActor = {
  rawStats: {
    ...noModificationStats,
    abilityModel: noModificationAbilityModel
  },
  abilityModel: noModificationAbilityModel,
  side: 'dog-player'
};
assert.equal(noModificationEvent.abilities.wave, true);
assert.equal(noModificationEvent.abilities.miniWave, false);
assert.equal(
  getBcuEventProcModel(noModificationActor, noModificationEvent),
  noModificationProc,
  'unmarked events retain the pre-feature entity-level proc contract'
);
const noModificationResolution = ProcResolver.resolve({
  attacker: noModificationActor,
  target: redTarget,
  targetType: 'actor',
  event: noModificationEvent,
  context: { random: () => 0 }
});
assert.deepEqual(
  noModificationResolution.pending.map((item) => item.key),
  ['wave'],
  'an unmarked raw hit proc cannot change no-modification ProcResolver behavior'
);

const immunity = redTarget.applyBcuProc({
  key: 'freeze',
  payload: { time: 30, timeFrames: 30 }
}, { nowMs: 0, scene, attacker });
assert.equal(immunity.immune, true);
assert.equal(immunity.field, 'IMUSTOP');
assert.equal(hasBcuWaveStopper([redTarget]).blocked, true);

const barrierActor = createActor(barrierDef, { x: 100 });
const barrierHit = barrierActor.takeDamage(100);
assert.equal(barrierHit.blockedBy, 'barrier');
assert.equal(barrierActor.bcuBarrierHp, 500);

const shieldActor = createActor(shieldDef, { x: 100 });
const shieldHit = shieldActor.takeDamage(100);
assert.equal(shieldHit.blockedBy, 'shield');
assert.equal(shieldActor.bcuDemonShieldHp, 400);
assert.equal(shieldActor.bcuDemonShieldRegenPercent, 25);

const burrowActor = createActor(lifecycleDef, { x: 100 });
const burrowStart = canStartBcuBurrow(scene, burrowActor, attacker);
assert.equal(
  burrowStart.reason,
  'burrow-animation-missing',
  'modified burrow reaches the existing lifecycle runtime instead of reporting no spec'
);

const reviveActor = createActor(lifecycleDef, { x: 100 });
reviveActor.takeDamage(reviveActor.maxHp + 1);
const reviveResult = reviveActor.resolvePostDamage({
  nowMs: 0,
  tuning: { finalKnockbackBeforeDeath: false }
});
assert.equal(reviveResult.zombieReviveScheduled, true);
assert.equal(reviveActor.bcuZombieRevivePending, true);
assert.equal(reviveActor.bcuZombieReviveHealthPercent, 50);

const summonTargetDef = unitDef({
  slotId: 'summon-target-with-own-modification',
  statsType: 'enemy',
  statsId: 99,
  modification: {
    schemaVersion: 1,
    stats: { maxHp: 999999 }
  },
  source: 'custom-stage'
});
summonTargetDef.characterModificationHash = 'must-not-be-inherited';
summonTargetDef.characterModificationKey = 'must-not-be-inherited';
scene.stageEnemyUnitDefs = [summonTargetDef];
const summonProc = normalizeBcuSummonProc(attacker.rawStats.bcuProc, { attacker });
assert.equal(summonProc.exists, true);
const summonResult = enqueueBcuSummonSpawn(scene, {
  proc: summonProc,
  summoner: attacker,
  anchor: attacker,
  event: profile.events[0],
  trigger: 'runtime-integration-check',
  meta: { random: () => 0 }
});
assert.equal(summonResult.ok, true);
for (const key of [
  'characterModification',
  'characterModificationHash',
  'characterModificationSource',
  'characterModificationKey'
]) {
  assert.equal(
    Object.prototype.hasOwnProperty.call(summonResult.pending.unitDef, key),
    false,
    `summon target does not inherit ${key}`
  );
}

console.log('check-character-modification-runtime-integration: OK');
