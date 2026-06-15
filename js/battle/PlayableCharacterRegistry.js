import { BCU_BATTLE_TIMER_PERIOD_MS } from './BattleFrameClock.js';
import { formCodeFromIndex } from '../bcu/BcuIdentifier.js';

export const PLAYABLE_REGISTRY_VERSION = '0.15.0-bcu-unit-level';
export const DOG_DEFAULT_COST = 100;
export const DOG_DEFAULT_COOLDOWN_MS = 3500;
export const DOG_ENEMY_ID_RANGE = Object.freeze({ start: 0, end: 777 });
export const CAT_UNIT_ID_RANGE = Object.freeze({ start: 0, end: 859 });

const FALLBACK_ERROR_ENEMY_DISPLAY_IDS = Object.freeze([
  1, 21, 22, 315, 347, 417, 450, 453, 467, 468, 469, 472, 473, 474, 475, 476, 477,
  524, 525, 526, 527, 566, 567, 568, 569, 570, 571, 646, 663, 664, 665, 666, 667,
  668, 669, 670, 671, 688, 689, 749
]);

export function formatBcuId(id) {
  if (!Number.isInteger(id) || id < 0 || id > 999) throw new Error(`Invalid BCU id: ${id}`);
  return String(id).padStart(3, '0');
}

function range(start, end) {
  return Array.from({ length: Math.max(0, end - start + 1) }, (_, i) => i + start);
}

function excludedEnemyAssetIds(db = null) {
  const fromDb = db?.playable?.enemies?.excludedAssetIds;
  if (Array.isArray(fromDb)) return new Set(fromDb);
  return new Set(FALLBACK_ERROR_ENEMY_DISPLAY_IDS.map((id) => id - 2).filter((id) => id >= 0));
}

function excludedAllyAssetIds(db = null) {
  const fromDb = db?.playable?.allies?.excludedAssetIds;
  return new Set(Array.isArray(fromDb) ? fromDb : []);
}

function resolveName({ db, kind, id, locale = 'jp', formIndex = 0 }) {
  if (kind === 'enemy' && db?.names) {
    const n = db.names.enemy(id, locale);
    return { label: n.value, labelSource: n.source, labelLocale: n.locale, labelKey: n.key, labelWarnings: n.warnings };
  }
  if (kind === 'unit' && db?.names) {
    const n = db.names.unitForm(id, formIndex, locale);
    return { label: n.value, labelSource: n.source, labelLocale: n.locale, labelKey: n.key, labelWarnings: n.warnings };
  }
  const key = kind === 'enemy' ? `enemy:${id}` : `unit:${id}:form:${formIndex}`;
  return { label: key, labelSource: 'fallback-id', labelLocale: locale, labelKey: key, labelWarnings: ['bcu-db-not-loaded'] };
}

function getCatFormRecord(db, unitId, form = 'f') {
  if (!db?.units?.getForm) return null;
  try { return db.units.getForm(unitId, form); } catch { return null; }
}

function getCatStats(db, unitId, form = 'f') {
  if (!db?.units?.getFormStats) return null;
  try { return db.units.getFormStats(unitId, form); }
  catch (error) { return { __statsError: error?.message || String(error) }; }
}

function getCatUnitLevelMeta(db, unitId, form = 'f') {
  const record = getCatFormRecord(db, unitId, form);
  return record?.levelMeta || record?.stats?.bcuUnitLevelMeta || record?.stats?.source?.unitLevelMeta || db?.units?.get?.(unitId)?.levelMeta || null;
}

