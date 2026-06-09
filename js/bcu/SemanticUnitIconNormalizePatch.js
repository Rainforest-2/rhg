import { SemanticAssetProvider } from './SemanticAssetProvider.js';

const PATCH_FLAG = Symbol.for('wanko-battle.semantic-unit-icon-normalize.v1');
const UNIT_KEY_RE = /^unit:\d+:(f|c|s|u)$/;
const MIN_CROP_SIZE = 96;
const ALPHA_THRESHOLD = 8;
const PADDING = 4;

function loadImageFromUrl(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`unit icon image load failed:${url}`));
    image.src = url;
  });
}

function findAlphaBounds(data, width, height) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha <= ALPHA_THRESHOLD) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < minX || maxY < minY) return null;
  minX = Math.max(0, minX - PADDING);
  minY = Math.max(0, minY - PADDING);
  maxX = Math.min(width - 1, maxX + PADDING);
  maxY = Math.min(height - 1, maxY + PADDING);
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

async function canvasToBlob(canvas) {
  return await new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('unit icon canvas crop failed')), 'image/png');
  });
}

async function normalizeUnitIconUrl(provider, actorKey, bundleRef, internalPath) {
  const rawUrl = await provider.createObjectUrl(bundleRef, internalPath, 'image/png');
  let image;
  try {
    image = await loadImageFromUrl(rawUrl);
  } catch (error) {
    URL.revokeObjectURL(rawUrl);
    throw error;
  }
  const width = image.naturalWidth || image.width || 0;
  const height = image.naturalHeight || image.height || 0;
  if (width !== height || width < MIN_CROP_SIZE || typeof document === 'undefined') {
    return { url: rawUrl, debug: { actorKey, changed: false, reason: 'not-large-square-unit-icon', sourceSize: { width, height } } };
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return { url: rawUrl, debug: { actorKey, changed: false, reason: 'canvas-unavailable', sourceSize: { width, height } } };
  ctx.drawImage(image, 0, 0);
  const imageData = ctx.getImageData(0, 0, width, height);
  const bounds = findAlphaBounds(imageData.data, width, height);
  if (!bounds || (bounds.width >= width - 2 && bounds.height >= height - 2)) {
    return { url: rawUrl, debug: { actorKey, changed: false, reason: bounds ? 'already-tight' : 'empty-alpha', sourceSize: { width, height }, crop: bounds } };
  }
  const out = document.createElement('canvas');
  out.width = bounds.width;
  out.height = bounds.height;
  out.getContext('2d')?.drawImage(canvas, bounds.x, bounds.y, bounds.width, bounds.height, 0, 0, bounds.width, bounds.height);
  const croppedBlob = await canvasToBlob(out);
  const croppedUrl = URL.createObjectURL(croppedBlob);
  provider.objectUrls?.add?.(croppedUrl);
  URL.revokeObjectURL(rawUrl);
  return { url: croppedUrl, debug: { actorKey, changed: true, reason: 'runtime-alpha-bbox-cropped', sourceSize: { width, height }, crop: bounds, outputSize: { width: bounds.width, height: bounds.height } } };
}

export function installSemanticUnitIconNormalizePatch() {
  const proto = SemanticAssetProvider?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;
  const original = proto.getActorUiIconUrl;
  proto.getActorUiIconUrl = async function getActorUiIconUrlUnitNormalized(actorKey) {
    const key = String(actorKey || '');
    if (!UNIT_KEY_RE.test(key)) return await original.call(this, actorKey);
    if (!this.unitIconNormalizedUrlCache) this.unitIconNormalizedUrlCache = new Map();
    if (this.unitIconNormalizedUrlCache.has(key)) return this.unitIconNormalizedUrlCache.get(key);
    const promise = (async () => {
      const { bundleRef, internalPath } = await this.readIconBundle(key);
      const result = await normalizeUnitIconUrl(this, key, bundleRef, internalPath);
      globalThis.__BCU_UNIT_ICON_NORMALIZE_DEBUG__ = {
        installed: true,
        last: result.debug,
        note: 'Only unit:* icons are alpha-cropped. enemy:* icon URLs still use the original provider path.'
      };
      return result.url;
    })().catch((error) => {
      this.unitIconNormalizedUrlCache.delete(key);
      throw error;
    });
    this.unitIconNormalizedUrlCache.set(key, promise);
    return await promise;
  };
}

installSemanticUnitIconNormalizePatch();
