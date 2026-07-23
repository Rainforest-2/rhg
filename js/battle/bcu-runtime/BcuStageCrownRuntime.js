// BCU stage-crown (星/冠) difficulty runtime.
//
// BCU fact (util/stage/EStage.java): a stage is entered at a crown level `star` (0-based; 0 = ★1).
// The StageMap's `stars[star]` percentage becomes a global enemy multiplier:
//     mul = st.getCont().stars[star] * 0.01f;
//     float multi  = (data.multiple == 0 ? 100 : data.multiple) * mul * 0.01f;  // HP  magnification
//     float mulatk = (data.multiple == 0 ? 100 : data.mult_atk) * mul * 0.01f;  // ATK magnification
// i.e. every enemy row's HP and ATK magnification is scaled by stars[star]/100. ★1 (star 0) is always
// 100 -> mul = 1.0 -> no change, so single-crown stages and the default selection are unaffected.
//
// Crown magnification data per map comes from public/assets/generated/bcu-stage-crown-index.json
// (built from Map_option.csv 星解放 / 星N倍率). The UI resolves the map's stars[] + selected crown and
// passes the resolved percentage here; this module owns only the BCU multiplier application.

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

// Clamp a requested crown index into a map's available crowns. starIndex is 0-based (0 = ★1).
// A single-crown map (or missing stars) always resolves to ★1 (index 0).
export function clampCrownIndex(starIndex, stars = BCU_DEFAULT_CROWN_STARS) {
  const count = Array.isArray(stars) && stars.length > 0 ? stars.length : 1;
  const idx = Math.trunc(toFinite(starIndex, 0));
  if (idx < 0) return 0;
  if (idx > count - 1) return count - 1;
  return idx;
}

// Resolve the BCU stars[star] magnification percentage for a crown selection. Returns 100 for ★1,
// missing data, or any out-of-range request (clamped). Mirrors EStage `st.getCont().stars[star]`.
export function resolveCrownMagnificationPercent(starIndex, stars = BCU_DEFAULT_CROWN_STARS) {
  const list = Array.isArray(stars) && stars.length > 0 ? stars : [100];
  const idx = clampCrownIndex(starIndex, list);
  const pct = toFinite(list[idx], 100);
  // EStage: star 0 (★1) is always the 100% baseline.
  return idx === 0 ? 100 : Math.max(0, pct);
}

// BCU EStage preserves this product as a float until enemy construction. Do not round or truncate the
// intermediate percentage: HP performs a final Java int cast and attack performs Math.round separately.
export function applyCrownToMagnification(rowMagnificationPercent, crownPercent) {
  const base = toFinite(rowMagnificationPercent, 100);
  const mul = toFinite(crownPercent, 100) / 100;
  return base * mul;
}

// Returns a shallow-cloned enemy row with exact combined HP/ATK percentages. Raw row percentages and
// explicit factors are retained so downstream construction can mirror BCU's per-field conversion order.
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

// Apply a crown magnification to every enemy row in a list. Returns the same array reference when the
// crown is ★1/100% (no allocation), else a new array of scaled rows.
export function applyCrownToEnemyRows(rows, crownPercent) {
  if (!Array.isArray(rows) || toFinite(crownPercent, 100) === 100) return rows;
  return rows.map((row) => applyCrownToEnemyRow(row, crownPercent));
}

function normalizeCrownLookupName(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/^(?:レジェンドステージ|真レジェンドステージ|レジェンドストーリー0|日本編|未来編|宇宙編)\s*[：:]\s*/u, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function pickBestCrownEntry(entries = []) {
  let best = null;
  for (const entry of entries) {
    if (!entry) continue;
    if (!best || (entry.crownCount || 0) > (best.crownCount || 0) || ((entry.crownCount || 0) === (best.crownCount || 0) && String(entry.packId || '') > String(best.packId || ''))) {
      best = entry;
    }
  }
  return best;
}

// Resolve a map's crown data from the generated crown index. byName is keyed by map display name
// (the label the difficulty/selection UI already shows); byKey is keyed by `<packId>:<mapId>`.
// Returns { crownCount, stars } with a single-crown default when the map is absent.
export function resolveMapCrownData(crownIndex, { name = null, packId = null, mapId = null, mapColcId = null } = {}) {
  if (crownIndex) {
    if (packId != null && mapId != null) {
      const hit = crownIndex.byKey?.[`${packId}:${mapId}`];
      if (hit) return { crownCount: hit.crownCount, stars: hit.stars, source: 'crown-index-byKey' };
    }
    if (name && crownIndex.byName?.[name]) {
      const hit = crownIndex.byName[name];
      return { crownCount: hit.crownCount, stars: hit.stars, source: 'crown-index-byName' };
    }
    const numericMapId = mapId == null ? NaN : toFinite(mapId, NaN);
    const numericMapColcId = mapColcId == null ? NaN : toFinite(mapColcId, NaN);
    if (Number.isFinite(numericMapId) && Array.isArray(crownIndex.entries)) {
      const ids = Number.isFinite(numericMapColcId)
        ? [(numericMapColcId * 1000) + numericMapId, numericMapId]
        : [numericMapId];
      let hit = null;
      for (const id of ids) {
        hit = pickBestCrownEntry(crownIndex.entries.filter((entry) => Number(entry?.mapId) === id));
        if (hit) break;
      }
      if (hit) return { crownCount: hit.crownCount, stars: hit.stars, source: 'crown-index-byMapId' };
    }
    const normalizedName = normalizeCrownLookupName(name);
    if (normalizedName && Array.isArray(crownIndex.entries)) {
      const hit = pickBestCrownEntry(crownIndex.entries.filter((entry) => normalizeCrownLookupName(entry?.name) === normalizedName));
      if (hit) return { crownCount: hit.crownCount, stars: hit.stars, source: 'crown-index-byNormalizedName' };
    }
  }
  return { crownCount: 1, stars: [100], source: 'single-crown-default' };
}
