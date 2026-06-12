import { BattleActor } from './BattleActor.js';
import { BCU_PROC_IMMUNITY_FIELDS } from './BcuCombatModel.js';
import { applyBcuProcDistance, applyBcuProcDuration, applyBcuProcPercent, resolveBcuProcResistance } from './bcu-runtime/BcuResistRuntime.js';

const PATCH_FLAG = Symbol.for('wanko-battle.bcu-proc-immunity.v1');

const IMMUNITY_FIELD_BY_PROC = BCU_PROC_IMMUNITY_FIELDS;

function procModel(actor) {
  return actor?.bcuCombatModel?.proc || actor?.rawStats?.bcuCombatModel?.proc || actor?.stats?.bcuCombatModel?.proc || actor?.abilityModel?.bcuProc || null;
}

function combatModel(actor) {
  return actor?.bcuCombatModel || actor?.rawStats?.bcuCombatModel || actor?.stats?.bcuCombatModel || null;
}

function checkSmartImu(value, side, invert) {
  const s = Number(side) || 0;
  if (s === 0) return true;
  const v = Number(value) || 0;
  return invert ? v * s < 0 : v * s > 0;
}

function immunityMult(actor, procKey, item = null) {
  const field = IMMUNITY_FIELD_BY_PROC[procKey];
  const cm = combatModel(actor);
  const proc = procModel(actor);
  const raw = proc?.[field] || {};
  const direct = Number(cm?.immunity?.[procKey]?.mult);
  const n = Number.isFinite(direct) ? direct : Number(raw?.mult ?? 0);
  const mult = Number.isFinite(n) ? n : 0;
  if (field === 'IMUWEAK') {
    const smartImu = Number(raw?.smartImu ?? 0) || 0;
    const weakenMult = Number(item?.payload?.mult ?? 100);
    const applies = checkSmartImu(weakenMult - 100, smartImu, mult > 0);
    return applies ? mult : 0;
  }
  return mult;
}

function isImmune(actor, item, meta = {}) {
  const key = item?.key;
  const field = IMMUNITY_FIELD_BY_PROC[key];
  if (!field) return { immune: false, field: null, mult: 0 };
  const mult = immunityMult(actor, key, item);
  const resistance = resolveBcuProcResistance({ target: actor, attacker: meta?.attacker || item?.attacker || null, item: { ...item, attack: meta?.attack || item?.attack || null }, procName: field, procResist: mult });
  return { immune: resistance.full, partial: resistance.partial, field, mult: resistance.mult, resistance };
}

function itemWithPartialResistance(item, immunity) {
  if (!immunity?.partial) return { item, adjusted: false };
  const key = item?.key;
  const payload = { ...(item?.payload || {}) };
  if (key === 'knockbackProc') {
    if (Object.prototype.hasOwnProperty.call(payload, 'dis')) payload.dis = applyBcuProcDistance({ rawDistance: payload.dis, resist: immunity.mult });
    if (Object.prototype.hasOwnProperty.call(payload, 'distance')) payload.distance = applyBcuProcDistance({ rawDistance: payload.distance, resist: immunity.mult });
    return { item: { ...item, payload, bcuProcResistance: immunity }, adjusted: true };
  }
  if (key === 'freeze' || key === 'slow' || key === 'weaken' || key === 'curse' || key === 'warp') {
    if (Object.prototype.hasOwnProperty.call(payload, 'time')) payload.time = applyBcuProcDuration({ rawTime: payload.time, resist: immunity.mult });
    if (Object.prototype.hasOwnProperty.call(payload, 'timeFrames')) payload.timeFrames = applyBcuProcDuration({ rawTime: payload.timeFrames, resist: immunity.mult });
    return { item: { ...item, payload, bcuProcResistance: immunity }, adjusted: true };
  }
  if (key === 'toxic') {
    if (Object.prototype.hasOwnProperty.call(payload, 'mult')) payload.mult = applyBcuProcPercent({ rawPercent: payload.mult, resist: immunity.mult });
    if (Object.prototype.hasOwnProperty.call(payload, 'damage')) payload.damage = applyBcuProcPercent({ rawPercent: payload.damage, resist: immunity.mult });
    return { item: { ...item, payload, bcuProcResistance: immunity }, adjusted: true };
  }
  if (key === 'summon') {
    if (Object.prototype.hasOwnProperty.call(payload, 'mult')) payload.mult = applyBcuProcPercent({ rawPercent: payload.mult, resist: immunity.mult });
    return { item: { ...item, payload, bcuProcResistance: immunity }, adjusted: true };
  }
  return { item, adjusted: false };
}

if (!BattleActor.prototype[PATCH_FLAG]) {
  BattleActor.prototype[PATCH_FLAG] = true;
  const previousApply = BattleActor.prototype.applyBcuProc;
  BattleActor.prototype.applyBcuProc = function applyBcuProcWithImmunity(item, meta = {}) {
    const immunity = isImmune(this, item, meta);
    if (immunity.immune) {
      const result = {
        applied: false,
        immune: true,
        reason: `bcu-${immunity.field}-immunity`,
        field: immunity.field,
        mult: immunity.mult,
        resistance: immunity.resistance,
        item
      };
      this.lastBcuProcImmunityDebug = {
        source: 'BcuProcImmunityPatch.applyBcuProc',
        bcuReference: 'Entity.processProcs checks target getProc().IMU* before applying STOP/SLOW/WEAK/CURSE/KB/WARP/etc; full immunity mult=100 blocks proc and shows INV effect in BCU',
        item,
        result,
        resistanceBreakdown: immunity.resistance?.breakdown || null,
        unsupportedResistanceSources: immunity.resistance?.unsupportedSources || [],
        target: this.instanceId || this.label || null,
        nowMs: meta.nowMs ?? null
      };
      this.lastBcuProcApplyDebug = { item, result, nowMs: meta.nowMs ?? null, source: 'BcuProcImmunityPatch.applyBcuProc' };
      return result;
    }
    const adjusted = itemWithPartialResistance(item, immunity);
    const result = previousApply ? (previousApply.call(this, adjusted.item, meta) || { applied: false, reason: 'previous-applyBcuProc-returned-empty' }) : { applied: false, reason: 'previous-applyBcuProc-missing' };
    if (adjusted.adjusted) {
      result.bcuProcResistance = {
        field: immunity.field,
        mult: immunity.mult,
        source: 'BcuResistRuntime partial resistance',
        breakdown: immunity.resistance?.breakdown || null,
        unsupportedSources: immunity.resistance?.unsupportedSources || [],
        bcuReference: 'Entity.processProcs getResistValue / POIATK mult * (100-rst)'
      };
    }
    this.lastBcuProcImmunityDebug = {
      source: 'BcuProcImmunityPatch.applyBcuProc',
      item: adjusted.item,
      checkedField: immunity.field,
      immunityMult: immunity.mult,
      immune: false,
      partial: immunity.partial,
      adjusted: adjusted.adjusted,
      resistanceBreakdown: immunity.resistance?.breakdown || null,
      unsupportedResistanceSources: immunity.resistance?.unsupportedSources || [],
      delegatedResult: result
    };
    return result;
  };

  globalThis.__BCU_PROC_IMMUNITY_PATCH_DEBUG__ = {
    installed: true,
    source: 'BcuProcImmunityPatch',
    immunityFieldByProc: IMMUNITY_FIELD_BY_PROC,
    fullImmunityOnly: false,
    partialResistance: ['knockbackProc', 'freeze', 'slow', 'weaken', 'curse', 'warp', 'toxic', 'summon']
  };
}
