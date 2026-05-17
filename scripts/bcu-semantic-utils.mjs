import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import zlib from 'node:zlib';

export const GENERATED_DIR = 'public/assets/generated';
export const BUNDLE_DIR = 'public/assets/bundles';
export const MANIFEST_PATH = 'public/assets/bcu-manifest.json';
export const FIXED_DATE = '1970-01-01T00:00:00.000Z';
export const ACTOR_ROLES = Object.freeze(['move', 'idle', 'attack', 'kb']);
export const CASTLE_GROUPS = Object.freeze(['rc', 'ec', 'wc', 'sc']);

export async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

export function normalizePath(p) {
  return String(p || '').replace(/\\/g, '/').replace(/^\.\//, '');
}

export function toFetchPath(p) {
  const s = normalizePath(p);
  return s ? `./${s}` : null;
}

export function pad3(v) {
  return String(Math.max(0, Number(v) || 0)).padStart(3, '0');
}

export function formFromDir(v) {
  return ['f', 'c', 's', 'u'].includes(v) ? v : v;
}

export function comparePackId(a, b) {
  const na = /^\d+$/.test(a) ? Number(a) : null;
  const nb = /^\d+$/.test(b) ? Number(b) : null;
  if (na != null && nb != null && na !== nb) return na - nb;
  return String(a).localeCompare(String(b));
}

export async function readJson(file, fallback = null) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return fallback; }
}

