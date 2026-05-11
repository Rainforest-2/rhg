export const PLAYABLE_REGISTRY_VERSION = '0.14.0';
export const DOG_DEFAULT_COST = 100;
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

function resolveName({ db, kind, id, locale = 'jp' }) {
  if (kind === 'enemy' && db?.names) {
    const n = db.names.enemy(id, locale);
    return { label: n.value, labelSource: n.source, labelLocale: n.locale, labelKey: n.key, labelWarnings: n.warnings };
  }
  if (kind === 'unit' && db?.names) {
    const n = db.names.unitForm(id, 0, locale);
    return { label: n.value, labelSource: n.source, labelLocale: n.locale, labelKey: n.key, labelWarnings: n.warnings };
  }
  const key = kind === 'enemy' ? `enemy:${id}` : `unit:${id}:form:0`;
  return { label: key, labelSource: 'fallback-id', labelLocale: locale, labelKey: key, labelWarnings: ['bcu-db-not-loaded'] };
}

export function buildDogSpecs(options = {}) {
  const excluded = excludedEnemyAssetIds(options.bcuDb || globalThis.__BCU_DB__ || null);
  return range(DOG_ENEMY_ID_RANGE.start, DOG_ENEMY_ID_RANGE.end)
    .filter((id) => !excluded.has(id))
    .map((id) => ({ id, characterId: `dog-enemy-${formatBcuId(id)}`, nameKey: `enemy:${id}`, cooldownMs: 3500 }));
}

export function buildCatSpecs(options = {}) {
  const excluded = excludedAllyAssetIds(options.bcuDb || globalThis.__BCU_DB__ || null);
  return range(CAT_UNIT_ID_RANGE.start, CAT_UNIT_ID_RANGE.end)
    .filter((unitId) => !excluded.has(unitId))
    .map((unitId) => ({ unitId, characterId: `cat-unit-${formatBcuId(unitId)}-f`, nameKey: `unit:${unitId}:form:0`, baseCharacterId: `cat-unit-${formatBcuId(unitId)}`, form: 'f', defaultCost: 2000, defaultCooldownMs: 7000, collisionRadius: 44, scale: 1.12 }));
}

export const DOG_PLAYABLE_SPECS = Object.freeze(buildDogSpecs());
export const CAT_PLAYABLE_SPECS = Object.freeze(buildCatSpecs());
export const ALL_DOG_PLAYABLE_SPECS = DOG_PLAYABLE_SPECS;
export const ALL_CAT_PLAYABLE_SPECS = CAT_PLAYABLE_SPECS;

export function buildGeneratedDogSpecs(options = {}) { return buildDogSpecs(options); }
export function buildGeneratedCatSpecs(options = {}) { return buildCatSpecs(options); }
export const GENERATED_DOG_PLAYABLE_SPECS = ALL_DOG_PLAYABLE_SPECS;
export const GENERATED_CAT_PLAYABLE_SPECS = ALL_CAT_PLAYABLE_SPECS;

function unitAssetDef({ id, bcuId, kind, form = 'f' }) {
  const semanticKey = kind === 'enemy' ? `enemy:${Number(id)}` : `unit:${Number(id)}:${form}`;
  const entry = globalThis.__BCU_DB__?.semanticProvider?.getActorEntry?.(semanticKey) || null;
  if (kind === 'enemy') {
    return {
      id: `enemy-${bcuId}`,
      kind: 'enemy',
      semanticKey,
      bundleRef: entry?.bundleRef || null,
      renderMode: 'animated-unit',
      image: 'image.png',
      imgcut: 'imgcut.imgcut',
      model: 'model.mamodel',
      animations: ['move', 'idle', 'attack', 'kb'].map((role, i) => ({ id: `anim0${i}`, file: `${role}.maanim` }))
    };
  }
  return {
    id: `unit-${bcuId}-${form}`,
    kind: 'unit',
    semanticKey,
    bundleRef: entry?.bundleRef || null,
    renderMode: 'animated-unit',
    image: 'image.png',
    imgcut: 'imgcut.imgcut',
    model: 'model.mamodel',
    animations: ['move', 'idle', 'attack', 'kb'].map((role, i) => ({ id: `anim0${i}`, file: `${role}.maanim` }))
  };
}

