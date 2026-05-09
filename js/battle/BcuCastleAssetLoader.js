import { CastleAssetResolver, resolveEnemyCastleAssetCandidates } from './CastleAssetResolver.js';

function buildFullImageRenderCrop(image) {
  const w = Math.max(1, Number(image?.naturalWidth || image?.width || 0) || 1);
  const h = Math.max(1, Number(image?.naturalHeight || image?.height || 0) || 1);
  return {
    x: 0,
    y: 0,
    w,
    h,
    name: 'full-enemy-castle-png',
    parser: 'image-size-no-imgcut',
    usesImgcut: false,
    renderOnly: true
  };
}

export class BcuCastleAssetLoader {
  constructor(options = {}) { this.imageLoader = options.imageLoader || null; }

  async load(castleId = 0, options = {}) {
    const requestedAnimBaseId = options?.animBaseId ?? null;
    const requestedCannonId = options?.cannonId ?? null;
    const source = options?.source || 'stage-runtime';
    const candidates = resolveEnemyCastleAssetCandidates(castleId, options);
    for (const imagePath of candidates.imageCandidates) {
      const image = await this.loadImage(imagePath);
      if (!image) continue;
      const crop = buildFullImageRenderCrop(image);
      const resolvedAnimBaseId = Number.isFinite(Number(requestedAnimBaseId))
        ? Math.floor(Number(requestedAnimBaseId))
        : candidates.resolvedCastleId;
      return {
        ok: true,
        requestedCastleId: castleId,
        requestedAnimBaseId,
        requestedCannonId,
        resolvedCastleId: candidates.resolvedCastleId,
        resolvedAnimBaseId,
        castleGroupName: candidates.groupName,
        castleGroupIndex: candidates.groupIndex,
        localCastleId: candidates.localCastleId,
        assetKind: candidates.assetKind,
        usesImgcut: false,
        image,
        imagePath,
        imgcut: null,
        imgcutPath: null,
        crop,
        visualBounds: { width: crop.w, height: crop.h, parser: 'image-size-no-imgcut', partName: null, partIndex: null, usesImgcut: false },
        usedFallback: !!candidates.usedFallback,
        fallbackReason: candidates.fallbackReason,
        reason: null,
        source,
        candidateReport: candidates,
        baseDebug: CastleAssetResolver.buildBaseDebug({
          requestedCastleId: castleId,
          requestedAnimBaseId,
          requestedCannonId,
          resolvedCastleId: candidates.resolvedCastleId,
          resolvedAnimBaseId,
          castleGroupName: candidates.groupName,
          castleGroupIndex: candidates.groupIndex,
          localCastleId: candidates.localCastleId,
          imagePath,
          imgcutPath: null,
          usedFallback: !!candidates.usedFallback,
          fallbackReason: candidates.fallbackReason,
          source,
          candidateReport: candidates
        })
      };
    }
    const resolvedAnimBaseId = Number.isFinite(Number(requestedAnimBaseId))
      ? Math.floor(Number(requestedAnimBaseId))
      : candidates.resolvedCastleId;
    return {
      ok: false,
      requestedCastleId: castleId,
      requestedAnimBaseId,
      requestedCannonId,
      resolvedCastleId: candidates.resolvedCastleId,
      resolvedAnimBaseId,
      castleGroupName: candidates.groupName,
      castleGroupIndex: candidates.groupIndex,
      localCastleId: candidates.localCastleId,
      assetKind: candidates.assetKind,
      usesImgcut: false,
      imagePath: candidates.imagePath,
      imgcutPath: null,
      usedFallback: !!candidates.usedFallback,
      fallbackReason: candidates.fallbackReason,
      reason: 'image-load-failed',
      placeholder: true,
      source,
      candidateReport: candidates,
      baseDebug: CastleAssetResolver.buildBaseDebug({
        requestedCastleId: castleId,
        requestedAnimBaseId,
        requestedCannonId,
        resolvedCastleId: candidates.resolvedCastleId,
        resolvedAnimBaseId,
        castleGroupName: candidates.groupName,
        castleGroupIndex: candidates.groupIndex,
        localCastleId: candidates.localCastleId,
        imagePath: candidates.imagePath,
        imgcutPath: null,
        usedFallback: !!candidates.usedFallback,
        fallbackReason: candidates.fallbackReason,
        reason: 'image-load-failed',
        source,
        candidateReport: candidates
      })
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

export { resolveEnemyCastleAssetCandidates };