export async function writeJson(file, value) {
  await ensureDir(path.dirname(file));
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

export async function writeText(file, value) {
  await ensureDir(path.dirname(file));
  await fs.writeFile(file, value);
}

async function walk(dir, out = []) {
  let entries = [];
  try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return out; }
  for (const entry of entries) {
    const full = normalizePath(path.join(dir, entry.name));
    if (entry.isDirectory()) await walk(full, out);
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

export async function loadManifest() {
  let manifest = await readJson(MANIFEST_PATH, null);
  if (!manifest?.files?.length) {
    const files = (await walk('public/assets')).sort();
    manifest = { schemaVersion: 1, generatedAt: FIXED_DATE, assetRoot: 'public/assets', bcuRoot: 'public/assets/bcu', files };
  }
  manifest.files = (manifest.files || []).map(normalizePath).sort();
  return manifest;
}

export async function fileSize(file) {
  try { return (await fs.stat(file)).size; } catch { return 0; }
}

export function classifyStageKind(basename) {
  if (/^MapStageData/i.test(basename)) return 'map-stage-data';
  if (/^PlayDungeon/i.test(basename)) return 'play-dungeon';
  if (/Dungeon|stageD/i.test(basename)) return 'random-dungeon';
  if (/^stage/i.test(basename)) return 'stage-definition';
  return 'unknown-stage-csv';
}

export function parseBgCsvRows(text, sourceFile) {
  const rows = [];
  for (const line of String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const clean = line.replace(/\/\/.*$/, '').trim();
    if (!clean) continue;
    const cols = clean.split(',').map((x) => x.trim());
    const bgId = Number(cols[0]);
    if (!Number.isFinite(bgId)) continue;
    const num = (i) => Number.isFinite(Number(cols[i])) ? Number(cols[i]) : null;
    rows.push({
      bgId,
      skyTop: { r: num(1), g: num(2), b: num(3) },
      skyBottom: { r: num(4), g: num(5), b: num(6) },
      groundTop: { r: num(7), g: num(8), b: num(9) },
      groundBottom: { r: num(10), g: num(11), b: num(12) },
      imgcutId: num(13),
      showUpper: num(14),
      imageReferenceId: num(15),
      raw: cols,
      sourceFile
    });
  }
  return rows;
}

export function buildActorIndexFromFiles(files) {
  const byKey = new Map();
  const iconLike = (name) => /^enemy_icon_|^edi_|^uni\d+_/.test(name);
  const add = (kind, id, form, pack, dir, file) => {
    const key = kind === 'enemy' ? `enemy:${Number(id)}` : `unit:${Number(id)}:${form}`;
    if (!byKey.has(key)) byKey.set(key, { key, kind, id: Number(id), id3: pad3(id), form, candidates: new Map() });
    const entry = byKey.get(key);
    const ckey = `${pack}:${dir}`;
    if (!entry.candidates.has(ckey)) entry.candidates.set(ckey, { sourcePack: pack, dir, files: {}, iconFiles: [], sourceRawPaths: [] });
    const c = entry.candidates.get(ckey);
    c.sourceRawPaths.push(file);
    const name = file.split('/').pop();
    if (iconLike(name)) { c.iconFiles.push(file); return; }
    if (name.endsWith('.png')) c.files.image = file;
    else if (name.endsWith('.imgcut')) c.files.imgcut = file;
    else if (name.endsWith('.mamodel')) c.files.model = file;
    else {
      const m = name.match(/(\d{2})\.maanim$/);
      if (m) c.files[`anim${m[1]}`] = file;
    }
  };
  for (const file of files) {
    let m = file.match(/^public\/assets\/bcu\/([^/]+)\/org\/enemy\/(\d{3})\/(.+)$/);
    if (m) add('enemy', m[2], null, m[1], `public/assets/bcu/${m[1]}/org/enemy/${m[2]}/`, file);
    m = file.match(/^public\/assets\/bcu\/([^/]+)\/org\/unit\/(\d{3})\/([^/]+)\/(.+)$/);
    if (m) add('unit', m[2], formFromDir(m[3]), m[1], `public/assets/bcu/${m[1]}/org/unit/${m[2]}/${m[3]}/`, file);
  }
  const entries = [];
  for (const item of byKey.values()) {
    const sourceCandidates = [...item.candidates.values()].map((c) => {
      const missing = [];
      for (const f of ['image', 'imgcut', 'model']) if (!c.files[f]) missing.push(f);
      ACTOR_ROLES.forEach((role, i) => { if (!c.files[`anim0${i}`]) missing.push(role); });
      const runtimeCount = Object.keys(c.files).length;
      const status = missing.length === 0 ? 'full' : (runtimeCount ? 'partial' : 'iconOnly');
      return {
        sourcePack: c.sourcePack,
        status,
        files: {
          image: c.files.image || null,
          imgcut: c.files.imgcut || null,
          model: c.files.model || null,
          animations: Object.fromEntries(ACTOR_ROLES.map((role, i) => [role, c.files[`anim0${i}`] || null])),
          icon: c.iconFiles[0] || null
        },
        missing,
        diagnostics: { sourceRawPaths: [...new Set(c.sourceRawPaths)].sort() }
      };
    }).sort((a, b) => comparePackId(a.sourcePack, b.sourcePack));
    const selectable = sourceCandidates.filter((c) => c.status === 'full');
    const partials = sourceCandidates.filter((c) => c.status === 'partial');
    const selected = (selectable.length ? selectable : partials).slice().sort((a, b) => comparePackId(b.sourcePack, a.sourcePack))[0] || null;
    const status = selected?.status || sourceCandidates[0]?.status || 'invalid';
    const bundlePath = item.kind === 'enemy'
      ? `public/assets/bundles/actor/enemy/${item.id3}.zip`
      : `public/assets/bundles/actor/unit/${item.id3}-${item.form}.zip`;
    entries.push({
      key: item.key,
      kind: item.kind,
      id: item.id,
      id3: item.id3,
      form: item.form,
      status,
      selected: selected ? { sourcePack: selected.sourcePack, files: selected.files } : null,
      sourceCandidates,
      missing: selected?.missing || [],
      warnings: status === 'iconOnly' ? ['icon-only-not-runtime'] : [],
      bundleRef: { bundleKey: `actor:${item.key}`, bundlePath },
      diagnostics: { sourceRawPaths: sourceCandidates.flatMap((c) => c.diagnostics.sourceRawPaths).sort() }
    });
  }
  entries.sort((a, b) => a.kind.localeCompare(b.kind) || a.id - b.id || String(a.form || '').localeCompare(String(b.form || '')));
  return { schemaVersion: 1, generatedAt: FIXED_DATE, entries, byKey: Object.fromEntries(entries.map((e) => [e.key, e])) };
}

export function buildStageIndexFromFiles(files) {
  const entries = [];
  const basenameCounts = new Map();
  const csvs = files.filter((f) => /^public\/assets\/bcu\/[^/]+\/org\/stage\/.+\.csv$/i.test(f)).sort();
  for (const f of csvs) basenameCounts.set(path.basename(f, '.csv'), (basenameCounts.get(path.basename(f, '.csv')) || 0) + 1);
  for (const f of csvs) {
    const m = f.match(/^public\/assets\/bcu\/([^/]+)\/org\/stage\/([^/]+)\/([^/]+)\/(.+)\.csv$/i);
    const packId = m?.[1] || 'unknown';
    const category = m?.[2] || 'unknown';
    const groupDir = m?.[3] || 'unknown';
    const basename = path.basename(f, '.csv');
    const relativeStagePath = `${category}/${groupDir}/${basename}.csv`;
    const key = `stage:${packId}:${category}/${groupDir}/${basename}`;
    const aliasConflicts = basenameCounts.get(basename) > 1 ? [`stage:${basename}`] : [];
    entries.push({
      key,
      legacyStageKey: `stage:${basename}`,
      stageId: basename,
      kind: classifyStageKind(basename),
      packId,
      category,
      groupDir,
      relativeStagePath,
      basename,
      extension: '.csv',
      aliases: [basename, `${basename}.csv`, relativeStagePath, `${packId}:${relativeStagePath}`],
      duplicateGroup: basenameCounts.get(basename) > 1 ? `basename:${basename}` : null,
      aliasConflicts,
      bundleRef: {
        bundleKey: `stage-map:${packId}/${category}/${groupDir}`,
        bundlePath: `public/assets/bundles/stage/map/${packId}__${category}__${groupDir}.zip`,
        internalPath: `${basename}.csv`,
        readMode: 'zip-text'
      },
      diagnostics: { sourceRawPath: f }
    });
  }
  return { schemaVersion: 1, generatedAt: FIXED_DATE, entries, byKey: Object.fromEntries(entries.map((e) => [e.key, e])) };
}

export async function buildBackgroundIndexFromFiles(files) {
  const metadata = new Map();
  const metadataFiles = files.filter((f) => /\/org\/(battle\/bg\/bg\.csv|battle\/bg\.csv|data\/bg\.csv)$/i.test(f)).sort();
  for (const file of metadataFiles) {
    for (const row of parseBgCsvRows(await fs.readFile(file, 'utf8'), file)) {
      if (!metadata.has(row.bgId)) metadata.set(row.bgId, []);
      metadata.get(row.bgId).push(row);
    }
  }
  const imageById = new Map();
  const imgcutById = new Map();
  for (const file of files) {
    let m = file.match(/\/org\/img\/bg\/bg(\d+)\.png$/i);
    if (m) { const id = Number(m[1]); if (!imageById.has(id)) imageById.set(id, []); imageById.get(id).push(file); }
    m = file.match(/\/org\/battle\/bg\/bg(\d+)\.imgcut$/i);
    if (m) { const id = Number(m[1]); if (!imgcutById.has(id)) imgcutById.set(id, []); imgcutById.get(id).push(file); }
  }
  const ids = new Set([...metadata.keys(), ...imageById.keys(), ...imgcutById.keys()]);
  const entries = [...ids].sort((a, b) => a - b).map((bgId) => {
    const rows = metadata.get(bgId) || [];
    const csv = rows[rows.length - 1] || null;
    const imageReferenceId = Number.isFinite(Number(csv?.imageReferenceId)) && Number(csv.imageReferenceId) >= 0 ? Number(csv.imageReferenceId) : null;
    const imgcutId = Number.isFinite(Number(csv?.imgcutId)) ? Number(csv.imgcutId) : null;
    const images = [...(imageById.get(imageReferenceId ?? bgId) || []), ...(imageById.get(bgId) || [])].filter((v, i, a) => a.indexOf(v) === i).sort();
    const imgcuts = [...(imgcutById.get(imgcutId ?? -1) || []), ...(imgcutById.get(bgId) || [])].filter((v, i, a) => a.indexOf(v) === i).sort();
    const sourcePack = (csv?.sourceFile || images[0] || imgcuts[0] || '').split('/')[3] || null;
    const missing = [];
    if (!images[0]) missing.push('image');
    if (!imgcuts[0]) missing.push('imgcut');
    return {
      key: `background:${bgId}`,
      bgId,
      sourcePack,
      metadataSources: rows.map((r) => r.sourceFile),
      csv: csv || { skyTop: null, skyBottom: null, groundTop: null, groundBottom: null, imgcutId: null, showUpper: null, imageReferenceId: null, raw: null, sourceFile: null },
      selected: { image: images[0] || null, imgcut: imgcuts[0] || null },
      candidates: { images, imgcuts },
      bundleRef: { bundleKey: `background:${bgId}`, bundlePath: `public/assets/bundles/background/${bgId}.zip`, readMode: 'zip' },
      missing,
      warnings: rows.length ? [] : ['filename-fallback-no-bg-metadata'],
      diagnostics: { sourceRawPaths: [...rows.map((r) => r.sourceFile), ...images, ...imgcuts].filter(Boolean).sort() }
    };
  });
  return { schemaVersion: 1, generatedAt: FIXED_DATE, entries, byKey: Object.fromEntries(entries.map((e) => [e.key, e])) };
}

export function buildCastleIndexFromFiles(files) {
  const enemyMap = new Map();
  const nyanko = [];
  for (const file of files) {
    let m = file.match(/^public\/assets\/bcu\/([^/]+)\/org\/img\/(rc|ec|wc|sc)\/\2(\d{3})(?:_([a-z]{2}))?\.png$/i);
    if (m) {
      const [, pack, group, localId3, locale = null] = m;
      const groupIndex = CASTLE_GROUPS.indexOf(group);
      const localId = Number(localId3);
      const numericId = groupIndex * 1000 + localId;
      const key = `enemyCastle:${group}${localId3}`;
      if (!enemyMap.has(key)) enemyMap.set(key, { key, numericKey: `enemyCastle:${numericId}`, numericId, group, groupIndex, localId, localId3, variants: [] });
      enemyMap.get(key).variants.push({ locale, sourcePack: pack, image: file });
    }
    m = file.match(/^public\/assets\/bcu\/([^/]+)\/org\/castle\/(.+)$/);
    if (m) nyanko.push({ sourcePack: m[1], path: file, partId: m[2].split('/')[0] });
  }
  const enemy = [...enemyMap.values()].sort((a, b) => a.numericId - b.numericId).map((e) => {
    e.variants.sort((a, b) => comparePackId(a.sourcePack, b.sourcePack) || String(a.locale || '').localeCompare(String(b.locale || '')));
    const selected = e.variants.find((v) => !v.locale) || e.variants[0] || null;
    return {
      ...e,
      selected: { image: selected?.image || null, locale: selected?.locale || null, sourcePack: selected?.sourcePack || null },
      bundleRef: { bundleKey: e.key, bundlePath: `public/assets/bundles/castle/enemy/${e.group}${e.localId3}.zip` },
      warnings: selected?.locale ? ['default-locale-missing-used-variant'] : [],
      diagnostics: { sourceRawPaths: e.variants.map((v) => v.image).sort() }
    };
  });
  const nyankoByPart = new Map();
  for (const item of nyanko) {
    const key = `nyankoCastle:${item.partId}`;
    if (!nyankoByPart.has(key)) nyankoByPart.set(key, { key, partId: item.partId, files: [] });
    nyankoByPart.get(key).files.push(item.path);
  }
  const nyankoEntries = [...nyankoByPart.values()].sort((a, b) => a.key.localeCompare(b.key)).map((e) => ({
    ...e,
    selected: { files: e.files.sort() },
    bundleRef: { bundleKey: e.key, bundlePath: `public/assets/bundles/castle/nyanko/${e.partId}.zip` },
    diagnostics: { sourceRawPaths: e.files.sort() }
  }));
  return { schemaVersion: 1, generatedAt: FIXED_DATE, enemy, nyanko: nyankoEntries, byKey: Object.fromEntries([...enemy, ...nyankoEntries].flatMap((e) => e.numericKey ? [[e.key, e], [e.numericKey, e]] : [[e.key, e]])) };
}

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function u16(v) { const b = Buffer.alloc(2); b.writeUInt16LE(v); return b; }
function u32(v) { const b = Buffer.alloc(4); b.writeUInt32LE(v >>> 0); return b; }

export async function writeStoreZip(zipPath, entries) {
  await ensureDir(path.dirname(zipPath));
  let offset = 0;
  const locals = [];
  const centrals = [];
  for (const entry of entries) {
    const name = Buffer.from(entry.name.replace(/\\/g, '/'));
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(String(entry.data ?? ''), 'utf8');
    const crc = crc32(data);
    const local = Buffer.concat([u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), name, data]);
    locals.push(local);
    centrals.push(Buffer.concat([u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name]));
    offset += local.length;
  }
  const central = Buffer.concat(centrals);
  const eocd = Buffer.concat([u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length), u32(central.length), u32(offset), u16(0)]);
  await fs.writeFile(zipPath, Buffer.concat([...locals, central, eocd]));
}

