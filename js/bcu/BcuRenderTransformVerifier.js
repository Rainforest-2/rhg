import { readFile } from 'node:fs/promises';
import { parseModel } from './BcuModelParser.js';
import { parseAnim } from './BcuAnimParser.js';
import { parseImgcut } from './BcuImgcutParser.js';
import { BcuModelInstance } from './BcuModelInstance.js';
import { BcuAnimator } from './BcuAnimator.js';
import { buildPlayablePreviewAssets } from '../battle/PlayableCharacterRegistry.js';

const readText = async (path) => readFile(path.replace(/^\.\//, ''), 'utf8');

const ANIM4_E = (p) => [
  { id: 'anim00', file: `${p}00.maanim` },
  { id: 'anim01', file: `${p}01.maanim` },
  { id: 'anim02', file: `${p}02.maanim` },
  { id: 'anim03', file: `${p}03.maanim` }
];

async function loadAssetData(asset) {
  const [modelText, imgcutText] = await Promise.all([
    readText(`${asset.baseDir}${asset.model}`),
    readText(`${asset.baseDir}${asset.imgcut}`)
  ]);
  const model = parseModel(modelText);
  const imgcut = parseImgcut(imgcutText);
  let anim = null;
  for (const a of asset.animations || []) {
    try { anim = parseAnim(await readText(`${asset.baseDir}${a.file}`)); break; } catch (_e) {}
  }
  return { model, imgcut, anim };
}

function boundsFromDrawList(drawList, imgcut) {
  const parts = imgcut?.parts || [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const d of drawList) {
    const part = parts[d.partIndex];
    if (!part || part.w <= 0 || part.h <= 0) continue;
    const pivotX = Number.isFinite(d.pivotX) ? d.pivotX : part.w * 0.5;
    const pivotY = Number.isFinite(d.pivotY) ? d.pivotY : part.h * 0.5;
    const corners = [[-pivotX, -pivotY], [part.w - pivotX, -pivotY], [-pivotX, part.h - pivotY], [part.w - pivotX, part.h - pivotY]];
    for (const [x, y] of corners) {
      const wx = d.matrix[0] * x + d.matrix[2] * y + d.matrix[4];
      const wy = d.matrix[1] * x + d.matrix[3] * y + d.matrix[5];
      minX = Math.min(minX, wx); minY = Math.min(minY, wy); maxX = Math.max(maxX, wx); maxY = Math.max(maxY, wy);
    }
  }
  if (!Number.isFinite(minX)) return { width: 0, height: 0, centerX: 0, centerY: 0 };
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY, centerX: (minX + maxX) / 2, centerY: (minY + maxY) / 2 };
}

async function evaluateAsset(asset) {
  const { model, imgcut, anim } = await loadAssetData(asset);
  const inst = new BcuModelInstance(model);
  if (anim) {
    const animator = new BcuAnimator(anim);
    animator.frame = 1;
    animator.apply(inst);
  }
  const drawList = inst.getBattleDrawList();
  return boundsFromDrawList(drawList, imgcut);
}

function checkBounds(assetId, b) {
  const ok = b.width > 0 && b.height > 0 && b.width < 2000 && b.height < 2000 && Math.abs(b.centerX) < 1000 && Math.abs(b.centerY) < 1000;
  return ok ? null : `${assetId}: abnormal bounds ${JSON.stringify(b)}`;
}

export async function verifyBcuRootControlPartTransform() {
  const targets = [
    { id: 'unit-010-f', baseDir: './public/assets/bcu/000004/org/unit/010/f/', image: '010_f.png', imgcut: '010_f.imgcut', model: '010_f.mamodel', animations: ANIM4_E('010_f') },
    { id: 'unit-011-f', baseDir: './public/assets/bcu/000004/org/unit/011/f/', image: '011_f.png', imgcut: '011_f.imgcut', model: '011_f.mamodel', animations: ANIM4_E('011_f') },
    { id: 'unit-012-f', baseDir: './public/assets/bcu/000004/org/unit/012/f/', image: '012_f.png', imgcut: '012_f.imgcut', model: '012_f.mamodel', animations: ANIM4_E('012_f') },
    { id: 'unit-000-f', baseDir: './public/assets/bcu/000004/org/unit/000/f/', image: '000_f.png', imgcut: '000_f.imgcut', model: '000_f.mamodel', animations: ANIM4_E('000_f') },
    { id: 'unit-001-f', baseDir: './public/assets/bcu/000004/org/unit/001/f/', image: '001_f.png', imgcut: '001_f.imgcut', model: '001_f.mamodel', animations: ANIM4_E('001_f') },
    { id: 'enemy-000', baseDir: './public/assets/bcu/000002/org/enemy/000/', image: '000_e.png', imgcut: '000_e.imgcut', model: '000_e.mamodel', animations: ANIM4_E('000_e') }
  ];
  const boundsByAsset = {};
  const errors = [];
  for (const t of targets) {
    const b = await evaluateAsset(t);
    boundsByAsset[t.id] = b;
    const err = checkBounds(t.id, b);
    if (err) errors.push(err);
  }
  return { ok: errors.length === 0, checks: targets.length, boundsByAsset, errors };
}

export async function verifyPlayableUnitRenderBounds() {
  const assets = buildPlayablePreviewAssets(ANIM4_E).filter((a) => a.group === 'dogs' || a.group === 'cats');
  const boundsByAsset = {};
  const errors = [];
  for (const asset of assets) {
    const b = await evaluateAsset(asset);
    boundsByAsset[asset.id] = b;
    const err = checkBounds(asset.id, b);
    if (err) errors.push(err);
  }
  return { ok: errors.length === 0, checks: assets.length, boundsByAsset, errors };
}
