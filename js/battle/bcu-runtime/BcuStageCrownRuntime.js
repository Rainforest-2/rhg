// BCU stage-crown (星/冠) difficulty runtime.
//
// BCU fact (util/stage/EStage.java): a stage is entered at a crown level `star` (0-based; 0 = ★1).
// The StageMap's `stars[star]` percentage becomes a global enemy multiplier:
//     mul = st.getCont().stars[star] * 0.01f;
//     float multi  = (data.multiple == 0 ? 100 : data.multiple) * mul * 0.01f;  // HP  magnification
//     float mulatk = (data.multiple == 0 ? 100 : data.mult_atk) * mul * 0.01f;  // ATK magnification
// i.e. every enemy row's HP and ATK magnification is scaled by stars[star]/100. ★1 (star 0) is always
// 100 -> mul = 1.0 -> no change, so single-crown stages and the default selection are unaffected.

export const BCU_DEFAULT_CROWN_STARS = Object.freeze([100, 150, 200, 300]);
export const BCU_MIN_CROWN_STAR = 1;
export const BCU_MAX_CROWN_STAR = 4;

function toFinite(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function normalizeCrownStar(value, fallback = BCU_MIN_CROWN_STAR) {
  const raw = Number(value);
  const n = Number.isFinite(raw) ? Math.trunc(raw) : Math.trunc(toFinite(fallback, BCU_MIN_CROWN_STAR));
  return Math.max(BCU_MIN_CROWN_STAR, Math.min(BCU_MAX_CROWN_STAR, n));
}

export function crownStarIndexFromUiStar(star) {
  return normalizeCrownStar(star) - 1;
}

export function crownStarsForData(crownData = {}) {
  const rawCount = Number(crownData?.crownCount ?? crownData?.stars?.length ?? 1);
  const count = Math.max(1, Math.min(BCU_MAX_CROWN_STAR, Number.isFinite(rawCount) ? Math.trunc(rawCount) : 1));
  return Array.from({ length: count }, (_, index) => index + 1);
}

export function crownDataHasStar(crownData = {}, star = BCU_MIN_CROWN_STAR) {
  return crownStarsForData(crownData).includes(normalizeCrownStar(star));
}

export function clampCrownIndex(starIndex, stars = BCU_DEFAULT_CROWN_STARS) {
  const count = Array.isArray(stars) && stars.length > 0 ? stars.length : 1;
  const idx = Math.trunc(toFinite(starIndex, 0));
  if (idx < 0) return 0;
  if (idx > count - 1) return count - 1;
  return idx;
}

export function resolveCrownMagnificationPercent(starIndex, stars = BCU_DEFAULT_CROWN_STARS) {
  const list = Array.isArray(stars) && stars.length > 0 ? stars : [100];
  const idx = clampCrownIndex(starIndex, list);
  const pct = toFinite(list[idx], 100);
  return idx === 0 ? 100 : Math.max(0, pct);
}

export function applyCrownToMagnification(rowMagnificationPercent, crownPercent) {
  const base = toFinite(rowMagnificationPercent, 100);
  const mul = toFinite(crownPercent, 100) / 100;
  return base * mul;
}

export function applyCrownToEnemyRow(row, crownPercent) {
  if (!row || toFinite(crownPercent, 100) === 100) return row;
  const out = { ...row };
  const crownMagnificationPercent = toFinite(crownPercent, 100);
  const rawMagnification = toFinite(row.magnification, 100);
  const rawHpMagnification = toFinite(row.hpMagnification ?? row.magnification, 100);
  const rawAttackMagnification = toFinite(row.attackMagnification ?? row.magnification, 100);

  out.rawRowMagnificationPercent = rawMagnification;
  out.rawRowHpMagnificationPercent = rawHpMagnification;
  out.rawRowAttackMagnificationPercent = rawAttackMagnification;
  out.magnification = applyCrownToMagnification(rawMagnification, crownMagnificationPercent);
  out.hpMagnification = applyCrownToMagnification(rawHpMagnification, crownMagnificationPercent);
  out.attackMagnification = applyCrownToMagnification(rawAttackMagnification, crownMagnificationPercent);
  out.hpMagnificationFactor = out.hpMagnification / 100;
  out.attackMagnificationFactor = out.attackMagnification / 100;
  out.crownMagnificationPercent = crownMagnificationPercent;
  out.crownAppliedExactlyOnce = true;
  return out;
}

export function applyCrownToEnemyRows(rows, crownPercent) {
  if (!Array.isArray(rows) || toFinite(crownPercent, 100) === 100) return rows;
  return rows.map((row) => applyCrownToEnemyRow(row, crownPercent));
}

export function normalizeCrownLookupName(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/^(?:レジェンドステージ|真レジェンドステージ|レジェンドストーリー0|日本編|未来編|宇宙編)\s*[：:]\s*/u, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function crownSignature(entry) {
  const stars = Array.isArray(entry?.stars) && entry.stars.length ? entry.stars : [100];
  const count = Math.max(1, Math.trunc(toFinite(entry?.crownCount ?? stars.length, stars.length)));
  return `${count}:${stars.slice(0, count).join(',')}`;
}

function resultFromEntry(entry, source, diagnostics = {}) {
  return {
    crownCount: Math.max(1, Math.trunc(toFinite(entry?.crownCount ?? entry?.stars?.length, 1))),
    stars: Array.isArray(entry?.stars) && entry.stars.length ? [...entry.stars] : [100],
    source,
    resolvedPackId: entry?.packId ?? null,
    resolvedMapId: entry?.mapId ?? null,
    unresolvedReason: null,
    diagnostics
  };
}

function ambiguousResult(reason, candidates = [], diagnostics = {}) {
  return {
    crownCount: 1,
    stars: [100],
    source: 'crown-index-ambiguous',
    unresolvedReason: reason,
    diagnostics: {
      ...diagnostics,
      candidateCount: candidates.length,
      candidateKeys: candidates.map((entry) => `${entry?.packId ?? '?'}:${entry?.mapId ?? '?'}`),
      signatures: [...new Set(candidates.map(crownSignature))]
    }
  };
}

function resolveCandidateSet(candidates, source, diagnostics = {}) {
  const list = [...new Map((candidates || []).filter(Boolean).map((entry) => [`${entry.packId}:${entry.mapId}:${crownSignature(entry)}`, entry])).values()];
  if (!list.length) return null;
  const signatures = [...new Set(list.map(crownSignature))];
  if (signatures.length > 1) {
    return ambiguousResult(`${source}-conflicting-crown-signatures`, list, diagnostics);
  }
  const representative = [...list].sort((a, b) => String(b?.packId || '').localeCompare(String(a?.packId || '')))[0];
  return resultFromEntry(representative, source, { ...diagnostics, candidateCount: list.length, signature: signatures[0] });
}

function entriesForName(crownIndex, name) {
  if (!name) return [];
  const direct = crownIndex?.byName?.[name];
  if (Array.isArray(direct)) return direct;
  if (Array.isArray(direct?.entries)) return direct.entries;
  if (direct && direct.crownCount != null) return [direct]; // schema v1 compatibility
  const normalized = normalizeCrownLookupName(name);
  if (!normalized) return [];
  const normalizedGroup = crownIndex?.byNormalizedName?.[normalized];
  if (Array.isArray(normalizedGroup)) return normalizedGroup;
  if (Array.isArray(normalizedGroup?.entries)) return normalizedGroup.entries;
  return (crownIndex?.entries || []).filter((entry) => normalizeCrownLookupName(entry?.name) === normalized);
}

function entriesForMapId(crownIndex, id) {
  const indexed = crownIndex?.byMapId?.[String(id)];
  if (Array.isArray(indexed)) return indexed;
  if (Array.isArray(indexed?.entries)) return indexed.entries;
  return (crownIndex?.entries || []).filter((entry) => Number(entry?.mapId) === Number(id));
}

// Identity precedence is strict: exact pack+map, composite numeric map identity,
// local numeric map identity, then display name. A lower-priority id is examined
// only when the higher-priority id has no candidates; candidate sets from distinct
// identities are never merged into a synthetic ambiguity.
export function resolveMapCrownData(crownIndex, { name = null, packId = null, mapId = null, mapColcId = null } = {}) {
  const requested = { name, packId, mapId, mapColcId };
  if (!crownIndex) return { crownCount: 1, stars: [100], source: 'single-crown-default', unresolvedReason: null, diagnostics: { requested } };

  if (packId != null && mapId != null) {
    const exact = crownIndex.byKey?.[`${packId}:${mapId}`];
    if (exact) return resultFromEntry(exact, 'crown-index-byKey', { requested });
  }

  const numericMapId = mapId == null ? NaN : toFinite(mapId, NaN);
  const numericMapColcId = mapColcId == null ? NaN : toFinite(mapColcId, NaN);
  if (Number.isFinite(numericMapId)) {
    const ids = Number.isFinite(numericMapColcId)
      ? [(numericMapColcId * 1000) + numericMapId, numericMapId]
      : [numericMapId];
    for (const id of ids) {
      let candidates = entriesForMapId(crownIndex, id);
      if (packId != null) {
        const packCandidates = candidates.filter((entry) => String(entry?.packId) === String(packId));
        if (packCandidates.length) candidates = packCandidates;
      }
      const numeric = resolveCandidateSet(candidates, 'crown-index-byMapId', {
        requested,
        attemptedIds: ids,
        resolvedNumericId: id
      });
      if (numeric) return numeric;
    }
  }

  const nameCandidates = entriesForName(crownIndex, name);
  if (nameCandidates.length) {
    let candidates = nameCandidates;
    if (packId != null) {
      const packCandidates = candidates.filter((entry) => String(entry?.packId) === String(packId));
      if (packCandidates.length) candidates = packCandidates;
    }
    return resolveCandidateSet(candidates, 'crown-index-byName', { requested, normalizedName: normalizeCrownLookupName(name) });
  }

  return { crownCount: 1, stars: [100], source: 'single-crown-default', unresolvedReason: null, diagnostics: { requested } };
}
