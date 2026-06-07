import fs from 'node:fs/promises';
import { generateEnemyIconForEntry, sha256 } from './actor-asset-task-utils.mjs';
import { FIXED_DATE, hashFile, pad3, readJson, readStoreZipEntries, validatePngBuffer, writeJson, writeStoreZip } from './bcu-semantic-utils.mjs';

const ZIP_PATH = 'public/assets/bundles/icon/enemy.zip';
const MANIFEST_PATH = 'public/assets/generated/bcu-bundle-manifest.json';
const PNG_OPTIONS = { allowTrailingBytes: true };
const UNTOUCHED_SAMPLE_IDS = Object.freeze([100, 101, 120]);

function parseRangeArg() {
  const value = process.argv.find((arg) => arg.startsWith('--range='))?.split('=')[1] || '0-99';
  const match = value.match(/^(\d+)-(\d+)$/);
  if (!match) throw new Error(`Invalid --range=${value}; expected start-end`);
  const start = Number(match[1]);
  const end = Number(match[2]);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start) throw new Error(`Invalid --range=${value}`);
  return { start, end };
}

function parseModeArg() {
  const value = process.argv.find((arg) => arg.startsWith('--mode='))?.split('=')[1] || 'composed-512';
  if (value !== 'composed-512') throw new Error(`Unsupported --mode=${value}; expected composed-512`);
  return value;
}

function pngInfo(data, label) {
  const info = validatePngBuffer(data, PNG_OPTIONS);
  if (!info.valid) throw new Error(`${label} is not a valid PNG: ${info.reason}`);
  return info;
}

async function copyBackup() {
  if (process.argv.includes('--no-backup')) return null;
  const suffix = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const backupPath = `${ZIP_PATH}.bak-codex-${suffix}`;
  await fs.copyFile(ZIP_PATH, backupPath);
  return backupPath;
}

const { start, end } = parseRangeArg();
parseModeArg();
if (start !== 0 || end !== 99) throw new Error('This repair is intentionally limited to --range=0-99 for enemy padded runtime icons');

const backupPath = await copyBackup();
const actorIndex = await readJson('public/assets/generated/bcu-actor-index.json', { entries: [], byKey: {} });
const iconIndex = await readJson('public/assets/generated/bcu-icon-index.json', { entries: [], byKey: {} });
const manifest = await readJson(MANIFEST_PATH, { bundles: {} });
const zip = await readStoreZipEntries(ZIP_PATH);
const beforeUntouched = new Map();

for (const id of UNTOUCHED_SAMPLE_IDS) {
  const name = `enemy/${id}.png`;
  const data = zip.get(name);
  if (!data) throw new Error(`Untouched sample missing before repair: ${name}`);
  const info = pngInfo(data, name);
  if (info.width !== 512 || info.height !== 512) throw new Error(`Untouched sample is not 512x512 before repair: ${name} ${info.width}x${info.height}`);
  beforeUntouched.set(name, sha256(data));
}

const actorByKey = actorIndex.byKey || Object.fromEntries((actorIndex.entries || []).map((entry) => [entry.key, entry]));
const iconByKey = iconIndex.byKey || Object.fromEntries((iconIndex.entries || []).map((entry) => [entry.key, entry]));
const replaced = [];

