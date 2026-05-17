import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import zlib from 'node:zlib';
import { parseImgcut } from '../js/bcu/BcuImgcutParser.js';
import { parseModel } from '../js/bcu/BcuModelParser.js';
import { parseAnim } from '../js/bcu/BcuAnimParser.js';
import { BcuModelInstance } from '../js/bcu/BcuModelInstance.js';
import { BcuAnimator } from '../js/bcu/BcuAnimator.js';
import {
  FIXED_DATE,
  readJson,
  writeJson,
  writeText,
  writeStoreZip,
  readStoreZipEntries,
  loadManifest,
  pad3
} from './bcu-semantic-utils.mjs';

export const ROOT = process.cwd();
export const ENEMY_ICON_ZIP = 'public/assets/bundles/icon/enemy.zip';
export const REGRESSION_ENEMY_IDS = Object.freeze([388, 425, 426, 427, 428, 440, 443, 560, 609, 610, 611, 612, 613, 695, 696, 697, 699]);
const PNG_SIG = Buffer.from('89504e470d0a1a0a', 'hex');
export const ENEMY_ICON_SIZE = 512;
export const ENEMY_ICON_FRAME = 0;
const ENEMY_ICON_MARGIN = 20;
const ENEMY_ICON_DRAW_SIZE = ENEMY_ICON_SIZE - ENEMY_ICON_MARGIN * 2;

export async function exists(file) {
  try { await fs.access(file); return true; } catch { return false; }
}

export async function ensureTmp() {
  await fs.mkdir('tmp', { recursive: true });
}

export function sha256(data) {
  return createHash('sha256').update(data).digest('hex');
}

export async function loadCoreDb() {
  const direct = await readJson('public/assets/core-db.json', null);
  if (direct) return direct;
  const entries = await readStoreZipEntries('public/assets/bundles/core/core-db.zip');
  const read = (name) => {
    const data = entries.get(name);
    return data ? JSON.parse(Buffer.from(data).toString('utf8')) : null;
  };
  return {
    manifestLite: read('manifest-lite.json'),
    units: read('units.json'),
    enemies: read('enemies.json'),
    namesJp: read('names-jp.json'),
    assetKeys: read('asset-keys.json'),
    diagnosticsSummary: read('diagnostics-summary.json')
  };
}

export function enemyNameFromCore(coreDb, enemyId) {
  const key = `enemy:${Number(enemyId)}`;
  const value = coreDb?.namesJp?.tables?.enemy?.[key]?.value
    || coreDb?.namesJp?.enemy?.[key]
    || coreDb?.enemies?.enemies?.[key]?.name?.value
    || null;
  return value || key;
}

export function enemyRecords(coreDb) {
  const out = new Map();
  for (const record of Object.values(coreDb?.enemies?.enemies || {})) {
    const id = Number(record?.enemyId ?? record?.id);
    if (Number.isFinite(id)) out.set(id, record);
  }
  return out;
}

export async function loadAllowlistAudit() {
  const files = ['error-enemy.json', 'error-ally.json', 'error.json'];
  const discoveredFiles = [];
  const parsedEntries = [];
  const enemyIds = new Set();
  const playerCharacterIds = new Set();
  const actorKeys = new Set();
  const unparsedFiles = [];
  const notes = [];

  for (const file of files) {
    if (!(await exists(file))) continue;
    discoveredFiles.push(file);
    try {
      const data = JSON.parse(await fs.readFile(file, 'utf8'));
      if (Array.isArray(data.missingEnemyIds)) {
        for (const id of data.missingEnemyIds) {
          const n = Number(id);
          if (!Number.isFinite(n)) continue;
          enemyIds.add(n);
          actorKeys.add(`enemy:${n}`);
          parsedEntries.push({ file, kind: 'enemy', id: n, actorKey: `enemy:${n}`, sourceField: 'missingEnemyIds' });
        }
      }
      if (Array.isArray(data.missingEnemyIdsPadded)) {
        for (const id of data.missingEnemyIdsPadded) {
          const n = Number(id);
          if (!Number.isFinite(n)) continue;
          enemyIds.add(n);
          actorKeys.add(`enemy:${n}`);
        }
      }
      if (Array.isArray(data.missingAllyIds)) {
        for (const id of data.missingAllyIds) {
          const n = Number(id);
          if (!Number.isFinite(n)) continue;
          playerCharacterIds.add(n);
          actorKeys.add(`unit:${Math.max(0, n - 1)}:f`);
          parsedEntries.push({ file, kind: 'ally-display-id', id: n, actorKey: `unit:${Math.max(0, n - 1)}:f`, sourceField: 'missingAllyIds' });
        }
      }
      notes.push(`${file}: parsed`);
    } catch (error) {
      unparsedFiles.push({ file, error: error?.message || String(error) });
    }
  }

  return {
    discoveredFiles,
    parsedEntries,
    enemyIds: [...enemyIds].sort((a, b) => a - b),
    playerCharacterIds: [...playerCharacterIds].sort((a, b) => a - b),
    actorKeys: [...actorKeys].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    unparsedFiles,
    notes
  };
}

