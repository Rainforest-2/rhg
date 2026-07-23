import assert from 'node:assert/strict';
import {
  BattleActorFactory,
  TEMPLATE_LOAD_LEVEL,
  buildTemplateCacheIdentity,
  resolveTemplateStats
} from '../js/battle/BattleActorFactory.js';
import { BcuAssetLoader, __getBcuAssetCaches } from '../js/bcu/BcuAssetLoader.js';
import { setBcuAssetDatabase } from '../js/bcu/BcuAssetDatabase.js';
import { getCharacterModificationHash } from '../js/character-modification/CharacterModificationHash.js';

const modA = {
  schemaVersion: 1,
  stats: { maxHp: 200, width: 55, layer: 7 },
  attacks: { hits: { 0: { damage: 21 } } }
};
const modAReordered = {
  attacks: { hits: { 0: { damage: 21 } } },
  stats: { layer: 7, width: 55, maxHp: 200 },
  schemaVersion: 1
};
const modB = {
  schemaVersion: 1,
  stats: { maxHp: 300, width: 65, layer: 8 },
  attacks: { hits: { 0: { damage: 22 } } }
};
const baseDef = {
  slotId: 'same-slot',
  statsType: 'unit',
  statsId: 1,
  formRow: 0,
  assetId: 'unit-1',
  assetDef: { id: 'unit-1', semanticKey: 'unit:1:f', animations: [] },
  idleAnimId: 'idle',
  moveAnimId: 'move',
  attackAnimId: 'attack',
  knockbackAnimId: 'kb',
  collisionRadius: 44
};

const defA = {
  ...baseDef,
  characterModification: modA,
  characterModificationHash: getCharacterModificationHash(modA)
};
const defAReordered = {
  ...baseDef,
  characterModification: modAReordered,
  characterModificationHash: getCharacterModificationHash(modAReordered)
};
const defB = {
  ...baseDef,
  characterModification: modB,
  characterModificationHash: getCharacterModificationHash(modB)
};

assert.equal(
  buildTemplateCacheIdentity(defA),
  buildTemplateCacheIdentity(defAReordered),
  'canonical modification hash makes key order irrelevant'
);
assert.notEqual(
  buildTemplateCacheIdentity(defA),
  buildTemplateCacheIdentity(defB),
  'same character with a different modification gets a different template'
);
assert.equal(
  buildTemplateCacheIdentity({ ...defA, characterModificationHash: 'declared-but-wrong' }),
  buildTemplateCacheIdentity(defA),
  'cache identity derives from canonical modification content instead of trusting a declared hash'
);
const mutableModification = {
  schemaVersion: 1,
  stats: { maxHp: 400 }
};
const mutableDef = {
  ...baseDef,
  slotId: 'mutable-slot',
  characterModification: mutableModification,
  characterModificationHash: 'stale-declared-hash'
};
const mutableIdentityBefore = buildTemplateCacheIdentity(mutableDef);
mutableModification.stats.maxHp = 401;
const mutableIdentityAfter = buildTemplateCacheIdentity(mutableDef);
assert.notEqual(
  mutableIdentityAfter,
  mutableIdentityBefore,
  'mutating a modification object cannot reuse a stale WeakMap or declared-hash identity'
);
assert.notEqual(
  buildTemplateCacheIdentity(defA),
  buildTemplateCacheIdentity({ ...defA, bcuUnitLevel: { level: 60, plusLevel: 0 } }),
  'normal level context participates in template identity'
);
assert.notEqual(
  buildTemplateCacheIdentity(defA),
  buildTemplateCacheIdentity({ ...defA, attackAnimId: 'attack-alt' }),
  'animation identity participates in template identity'
);
const visualDefA = {
  ...defA,
  slotId: 'same-visual-slot',
  assetDef: {
    id: 'shared-visual-definition',
    semanticKey: 'unit:1:f',
    bundleRef: {
      bundleKey: 'actor:unit:1:f',
      bundlePath: 'public/assets/bundles/actor/unit-1-a.zip'
    },
    image: 'image.png',
    imgcut: 'imgcut.imgcut',
    model: 'model.mamodel',
    animations: [{ id: 'attack', file: 'attack-a.maanim' }]
  }
};
const visualDefDifferentBundle = {
  ...visualDefA,
  assetDef: {
    ...visualDefA.assetDef,
    bundleRef: {
      ...visualDefA.assetDef.bundleRef,
      bundlePath: 'public/assets/bundles/actor/unit-1-b.zip'
    }
  }
};
const visualDefDifferentAnimation = {
  ...visualDefA,
  assetDef: {
    ...visualDefA.assetDef,
    animations: [{ id: 'attack', file: 'attack-b.maanim' }]
  }
};
assert.notEqual(
  buildTemplateCacheIdentity(visualDefA),
  buildTemplateCacheIdentity(visualDefDifferentBundle),
  'asset bundle path participates in visual template identity'
);
assert.notEqual(
  buildTemplateCacheIdentity(visualDefA),
  buildTemplateCacheIdentity(visualDefDifferentAnimation),
  'canonical animation file definitions participate in visual template identity'
);

