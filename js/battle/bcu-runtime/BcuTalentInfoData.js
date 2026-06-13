// BCU talent / PCoin (本能) per-unit definition loader — Phase 4b.
//
// Fact-first source: references/bcu/.../battle/data/PCoin.java (read() +
// constructor) and util/Data.java (PC_CORRES). Loads ./org/data/SkillAcquisition.csv:
//   row = [unitId, typeID, then 8 talent slots of 14 ints each].
//   slot layout = [abilityID, maxLv, min1, max1, min2, max2, min3, max3,
//                  min4, max4, textID, lvID, nameID, limit].
//   a slot is used iff abilityID != 0 (PCoin constructor's strs[2+i*14] != 0).
//
// abilityID indexes PC_CORRES; the attack/HP talent multipliers (PCoin.getAtk/
// HPMultiplication, applied at construction) live in BcuTalentModifier. This
// module loads the definitions and applies those multipliers to unit stats.

import {
  PC_CATEGORY,
  PC_SUBTYPE,
  getTalentAttackMultiplier,
  getTalentHpMultiplier
} from './BcuTalentModifier.js';

const TALENT_SLOT_LEN = 14;
const TALENT_SLOT_COUNT = 8;
const ROW_HEADER = 2; // [unitId, typeID] before the slots.

// util/Data.java PC_CORRES: category per abilityID (0..65). Only the category
// and the PC_BASE subtype are needed for the attack/HP multipliers; subtypes of
// non-PC_BASE rows are not modelled here (their category gate excludes them).
const PC_CORRES_CATEGORY = Object.freeze([
  -1, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 2,
  2, 2, 2, 3, 0, 2, 2, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 3, 3, 3, 3, 3, 3, 0, 0,
  0, 3, 0, 3, 0, 4, 0, 1, 0, 2, 0, 1, 0, 0
]);

// Accurate subtype for the PC_BASE (category 2) rows; everything else is -1.
const PC_BASE_SUBTYPE = Object.freeze({
  25: PC_SUBTYPE.PC2_COST,
  26: PC_SUBTYPE.PC2_CD,
  27: PC_SUBTYPE.PC2_SPEED,
  28: PC_SUBTYPE.PC2_HB,
  31: PC_SUBTYPE.PC2_ATK,
  32: PC_SUBTYPE.PC2_HP,
  61: PC_SUBTYPE.PC2_TBA
});

export const PC_CORRES = Object.freeze(PC_CORRES_CATEGORY.map((cat, i) => Object.freeze([
  cat,
  cat === PC_CATEGORY.PC_BASE ? (PC_BASE_SUBTYPE[i] ?? -1) : -1
])));

function parseIntsCsvLine(line) {
  return String(line).trim().split(',').map((s) => {
    const n = Number.parseInt(s.trim(), 10);
    return Number.isFinite(n) ? n : 0;
  });
}

/**
 * Parse SkillAcquisition.csv into a Map<unitId, info[]> where each info entry is
 * a 14-int talent slot, mirroring PCoin's constructor (only abilityID != 0 slots
 * are kept, in slot order).
 */
export function parseSkillAcquisition(csvText) {
  const map = new Map();
  const lines = String(csvText ?? '').split(/\r?\n/);
  for (let li = 1; li < lines.length; li++) { // skip header
    const line = lines[li];
    if (!line || !line.trim()) continue;
    const ints = parseIntsCsvLine(line);
    if (ints.length < ROW_HEADER + TALENT_SLOT_LEN) continue;
    const unitId = ints[0];
    const info = [];
    for (let i = 0; i < TALENT_SLOT_COUNT; i++) {
      const off = ROW_HEADER + i * TALENT_SLOT_LEN;
      if (off >= ints.length) break;
      if (ints[off] === 0) continue; // abilityID 0 -> empty slot
      info.push(ints.slice(off, off + TALENT_SLOT_LEN));
    }
    if (info.length) map.set(unitId, info);
  }
  return map;
}