export async function fileBufferOrNull(file) {
  try { return await fs.readFile(file); } catch { return null; }
}

export async function hashFile(file) {
  try { return createHash('sha256').update(await fs.readFile(file)).digest('hex'); } catch { return null; }
}

export function validatePngBuffer(input, options = {}) {
  const bytes = Buffer.isBuffer(input) ? input : Buffer.from(input || []);
  const signature = bytes.subarray(0, 8).toString('hex');
  const result = { valid: false, reason: null, width: null, height: null, sizeBytes: bytes.length, signature };
  const fail = (reason) => ({ ...result, valid: false, reason });
  if (bytes.length < 33) return fail('truncated');
  if (signature !== '89504e470d0a1a0a') return fail('bad-signature');
  let offset = 8;
  let seenIhdr = false;
  let seenIend = false;
  const compatible = new Set(['1:0', '2:0', '4:0', '8:0', '16:0', '8:2', '16:2', '1:3', '2:3', '4:3', '8:3', '8:4', '16:4', '8:6', '16:6']);
  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) return fail('truncated-chunk');
    const length = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString('ascii');
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const crcEnd = dataEnd + 4;
    if (dataEnd > bytes.length || crcEnd > bytes.length) return fail('truncated-chunk');
    const expectedCrc = bytes.readUInt32BE(dataEnd);
    const actualCrc = crc32(bytes.subarray(offset + 4, dataEnd));
    if (actualCrc !== expectedCrc) return fail('crc-failed');
    if (!seenIhdr && type !== 'IHDR') return fail('missing-ihdr');
    if (type === 'IHDR') {
      if (seenIhdr) return fail('duplicate-ihdr');
      if (length !== 13) return fail('invalid-ihdr-length');
      seenIhdr = true;
      result.width = bytes.readUInt32BE(dataStart);
      result.height = bytes.readUInt32BE(dataStart + 4);
      const bitDepth = bytes[dataStart + 8];
      const colorType = bytes[dataStart + 9];
      if (result.width <= 0 || result.height <= 0) return fail('invalid-dimensions');
      if (!compatible.has(`${bitDepth}:${colorType}`)) return fail('unsupported-color-type');
    }
    if (type === 'IEND') {
      if (length !== 0) return fail('invalid-iend-length');
      seenIend = true;
      if (crcEnd !== bytes.length && options.allowTrailingBytes !== true) return fail('trailing-bytes');
      break;
    }
    offset = crcEnd;
  }
  if (!seenIhdr) return fail('missing-ihdr');
  if (!seenIend) return fail('missing-iend');
  return { ...result, valid: true, reason: null };
}

