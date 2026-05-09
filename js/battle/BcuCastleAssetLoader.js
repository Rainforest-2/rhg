function id3(v){ return String(Math.max(0, Number(v) || 0)).padStart(3, '0'); }

const ENEMY_CASTLE_GROUPS = Object.freeze(['rc', 'ec', 'wc', 'sc']);

function normalizeCastleId(castleId) {
  const n = Number(castleId);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

export function resolveEnemyCastleAssetCandidates(castleId = 0) {
  const resolvedCastleId = normalizeCastleId(castleId);
  const groupIndex = Math.floor(resolvedCastleId / 1000);
  const localCastleId = resolvedCastleId % 1000;
  const groupName = ENEMY_CASTLE_GROUPS[groupIndex] || ENEMY_CASTLE_GROUPS[0];
  const imagePath = `./public/assets/bcu/000001/org/img/${groupName}/${groupName}${id3(localCastleId)}.png`;
  return {
    requestedCastleId: castleId,
    resolvedCastleId,
    groupIndex,
    groupName,
    localCastleId,
    imagePath,
    imageCandidates: [imagePath],
    imgcutCandidates: [],
    usesImgcut: false,
    assetKind: 'bcu-enemy-castle-png',
    fallbackReason: groupIndex >= ENEMY_CASTLE_GROUPS.length ? 'castle-group-out-of-range-fallback-rc' : null
  };
}

export class BcuCastleAssetLoader {
  constructor(options = {}) { this.imageLoader = options.imageLoader || null; }

  async load(castleId = 0, options = {}) {
    const requestedAnimBaseId = options?.animBaseId ?? null;
    const requestedCannonId = options?.cannonId ?? null;
    const source = options?.source || 'stage-runtime';
    const candidates = resolveEnemyCastleAssetCandidates(castleId);
    for (const imagePath of candidates.imageCandidates) {
      const image = await this.loadImage(imagePath);
      if (!image) continue;
      const w = Number(image.naturalWidth || image.width || 0);
      const h = Number(image.naturalHeight || image.height || 0);
      return {
        ok: true,
        requestedCastleId: castleId,
        requestedAnimBaseId,
        requestedCannonId,
        resolvedCastleId: candidates.resolvedCastleId,
        resolvedAnimBaseId: Number.isFinite(Number(requestedAnimBaseId)) ? Math.floor(Number(requestedAnimBaseId)) : candidates.resolvedCastleId,
        castleGroupName: candidates.groupName,
        castleGroupIndex: candidates.groupIndex,
        localCastleId: candidates.localCastleId,
        assetKind: candidates.assetKind,
        usesImgcut: false,
        image,
        imagePath,
        imgcut: null,
        imgcutPath: null,
        crop: null,
        visualBounds: { width: w, height: h, parser: 'image-size-no-imgcut', partName: null, partIndex: null },
        usedFallback: !!candidates.fallbackReason,
        fallbackReason: candidates.fallbackReason,
        reason: null,
        source,
        candidateReport: candidates
      };
    }
    return {
      ok: false,
      requestedCastleId: castleId,
      requestedAnimBaseId,
      requestedCannonId,
      resolvedCastleId: candidates.resolvedCastleId,
      resolvedAnimBaseId: Number.isFinite(Number(requestedAnimBaseId)) ? Math.floor(Number(requestedAnimBaseId)) : candidates.resolvedCastleId,
      castleGroupName: candidates.groupName,
      castleGroupIndex: candidates.groupIndex,
      localCastleId: candidates.localCastleId,
      assetKind: candidates.assetKind,
      usesImgcut: false,
      imagePath: candidates.imagePath,
      imgcutPath: null,
      usedFallback: !!candidates.fallbackReason,
      fallbackReason: candidates.fallbackReason,
      reason: 'image-load-failed',
      placeholder: true,
      source,
      candidateReport: candidates
    };
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
