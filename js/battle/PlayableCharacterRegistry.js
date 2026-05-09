export const PLAYABLE_REGISTRY_VERSION = '0.13.0';
export const DOG_DEFAULT_COST = 100;

export function formatBcuId(id) {
  if (!Number.isInteger(id) || id < 0 || id > 999) {
    throw new Error(`Invalid BCU id: ${id}`);
  }
  return String(id).padStart(3, '0');
}

export const DOG_PLAYABLE_SPECS = Object.freeze([
  { id: 0, characterId: 'dog-wanko', label: 'ワンコ', cooldownMs: 2000 },
  { id: 1, characterId: 'dog-nyoro', label: 'ニョロ', cooldownMs: 2800 },
  { id: 2, characterId: 'dog-rei', label: '例のヤツ', cooldownMs: 3500, combatPositionOffsetPx: 0, combatEdgeInsetPx: 18, combatPositionSource: 'visual-left-edge-inset-18' },
  { id: 3, characterId: 'dog-enemy-003', label: '敵003', cooldownMs: 3500 },
  { id: 4, characterId: 'dog-enemy-004', label: '敵004', cooldownMs: 3500 },
  { id: 5, characterId: 'dog-enemy-005', label: '敵005', cooldownMs: 3500 },
  { id: 6, characterId: 'dog-enemy-006', label: '敵006', cooldownMs: 3500 },
  { id: 7, characterId: 'dog-enemy-007', label: '敵007', cooldownMs: 3500 },
  { id: 8, characterId: 'dog-enemy-008', label: '敵008', cooldownMs: 3500 },
  { id: 9, characterId: 'dog-enemy-009', label: '敵009', cooldownMs: 3500 },
  { id: 10, characterId: 'dog-enemy-010', label: '敵010', cooldownMs: 3500 },
  { id: 11, characterId: 'dog-enemy-011', label: '敵011', cooldownMs: 3500 },
  { id: 12, characterId: 'dog-enemy-012', label: '敵012', cooldownMs: 3500 }
]);

export const CAT_PLAYABLE_SPECS = Object.freeze([
  { unitId: 0, characterId: 'cat-basic', label: 'ネコ', baseCharacterId: 'cat-basic', defaultCost: 75, defaultCooldownMs: 2500, collisionRadius: 42, scale: 1.15 },
  { unitId: 1, characterId: 'cat-tank', label: 'タンクネコ', baseCharacterId: 'cat-tank', defaultCost: 100, defaultCooldownMs: 3500, collisionRadius: 50, scale: 1.12 },
  { unitId: 2, characterId: 'cat-battle', label: 'バトルネコ', baseCharacterId: 'cat-battle', defaultCost: 150, defaultCooldownMs: 3200, collisionRadius: 44, scale: 1.12 },
  { unitId: 3, characterId: 'cat-kimo', label: 'キモネコ', baseCharacterId: 'cat-kimo', defaultCost: 400, defaultCooldownMs: 5500, collisionRadius: 44, scale: 1.12 },
  { unitId: 4, characterId: 'cat-cow', label: 'ウシネコ', baseCharacterId: 'cat-cow', defaultCost: 750, defaultCooldownMs: 2500, collisionRadius: 44, scale: 1.12 },
  { unitId: 5, characterId: 'cat-bird', label: 'ネコノトリ', baseCharacterId: 'cat-bird', defaultCost: 975, defaultCooldownMs: 3500, collisionRadius: 44, scale: 1.12 },
  { unitId: 6, characterId: 'cat-fish', label: 'ネコフィッシュ', baseCharacterId: 'cat-fish', defaultCost: 1200, defaultCooldownMs: 4500, collisionRadius: 44, scale: 1.12 },
  { unitId: 7, characterId: 'cat-lizard', label: 'ネコトカゲ', baseCharacterId: 'cat-lizard', defaultCost: 1500, defaultCooldownMs: 5500, collisionRadius: 44, scale: 1.12 },
  { unitId: 8, characterId: 'cat-titan', label: '巨神ネコ', baseCharacterId: 'cat-titan', defaultCost: 1950, defaultCooldownMs: 7000, collisionRadius: 50, scale: 1.12 },
  { unitId: 9, characterId: 'cat-unit-009-f', label: 'ユニット009', baseCharacterId: 'cat-unit-009', form: 'f', defaultCost: 2000, defaultCooldownMs: 7000, collisionRadius: 44, scale: 1.12 },
  { unitId: 10, characterId: 'cat-unit-010-f', label: 'ユニット010', baseCharacterId: 'cat-unit-010', form: 'f', defaultCost: 2000, defaultCooldownMs: 7000, collisionRadius: 44, scale: 1.12 },
  { unitId: 11, characterId: 'cat-unit-011-f', label: 'ユニット011', baseCharacterId: 'cat-unit-011', form: 'f', defaultCost: 2000, defaultCooldownMs: 7000, collisionRadius: 44, scale: 1.12 },
  { unitId: 12, characterId: 'cat-unit-012-f', label: 'ユニット012', baseCharacterId: 'cat-unit-012', form: 'f', defaultCost: 2000, defaultCooldownMs: 7000, collisionRadius: 44, scale: 1.12 }
]);


