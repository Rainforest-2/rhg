// Regenerates enemy icons whose BCU initial pose contains BLEND glow parts
// (glow modes 1/3). generateEnemyIconForEntry now composes those parts with
// luminance-scaled alpha instead of plain alpha-over, which removes the opaque
// black boxes that non-glow compositing produced (e.g. enemy 179/236/248).
// Deterministic: the affected set is derived from the actor bundles' initial
// pose draw lists, not from a hand-written ID list. Icons without glow parts
// are proven byte-identical before the zip is rewritten.
import fs from 'node:fs/promises';
import { generateEnemyIconForEntry, sha256 } from './actor-asset-task-utils.mjs';
import { readActorBundleFiles } from './actor-asset-task-utils.mjs';
import { FIXED_DATE, hashFile, pad3, readJson, readStoreZipEntries, validatePngBuffer, writeJson, writeStoreZip } from './bcu-semantic-utils.mjs';
import { parseModel } from '../js/bcu/BcuModelParser.js';
import { parseAnim } from '../js/bcu/BcuAnimParser.js';
import { BcuModelInstance } from '../js/bcu/BcuModelInstance.js';
import { BcuAnimator } from '../js/bcu/BcuAnimator.js';

const ZIP_PATH = 'public/assets/bundles/icon/enemy.zip';
const MANIFEST_PATH = 'public/assets/generated/bcu-bundle-manifest.json';
const PNG_OPTIONS = { allowTrailingBytes: true };
const GLOW_MODES = new Set([1, 3]);
// Byte-stability witnesses: initial poses without glow parts must not change.
const STABLE_SAMPLE_IDS = Object.freeze([0, 100, 121]);
const apply = process.argv.includes('--apply');

function pngInfo(data, label) {
  const info = validatePngBuffer(data, PNG_OPTIONS);
  if (!info.valid) throw new Error(`${label} is not a valid PNG: ${info.reason}`);
  return info;
}

async function initialPoseGlowModes(actorEntry) {
  const bundle = await readActorBundleFiles(actorEntry);
  if (!bundle?.modelText || !bundle?.neutralAnim?.text) return null;
  const inst = new BcuModelInstance(parseModel(bundle.modelText));
  const animator = new BcuAnimator(parseAnim(bundle.neutralAnim.text));
  animator.frame = 0;
  animator.apply(inst);
  const modes = new Set();
  for (const part of inst.getBattleDrawList()) {
    const glow = Number(part.glow ?? 0);
    if (GLOW_MODES.has(glow) && (part.opacity ?? 1) > 0) modes.add(glow);
  }
  return modes;
}

const actorIndex = await readJson('public/assets/generated/bcu-actor-index.json', { entries: [], byKey: {} });
const actorByKey = actorIndex.byKey || Object.fromEntries((actorIndex.entries || []).map((entry) => [entry.key, entry]));
const zip = await readStoreZipEntries(ZIP_PATH);

const stableBefore = new Map();
for (const id of STABLE_SAMPLE_IDS) {
  const name = `enemy/${pad3(id)}.png`;
  const data = zip.get(name);
  if (!data) throw new Error(`Stable sample missing: ${name}`);
  stableBefore.set(name, sha256(data));
}

const replaced = [];
const skipped = [];
for (let id = 0; id <= 777; id += 1) {
  const key = `enemy:${id}`;
  const actorEntry = actorByKey[key] || null;
  if (!actorEntry) continue;
  let modes = null;
  try {
    modes = await initialPoseGlowModes(actorEntry);
  } catch (error) {
    skipped.push({ key, reason: `draw-list-scan-failed: ${error?.message || error}` });
    continue;
  }
  if (!modes || modes.size === 0) continue;
  const generated = await generateEnemyIconForEntry({ enemyId: id, entry: actorEntry, allowlisted: false });
  if (generated?.status !== 'generated' || generated.compositionMethod !== 'composed-initial-pose') {
    skipped.push({ key, reason: generated?.failureReason || generated?.compositionMethod || generated?.status || 'unknown' });
    continue;
  }
  const info = pngInfo(generated.png, key);
  if (info.width !== 512 || info.height !== 512) throw new Error(`Generated ${key} is not 512x512`);
  const names = [`enemy/${pad3(id)}.png`];
  const shortName = `enemy/${id}.png`;
  if (shortName !== names[0] && zip.has(shortName)) names.push(shortName);
  const changed = names.some((name) => sha256(zip.get(name) || Buffer.alloc(0)) !== generated.sha256);
  for (const name of names) zip.set(name, generated.png);
  replaced.push({ key, glowModes: [...modes], names, changed, sha256: generated.sha256 });
}

for (const [name, beforeHash] of stableBefore) {
  const entry = actorByKey[`enemy:${Number(name.match(/(\d+)\.png$/)[1])}`];
  const regenerated = await generateEnemyIconForEntry({ enemyId: Number(name.match(/(\d+)\.png$/)[1]), entry, allowlisted: false });
  if (regenerated.sha256 !== beforeHash) throw new Error(`Glow-free sample is no longer byte-stable: ${name}`);
}

const currentBundle = JSON.parse(Buffer.from(zip.get('bundle.json') || Buffer.from('{}')).toString('utf8'));
const entryByPath = new Map((currentBundle.entries || []).map((entry) => [entry.internalPath, entry]));
for (const item of replaced) {
  for (const name of item.names) {
    entryByPath.set(name, {
      ...(entryByPath.get(name) || { key: item.key, internalPath: name, compositionMethod: 'composed-initial-pose', width: 512, height: 512, frame: 0 }),
      sha256: item.sha256
    });
  }
}
const pngNames = [...zip.keys()].filter((name) => /^enemy\/\d+\.png$/.test(name)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
zip.set('bundle.json', Buffer.from(JSON.stringify({
  ...currentBundle,
  generatedAt: FIXED_DATE,
  iconCount: pngNames.length,
  entries: pngNames.map((name) => entryByPath.get(name) || {
    key: `enemy:${Number(name.match(/\d+/)?.[0])}`,
    internalPath: name,
    compositionMethod: 'composed-initial-pose',
    width: 512,
    height: 512,
    frame: 0,
    sha256: sha256(zip.get(name))
  })
}, null, 2)));

const summary = {
  ok: true,
  mode: apply ? 'apply' : 'dry-run',
  affected: replaced.length,
  changedIcons: replaced.filter((r) => r.changed).length,
  skipped,
  affectedIds: replaced.map((r) => r.key)
};

if (apply) {
  const orderedNames = [...zip.keys()];
  await writeStoreZip(ZIP_PATH, orderedNames.map((name) => ({ name, data: zip.get(name) })));
  const manifest = await readJson(MANIFEST_PATH, { bundles: {} });
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
  summary.zipHash = manifest.bundles['icon:enemy'].hash;
  summary.iconCount = pngNames.length;
}

console.log(JSON.stringify(summary, null, 2));
