import { BattleActor } from './BattleActor.js';
import { BattleAttackResolver } from './BattleAttackResolver.js';
import { BattleScene } from './BattleScene.js';
import { bcuTraitCompatible, describeBcuTraitCompatibility, hasTargetOnly } from './BcuTraitCompatibility.js';
import { clearBcuZombieCorpse, isBcuZombieCorpse, isBcuZombieCorpseTargetable } from './bcu-runtime/BcuZombieCorpseRuntime.js';

const PATCH_FLAG = Symbol.for('wanko-battle.soulstrike-patch.v1');
const RESOLVER_PATCH_FLAG = Symbol.for('wanko-battle.attack-resolver-soulstrike.v1');
const SCENE_PATCH_FLAG = Symbol.for('wanko-battle.scene-soulstrike-meta.v1');

function hasSoulstrike(event = null, attacker = null) {
  if (Object.prototype.hasOwnProperty.call(event?.characterModificationAbilityFlags || {}, 'soulstrike')) {
    return event.characterModificationAbilityFlags.soulstrike === true;
  }
  return event?.abilities?.soulstrike === true
    || event?.ability?.semantic?.soulstrike === true
    || attacker?.abilityModel?.bcuAbilityFlags?.soulstrike === true
    || attacker?.rawStats?.abilityModel?.bcuAbilityFlags?.soulstrike === true;
}

function isZombieCorpse(target) {
  return isBcuZombieCorpse(target);
}

function isActorTargetableForEvent(target, event, attacker) {
  if (!target) return false;
  if (typeof target.isBcuTargetableForEvent === 'function') return target.isBcuTargetableForEvent(event, attacker);
  if (isZombieCorpse(target)) return isBcuZombieCorpseTargetable(target) && hasSoulstrike(event, attacker);
  if (typeof target.isTargetable === 'function') return !!target.isTargetable();
  if (typeof target.isAlive === 'function') return !!target.isAlive();
  return false;
}

function isBcuTraitAllowed(target, event, attacker, targetOnly = hasTargetOnly(attacker, event)) {
  if (!targetOnly) return true;
  return bcuTraitCompatible({ attacker, target, targetType: 'actor', targetOnly: true });
}

function isSoulstrikeCaptureCandidate(resolver, target, event, attacker, targetOnly) {
  return isActorTargetableForEvent(target, event, attacker)
    && resolver.isTargetInEventRange(attacker, target, event)
    && isBcuTraitAllowed(target, event, attacker, targetOnly);
}

export function installBattleSoulstrikePatch() {
  const sceneProto = BattleScene?.prototype;
  if (sceneProto && !sceneProto[SCENE_PATCH_FLAG]) {
    sceneProto[SCENE_PATCH_FLAG] = true;
    const originalQueueAttackDamage = sceneProto.queueAttackDamage;
    sceneProto.queueAttackDamage = function queueAttackDamageWithSoulstrikeMeta(attacker, target, targetType, event, meta = {}) {
      return originalQueueAttackDamage.call(this, attacker, target, targetType, event, { ...meta, event, attackerActor: attacker });
    };
  }

  if (!BattleAttackResolver[RESOLVER_PATCH_FLAG]) {
    BattleAttackResolver[RESOLVER_PATCH_FLAG] = true;
    BattleAttackResolver.captureTargets = function captureTargetsSoulstrikeAware({ attacker, enemyActors, enemyBase, event }) {
      const mode = event?.targetMode || 'single';
      const actors = enemyActors || [];
      const targetOnly = hasTargetOnly(attacker, event);
      if (mode === 'range') {
        const results = [];
        for (const target of actors) {
          if (isSoulstrikeCaptureCandidate(this, target, event, attacker, targetOnly)) {
            results.push({ target, targetType: 'actor', event, soulstrikeCorpse: isZombieCorpse(target) });
          }
        }
        if (enemyBase?.isAlive?.() && event?.allowBaseHit !== false && this.isTargetInEventRange(attacker, enemyBase, event)) {
          results.push({ target: enemyBase, targetType: 'base', event });
        }
        return results;
      }
      let actorCount = 0;
      let allHaveBcu = Number.isFinite(this.getEntityPosBcu(attacker));
      let bestBcu = null;
      let bestPx = null;
      for (const target of actors) {
        if (!isSoulstrikeCaptureCandidate(this, target, event, attacker, targetOnly)) continue;
        const candidate = { target, targetType: 'actor', event, soulstrikeCorpse: isZombieCorpse(target) };
        actorCount += 1;
        if (!Number.isFinite(this.getEntityPosBcu(target))) allHaveBcu = false;
        else if (!bestBcu || this.compareSingleTarget(attacker, candidate, bestBcu, true) < 0) bestBcu = candidate;
        if (!bestPx || this.compareSingleTarget(attacker, candidate, bestPx, false) < 0) bestPx = candidate;
      }
      let one = null;
      if (actorCount > 0) {
        one = allHaveBcu ? bestBcu : bestPx;
      } else if (enemyBase?.isAlive?.() && event?.allowBaseHit !== false && this.isTargetInEventRange(attacker, enemyBase, event)) {
        one = { target: enemyBase, targetType: 'base', event };
      }
      if (one?.targetType === 'actor' && targetOnly) {
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
    const attacker = meta.attackerActor || meta.attacker || null;
    const soul = hasSoulstrike(event, attacker) || meta?.damageCalculation?.proc?.pending?.some?.((p) => p?.key === 'soulstrike');
    if (isZombieCorpse(this) && soul && isBcuZombieCorpseTargetable(this)) {
      clearBcuZombieCorpse(this, 'soulstrike');
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