export function renderAllowlistMarkdown(report) {
  return `# Actor Error Allowlist Audit

Generated: ${new Date().toISOString()}

## Files

${report.discoveredFiles.map((f) => `- ${f}`).join('\n') || '- none'}

## Summary

- parsed entries: ${report.parsedEntries.length}
- enemy IDs: ${report.enemyIds.length}
- player character IDs: ${report.playerCharacterIds.length}
- actor keys: ${report.actorKeys.length}
- unparsed files: ${report.unparsedFiles.length}

## Unparsed Files

${report.unparsedFiles.map((f) => `- ${f.file}: ${f.error}`).join('\n') || '- none'}
`;
}

export async function collectEnemyIds({ coreDb = null, actorIndex = null, manifest = null } = {}) {
  coreDb ||= await loadCoreDb();
  actorIndex ||= await readJson('public/assets/generated/bcu-actor-index.json', { entries: [], byKey: {} });
  manifest ||= await loadManifest();
  const ids = new Set();
  for (const id of manifest?.indexes?.enemyIds || []) {
    const n = Number(id);
    if (Number.isFinite(n)) ids.add(n);
  }
  for (const entry of actorIndex?.entries || []) {
    if (entry?.kind === 'enemy' && Number.isFinite(Number(entry.id))) ids.add(Number(entry.id));
  }
  for (const id of enemyRecords(coreDb).keys()) ids.add(Number(id));
  for (const id of REGRESSION_ENEMY_IDS) ids.add(id);
  return [...ids].sort((a, b) => a - b);
}

export function selectedActorFiles(entry) {
  return entry?.selected?.files
    || entry?.sourceCandidates?.find((c) => c.status === 'full')?.files
    || entry?.sourceCandidates?.find((c) => c.status === 'partial')?.files
    || {};
}

export function resolveNeutralAnimation(files = {}) {
  const a = files.animations || {};
  if (a.idle) return { role: 'idle', path: a.idle, internalPath: 'idle.maanim' };
  return null;
}

export async function readActorBundleFiles(entry) {
  if (!entry?.bundleRef?.bundlePath || !(await exists(entry.bundleRef.bundlePath))) return null;
  const zip = await readStoreZipEntries(entry.bundleRef.bundlePath);
  return {
    zip,
    image: zip.get('image.png') || null,
    imgcutText: zip.get('imgcut.imgcut') ? Buffer.from(zip.get('imgcut.imgcut')).toString('utf8') : null,
    modelText: zip.get('model.mamodel') ? Buffer.from(zip.get('model.mamodel')).toString('utf8') : null,
    neutralAnim: zip.get('idle.maanim')
      ? { role: 'idle', internalPath: 'idle.maanim', text: Buffer.from(zip.get('idle.maanim')).toString('utf8') }
      : null
  };
}

