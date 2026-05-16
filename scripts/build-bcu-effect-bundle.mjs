import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FIXED_DATE, fileBufferOrNull, hashFile, readJson, writeJson, writeStoreZip } from './bcu-semantic-utils.mjs';

export const EFFECT_KBEFF_BUNDLE_KEY = 'effect:kbeff';
export const EFFECT_KBEFF_BUNDLE_PATH = 'public/assets/bundles/effect/kbeff.zip';
export const EFFECT_KBEFF_SOURCE_DIR = 'public/assets/bcu/000001/org/battle/a';
const GENERATED_BUNDLE_MANIFEST_PATH = 'public/assets/generated/bcu-bundle-manifest.json';
const EFFECT_EXT_RE = /\.(png|imgcut|mamodel|maanim|wav|ogg|mp3)$/i;

const CANONICAL_EFFECT_ALIASES = Object.freeze([
  { name: 'image.png', source: '000_a.png', required: true, role: 'shared-image' },
  { name: 'imgcut.imgcut', source: '000_a.imgcut', required: true, role: 'shared-imgcut' },
  { name: 'model.mamodel', source: 'kb.mamodel', required: true, role: 'legacy-kb-model' },
  { name: 'kb_hb.maanim', source: 'kb_hb.maanim', required: true, role: 'knockback-heavy' },
  { name: 'kb_sw.maanim', source: 'kb_sw.maanim', required: true, role: 'knockback-swing' },
  { name: 'kb_ass.maanim', source: 'kb_ass.maanim', required: true, role: 'knockback-assassin' },
  { name: 'critical.mamodel', source: 'critical.mamodel', required: true, role: 'bcu-A_CRIT-model' },
  { name: 'critical.maanim', source: 'critical.maanim', required: true, role: 'bcu-A_CRIT-animation' },
  { name: 'attack_smoke.mamodel', source: 'attack_smoke.mamodel', required: false, role: 'bcu-A_ATK_SMOKE-model' },
  { name: 'attack_smoke.maanim', source: 'attack_smoke.maanim', required: false, role: 'bcu-A_ATK_SMOKE-animation' },
  { name: 'white_smoke.mamodel', source: 'white_smoke.mamodel', required: false, role: 'bcu-A_WHITE_SMOKE-model' },
  { name: 'white_smoke.maanim', source: 'white_smoke.maanim', required: false, role: 'bcu-A_WHITE_SMOKE-animation' }
]);