function getCatEconomyFromStats(stats) {
  if (!stats || stats.__statsError) {
    return {
      cost: null,
      defaultCost: null,
      cooldownMs: null,
      defaultCooldownMs: null,
      bcuPrice: null,
      bcuRespawnFrames: null,
      bcuRespawnMs: null,
      productionCostSource: stats?.__statsError ? 'bcu-unit-stats-error' : 'bcu-db-not-loaded',
      productionCooldownSource: stats?.__statsError ? 'bcu-unit-stats-error' : 'bcu-db-not-loaded',
      productionSourceDebug: stats?.__statsError ? { source: 'PlayableCharacterRegistry.getCatEconomyFromStats', error: stats.__statsError } : { source: 'PlayableCharacterRegistry.getCatEconomyFromStats', reason: 'bcu-db-not-loaded' }
    };
  }
  const price = Number.isFinite(stats.price) ? Math.max(0, Math.floor(stats.price)) : null;
  const respawnFrames = Number.isFinite(stats.respawnFrames) ? Math.max(0, Math.floor(stats.respawnFrames)) : null;
  const respawnMs = Number.isFinite(respawnFrames) ? respawnFrames * BCU_BATTLE_TIMER_PERIOD_MS : null;
  return {
    cost: price,
    defaultCost: price,
    cooldownMs: respawnMs,
    defaultCooldownMs: respawnMs,
    bcuPrice: price,
    bcuRespawnFrames: respawnFrames,
    bcuRespawnMs: respawnMs,
    productionCostSource: 'BCU DataUnit.price raw[6]',
    productionCooldownSource: 'BCU DataUnit.respawn raw[7] * 2 frames',
    productionSourceDebug: {
      source: 'PlayableCharacterRegistry.getCatEconomyFromStats',
      bcuReference: 'DataUnit.java: price=ints[6]; respawn=ints[7]*2',
      price,
      respawnFrames,
      respawnMs,
      statsSource: stats.source || null
    }
  };
}

function getCatEconomy({ db, unitId, form = 'f' }) {
  return getCatEconomyFromStats(getCatStats(db, unitId, form));
}

export function buildDogSpecs(options = {}) {
  const excluded = excludedEnemyAssetIds(options.bcuDb || globalThis.__BCU_DB__ || null);
  return range(DOG_ENEMY_ID_RANGE.start, DOG_ENEMY_ID_RANGE.end)
    .filter((id) => !excluded.has(id))
    .map((id) => ({ id, characterId: `dog-enemy-${formatBcuId(id)}`, nameKey: `enemy:${id}`, cooldownMs: DOG_DEFAULT_COOLDOWN_MS }));
}

// Resolve which form indexes exist for a unit. BCU stores one form record per
// CSV row in db.units.get(unitId).forms (index 0..3 -> f/c/s/u). Without a loaded
// DB only the first form is known, preserving the module-load catalog behavior;
// activeCatalog() rebuilds with every form once the DB is available.
function availableFormIndexes(db, unitId) {
  const forms = db?.units?.get?.(unitId)?.forms;
  if (Array.isArray(forms) && forms.length) {
    const indexes = forms.map((f) => (Number.isInteger(f?.index) ? f.index : null)).filter((i) => Number.isInteger(i));
    if (indexes.length) return indexes;
  }
  return [0];
}

export function buildCatSpecs(options = {}) {
  const db = options.bcuDb || globalThis.__BCU_DB__ || null;
  const excluded = excludedAllyAssetIds(db);
  const specs = [];
  for (const unitId of range(CAT_UNIT_ID_RANGE.start, CAT_UNIT_ID_RANGE.end)) {
    if (excluded.has(unitId)) continue;
    for (const formIndex of availableFormIndexes(db, unitId)) {
      const form = formCodeFromIndex(formIndex);
      specs.push({
        unitId,
        characterId: `cat-unit-${formatBcuId(unitId)}-${form}`,
        nameKey: `unit:${unitId}:form:${formIndex}`,
        baseCharacterId: `cat-unit-${formatBcuId(unitId)}`,
        form,
        formIndex,
        ...getCatEconomy({ db, unitId, form }),
        bcuUnitLevelMeta: getCatUnitLevelMeta(db, unitId, form),
        collisionRadius: 44,
        scale: 1.12
      });
    }
  }
  return specs;
}

export const DOG_PLAYABLE_SPECS = Object.freeze(buildDogSpecs());
export const CAT_PLAYABLE_SPECS = Object.freeze(buildCatSpecs());
export const ALL_DOG_PLAYABLE_SPECS = DOG_PLAYABLE_SPECS;
export const ALL_CAT_PLAYABLE_SPECS = CAT_PLAYABLE_SPECS;