const baseStats = {
  hp: 100,
  knockbacks: 1,
  speed: 10,
  damage: 20,
  rawTbaFrames: 30,
  tbaFrames: 60,
  attackWaitFrames: 60,
  detectionRange: 100,
  range: 100,
  price: 50,
  costOrReward: 50,
  respawnFrames: 300,
  respawnSeconds: 9.9,
  width: 0,
  attackType: 0,
  isRange: false,
  attackStartupFrames: 1,
  longPreFrames: 1,
  front: 0,
  back: 0,
  ldStartRaw: 0,
  ldRangeRaw: 0,
  loop: -1,
  attackCount: 1,
  attackHits: [{
    hitIndex: 0,
    damage: 20,
    preFramesAbsolute: 1,
    preFrames: 1,
    deltaFramesFromPrevious: 1,
    abi: 0,
    ldStartRaw: 0,
    ldRangeRaw: 0,
    shortPointRaw: 0,
    longPointRaw: 0,
    isLd: false,
    isOmni: false
  }],
  traits: [],
  traitFlags: {},
  bcuAbi: 0,
  bcuAbilityFlags: {},
  bcuProc: {},
  bcuCombatModel: {
    kind: 'unit',
    traits: { list: [], flags: {} },
    ability: { raw: 0, flags: {} },
    proc: {},
    immunity: {},
    resistance: {}
  },
  source: { type: 'unit', mapping: 'test' }
};
const statsLoader = {
  loadUnitStats: async () => baseStats,
  loadEnemyStats: async () => baseStats,
  applyStageEnemyMagnification: (stats) => stats,
  describeStats: () => ({ source: 'test' })
};

assert.equal(
  resolveTemplateStats(statsLoader, baseDef, baseStats),
  baseStats,
  'no-modification stats path preserves the normal object and behavior'
);

const factory = new BattleActorFactory(statsLoader, {});
const templateA = await factory.preloadTemplateStats(defA);
const templateAAgain = await factory.preloadTemplateStats(defAReordered);
const templateAWithWrongDeclaredHash = await factory.preloadTemplateStats({
  ...defA,
  characterModificationHash: 'declared-but-wrong'
});
const templateB = await factory.preloadTemplateStats(defB);
const visualTemplateA = await factory.preloadTemplateStats(visualDefA);
const visualTemplateDifferentBundle = await factory.preloadTemplateStats(visualDefDifferentBundle);
const visualTemplateDifferentAnimation = await factory.preloadTemplateStats(visualDefDifferentAnimation);
assert.equal(templateAAgain, templateA, 'same character and canonical modification safely share a template');
assert.equal(
  templateAWithWrongDeclaredHash,
  templateA,
  'a mismatched declared hash cannot fork or poison the canonical template identity'
);
assert.notEqual(templateB, templateA, 'different modifications never share stats templates');
assert.notEqual(
  visualTemplateDifferentBundle,
  visualTemplateA,
  'the factory cannot reuse a template after the actor bundle changes'
);
assert.notEqual(
  visualTemplateDifferentAnimation,
  visualTemplateA,
  'the factory cannot reuse a template after an animation file definition changes'
);
assert.notEqual(templateB.stats, templateA.stats, 'different modifications never share stats objects');
assert.equal(templateA.baseStats, templateB.baseStats, 'immutable repository base stats may be shared');
assert.equal(templateA.stats.hp, 200);
assert.equal(templateB.stats.hp, 300);
assert.equal(baseStats.hp, 100, 'template resolution does not mutate repository stats');
const mutableTemplateBefore = await factory.preloadTemplateStats(mutableDef);
mutableModification.stats.maxHp = 402;
const mutableTemplateAfter = await factory.preloadTemplateStats(mutableDef);
assert.notEqual(
  mutableTemplateAfter,
  mutableTemplateBefore,
  'preloading after an in-place modification change cannot reuse the old template'
);
assert.equal(mutableTemplateBefore.stats.hp, 401);
assert.equal(mutableTemplateAfter.stats.hp, 402);
assert.equal(factory.getTemplate(defA), templateA);
assert.equal(factory.getTemplate(defB), templateB);
assert.equal(
  factory.getTemplate(baseDef.slotId),
  undefined,
  'a slot-only lookup cannot select an arbitrary revision when multiple templates exist'
);

