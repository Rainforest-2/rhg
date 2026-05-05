export const CHARACTER_CATALOG_VERSION = '0.11.1';

export const CHARACTER_FACTIONS = Object.freeze({
  all: 'all',
  dog: 'dog',
  cat: 'cat'
});

export const CHARACTER_CATALOG = Object.freeze([
  {
    characterId: 'dog-wanko', faction: 'dog', factionLabel: 'ワンコ軍', label: 'ワンコ',
    sourceRoster: 'dogPlayer', sourceSlotId: 'dog-wanko', defaultCost: 50, defaultCooldownMs: 2000, productionCostSource: 'catalog', productionCooldownSource: 'catalog',
    productionOverrides: { side: 'dog-player', direction: -1, facing: -1 },
    uiIcon: { kind: 'enemy', bcuId: '000', primary: './public/assets/bcu/000010/org/enemy/000/enemy_icon_000.png', fallback: './public/assets/bcu/000002/org/enemy/000/edi_000.png' }
  },
  {
    characterId: 'dog-nyoro', faction: 'dog', factionLabel: 'ワンコ軍', label: 'ニョロ',
    sourceRoster: 'dogPlayer', sourceSlotId: 'dog-nyoro', defaultCost: 75, defaultCooldownMs: 2800, productionCostSource: 'catalog', productionCooldownSource: 'catalog',
    productionOverrides: { side: 'dog-player', direction: -1, facing: -1 },
    uiIcon: { kind: 'enemy', bcuId: '001', primary: './public/assets/bcu/000010/org/enemy/001/enemy_icon_001.png', fallback: './public/assets/bcu/000002/org/enemy/001/edi_001.png' }
  },
  {
    characterId: 'dog-rei', faction: 'dog', factionLabel: 'ワンコ軍', label: '例のヤツ',
    sourceRoster: 'dogPlayer', sourceSlotId: 'dog-rei', defaultCost: 100, defaultCooldownMs: 3500, productionCostSource: 'catalog', productionCooldownSource: 'catalog',
    productionOverrides: { side: 'dog-player', direction: -1, facing: -1 },
    uiIcon: { kind: 'enemy', bcuId: '002', primary: './public/assets/bcu/000010/org/enemy/002/enemy_icon_002.png', fallback: './public/assets/bcu/000002/org/enemy/002/edi_002.png' }
  },
  {
    characterId: 'cat-basic', faction: 'cat', factionLabel: 'ネコ軍', label: 'ネコ',
    sourceRoster: 'catUnits', sourceSlotId: 'cat-basic', defaultCost: 75, defaultCooldownMs: 2500, productionCostSource: 'bcu-unit-stats', productionCooldownSource: 'bcu-unit-stats',
    productionOverrides: { side: 'dog-player', direction: -1, facing: -1, renderFlipX: false },
    uiIcon: { kind: 'unit', bcuId: '000', primary: './public/assets/bcu/000004/org/unit/000/f/uni000_f00.png', fallback: './public/assets/bcu/000004/org/unit/000/f/000_f.png' }
  },
  {
    characterId: 'cat-tank', faction: 'cat', factionLabel: 'ネコ軍', label: 'タンクネコ',
    sourceRoster: 'catUnits', sourceSlotId: 'cat-tank', defaultCost: 100, defaultCooldownMs: 3500, productionCostSource: 'bcu-unit-stats', productionCooldownSource: 'bcu-unit-stats',
    productionOverrides: { side: 'dog-player', direction: -1, facing: -1, renderFlipX: false },
    uiIcon: { kind: 'unit', bcuId: '001', primary: './public/assets/bcu/000004/org/unit/001/f/uni001_f00.png', fallback: './public/assets/bcu/000004/org/unit/001/f/001_f.png' }
  },
  {
    characterId: 'cat-battle', faction: 'cat', factionLabel: 'ネコ軍', label: 'バトルネコ',
    sourceRoster: 'catUnits', sourceSlotId: 'cat-battle', defaultCost: 150, defaultCooldownMs: 3200, productionCostSource: 'bcu-unit-stats', productionCooldownSource: 'bcu-unit-stats',
    productionOverrides: { side: 'dog-player', direction: -1, facing: -1, renderFlipX: false },
    uiIcon: { kind: 'unit', bcuId: '002', primary: './public/assets/bcu/000004/org/unit/002/f/uni002_f00.png', fallback: './public/assets/bcu/000004/org/unit/002/f/002_f.png' }
  }
]);

export function getCharacterById(characterId) { return CHARACTER_CATALOG.find((c) => c.characterId === characterId) || null; }
export function getCharactersByFaction(faction) { if (!faction || faction === CHARACTER_FACTIONS.all) return [...CHARACTER_CATALOG]; return CHARACTER_CATALOG.filter((c) => c.faction === faction); }
export function getAvailableCharacters() { return [...CHARACTER_CATALOG]; }
export function buildProductionLineupEntryFromCharacter(character, slotIndex = 0) {
  if (!character) return null;
  return { slotId: `prod-${character.characterId || slotIndex}`, characterId: character.characterId };
}
