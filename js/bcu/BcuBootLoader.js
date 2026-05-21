import { BcuAssetDatabase, BcuAssetSetRepository, setBcuAssetDatabase } from './BcuAssetDatabase.js';
import { createBcuDiagnostics } from './BcuDiagnostics.js';
import { BcuManifestLoader, readText } from './BcuManifestLoader.js';
import { BcuLangStore } from './BcuLangStore.js';
import { BcuUnitRepository } from './BcuUnitRepository.js';
import { BcuEnemyRepository } from './BcuEnemyRepository.js';
import { BcuBackgroundRepository } from './BcuBackgroundRepository.js';
import { BcuCastleRepository } from './BcuCastleRepository.js';
import { BcuStageRepository } from './BcuStageRepository.js';
import { SemanticAssetProvider } from './SemanticAssetProvider.js';
import { installRuntimeRawBcuGuard } from './RuntimeAssetGuard.js';

export { setBcuAssetDatabase } from './BcuAssetDatabase.js';

export class BcuBootLoader {
  static async loadGame({
    assetRoot = './public/assets',
    bcuRoot = null,
    manifestPath = null,
    locale = 'jp',
    preloadMode = 'metadata-and-current-battle',
    semanticMode = 'semantic-strict'
  } = {}) {
    const diagnostics = createBcuDiagnostics();
    const semanticProvider = new SemanticAssetProvider({
      mode: semanticMode,
      allowRawFallback: semanticMode === 'raw-only-diagnostics'
    });
    await semanticProvider.load();
    installRuntimeRawBcuGuard({ mode: semanticMode, provider: semanticProvider });

    if (semanticMode !== 'raw-only-diagnostics') {
      const coreDb = await semanticProvider.readCoreDb();
      const manifest = {
        ...(coreDb.manifestLite || {}),
        assetRoot,
        bcuRoot: null,
        preloadMode,
        semanticMode,
        semanticIndexes: semanticProvider.indexes,
        files: coreDb.manifestLite?.files || [],
        packs: coreDb.manifestLite?.packs || {}
      };
      const names = BcuLangStore.fromCoreDb(coreDb, { locale, diagnostics });
      const languageMerge = await names.mergeFromSemanticLanguageBundle(semanticProvider, locale);
      diagnostics.lang.semanticLanguageMerge = languageMerge;
      const enemies = BcuEnemyRepository.fromCoreDb(coreDb, { manifest, names, diagnostics, locale });
      const units = BcuUnitRepository.fromCoreDb(coreDb, { manifest, names, diagnostics, locale });
      const backgrounds = BcuBackgroundRepository.fromCoreDb(coreDb, { manifest, names, diagnostics, locale });
      const castles = BcuCastleRepository.fromCoreDb(coreDb, { manifest, names, diagnostics, locale });
      const stages = BcuStageRepository.fromCoreDb(coreDb, { manifest, names, diagnostics, enemies, backgrounds, castles, locale });
      const assets = new BcuAssetSetRepository({ units, enemies, backgrounds, castles });
      const playable = await this.loadPlayableErrorConfig({ readText });
      const db = new BcuAssetDatabase({ locale, manifest, names, units, enemies, backgrounds, castles, stages, assets, diagnostics, playable, semanticProvider });
      setBcuAssetDatabase(db);
      return db;
    }

    // raw-only-diagnostics: default semantic-strict returns above after core-db boot.
    const manifest = await BcuManifestLoader.load({ manifestPath: manifestPath || './public/assets/bcu-manifest.json', mode: semanticMode });
    manifest.assetRoot = manifest.assetRoot || assetRoot;
    manifest.bcuRoot = manifest.bcuRoot || bcuRoot || './public/assets/bcu';
    manifest.preloadMode = preloadMode;
    manifest.semanticMode = semanticMode;
    manifest.semanticIndexes = semanticProvider.indexes;

    const names = new BcuLangStore({ locale, diagnostics });
    await names.loadFromManifest(manifest, readText);

    const enemies = await new BcuEnemyRepository({ manifest, names, diagnostics, readText, locale }).build();
    const units = await new BcuUnitRepository({ manifest, names, diagnostics, readText, locale }).build();
    const backgrounds = await new BcuBackgroundRepository({ manifest, names, diagnostics, readText, locale }).build();
    const castles = new BcuCastleRepository({ manifest, names, diagnostics, readText, locale }).build();
    const stages = await new BcuStageRepository({ manifest, names, diagnostics, readText, enemies, backgrounds, castles, locale }).build();
    const assets = new BcuAssetSetRepository({ units, enemies, backgrounds, castles });
    const playable = await this.loadPlayableErrorConfig({ readText });

    const db = new BcuAssetDatabase({ locale, manifest, names, units, enemies, backgrounds, castles, stages, assets, diagnostics, playable, semanticProvider });
    setBcuAssetDatabase(db);
    return db;
  }

  static async loadPlayableErrorConfig({ readText }) {
    const readJson = async (path) => {
      try { return JSON.parse(await readText(path)); } catch { return null; }
    };
    const enemy = await readJson('error-enemy.json');
    const ally = await readJson('error-ally.json');
    const enemyDisplayIds = Array.isArray(enemy?.missingEnemyIds) ? enemy.missingEnemyIds : [];
    const allyDisplayIds = Array.isArray(ally?.missingAllyIds) ? ally.missingAllyIds : [];
    return {
      enemies: {
        sourceFile: enemy ? 'error-enemy.json' : null,
        displayIds: enemyDisplayIds,
        excludedAssetIds: enemyDisplayIds.map((id) => Number(id) - 2).filter((id) => Number.isInteger(id) && id >= 0)
      },
      allies: {
        sourceFile: ally ? 'error-ally.json' : null,
        displayIds: allyDisplayIds,
        excludedAssetIds: allyDisplayIds.map((id) => Number(id) - 1).filter((id) => Number.isInteger(id) && id >= 0)
      }
    };
  }
}