function decodePropertiesValue(value) {
  return String(value ?? '')
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\:/g, ':')
    .replace(/\\=/g, '=')
    .replace(/\\\\/g, '\\');
}

export function parseTalentAbilityNames(propertiesText) {
  const out = {};
  for (const line of String(propertiesText ?? '').split(/\r?\n/)) {
    const clean = line.trim();
    if (!clean || clean.startsWith('#') || clean.startsWith('!')) continue;
    const m = /^aq(\d+)\s*[:=]\s*(.*)$/.exec(clean);
    if (!m) continue;
    const name = decodePropertiesValue(m[2]).trim();
    if (!name || name === '(null)') continue;
    out[Number.parseInt(m[1], 10)] = name;
  }
  return out;
}

// Module-level registry of per-unit talent definitions.
let talentInfoRegistry = new Map();

export function setTalentInfoRegistry(map) {
  talentInfoRegistry = map instanceof Map ? map : new Map();
  return talentInfoRegistry;
}

export function getTalentInfoForUnit(unitId) {
  const info = talentInfoRegistry.get(Number(unitId));
  return Array.isArray(info) ? info : null;
}

export function isTalentRegistryLoaded() {
  return talentInfoRegistry.size > 0;
}

// Talent ability display names, keyed by abilityID, from the BCU localization
// (`<locale>-util.properties` keys `aq<abilityID>`).
let talentAbilityNames = {};

export function setTalentAbilityNames(map) {
  talentAbilityNames = (map && typeof map === 'object') ? map : {};
  return talentAbilityNames;
}

export function getTalentAbilityName(abilityID) {
  const name = talentAbilityNames[abilityID];
  return name || null;
}

export function isTalentAbilityNameRegistryLoaded() {
  return Object.keys(talentAbilityNames).length > 0;
}

function scaleHits(attackHits, factor) {
  if (!Array.isArray(attackHits) || factor === 1) return attackHits;
  return attackHits.map((hit) => (hit && Number.isFinite(hit.damage)
    ? { ...hit, baseDamage: hit.baseDamage ?? hit.damage, damage: Math.trunc(hit.damage * factor) }
    : hit));
}

/**
 * Apply talent attack/HP multipliers to resolved stats, mirroring BCU's
 * construction-time PCoin.getAtkMultiplication / getHPMultiplication.
 *
 * @param {object} stats Resolved stats.
 * @param {number[][]} info Per-unit talent definitions.
 * @param {number[]} talents Selected talent levels (positionally aligned to info).
 */
export function applyTalentToStats(stats, info, talents) {
  if (!stats || typeof stats !== 'object' || !Array.isArray(info) || !Array.isArray(talents)) return stats;
  const atkMul = getTalentAttackMultiplier(info, talents, PC_CORRES);
  const hpMul = getTalentHpMultiplier(info, talents, PC_CORRES);
  if (atkMul === 1 && hpMul === 1) {
    return { ...stats, bcuTalentModifier: { applied: false, atkMul, hpMul } };
  }
  return {
    ...stats,
    hp: Number.isFinite(stats.hp) ? Math.trunc(stats.hp * hpMul) : stats.hp,
    maxHp: Number.isFinite(stats.maxHp) ? Math.trunc(stats.maxHp * hpMul) : stats.maxHp,
    damage: Number.isFinite(stats.damage) ? Math.trunc(stats.damage * atkMul) : stats.damage,
    attackHits: scaleHits(stats.attackHits, atkMul),
    bcuTalentModifier: {
      applied: true,
      bcuReference: 'PCoin.getAtkMultiplication / getHPMultiplication',
      atkMul,
      hpMul,
      preTalentHp: Number.isFinite(stats.hp) ? stats.hp : null,
      preTalentDamage: Number.isFinite(stats.damage) ? stats.damage : null
    }
  };
}
