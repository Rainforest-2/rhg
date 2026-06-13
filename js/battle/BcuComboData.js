// BCU Nyanko Combo (combo damage/stat modifier) data loader.
//
// Fact-first sources (references/bcu/BCU_java_util_common.zip):
//   - common/util/unit/Combo.java        : readFile() CSV/TSV parsing + constructor column layout
//   - common/battle/BasisLU.java         : getInc(type[, unit]) summation over active combos
//   - common/battle/LineUp.java          : renewCombo() active-combo activation rule
//   - common/util/Data.java              : C_* combo type constants, C_TOT = 29
//
// Scope of this module (Phase 1a foundation): parse NyancomboData.csv /
// NyancomboParam.tsv into data, compute the active-combo set for a front-row
// lineup exactly like LineUp.renewCombo, and sum increments exactly like
// BasisLU.getInc. It deliberately does NOT wire these increments into runtime
// unit stat construction or DamageAbilityResolver yet: per the project's
// fact-first rule, loader-backed fixtures and deterministic checks come before
// any resolver/runtime change. CharaGroup-scoped getInc is supported when a
// group lookup is provided; group data loading itself is a later phase.

// common/util/Data.java C_* combo type constants (C_TOT = 29).
export const COMBO_TYPE = Object.freeze({
  C_ATK: 0,
  C_DEF: 1,
  C_SPE: 2,
  C_C_INI: 3,
  C_M_LV: 4,
  C_M_INI: 5,
  C_C_ATK: 6,
  C_C_SPE: 7,
  C_M_INC: 8,
  C_M_MAX: 9,
  C_BASE: 10,
  C_RESP: 11,
  C_MEAR: 12,
  C_XP: 13, // abandoned in BCU
  C_GOOD: 14,
  C_MASSIVE: 15,
  C_RESIST: 16,
  C_KB: 17,
  C_SLOW: 18,
  C_STOP: 19,
  C_WEAK: 20,
  C_STRONG: 21,
  C_WKILL: 22,
  C_EKILL: 23,
  C_CRIT: 24,
  C_VKILL: 25,
  C_IMUWAVE: 26,
  C_DISCOUNT: 27,
  C_IMUVOLC: 28
});

export const C_TOT = 29;
const COMBO_VALUE_WIDTH = 6; // Combo.readFile reads min(strs.length, 6) columns per type row.
const MAX_COMBO_FORMS = 5; // Combo constructor reads up to 5 (unitId, formId) pairs.

function toInt(value) {
  const n = Number.parseInt(String(value).trim(), 10);
  return Number.isFinite(n) ? n : 0;
}

function splitLines(text) {
  return String(text ?? '').split(/\r?\n/);
}

/**
 * Parse NyancomboData.csv into combo definitions.
 *
 * Mirrors common/util/unit/Combo.java:
 *   - rows shorter than 20 characters are skipped (the combo index `i` only
 *     advances for length-eligible rows);
 *   - column layout: [0]=name, [1]=show, [2]=charaGroupId,
 *     [3..12]=up to five (unitId, formId) pairs (a unitId of -1 terminates),
 *     [13]=type, [14]=lv;
 *   - only combos with show > 0 are retained (data.combos.add).
 *
 * @returns {{ index:number, name:string, show:number, charaGroupId:number,
 *             forms:{unitId:number, formId:number}[], type:number, lv:number }[]}
 */
export function parseNyancomboData(text) {
  const combos = [];
  let index = 0;
  for (const raw of splitLines(text)) {
    if (raw.length < 20) continue;
    const i = index++;
    const strs = raw.trim().split(',');
    if (strs.length < 15) continue;

    const show = toInt(strs[1]);

    const forms = [];
    for (let n = 0; n < MAX_COMBO_FORMS; n++) {
      const unitId = toInt(strs[3 + n * 2]);
      if (unitId === -1) break;
      forms.push({ unitId, formId: toInt(strs[4 + n * 2]) });
    }

    const combo = {
      index: i,
      name: strs[0],
      show,
      charaGroupId: toInt(strs[2]),
      forms,
      type: toInt(strs[13]),
      lv: toInt(strs[14])
    };

    if (combo.show > 0) combos.push(combo);
  }
  return combos;
}

/**
 * Parse NyancomboParam.tsv into the `values[type][lv]` table.
 *
 * Mirrors common/util/unit/Combo.java: rows 0..C_TOT-1, each split on tabs,
 * rows with fewer than 5 columns are skipped, up to 6 columns are read.
 *
 * @returns {number[][]} C_TOT rows, each COMBO_VALUE_WIDTH wide (0-filled).
 */
export function parseNyancomboParam(text) {
  const values = Array.from({ length: C_TOT }, () => new Array(COMBO_VALUE_WIDTH).fill(0));
  const lines = splitLines(text);
  for (let i = 0; i < C_TOT; i++) {
    const line = lines[i];
    if (line == null) continue;
    const strs = line.trim().split('\t');
    if (strs.length < 5) continue;
    for (let j = 0; j < Math.min(strs.length, COMBO_VALUE_WIDTH); j++) {
      values[i][j] = toInt(strs[j]);
    }
  }
  return values;
}

/**
 * Determine which combos are active for a given front-row lineup.
 *
 * Mirrors common/battle/LineUp.java renewCombo(): only the five front-row
 * slots (fs[0][0..4]) participate, and each required combo form is satisfied
 * by a slot whose unit matches and whose form id is >= the required form id
 * (evolved-enough rule).
 *
 * @param {Array} combos Combo definitions from parseNyancomboData.
 * @param {{unitId:number, formId:number}[]} frontRow Up to 5 front-row slots.
 * @returns {Array} The subset of `combos` that are active.
 */
export function computeActiveCombos(combos, frontRow) {
  const slots = (Array.isArray(frontRow) ? frontRow : [])
    .slice(0, 5)
    .filter((s) => s && Number.isFinite(s.unitId));
  return (Array.isArray(combos) ? combos : []).filter((combo) => {
    if (!combo.forms.length) return false;
    return combo.forms.every((form) =>
      slots.some((slot) => slot.unitId === form.unitId && Number(slot.formId) >= Number(form.formId))
    );
  });
}

/**
 * Sum the increment for a combo `type` across active combos.
 *
 * Mirrors common/battle/BasisLU.java getInc(type): inc += values[type][lv]
 * for each active combo whose type matches. When `unitMatcher` is supplied it
 * mirrors getInc(type, unit) by also requiring combo.checkCharaGroup(unit).
 *
 * @param {number} type A COMBO_TYPE value.
 * @param {Array} activeCombos Active combos (from computeActiveCombos).
 * @param {number[][]} values The values table (from parseNyancomboParam).
 * @param {(combo:object)=>boolean} [unitMatcher] Optional CharaGroup gate.
 * @returns {number} The summed increment (percentage points, BCU semantics).
 */
export function getInc(type, activeCombos, values, unitMatcher = null) {
  let inc = 0;
  for (const combo of (Array.isArray(activeCombos) ? activeCombos : [])) {
    if (combo.type !== type) continue;
    if (typeof unitMatcher === 'function' && unitMatcher(combo) !== true) continue;
    const row = values?.[combo.type];
    if (!Array.isArray(row)) continue;
    inc += Number(row[combo.lv]) || 0;
  }
  return inc;
}
