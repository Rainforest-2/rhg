import { buildCharacterCatalog } from './PlayableCharacterRegistry.js';
import { CharacterCatalogRuntime } from './CharacterCatalogRuntime.js';

export const CHARACTER_CATALOG_VERSION = '0.13.1';
export const CHARACTER_FACTIONS = Object.freeze({ all: 'all', dog: 'dog', cat: 'cat' });
export const CHARACTER_CATALOG = Object.freeze(buildCharacterCatalog());

let memoDb = null;
let memoLocale = null;
let memoRevision = null;
let memoCatalog = CHARACTER_CATALOG;
let memoIndexes = buildIndexes(CHARACTER_CATALOG);

function catalogRevision(db) {
  return db?.catalogRevision || db?.manifest?.generatedAt || db?.manifest?.schemaVersion || db?.semanticProvider?.indexes?.bundleManifest?.generatedAt || null;
}

function buildIndexes(catalog) {
  const byId = new Map();
  const byFaction = new Map();
  const byBaseId = new Map();
  const available = [...catalog];
  for (const c of catalog) {
    byId.set(c.characterId, c);
    const faction = c.faction || CHARACTER_FACTIONS.all;
    if (!byFaction.has(faction)) byFaction.set(faction, []);
    byFaction.get(faction).push(c);
    const baseId = c.baseCharacterId || c.characterId;
    if (baseId && !byBaseId.has(baseId)) byBaseId.set(baseId, []);
    if (baseId) byBaseId.get(baseId).push(c);
  }
  return { byId, byFaction, byBaseId, available };
}

function activeCatalog() {
  const db = globalThis.__BCU_DB__ || null;
  if (!db) {
    memoCatalog = CHARACTER_CATALOG;
    memoIndexes = memoIndexes || buildIndexes(CHARACTER_CATALOG);
    return memoCatalog;
  }
  const locale = db.locale || 'jp';
  const revision = catalogRevision(db);
  if (memoDb !== db || memoLocale !== locale || memoRevision !== revision) {
    memoDb = db;
    memoLocale = locale;
    memoRevision = revision;
    memoCatalog = Object.freeze(buildCharacterCatalog({ bcuDb: db, locale }));
    memoIndexes = buildIndexes(memoCatalog);
  }
  return memoCatalog;
}

function activeIndexes() { activeCatalog(); return memoIndexes; }

export function getCharacterById(characterId) { return activeIndexes().byId.get(characterId) || null; }
export function getCharactersByFaction(faction) { const ix = activeIndexes(); if (!faction || faction === CHARACTER_FACTIONS.all) return [...ix.available]; return [...(ix.byFaction.get(faction) || [])]; }
export function getAvailableCharacters() { return [...activeIndexes().available]; }
export function buildProductionLineupEntryFromCharacter(character, slotIndex = 0) { if (!character) return null; return { slotId: `prod-${character.characterId || slotIndex}`, characterId: character.characterId }; }
export function getCharacterBaseId(characterOrId) {
  if (characterOrId && typeof characterOrId === 'object') return characterOrId.baseCharacterId || characterOrId.characterId || null;
  if (typeof characterOrId === 'string') { const c = activeIndexes().byId.get(characterOrId); return c ? (c.baseCharacterId || c.characterId || null) : null; }
  return null;
}
export function isSameBaseCharacter(a, b) { const aa = getCharacterBaseId(a); const bb = getCharacterBaseId(b); return !!aa && !!bb && aa === bb; }


export function isGeneratedCharacter(characterOrId) {
  return false;
}
export function getCharacterCatalogSummary() { return CharacterCatalogRuntime.summarizeCatalog(activeCatalog()); }
export function validateCharacterCatalog() { return CharacterCatalogRuntime.validateCatalog(activeCatalog()); }
export function getCharacterCatalogDiagnostics() { return CharacterCatalogRuntime.buildCatalogDiagnostics({ catalog: activeCatalog() }); }
