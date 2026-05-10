import { buildCharacterCatalog } from './PlayableCharacterRegistry.js';
import { CharacterCatalogRuntime } from './CharacterCatalogRuntime.js';

export const CHARACTER_CATALOG_VERSION = '0.13.1';
export const CHARACTER_FACTIONS = Object.freeze({ all: 'all', dog: 'dog', cat: 'cat' });
export const CHARACTER_CATALOG = Object.freeze(buildCharacterCatalog());

function activeCatalog() {
  const db = globalThis.__BCU_DB__ || null;
  return db ? buildCharacterCatalog({ bcuDb: db, locale: db.locale }) : CHARACTER_CATALOG;
}

export function getCharacterById(characterId) { return activeCatalog().find((c) => c.characterId === characterId) || null; }
export function getCharactersByFaction(faction) { const catalog = activeCatalog(); if (!faction || faction === CHARACTER_FACTIONS.all) return [...catalog]; return catalog.filter((c) => c.faction === faction); }
export function getAvailableCharacters() { return [...activeCatalog()]; }
export function buildProductionLineupEntryFromCharacter(character, slotIndex = 0) { if (!character) return null; return { slotId: `prod-${character.characterId || slotIndex}`, characterId: character.characterId }; }
export function getCharacterBaseId(characterOrId) {
  if (characterOrId && typeof characterOrId === 'object') return characterOrId.baseCharacterId || characterOrId.characterId || null;
  if (typeof characterOrId === 'string') { const c = getCharacterById(characterOrId); return c ? (c.baseCharacterId || c.characterId || null) : null; }
  return null;
}
export function isSameBaseCharacter(a, b) { const aa = getCharacterBaseId(a); const bb = getCharacterBaseId(b); return !!aa && !!bb && aa === bb; }


export function isGeneratedCharacter(characterOrId) {
  return false;
}
export function getCharacterCatalogSummary() { return CharacterCatalogRuntime.summarizeCatalog(activeCatalog()); }
export function validateCharacterCatalog() { return CharacterCatalogRuntime.validateCatalog(activeCatalog()); }
export function getCharacterCatalogDiagnostics() { return CharacterCatalogRuntime.buildCatalogDiagnostics({ catalog: activeCatalog() }); }
