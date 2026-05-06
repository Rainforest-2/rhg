export const PLAYABLE_REGISTRY_VERSION = '0.12.0';
export const DOG_DEFAULT_COST = 100;

export function formatBcuId(id) {
  return String(Number(id) || 0).padStart(3, '0');
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
  { id: 8, characterId: 'dog-enemy-008', label: '敵008', cooldownMs: 3500 }
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
  { unitId: 8, characterId: 'cat-titan', label: '巨神ネコ', baseCharacterId: 'cat-titan', defaultCost: 1950, defaultCooldownMs: 7000, collisionRadius: 50, scale: 1.12 }
]);

export function buildDogRosterEntry(spec) { const bcuId = formatBcuId(spec.id); const cooldownMs = spec.cooldownMs ?? 3500; return { slotId: spec.characterId, baseCharacterId: spec.characterId, label: spec.label, assetId: `enemy-${bcuId}`, statsType: 'enemy', statsId: spec.id, faction: 'dog', factionLabel: 'ワンコ軍', sourceKind: 'enemy', sourceRoster: 'dogPlayer', sourceSlotId: spec.characterId, cost: DOG_DEFAULT_COST, defaultCost: DOG_DEFAULT_COST, cooldownMs, defaultCooldownMs: cooldownMs, productionCostSource: 'catalog', productionCooldownSource: 'catalog', side: 'dog-player', direction: -1, facing: -1, renderFlipX: true, collisionRadius: 46, scale: 1.12, idleAnimId: 'anim01', moveAnimId: 'anim00', attackAnimId: 'anim02', knockbackAnimId: 'anim03', economySource: 'provisional-design', ...(spec.combatPositionOffsetPx !== undefined ? { combatPositionOffsetPx: spec.combatPositionOffsetPx } : {}), ...(spec.combatEdgeInsetPx !== undefined ? { combatEdgeInsetPx: spec.combatEdgeInsetPx } : {}), ...(spec.combatPositionSource ? { combatPositionSource: spec.combatPositionSource } : {}), uiIcon: { kind: 'enemy', bcuId, primary: `./public/assets/bcu/000010/org/enemy/${bcuId}/enemy_icon_${bcuId}.png`, fallback: `./public/assets/bcu/000002/org/enemy/${bcuId}/edi_${bcuId}.png` } }; }
export function buildCatRosterEntry(spec) { const bcuId = formatBcuId(spec.unitId); const form = spec.form ?? 'f'; return { slotId: spec.characterId, baseCharacterId: spec.baseCharacterId, label: spec.label, assetId: `unit-${bcuId}-${form}`, statsType: 'unit', statsId: spec.unitId, formRow: 0, faction: 'cat', factionLabel: 'ネコ軍', sourceKind: 'unit', sourceRoster: 'catUnits', sourceSlotId: spec.characterId, defaultCost: spec.defaultCost, defaultCooldownMs: spec.defaultCooldownMs, productionCostSource: 'bcu-unit-stats', productionCooldownSource: 'bcu-unit-stats', side: 'cat-enemy', direction: 1, facing: 1, renderFlipX: true, productionOverrides: { side: 'dog-player', direction: -1, facing: -1, renderFlipX: false }, collisionRadius: spec.collisionRadius, scale: spec.scale, idleAnimId: 'anim01', moveAnimId: 'anim00', attackAnimId: 'anim02', knockbackAnimId: 'anim03', uiIcon: { kind: 'unit', bcuId, primary: `./public/assets/bcu/000004/org/unit/${bcuId}/${form}/uni${bcuId}_${form}00.png`, fallback: `./public/assets/bcu/000004/org/unit/${bcuId}/${form}/${bcuId}_${form}.png` } }; }
export const buildDogCatalogEntry = (spec) => { const e = buildDogRosterEntry(spec); return { characterId: e.slotId, baseCharacterId: e.baseCharacterId, faction: e.faction, factionLabel: e.factionLabel, label: e.label, sourceKind: e.sourceKind, sourceRoster: e.sourceRoster, sourceSlotId: e.sourceSlotId, defaultCost: e.defaultCost, defaultCooldownMs: e.defaultCooldownMs, productionCostSource: e.productionCostSource, productionCooldownSource: e.productionCooldownSource, productionOverrides: { side: e.side, direction: e.direction, facing: e.facing, renderFlipX: e.renderFlipX }, uiIcon: e.uiIcon }; };
export const buildCatCatalogEntry = (spec) => { const e = buildCatRosterEntry(spec); return { characterId: e.slotId, baseCharacterId: e.baseCharacterId, faction: e.faction, factionLabel: e.factionLabel, label: e.label, sourceKind: e.sourceKind, sourceRoster: e.sourceRoster, sourceSlotId: e.sourceSlotId, defaultCost: e.defaultCost, defaultCooldownMs: e.defaultCooldownMs, productionCostSource: e.productionCostSource, productionCooldownSource: e.productionCooldownSource, productionOverrides: e.productionOverrides, uiIcon: e.uiIcon }; };

export const buildDogPreviewAsset = (spec, ANIM4_E) => { const bcuId = formatBcuId(spec.id); return { id: `enemy-${bcuId}`, label: spec.label, role: 'player-dog-candidate', group: 'dogs', renderMode: 'animated-unit', baseDir: `./public/assets/bcu/000002/org/enemy/${bcuId}/`, image: `${bcuId}_e.png`, imgcut: `${bcuId}_e.imgcut`, model: `${bcuId}_e.mamodel`, animations: ANIM4_E(`${bcuId}_e`) }; };
export const buildCatPreviewAsset = (spec, ANIM4_E) => { const bcuId = formatBcuId(spec.unitId); const form = spec.form ?? 'f'; return { id: `unit-${bcuId}-${form}`, label: spec.label, role: 'enemy-cat-candidate', group: 'cats', renderMode: 'animated-unit', baseDir: `./public/assets/bcu/000004/org/unit/${bcuId}/${form}/`, image: `${bcuId}_${form}.png`, imgcut: `${bcuId}_${form}.imgcut`, model: `${bcuId}_${form}.mamodel`, animations: ANIM4_E(`${bcuId}_${form}`) }; };

export const buildPlayableRosters = () => ({ dogPlayer: DOG_PLAYABLE_SPECS.map(buildDogRosterEntry), catUnits: CAT_PLAYABLE_SPECS.map(buildCatRosterEntry) });
export const buildCharacterCatalog = () => ([...DOG_PLAYABLE_SPECS.map(buildDogCatalogEntry), ...CAT_PLAYABLE_SPECS.map(buildCatCatalogEntry)]);
export const buildPlayablePreviewAssets = (ANIM4_E) => ([...DOG_PLAYABLE_SPECS.map((s) => buildDogPreviewAsset(s, ANIM4_E)), ...CAT_PLAYABLE_SPECS.map((s) => buildCatPreviewAsset(s, ANIM4_E))]);
export const getPlayableCharacterSpecs = () => ({ dogs: [...DOG_PLAYABLE_SPECS], cats: [...CAT_PLAYABLE_SPECS] });