export async function readActorRawFiles(files = {}) {
  const neutral = resolveNeutralAnimation(files);
  if (!files.image || !files.imgcut || !files.model || !neutral?.path) return null;
  if (!(await exists(files.image)) || !(await exists(files.imgcut)) || !(await exists(files.model)) || !(await exists(neutral.path))) return null;
  return {
    image: await fs.readFile(files.image),
    imgcutText: await fs.readFile(files.imgcut, 'utf8'),
    modelText: await fs.readFile(files.model, 'utf8'),
    neutralAnim: { role: neutral.role, path: neutral.path, internalPath: neutral.internalPath, text: await fs.readFile(neutral.path, 'utf8') }
  };
}

function crc32(buf) {
  const table = crc32.table || (crc32.table = new Uint32Array(256).map((_, n) => {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  }));
  let c = 0xffffffff;
  for (const b of buf) c = table[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data = Buffer.alloc(0)) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}

export function encodePngRgba(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 4 + 1);
    raw[row] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4).copy(raw, row + 1);
  }
  return Buffer.concat([PNG_SIG, pngChunk('IHDR', ihdr), pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })), pngChunk('IEND')]);
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : (pb <= pc ? b : c);
}

function expandSample(v, bitDepth) {
  if (bitDepth === 8) return v;
  if (bitDepth === 4) return (v << 4) | v;
  if (bitDepth === 2) return (v << 6) | (v << 4) | (v << 2) | v;
  if (bitDepth === 1) return v ? 255 : 0;
  return v >>> 8;
}

export function decodePng(buffer) {
  const bytes = Buffer.from(buffer);
  if (!bytes.subarray(0, 8).equals(PNG_SIG)) throw new Error('bad-png-signature');
  let offset = 8;
  let width = 0, height = 0, bitDepth = 0, colorType = 0, interlace = 0;
  const idats = [];
  let palette = null;
  let trns = null;
  while (offset + 12 <= bytes.length) {
    const len = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString('ascii');
    const data = bytes.subarray(offset + 8, offset + 8 + len);
    offset += 12 + len;
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4); bitDepth = data[8]; colorType = data[9]; interlace = data[12];
    } else if (type === 'PLTE') palette = data;
    else if (type === 'tRNS') trns = data;
    else if (type === 'IDAT') idats.push(data);
    else if (type === 'IEND') break;
  }
  if (interlace !== 0) throw new Error('interlaced-png-not-supported');
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 3 ? 1 : colorType === 4 ? 2 : colorType === 0 ? 1 : 0;
  if (!channels) throw new Error(`unsupported-png-color-type:${colorType}`);
  const bitsPerPixel = channels * bitDepth;
  const bytesPerPixel = Math.max(1, Math.ceil(bitsPerPixel / 8));
  const rowBytes = Math.ceil((width * bitsPerPixel) / 8);
  const inflated = zlib.inflateSync(Buffer.concat(idats));
  const scan = Buffer.alloc(rowBytes * height);
  let src = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = inflated[src++];
    const row = y * rowBytes;
    const prev = y > 0 ? row - rowBytes : -1;
    for (let x = 0; x < rowBytes; x += 1) {
      const raw = inflated[src++];
      const left = x >= bytesPerPixel ? scan[row + x - bytesPerPixel] : 0;
      const up = prev >= 0 ? scan[prev + x] : 0;
      const ul = prev >= 0 && x >= bytesPerPixel ? scan[prev + x - bytesPerPixel] : 0;
      scan[row + x] = (raw + (filter === 1 ? left : filter === 2 ? up : filter === 3 ? Math.floor((left + up) / 2) : filter === 4 ? paeth(left, up, ul) : 0)) & 255;
    }
  }
  const rgba = new Uint8ClampedArray(width * height * 4);
  const getPacked = (row, x) => {
    if (bitDepth === 8) return scan[row + x];
    const bit = x * bitDepth;
    const b = scan[row + (bit >> 3)];
    const shift = 8 - bitDepth - (bit & 7);
    return (b >> shift) & ((1 << bitDepth) - 1);
  };
  for (let y = 0; y < height; y += 1) {
    const row = y * rowBytes;
    for (let x = 0; x < width; x += 1) {
      const out = (y * width + x) * 4;
      if (colorType === 6) {
        const i = row + x * 4;
        rgba[out] = scan[i]; rgba[out + 1] = scan[i + 1]; rgba[out + 2] = scan[i + 2]; rgba[out + 3] = scan[i + 3];
      } else if (colorType === 2) {
        const i = row + x * 3;
        rgba[out] = scan[i]; rgba[out + 1] = scan[i + 1]; rgba[out + 2] = scan[i + 2]; rgba[out + 3] = 255;
      } else if (colorType === 3) {
        const idx = getPacked(row, x);
        rgba[out] = palette?.[idx * 3] ?? 0; rgba[out + 1] = palette?.[idx * 3 + 1] ?? 0; rgba[out + 2] = palette?.[idx * 3 + 2] ?? 0; rgba[out + 3] = trns?.[idx] ?? 255;
      } else if (colorType === 4) {
        const i = row + x * 2;
        rgba[out] = scan[i]; rgba[out + 1] = scan[i]; rgba[out + 2] = scan[i]; rgba[out + 3] = scan[i + 1];
      } else {
        const g = expandSample(getPacked(row, x), bitDepth);
        rgba[out] = g; rgba[out + 1] = g; rgba[out + 2] = g; rgba[out + 3] = 255;
      }
    }
  }
  return { width, height, rgba };
}

