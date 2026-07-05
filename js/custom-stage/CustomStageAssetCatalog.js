// Async, cached image/audio URL resolvers for the custom-stage builder preview UI.
//
// Every URL comes from the SAME semantic asset provider + music catalog the real battle uses
// (see BcuCastleAssetLoader, StageBackgroundLoader, BcuPlayerCastleAssetLoader, MusicCatalog).
// There is NO dummy/placeholder fallback: an asset that does not resolve returns null so the
// caller can show an honest "画像なし" state instead of a fake image.
//
// Background/castle blobs get their own object URLs (via readBlobByBundleRef) so they are NOT in
// the provider's objectUrls set — a battle's clearObjectUrls() therefore cannot revoke a thumbnail
// out from under the editor. Enemy icons reuse the provider's own cached UI-icon URLs.
import { getBcuAssetDatabase } from '../bcu/BcuAssetDatabase.js';
import { musicCatalog } from '../audio/MusicCatalog.js';
import { parseImgcut } from '../bcu/BcuImgcutParser.js';

function provider() {
  try { return getBcuAssetDatabase()?.semanticProvider || null; } catch { return null; }
}

const urlCache = new Map(); // cacheKey -> Promise<string|null>

function cached(key, factory) {
  if (urlCache.has(key)) return urlCache.get(key);
  const promise = Promise.resolve().then(factory).catch(() => null);
  urlCache.set(key, promise);
  return promise;
}

// A thumbnail <img> that fails to decode (e.g. its blob URL was revoked by a battle teardown)
// should be retried on the next render rather than staying broken forever.
export function evictAsset(cacheKey) { urlCache.delete(cacheKey); }

async function ownObjectUrl(bundleRef, internalPath) {
  const p = provider();
  if (!p || !bundleRef) return null;
  const blob = await p.readBlobByBundleRef(bundleRef, internalPath, 'image/png');
  return URL.createObjectURL(blob);
}

