import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { generateEnemyIconForEntry, sha256 } from './actor-asset-task-utils.mjs';
import { pad3, readJson, readStoreZipEntries, validatePngBuffer } from './bcu-semantic-utils.mjs';

const ZIP_PATH = 'public/assets/bundles/icon/enemy.zip';
const PNG_OPTIONS = { allowTrailingBytes: true };
const REPAIRED_IDS = Object.freeze([0, 1, 50, 97, 99]);
const UNTOUCHED_IDS = Object.freeze([100, 101, 120]);

function assertPng512(data, label) {
  const info = validatePngBuffer(data, PNG_OPTIONS);
  assert.equal(info.valid, true, `${label} is a valid PNG: ${info.reason || ''}`);
  assert.equal(info.width, 512, `${label} width is 512`);
  assert.equal(info.height, 512, `${label} height is 512`);
  return info;
}

async function readHeadEnemyZip() {
  const bytes = execFileSync('git', ['show', `HEAD:${ZIP_PATH}`], { maxBuffer: 64 * 1024 * 1024 });
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'enemy-head-zip-'));
  const file = path.join(dir, 'enemy.zip');
  await fs.writeFile(file, bytes);
  return await readStoreZipEntries(file);
}

const actorIndex = await readJson('public/assets/generated/bcu-actor-index.json', { entries: [], byKey: {} });
const iconIndex = await readJson('public/assets/generated/bcu-icon-index.json', { entries: [], byKey: {} });
const zip = await readStoreZipEntries(ZIP_PATH);
const headZip = await readHeadEnemyZip();
const actorByKey = actorIndex.byKey || Object.fromEntries((actorIndex.entries || []).map((entry) => [entry.key, entry]));
const iconByKey = iconIndex.byKey || Object.fromEntries((iconIndex.entries || []).map((entry) => [entry.key, entry]));

for (const id of REPAIRED_IDS) {
  const key = `enemy:${id}`;
  const id3 = pad3(id);
  const internalPath = `enemy/${id3}.png`;
  const data = zip.get(internalPath);
  assert.ok(data, `${internalPath} exists in enemy.zip`);
  assertPng512(data, internalPath);

  const actorEntry = actorByKey[key];
  assert.ok(actorEntry?.bundleRef?.bundlePath, `${key} has actor bundle`);
  const generated = await generateEnemyIconForEntry({ enemyId: id, entry: actorEntry, allowlisted: false });
  assert.equal(generated.status, 'generated', `${key} generation status`);
  assert.equal(generated.compositionMethod, 'composed-initial-pose', `${key} composition method`);
  assert.equal(generated.iconGenerationSource, 'actor-bundle', `${key} generation source`);
  assert.equal(sha256(data), generated.sha256, `${internalPath} matches actor-bundle generated composed icon`);

  const rawPath = iconByKey[key]?.sourcePath || null;
  assert.match(rawPath || '', /\/org\/enemy\/\d{3}\/enemy_icon_\d{3}\.png$/, `${key} has audited raw source metadata`);
  const raw = await fs.readFile(rawPath);
  const rawInfo = validatePngBuffer(raw, PNG_OPTIONS);
  assert.equal(rawInfo.valid, true, `${rawPath} is valid PNG`);
  assert.notEqual(`${rawInfo.width}x${rawInfo.height}`, '512x512', `${rawPath} is not the generated 512 icon`);
  assert.notEqual(sha256(raw), sha256(data), `${internalPath} is not copied from raw enemy_icon`);
}

for (const id of UNTOUCHED_IDS) {
  const internalPath = `enemy/${id}.png`;
  const data = zip.get(internalPath);
  assert.ok(data, `${internalPath} exists in enemy.zip`);
  assertPng512(data, internalPath);
  const headData = headZip.get(internalPath);
  assert.ok(headData, `${internalPath} exists in HEAD enemy.zip`);
  assert.equal(sha256(data), sha256(headData), `${internalPath} image bytes unchanged from HEAD`);

  const rawPath = iconByKey[`enemy:${id}`]?.sourcePath || null;
  const raw = rawPath ? await fs.readFile(rawPath) : null;
  if (raw) assert.notEqual(sha256(raw), sha256(data), `${internalPath} is not raw enemy_icon`);
}

console.log('check-enemy-icon-zip-parity: OK');
