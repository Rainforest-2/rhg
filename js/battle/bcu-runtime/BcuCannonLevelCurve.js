// Faithful port of BCU common/battle/CannonLevelCurve.java + Treasure.readCannonCurveData/injectData.
// Source data is the shipped pack file org/data/CC_AllParts_growth.csv (PART.CANNON curves).
// Columns: id(cannon NyType), type(magnification type), threshold(level), value1, value2, easing.
// Behavior is piecewise-linear interpolation between thresholds, with BCU's CANNON post-divisions.

// common/util/Data.java magnification type ids:
export const BCU_MAG_TYPE = Object.freeze({
  BASE_ATK_MAGNIFICATION: 0,
  BASE_SLOW_TIME: 1,
  BASE_TIME: 2,
  BASE_WALL_MAGNIFICATION: 3,
  BASE_WALL_ALIVE_TIME: 4,
  BASE_RANGE: 5,
  BASE_HEALTH_PERCENTAGE: 7,
  BASE_HOLY_ATK_SURFACE: 9,
  BASE_HOLY_ATK_UNDERGROUND: 10,
  BASE_CURSE_TIME: 12
});

// Parse CC_AllParts_growth.csv into Map<cannonId, Map<type, Array<[threshold,v1,v2,easing]>>>.
// Mirrors Treasure.injectData: poll() drops the header, id==0 rows are skipped.
export function parseCannonCurveCsv(text) {
  const curveData = new Map();
  const lines = String(text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  // Drop header (q.poll()).
  for (let i = 1; i < lines.length; i++) {
    const data = lines[i].split(',').map((n) => Number.parseInt(n, 10));
    if (data.length < 6 || data.some((n) => !Number.isFinite(n))) continue;
    const id = data[0];
    if (id === 0) continue;
    const type = data[1];
    if (!curveData.has(id)) curveData.set(id, new Map());
    const byType = curveData.get(id);
    if (!byType.has(type)) byType.set(type, []);
    byType.get(type).push([data[2], data[3], data[4], data[5]]);
  }
  return curveData;
}

function applyFormulaRaw(curve, level) {
  if (!Array.isArray(curve) || curve.length === 0) return 0;
  const maxThreshold = curve[curve.length - 1][0];
  let lv = Math.max(0, Math.min(level, maxThreshold));
  let i = 0;
  let prevThreshold = 1;
  while (lv > curve[i][0]) { prevThreshold = curve[i][0]; i++; }
  const seg = curve[i];
  const denom = (seg[0] - prevThreshold) || 1;
  return seg[1] + ((seg[2] - seg[1]) * (lv - prevThreshold)) / denom;
}

// CannonLevelCurve.applyFormula for PART.CANNON (the post-divisions BCU applies).
export function applyCannonFormula(byType, type, level) {
  const curve = byType?.get?.(type);
  if (!curve) return null;
  const v = applyFormulaRaw(curve, level);
  switch (type) {
    case BCU_MAG_TYPE.BASE_RANGE: return v / 4;
    case BCU_MAG_TYPE.BASE_HEALTH_PERCENTAGE: return v / 10;
    case BCU_MAG_TYPE.BASE_HOLY_ATK_SURFACE:
    case BCU_MAG_TYPE.BASE_HOLY_ATK_UNDERGROUND: return v / 1000;
    default: return v;
  }
}

// CannonLevelCurve.getMax(): last threshold of any curve for this cannon id.
export function getCannonCurveMax(byType) {
  if (!byType) return 0;
  for (const curve of byType.values()) {
    if (Array.isArray(curve) && curve.length) return curve[curve.length - 1][0];
  }
  return 0;
}

// Resolve the magnification keys consumed by getBcuCatCannonSpec for a cannon id at a given level.
// level defaults to the cannon's max foundation level (Treasure is maxed by design in this game).
// Returns only the keys each cannon's Cannon.java branch actually reads (never invents values).
export function resolveBcuCatCannonMagnification(curveData, id, level = null) {
  const byType = curveData?.get?.(id);
  if (!byType) return { resolved: false, magnification: {}, level: null, reason: `no-curve-for-id-${id}` };
  const lv = Number.isFinite(level) ? level : getCannonCurveMax(byType);
  const mag = {};
  const set = (key, type) => { const v = applyCannonFormula(byType, type, lv); if (v != null) mag[key] = v; };
  switch (id) {
    case 1: set('slowTime', BCU_MAG_TYPE.BASE_SLOW_TIME); break;
    case 2: set('wallAliveTime', BCU_MAG_TYPE.BASE_WALL_ALIVE_TIME); break;
    case 3: set('atkMagnification', BCU_MAG_TYPE.BASE_ATK_MAGNIFICATION); set('stopTime', BCU_MAG_TYPE.BASE_TIME); break;
    case 4: set('healthPercentage', BCU_MAG_TYPE.BASE_HEALTH_PERCENTAGE); break;
    case 5: set('stopTime', BCU_MAG_TYPE.BASE_TIME); break;
    case 6: set('atkMagnification', BCU_MAG_TYPE.BASE_ATK_MAGNIFICATION); set('barrierRange', BCU_MAG_TYPE.BASE_RANGE); break;
    case 7: set('curseTime', BCU_MAG_TYPE.BASE_CURSE_TIME); break;
    default: break;
  }
  return { resolved: true, magnification: mag, level: lv, bcuReference: 'Treasure.getCannonMagnification -> CannonLevelCurve.applyFormula (CC_AllParts_growth.csv)' };
}
