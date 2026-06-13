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
import { BCU_ABI, BCU_TRAITS } from '../BcuCombatModel.js';

const TALENT_SLOT_LEN = 14;
const TALENT_SLOT_COUNT = 8;
const ROW_HEADER = 2; // [unitId, typeID] before the slots.

// util/Data.java PC_CORRES: category per abilityID (0..65). Only the category
// and the PC_BASE subtype are needed for the attack/HP multipliers; subtypes of
// non-PC_BASE rows are not modelled here (their category gate excludes them).
const PC_CORRES_RAW = Object.freeze([
  [-1, 0, 0, -1],
  [0, 'weaken', 3, -1],
  [0, 'freeze', 2, -1],
  [0, 'slow', 2, -1],
  [1, BCU_ABI.AB_ONLY, 0, -1],
  [1, BCU_ABI.AB_GOOD, 0, -1],
  [1, BCU_ABI.AB_RESIST, 0, -1],
  [1, BCU_ABI.AB_MASSIVE, 0, -1],
  [0, 'knockbackProc', 1, -1],
  [0, 'warp', 4, -1],
  [0, 'strengthen', 2, -1],
  [0, 'lethal', 1, -1],
  [0, 'baseDestroyer', 0, -1],
  [0, 'critical', 1, -1],
  [1, BCU_ABI.AB_ZKILL, 0, -1],
  [0, 'barrierBreaker', 1, -1],
  [0, 'bounty', 0, -1],
  [0, 'wave', 2, -1],
  [0, 'IMUWEAK', 1, -1],
  [0, 'IMUSTOP', 1, -1],
  [0, 'IMUSLOW', 1, -1],
  [0, 'IMUKB', 1, -1],
  [0, 'IMUWAVE', 1, -1],
  [1, BCU_ABI.AB_WAVES, 0, -1],
  [0, 'IMUWARP', 1, -1],
  [2, PC_SUBTYPE.PC2_COST, 1, -1],
  [2, PC_SUBTYPE.PC2_CD, 1, -1],
  [2, PC_SUBTYPE.PC2_SPEED, 1, -1],
  [2, PC_SUBTYPE.PC2_HB, 1, -1],
  [3, 'IMUCURSE', 0, 30],
  [0, 'IMUCURSE', 1, -1],
  [2, PC_SUBTYPE.PC2_ATK, 1, -1],
  [2, PC_SUBTYPE.PC2_HP, 1, -1],
  [4, BCU_TRAITS.red, 0, -1],
  [4, BCU_TRAITS.floating, 0, -1],
  [4, BCU_TRAITS.black, 0, -1],
  [4, BCU_TRAITS.metal, 0, -1],
  [4, BCU_TRAITS.angel, 0, -1],
  [4, BCU_TRAITS.alien, 0, -1],
  [4, BCU_TRAITS.zombie, 0, -1],
  [4, BCU_TRAITS.relic, 0, -1],
  [4, BCU_TRAITS.white, 0, -1],
  [4, BCU_TRAITS.witch, 0, -1],
  [4, BCU_TRAITS.eva, 0, -1],
  [3, 'IMUWEAK', 0, 18],
  [3, 'IMUSTOP', 0, 19],
  [3, 'IMUSLOW', 0, 20],
  [3, 'IMUKB', 0, 21],
  [3, 'IMUWAVE', 0, 22],
  [3, 'IMUWARP', 0, 24],
  [0, 'strongAttack', 2, -1],
  [0, 'attackNullify', 2, -1],
  [0, 'IMUPOIATK', 1, -1],
  [3, 'IMUPOIATK', 0, 52],
  [0, 'IMUVOLC', 1, -1],
  [3, 'IMUVOLC', 0, 54],
  [0, 'volcano', 4, -1],
  [4, BCU_TRAITS.demon, 0, -1],
  [0, 'shieldBreaker', 1, -1],
  [1, BCU_ABI.AB_CKILL, 0, -1],
  [0, 'curse', 2, -1],
  [2, PC_SUBTYPE.PC2_TBA, 1, -1],
  [0, 'miniWave', 4, -1],
  [1, BCU_ABI.AB_BAKILL, 0, -1],
  [0, 'beastHunter', 2, -1],
  [0, 'miniVolcano', 4, -1],
  [1, BCU_ABI.AB_SKILL, 0, -1],
  [0, 'blast', 3, -1]
]);
const PC_CORRES_CATEGORY = Object.freeze(PC_CORRES_RAW.map((row) => row[0]));

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
  cat === PC_CATEGORY.PC_BASE ? (PC_BASE_SUBTYPE[i] ?? -1) : PC_CORRES_RAW[i]?.[1] ?? -1,
  PC_CORRES_RAW[i]?.[2] ?? 0,
  PC_CORRES_RAW[i]?.[3] ?? -1
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

