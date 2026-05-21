import { BattleActor } from './BattleActor.js';
import { BattleAttackResolver } from './BattleAttackResolver.js';
import { bcuTraitCompatible, describeBcuTraitCompatibility, hasTargetOnly } from './BcuTraitCompatibility.js';

const PATCH_FLAG = Symbol.for('wanko-battle.soulstrike-patch.v1');
const RESOLVER_PATCH_FLAG = Symbol.for('wanko-battle.attack-resolver-soulstrike.v1');

function hasSoulstrike(event = null, attacker = null) {
  return event?.abilities?.soulstrike === true
    || event?.ability?.semantic?.soulstrike === true
    || attacker?.abilityModel?.bcuAbilityFlags?.soulstrike === true
    || attacker?.rawStats?.abilityModel?.bcuAbilityFlags?.soulstrike === true;
}

function isZombieCorpse(target) {
  return !!target?.bcuZombieRevivePending || !!target?.bcuZombieCorpse;
}

function isActorTargetableForEvent(target, event, attacker) {
  if (!target) return false;
  if (isZombieCorpse(target)) return hasSoulstrike(event, attacker);
  if (typeof target.isTargetable === 'function') return !!target.isTargetable();
  if (typeof target.isAlive === 'function') return !!target.isAlive();
  return false;
}

function isBcuTraitAllowed(target, event, attacker) {
  if (!hasTargetOnly(attacker, event)) return true;
  return bcuTraitCompatible({ attacker, target, targetType: 'actor', targetOnly: true });
}

export function installBattleSoulstrikePatch() {
  if (!BattleAttackResolver[RESOLVER_PATCH_FLAG]) {
    BattleAttackResolver[RESOLVER_PATCH_FLAG] = true;
    BattleAttackResolver.captureTargets = function captureTargetsSoulstrikeAware({ attacker, enemyActors, enemyBase, event }) {
      const mode = event?.targetMode || 'single';
      const actorCandidates = (enemyActors || [])
        .filter((t) => isActorTargetableForEvent(t, event, attacker))
        .filter((t) => this.isTargetInEventRange(attacker, t, event))
        .filter((t) => isBcuTraitAllowed(t, event, attacker))
        .map((target) => ({ target, targetType: 'actor', event, soulstrikeCorpse: isZombieCorpse(target) }));
      const baseCandidate = enemyBase?.isAlive?.() && event?.allowBaseHit !== false && this.isTargetInEventRange(attacker, enemyBase, event)
        ? { target: enemyBase, targetType: 'base', event }
        : null;
      if (mode === 'range') {
        const r = [...actorCandidates];
        if (baseCandidate) r.push(baseCandidate);
        return r;
      }
      const c = actorCandidates.length ? actorCandidates : (baseCandidate ? [baseCandidate] : []);
      const one = this.chooseSingleTarget(attacker, c);
      if (one?.targetType === 'actor' && hasTargetOnly(attacker, event)) {
        one.traitCompatibility = describeBcuTraitCompatibility({ attacker, target: one.target, targetType: 'actor', targetOnly: true });
      }
      return one ? [one] : [];
    };
  }

  const proto = BattleActor?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  proto.isBcuSoulstrikeTargetable = function isBcuSoulstrikeTargetable(event = null, attacker = null) {
    return isZombieCorpse(this) && hasSoulstrike(event, attacker);
  };

  const originalTakeDamage = proto.takeDamage;
  if (typeof originalTakeDamage !== 'function') {
    throw new Error('BattleActor.takeDamage is missing; cannot install soulstrike patch');
  }

  proto.takeDamage = function takeDamageWithSoulstrikeCorpse(amount, meta = {}) {
    const event = meta.event || meta.attackEvent || null;
    const attacker = meta.attacker || null;
    const soul = hasSoulstrike(event, attacker) || meta?.damageCalculation?.proc?.pending?.some?.((p) => p?.key === 'soulstrike');
    if (isZombieCorpse(this) && soul) {
      this.bcuZombieRevivePending = false;
      this.bcuZombieCorpse = false;
      this.bcuZombieReviveReadyAtMs = null;
      this.bcuZombieReviveHealthPercent = null;
      this.isAliveFlag = false;
      this.deathPending = false;
      this.deathResolved = true;
      this.deathAfterKnockback = false;
      this.state = 'dead';
      this.deadAtMs = Number.isFinite(meta.timeMs) ? meta.timeMs : (Number.isFinite(this.lastSceneTimeMs) ? this.lastSceneTimeMs : 0);
      this.lastBcuSoulstrikeDebug = {
        source: 'BCU AB_CKILL soulstrike corpse hit cancels zombie revive',
        attacker: attacker?.instanceId || attacker?.label || null,
        amount,
        timeMs: this.deadAtMs
      };
      return { accepted: true, dead: true, knockedBack: false, pending: false, soulstrikeCorpseKill: true };
    }
    return originalTakeDamage.call(this, amount, meta);
  };
}

installBattleSoulstrikePatch();
