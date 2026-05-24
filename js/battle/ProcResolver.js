import { bcuTraitCompatible, describeBcuTraitCompatibility } from './BcuTraitCompatibility.js';
import { BCU_PROC_KB_DEFAULT } from './BcuCombatModel.js';

const SEAL_SUPPRESSED_PROC_KEYS = new Set(['critical', 'barrierBreaker', 'shieldPierce', 'strongAttack']);
const CURSE_SUPPRESSED_PROC_KEYS = new Set(['knockbackProc', 'freeze', 'slow', 'weaken', 'warp', 'curse', 'seal', 'toxic']);

function getCombatModel(entity) {
  return entity?.bcuCombatModel || entity?.rawStats?.bcuCombatModel || entity?.stats?.bcuCombatModel || null;
}

function getProcModel(entity) {
  return getCombatModel(entity)?.proc || entity?.bcuProc || entity?.rawStats?.bcuProc || entity?.abilityModel?.bcuProc || {};
}

function procNumber(proc, key, field, fallback = 0) {
  const n = Number(proc?.[key]?.[field]);
  return Number.isFinite(n) ? n : fallback;
}

function chance(prob, rng = Math.random) {
  const p = Number(prob) || 0;
  if (p <= 0) return false;
  if (p >= 100) return true;
  return (rng() * 100) < p;
}

function payloadFor(key, proc = {}) {
  if (key === 'freeze') return { prob: procNumber(proc, 'freeze', 'prob'), time: procNumber(proc, 'freeze', 'time'), timeFrames: procNumber(proc, 'freeze', 'time') };
  if (key === 'slow') return { prob: procNumber(proc, 'slow', 'prob'), time: procNumber(proc, 'slow', 'time'), timeFrames: procNumber(proc, 'slow', 'time') };
  if (key === 'weaken') return { prob: procNumber(proc, 'weaken', 'prob'), time: procNumber(proc, 'weaken', 'time'), timeFrames: procNumber(proc, 'weaken', 'time'), mult: procNumber(proc, 'weaken', 'mult') };
  if (key === 'knockbackProc') return { prob: procNumber(proc, 'knockback', 'prob'), dis: procNumber(proc, 'knockback', 'dis', BCU_PROC_KB_DEFAULT.dis), time: procNumber(proc, 'knockback', 'time', BCU_PROC_KB_DEFAULT.time), timeFrames: procNumber(proc, 'knockback', 'time', BCU_PROC_KB_DEFAULT.time) };
  if (key === 'warp') return { prob: procNumber(proc, 'warp', 'prob'), time: procNumber(proc, 'warp', 'time'), timeFrames: procNumber(proc, 'warp', 'time'), dis0: procNumber(proc, 'warp', 'dis0'), dis1: procNumber(proc, 'warp', 'dis1') };
  if (key === 'curse') return { prob: procNumber(proc, 'curse', 'prob'), time: procNumber(proc, 'curse', 'time'), timeFrames: procNumber(proc, 'curse', 'time') };
  if (key === 'seal') return { prob: procNumber(proc, 'seal', 'prob'), time: procNumber(proc, 'seal', 'time'), timeFrames: procNumber(proc, 'seal', 'time') };
  if (key === 'toxic') return { prob: procNumber(proc, 'toxic', 'prob'), mult: procNumber(proc, 'toxic', 'mult') };
  if (key === 'wave') return { prob: procNumber(proc, 'wave', 'prob'), level: procNumber(proc, 'wave', 'level') };
  if (key === 'miniWave') return { prob: procNumber(proc, 'miniWave', 'prob'), level: procNumber(proc, 'miniWave', 'level'), mult: procNumber(proc, 'miniWave', 'mult') };
  if (key === 'surge') return { prob: procNumber(proc, 'volcano', 'prob'), volcano: proc?.volcano || null, deathSurge: null };
  if (key === 'miniSurge') return { prob: procNumber(proc, 'miniVolcano', 'prob'), miniVolcano: proc?.miniVolcano || null };
  if (key === 'blast') return { prob: procNumber(proc, 'blast', 'prob'), blast: proc?.blast || null, dis0: procNumber(proc, 'blast', 'dis0'), dis1: procNumber(proc, 'blast', 'dis1') };
  if (key === 'barrierBreaker') return { prob: procNumber(proc, 'barrierBreaker', 'prob') };
  if (key === 'shieldPierce') return { prob: procNumber(proc, 'shieldBreaker', 'prob') };
  if (key === 'zombieKiller') return { prob: 100 };
  if (key === 'soulstrike') return { prob: 100 };
  return { prob: 0 };
}

function procModelCandidateActive(key, proc = {}, semantic = {}) {
  if (key === 'zombieKiller' || key === 'soulstrike') return semantic?.[key] === true;
  return Number(payloadFor(key, proc).prob || 0) > 0;
}

