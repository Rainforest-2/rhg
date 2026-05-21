import { BattleScene } from './BattleScene.js';
import { BCU_TRAITS } from './BcuCombatModel.js';

const PATCH_FLAG = Symbol.for('wanko-battle.attack-nullify-patch.v1');

function getCombatModel(entity) {
  return entity?.bcuCombatModel || entity?.rawStats?.bcuCombatModel || entity?.stats?.bcuCombatModel || null;
}

function getProc(entity) {
  const cm = getCombatModel(entity);
  return cm?.proc || entity?.bcuProc || entity?.rawStats?.bcuProc || entity?.abilityModel?.bcuProc || {};
}

function getTraitFlags(entity) {
  return entity?.traitFlags || entity?.abilityModel?.traits?.flags || entity?.rawStats?.traitFlags || entity?.rawStats?.abilityModel?.traits?.flags || getCombatModel(entity)?.traits?.flags || {};
}

function hasTrait(entity, trait) {
  return getTraitFlags(entity)?.[trait] === true;
}

function procNumber(proc, key, field) {
  const n = Number(proc?.[key]?.[field]);
  return Number.isFinite(n) ? n : 0;
}

function isStatusActive(actor, key, nowMs) {
  if (typeof actor?.isBcuProcStatusActive === 'function') {
    try {
      if (actor.isBcuProcStatusActive(key, nowMs)) return true;
    } catch {}
  }
  const st = actor?.bcuProcStatuses?.[key];
  if (!st) return false;
  if (Number.isFinite(st.framesRemaining)) return st.framesRemaining > 0;
  if (Number.isFinite(st.untilMs)) return nowMs < st.untilMs;
  if (typeof st === 'boolean') return st;
  return false;
}

function setStatus(actor, key, frames, source, nowMs) {
  const time = Math.max(0, Math.trunc(Number(frames) || 0));
  if (time <= 0) return null;
  if (!actor.bcuProcStatuses || typeof actor.bcuProcStatuses !== 'object') actor.bcuProcStatuses = {};
  actor.bcuProcStatuses[key] = {
    key,
    framesRemaining: time,
    timeFrames: time,
    appliedAtMs: Number.isFinite(nowMs) ? nowMs : actor.lastSceneTimeMs,
    source
  };
  return actor.bcuProcStatuses[key];
}

function roll(prob, random = Math.random) {
  const p = Number(prob) || 0;
  if (p <= 0) return false;
  if (p >= 100) return true;
  return random() * 100 < p;
}

function readNullifyCandidate(target, attacker, nowMs) {
  if (isStatusActive(target, 'attackNullify', nowMs)) return { key: 'attackNullify', alreadyActive: true, source: 'P_IMUATK active status' };
  if (isStatusActive(target, 'beastHunterNullify', nowMs)) return { key: 'beastHunterNullify', alreadyActive: true, source: 'P_BSTHUNT active status' };

  const proc = getProc(target);
  const imuProb = procNumber(proc, 'attackNullify', 'prob') || procNumber(proc, 'IMUATK', 'prob');
  if (imuProb > 0) {
    return { key: 'attackNullify', prob: imuProb, time: procNumber(proc, 'attackNullify', 'time') || procNumber(proc, 'IMUATK', 'time'), source: 'P_IMUATK proc roll' };
  }

  const bsthunt = proc?.beastHunter || proc?.bsthunt || proc?.BSTHUNT || {};
  if (Number(bsthunt?.active || 0) > 0 && hasTrait(attacker, BCU_TRAITS.beast) && Number(bsthunt?.prob || 0) > 0) {
    return { key: 'beastHunterNullify', prob: Number(bsthunt.prob) || 0, time: Number(bsthunt.time) || 0, source: 'P_BSTHUNT attack-nullify proc roll' };
  }
  return null;
}

export function installBattleActorAttackNullifyPatch() {
  const proto = BattleScene?.prototype;
  if (!proto || proto[PATCH_FLAG]) return;
  proto[PATCH_FLAG] = true;

  const originalQueueAttackDamage = proto.queueAttackDamage;
  if (typeof originalQueueAttackDamage !== 'function') {
    throw new Error('BattleScene.queueAttackDamage is missing; cannot install attack-nullify patch');
  }

  proto.queueAttackDamage = function queueAttackDamageWithBcuAttackNullify(attacker, target, targetType, event, meta = {}) {
    if (targetType === 'actor' && target?.isAlive?.()) {
      const nowMs = Number.isFinite(this.timeMs) ? this.timeMs : target.lastSceneTimeMs;
      const candidate = readNullifyCandidate(target, attacker, nowMs);
      const random = meta.random || this.getBcuRandom?.() || Math.random;
      const active = candidate?.alreadyActive || (candidate && roll(candidate.prob, random));
      if (active) {
        const status = candidate.alreadyActive ? null : setStatus(target, candidate.key, candidate.time, candidate.source, nowMs);
        const result = {
          accepted: false,
          reason: 'bcu-attack-nullified',
          bcuAttackNullified: true,
          target,
          damageCalculation: null,
          statusKey: candidate.key,
          status
        };
        target.lastBcuAttackNullifyDebug = {
          source: 'BattleActorAttackNullifyPatch.queueAttackDamageWithBcuAttackNullify',
          bcuReference: 'Entity.damaged P_IMUATK/P_BSTHUNT branches return before damage and show A_IMUATK while status active',
          statusKey: candidate.key,
          candidateSource: candidate.source,
          alreadyActive: !!candidate.alreadyActive,
          prob: candidate.prob ?? null,
          time: candidate.time ?? null,
          attacker: attacker?.instanceId || attacker?.label || null,
          target: target?.instanceId || target?.label || null
        };
        this.pushEvent?.({ type: 'bcuAttackNullified', actor: attacker?.instanceId || attacker?.label || null, target: target?.instanceId || target?.label || null, statusKey: candidate.key, source: candidate.source });
        return result;
      }
    }
    return originalQueueAttackDamage.call(this, attacker, target, targetType, event, meta);
  };
}

installBattleActorAttackNullifyPatch();