for (let id = start; id <= end; id += 1) {
  const key = `enemy:${id}`;
  const id3 = pad3(id);
  const internalPath = `enemy/${id3}.png`;
  const actorEntry = actorByKey[key] || null;
  if (!actorEntry) throw new Error(`Missing actor entry for ${key}`);
  const generated = await generateEnemyIconForEntry({ enemyId: id, entry: actorEntry, allowlisted: false });
  if (generated?.status !== 'generated') throw new Error(`Failed to generate ${key}: ${generated?.failureReason || generated?.status || 'unknown'}`);
  if (generated.compositionMethod !== 'composed-initial-pose') throw new Error(`Unexpected composition method for ${key}: ${generated.compositionMethod}`);
  const info = pngInfo(generated.png, key);
  if (info.width !== 512 || info.height !== 512) throw new Error(`Generated ${key} is not 512x512: ${info.width}x${info.height}`);
  if (generated.iconGenerationSource !== 'actor-bundle') throw new Error(`Generated ${key} did not come from actor bundle: ${generated.iconGenerationSource}`);

  const rawPath = iconByKey[key]?.sourcePath || null;
  if (/enemy_icon_\d{3}\.png$/.test(rawPath || '')) {
    const raw = await fs.readFile(rawPath);
    const rawInfo = pngInfo(raw, rawPath);
    if (rawInfo.width === 64 && rawInfo.height === 64 && sha256(raw) === generated.sha256) {
      throw new Error(`Generated ${key} unexpectedly matches raw enemy_icon source`);
    }
  }

  zip.set(internalPath, generated.png);
  replaced.push({
    key,
    internalPath,
    compositionMethod: generated.compositionMethod,
    iconGenerationSource: generated.iconGenerationSource,
    width: info.width,
    height: info.height,
    sha256: generated.sha256
  });
}

const currentBundle = JSON.parse(Buffer.from(zip.get('bundle.json') || Buffer.from('{}')).toString('utf8'));
const existingEntryByPath = new Map((currentBundle.entries || []).map((entry) => [entry.internalPath, entry]));
for (const item of replaced) existingEntryByPath.set(item.internalPath, {
  key: item.key,
  internalPath: item.internalPath,
  compositionMethod: item.compositionMethod,
  iconGenerationSource: item.iconGenerationSource,
  width: item.width,
  height: item.height,
  frame: 0,
  sha256: item.sha256
});
const pngNames = [...zip.keys()].filter((name) => /^enemy\/\d+\.png$/.test(name)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
const bundleJson = {
  ...currentBundle,
  bundleKey: 'icon:enemy',
  kind: 'icon',
  generatedAt: FIXED_DATE,
  generationSource: 'actor-assets-initial-pose',
  iconCount: pngNames.length,
  width: 512,
  height: 512,
  frame: 0,
  animationRole: 'idle',
  entries: pngNames.map((name) => existingEntryByPath.get(name) || {
    key: `enemy:${Number(name.match(/\d+/)?.[0])}`,
    internalPath: name,
    compositionMethod: 'composed-initial-pose',
    width: 512,
    height: 512,
    frame: 0,
    sha256: sha256(zip.get(name))
  })
};
zip.set('bundle.json', Buffer.from(JSON.stringify(bundleJson, null, 2)));

const orderedNames = [...zip.keys()];
await writeStoreZip(ZIP_PATH, orderedNames.map((name) => ({ name, data: zip.get(name) })));

const afterZip = await readStoreZipEntries(ZIP_PATH);
for (const [name, beforeHash] of beforeUntouched) {
  const after = afterZip.get(name);
  const afterInfo = pngInfo(after, name);
  const afterHash = sha256(after);
  if (afterHash !== beforeHash) throw new Error(`Untouched sample changed: ${name}`);
  if (afterInfo.width !== 512 || afterInfo.height !== 512) throw new Error(`Untouched sample is not 512x512 after repair: ${name}`);
}

manifest.bundles ||= {};
manifest.bundles['icon:enemy'] = {
  ...(manifest.bundles['icon:enemy'] || {}),
  kind: 'icon',
  key: 'icon:enemy',
  bundlePath: ZIP_PATH,
  status: 'full',
  iconCount: pngNames.length,
  width: 512,
  height: 512,
  frame: 0,
  animationRole: 'idle',
  sizeBytes: (await fs.stat(ZIP_PATH)).size,
  hash: await hashFile(ZIP_PATH),
  generationSource: 'actor-assets-initial-pose'
};
await writeJson(MANIFEST_PATH, manifest);

console.log(JSON.stringify({
  ok: true,
  backupPath,
  range: `${start}-${end}`,
  replaced: replaced.length,
  untouchedSamples: Object.fromEntries(beforeUntouched),
  iconCount: pngNames.length,
  zipHash: manifest.bundles['icon:enemy'].hash
}, null, 2));