export function buildGeneratedDogSpecs(options = {}) { return buildDogSpecs(options); }
export function buildGeneratedCatSpecs(options = {}) { return buildCatSpecs(options); }
export const GENERATED_DOG_PLAYABLE_SPECS = ALL_DOG_PLAYABLE_SPECS;
export const GENERATED_CAT_PLAYABLE_SPECS = ALL_CAT_PLAYABLE_SPECS;

function enemyBurrowAnimationDefs(bcuId) {
  // BCU AnimUD.DefImgLoader#getMA maps *_zombie00/01/02 to AnimU.TYPE7
  // indexes 4/5/6: BURROW_DOWN/BURROW_MOVE/BURROW_UP.
  return [
    { id: 'anim04', file: `${bcuId}_e_zombie00.maanim` },
    { id: 'anim05', file: `${bcuId}_e_zombie01.maanim` },
    { id: 'anim06', file: `${bcuId}_e_zombie02.maanim` }
  ];
}

function withEnemyBurrowAnimations(assetDef, bcuId) {
  if (!assetDef) return assetDef;
  const animations = Array.isArray(assetDef.animations) ? assetDef.animations : [];
  const existing = new Set(animations.map((a) => a?.id));
  return {
    ...assetDef,
    allowExtraRawAnimations: true,
    // Raw BCU baseDir is fallback metadata only; semanticKey ZIP bundles resolve first
    // and installRuntimeRawBcuGuard blocks raw fetches in semantic-strict mode.
    baseDir: assetDef.baseDir || `./public/assets/bcu/000002/org/enemy/${bcuId}/`,
    animations: [...animations, ...enemyBurrowAnimationDefs(bcuId).filter((a) => !existing.has(a.id))]
  };
}

function unitAssetDef({ id, bcuId, kind, form = 'f' }) {
  const semanticKey = kind === 'enemy' ? `enemy:${Number(id)}` : `unit:${Number(id)}:${form}`;
  const entry = globalThis.__BCU_DB__?.semanticProvider?.getActorEntry?.(semanticKey) || null;
  if (kind === 'enemy') {
    return withEnemyBurrowAnimations({ id: `enemy-${bcuId}`, kind: 'enemy', semanticKey, bundleRef: entry?.bundleRef || null, renderMode: 'animated-unit', image: 'image.png', imgcut: 'imgcut.imgcut', model: 'model.mamodel', animations: ['move', 'idle', 'attack', 'kb'].map((role, i) => ({ id: `anim0${i}`, file: `${role}.maanim` })) }, bcuId);
  }
  return { id: `unit-${bcuId}-${form}`, kind: 'unit', semanticKey, bundleRef: entry?.bundleRef || null, renderMode: 'animated-unit', image: 'image.png', imgcut: 'imgcut.imgcut', model: 'model.mamodel', animations: ['move', 'idle', 'attack', 'kb'].map((role, i) => ({ id: `anim0${i}`, file: `${role}.maanim` })) };
}

export function buildDogRosterEntry(spec, options = {}) {
  const db = options.bcuDb || globalThis.__BCU_DB__ || null;
  const locale = options.locale || db?.locale || 'jp';
  const bcuId = formatBcuId(spec.id);
  const name = resolveName({ db, kind: 'enemy', id: spec.id, locale });
  const cooldownMs = spec.cooldownMs ?? DOG_DEFAULT_COOLDOWN_MS;
  return {
    slotId: spec.characterId,
    baseCharacterId: spec.characterId,
    ...name,
    assetId: `enemy-${bcuId}`,
    assetDef: withEnemyBurrowAnimations(db?.assets?.resolveEnemyAsset(spec.id) || unitAssetDef({ id: spec.id, bcuId, kind: 'enemy' }), bcuId),
    statsType: 'enemy',
    statsId: spec.id,
    faction: 'dog',
    factionLabel: 'dog-player',
    sourceKind: 'enemy',
    sourceRoster: 'dogPlayer',
    sourceSlotId: spec.characterId,
    cost: DOG_DEFAULT_COST,
    defaultCost: DOG_DEFAULT_COST,
    cooldownMs,
    defaultCooldownMs: cooldownMs,
    productionCostSource: 'dog-provisional-not-bcu',
    productionCooldownSource: 'dog-provisional-not-bcu',
    side: 'dog-player',
    direction: -1,
    facing: -1,
    renderFlipX: true,
    collisionRadius: 46,
    scale: 1.12,
    idleAnimId: 'anim01',
    moveAnimId: 'anim00',
    attackAnimId: 'anim02',
    knockbackAnimId: 'anim03',
    economySource: 'provisional-design-not-bcu',
    productionSourceDebug: { source: 'PlayableCharacterRegistry.buildDogRosterEntry', reason: 'dogs are enemy assets used as playable; no Battle Cats/BCU DataUnit price/respawn exists' },
    uiIcon: { kind: 'enemy', bcuId, semanticKey: `enemy:${spec.id}`, preferredInternalPaths: ['icon.png', 'image.png'] }
  };
}