function mirrorsToApplied(candidate) {
  return candidate?.implemented === true && (candidate?.pendingType === 'state' || candidate?.pendingType === 'knockback' || candidate?.pendingType === 'kb');
}

function statusActive(actor, keys) {
  const list = Array.isArray(keys) ? keys : [keys];
  for (const key of list) {
    if (typeof actor?.isBcuProcStatusActive === 'function' && actor.isBcuProcStatusActive(key, actor.lastSceneTimeMs)) return true;
    const st = actor?.bcuProcStatuses?.[key];
    if (Number.isFinite(st?.framesRemaining) && st.framesRemaining > 0) return true;
    if (Number.isFinite(st?.untilMs)) {
      const nowMs = Number.isFinite(actor?.lastSceneTimeMs) ? actor.lastSceneTimeMs : 0;
      if (nowMs < st.untilMs) return true;
    }
  }
  return false;
}

function procSuppressionReason(key, attacker) {
  const sealed = statusActive(attacker, ['seal', 'P_SEAL']);
  const cursed = statusActive(attacker, ['curse', 'P_CURSE']);
  if (sealed && SEAL_SUPPRESSED_PROC_KEYS.has(key)) return 'attacker-seal-suppressed-proc';
  if ((cursed || sealed) && CURSE_SUPPRESSED_PROC_KEYS.has(key)) return cursed ? 'attacker-curse-suppressed-proc' : 'attacker-seal-suppressed-curse-proc-group';
  return null;
}

export class ProcResolver {
  static getProcCatalog() {
    return {
      freeze: { key: 'freeze', category: 'state', implemented: true, pendingSupported: true, pendingType: 'state', target: 'actor' },
      slow: { key: 'slow', category: 'state', implemented: true, pendingSupported: true, pendingType: 'state', target: 'actor' },
      weaken: { key: 'weaken', category: 'state', implemented: true, pendingSupported: true, pendingType: 'state', target: 'actor' },
      knockbackProc: { key: 'knockbackProc', category: 'kb', implemented: true, pendingSupported: true, pendingType: 'kb', target: 'actor' },
      warp: { key: 'warp', category: 'state', implemented: true, pendingSupported: true, pendingType: 'state', target: 'actor', runtime: 'BattleActorProcStatusPatch.applyWarp / BcuProcRuntime.performProc' },
      curse: { key: 'curse', category: 'state', implemented: true, pendingSupported: true, pendingType: 'state', target: 'actor' },
      seal: { key: 'seal', category: 'state', implemented: true, pendingSupported: true, pendingType: 'state', target: 'actor' },
      toxic: { key: 'toxic', category: 'state', implemented: true, pendingSupported: true, pendingType: 'state', target: 'actor' },
      wave: { key: 'wave', category: 'effect', implemented: true, pendingSupported: true, pendingType: 'effect', target: 'world', runtime: 'BattleWaveRuntimePatch ContWaveDef container' },
      miniWave: { key: 'miniWave', category: 'effect', implemented: true, pendingSupported: true, pendingType: 'effect', target: 'world', runtime: 'BattleWaveRuntimePatch ContWaveDef miniWave container' },
      surge: { key: 'surge', category: 'effect', implemented: true, pendingSupported: true, pendingType: 'effect', target: 'world', runtime: 'BattleSurgeRuntimePatch ContVolcano container' },
      miniSurge: { key: 'miniSurge', category: 'effect', implemented: true, pendingSupported: true, pendingType: 'effect', target: 'world', runtime: 'BattleSurgeRuntimePatch ContVolcano miniSurge container' },
      blast: { key: 'blast', category: 'effect', implemented: true, pendingSupported: true, pendingType: 'effect', target: 'world', runtime: 'BattleBlastRuntimePatch ContBlast container' },
      barrierBreaker: { key: 'barrierBreaker', category: 'shield', implemented: true, pendingSupported: true, pendingType: 'shield', target: 'actor', runtime: 'BattleActorBarrierShieldPatch gateBarrier' },
      shieldPierce: { key: 'shieldPierce', category: 'shield', implemented: true, pendingSupported: true, pendingType: 'shield', target: 'actor', runtime: 'BattleActorBarrierShieldPatch gateShield' },
      zombieKiller: { key: 'zombieKiller', category: 'special', implemented: true, pendingSupported: true, pendingType: 'special', target: 'actor', runtime: 'BattleActorZombieRevivePatch blocks revive' },
      soulstrike: { key: 'soulstrike', category: 'special', implemented: true, pendingSupported: true, pendingType: 'special', target: 'actor', runtime: 'BattleSoulstrikePatch corpse targeting' }
    };
  }

