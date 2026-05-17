import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { BCU_STATUS_EFFECT_SPECS, PHASE_A_STATUS_EFFECT_KEYS, STATUS_EFFECT_BUNDLE_REF } from '../js/battle/bcu-runtime/BcuStatusEffectSpec.js';

const SCAN_ROOT = 'public/assets/bcu';
const OUT_ZIP = 'public/assets/bundles/effect/status-effects.zip';
const OUT_INVENTORY = 'public/assets/generated/bcu-status-effect-inventory.json';
const MANIFEST = 'public/assets/generated/bcu-bundle-manifest.json';
const EXTENSIONS = new Set(['.png', '.imgcut', '.mamodel', '.maanim']);

export function normalizeAssetPath(p) {
  return String(p || '').replace(/\\/g, '/').replace(/^\.?\//, '').replace(/^public\/assets\/bcu\/[^/]+\//, '');
}

export function extractOrgBattleSuffix(fullPath) {
  const s = normalizeAssetPath(fullPath);
  const i = s.indexOf('org/battle/');
  return i >= 0 ? s.slice(i) : s;
}

export function findBySuffix(allFiles, suffix) {
  const want = suffix.replace(/\\/g, '/').replace(/^\.?\//, '');
  const candidates = allFiles
    .filter((file) => extractOrgBattleSuffix(file) === want)
    .map((file) => ({
      file,
      packId: String(file).match(/public\/assets\/bcu\/([^/]+)\//)?.[1] || '',
      suffix: extractOrgBattleSuffix(file)
    }));

  candidates.sort((a, b) => {
    const ap = a.packId === '000001' ? 0 : 1;
    const bp = b.packId === '000001' ? 0 : 1;
    if (ap !== bp) return ap - bp;
    return a.packId.localeCompare(b.packId) || a.file.localeCompare(b.file);
  });

  return {
    selected: candidates[0] || null,
    candidates,
    ambiguous: candidates.length > 1 && candidates[0].packId !== '000001'
  };
}

async function walk(dir) {
  const out = [];
  let entries = [];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const p = path.join(dir, entry.name).replace(/\\/g, '/');
    if (entry.isDirectory()) out.push(...await walk(p));
    else if (EXTENSIONS.has(path.extname(entry.name))) out.push(p);
  }
  return out;
}

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function u16(n) {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(n);
  return b;
}

function u32(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n >>> 0);
  return b;
}

function storeZip(entries) {
  const local = [];
  const central = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name);
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data);
    const crc = crc32(data);
    const localHeader = Buffer.concat([
      u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), name
    ]);
    local.push(localHeader, data);
    central.push(Buffer.concat([
      u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name
    ]));
    offset += localHeader.length + data.length;
  }
  const centralStart = offset;
  const centralBuf = Buffer.concat(central);
  const end = Buffer.concat([u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length), u32(centralBuf.length), u32(centralStart), u16(0)]);
  return Buffer.concat([...local, centralBuf, end]);
}

export async function buildStatusEffectInventory() {
  const allFiles = await walk(SCAN_ROOT);
  const inventory = {};
  const zipEntries = [];
  for (const [effectKey, spec] of Object.entries(BCU_STATUS_EFFECT_SPECS)) {
    const parts = {
      image: { suffix: spec.image, internal: `${effectKey}/image.png` },
      imgcut: { suffix: spec.imgcut, internal: `${effectKey}/imgcut.imgcut` },
      model: { suffix: spec.model, internal: `${effectKey}/model.mamodel` }
    };
    for (const [variant, suffix] of Object.entries(spec.variants || { DEF: spec.anim })) {
      parts[variant] = { suffix, internal: `${effectKey}/${variant}.maanim` };
    }
    const sources = {};
    const internal = {};
    const candidates = {};
    let resolved = true;
    let ambiguous = false;
    for (const [kind, part] of Object.entries(parts)) {
      const found = findBySuffix(allFiles, part.suffix);
      candidates[kind] = found.candidates;
      if (!found.selected) resolved = false;
      if (found.ambiguous) ambiguous = true;
      if (found.selected) {
        sources[kind] = found.selected.file;
        internal[kind] = part.internal;
        zipEntries.push({ name: part.internal, data: await fs.readFile(found.selected.file) });
      }
    }
    inventory[effectKey] = {
      resolved,
      ambiguous,
      phase: spec.phase || 'B',
      bundleRef: STATUS_EFFECT_BUNDLE_REF,
      internal,
      sources,
      candidates
    };
  }
  return { inventory, zipEntries };
}

async function updateManifest(zipBytes) {
  let manifest = { schemaVersion: 1, bundles: {} };
  try {
    manifest = JSON.parse(await fs.readFile(MANIFEST, 'utf8'));
  } catch {}
  manifest.bundles = manifest.bundles || {};
  manifest.bundles['effect:status'] = {
    kind: 'effect',
    key: 'effect:status',
    bundlePath: OUT_ZIP,
    status: 'full',
    sizeBytes: zipBytes.length,
    hash: crypto.createHash('sha256').update(zipBytes).digest('hex')
  };
  await fs.mkdir(path.dirname(MANIFEST), { recursive: true });
  await fs.writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
}

export async function main() {
  const { inventory, zipEntries } = await buildStatusEffectInventory();
  const phaseAErrors = PHASE_A_STATUS_EFFECT_KEYS
    .filter((key) => !inventory[key]?.resolved || inventory[key]?.ambiguous)
    .map((key) => ({ key, resolved: inventory[key]?.resolved, ambiguous: inventory[key]?.ambiguous, candidates: inventory[key]?.candidates }));
  if (phaseAErrors.length) {
    console.error(JSON.stringify({ error: 'Phase A status effects unresolved', phaseAErrors }, null, 2));
    process.exitCode = 1;
    return;
  }
  const zipBytes = storeZip(zipEntries);
  await fs.mkdir(path.dirname(OUT_ZIP), { recursive: true });
  await fs.writeFile(OUT_ZIP, zipBytes);
  await fs.mkdir(path.dirname(OUT_INVENTORY), { recursive: true });
  await fs.writeFile(OUT_INVENTORY, `${JSON.stringify(inventory, null, 2)}\n`);
  await updateManifest(zipBytes);
  console.log(`wrote ${OUT_ZIP} (${zipBytes.length} bytes) and ${OUT_INVENTORY}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