export function buildCatRosterEntry(spec, options = {}) {
  const db = options.bcuDb || globalThis.__BCU_DB__ || null;
  const locale = options.locale || db?.locale || 'jp';
  const bcuId = formatBcuId(spec.unitId);
  const form = spec.form ?? 'f';
  const formIndex = spec.formIndex ?? 0;
  const name = resolveName({ db, kind: 'unit', id: spec.unitId, locale, formIndex });
  const economy = getCatEconomy({ db, unitId: spec.unitId, form });
  const bcuUnitLevelMeta = spec.bcuUnitLevelMeta || getCatUnitLevelMeta(db, spec.unitId, form);
  return {
    slotId: spec.characterId,
    baseCharacterId: spec.baseCharacterId,
    ...name,
    assetId: `unit-${bcuId}-${form}`,
    assetDef: db?.assets?.resolveUnitAsset(spec.unitId, form) || unitAssetDef({ id: spec.unitId, bcuId, kind: 'unit', form }),
    statsType: 'unit',
    statsId: spec.unitId,
    form,
    formIndex,
    formRow: formIndex,
    faction: 'cat',
    factionLabel: 'cat-unit',
    sourceKind: 'unit',
    sourceRoster: 'catUnits',
    sourceSlotId: spec.characterId,
    cost: economy.cost,
    defaultCost: economy.defaultCost,
    cooldownMs: economy.cooldownMs,
    defaultCooldownMs: economy.defaultCooldownMs,
    bcuPrice: economy.bcuPrice,
    bcuRespawnFrames: economy.bcuRespawnFrames,
    bcuRespawnMs: economy.bcuRespawnMs,
    bcuUnitLevelMeta,
    productionCostSource: economy.productionCostSource,
    productionCooldownSource: economy.productionCooldownSource,
    productionSourceDebug: economy.productionSourceDebug,
    side: 'cat-enemy',
    direction: 1,
    facing: 1,
    renderFlipX: true,
    productionOverrides: { side: 'dog-player', direction: -1, facing: -1, renderFlipX: false },
    collisionRadius: spec.collisionRadius,
    scale: spec.scale,
    idleAnimId: 'anim01',
    moveAnimId: 'anim00',
    attackAnimId: 'anim02',
    knockbackAnimId: 'anim03',
    uiIcon: { kind: 'unit', bcuId, semanticKey: `unit:${spec.unitId}:${form}`, preferredInternalPaths: ['icon.png', 'image.png'] }
  };
}

export const buildDogCatalogEntry = (spec, options = {}) => {
  const e = buildDogRosterEntry(spec, options);
  return { characterId: e.slotId, baseCharacterId: e.baseCharacterId, faction: e.faction, factionLabel: e.factionLabel, label: e.label, labelSource: e.labelSource, labelLocale: e.labelLocale, labelKey: e.labelKey, labelWarnings: e.labelWarnings, sourceKind: e.sourceKind, sourceRoster: e.sourceRoster, sourceSlotId: e.sourceSlotId, cost: e.cost, defaultCost: e.defaultCost, cooldownMs: e.cooldownMs, defaultCooldownMs: e.defaultCooldownMs, productionCostSource: e.productionCostSource, productionCooldownSource: e.productionCooldownSource, productionSourceDebug: e.productionSourceDebug, productionOverrides: { side: e.side, direction: e.direction, facing: e.facing, renderFlipX: e.renderFlipX }, uiIcon: e.uiIcon };
};