// Crop an image blob to a rect and return a fresh object URL (extracts the BG part of a background
// atlas, exactly as the battle's StageBackgroundLoader does via imgcut parts[0]). Uses
// createImageBitmap for a single fast decode; returns null if the platform can't crop so the caller
// falls back to the raw atlas.
async function cropBlobToUrl(blob, crop) {
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined' || !document.createElement) return null;
  const bitmap = await createImageBitmap(blob);
  const w = Math.max(1, Math.round(crop.w || bitmap.width));
  const h = Math.max(1, Math.round(crop.h || bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) { bitmap.close?.(); return null; }
  ctx.drawImage(bitmap, crop.x || 0, crop.y || 0, w, h, 0, 0, w, h);
  bitmap.close?.();
  return await new Promise((resolve) => canvas.toBlob((b) => resolve(b ? URL.createObjectURL(b) : null), 'image/png'));
}

export function backgroundImageUrl(id) {
  if (id == null || id === '') return Promise.resolve(null);
  return cached(`background:${id}`, async () => {
    const p = provider();
    const entry = p?.getBackgroundEntry?.(`background:${id}`);
    if (!entry?.bundleRef) return null;
    const blob = await p.readBlobByBundleRef(entry.bundleRef, 'image.png', 'image/png');
    if (!blob) return null;
    // A BCU background bundle's image.png is an atlas; the visible battlefield is imgcut parts[0].
    try {
      const imgcutText = await p.readTextByBundleRef(entry.bundleRef, 'imgcut.imgcut');
      const { parts } = parseImgcut(imgcutText);
      const part = parts?.[0];
      if (part && part.w > 0 && part.h > 0) {
        const cropped = await cropBlobToUrl(blob, part);
        if (cropped) return cropped;
      }
    } catch { /* no imgcut / crop unsupported — show the raw image rather than nothing */ }
    return URL.createObjectURL(blob);
  });
}

export function castleImageUrl(id) {
  if (id == null || id === '') return Promise.resolve(null);
  return cached(`enemyCastle:${id}`, async () => {
    const p = provider();
    const entry = p?.getCastleEntry?.(`enemyCastle:${id}`);
    if (!entry?.bundleRef) return null;
    return await ownObjectUrl(entry.bundleRef, 'image.png');
  });
}

// Player (nyanko) castle — composited from the SAME 3 parts + offsets the battle uses
// (BcuPlayerCastleAssetLoader / BattleBox.drawNyCast): base 003 and middle 002 at offsetY -130,
// top 000 at -258, all left-anchored. Produces one image so the field preview matches the runtime.
const PLAYER_CASTLE_PARTS = [
  { partId: '003', offsetY: -130 }, // base (drawn first / behind)
  { partId: '002', offsetY: -130 }, // middle
  { partId: '000', offsetY: -258 }  // top (front)
];

async function loadPartBitmap(p, partId) {
  const entry = p.getCastleEntry?.(`nyankoCastle:${partId}`);
  if (!entry?.bundleRef) return null;
  const archive = await p.archive(entry.bundleRef);
  const preferred = `nyankoCastle_${partId}_00.png`;
  const internalPath = archive.has(preferred)
    ? preferred
    : [...archive.keys()].filter((n) => n.startsWith(`nyankoCastle_${partId}_`) && n.endsWith('.png')).sort()[0] || null;
  if (!internalPath) return null;
  const blob = await p.readBlobByBundleRef(entry.bundleRef, internalPath, 'image/png');
  if (typeof createImageBitmap !== 'function') return { url: URL.createObjectURL(blob) };
  return { bitmap: await createImageBitmap(blob) };
}

export function playerCastleImageUrl() {
  return cached('nyankoCastle:composite', async () => {
    const p = provider();
    if (!p) return null;
    const loaded = [];
    for (const part of PLAYER_CASTLE_PARTS) {
      const res = await loadPartBitmap(p, part.partId).catch(() => null);
      if (res?.bitmap) loaded.push({ ...part, bitmap: res.bitmap });
    }
    if (!loaded.length) return null;
    if (typeof document === 'undefined' || !document.createElement) return null;
    const minTop = Math.min(...loaded.map((l) => l.offsetY));
    let w = 1, h = 1;
    for (const l of loaded) { w = Math.max(w, l.bitmap.width); h = Math.max(h, (l.offsetY - minTop) + l.bitmap.height); }
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w); canvas.height = Math.round(h);
    const ctx = canvas.getContext('2d');
    if (!ctx) { loaded.forEach((l) => l.bitmap.close?.()); return null; }
    for (const l of loaded) { ctx.drawImage(l.bitmap, 0, Math.round(l.offsetY - minTop)); l.bitmap.close?.(); }
    return await new Promise((resolve) => canvas.toBlob((b) => resolve(b ? URL.createObjectURL(b) : null), 'image/png'));
  });
}

export function enemyIconUrl(id) {
  if (id == null || id === '') return Promise.resolve(null);
  return cached(`enemy-icon:${id}`, async () => {
    const p = provider();
    if (!p) return null;
    try { return await p.getActorUiIconUrl(`enemy:${id}`); }
    catch { try { return await p.getActorIconUrl(`enemy:${id}`); } catch { return null; } }
  });
}

// Resolve one thumbnail by kind — used by the builder's lazy image hydrator.
export function resolveThumb(kind, id) {
  if (kind === 'background') return backgroundImageUrl(id);
  if (kind === 'castle') return castleImageUrl(id);
  if (kind === 'enemy') return enemyIconUrl(id);
  if (kind === 'player-castle') return playerCastleImageUrl();
  return Promise.resolve(null);
}

export function thumbCacheKey(kind, id) {
  if (kind === 'background') return `background:${id}`;
  if (kind === 'castle') return `enemyCastle:${id}`;
  if (kind === 'enemy') return `enemy-icon:${id}`;
  if (kind === 'player-castle') return 'nyankoCastle:composite';
  return `${kind}:${id}`;
}

// ---- music --------------------------------------------------------------------
// A track is playable only when the catalog can name a file for it; unplayable ids never
// reach the picker (requirement: 再生不能な曲を選択肢へ出さない).
export function musicPlayable(id) {
  try { return musicCatalog.fileName(id) != null; } catch { return false; }
}
export function musicUrls(id) {
  try { return musicCatalog.resolveUrls(id) || []; } catch { return []; }
}
