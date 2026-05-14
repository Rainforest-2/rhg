import { readJson, readStoreZipEntries, validatePngBuffer } from './bcu-semantic-utils.mjs';
import { parseImgcut } from '../js/bcu/BcuImgcutParser.js';
import { parseModel } from '../js/bcu/BcuModelParser.js';
import { parseAnim } from '../js/bcu/BcuAnimParser.js';
import { BcuModelInstance } from '../js/bcu/BcuModelInstance.js';
import { BcuAnimator } from '../js/bcu/BcuAnimator.js';

const actor = await readJson('public/assets/generated/bcu-actor-index.json', { entries: [] });
const manifest = await readJson('public/assets/generated/bcu-bundle-manifest.json', { bundles: {} });
const required = ['bundle.json', 'image.png', 'imgcut.imgcut', 'model.mamodel', 'move.maanim', 'idle.maanim', 'attack.maanim', 'kb.maanim'];
const failures = [];
let checked = 0;

const text = (buf) => new TextDecoder().decode(buf);
const fail = (entry, bundlePath, internalPath, reason, extra = {}) => failures.push({
  semanticKey: entry.key,
  bundlePath,
  sourcePack: entry.selected?.sourcePack || null,
  internalPath,
  sourceRawPaths: entry.diagnostics?.sourceRawPaths || [],
  reason,
  ...extra
});

function boundsFor(model, imgcut) {
  const drawList = model.getBattleDrawList();
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of drawList) {
    if (p.opacity <= 0) continue;
    if (!Number.isInteger(p.partIndex) || p.partIndex < 0) continue;
    const part = imgcut.parts[p.partIndex];
    if (!part || part.w <= 0 || part.h <= 0) continue;
    if (!Array.isArray(p.matrix) || p.matrix.length !== 6) return { invalid: 'nan-transform' };
    const pivotX = Number.isFinite(p.pivotX) ? p.pivotX : part.w * 0.5;
    const pivotY = Number.isFinite(p.pivotY) ? p.pivotY : part.h * 0.5;
    const corners = [[-pivotX, -pivotY], [part.w - pivotX, -pivotY], [-pivotX, part.h - pivotY], [part.w - pivotX, part.h - pivotY]];
    for (const [x, y] of corners) {
      const rx = p.matrix[0] * x + p.matrix[2] * y + p.matrix[4];
      const ry = p.matrix[1] * x + p.matrix[3] * y + p.matrix[5];
      if (!Number.isFinite(rx) || !Number.isFinite(ry)) return { invalid: 'nan-transform' };
      minX = Math.min(minX, rx); minY = Math.min(minY, ry); maxX = Math.max(maxX, rx); maxY = Math.max(maxY, ry);
    }
  }
  if (!Number.isFinite(minX)) return null;
  return { left: minX, top: minY, right: maxX, bottom: maxY, width: maxX - minX, height: maxY - minY };
}

for (const entry of actor.entries || []) {
  if (entry.status !== 'full') continue;
  const bundlePath = entry.bundleRef?.bundlePath;
  if (!bundlePath || !manifest.bundles?.[entry.bundleRef.bundleKey]) {
    fail(entry, bundlePath || null, 'bundle.json', 'missing-entry');
    continue;
  }
  checked += 1;
  let zip;
  try { zip = await readStoreZipEntries(bundlePath); } catch (error) { fail(entry, bundlePath, 'bundle.json', 'zip-read-failed', { message: error.message }); continue; }
  for (const name of required) if (!zip.has(name)) fail(entry, bundlePath, name, 'missing-entry');
  if (required.some((name) => !zip.has(name))) continue;
  const png = validatePngBuffer(zip.get('image.png'));
  if (!png.valid) { fail(entry, bundlePath, 'image.png', png.reason); continue; }
  let imgcut, model, bundleJson;
  try { bundleJson = JSON.parse(text(zip.get('bundle.json'))); } catch (error) { fail(entry, bundlePath, 'bundle.json', 'bundle-json-parse-failed', { message: error.message }); continue; }
  try { imgcut = parseImgcut(text(zip.get('imgcut.imgcut'))); } catch (error) { fail(entry, bundlePath, 'imgcut.imgcut', 'imgcut-parse-failed', { message: error.message }); continue; }
  const clampedImgcutRects = (imgcut.parts || []).filter((part) => part.x < 0 || part.y < 0 || part.w <= 0 || part.h <= 0 || part.x + part.w > png.width || part.y + part.h > png.height).length;
  try { model = parseModel(text(zip.get('model.mamodel'))); } catch (error) { fail(entry, bundlePath, 'model.mamodel', 'model-parse-failed', { message: error.message }); continue; }
  let clampedModelPartRefs = 0;
  for (const part of model.parts || []) {
    if (Number.isInteger(part.partIndex) && part.partIndex >= 0 && part.partIndex >= imgcut.parts.length) {
      clampedModelPartRefs += 1;
      part.partIndex = 0;
    }
  }
  for (const role of ['move', 'idle', 'attack', 'kb']) {
    const internalPath = `${role}.maanim`;
    let anim;
    try { anim = parseAnim(text(zip.get(internalPath))); } catch (error) { fail(entry, bundlePath, internalPath, 'maanim-parse-failed', { message: error.message }); continue; }
    for (const track of anim.tracks || []) {
      if (!Number.isInteger(track.partId) || track.partId < 0 || track.partId >= model.parts.length) fail(entry, bundlePath, internalPath, 'animation-part-id-out-of-range', { role, partId: track.partId, modelPartCount: model.parts.length });
    }
    const instance = new BcuModelInstance(model);
    const animator = new BcuAnimator(anim);
    animator.apply(instance);
    const b = boundsFor(instance, imgcut);
    if (b?.invalid) fail(entry, bundlePath, internalPath, b.invalid, { role, clampedImgcutRects, clampedModelPartRefs });
    else if (b && (b.width > Math.max(png.width * 4, 4096) || b.height > Math.max(png.height * 4, 4096))) fail(entry, bundlePath, internalPath, 'initial-draw-bounds-outlier', { role, bounds: b, image: { width: png.width, height: png.height }, clampedImgcutRects, clampedModelPartRefs });
  }
  const sources = Object.values(bundleJson.entries?.animations || {}).concat([bundleJson.entries?.image, bundleJson.entries?.imgcut, bundleJson.entries?.model]).filter(Boolean);
  const dirs = new Set(sources.map((p) => String(p).split('/').slice(0, -1).join('/')));
  if (dirs.size > 1) fail(entry, bundlePath, 'bundle.json', 'mixed-source-directory', { dirs: [...dirs] });
}

if (failures.length) {
  console.error(JSON.stringify({ failures: failures.slice(0, 80), total: failures.length }, null, 2));
  process.exit(1);
}
console.log(`actor bundle compatibility ok checked=${checked}`);