export function buildGeneratedDogSpecs({ start = 13, end = 30 } = {}) {
  const out = [];
  for (let id = start; id <= end; id += 1) {
    if (DOG_PLAYABLE_SPECS.some((s) => s.id === id)) continue;
    const bcuId = formatBcuId(id);
    out.push({ id, characterId: `dog-enemy-${bcuId}`, label: `敵${bcuId}`, cooldownMs: 3500, generated: true, generationSource: 'PlayableCharacterRegistry.buildGeneratedDogSpecs' });
  }
  return out;
}

export function buildGeneratedCatSpecs({ start = 13, end = 30, form = 'f' } = {}) {
  const out = [];
  for (let unitId = start; unitId <= end; unitId += 1) {
    if (CAT_PLAYABLE_SPECS.some((s) => s.unitId === unitId)) continue;
    const bcuId = formatBcuId(unitId);
    out.push({ unitId, characterId: `cat-unit-${bcuId}-${form}`, label: `ユニット${bcuId}`, baseCharacterId: `cat-unit-${bcuId}`, form, defaultCost: 2000, defaultCooldownMs: 7000, collisionRadius: 44, scale: 1.12, generated: true, generationSource: 'PlayableCharacterRegistry.buildGeneratedCatSpecs' });
  }
  return out;
}

export const GENERATED_DOG_PLAYABLE_SPECS = Object.freeze(buildGeneratedDogSpecs({ start: 13, end: 30 }));
export const GENERATED_CAT_PLAYABLE_SPECS = Object.freeze(buildGeneratedCatSpecs({ start: 13, end: 30 }));
export const ALL_DOG_PLAYABLE_SPECS = Object.freeze([...DOG_PLAYABLE_SPECS, ...GENERATED_DOG_PLAYABLE_SPECS]);
export const ALL_CAT_PLAYABLE_SPECS = Object.freeze([...CAT_PLAYABLE_SPECS, ...GENERATED_CAT_PLAYABLE_SPECS]);

export function buildDogRosterEntry(spec) { const bcuId = formatBcuId(spec.id); const cooldownMs = spec.cooldownMs ?? 3500; return { slotId: spec.characterId, baseCharacterId: spec.characterId, label: spec.label, assetId: `enemy-${bcuId}`, statsType: 'enemy', statsId: spec.id, faction: 'dog', factionLabel: 'ワンコ軍', sourceKind: 'enemy', sourceRoster: 'dogPlayer', sourceSlotId: spec.characterId, cost: DOG_DEFAULT_COST, defaultCost: DOG_DEFAULT_COST, cooldownMs, defaultCooldownMs: cooldownMs, productionCostSource: 'catalog', productionCooldownSource: 'catalog', side: 'dog-player', direction: -1, facing: -1, renderFlipX: true, collisionRadius: 46, scale: 1.12, idleAnimId: 'anim01', moveAnimId: 'anim00', attackAnimId: 'anim02', knockbackAnimId: 'anim03', economySource: 'provisional-design', ...(spec.combatPositionOffsetPx !== undefined ? { combatPositionOffsetPx: spec.combatPositionOffsetPx } : {}), ...(spec.combatEdgeInsetPx !== undefined ? { combatEdgeInsetPx: spec.combatEdgeInsetPx } : {}), ...(spec.combatPositionSource ? { combatPositionSource: spec.combatPositionSource } : {}), uiIcon: { kind: 'enemy', bcuId, primary: `./public/assets/bcu/000010/org/enemy/${bcuId}/enemy_icon_${bcuId}.png`, fallback: `./public/assets/bcu/000002/org/enemy/${bcuId}/edi_${bcuId}.png` } }; }
export function buildCatRosterEntry(spec) { const bcuId = formatBcuId(spec.unitId); const form = spec.form ?? 'f'; return { slotId: spec.characterId, baseCharacterId: spec.baseCharacterId, label: spec.label, assetId: `unit-${bcuId}-${form}`, statsType: 'unit', statsId: spec.unitId, formRow: 0, faction: 'cat', factionLabel: 'ネコ軍', sourceKind: 'unit', sourceRoster: 'catUnits', sourceSlotId: spec.characterId, defaultCost: spec.defaultCost, defaultCooldownMs: spec.defaultCooldownMs, productionCostSource: 'bcu-unit-stats', productionCooldownSource: 'bcu-unit-stats', side: 'cat-enemy', direction: 1, facing: 1, renderFlipX: true, productionOverrides: { side: 'dog-player', direction: -1, facing: -1, renderFlipX: false }, collisionRadius: spec.collisionRadius, scale: spec.scale, idleAnimId: 'anim01', moveAnimId: 'anim00', attackAnimId: 'anim02', knockbackAnimId: 'anim03', uiIcon: { kind: 'unit', bcuId, primary: `./public/assets/bcu/000004/org/unit/${bcuId}/${form}/uni${bcuId}_${form}00.png`, fallback: `./public/assets/bcu/000004/org/unit/${bcuId}/${form}/${bcuId}_${form}.png` } }; }
export const buildDogCatalogEntry = (spec) => { const e = buildDogRosterEntry(spec); return { characterId: e.slotId, baseCharacterId: e.baseCharacterId, faction: e.faction, factionLabel: e.factionLabel, label: e.label, sourceKind: e.sourceKind, sourceRoster: e.sourceRoster, sourceSlotId: e.sourceSlotId, defaultCost: e.defaultCost, defaultCooldownMs: e.defaultCooldownMs, productionCostSource: e.productionCostSource, productionCooldownSource: e.productionCooldownSource, productionOverrides: { side: e.side, direction: e.direction, facing: e.facing, renderFlipX: e.renderFlipX }, generated: spec.generated === true, generationSource: spec.generationSource || null, generatedRange: spec.generated ? "13-30" : null, uiIcon: e.uiIcon }; };
export const buildCatCatalogEntry = (spec) => { const e = buildCatRosterEntry(spec); return { characterId: e.slotId, baseCharacterId: e.baseCharacterId, faction: e.faction, factionLabel: e.factionLabel, label: e.label, sourceKind: e.sourceKind, sourceRoster: e.sourceRoster, sourceSlotId: e.sourceSlotId, defaultCost: e.defaultCost, defaultCooldownMs: e.defaultCooldownMs, productionCostSource: e.productionCostSource, productionCooldownSource: e.productionCooldownSource, productionOverrides: e.productionOverrides, generated: spec.generated === true, generationSource: spec.generationSource || null, generatedRange: spec.generated ? "13-30" : null, uiIcon: e.uiIcon }; };