function validCut(part, image) {
  if (!part || part.w <= 0 || part.h <= 0) return null;
  const x = Math.max(0, Math.floor(part.x));
  const y = Math.max(0, Math.floor(part.y));
  const w = Math.min(Math.floor(part.w), image.width - x);
  const h = Math.min(Math.floor(part.h), image.height - y);
  return w > 0 && h > 0 ? { ...part, x, y, w, h } : null;
}

function getPartBounds(imgcut, image, p) {
  const partIndex = p.partIndex ?? p.current?.partIndex ?? p.rawPart?.partIndex;
  const imgcutIndex = p.imgcutIndex ?? p.current?.imgcutIndex ?? p.rawPart?.imgcutIndex;
  if (!Number.isInteger(partIndex) || partIndex < 0 || (imgcutIndex ?? 0) < 0) return null;
  const opacity = Number.isFinite(p.opacity) ? p.opacity : 1;
  if (opacity <= 0) return null;
  const part = validCut(imgcut.parts?.[partIndex], image);
  if (!part) return null;
  const m = Array.isArray(p.matrix) && p.matrix.length === 6 ? p.matrix : null;
  if (!m) return null;
  const pivotX = Number.isFinite(p.pivotX) ? p.pivotX : part.w * 0.5;
  const pivotY = Number.isFinite(p.pivotY) ? p.pivotY : part.h * 0.5;
  const corners = [[-pivotX, -pivotY], [part.w - pivotX, -pivotY], [-pivotX, part.h - pivotY], [part.w - pivotX, part.h - pivotY]];
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (const [x, y] of corners) {
    const rx = m[0] * x + m[2] * y + m[4];
    const ry = m[1] * x + m[3] * y + m[5];
    left = Math.min(left, rx); top = Math.min(top, ry); right = Math.max(right, rx); bottom = Math.max(bottom, ry);
  }
  if (!Number.isFinite(left) || !Number.isFinite(top) || !Number.isFinite(right) || !Number.isFinite(bottom)) return null;
  return { left, top, right, bottom, width: right - left, height: bottom - top, part, pivotX, pivotY, opacity };
}

function alphaOver(dst, di, r, g, b, a) {
  if (a <= 0) return;
  const da = dst[di + 3] / 255;
  const sa = a / 255;
  const outA = sa + da * (1 - sa);
  if (outA <= 0) return;
  dst[di] = Math.round((r * sa + dst[di] * da * (1 - sa)) / outA);
  dst[di + 1] = Math.round((g * sa + dst[di + 1] * da * (1 - sa)) / outA);
  dst[di + 2] = Math.round((b * sa + dst[di + 2] * da * (1 - sa)) / outA);
  dst[di + 3] = Math.round(outA * 255);
}