function talentModValue(infoEntry, talentLevel, modIndex = 0) {
  if (!Array.isArray(infoEntry) || infoEntry.length < 4) return 0;
  const lv = Math.trunc(Number(talentLevel) || 0);
  if (lv === 0) return 0;
  const maxlv = Math.trunc(Number(infoEntry[1]) || 0);
  const off = 2 + modIndex * 2;
  const v0 = Math.trunc(Number(infoEntry[off]) || 0);
  const v1 = Math.trunc(Number(infoEntry[off + 1]) || 0);
  if (maxlv > 1) return Math.trunc((v1 - v0) * (lv - 1) / (maxlv - 1)) + v0;
  return v1;
}

function cloneCombatModel(stats) {
  const cm = stats?.bcuCombatModel;
  if (!cm || typeof cm !== 'object') return null;
  return {
    ...cm,
    traits: cm.traits ? { ...cm.traits, list: Array.isArray(cm.traits.list) ? cm.traits.list.slice() : [], flags: { ...(cm.traits.flags || {}) }, sources: Array.isArray(cm.traits.sources) ? cm.traits.sources.slice() : cm.traits.sources } : cm.traits,
    targetTraits: cm.targetTraits ? { ...cm.targetTraits, list: Array.isArray(cm.targetTraits.list) ? cm.targetTraits.list.slice() : [], flags: { ...(cm.targetTraits.flags || {}) }, sources: Array.isArray(cm.targetTraits.sources) ? cm.targetTraits.sources.slice() : cm.targetTraits.sources } : cm.targetTraits,
    ability: cm.ability ? { ...cm.ability, flags: { ...(cm.ability.flags || {}) }, sources: Array.isArray(cm.ability.sources) ? cm.ability.sources.slice() : cm.ability.sources } : cm.ability,
    proc: cm.proc ? { ...cm.proc } : {}
  };
}

function ensureProcField(proc, field) {
  if (!field) return null;
  const current = proc[field];
  if (current && typeof current === 'object') {
    proc[field] = { ...current };
  } else {
    proc[field] = {};
  }
  return proc[field];
}

