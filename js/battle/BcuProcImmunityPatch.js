import { BattleActor } from './BattleActor.js';

const PATCH_FLAG = Symbol.for('wanko-battle.bcu-proc-immunity.v1');

const IMMUNITY_FIELD_BY_PROC = Object.freeze({
  knockbackProc: 'IMUKB',
  freeze: 'IMUSTOP',
  slow: 'IMUSLOW',
  weaken: 'IMUWEAK',
  curse: 'IMUCURSE',
  warp: 'IMUWARP',
  toxic: 'IMUPOIATK',
  wave: 'IMUWAVE',
  miniWave: 'IMUWAVE',
  surge: 'IMUVOLC',
  miniSurge: 'IMUVOLC'
});

function procModel(actor) {
  return actor?.bcuCombatModel?.proc || actor?.rawStats?.bcuCombatModel?.proc || actor?.stats?.bcuCombatModel?.proc || actor?.abilityModel?.bcuProc || null;
}

function immunityMult(actor, procKey) {
  const field = IMMUNITY_FIELD_BY_PROC[procKey];
  const proc = procModel(actor);
  const n = Number(proc?.[field]?.mult ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function isImmune(actor, item) {
  const key = item?.key;
  const field = IMMUNITY_FIELD_BY_PROC[key];
  if (!field) return { immune: false, field: null, mult: 0 };
  const mult = immunityMult(actor, key);
  // Current BCU CSV mapping only marks full immunity flags as mult=100.
  // Partial/smart immunity requires additional Proc smartImu handling and is not claimed here.
  return { immune: mult >= 100, field, mult };
}

if (!BattleActor.prototype[PATCH_FLAG]) {
  BattleActor.prototype[PATCH_FLAG] = true;
  const previousApply = BattleActor.prototype.applyBcuProc;
  BattleActor.prototype.applyBcuProc = function applyBcuProcWithImmunity(item, meta = {}) {
    const immunity = isImmune(this, item);
    if (immunity.immune) {
      const result = {
        applied: false,
        immune: true,
        reason: `bcu-${immunity.field}-immunity`,
        field: immunity.field,
        mult: immunity.mult,
        item
      };
      this.lastBcuProcImmunityDebug = {
        source: 'BcuProcImmunityPatch.applyBcuProc',
        bcuReference: 'Entity.processProcs checks target getProc().IMU* before applying STOP/SLOW/WEAK/CURSE/KB/WARP/etc; full immunity mult=100 blocks proc and shows INV effect in BCU',
        item,
        result,
        target: this.instanceId || this.label || null,
        nowMs: meta.nowMs ?? null
      };
      this.lastBcuProcApplyDebug = { item, result, nowMs: meta.nowMs ?? null, source: 'BcuProcImmunityPatch.applyBcuProc' };
      return result;
    }
    const result = previousApply ? previousApply.call(this, item, meta) : { applied: false, reason: 'previous-applyBcuProc-missing' };
    this.lastBcuProcImmunityDebug = {
      source: 'BcuProcImmunityPatch.applyBcuProc',
      item,
      checkedField: immunity.field,
      immunityMult: immunity.mult,
      immune: false,
      delegatedResult: result
    };
    return result;
  };

  globalThis.__BCU_PROC_IMMUNITY_PATCH_DEBUG__ = {
    installed: true,
    source: 'BcuProcImmunityPatch',
    immunityFieldByProc: IMMUNITY_FIELD_BY_PROC,
    fullImmunityOnly: true
  };
}
