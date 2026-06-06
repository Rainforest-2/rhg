import { parseImgcut } from '../bcu/BcuImgcutParser.js';
import { parseModel } from '../bcu/BcuModelParser.js';
import { parseAnim } from '../bcu/BcuAnimParser.js';
import { BcuModelInstance } from '../bcu/BcuModelInstance.js';
import { BcuAnimator } from '../bcu/BcuAnimator.js';

const ICON_SIZE = 512;
const ICON_MARGIN = 20;
const ICON_DRAW_SIZE = ICON_SIZE - ICON_MARGIN * 2;

const textDecoder = new TextDecoder();

function bytesToText(bytes) {
  return textDecoder.decode(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
}

function loadImageFromUrl(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`actor icon image load failed: ${url}`));
    image.src = url;
  });
}

function validCut(part, image) {
  if (!part || !image || part.w <= 0 || part.h <= 0) return null;
  const x = Math.max(0, Math.floor(part.x));
  const y = Math.max(0, Math.floor(part.y));
  const w = Math.min(Math.floor(part.w), (image.naturalWidth || image.width || 0) - x);
  const h = Math.min(Math.floor(part.h), (image.naturalHeight || image.height || 0) - y);
  return w > 0 && h > 0 ? { ...part, x, y, w, h } : null;
}

function partBounds(imgcut, image, drawPart) {
  const partIndex = drawPart?.partIndex ?? drawPart?.current?.partIndex ?? drawPart?.rawPart?.partIndex;
  const opacity = Number.isFinite(drawPart?.opacity) ? drawPart.opacity : 1;
  if (!Number.isInteger(partIndex) || partIndex < 0 || opacity <= 0) return null;
  const part = validCut(imgcut.parts?.[partIndex], image);
  const m = Array.isArray(drawPart?.matrix) && drawPart.matrix.length === 6 ? drawPart.matrix : null;
  if (!part || !m) return null;
  const pivotX = Number.isFinite(drawPart.pivotX) ? drawPart.pivotX : part.w * 0.5;
  const pivotY = Number.isFinite(drawPart.pivotY) ? drawPart.pivotY : part.h * 0.5;
  const corners = [[-pivotX, -pivotY], [part.w - pivotX, -pivotY], [-pivotX, part.h - pivotY], [part.w - pivotX, part.h - pivotY]];
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const [x, y] of corners) {
    const rx = m[0] * x + m[2] * y + m[4];
    const ry = m[1] * x + m[3] * y + m[5];
    left = Math.min(left, rx);
    top = Math.min(top, ry);
    right = Math.max(right, rx);
    bottom = Math.max(bottom, ry);
  }
  if (![left, top, right, bottom].every(Number.isFinite) || right <= left || bottom <= top) return null;
  return { left, top, right, bottom, width: right - left, height: bottom - top, part, matrix: m, pivotX, pivotY, opacity };
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('actor composed icon canvas.toBlob failed')), 'image/png');
  });
}

function chooseNeutralAnim(archive) {
  if (archive.has('idle.maanim')) return 'idle.maanim';
  if (archive.has('move.maanim')) return 'move.maanim';
  return null;
}

export async function createActorBundleComposedIconUrl(provider, actorKey, options = {}) {
  if (!provider || typeof document === 'undefined' || typeof Image === 'undefined') return null;
  const { entry, archive, bundleRef } = await provider.readActorBundle(actorKey);
  const imageBytes = archive.get('image.png');
  const imgcutBytes = archive.get('imgcut.imgcut');
  const modelBytes = archive.get('model.mamodel');
  const animName = chooseNeutralAnim(archive);
  const animBytes = animName ? archive.get(animName) : null;
  if (!imageBytes || !imgcutBytes || !modelBytes || !animBytes) throw new Error(`actor composed icon source missing: ${actorKey}`);

  const imageUrl = provider.createObjectUrl
    ? await provider.createObjectUrl(bundleRef, 'image.png', 'image/png')
    : URL.createObjectURL(new Blob([imageBytes], { type: 'image/png' }));
  const image = await loadImageFromUrl(imageUrl);
  const imgcut = parseImgcut(bytesToText(imgcutBytes));
  const model = parseModel(bytesToText(modelBytes));
  const anim = parseAnim(bytesToText(animBytes));
  const instance = new BcuModelInstance(model);
  const animator = new BcuAnimator(anim);
  animator.frame = Number.isFinite(options.frame) ? options.frame : 0;
  animator.apply(instance);
  const drawList = instance.getBattleDrawList();
  const boundsList = drawList.map((p) => partBounds(imgcut, image, p)).filter(Boolean);
  if (!boundsList.length) throw new Error(`actor composed icon has no visible parts: ${actorKey}`);

  const bounds = {
    left: Math.min(...boundsList.map((b) => b.left)),
    top: Math.min(...boundsList.map((b) => b.top)),
    right: Math.max(...boundsList.map((b) => b.right)),
    bottom: Math.max(...boundsList.map((b) => b.bottom))
  };
  bounds.width = bounds.right - bounds.left;
  bounds.height = bounds.bottom - bounds.top;
  if (!(bounds.width > 0 && bounds.height > 0)) throw new Error(`actor composed icon invalid bounds: ${actorKey}`);

  const canvas = document.createElement('canvas');
  canvas.width = ICON_SIZE;
  canvas.height = ICON_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d canvas unavailable for actor composed icon');
  ctx.clearRect(0, 0, ICON_SIZE, ICON_SIZE);
  ctx.imageSmoothingEnabled = true;
  if ('imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = 'high';

  const scale = Math.min(ICON_DRAW_SIZE / bounds.width, ICON_DRAW_SIZE / bounds.height);
  const ox = (ICON_SIZE - bounds.width * scale) / 2 - bounds.left * scale;
  const oy = (ICON_SIZE - bounds.height * scale) / 2 - bounds.top * scale;
  let rendered = 0;

  for (const p of drawList) {
    const b = partBounds(imgcut, image, p);
    if (!b) continue;
    const m = b.matrix;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, b.opacity));
    ctx.setTransform(scale * m[0], scale * m[1], scale * m[2], scale * m[3], ox + scale * m[4], oy + scale * m[5]);
    ctx.drawImage(image, b.part.x, b.part.y, b.part.w, b.part.h, -b.pivotX, -b.pivotY, b.part.w, b.part.h);
    ctx.restore();
    rendered += 1;
  }
  if (rendered <= 0) throw new Error(`actor composed icon rendered zero parts: ${actorKey}`);

  const blob = await canvasToBlob(canvas);
  const url = URL.createObjectURL(blob);
  provider.objectUrls?.add?.(url);
  provider.diagnostics?.inferredIconEntries?.push?.({
    semanticKey: actorKey,
    bundlePath: bundleRef.bundlePath,
    internalPath: `composed:${animName}`,
    sourceStatus: 'runtime-composed-actor-icon',
    selectedFrame: animator.frame,
    outputSize: ICON_SIZE,
    source: 'ActorBundleIconComposer'
  });
  provider.diagnostics?.inferredIconEntries?.splice?.(80);
  globalThis.__BCU_LAST_COMPOSED_ACTOR_ICON__ = { actorKey, bundlePath: bundleRef.bundlePath, animName, rendered, bounds, entryStatus: entry?.status || null };
  return url;
}
