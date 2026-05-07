function id3(v){ return String(Math.max(0, Number(v) || 0)).padStart(3, '0'); }

function normalizeCastleId(castleId) {
  const n = Number(castleId);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

async function fetchTextSafe(path) {
  try {
    const r = await fetch(path);
    if (!r.ok) return null;
    return await r.text();
  } catch { return null; }
}

function parseImgcutPart(text) {
  if (typeof text !== 'string' || !text.trim()) return null;
  const rows = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const parts = [];
  for (const row of rows) {
    const nums = row.split(',').map((v) => Number(v.trim()));
    if (nums.length < 4 || nums.some((n) => !Number.isFinite(n))) continue;
    const [x, y, w, h] = nums;
    if (w <= 0 || h <= 0) continue;
    parts.push({ x, y, w, h, area: w * h });
  }
  if (!parts.length) return null;
  return parts.sort((a, b) => b.area - a.area)[0];
}

export function resolveEnemyCastleAssetCandidates(castleId = 0) {
  const resolvedCastleId = normalizeCastleId(castleId);
  if (resolvedCastleId === null) return { castleId, resolvedCastleId: null, baseDir: null, imageCandidates: [], imgcutCandidates: [] };
  const id = id3(resolvedCastleId);
  const baseDir = `./public/assets/bcu/000001/org/castle/${id}/`;
  const names = [`nyankoCastle_${id}_00`, `nyankoCastle_${id}_00_00`, `nyankoCastle_${id}`];
  return {
    castleId: Number(castleId) || 0,
    resolvedCastleId,
    baseDir,
    imageCandidates: names.map((n) => `${baseDir}${n}.png`),
    imgcutCandidates: names.map((n) => `${baseDir}${n}.imgcut`)
  };
}

export class BcuCastleAssetLoader {
  constructor(options = {}) { this.imageLoader = options.imageLoader || null; this.fetchText = options.fetchText || fetchTextSafe; }
  async load(castleId = 0, options = {}) {
    const requestedAnimBaseId = options?.animBaseId ?? null;
    const requestedCannonId = options?.cannonId ?? null;
    const source = options?.source || 'stage-runtime';
    const candidates = resolveEnemyCastleAssetCandidates(castleId);
    const fallbackReason = candidates.resolvedCastleId === null ? 'castleId-invalid-fallback-0' : null;
    const resolvedCastleId = candidates.resolvedCastleId === null ? 0 : candidates.resolvedCastleId;
    const resolvedAnimBaseId = Number.isFinite(Number(requestedAnimBaseId)) ? Math.floor(Number(requestedAnimBaseId)) : resolvedCastleId;
    for (const imagePath of candidates.imageCandidates) {
      const image = await this.loadImage(imagePath);
      if (!image) continue;
      let imgcut = null; let imgcutPath = null;
      for (const c of candidates.imgcutCandidates) {
        const t = await this.fetchText(c);
        const part = parseImgcutPart(t);
        if (part) { imgcut = { text: t, part }; imgcutPath = c; break; }
      }
      const crop = imgcut?.part || { x: 0, y: 0, w: image.width, h: image.height };
      return { ok: true, requestedCastleId: castleId, requestedAnimBaseId, requestedCannonId, resolvedCastleId, resolvedAnimBaseId, image, imagePath, imgcut, imgcutPath, crop, visualBounds: { width: crop.w, height: crop.h }, usedFallback: !!fallbackReason, fallbackReason, reason: null, source, candidateReport: { baseDir: candidates.baseDir, imageCandidates: candidates.imageCandidates, imgcutCandidates: candidates.imgcutCandidates } };
    }
    if (candidates.resolvedCastleId === null) return { ok:false, requestedCastleId: castleId, requestedAnimBaseId, requestedCannonId, resolvedCastleId, resolvedAnimBaseId, imagePath:null, imgcutPath:null, usedFallback:true, fallbackReason, reason:'castleId-invalid-fallback-0', placeholder:true, source, candidateReport: { baseDir: candidates.baseDir, imageCandidates: candidates.imageCandidates, imgcutCandidates: candidates.imgcutCandidates } };
    return { ok: false, requestedCastleId: castleId, requestedAnimBaseId, requestedCannonId, resolvedCastleId, resolvedAnimBaseId, imagePath:null, imgcutPath:null, usedFallback:false, fallbackReason:null, reason: 'image-load-failed', placeholder: true, source, candidateReport: { baseDir: candidates.baseDir, imageCandidates: candidates.imageCandidates, imgcutCandidates: candidates.imgcutCandidates } };
  }

  loadImage(src) { if (typeof this.imageLoader === 'function') return Promise.resolve(this.imageLoader(src));
    return new Promise((resolve) => {
      if (typeof Image === 'undefined') return resolve({ width: 512, height: 512, src });
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }
}