templateA.loadingLevel = TEMPLATE_LOAD_LEVEL.RENDER_CORE;
templateB.loadingLevel = TEMPLATE_LOAD_LEVEL.RENDER_CORE;
const actorA = factory.createActor(defA, {
  side: 'dog-player',
  x: 0,
  y: 0,
  direction: -1,
  currentAnimId: 'move'
});
const actorB = factory.createActor(defB, {
  side: 'dog-player',
  x: 0,
  y: 0,
  direction: -1,
  currentAnimId: 'move'
});
assert.notEqual(actorA.rawStats, actorB.rawStats, 'simultaneous actors keep distinct modified stats');
assert.notEqual(actorA.attackProfile, actorB.attackProfile, 'attack profiles are actor-local and never shared across modifications');
assert.equal(actorA.attackProfile.events[0].damage, 21);
assert.equal(actorB.attackProfile.events[0].damage, 22);
assert.equal(actorA.characterModificationHash, getCharacterModificationHash(modA));
assert.equal(actorB.characterModificationHash, getCharacterModificationHash(modB));
assert.equal(actorA.templateId, buildTemplateCacheIdentity(defA));
assert.equal(actorB.templateId, buildTemplateCacheIdentity(defB));
assert.equal(actorA.currentLayer, 7, 'modified stats layer becomes the actor initial layer');
assert.equal(actorB.currentLayer, 8, 'distinct modifications keep distinct actor layers');
assert.equal(actorA.attackWidthBcu, 55, 'BCU width rebuilds the actor touch/attack width');
assert.equal(actorA.attackWidthPx, 55, 'BCU width rebuilds the actor world width');
assert.equal(actorB.attackWidthBcu, 65, 'distinct width modifications stay isolated');
assert.equal(actorA.collisionRadius, 44, 'BCU width does not invent an entity collision radius');

const semanticReads = [];
const semanticProvider = {
  allowRawFallback: false,
  diagnostics: { bundleErrors: [] },
  getActorEntry: () => ({
    bundleRef: { bundlePath: 'actors/unit-1.zip' },
    selected: { sourcePack: 'fixture' },
    diagnostics: { sourceRawPaths: [] }
  }),
  hasBundleForKey: () => true,
  readTextByBundleRef: async (_bundleRef, internalPath) => {
    semanticReads.push(internalPath);
    if (internalPath === 'idle.maanim') return '[maanim]\n1\n0\n';
    throw new Error(`fixture does not provide ${internalPath}`);
  }
};
setBcuAssetDatabase({ semanticProvider });
const assetCaches = __getBcuAssetCaches();
assetCaches.animationCache.clear();
const assetLoader = new BcuAssetLoader();
const firstAnimation = await assetLoader.loadAnimation(
  { id: 'unit-1-mod-a', semanticKey: 'unit:1:f' },
  { id: 'anim01', file: 'unused-idle-a.maanim' }
);
const secondAnimation = await assetLoader.loadAnimation(
  { id: 'unit-1-mod-b', semanticKey: 'unit:1:f' },
  { id: 'anim01', file: 'unused-idle-b.maanim' }
);
assert.equal(firstAnimation, secondAnimation, 'different modification templates share the semantic animation result');
assert.equal(
  semanticReads.filter((path) => path === 'idle.maanim').length,
  1,
  'semantic animation is read and parsed only once'
);
assert.equal(assetCaches.animationCache.size, 1, 'semantic animation has one shared cache entry');

console.log('check-character-modification-cache: OK');