function applyTalentSideEffects(stats, info, talents) {
  const cm = cloneCombatModel(stats);
  const bcuTalentEffects = [];
  let out = stats;
  if (!cm) return { stats: out, bcuTalentEffects };
  const levels = Array.isArray(talents) ? talents : [];
  for (let i = 0; i < info.length; i++) {
    const entry = info[i];
    const level = Math.trunc(Number(levels[i]) || 0);
    const typeCode = Number(entry?.[0]);
    const row = PC_CORRES[typeCode];
    if (!Array.isArray(row) || row[0] === -1) continue;
    const category = row[0];
    const target = row[1];
    if (level === 0) continue;
    const value = talentModValue(entry, level, 0);
    if (category === PC_CATEGORY.PC_AB) {
      cm.ability = cm.ability || { abi: 0, flags: {}, sources: [] };
      cm.ability.abi = (Number(cm.ability.abi) || 0) | Number(target);
      cm.ability.flags = { ...(cm.ability.flags || {}) };
      if (target === BCU_ABI.AB_ONLY) cm.ability.flags.targetOnly = true;
      if (target === BCU_ABI.AB_GOOD) cm.ability.flags.strong = true;
      if (target === BCU_ABI.AB_RESIST) cm.ability.flags.resistant = true;
      if (target === BCU_ABI.AB_MASSIVE) cm.ability.flags.massiveDamage = true;
      if (target === BCU_ABI.AB_ZKILL) cm.ability.flags.zombieKiller = true;
      if (target === BCU_ABI.AB_WAVES) cm.ability.flags.waveBlocker = true;
      if (target === BCU_ABI.AB_CKILL) cm.ability.flags.soulstrike = true;
      if (target === BCU_ABI.AB_BAKILL) cm.ability.flags.baronKiller = true;
      if (target === BCU_ABI.AB_SKILL) cm.ability.flags.sageSlayer = true;
      bcuTalentEffects.push({ slot: i, abilityID: typeCode, category: 'PC_AB', bit: target });
    } else if (category === PC_CATEGORY.PC_IMU) {
      const field = String(target);
      const proc = ensureProcField(cm.proc, field);
      proc.mult = 100;
      proc.block = 100;
      proc.full = true;
      bcuTalentEffects.push({ slot: i, abilityID: typeCode, category: 'PC_IMU', field, mult: 100 });
    } else if (category === PC_CATEGORY.PC_P && String(target).startsWith('IMU')) {
      const field = String(target);
      const proc = ensureProcField(cm.proc, field);
      const mult = Math.max(0, Math.min(100, Math.trunc(Number(proc.mult || proc.block || 0) + value)));
      proc.mult = mult;
      proc.block = mult;
      proc.full = mult >= 100;
      bcuTalentEffects.push({ slot: i, abilityID: typeCode, category: 'PC_P_RESIST', field, mult });
    } else if (category === PC_CATEGORY.PC_TRAIT) {
      const trait = String(target);
      cm.traits = cm.traits || { list: [], flags: {} };
      cm.targetTraits = cm.targetTraits || { list: [], flags: {} };
      for (const bag of [cm.traits, cm.targetTraits]) {
        bag.list = Array.isArray(bag.list) ? bag.list.slice() : [];
        if (!bag.list.includes(trait)) bag.list.push(trait);
        bag.flags = { ...(bag.flags || {}), [trait]: true };
      }
      bcuTalentEffects.push({ slot: i, abilityID: typeCode, category: 'PC_TRAIT', trait });
    } else if (category === PC_CATEGORY.PC_BASE) {
      if (target === PC_SUBTYPE.PC2_SPEED && Number.isFinite(out.speed)) out = { ...out, speed: out.speed + value };
      else if (target === PC_SUBTYPE.PC2_COST && Number.isFinite(out.cost)) out = { ...out, cost: Math.max(0, out.cost - value) };
      else if (target === PC_SUBTYPE.PC2_CD && Number.isFinite(out.respawn)) out = { ...out, respawn: Math.max(0, out.respawn - value) };
      else if (target === PC_SUBTYPE.PC2_HB && Number.isFinite(out.knockbacks)) out = { ...out, knockbacks: out.knockbacks + value };
      else if (target === PC_SUBTYPE.PC2_TBA && Number.isFinite(out.tbaFrames)) out = { ...out, tbaFrames: Math.trunc(out.tbaFrames * (100 - value) / 100) };
      bcuTalentEffects.push({ slot: i, abilityID: typeCode, category: 'PC_BASE', subtype: target, value });
    }
  }
  if (!bcuTalentEffects.length) return { stats, bcuTalentEffects };
  out = {
    ...out,
    bcuCombatModel: cm,
    bcuProc: cm.proc,
    bcuAbi: cm.ability?.abi ?? out.bcuAbi,
    bcuAbilityFlags: cm.ability?.flags || out.bcuAbilityFlags,
    traits: cm.traits?.list || out.traits,
    traitFlags: cm.traits?.flags || out.traitFlags,
    bcuTalentEffects
  };
  return { stats: out, bcuTalentEffects };
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
  const side = applyTalentSideEffects(stats, info, talents);
  const sideStats = side.stats;
  if (atkMul === 1 && hpMul === 1) {
    return { ...sideStats, bcuTalentModifier: { applied: side.bcuTalentEffects.length > 0, atkMul, hpMul, effects: side.bcuTalentEffects } };
  }
  return {
    ...sideStats,
    hp: Number.isFinite(sideStats.hp) ? Math.trunc(sideStats.hp * hpMul) : sideStats.hp,
    maxHp: Number.isFinite(sideStats.maxHp) ? Math.trunc(sideStats.maxHp * hpMul) : sideStats.maxHp,
    damage: Number.isFinite(sideStats.damage) ? Math.trunc(sideStats.damage * atkMul) : sideStats.damage,
    attackHits: scaleHits(sideStats.attackHits, atkMul),
    bcuTalentModifier: {
      applied: true,
      bcuReference: 'PCoin.getAtkMultiplication / getHPMultiplication',
      atkMul,
      hpMul,
      effects: side.bcuTalentEffects,
      preTalentHp: Number.isFinite(sideStats.hp) ? sideStats.hp : null,
      preTalentDamage: Number.isFinite(sideStats.damage) ? sideStats.damage : null
    }
  };
}
