import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FIXED_DATE, fileBufferOrNull, hashFile, readJson, writeJson, writeStoreZip } from './bcu-semantic-utils.mjs';

export const BCU_BATTLE_UI_BUNDLE_KEY = 'ui:battle';
export const BCU_BATTLE_UI_BUNDLE_PATH = 'public/assets/bundles/ui/battle-ui.zip';
export const BCU_BATTLE_UI_SOURCES = Object.freeze([
  { name: 'uni.png', source: 'public/assets/bcu/000001/org/page/uni.png', required: true, role: 'battle-production-card-sheet' },
  { name: 'uni.imgcut', source: 'public/assets/bcu/000001/org/data/uni.imgcut', required: true, role: 'battle-production-card-imgcut' },
  { name: 'img001.png', source: 'public/assets/bcu/000001/org/page/img001.png', required: true, role: 'battle-money-and-cost-digits-sheet' },
  { name: 'img001.imgcut', source: 'public/assets/bcu/000001/org/page/img001.imgcut', required: true, role: 'battle-money-and-cost-digits-imgcut' },
  { name: 'img002.png', source: 'public/assets/bcu/000001/org/page/img002.png', required: true, role: 'battle-worker-cat-and-cannon-button-sheet' },
  { name: 'img002.imgcut', source: 'public/assets/bcu/000001/org/page/img002.imgcut', required: true, role: 'battle-worker-cat-and-cannon-button-imgcut' },
  { name: 'moneySign.png', source: 'public/assets/bcu/110504/org/page/moneySign.png', required: true, role: 'battle-money-sign-sheet' },
  { name: 'moneySign.imgcut', source: 'public/assets/bcu/110504/org/page/moneySign.imgcut', required: true, role: 'battle-money-sign-imgcut' }
]);

const GENERATED_BUNDLE_MANIFEST_PATH = 'public/assets/generated/bcu-bundle-manifest.json';

function makeBundleJson(entries) {
  return Buffer.from(JSON.stringify({
    key: BCU_BATTLE_UI_BUNDLE_KEY,
    policy: 'semantic-strict runtime reads these Battle Cats/BCU UI assets from this bundle; no public/assets/bcu runtime fallback',
    source: 'public/assets/bcu',
    bcuReference: {
      productionCard: '000001/org/page/uni.png + 000001/org/data/uni.imgcut part[0]',
      moneyDigits: '000001/org/page/img001.png + 000001/org/page/img001.imgcut',
      workerCatButton: '000001/org/page/img002.png + 000001/org/page/img002.imgcut parts[5]=働きネコボタンOFF, parts[24]=点滅アニメ用, parts[6]=働きネコボタンON (Res.readBattle aux.battle[0][0/1/2])',
      moneySign: '110504/org/page/moneySign.png + 110504/org/page/moneySign.imgcut'
    },
    entries: entries.map(({ name, source, required, role, present }) => ({ name, source, required, role, present })),
    generatedAt: FIXED_DATE
  }, null, 2));
}

export async function rebuildBcuBattleUiBundle() {
  const files = [];
  const diagnostics = [];
  for (const entry of BCU_BATTLE_UI_SOURCES) {
    const data = await fileBufferOrNull(entry.source);
    diagnostics.push({ ...entry, present: !!data });
    if (entry.required && !data) throw new Error(`Cannot build ${BCU_BATTLE_UI_BUNDLE_KEY}; missing ${entry.source}`);
    files.push({ name: entry.name, data, required: entry.required });
    if (data) files.push({ name: `raw/${entry.source.split('/').slice(2).join('/')}`, data });
  }
  files.unshift({ name: 'bundle.json', data: makeBundleJson(diagnostics), required: true });
  await writeStoreZip(BCU_BATTLE_UI_BUNDLE_PATH, files.filter((f) => f.data != null));
  const stat = await fs.stat(BCU_BATTLE_UI_BUNDLE_PATH);
  const manifest = await readJson(GENERATED_BUNDLE_MANIFEST_PATH, { schemaVersion: 1, generatedAt: FIXED_DATE, zipFormat: 'store-only', bundles: {} });
  manifest.bundles ||= {};
  manifest.bundles[BCU_BATTLE_UI_BUNDLE_KEY] = {
    kind: 'ui',
    key: BCU_BATTLE_UI_BUNDLE_KEY,
    bundlePath: BCU_BATTLE_UI_BUNDLE_PATH,
    status: 'full',
    sizeBytes: stat.size,
    hash: await hashFile(BCU_BATTLE_UI_BUNDLE_PATH)
  };
  await writeJson(GENERATED_BUNDLE_MANIFEST_PATH, manifest);
  return { bundlePath: BCU_BATTLE_UI_BUNDLE_PATH, entries: files.filter((f) => f.data != null).map((f) => f.name), sizeBytes: stat.size, hash: manifest.bundles[BCU_BATTLE_UI_BUNDLE_KEY].hash };
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) console.log(JSON.stringify(await rebuildBcuBattleUiBundle(), null, 2));
