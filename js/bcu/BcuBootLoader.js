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
import { createProgressReporter, progressInBand } from './ProgressReporter.js';

export { setBcuAssetDatabase } from './BcuAssetDatabase.js';

const SEMANTIC_INDEX_PROGRESS = Object.freeze({ start: 0.02, span: 0.28, end: 0.3 });

export class BcuBootLoader {
  static async loadGame({
    assetRoot = './public/assets',
    bcuRoot = null,
    manifestPath = null,
    locale = 'jp',
    preloadMode = 'metadata-and-current-battle',
    semanticMode = 'semantic-strict',
    onProgress = null
  } = {}) {
    const report = createProgressReporter(onProgress, 'BcuBootLoader');
    const diagnostics = createBcuDiagnostics();
    const semanticProvider = new SemanticAssetProvider({
      mode: semanticMode,
      allowRawFallback: semanticMode === 'raw-only-diagnostics'
    });
    report(SEMANTIC_INDEX_PROGRESS.start);
    // Index fetches (9 files) report into the 0.02–0.30 band, one notch each.
    await semanticProvider.load({ onProgress: (f) => report(progressInBand(SEMANTIC_INDEX_PROGRESS.start, SEMANTIC_INDEX_PROGRESS.span, f)) });
    report(SEMANTIC_INDEX_PROGRESS.end);
    installRuntimeRawBcuGuard({ mode: semanticMode, provider: semanticProvider });

    if (semanticMode !== 'raw-only-diagnostics') {
      const coreDb = await semanticProvider.readCoreDb();
      report(0.5);
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
      const enemies = BcuEnemyRepository.fromCoreDb(coreDb, { manifest, names, diagnostics, locale });
      report(0.62);
      const units = BcuUnitRepository.fromCoreDb(coreDb, { manifest, names, diagnostics, locale });
      report(0.72);
      const backgrounds = BcuBackgroundRepository.fromCoreDb(coreDb, { manifest, names, diagnostics, locale });
      const castles = BcuCastleRepository.fromCoreDb(coreDb, { manifest, names, diagnostics, locale });
      report(0.8);
      const stages = BcuStageRepository.fromCoreDb(coreDb, { manifest, names, diagnostics, enemies, backgrounds, castles, locale });
      report(0.9);
      const assets = new BcuAssetSetRepository({ units, enemies, backgrounds, castles });
      const playable = await this.loadPlayableErrorConfig({ readText });
      const db = new BcuAssetDatabase({ locale, manifest, names, units, enemies, backgrounds, castles, stages, assets, diagnostics, playable, semanticProvider });
      setBcuAssetDatabase(db);
      report(1);
      return db;
    }

    // raw-only-diagnostics: default semantic-strict returns above after core-db boot.
    const manifest = await BcuManifestLoader.load({ manifestPath: manifestPath || './public/assets/bcu-manifest.json', mode: semanticMode });
    report(0.42);
    manifest.assetRoot = manifest.assetRoot || assetRoot;
    manifest.bcuRoot = manifest.bcuRoot || bcuRoot || './public/assets/bcu';
    manifest.preloadMode = preloadMode;
    manifest.semanticMode = semanticMode;
    manifest.semanticIndexes = semanticProvider.indexes;

    const names = new BcuLangStore({ locale, diagnostics });
    await names.loadFromManifest(manifest, readText);
    report(0.52);

    const enemies = await new BcuEnemyRepository({ manifest, names, diagnostics, readText, locale }).build();
    report(0.62);
    const units = await new BcuUnitRepository({ manifest, names, diagnostics, readText, locale }).build();
    report(0.72);
    const backgrounds = await new BcuBackgroundRepository({ manifest, names, diagnostics, readText, locale }).build();
    const castles = new BcuCastleRepository({ manifest, names, diagnostics, readText, locale }).build();
    report(0.82);
    const stages = await new BcuStageRepository({ manifest, names, diagnostics, readText, enemies, backgrounds, castles, locale }).build();
    report(0.92);
    const assets = new BcuAssetSetRepository({ units, enemies, backgrounds, castles });
    const playable = await this.loadPlayableErrorConfig({ readText });

    const db = new BcuAssetDatabase({ locale, manifest, names, units, enemies, backgrounds, castles, stages, assets, diagnostics, playable, semanticProvider });
    setBcuAssetDatabase(db);
    report(1);
    return db;
  }

  static async loadPlayableErrorConfig({ readText }) {
    const readJson = async (path) => {
      try {
        return { value: JSON.parse(await readText(path)), error: null };
      } catch (error) {
        return { value: null, error: { path, reason: error?.message || String(error) } };
      }
    };
    const enemyRead = await readJson('error-enemy.json');
    const allyRead = await readJson('error-ally.json');
    const enemy = enemyRead.value;
    const ally = allyRead.value;
    const enemyDisplayIds = Array.isArray(enemy?.missingEnemyIds) ? enemy.missingEnemyIds : [];
    const allyDisplayIds = Array.isArray(ally?.missingAllyIds) ? ally.missingAllyIds : [];
    return {
      errors: [enemyRead.error, allyRead.error].filter(Boolean),
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
