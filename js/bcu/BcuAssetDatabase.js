import { countDiagnostics } from './BcuDiagnostics.js';

let activeBcuAssetDatabase = null;

export function setBcuAssetDatabase(db) {
  activeBcuAssetDatabase = db;
  if (typeof window !== 'undefined') window.__BCU_DB__ = db;
  if (typeof globalThis !== 'undefined') globalThis.__BCU_DB__ = db;
}

export function getBcuAssetDatabase() {
  if (!activeBcuAssetDatabase) {
    throw new Error('BCU asset database is not loaded. Call BcuBootLoader.loadGame() before accessing assets.');
  }
  return activeBcuAssetDatabase;
}

export class BcuAssetSetRepository {
  constructor({ units, enemies, backgrounds, castles }) {
    this.units = units;
    this.enemies = enemies;
    this.backgrounds = backgrounds;
    this.castles = castles;
  }
  resolveUnitAsset(unitId, form = 'f') { return this.units.getForm(unitId, form)?.asset || null; }
  resolveEnemyAsset(enemyId) { return this.enemies.get(enemyId)?.asset || null; }
  resolveBackgroundAsset(bgId) { return this.backgrounds.get(bgId)?.assets || null; }
  resolveEnemyCastleAsset(castleId) { return this.castles.enemy.get(castleId)?.assets || null; }
  resolveAssetSet(kind, id, form) {
    if (kind === 'unit') return this.resolveUnitAsset(id, form);
    if (kind === 'enemy') return this.resolveEnemyAsset(id);
    if (kind === 'background') return this.resolveBackgroundAsset(id);
    if (kind === 'enemyCastle') return this.resolveEnemyCastleAsset(id);
    return null;
  }
}

export class BcuAssetDatabase {
  constructor({ locale, manifest, names, units, enemies, backgrounds, castles, stages, assets, diagnostics, playable }) {
    this.ready = true;
    this.locale = locale;
    this.manifest = manifest;
    this.packs = manifest?.packs || {};
    this.names = names;
    this.units = units;
    this.enemies = enemies;
    this.backgrounds = backgrounds;
    this.castles = castles;
    this.stages = stages;
    this.assets = assets;
    this.diagnostics = diagnostics;
    this.playable = playable || { enemies: { excludedAssetIds: [] }, allies: { excludedAssetIds: [] } };
  }

  getSummary() {
    const diag = countDiagnostics(this.diagnostics);
    return {
      ready: this.ready,
      locale: this.locale,
      counts: {
        files: this.manifest?.files?.length || 0,
        packs: Object.keys(this.manifest?.packs || {}).length,
        locales: this.names.loadedLocales.length,
        units: this.units.list().length,
        enemies: this.enemies.list().length,
        stages: this.stages.list().length,
        backgrounds: this.backgrounds.list().length,
        enemyCastles: this.castles.enemy.list().length,
        nyankoCastleParts: this.castles.nyanko.list().length
      },
      playable: {
        enemyExcluded: this.playable?.enemies?.excludedAssetIds?.length || 0,
        allyExcluded: this.playable?.allies?.excludedAssetIds?.length || 0
      },
      diagnostics: diag,
      fallbackCounts: {
        names: this.diagnostics.lang.missingNames.length,
        unitNames: this.diagnostics.units.missingNames.length,
        enemyNames: this.diagnostics.enemies.missingNames.length,
        backgroundNames: this.diagnostics.backgrounds.missingNames.length,
        castleNames: this.diagnostics.castles.missingNames.length,
        stageNames: this.diagnostics.stages.missingNames.length
      }
    };
  }
}
