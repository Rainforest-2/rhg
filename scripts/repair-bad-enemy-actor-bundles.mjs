import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import {
  readJson,
  writeJson,
  writeStoreZip,
  hashFile,
  FIXED_DATE
} from './bcu-semantic-utils.mjs';

const PNG_SIG = Buffer.from('89504e470d0a1a0a', 'hex');

function pad3(n) {
  return String(Number(n)).padStart(3, '0');
}

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

async function findRawDir(enemyId) {
  const id3 = pad3(enemyId);
  const packs = (await fs.readdir('public/assets/bcu')).sort();
  for (const pack of packs) {
    const dir = `public/assets/bcu/${pack}/org/enemy/${id3}`;
    if (await exists(dir)) return { pack, dir };
  }
  return null;
}

async function actorBundleImageStatus(enemyId) {
  const bundlePath = `public/assets/bundles/actor/enemy/${enemyId}.zip`;
  if (!(await exists(bundlePath))) {
    return { enemyId, bundlePath, status: 'bundle-missing' };
  }

  const { execFileSync } = await import('node:child_process');
  const py = `
import zipfile, sys
p = sys.argv[1]
with zipfile.ZipFile(p) as z:
    b = z.read("image.png")
print(b[:8].hex())
`;
  try {
    const head = execFileSync('python3', ['-c', py, bundlePath], { encoding: 'utf8' }).trim();
    return {
      enemyId,
      bundlePath,
      status: head === PNG_SIG.toString('hex') ? 'ok' : 'bad-image-signature',
      head
    };
  } catch (error) {
    return { enemyId, bundlePath, status: 'bundle-read-failed', error: String(error?.message || error) };
  }
}

async function rebuildOne(enemyId) {
  const found = await findRawDir(enemyId);
  if (!found) return { enemyId, status: 'missing-raw-dir' };

  const id3 = pad3(enemyId);
  const dir = found.dir;

  const files = {
    image: `${dir}/${id3}_e.png`,
    imgcut: `${dir}/${id3}_e.imgcut`,
    model: `${dir}/${id3}_e.mamodel`,
    move: `${dir}/${id3}_e00.maanim`,
    idle: `${dir}/${id3}_e01.maanim`,
    attack: `${dir}/${id3}_e02.maanim`,
    kb: `${dir}/${id3}_e03.maanim`,
    icon: `${dir}/enemy_icon_${id3}.png`
  };

  const required = ['image', 'imgcut', 'model', 'move', 'idle', 'attack', 'kb'];
  const missing = [];
  for (const key of required) {
    if (!(await exists(files[key]))) missing.push(key);
  }
  if (missing.length) {
    return { enemyId, status: 'missing-required', missing, dir };
  }

  const image = await fs.readFile(files.image);
  if (!image.subarray(0, 8).equals(PNG_SIG)) {
    return {
      enemyId,
      status: 'bad-raw-image-signature',
      head: image.subarray(0, 8).toString('hex'),
      dir
    };
  }

  const bundlePath = `public/assets/bundles/actor/enemy/${enemyId}.zip`;
  await fs.mkdir(path.dirname(bundlePath), { recursive: true });

  const bundleJson = {
    key: `enemy:${enemyId}`,
    status: 'full',
    missing: [],
    fallbackPolicy: 'no-raw-runtime-fallback',
    sourcePack: found.pack,
    sourceRawPaths: Object.values(files),
    entries: {
      image: files.image,
      imgcut: files.imgcut,
      model: files.model,
      animations: {
        move: files.move,
        idle: files.idle,
        attack: files.attack,
        kb: files.kb
      },
      icon: await exists(files.icon) ? files.icon : null
    }
  };

  const entries = [
    { name: 'bundle.json', data: Buffer.from(JSON.stringify(bundleJson, null, 2)) },
    { name: 'image.png', data: image },
    { name: 'imgcut.imgcut', data: await fs.readFile(files.imgcut) },
    { name: 'model.mamodel', data: await fs.readFile(files.model) },
    { name: 'move.maanim', data: await fs.readFile(files.move) },
    { name: 'idle.maanim', data: await fs.readFile(files.idle) },
    { name: 'attack.maanim', data: await fs.readFile(files.attack) },
    { name: 'kb.maanim', data: await fs.readFile(files.kb) }
  ];

  if (await exists(files.icon)) {
    entries.push({ name: 'icon.png', data: await fs.readFile(files.icon) });
  }

  await writeStoreZip(bundlePath, entries);

  return {
    enemyId,
    status: 'rebuilt',
    sourcePack: found.pack,
    bundlePath,
    sizeBytes: (await fs.stat(bundlePath)).size,
    hash: await hashFile(bundlePath),
    imageSha256: sha256(image)
  };
}

const targetIds = [
  19,284,285,286,287,288,289,290,291,292,303,304,
  425,427,428,468,469,512,552,553,554,555,556,557,
  558,559,560,561,562,585,586,587,588,589,590,591,
  610,611,612,614,698,699,700,701,744,
];

const before = [];
const results = [];

for (const id of targetIds) {
  const status = await actorBundleImageStatus(id);
  before.push(status);

  if (status.status === 'ok') {
    console.log(id, 'skip-ok');
    results.push({ enemyId: id, status: 'already-ok' });
    continue;
  }

  const result = await rebuildOne(id);
  results.push(result);
  console.log(id, result.status, result.bundlePath || '', result.head || '', result.missing ? JSON.stringify(result.missing) : '');
}

await fs.mkdir('tmp', { recursive: true });
await fs.writeFile(
  'tmp/rebuilt-enemy-actor-bundles.json',
  JSON.stringify({ generatedAt: new Date().toISOString(), before, results }, null, 2)
);

const manifest = await readJson('public/assets/generated/bcu-bundle-manifest.json', {
  schemaVersion: 1,
  generatedAt: FIXED_DATE,
  zipFormat: 'store-only',
  generationMode: 'all',
  bundles: {}
});

manifest.bundles ||= {};

for (const r of results) {
  if (r.status !== 'rebuilt') continue;
  manifest.bundles[`actor:enemy:${r.enemyId}`] = {
    kind: 'actor',
    key: `enemy:${r.enemyId}`,
    bundlePath: r.bundlePath,
    status: 'full',
    sizeBytes: r.sizeBytes,
    hash: r.hash
  };
}

await writeJson('public/assets/generated/bcu-bundle-manifest.json', manifest);
