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

// BCU EStage: multi = rowMagnification * mul. Apply the crown multiplier (percent/100) to a single
// magnification percentage, rounding like BCU's float math collapses on read (Math.round to keep
// integer percents stable for downstream stat scaling).
export function applyCrownToMagnification(rowMagnificationPercent, crownPercent) {
  const base = toFinite(rowMagnificationPercent, 100);
  const mul = toFinite(crownPercent, 100) / 100;
  if (mul === 1) return base;
  return Math.round(base * mul);
}

// Returns a shallow-cloned enemy row with HP/ATK magnifications scaled by the crown multiplier.
// A 100% crown (★1) returns the row unchanged. Boss base rows are scaled too (they carry the same
// magnification fields), matching EStage.base()'s `multi = data.multiple * mul`.
export function applyCrownToEnemyRow(row, crownPercent) {
  if (!row || toFinite(crownPercent, 100) === 100) return row;
  const out = { ...row };
  if (row.magnification != null) out.magnification = applyCrownToMagnification(row.magnification, crownPercent);
  if (row.hpMagnification != null) out.hpMagnification = applyCrownToMagnification(row.hpMagnification, crownPercent);
  if (row.attackMagnification != null) out.attackMagnification = applyCrownToMagnification(row.attackMagnification, crownPercent);
  out.crownMagnificationPercent = toFinite(crownPercent, 100);
  return out;
}

// Apply a crown magnification to every enemy row in a list. Returns the same array reference when the
// crown is ★1/100% (no allocation), else a new array of scaled rows.
export function applyCrownToEnemyRows(rows, crownPercent) {
  if (!Array.isArray(rows) || toFinite(crownPercent, 100) === 100) return rows;
  return rows.map((row) => applyCrownToEnemyRow(row, crownPercent));
}

// Resolve a map's crown data from the generated crown index. byName is keyed by map display name
// (the label the difficulty/selection UI already shows); byKey is keyed by `<packId>:<mapId>`.
// Returns { crownCount, stars } with a single-crown default when the map is absent.
export function resolveMapCrownData(crownIndex, { name = null, packId = null, mapId = null } = {}) {
  if (crownIndex) {
    if (packId != null && mapId != null) {
      const hit = crownIndex.byKey?.[`${packId}:${mapId}`];
      if (hit) return { crownCount: hit.crownCount, stars: hit.stars, source: 'crown-index-byKey' };
    }
    if (name && crownIndex.byName?.[name]) {
      const hit = crownIndex.byName[name];
      return { crownCount: hit.crownCount, stars: hit.stars, source: 'crown-index-byName' };
    }
  }
  return { crownCount: 1, stars: [100], source: 'single-crown-default' };
}