function drawTransformedPart(dst, outW, outH, image, part, matrix, pivotX, pivotY, opacity, iconTransform) {
  const a = iconTransform.scale * matrix[0], b = iconTransform.scale * matrix[1], c = iconTransform.scale * matrix[2], d = iconTransform.scale * matrix[3];
  const e = iconTransform.x + iconTransform.scale * matrix[4], f = iconTransform.y + iconTransform.scale * matrix[5];
  const det = a * d - b * c;
  if (Math.abs(det) < 1e-9) return 0;
  const pts = [[-pivotX, -pivotY], [part.w - pivotX, -pivotY], [-pivotX, part.h - pivotY], [part.w - pivotX, part.h - pivotY]].map(([x, y]) => ({ x: a * x + c * y + e, y: b * x + d * y + f }));
  const minX = Math.max(0, Math.floor(Math.min(...pts.map((p) => p.x)) - 1));
  const maxX = Math.min(outW - 1, Math.ceil(Math.max(...pts.map((p) => p.x)) + 1));
  const minY = Math.max(0, Math.floor(Math.min(...pts.map((p) => p.y)) - 1));
  const maxY = Math.min(outH - 1, Math.ceil(Math.max(...pts.map((p) => p.y)) + 1));
  let drawn = 0;
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const px = x + 0.5 - e;
      const py = y + 0.5 - f;
      const lx = (d * px - c * py) / det;
      const ly = (-b * px + a * py) / det;
      const sx = Math.floor(lx + pivotX);
      const sy = Math.floor(ly + pivotY);
      if (sx < 0 || sy < 0 || sx >= part.w || sy >= part.h) continue;
      const si = ((part.y + sy) * image.width + part.x + sx) * 4;
      const a0 = Math.round(image.rgba[si + 3] * opacity);
      if (a0 <= 0) continue;
      alphaOver(dst, (y * outW + x) * 4, image.rgba[si], image.rgba[si + 1], image.rgba[si + 2], a0);
      drawn += 1;
    }
  }
  return drawn;
}

export function renderComposedInitialPose({ image, imgcut, model, anim }) {
  const inst = new BcuModelInstance(model);
  const animator = new BcuAnimator(anim);
  animator.frame = ENEMY_ICON_FRAME;
  animator.apply(inst);
  const drawList = inst.getBattleDrawList();
  const boundsList = drawList.map((p) => getPartBounds(imgcut, image, p)).filter(Boolean);
  if (!boundsList.length) throw new Error('composed-pose-no-visible-parts');
  const bounds = {
    left: Math.min(...boundsList.map((b) => b.left)),
    top: Math.min(...boundsList.map((b) => b.top)),
    right: Math.max(...boundsList.map((b) => b.right)),
    bottom: Math.max(...boundsList.map((b) => b.bottom))
  };
  bounds.width = bounds.right - bounds.left;
  bounds.height = bounds.bottom - bounds.top;
  if (!(bounds.width > 0 && bounds.height > 0)) throw new Error('composed-pose-invalid-bounds');
  const out = new Uint8ClampedArray(ENEMY_ICON_SIZE * ENEMY_ICON_SIZE * 4);
  const scale = Math.min(ENEMY_ICON_DRAW_SIZE / bounds.width, ENEMY_ICON_DRAW_SIZE / bounds.height);
  const iconTransform = {
    scale,
    x: (ENEMY_ICON_SIZE - bounds.width * scale) / 2 - bounds.left * scale,
    y: (ENEMY_ICON_SIZE - bounds.height * scale) / 2 - bounds.top * scale
  };
  let partsRendered = 0;
  const partsSkipped = [];
  for (const p of drawList) {
    const b = getPartBounds(imgcut, image, p);
    if (!b) {
      partsSkipped.push({ index: p.index ?? null, reason: 'not-visible-or-invalid-cut', partIndex: p.partIndex ?? null });
      continue;
    }
    const pixels = drawTransformedPart(out, ENEMY_ICON_SIZE, ENEMY_ICON_SIZE, image, b.part, p.matrix, b.pivotX, b.pivotY, b.opacity, iconTransform);
    if (pixels > 0) partsRendered += 1;
    else partsSkipped.push({ index: p.index ?? null, reason: 'outside-output-or-transparent', partIndex: p.partIndex ?? null });
  }
  if (partsRendered <= 0) throw new Error('composed-pose-rendered-zero-parts');
  return { png: encodePngRgba(ENEMY_ICON_SIZE, ENEMY_ICON_SIZE, out), composedBounds: bounds, partsRendered, partsSkipped, selectedFrame: ENEMY_ICON_FRAME, outputSize: ENEMY_ICON_SIZE };
}

