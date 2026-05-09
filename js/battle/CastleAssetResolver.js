const ENEMY_CASTLE_GROUPS = Object.freeze(['rc', 'ec', 'wc', 'sc']);

function toFiniteNumber(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function id3(value) {
  return String(Math.max(0, Math.floor(toFiniteNumber(value, 0)))).padStart(3, '0');
}

export class CastleAssetResolver {
  static get enemyCastleGroups() { return ENEMY_CASTLE_GROUPS; }

  static normalizeCastleId(castleId, fallback = 0) {
    const n = Number(castleId);
    if (!Number.isFinite(n) || n < 0) {
      return {
        requestedCastleId: castleId,
        resolvedCastleId: fallback,
        usedFallback: true,
        fallbackReason: 'invalid-castle-id-fallback-0'
      };
    }
    return {
      requestedCastleId: castleId,
      resolvedCastleId: Math.floor(n),
      usedFallback: false,
      fallbackReason: null
    };
  }

  static resolveEnemyCastle(castleId = 0, options = {}) {
    const normalized = CastleAssetResolver.normalizeCastleId(castleId, 0);
    const resolvedCastleId = normalized.resolvedCastleId;
    const requestedGroupIndex = Math.floor(resolvedCastleId / 1000);
    const localCastleId = resolvedCastleId % 1000;
    const resolvedGroupIndex = requestedGroupIndex >= 0 && requestedGroupIndex < ENEMY_CASTLE_GROUPS.length
      ? requestedGroupIndex
      : 0;
    const groupName = ENEMY_CASTLE_GROUPS[resolvedGroupIndex];
    const groupFallbackReason = requestedGroupIndex === resolvedGroupIndex
      ? null
      : 'castle-group-out-of-range-fallback-rc';
    const fallbackReason = normalized.fallbackReason || groupFallbackReason;
    const usedFallback = normalized.usedFallback || !!groupFallbackReason;
    const baseDir = options.baseDir || './public/assets/bcu/000001/org/img';
    const imagePath = `${baseDir}/${groupName}/${groupName}${id3(localCastleId)}.png`;

    return {
      requestedCastleId: castleId,
      resolvedCastleId,
      requestedGroupIndex,
      resolvedGroupIndex,
      groupIndex: resolvedGroupIndex,
      groupName,
      localCastleId,
      imagePath,
      imageCandidates: [imagePath],
      imgcutCandidates: [],
      usesImgcut: false,
      assetKind: 'bcu-enemy-castle-png',
      usedFallback,
      fallbackReason,
      fallbackTrace: [normalized.fallbackReason, groupFallbackReason].filter(Boolean)
    };
  }

  static buildBaseDebug(asset = null, extra = {}) {
    return {
      requestedCastleId: asset?.requestedCastleId ?? null,
      requestedAnimBaseId: asset?.requestedAnimBaseId ?? null,
      requestedCannonId: asset?.requestedCannonId ?? null,
      resolvedCastleId: asset?.resolvedCastleId ?? null,
      resolvedAnimBaseId: asset?.resolvedAnimBaseId ?? null,
      castleGroupName: asset?.castleGroupName ?? asset?.groupName ?? null,
      castleGroupIndex: asset?.castleGroupIndex ?? asset?.groupIndex ?? null,
      localCastleId: asset?.localCastleId ?? null,
      castleImagePath: asset?.imagePath ?? null,
      castleImgcutPath: asset?.imgcutPath ?? null,
      castleAssetSource: asset?.source ?? null,
      enemyCastleUsedFallback: !!asset?.usedFallback,
      enemyCastleFallbackReason: asset?.fallbackReason || asset?.reason || null,
      castleCandidateReport: asset?.candidateReport || null,
      ...extra
    };
  }
}

export function resolveEnemyCastleAssetCandidates(castleId = 0, options = {}) {
  return CastleAssetResolver.resolveEnemyCastle(castleId, options);
}

export { ENEMY_CASTLE_GROUPS };
