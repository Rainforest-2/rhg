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

export { setBcuAssetDatabase } from './BcuAssetDatabase.js';

export class BcuBootLoader {
  static async loadGame({
    assetRoot = './public/assets',
    bcuRoot = './public/assets/bcu',
    manifestPath = './public/assets/bcu-manifest.json',
    locale = 'jp',
    preloadMode = 'metadata-and-current-battle',
    semanticMode = 'semantic-with-raw-fallback'
  } = {}) {
    const diagnostics = createBcuDiagnostics();
    const manifest = await BcuManifestLoader.load({ manifestPath });
    manifest.assetRoot = manifest.assetRoot || assetRoot;
    manifest.bcuRoot = manifest.bcuRoot || bcuRoot;
    manifest.preloadMode = preloadMode;
    manifest.semanticMode = semanticMode;
    const semanticProvider = new SemanticAssetProvider({
      mode: semanticMode,
      allowRawFallback: semanticMode === 'semantic-with-raw-fallback'
    });
    await semanticProvider.load();
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
