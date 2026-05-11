import fs from 'node:fs/promises';
import path from 'node:path';

const roots = ['js'];
const allowedFiles = new Set([
  'js/battle/BattleEffectLoader.js',
  'js/battle/BattleConfig.js',
  'js/battle/BcuAssetVerifier.js',
  'js/battle/BcuKbeffLoader.js',
  'js/battle/BcuStageEnemyResolver.js',
  'js/battle/PlayableCharacterRegistry.js',
  'js/battle/StageBackgroundLoader.js',
  'js/battle/StageRuntimeVerifier.js',
  'js/bcu/BcuEnemyRepository.js',
  'js/bcu/BcuModelTransformParityVerifier.js',
  'js/bcu/BcuPathResolver.js',
  'js/bcu/BcuUnitRepository.js',
  'js/data/previewAssets.js',
  'js/data/bcuStageManifest.js',
  'js/ui/ProductionCardSkin.js',
  'js/ui/ProductionCardSkinVerifier.js',
  'js/ui/BcuSpriteText.js'
]);
const errors = [];

async function walk(dir, out = []) {
  for (const ent of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name).replace(/\\/g, '/');
    if (ent.isDirectory()) await walk(full, out);
    else if (ent.isFile() && full.endsWith('.js')) out.push(full);
  }
  return out;
}

function guarded(text, idx) {
  const near = text.slice(Math.max(0, idx - 320), Math.min(text.length, idx + 320));
  return /allowRawFallback|semantic-with-raw-fallback|legacy-raw|migration fallback|fallback/i.test(near);
}

for (const root of roots) {
  for (const file of await walk(root)) {
    const text = await fs.readFile(file, 'utf8');
    const patterns = [/\.\/public\/assets\/bcu\//g, /public\/assets\/bcu\/00000[124]/g, /stageCsvPath:\s*['"`]\.\/public\/assets\/bcu\//g, /baseDir:\s*['"`]\.\/public\/assets\/bcu\//g, /fetch\(\s*['"`]\.\/public\/assets\/bcu\//g, /new Image\(\)\.src\s*=\s*['"`]\.\/public\/assets\/bcu\//g];
    for (const re of patterns) {
      for (const m of text.matchAll(re)) {
        if (allowedFiles.has(file) || guarded(text, m.index || 0)) continue;
        errors.push(`${file}: raw BCU runtime path is not guarded near "${m[0]}"`);
      }
    }
  }
}
if (errors.length) {
  console.error(errors.slice(0, 80).join('\n'));
  if (errors.length > 80) console.error(`... ${errors.length - 80} more`);
  process.exit(1);
}
console.log('raw runtime path check ok');
