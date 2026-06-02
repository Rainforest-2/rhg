import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FIXED_DATE, fileBufferOrNull, hashFile, readJson, writeJson, writeStoreZip } from './bcu-semantic-utils.mjs';

export const EFFECT_SOUL_BUNDLE_KEY = 'effect:soul';
export const EFFECT_SOUL_BUNDLE_PATH = 'public/assets/bundles/effect/soul.zip';
const GENERATED_BUNDLE_MANIFEST_PATH = 'public/assets/generated/bcu-bundle-manifest.json';

function normalizePath(p) {
  return String(p || '').replace(/\\/g, '/').replace(/^\.\//, '');
}

function normalSoul(id) {
  const id3 = String(id).padStart(3, '0');
  const dir = `public/assets/bcu/000001/org/battle/soul/${id3}`;
  return {
    key: `soul-${id3}`,
    role: 'bcu-Soul',
    sourceDir: dir,
    entries: [
      { name: `soul-${id3}/image.png`, source: `battle_soul_${id3}.png`, required: true },
      { name: `soul-${id3}/imgcut.imgcut`, source: `battle_soul_${id3}.imgcut`, required: true },
      { name: `soul-${id3}/model.mamodel`, source: `battle_soul_${id3}.mamodel`, required: true },
      { name: `soul-${id3}/anim.maanim`, source: `battle_soul_${id3}.maanim`, required: true }
    ]
  };
}

function demonSoul(out) {
  const dir = 'public/assets/bcu/100800/org/battle/soul/demonsoul';
  return {
    key: out,
    role: 'bcu-DemonSoul',
    sourceDir: dir,
    entries: [
      { name: `${out}/image.png`, source: 'battle_demonsoul_00.png', required: true },
      { name: `${out}/imgcut.imgcut`, source: 'battle_demonsoul_00.imgcut', required: true },
      { name: `${out}/model.mamodel`, source: 'battle_demonsoul_00.mamodel', required: true },
      { name: `${out}/anim.maanim`, source: 'battle_demonsoul_00.maanim', required: true }
    ]
  };
}

const EFFECT_DEFS = Object.freeze([
  ...Array.from({ length: 13 }, (_, id) => normalSoul(id)),
  demonSoul('demon-soul-enemy'),
  demonSoul('demon-soul-unit')
]);

function makeBundleJson({ aliases, missingRequired }) {
  return Buffer.from(JSON.stringify({
    key: EFFECT_SOUL_BUNDLE_KEY,
    scope: 'bcu-death-soul-and-demon-soul',
    bcuReference: {
      package: 'battlecatsultimate/BCU_java_util_common',
      classes: ['pack.PackData.loadSoul', 'util.pack.Soul', 'util.pack.DemonSoul', 'battle.entity.Entity.AnimManager'],
      sourcePaths: {
        normalSoul: './org/battle/soul/{000}/battle_soul_{000}',
        demonSoul: './org/battle/soul/demonsoul/battle_demonsoul_00'
      },
      draw: 'Entity.AnimManager.draw: if dead > 0, p.y -= 100 * siz; soul.draw(gra, p, siz); return'
    },
    runtimeAliases: aliases,
    missingRequired,
    generatedAt: FIXED_DATE
  }, null, 2));
}

export async function buildSoulEffectBundleEntries() {
  const entries = [];
  const aliases = [];
  const missingRequired = [];

  for (const def of EFFECT_DEFS) {
    for (const alias of def.entries) {
      const sourcePath = normalizePath(path.join(def.sourceDir, alias.source));
      const data = await fileBufferOrNull(sourcePath);
      const detail = {
        key: def.key,
        role: def.role,
        name: alias.name,
        source: alias.source,
        sourcePath,
        required: alias.required,
        present: !!data
      };
      aliases.push(detail);
      if (alias.required && !data) missingRequired.push(detail);
      if (data) entries.push({ name: alias.name, data });
    }
  }

  entries.push({
    name: 'bundle.json',
    data: makeBundleJson({ aliases, missingRequired })
  });

  return entries.sort((a, b) => {
    if (a.name === 'bundle.json') return -1;
    if (b.name === 'bundle.json') return 1;
    return a.name.localeCompare(b.name);
  });
}

export async function rebuildSoulEffectBundle() {
  const entries = await buildSoulEffectBundleEntries();
  const bundleJson = JSON.parse(entries.find((entry) => entry.name === 'bundle.json').data.toString('utf8'));
  if (bundleJson.missingRequired.length) {
    throw new Error(`Cannot build ${EFFECT_SOUL_BUNDLE_KEY}; missing required entries: ${bundleJson.missingRequired.map((x) => x.name).join(', ')}`);
  }
  await writeStoreZip(EFFECT_SOUL_BUNDLE_PATH, entries);
  const stat = await fs.stat(EFFECT_SOUL_BUNDLE_PATH);
  const manifest = await readJson(GENERATED_BUNDLE_MANIFEST_PATH, { schemaVersion: 1, generatedAt: FIXED_DATE, zipFormat: 'store-only', bundles: {} });
  manifest.bundles ||= {};
  manifest.bundles[EFFECT_SOUL_BUNDLE_KEY] = {
    kind: 'effect',
    key: EFFECT_SOUL_BUNDLE_KEY,
    bundlePath: EFFECT_SOUL_BUNDLE_PATH,
    status: 'full',
    sizeBytes: stat.size,
    hash: await hashFile(EFFECT_SOUL_BUNDLE_PATH),
    files: entries.map((entry) => entry.name)
  };
  await writeJson(GENERATED_BUNDLE_MANIFEST_PATH, manifest);
  return { bundleKey: EFFECT_SOUL_BUNDLE_KEY, bundlePath: EFFECT_SOUL_BUNDLE_PATH, entries: entries.map((entry) => entry.name), sizeBytes: stat.size, hash: manifest.bundles[EFFECT_SOUL_BUNDLE_KEY].hash };
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) console.log(JSON.stringify(await rebuildSoulEffectBundle(), null, 2));