export function renderSingleCutFallback({ image, imgcut }) {
  const valid = (imgcut.parts || []).map((p) => validCut(p, image)).filter(Boolean).sort((a, b) => (b.w * b.h) - (a.w * a.h) || a.index - b.index);
  if (!valid.length) throw new Error('imgcut-invalid');
  const part = valid[0];
  const out = new Uint8ClampedArray(ENEMY_ICON_SIZE * ENEMY_ICON_SIZE * 4);
  const scale = Math.min(ENEMY_ICON_DRAW_SIZE / part.w, ENEMY_ICON_DRAW_SIZE / part.h);
  const dw = Math.max(1, Math.round(part.w * scale));
  const dh = Math.max(1, Math.round(part.h * scale));
  const ox = Math.floor((ENEMY_ICON_SIZE - dw) / 2);
  const oy = Math.floor((ENEMY_ICON_SIZE - dh) / 2);
  for (let y = 0; y < dh; y += 1) {
    for (let x = 0; x < dw; x += 1) {
      const sx = part.x + Math.min(part.w - 1, Math.floor(x / scale));
      const sy = part.y + Math.min(part.h - 1, Math.floor(y / scale));
      const si = (sy * image.width + sx) * 4;
      const di = ((oy + y) * ENEMY_ICON_SIZE + ox + x) * 4;
      out[di] = image.rgba[si]; out[di + 1] = image.rgba[si + 1]; out[di + 2] = image.rgba[si + 2]; out[di + 3] = image.rgba[si + 3];
    }
  }
  return { png: encodePngRgba(ENEMY_ICON_SIZE, ENEMY_ICON_SIZE, out), selectedCut: { index: part.index, x: part.x, y: part.y, w: part.w, h: part.h, name: part.name || null }, outputSize: ENEMY_ICON_SIZE };
}