export const buildDogPreviewAsset = (spec, ANIM4_E) => { const bcuId = formatBcuId(spec.id); return { id: `enemy-${bcuId}`, label: spec.label, role: 'player-dog-candidate', group: 'dogs', renderMode: 'animated-unit', baseDir: `./public/assets/bcu/000002/org/enemy/${bcuId}/`, image: `${bcuId}_e.png`, imgcut: `${bcuId}_e.imgcut`, model: `${bcuId}_e.mamodel`, animations: ANIM4_E(`${bcuId}_e`) }; };
export const buildCatPreviewAsset = (spec, ANIM4_E) => { const bcuId = formatBcuId(spec.unitId); const form = spec.form ?? 'f'; return { id: `unit-${bcuId}-${form}`, label: spec.label, role: 'enemy-cat-candidate', group: 'cats', renderMode: 'animated-unit', baseDir: `./public/assets/bcu/000004/org/unit/${bcuId}/${form}/`, image: `${bcuId}_${form}.png`, imgcut: `${bcuId}_${form}.imgcut`, model: `${bcuId}_${form}.mamodel`, animations: ANIM4_E(`${bcuId}_${form}`) }; };

export const buildPlayableRosters = () => ({ dogPlayer: ALL_DOG_PLAYABLE_SPECS.map(buildDogRosterEntry), catUnits: ALL_CAT_PLAYABLE_SPECS.map(buildCatRosterEntry) });
export const buildCharacterCatalog = () => ([...ALL_DOG_PLAYABLE_SPECS.map(buildDogCatalogEntry), ...ALL_CAT_PLAYABLE_SPECS.map(buildCatCatalogEntry)]);
export const buildPlayablePreviewAssets = (ANIM4_E) => ([...ALL_DOG_PLAYABLE_SPECS.map((s) => buildDogPreviewAsset(s, ANIM4_E)), ...ALL_CAT_PLAYABLE_SPECS.map((s) => buildCatPreviewAsset(s, ANIM4_E))]);
export const getPlayableCharacterSpecs = () => ({ dogs: [...ALL_DOG_PLAYABLE_SPECS], cats: [...ALL_CAT_PLAYABLE_SPECS], manualDogs: [...DOG_PLAYABLE_SPECS], manualCats: [...CAT_PLAYABLE_SPECS], generatedDogs: [...GENERATED_DOG_PLAYABLE_SPECS], generatedCats: [...GENERATED_CAT_PLAYABLE_SPECS] });

export function getPlayableRegistrySummary() {
  return {
    version: PLAYABLE_REGISTRY_VERSION,
    manualDogs: DOG_PLAYABLE_SPECS.length,
    manualCats: CAT_PLAYABLE_SPECS.length,
    generatedDogs: GENERATED_DOG_PLAYABLE_SPECS.length,
    generatedCats: GENERATED_CAT_PLAYABLE_SPECS.length,
    totalDogs: ALL_DOG_PLAYABLE_SPECS.length,
    totalCats: ALL_CAT_PLAYABLE_SPECS.length
  };
}

export function validatePlayableRegistry() {
  const rosters = buildPlayableRosters();
  const ids = new Set();
  const dup = [];
  for (const x of [...rosters.dogPlayer, ...rosters.catUnits]) {
    if (ids.has(x.slotId)) dup.push(x.slotId);
    ids.add(x.slotId);
  }
  return { ok: dup.length === 0, duplicateSlotIds: dup, source: 'PlayableCharacterRegistry.validatePlayableRegistry' };
}
