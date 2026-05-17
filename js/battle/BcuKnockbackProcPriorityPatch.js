import { BattleActor } from './BattleActor.js';

const PATCH_FLAG = Symbol.for('wanko-battle.bcu-kb-proc-priority.v1');
const KB_DIS = Object.freeze({ INT_KB: 165, INT_HB: 345, INT_SW: 705, INT_ASS: 55 });
const KB_TIME = Object.freeze({ INT_KB: 11, INT_HB: 23, INT_SW: 47, INT_ASS: 11 });
const KB_PRI = Object.freeze({ INT_KB: 2, INT_HB: 4, INT_SW: 5, INT_ASS: 1, INT_WARP: 3 });

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function queueProcKb(actor, item, meta = {}) {
  if (!actor?.isAlive?.()) return { applied: false, reason: 'target-not-alive' };
  if (actor.state === 'knockback') return { applied: false, reason: 'already-knockback' };
  const payload = item?.payload || {};
  const dis = num(payload.dis, KB_DIS.INT_KB) || KB_DIS.INT_KB;
  const time = num(payload.timeFrames ?? payload.time, KB_TIME.INT_KB) || KB_TIME.INT_KB;
  if (typeof actor.queueBcuInterrupt === 'function') {
    const queued = actor.queueBcuInterrupt('INT_KB', dis, {
      reason: 'proc-kb',
      source: 'BCU processProcs atkProc.KB -> KBManager.interrupt(P_KB, dis)',
      proc: item,
      time,
      attacker: meta.attacker?.instanceId || meta.attacker?.label || null,
      nowMs: meta.nowMs ?? null
    });
    actor.bcuQueuedProcKbTime = time;
    actor.lastBcuProcKbQueueDebug = { queued, dis, time, item, source: 'BcuKnockbackProcPriorityPatch.queueProcKb' };
    return { applied: queued, queued, reason: queued ? 'proc-kb-queued-for-post-update' : 'proc-kb-queue-rejected', dis, time };
  }
  actor.startKnockback?.({ type: 'proc', reason: 'proc-kb-direct-fallback', bcuType: 'INT_KB', bcuDistance: dis, bcuStatusFrames: time, specType: 'PROC_KB_WHITE', tuning: meta.tuning || {}, nowMs: meta.nowMs });
  return { applied: actor.state === 'knockback', reason: 'proc-kb-direct-fallback', dis, time };
}

function chooseInterrupt(actor, hbNeeded, deathReached, tuning, nowMs) {
  let type = actor.bcuTempKbType || null;
  let dist = num(actor.bcuTempKbDist, 0);
  let statusFrames = num(actor.bcuQueuedProcKbTime, KB_TIME[type] || 0);
  let reason = actor.bcuTempKbDetail?.reason || null;
  if (hbNeeded && (!type || KB_PRI.INT_HB >= (KB_PRI[type] || 0))) {
    type = 'INT_HB';
    dist = KB_DIS.INT_HB;
    statusFrames = KB_TIME.INT_HB;
    reason = deathReached ? 'final-hp-death' : 'hp-threshold';
  }
  if (!type) return null;
  const specType = type === 'INT_KB' ? 'PROC_KB_WHITE' : type === 'INT_SW' ? 'BOSS_SHOCKWAVE' : type === 'INT_ASS' ? 'CANNON' : 'HP_KB';
  const kind = type === 'INT_KB' ? 'proc' : deathReached ? 'final' : 'hp';
  return { type: kind, reason: reason || 'bcu-interrupt', deathAfterKnockback: deathReached, bcuType: type, bcuDistance: dist || KB_DIS[type], bcuStatusFrames: statusFrames || KB_TIME[type], specType, tuning, nowMs };
}

function clearQueuedInterrupt(actor) {
  actor.bcuTempKbType = null;
  actor.bcuTempKbDist = 0;
  actor.bcuTempKbDetail = null;
  actor.bcuQueuedProcKbTime = null;
}

if (!BattleActor.prototype[PATCH_FLAG]) {
  BattleActor.prototype[PATCH_FLAG] = true;

  const previousApply = BattleActor.prototype.applyBcuProc;
  BattleActor.prototype.applyBcuProc = function applyBcuProcWithQueuedKb(item, meta = {}) {
    if (item?.key === 'knockbackProc') {
      const result = queueProcKb(this, item, meta);
      this.lastBcuProcApplyDebug = { item, result, nowMs: meta.nowMs ?? null, source: 'BcuKnockbackProcPriorityPatch.applyBcuProc' };
      return result;
    }
    return previousApply ? previousApply.call(this, item, meta) : { applied: false, reason: 'previous-applyBcuProc-missing' };
  };

  BattleActor.prototype.resolvePostDamage = function resolvePostDamageWithBcuInterruptPriority({ nowMs = 0, tuning = {} } = {}) {
    if (this.pendingDamage <= 0) return { damaged: false, dead: false, knockedBack: false };
    if (!this.isAlive()) { this.clearPendingDamage?.(); clearQueuedInterrupt(this); return { damaged: false, dead: false, knockedBack: false }; }
    const damage = Math.max(0, this.pendingDamage);
    const hpBefore = this.hp;
    const hb = Math.max(1, this.knockbacks || 1);
    let ext = (hpBefore * hb) % this.maxHp;
    if (ext === 0) ext = this.maxHp;
    const hpAfter = Math.max(0, hpBefore - damage);
    const deathReached = hpAfter <= 0;
    const hbNeeded = !this.isBase && damage > 0 && this.state !== 'knockback' && (ext <= damage * hb || hpBefore < damage);
    this.hp = hpAfter;
    if (deathReached) {
      this.deathPending = true;
      this.isAliveFlag = false;
      this.lastKilledBy = Array.isArray(this.pendingHits) ? this.pendingHits.slice() : [];
    }
    const kbRequest = chooseInterrupt(this, hbNeeded, deathReached, tuning, nowMs);
    this.lastDamageResolveDebug = {
      serial: ++this.damageResolveSerial,
      source: 'BcuKnockbackProcPriorityPatch.resolvePostDamageWithBcuInterruptPriority',
      bcuReference: 'Entity.postUpdate: process procs queue interrupts, HB may override by KB_PRI, then kb.doInterrupt()',
      hpBefore,
      hpAfter,
      damage,
      hb,
      ext,
      hbNeeded,
      queuedType: this.bcuTempKbType || null,
      queuedDistance: this.bcuTempKbDist || 0,
      chosenType: kbRequest?.bcuType || null,
      chosenReason: kbRequest?.reason || null,
      deathReached
    };
    this.clearPendingDamage?.();
    clearQueuedInterrupt(this);
    const result = { damaged: true, hpBefore, hpAfter, damage, dead: false, deathPending: deathReached, knockedBack: false };
    if (kbRequest) {
      this.startKnockback(kbRequest);
      result.knockedBack = this.state === 'knockback';
    } else if (deathReached) {
      this.enterDeadState?.(nowMs);
      result.dead = true;
    }
    this.lastKbRuntimePostDamageDebug = { source: 'BcuKnockbackProcPriorityPatch.resolvePostDamage', damaged: result.damaged, dead: result.dead, deathPending: result.deathPending, knockedBack: result.knockedBack, hp: this.hp, maxHp: this.maxHp, chosenType: kbRequest?.bcuType || null };
    return result;
  };

  globalThis.__BCU_KB_PROC_PRIORITY_PATCH_DEBUG__ = { installed: true, KB_PRI, KB_TIME, KB_DIS, source: 'BcuKnockbackProcPriorityPatch' };
}
