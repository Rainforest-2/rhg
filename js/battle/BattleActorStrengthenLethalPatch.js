import { BattleActor } from './BattleActor.js';

const PATCH_FLAG = Symbol.for('wanko-battle.actor-strengthen-lethal-patch.v1');
const LETHAL_ICON_FRAMES = 45;

function procModel(actor) {
  return actor?.bcuCombatModel?.proc || actor?.rawStats?.bcuCombatModel?.proc || actor?.stats?.bcuCombatModel?.proc || actor?.abilityModel?.bcuProc || {};
}

function chance(prob, rng) {
  const p = Number(prob) || 0;
  if (p <= 0) return false;
  if (p >= 100) return true;
  return typeof rng === 'function' && rng() * 100 < p;
}

function actorFallbackRandom(actor) {
  let state = Number(actor?.__bcuFallbackRandomState);
  if (!Number.isFinite(state) || state <= 0) {
    const seedText = String(actor?.instanceId || actor?.slotId || actor?.label || 'bcu-actor');
    state = 0x811c9dc5;
    for (let i = 0; i < seedText.length; i += 1) state = Math.imul(state ^ seedText.charCodeAt(i), 16777619) >>> 0;
    if (!state) state = 1;
  }
  state = (Math.imul(1664525, state >>> 0) + 1013904223) >>> 0;
  actor.__bcuFallbackRandomState = state;
  return state / 0x100000000;
}

function getRandom(actor, meta = {}) {
  if (typeof meta.random === 'function') return meta.random;
  if (typeof actor?.__bcuLastBattleRandom === 'function') return actor.__bcuLastBattleRandom;
  return () => actorFallbackRandom(actor);
}

function ensureStatuses(actor) {
  if (!actor.bcuProcStatuses) actor.bcuProcStatuses = {};
  return actor.bcuProcStatuses;
}

function maybeActivateStrengthen(actor, nowMs = 0) {
  const spec = procModel(actor)?.strengthen || {};
  const health = Number(spec.health || 0);
  const mult = Number(spec.mult || 0);
  if (health <= 0 || mult <= 0 || actor?.bcuStrengthenActive === true) return { activated: false, reason: 'inactive-or-already-active' };
  if (!Number.isFinite(actor?.hp) || !Number.isFinite(actor?.maxHp) || actor.maxHp <= 0 || actor.hp <= 0) return { activated: false, reason: 'invalid-hp' };
  if (actor.hp * 100 > actor.maxHp * health) return { activated: false, reason: 'above-threshold', threshold: health };
  const statuses = ensureStatuses(actor);
  statuses.strengthen = {
    key: 'strengthen',
    active: true,
    mult,
    threshold: health,
    activatedAtMs: nowMs,
    source: 'BCU Entity.postUpdate status[P_STRONG][0]'
  };
  actor.bcuStrengthenActive = true;
  actor.bcuStrengthenMultiplier = mult;
  actor.lastBcuStrengthenDebug = { source: 'BattleActorStrengthenLethalPatch', activated: true, threshold: health, mult, hp: actor.hp, maxHp: actor.maxHp, nowMs };
  return { activated: true, status: statuses.strengthen };
}

function hasDeathResult(actor, result) {
  return result?.deathPending === true || result?.dead === true || actor?.deathPending === true || actor?.deathAfterKnockback === true || (Number.isFinite(actor?.hp) && actor.hp <= 0);
}

function applyLethalSurvive(actor, result, meta = {}) {
  const spec = procModel(actor)?.lethal || {};
  const prob = Number(spec.prob || 0);
  if (prob <= 0 || actor.bcuLethalSurviveChecked === true || !hasDeathResult(actor, result)) {
    return { applied: false, reason: 'not-eligible', prob };
  }
  actor.bcuLethalSurviveChecked = true;
  const rng = getRandom(actor, meta);
  const rolled = chance(prob, rng);
  actor.lastBcuLethalSurviveDebug = {
    source: 'BCU Entity.postUpdate status[P_LETHAL]',
    prob,
    rolled,
    nowMs: meta.nowMs ?? null
  };
  if (!rolled) return { applied: false, reason: 'probability-failed', prob };

  const statuses = ensureStatuses(actor);
  actor.hp = 1;
  actor.isAliveFlag = true;
  actor.deathPending = false;
  actor.deathAfterKnockback = false;
  actor.deathResolved = false;
  actor.deadAtMs = null;
  actor.lastKilledBy = null;
  if (actor.state === 'dead' || actor.state === 'dying') actor.state = 'knockback';
  if (actor.state === 'knockback') {
    actor.knockbackType = 'lethal';
    actor.knockbackReason = 'lethal-survive';
    actor.kbTouchState = 'kb';
  }
  statuses.lethal = {
    key: 'lethal',
    framesRemaining: LETHAL_ICON_FRAMES,
    prob,
    activatedAtMs: meta.nowMs ?? null,
    source: 'BCU Entity.AnimManager.getEff(P_LETHAL)'
  };
  return { applied: true, status: statuses.lethal };
}

export function installBattleActorStrengthenLethalPatch() {
  const proto = BattleActor?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  const originalResolvePostDamage = proto.resolvePostDamage;
  if (typeof originalResolvePostDamage !== 'function') throw new Error('BattleActor.resolvePostDamage is missing; cannot install strengthen/lethal patch');

  proto.resolvePostDamage = function resolvePostDamageWithStrengthenLethal(args = {}) {
    const result = originalResolvePostDamage.call(this, args);
    if (!result?.damaged) return result;
    const nowMs = Number.isFinite(args?.nowMs) ? args.nowMs : 0;
    const lethal = applyLethalSurvive(this, result, { ...args, nowMs });
    if (lethal.applied) {
      result.dead = false;
      result.deathPending = false;
      result.hpAfter = 1;
      result.lethalSurvive = lethal;
    }
    const strengthen = maybeActivateStrengthen(this, nowMs);
    if (strengthen.activated) result.strengthen = strengthen;
    this.lastBcuPostDamageAbilityDebug = { source: 'BattleActorStrengthenLethalPatch.resolvePostDamageWithStrengthenLethal', lethal, strengthen, result };
    return result;
  };
}

installBattleActorStrengthenLethalPatch();