function normalizePath(p) {
  return String(p || '').replace(/\\/g, '/').replace(/^\.\//, '');
}

function basename(p) {
  return normalizePath(p).split('/').pop();
}

async function walkFiles(dir, out = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = normalizePath(path.join(dir, entry.name));
    if (entry.isDirectory()) await walkFiles(full, out);
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

function relativeToSource(file, sourceDir) {
  const src = normalizePath(sourceDir).replace(/\/$/, '');
  return normalizePath(file).slice(src.length + 1);
}

function addEntry(map, entry) {
  if (!entry?.name) return;
  const name = normalizePath(entry.name);
  const prev = map.get(name);
  map.set(name, {
    ...prev,
    ...entry,
    name,
    required: !!(prev?.required || entry.required),
    data: entry.data ?? prev?.data ?? null
  });
}

function makeBundleJson({ sourceDir, rawFiles, aliases, missingRequired }) {
  return Buffer.from(JSON.stringify({
    key: EFFECT_KBEFF_BUNDLE_KEY,
    source: normalizePath(sourceDir),
    bcuReference: {
      package: 'battlecatsultimate/BCU_java_util_common',
      class: 'util.pack.EffAnim',
      importantEffects: {
        A_CRIT: './org/battle/a/critical',
        A_ATK_SMOKE: './org/battle/a/attack_smoke',
        sharedImage: './org/battle/a/000_a.png',
        sharedImgcut: './org/battle/a/000_a.imgcut'
      }
    },
    runtimeAliases: aliases.map(({ name, source, required, role }) => ({ name, source, required, role })),
    rawEntries: rawFiles.map((file) => relativeToSource(file, sourceDir)),
    policy: 'semantic-strict runtime reads this bundle; no public/assets/bcu runtime fallback required',
    missingRequired,
    generatedAt: FIXED_DATE
  }, null, 2));
}

export async function buildKbeffEffectBundleEntries(options = {}) {
  const sourceDir = normalizePath(options.sourceDir || EFFECT_KBEFF_SOURCE_DIR);
  const allFiles = (await walkFiles(sourceDir)).filter((file) => EFFECT_EXT_RE.test(file)).sort();
  const byRelative = new Map(allFiles.map((file) => [relativeToSource(file, sourceDir), file]));
  const byBase = new Map();
  for (const file of allFiles) {
    const base = basename(file);
    if (!byBase.has(base)) byBase.set(base, []);
    byBase.get(base).push(file);
  }

  const entries = new Map();
  const missingRequired = [];
  const aliasDetails = [];

  for (const file of allFiles) {
    const rel = relativeToSource(file, sourceDir);
    const data = await fileBufferOrNull(file);
    addEntry(entries, { name: `raw/${rel}`, data, sourcePath: file, required: false });
    if ((byBase.get(basename(file)) || []).length === 1) {
      addEntry(entries, { name: basename(file), data, sourcePath: file, required: false });
    }
  }

  for (const alias of CANONICAL_EFFECT_ALIASES) {
    const sourcePath = byRelative.get(alias.source) || (byBase.get(alias.source) || [])[0] || normalizePath(path.join(sourceDir, alias.source));
    const data = await fileBufferOrNull(sourcePath);
    aliasDetails.push({ ...alias, sourcePath, present: !!data });
    if (alias.required && !data) missingRequired.push({ name: alias.name, source: alias.source, sourcePath, role: alias.role });
    addEntry(entries, { name: alias.name, data, sourcePath, required: alias.required, role: alias.role });
  }

  addEntry(entries, {
    name: 'bundle.json',
    data: makeBundleJson({ sourceDir, rawFiles: allFiles, aliases: aliasDetails, missingRequired }),
    required: true,
    sourcePath: 'generated'
  });

  return [...entries.values()].sort((a, b) => {
    if (a.name === 'bundle.json') return -1;
    if (b.name === 'bundle.json') return 1;
    return a.name.localeCompare(b.name);
  });
}

export async function rebuildKbeffEffectBundle(options = {}) {
  const entries = await buildKbeffEffectBundleEntries(options);
  const missingRequired = entries.filter((entry) => entry.required && entry.data == null).map((entry) => entry.name);
  if (missingRequired.length) {
    throw new Error(`Cannot build ${EFFECT_KBEFF_BUNDLE_KEY}; missing required entries: ${missingRequired.join(', ')}`);
  }
  const filtered = entries.filter((entry) => entry.data != null).map(({ name, data }) => ({ name, data }));
  await writeStoreZip(EFFECT_KBEFF_BUNDLE_PATH, filtered);
  const stat = await fs.stat(EFFECT_KBEFF_BUNDLE_PATH);
  const manifest = await readJson(GENERATED_BUNDLE_MANIFEST_PATH, { schemaVersion: 1, generatedAt: FIXED_DATE, zipFormat: 'store-only', bundles: {} });
  manifest.bundles ||= {};
  manifest.bundles[EFFECT_KBEFF_BUNDLE_KEY] = {
    kind: 'effect',
    key: EFFECT_KBEFF_BUNDLE_KEY,
    bundlePath: EFFECT_KBEFF_BUNDLE_PATH,
    status: 'full',
    sizeBytes: stat.size,
    hash: await hashFile(EFFECT_KBEFF_BUNDLE_PATH)
  };
  await writeJson(GENERATED_BUNDLE_MANIFEST_PATH, manifest);
  return { bundlePath: EFFECT_KBEFF_BUNDLE_PATH, entries: filtered.map((entry) => entry.name), sizeBytes: stat.size, hash: manifest.bundles[EFFECT_KBEFF_BUNDLE_KEY].hash };
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  const result = await rebuildKbeffEffectBundle();
  console.log(JSON.stringify(result, null, 2));
}
