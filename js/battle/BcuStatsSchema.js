export const BCU_STATS_SCHEMA_VERSION = 'v0.11.1';

export const UNIT_FIELD_SCHEMA = Object.freeze({
  hp: 0, knockbacks: 1, speed: 2, atk0: 3, tba: 4, range: 5, price: 6, respawn: 7, width: 9,
  attackType: 12, pre0: 13, front: 14, back: 15, ldStart: 44, ldRange: 45, loop: 55,
  atk1: 59, atk2: 60, pre1: 61, pre2: 62, abi0: 63, abi1: 64, abi2: 65
});

export const ENEMY_FIELD_SCHEMA = Object.freeze({
  hp: 0, knockbacks: 1, speed: 2, atk0: 3, tba: 4, range: 5, reward: 6, width: 8,
  attackType: 11, pre0: 12, ldStart: 35, ldRange: 36, loop: 50,
  atk1: 55, atk2: 56, pre1: 57, pre2: 58, abi0: 59, abi1: 60, abi2: 61, star: 69
});

export const UNIT_LD_OVERRIDE_BASE_INDEX = 99;
export const ENEMY_LD_OVERRIDE_BASE_INDEX = 95;

const val = (v, i, fallback = 0) => Number.isFinite(v?.[i]) ? v[i] : fallback;
const p = (n) => (Number.isFinite(n) && n >= 0 ? n : 0);
const safeDamage = (n) => (Number.isFinite(n) && n > 0 ? n : 0);

export function getBcuAttackCount(atk0, atk1, atk2) {
  return safeDamage(atk1) === 0 ? 1 : safeDamage(atk2) === 0 ? 2 : 3;
}

export function buildBcuAttackHits({ rawValues, kind }) {
  const isEnemy = kind === 'enemy';
  const schema = isEnemy ? ENEMY_FIELD_SCHEMA : UNIT_FIELD_SCHEMA;
  const base = isEnemy ? ENEMY_LD_OVERRIDE_BASE_INDEX : UNIT_LD_OVERRIDE_BASE_INDEX;
  const ldStartRaw = val(rawValues, schema.ldStart, 0);
  const ldRangeRaw = val(rawValues, schema.ldRange, 0);
  const atk = [val(rawValues, schema.atk0, 0), val(rawValues, schema.atk1, 0), val(rawValues, schema.atk2, 0)];
  const pre = [val(rawValues, schema.pre0, 0), val(rawValues, schema.pre1, 0), val(rawValues, schema.pre2, 0)];
  const abi = [val(rawValues, schema.abi0, 0), val(rawValues, schema.abi1, 0), val(rawValues, schema.abi2, 0)];
  const count = getBcuAttackCount(atk[0], atk[1], atk[2]);
  const hits = [];
  for (let i = 0; i < count; i += 1) {
    let hitLdStart = ldStartRaw;
    let hitLdRange = ldRangeRaw;
    if (i >= 1) {
      const idx = base + (i - 1) * 3;
      const flag = val(rawValues, idx, 0);
      if (flag === 1) {
        hitLdStart = val(rawValues, idx + 1, ldStartRaw);
        hitLdRange = val(rawValues, idx + 2, ldRangeRaw);
      }
    }
    hits.push({
      hitIndex: i,
      damage: safeDamage(atk[i]),
      preFramesAbsolute: p(pre[i]),
      preFrames: p(pre[i]),
      deltaFramesFromPrevious: i === 0 ? p(pre[0]) : p(pre[i]) - p(pre[i - 1]),
      abi: Number.isFinite(abi[i]) ? abi[i] : 0,
      ldStartRaw: hitLdStart,
      ldRangeRaw: hitLdRange,
      shortPointRaw: hitLdStart,
      longPointRaw: hitLdStart + hitLdRange,
      isLd: hitLdRange !== 0,
      isOmni: hitLdRange < 0
    });
  }
  return hits;
}

export function summarizeBcuRawFields({ rawValues, kind }) {
  const schema = kind === 'enemy' ? ENEMY_FIELD_SCHEMA : UNIT_FIELD_SCHEMA;
  const out = {};
  for (const [k, idx] of Object.entries(schema)) out[k] = { index: idx, value: val(rawValues, idx, 0) };
  return out;
}
