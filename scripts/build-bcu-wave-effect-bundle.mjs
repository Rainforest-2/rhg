import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FIXED_DATE, fileBufferOrNull, hashFile, readJson, writeJson, writeStoreZip } from './bcu-semantic-utils.mjs';

export const EFFECT_WAVE_BUNDLE_KEY = 'effect:wave';
export const EFFECT_WAVE_BUNDLE_PATH = 'public/assets/bundles/effect/wave.zip';
const GENERATED_BUNDLE_MANIFEST_PATH = 'public/assets/generated/bcu-bundle-manifest.json';

const WAVE_EFFECT_DEFS = Object.freeze([
  {
    key: 'unitWave',
    role: 'bcu-A_WAVE',
    sourceDir: 'public/assets/bcu/000001/org/battle/s4',
    entries: [
      { name: 'unit-wave/image.png', source: 'skill004.png', required: true },
      { name: 'unit-wave/imgcut.imgcut', source: 'skill004.imgcut', required: true },
      { name: 'unit-wave/model.mamodel', source: 'skill_wave_attack.mamodel', required: true },
      { name: 'unit-wave/anim.maanim', source: 'skill_wave_attack.maanim', required: true }
    ]
  },
  {
    key: 'enemyWave',
    role: 'bcu-A_E_WAVE',
    sourceDir: 'public/assets/bcu/000001/org/battle/s5',
    entries: [
      { name: 'enemy-wave/image.png', source: 'skill005.png', required: true },
      { name: 'enemy-wave/imgcut.imgcut', source: 'skill005.imgcut', required: true },
      { name: 'enemy-wave/model.mamodel', source: 'skill_wave_attack_e.mamodel', required: true },
      { name: 'enemy-wave/anim.maanim', source: 'skill_wave_attack_e.maanim', required: true }
    ]
  },
  {
    key: 'unitMiniWave',
    role: 'bcu-A_MINIWAVE',
    sourceDir: 'public/assets/bcu/100100/org/battle/s12',
    entries: [
      { name: 'unit-mini-wave/image.png', source: 'skill012.png', required: true },
      { name: 'unit-mini-wave/imgcut.imgcut', source: 'skill012.imgcut', required: true },
      { name: 'unit-mini-wave/model.mamodel', source: 'skill_smallwave_attack.mamodel', required: true },
      { name: 'unit-mini-wave/anim.maanim', source: 'skill_smallwave_attack.maanim', required: true }
    ]
  },
  {
    key: 'enemyMiniWave',
    role: 'bcu-A_E_MINIWAVE',
    sourceDir: 'public/assets/bcu/100100/org/battle/s13',
    entries: [
      { name: 'enemy-mini-wave/image.png', source: 'skill013.png', required: true },
      { name: 'enemy-mini-wave/imgcut.imgcut', source: 'skill013.imgcut', required: true },
      { name: 'enemy-mini-wave/model.mamodel', source: 'skill_smallwave_attack_e.mamodel', required: true },
      { name: 'enemy-mini-wave/anim.maanim', source: 'skill_smallwave_attack_e.maanim', required: true }
    ]
  }
]);

function normalizePath(p) {
  return String(p || '').replace(/\\/g, '/').replace(/^\.\//, '');
}

function addEntry(entries, entry) {
  const name = normalizePath(entry.name);
  const previous = entries.get(name);
  entries.set(name, {
    ...previous,
    ...entry,
    name,
    required: !!(previous?.required || entry.required),
    data: entry.data ?? previous?.data ?? null
  });
}

function makeBundleJson({ aliases, missingRequired }) {
  return Buffer.from(JSON.stringify({
    key: EFFECT_WAVE_BUNDLE_KEY,
    bcuReference: {
      package: 'battlecatsultimate/BCU_java_util_common',
      class: 'battle.entity.ContWaveDef',
      importantEffects: {
        A_WAVE: './org/battle/s4/skill_wave_attack',
        A_E_WAVE: './org/battle/s5/skill_wave_attack_e',
        A_MINIWAVE: './org/battle/s12/skill_smallwave_attack',
        A_E_MINIWAVE: './org/battle/s13/skill_smallwave_attack_e'
      },
      timing: {
        normalWave: { initialT: -3, effectAtT: 0, attackAtT: 6, nextWaveAtT: 3 },
        miniWave: { initialT: -1, effectAtT: 0, attackAtT: 4, nextWaveAtT: 1 }
      }
    },
    runtimeAliases: aliases,
    policy: 'semantic-strict runtime reads this bundle; raw public/assets/bcu fallback is diagnostics only',
    missingRequired,
    generatedAt: FIXED_DATE
  }, null, 2));
}

export async function buildWaveEffectBundleEntries() {
  const entries = new Map();
  const aliases = [];
  const missingRequired = [];

  for (const def of WAVE_EFFECT_DEFS) {
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
      if (alias.required && !data) {
        missingRequired.push({ key: def.key, name: alias.name, source: alias.source, sourcePath, role: def.role });
      }
      addEntry(entries, { name: alias.name, data, sourcePath, required: alias.required, role: def.role });
    }
  }

  addEntry(entries, {
    name: 'bundle.json',
    data: makeBundleJson({ aliases, missingRequired }),
    required: true,
    sourcePath: 'generated'
  });

  return [...entries.values()].sort((a, b) => {
    if (a.name === 'bundle.json') return -1;
    if (b.name === 'bundle.json') return 1;
    return a.name.localeCompare(b.name);
  });
}

export async function rebuildWaveEffectBundle() {
  const entries = await buildWaveEffectBundleEntries();
  const missingRequired = entries.filter((entry) => entry.required && entry.data == null).map((entry) => entry.name);
  if (missingRequired.length) {
    throw new Error(`Cannot build ${EFFECT_WAVE_BUNDLE_KEY}; missing required entries: ${missingRequired.join(', ')}`);
  }

  const filtered = entries.filter((entry) => entry.data != null).map(({ name, data }) => ({ name, data }));
  await writeStoreZip(EFFECT_WAVE_BUNDLE_PATH, filtered);
  const stat = await fs.stat(EFFECT_WAVE_BUNDLE_PATH);
  const manifest = await readJson(GENERATED_BUNDLE_MANIFEST_PATH, { schemaVersion: 1, generatedAt: FIXED_DATE, zipFormat: 'store-only', bundles: {} });
  manifest.bundles ||= {};
  manifest.bundles[EFFECT_WAVE_BUNDLE_KEY] = {
    kind: 'effect',
    key: EFFECT_WAVE_BUNDLE_KEY,
    bundlePath: EFFECT_WAVE_BUNDLE_PATH,
    status: 'full',
    sizeBytes: stat.size,
    hash: await hashFile(EFFECT_WAVE_BUNDLE_PATH),
    files: filtered.map((entry) => entry.name)
  };
  await writeJson(GENERATED_BUNDLE_MANIFEST_PATH, manifest);
  return {
    bundleKey: EFFECT_WAVE_BUNDLE_KEY,
    bundlePath: EFFECT_WAVE_BUNDLE_PATH,
    entries: filtered.map((entry) => entry.name),
    sizeBytes: stat.size,
    hash: manifest.bundles[EFFECT_WAVE_BUNDLE_KEY].hash
  };
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  const result = await rebuildWaveEffectBundle();
  console.log(JSON.stringify(result, null, 2));
}