export async function generateEnemyIconForEntry({ enemyId, entry, allowlisted = false }) {
  const files = selectedActorFiles(entry);
  let source = null;
  let sourceKind = null;
  let sourceImagePath = files.image || null;
  let sourceImgcutPath = files.imgcut || null;
  let sourceMamodelPath = files.model || null;
  let sourceMaanimPath = resolveNeutralAnimation(files)?.path || null;
  const bundleSource = await readActorBundleFiles(entry);
  if (bundleSource?.image && bundleSource.imgcutText && bundleSource.modelText && bundleSource.neutralAnim?.text) {
    source = bundleSource;
    sourceKind = 'actor-bundle';
    sourceImagePath = `${entry.bundleRef.bundlePath}:image.png`;
    sourceImgcutPath = `${entry.bundleRef.bundlePath}:imgcut.imgcut`;
    sourceMamodelPath = `${entry.bundleRef.bundlePath}:model.mamodel`;
    sourceMaanimPath = `${entry.bundleRef.bundlePath}:${source.neutralAnim.internalPath}`;
  } else {
    source = await readActorRawFiles(files);
    sourceKind = source ? 'raw-actor-source' : null;
  }

  const base = {
    enemyId,
    actorKey: `enemy:${enemyId}`,
    sourceImagePath,
    sourceImgcutPath,
    sourceMamodelPath,
    sourceMaanimPath,
    frame: 0,
    outputZipPath: ENEMY_ICON_ZIP,
    outputInternalPath: `enemy/${enemyId}.png`,
    width: ENEMY_ICON_SIZE,
    height: ENEMY_ICON_SIZE,
    listedInErrorAllowlist: allowlisted
  };

  if (!source?.image) return { ...base, status: allowlisted ? 'expected-missing' : 'failed', failureClass: 'source-missing', failureReason: 'missing image/imgcut/model/neutral animation source' };
  let image, imgcut, model, anim;
  try {
    image = decodePng(source.image);
    imgcut = parseImgcut(source.imgcutText);
  } catch (error) {
    return { ...base, status: 'failed', compositionMethod: 'failed', failureClass: 'image-or-imgcut-invalid', failureReason: error?.message || String(error) };
  }
  try {
    model = parseModel(source.modelText);
    anim = parseAnim(source.neutralAnim.text);
    const rendered = renderComposedInitialPose({ image, imgcut, model, anim });
    return {
      ...base,
      status: 'generated',
      iconGenerationSource: sourceKind,
      compositionMethod: 'composed-initial-pose',
      composedBounds: rendered.composedBounds,
      selectedFrame: rendered.selectedFrame,
      outputSize: rendered.outputSize,
      partsRendered: rendered.partsRendered,
      partsSkipped: rendered.partsSkipped,
      png: rendered.png,
      sha256: sha256(rendered.png),
      failureClass: null,
      failureReason: null
    };
  } catch (error) {
    try {
      const fallback = renderSingleCutFallback({ image, imgcut });
      const reason = `composition unavailable: ${error?.message || String(error)}`;
      return {
        ...base,
        status: 'generated',
        iconGenerationSource: sourceKind,
        compositionMethod: 'single-cut-degraded-fallback',
        selectedCut: fallback.selectedCut,
        outputSize: fallback.outputSize,
        fallbackReason: reason,
        partsRendered: null,
        partsSkipped: [],
        png: fallback.png,
        sha256: sha256(fallback.png),
        failureClass: null,
        failureReason: null
      };
    } catch (fallbackError) {
      return { ...base, status: 'failed', compositionMethod: 'failed', failureClass: fallbackError?.message === 'imgcut-invalid' ? 'imgcut-invalid' : 'composition-failed', failureReason: `${error?.message || String(error)}; fallback: ${fallbackError?.message || String(fallbackError)}` };
    }
  }
}

