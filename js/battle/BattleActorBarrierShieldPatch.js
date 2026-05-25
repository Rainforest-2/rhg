import { BattleActor } from './BattleActor.js';

const PATCH_FLAG = Symbol.for('wanko-battle.actor-barrier-shield-patch.v1');

function combatModel(actor) {
  return actor?.bcuCombatModel || actor?.rawStats?.bcuCombatModel || actor?.stats?.bcuCombatModel || null;
}

function procModel(actor) {
  return combatModel(actor)?.proc || {};
}

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function procSucceeded(calc, key) {
  const list = [...(calc?.proc?.applied || []), ...(calc?.proc?.pending || [])];
  return list.some((p) => p?.key === key);
}

function ensureBarrierShield(actor) {
  if (actor.__bcuBarrierShieldInitialized) return;
  actor.__bcuBarrierShieldInitialized = true;
  const proc = procModel(actor);
  const barrierHp = Math.max(0, Math.trunc(num(proc?.barrier?.health, 0)));
  const shieldHpRaw = Math.max(0, Math.trunc(num(proc?.demonShield?.hp, 0)));
  actor.bcuBarrierHp = Number.isFinite(actor.bcuBarrierHp) ? actor.bcuBarrierHp : barrierHp;
  actor.bcuBarrierMaxHp = Number.isFinite(actor.bcuBarrierMaxHp) ? actor.bcuBarrierMaxHp : barrierHp;
  actor.bcuDemonShieldHp = Number.isFinite(actor.bcuDemonShieldHp) ? actor.bcuDemonShieldHp : shieldHpRaw;
  actor.bcuDemonShieldMaxHp = Number.isFinite(actor.bcuDemonShieldMaxHp) ? actor.bcuDemonShieldMaxHp : shieldHpRaw;
  actor.bcuDemonShieldRegenPercent = num(proc?.demonShield?.regen, 0);
  actor.lastBcuBarrierShieldInitDebug = {
    source: 'BCU Entity barrier/status[P_BARRIER] and currentShield init from BcuCombatModel.proc',
    barrierHp,
    shieldHp: shieldHpRaw,
    shieldRegenPercent: actor.bcuDemonShieldRegenPercent,
    modelSource: combatModel(actor)?.source || null
  };
}

function gateBarrier(actor, damage, meta = {}) {
  const calc = meta.damageCalculation || null;
  if (!Number.isFinite(actor.bcuBarrierHp) || actor.bcuBarrierHp <= 0) return { blocked: false, damage };
  const brokenByProc = procSucceeded(calc, 'barrierBreaker');
  if (brokenByProc) {
    const before = actor.bcuBarrierHp;
    actor.bcuBarrierHp = 0;
    return { blocked: false, damage, event: { type: 'barrier-breaker', before, after: 0, source: 'BCU atk.getProc().BREAK.prob > 0' } };
  }
  if (damage >= actor.bcuBarrierHp) {
    const before = actor.bcuBarrierHp;
    actor.bcuBarrierHp = 0;
    return { blocked: true, damage: 0, event: { type: 'barrier-broken-by-damage', before, after: 0, absorbedDamage: damage, source: 'BCU barrier breaks and cancels current damage/procs' } };
  }
  return { blocked: true, damage: 0, event: { type: 'barrier-hit-blocked', before: actor.bcuBarrierHp, after: actor.bcuBarrierHp, absorbedDamage: damage, source: 'BCU barrier blocks insufficient damage and cancels procs' } };
}

function gateShield(actor, damage, meta = {}) {
  const calc = meta.damageCalculation || null;
  if (!Number.isFinite(actor.bcuDemonShieldHp) || actor.bcuDemonShieldHp <= 0) return { blocked: false, damage };
  const pierced = procSucceeded(calc, 'shieldPierce');
  if (pierced) {
    const before = actor.bcuDemonShieldHp;
    actor.bcuDemonShieldHp = 0;
    return { blocked: false, damage, event: { type: 'shield-pierced', before, after: 0, source: 'BCU atk.getProc().SHIELDBREAK.prob > 0' } };
  }
  if (damage >= actor.bcuDemonShieldHp) {
    const before = actor.bcuDemonShieldHp;
    actor.bcuDemonShieldHp = 0;
    return { blocked: true, damage: 0, event: { type: 'shield-broken-by-damage', before, after: 0, absorbedDamage: damage, source: 'BCU shield breaks by damage and cancels current damage/procs unless SHIELDBREAK passes first' } };
  }
  const before = actor.bcuDemonShieldHp;
  actor.bcuDemonShieldHp = Math.max(0, before - damage);
  return { blocked: true, damage: 0, event: { type: 'shield-hit-absorbed', before, after: actor.bcuDemonShieldHp, absorbedDamage: damage, source: 'BCU shield absorbs insufficient damage' } };
}

export function installBattleActorBarrierShieldPatch() {
  const proto = BattleActor?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  const originalTakeDamage = proto.takeDamage;
  if (typeof originalTakeDamage !== 'function') {
    throw new Error('BattleActor.takeDamage is missing; cannot install BCU barrier/shield patch');
  }

  proto.takeDamage = function takeDamageWithBcuBarrierShield(amount, meta = {}) {
    ensureBarrierShield(this);
    let damage = Math.max(0, Number.isFinite(amount) ? amount : 0);
    const events = [];

    const barrier = gateBarrier(this, damage, meta);
    if (barrier.event) events.push(barrier.event);
    if (barrier.blocked) {
      this.lastBcuBarrierShieldDebug = { source: 'BattleActorBarrierShieldPatch', originalDamage: amount, finalDamage: 0, blockedBy: 'barrier', events };
      return { accepted: false, dead: false, knockedBack: false, pending: false, blocked: true, blockedBy: 'barrier', bcuBarrierShieldEvents: events };
    }
    damage = barrier.damage;

    const shield = gateShield(this, damage, meta);
    if (shield.event) events.push(shield.event);
    if (shield.blocked) {
      this.lastBcuBarrierShieldDebug = { source: 'BattleActorBarrierShieldPatch', originalDamage: amount, finalDamage: 0, blockedBy: 'shield', events };
      return { accepted: false, dead: false, knockedBack: false, pending: false, blocked: true, blockedBy: 'shield', bcuBarrierShieldEvents: events };
    }
    damage = shield.damage;

    const nextMeta = events.length ? { ...meta, bcuBarrierShieldEvents: events, finalDamageBeforeBarrierShield: amount, finalDamageAfterBarrierShield: damage } : meta;
    const result = originalTakeDamage.call(this, damage, nextMeta);
    if (events.length) {
      result.bcuBarrierShieldEvents = events;
      result.finalDamageAfterBarrierShield = damage;
      this.lastBcuBarrierShieldDebug = { source: 'BattleActorBarrierShieldPatch', originalDamage: amount, finalDamage: damage, blockedBy: null, events, accepted: result.accepted };
    }
    return result;
  };

}

installBattleActorBarrierShieldPatch();