  static collectProcCandidates({ event = null, proc = {} } = {}) {
    const semantic = event?.abilities || event?.ability?.semantic || {};
    const catalog = this.getProcCatalog();
    const byKey = new Map();

    for (const entry of Object.values(catalog)) {
      if (semantic?.[entry.key] === true) {
        byKey.set(entry.key, {
          key: entry.key,
          category: entry.category,
          pendingType: entry.pendingType || null,
          implemented: entry.implemented === true,
          pendingSupported: entry.pendingSupported === true,
          target: entry.target || null,
          runtime: entry.runtime || null,
          source: 'semantic-ability-true'
        });
      }
    }

    for (const entry of Object.values(catalog)) {
      if (!procModelCandidateActive(entry.key, proc, semantic)) continue;
      const existing = byKey.get(entry.key);
      byKey.set(entry.key, {
        key: entry.key,
        category: entry.category,
        pendingType: entry.pendingType || null,
        implemented: entry.implemented === true,
        pendingSupported: entry.pendingSupported === true,
        target: entry.target || null,
        runtime: entry.runtime || null,
        source: existing ? 'semantic-and-bcu-proc-model' : 'bcu-proc-model'
      });
    }

    return [...byKey.values()];
  }

  static resolve({ attacker = null, target = null, targetType = 'actor', event = null, damageResult = null, context = {} } = {}) {
    const semantic = event?.abilities || event?.ability?.semantic || {};
    const proc = getProcModel(attacker);
    const candidates = this.collectProcCandidates({ event, proc });
    const candidateKeys = candidates.map((candidate) => candidate.key);
    const notes = [];
    const pending = [];
    const skipped = [];
    const applied = [];
    const targetId = target?.instanceId || target?.label || target?.side || null;
    const attackerId = attacker?.instanceId || attacker?.label || null;
    const hitIndex = event?.hitIndex ?? null;
    const attackEventKey = context?.attackEventKey ?? event?.key ?? null;
    const rawAbiUnverified = (event?.rawAbi ?? 0) > 0 && event?.abilityMappingStatus === 'raw-only-unverified';
    const rng = typeof context?.random === 'function' ? context.random : Math.random;

    if (rawAbiUnverified) notes.push('raw-abi-present-proc-mapping-not-verified');

    for (const candidate of candidates) {
      const payload = payloadFor(candidate.key, proc);
      const prob = Number(payload.prob || 0);
      const suppressed = procSuppressionReason(candidate.key, attacker);
      if (suppressed) {
        skipped.push({ key: candidate.key, category: candidate.category, reason: suppressed, payload, bcuReference: 'AtkModelEnemy.getProc cursed proc / AtkModelUnit.getProc sealed proc and ContVolcano.updateProc suppression groups' });
        continue;
      }
      const requiresActorTraitCompatibility = targetType === 'actor' && candidate.target === 'actor';
      if (requiresActorTraitCompatibility && !bcuTraitCompatible({ attacker, target, targetType, targetOnly: semantic?.targetOnly === true })) {
        skipped.push({ key: candidate.key, category: candidate.category, reason: 'target-trait-incompatible', payload, traitCompatibility: describeBcuTraitCompatibility({ attacker, target, targetType, targetOnly: semantic?.targetOnly === true }) });
        continue;
      }
      if (prob <= 0) {
        skipped.push({ key: candidate.key, category: candidate.category, reason: 'zero-probability', payload });
        continue;
      }
      const rolled = chance(prob, rng);
      if (!rolled) {
        skipped.push({ key: candidate.key, category: candidate.category, reason: 'probability-failed', prob, payload });
        continue;
      }
      const item = {
        key: candidate.key,
        category: candidate.category,
        pendingType: candidate.pendingType,
        implemented: candidate.implemented,
        targetType: candidate.target || targetType || null,
        targetId,
        attackerId,
        hitIndex,
        attackEventKey,
        source: candidate.implemented ? 'ProcResolver.bcu-proc-roll-ready-to-runtime' : 'ProcResolver.bcu-proc-roll-pending-no-apply',
        candidateSource: candidate.source,
        runtime: candidate.runtime || null,
        reason: candidate.implemented ? 'runtime-application-supported' : 'runtime-application-not-implemented',
        payload,
        context: {
          damageApplied: !!damageResult?.applied,
          finalDamage: Number.isFinite(damageResult?.finalDamage) ? damageResult.finalDamage : null,
          targetType
        }
      };
      pending.push(item);
      if (mirrorsToApplied(candidate)) applied.push(item);
    }

    return {
      source: 'ProcResolver.v6-runtime-catalog-no-duplicate-effect-containers',
      mode: 'bcu-proc-roll-pending-runtime-contract',
      applied,
      pending,
      skipped,
      notes,
      debug: {
        eventRawAbi: event?.rawAbi ?? null,
        abilityMappingStatus: event?.abilityMappingStatus || null,
        semantic,
        proc,
        candidates,
        candidateKeys,
        deathSurgeSeparated: Number(proc?.deathSurge?.prob || 0) > 0,
        pendingCount: pending.length,
        appliedCount: applied.length,
        skippedCount: skipped.length,
        rawAbiUnverified
      }
    };
  }
}