export const buildCatCatalogEntry = (spec, options = {}) => {
  const e = buildCatRosterEntry(spec, options);
  return { characterId: e.slotId, baseCharacterId: e.baseCharacterId, faction: e.faction, factionLabel: e.factionLabel, form: e.form, formIndex: e.formIndex, label: e.label, labelSource: e.labelSource, labelLocale: e.labelLocale, labelKey: e.labelKey, labelWarnings: e.labelWarnings, sourceKind: e.sourceKind, sourceRoster: e.sourceRoster, sourceSlotId: e.sourceSlotId, cost: e.cost, defaultCost: e.defaultCost, cooldownMs: e.cooldownMs, defaultCooldownMs: e.defaultCooldownMs, bcuPrice: e.bcuPrice, bcuRespawnFrames: e.bcuRespawnFrames, bcuRespawnMs: e.bcuRespawnMs, bcuUnitLevelMeta: e.bcuUnitLevelMeta, productionCostSource: e.productionCostSource, productionCooldownSource: e.productionCooldownSource, productionSourceDebug: e.productionSourceDebug, productionOverrides: e.productionOverrides, uiIcon: e.uiIcon };
};

export const buildDogPreviewAsset = (spec, ANIM4_E, options = {}) => {
  const db = options.bcuDb || globalThis.__BCU_DB__ || null;
  const bcuId = formatBcuId(spec.id);
  const name = resolveName({ db, kind: 'enemy', id: spec.id, locale: options.locale || db?.locale || 'jp' });
  return { ...unitAssetDef({ id: spec.id, bcuId, kind: 'enemy' }), label: name.label, labelSource: name.labelSource, labelKey: name.labelKey, role: 'player-dog-candidate', group: 'dogs', animations: ANIM4_E(`${bcuId}_e`) };
};

export const buildCatPreviewAsset = (spec, ANIM4_E, options = {}) => {
  const db = options.bcuDb || globalThis.__BCU_DB__ || null;
  const bcuId = formatBcuId(spec.unitId);
  const form = spec.form ?? 'f';
  const name = resolveName({ db, kind: 'unit', id: spec.unitId, locale: options.locale || db?.locale || 'jp' });
  return { ...unitAssetDef({ id: spec.unitId, bcuId, kind: 'unit', form }), label: name.label, labelSource: name.labelSource, labelKey: name.labelKey, role: 'enemy-cat-candidate', group: 'cats', animations: ANIM4_E(`${bcuId}_${form}`) };
};

export const buildPlayableRosters = (options = {}) => ({ dogPlayer: buildDogSpecs(options).map((s) => buildDogRosterEntry(s, options)), catUnits: buildCatSpecs(options).map((s) => buildCatRosterEntry(s, options)) });
export const buildCharacterCatalog = (options = {}) => ([...buildDogSpecs(options).map((s) => buildDogCatalogEntry(s, options)), ...buildCatSpecs(options).map((s) => buildCatCatalogEntry(s, options))]);
export const buildPlayablePreviewAssets = (ANIM4_E, options = {}) => ([...buildDogSpecs(options).map((s) => buildDogPreviewAsset(s, ANIM4_E, options)), ...buildCatSpecs(options).map((s) => buildCatPreviewAsset(s, ANIM4_E, options))]);
export const getPlayableCharacterSpecs = (options = {}) => ({ dogs: buildDogSpecs(options), cats: buildCatSpecs(options) });

export function getPlayableRegistrySummary(options = {}) {
  const dogs = buildDogSpecs(options);
  const cats = buildCatSpecs(options);
  return { version: PLAYABLE_REGISTRY_VERSION, dogs: dogs.length, cats: cats.length, totalDogs: dogs.length, totalCats: cats.length };
}

export function validatePlayableRegistry(options = {}) {
  const rosters = buildPlayableRosters(options);
  const ids = new Set();
  const dup = [];
  for (const x of [...rosters.dogPlayer, ...rosters.catUnits]) {
    if (ids.has(x.slotId)) dup.push(x.slotId);
    ids.add(x.slotId);
  }
  return { ok: dup.length === 0, duplicateSlotIds: dup, source: 'PlayableCharacterRegistry.validatePlayableRegistry' };
}