export function buildDogRosterEntry(spec, options = {}) {
  const db = options.bcuDb || globalThis.__BCU_DB__ || null;
  const locale = options.locale || db?.locale || 'jp';
  const bcuId = formatBcuId(spec.id);
  const name = resolveName({ db, kind: 'enemy', id: spec.id, locale });
  const cooldownMs = spec.cooldownMs ?? 3500;
  return {
    slotId: spec.characterId,
    baseCharacterId: spec.characterId,
    ...name,
    assetId: `enemy-${bcuId}`,
    assetDef: db?.assets?.resolveEnemyAsset(spec.id) || unitAssetDef({ id: spec.id, bcuId, kind: 'enemy' }),
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
    productionCostSource: 'catalog',
    productionCooldownSource: 'catalog',
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
    economySource: 'provisional-design',
    uiIcon: { kind: 'enemy', bcuId, semanticKey: `enemy:${spec.id}`, preferredInternalPaths: ['icon.png', 'image.png'] }
  };
}

export function buildCatRosterEntry(spec, options = {}) {
  const db = options.bcuDb || globalThis.__BCU_DB__ || null;
  const locale = options.locale || db?.locale || 'jp';
  const bcuId = formatBcuId(spec.unitId);
  const form = spec.form ?? 'f';
  const name = resolveName({ db, kind: 'unit', id: spec.unitId, locale });
  return {
    slotId: spec.characterId,
    baseCharacterId: spec.baseCharacterId,
    ...name,
    assetId: `unit-${bcuId}-${form}`,
    assetDef: db?.assets?.resolveUnitAsset(spec.unitId, form) || unitAssetDef({ id: spec.unitId, bcuId, kind: 'unit', form }),
    statsType: 'unit',
    statsId: spec.unitId,
    formRow: 0,
    faction: 'cat',
    factionLabel: 'cat-unit',
    sourceKind: 'unit',
    sourceRoster: 'catUnits',
    sourceSlotId: spec.characterId,
    defaultCost: spec.defaultCost,
    defaultCooldownMs: spec.defaultCooldownMs,
    productionCostSource: 'bcu-unit-stats',
    productionCooldownSource: 'bcu-unit-stats',
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
  return { characterId: e.slotId, baseCharacterId: e.baseCharacterId, faction: e.faction, factionLabel: e.factionLabel, label: e.label, labelSource: e.labelSource, labelLocale: e.labelLocale, labelKey: e.labelKey, labelWarnings: e.labelWarnings, sourceKind: e.sourceKind, sourceRoster: e.sourceRoster, sourceSlotId: e.sourceSlotId, defaultCost: e.defaultCost, defaultCooldownMs: e.defaultCooldownMs, productionCostSource: e.productionCostSource, productionCooldownSource: e.productionCooldownSource, productionOverrides: { side: e.side, direction: e.direction, facing: e.facing, renderFlipX: e.renderFlipX }, uiIcon: e.uiIcon };
};

export const buildCatCatalogEntry = (spec, options = {}) => {
  const e = buildCatRosterEntry(spec, options);
  return { characterId: e.slotId, baseCharacterId: e.baseCharacterId, faction: e.faction, factionLabel: e.factionLabel, label: e.label, labelSource: e.labelSource, labelLocale: e.labelLocale, labelKey: e.labelKey, labelWarnings: e.labelWarnings, sourceKind: e.sourceKind, sourceRoster: e.sourceRoster, sourceSlotId: e.sourceSlotId, defaultCost: e.defaultCost, defaultCooldownMs: e.defaultCooldownMs, productionCostSource: e.productionCostSource, productionCooldownSource: e.productionCooldownSource, productionOverrides: e.productionOverrides, uiIcon: e.uiIcon };
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
