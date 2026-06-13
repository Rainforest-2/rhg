// BCU talent / PCoin (本能 / Plus-coin upgrade) damage-modifier model — Phase 4.
//
// Fact-first source: references/bcu/.../battle/data/PCoin.java + util/Data.java.
//   - getAtkMultiplication(talents): first PC_BASE/PC2_ATK talent -> 1 + v*0.01
//   - getHPMultiplication(talents):  first PC_BASE/PC2_HP  talent -> 1 + v*0.01
//   - per-level value v interpolates: (v1-v0)*(lv-1)/(maxlv-1) + v0  (int math),
//     or info[3] when maxlv == 0, or 0 when maxlv == 1.
//
// Scope: models the attack/HP talent multipliers from a unit's PCoin `info`
// table, selected talent levels, and the PC_CORRES type map. There is no talent
// data path in this game's runtime (forms carry no PCoin), so this is a fact-
// grounded model with deterministic fixtures, not a wired runtime modifier.

// util/Data.java PCoin category/subtype constants.
export const PC_CATEGORY = Object.freeze({ PC_P: 0, PC_AB: 1, PC_BASE: 2, PC_IMU: 3, PC_TRAIT: 4 });
export const PC_SUBTYPE = Object.freeze({ PC2_HP: 0, PC2_ATK: 1, PC2_SPEED: 2, PC2_COST: 3, PC2_CD: 4, PC2_HB: 5, PC2_TBA: 6 });

const TALENT_ENTRY_LEN = 14; // PCoin.onInjected pads each info entry to length 14.

/**
 * Per-level value of a talent entry (modifs[0] in PCoin), mirroring the BCU
 * integer interpolation. `infoEntry` layout: [typeCode, maxlv, v0, v1, ...].
 *
 * @param {number[]} infoEntry A PCoin info entry.
 * @param {number} talentLevel Selected level (0 = not unlocked).
 * @returns {number} The interpolated value (percentage points).
 */
export function talentLevelValue(infoEntry, talentLevel) {
  if (!Array.isArray(infoEntry) || infoEntry.length < 4) return 0;
  const lv = Math.trunc(Number(talentLevel) || 0);
  if (lv === 0) return 0; // BCU skips talents[i] == 0
  const maxlv = Math.trunc(Number(infoEntry[1]) || 0);
  const v0 = Math.trunc(Number(infoEntry[2]) || 0);
  const v1 = Math.trunc(Number(infoEntry[3]) || 0);
  if (maxlv > 1) return Math.trunc((v1 - v0) * (lv - 1) / (maxlv - 1)) + v0;
  if (maxlv === 0) return v1; // info[3 + 0*2]
  return 0; // maxlv == 1: modifs stays 0
}

function firstBaseMultiplier(info, talents, corres, subtype) {
  const entries = Array.isArray(info) ? info : [];
  const levels = Array.isArray(talents) ? talents : [];
  const map = Array.isArray(corres) ? corres : [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const typeCode = Number(entry?.[0]);
    if (!Number.isInteger(typeCode) || typeCode >= map.length) continue;
    if ((Number(levels[i]) || 0) === 0) continue;
    const type = map[typeCode];
    if (!Array.isArray(type) || type[0] === -1) continue;
    if (type[0] === PC_CATEGORY.PC_BASE && type[1] === subtype) {
      return 1 + talentLevelValue(entry, levels[i]) * 0.01;
    }
  }
  return 1.0;
}

/** Attack talent multiplier (PCoin.getAtkMultiplication). */
export function getTalentAttackMultiplier(info, talents, corres) {
  return firstBaseMultiplier(info, talents, corres, PC_SUBTYPE.PC2_ATK);
}

/** HP talent multiplier (PCoin.getHPMultiplication). */
export function getTalentHpMultiplier(info, talents, corres) {
  return firstBaseMultiplier(info, talents, corres, PC_SUBTYPE.PC2_HP);
}

export { TALENT_ENTRY_LEN };