export async function validatePngFile(file, options = {}) {
  const data = await fileBufferOrNull(file);
  if (!data) return { valid: false, reason: 'missing', width: null, height: null, sizeBytes: 0, signature: null };
  return validatePngBuffer(data, options);
}

function readU16(buf, off) { return buf.readUInt16LE(off); }
function readU32(buf, off) { return buf.readUInt32LE(off); }

export async function readStoreZipEntries(zipPath) {
  const bytes = await fs.readFile(zipPath);
  const files = new Map();
  let offset = 0;
  while (offset + 30 <= bytes.length && readU32(bytes, offset) === 0x04034b50) {
    const method = readU16(bytes, offset + 8);
    const compressedSize = readU32(bytes, offset + 18);
    const uncompressedSize = readU32(bytes, offset + 22);
    const nameLen = readU16(bytes, offset + 26);
    const extraLen = readU16(bytes, offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLen + extraLen;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > bytes.length) throw new Error(`Truncated ZIP entry at ${zipPath}`);

    const name = bytes.subarray(nameStart, nameStart + nameLen).toString('utf8');
    const compressed = bytes.subarray(dataStart, dataEnd);

    let data;
    if (method === 0) {
      if (compressedSize !== uncompressedSize) throw new Error(`Invalid STORE ZIP sizes at ${zipPath}`);
      data = compressed;
    } else if (method === 8) {
      data = zlib.inflateRawSync(compressed);
      if (uncompressedSize !== 0 && data.length !== uncompressedSize) {
        throw new Error(`Invalid DEFLATE ZIP size for ${name} at ${zipPath}: expected ${uncompressedSize}, got ${data.length}`);
      }
    } else {
      throw new Error(`Unsupported ZIP compression method ${method} at ${zipPath}`);
    }

    files.set(name, data);
    offset = dataEnd;
  }
  return files;
}