export async function buildEnemyIconGenerationReport({ apply = false } = {}) {
  const coreDb = await loadCoreDb();
  const actorIndex = await readJson('public/assets/generated/bcu-actor-index.json', { entries: [], byKey: {} });
  const allowlist = await loadAllowlistAudit();
  const allowEnemyIds = new Set(allowlist.enemyIds);
  const enemyIds = await collectEnemyIds({ coreDb, actorIndex });
  const generated = [];
  const entries = [];
  for (const enemyId of enemyIds) {
    const entry = actorIndex.byKey?.[`enemy:${enemyId}`] || actorIndex.entries?.find((e) => e.key === `enemy:${enemyId}`) || null;
    const item = await generateEnemyIconForEntry({ enemyId, entry, allowlisted: allowEnemyIds.has(enemyId) });
    const { png, ...record } = item;
    generated.push(record);
    if (png) entries.push({ name: `enemy/${enemyId}.png`, data: png });
  }
  entries.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  const bundleJson = {
    bundleKey: 'icon:enemy',
    kind: 'icon',
    generatedAt: FIXED_DATE,
    generationSource: 'actor-assets-initial-pose',
    iconCount: entries.length,
    width: ENEMY_ICON_SIZE,
    height: ENEMY_ICON_SIZE,
    frame: ENEMY_ICON_FRAME,
    animationRole: 'idle',
    entries: generated.filter((r) => r.status === 'generated').map((r) => ({ key: r.actorKey, internalPath: r.outputInternalPath, compositionMethod: r.compositionMethod, width: r.width, height: r.height, frame: r.frame, sha256: r.sha256 }))
  };
  const zipEntries = [{ name: 'bundle.json', data: Buffer.from(JSON.stringify(bundleJson, null, 2)) }, ...entries];
  if (apply) {
    await writeStoreZip(ENEMY_ICON_ZIP, zipEntries);
    const manifest = await readJson('public/assets/generated/bcu-bundle-manifest.json', { schemaVersion: 1, generatedAt: FIXED_DATE, zipFormat: 'store-only', generationMode: 'all', bundles: {} });
    manifest.bundles ||= {};
    manifest.bundles['icon:enemy'] = {
      kind: 'icon',
      key: 'icon:enemy',
      bundlePath: ENEMY_ICON_ZIP,
      status: 'full',
      iconCount: entries.length,
      width: ENEMY_ICON_SIZE,
      height: ENEMY_ICON_SIZE,
      frame: ENEMY_ICON_FRAME,
      animationRole: 'idle',
      sizeBytes: (await fs.stat(ENEMY_ICON_ZIP)).size,
      hash: await sha256(await fs.readFile(ENEMY_ICON_ZIP)),
      generationSource: 'actor-assets-initial-pose'
    };
    await writeJson('public/assets/generated/bcu-bundle-manifest.json', manifest);
  }
  const summary = {
    totalEnemies: enemyIds.length,
    generated: generated.filter((r) => r.status === 'generated').length,
    failed: generated.filter((r) => r.status === 'failed').length,
    expectedMissing: generated.filter((r) => r.status === 'expected-missing').length,
    composedInitialPose: generated.filter((r) => r.compositionMethod === 'composed-initial-pose').length,
    singleCutDegradedFallback: generated.filter((r) => r.compositionMethod === 'single-cut-degraded-fallback').length,
    failedIds: generated.filter((r) => r.status === 'failed').map((r) => r.enemyId),
    expectedMissingIds: generated.filter((r) => r.status === 'expected-missing').map((r) => r.enemyId),
    degradedFallbackIds: generated.filter((r) => r.compositionMethod === 'single-cut-degraded-fallback').map((r) => r.enemyId),
    zipSizeBytes: apply && await exists(ENEMY_ICON_ZIP) ? (await fs.stat(ENEMY_ICON_ZIP)).size : null
  };
  return { schemaVersion: 1, generatedAt: new Date().toISOString(), mode: apply ? 'apply' : 'dry-run', outputZipPath: ENEMY_ICON_ZIP, summary, enemies: generated };
}

export function renderGeneratedIconsMarkdown(report) {
  const degraded = report.enemies.filter((r) => r.compositionMethod === 'single-cut-degraded-fallback');
  const failed = report.enemies.filter((r) => r.status === 'failed' || r.status === 'expected-missing');
  const targets = report.enemies.filter((r) => REGRESSION_ENEMY_IDS.includes(r.enemyId));
  return `# Generated Enemy Icons Report

Generated: ${report.generatedAt}
Mode: ${report.mode}

## Summary

- total enemies: ${report.summary.totalEnemies}
- generated: ${report.summary.generated}
- composed initial pose: ${report.summary.composedInitialPose}
- single-cut degraded fallback: ${report.summary.singleCutDegradedFallback}
- failed: ${report.summary.failed}
- expected missing: ${report.summary.expectedMissing}
- zip size bytes: ${report.summary.zipSizeBytes ?? 'dry-run'}

## Degraded Fallback

${degraded.map((r) => `- enemy:${r.enemyId}: ${r.fallbackReason}; selected cut ${JSON.stringify(r.selectedCut)}`).join('\n') || '- none'}

## Failed Or Expected Missing

${failed.map((r) => `- enemy:${r.enemyId}: ${r.status}; ${r.failureClass || '-'}; ${r.failureReason || '-'}`).join('\n') || '- none'}

## Regression Targets

| enemy | status | method | sha256/failure |
| --- | --- | --- | --- |
${targets.map((r) => `| ${r.enemyId} | ${r.status} | ${r.compositionMethod || '-'} | ${r.sha256 || r.failureReason || '-'} |`).join('\n')}
`;
}

export async function writeEnemyGenerationReports(report) {
  await ensureTmp();
  await writeJson('tmp/generated-enemy-icons-report.json', report);
  await writeText('tmp/generated-enemy-icons-report.md', renderGeneratedIconsMarkdown(report));
}
