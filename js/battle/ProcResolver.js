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
  if (key === 'knockbackProc') return { prob: procNumber(proc, 'knockback', 'prob') };
  if (key === 'warp') return { prob: procNumber(proc, 'warp', 'prob'), time: procNumber(proc, 'warp', 'time'), timeFrames: procNumber(proc, 'warp', 'time'), dis0: procNumber(proc, 'warp', 'dis0'), dis1: procNumber(proc, 'warp', 'dis1') };
  if (key === 'curse') return { prob: procNumber(proc, 'curse', 'prob'), time: procNumber(proc, 'curse', 'time'), timeFrames: procNumber(proc, 'curse', 'time') };
  if (key === 'toxic') return { prob: procNumber(proc, 'toxic', 'prob'), mult: procNumber(proc, 'toxic', 'mult') };
  if (key === 'wave') return { prob: procNumber(proc, 'wave', 'prob'), level: procNumber(proc, 'wave', 'level') };
  if (key === 'miniWave') return { prob: procNumber(proc, 'miniWave', 'prob'), level: procNumber(proc, 'miniWave', 'level'), mult: procNumber(proc, 'miniWave', 'mult') };
  if (key === 'surge') return { prob: Math.max(procNumber(proc, 'volcano', 'prob'), procNumber(proc, 'deathSurge', 'prob')), volcano: proc?.volcano || null, deathSurge: proc?.deathSurge || null };
  if (key === 'miniSurge') return { prob: procNumber(proc, 'miniVolcano', 'prob'), miniVolcano: proc?.miniVolcano || null };
  if (key === 'barrierBreaker') return { prob: procNumber(proc, 'barrierBreaker', 'prob') };
  if (key === 'shieldPierce') return { prob: procNumber(proc, 'shieldBreaker', 'prob') };
  if (key === 'zombieKiller') return { prob: 100 };
  if (key === 'soulstrike') return { prob: 100 };
  return { prob: 0 };
}

export class ProcResolver {
  static getProcCatalog() {
    return {
      freeze: { key: 'freeze', category: 'state', implemented: true, pendingSupported: true, pendingType: 'state', target: 'actor' },
      slow: { key: 'slow', category: 'state', implemented: true, pendingSupported: true, pendingType: 'state', target: 'actor' },
      weaken: { key: 'weaken', category: 'state', implemented: true, pendingSupported: true, pendingType: 'state', target: 'actor' },
      knockbackProc: { key: 'knockbackProc', category: 'kb', implemented: true, pendingSupported: true, pendingType: 'knockback', target: 'actor' },
      warp: { key: 'warp', category: 'state', implemented: false, pendingSupported: true, pendingType: 'state', target: 'actor' },
      curse: { key: 'curse', category: 'state', implemented: false, pendingSupported: true, pendingType: 'state', target: 'actor' },
      toxic: { key: 'toxic', category: 'state', implemented: false, pendingSupported: true, pendingType: 'state', target: 'actor' },
      wave: { key: 'wave', category: 'effect', implemented: false, pendingSupported: true, pendingType: 'effect', target: 'world' },
      miniWave: { key: 'miniWave', category: 'effect', implemented: false, pendingSupported: true, pendingType: 'effect', target: 'world' },
      surge: { key: 'surge', category: 'effect', implemented: false, pendingSupported: true, pendingType: 'effect', target: 'world' },
      miniSurge: { key: 'miniSurge', category: 'effect', implemented: false, pendingSupported: true, pendingType: 'effect', target: 'world' },
      barrierBreaker: { key: 'barrierBreaker', category: 'shield', implemented: false, pendingSupported: true, pendingType: 'shield', target: 'actor' },
      shieldPierce: { key: 'shieldPierce', category: 'shield', implemented: false, pendingSupported: true, pendingType: 'shield', target: 'actor' },
      zombieKiller: { key: 'zombieKiller', category: 'special', implemented: false, pendingSupported: true, pendingType: 'special', target: 'actor' },
      soulstrike: { key: 'soulstrike', category: 'special', implemented: false, pendingSupported: true, pendingType: 'special', target: 'actor' }
    };
  }

  static collectProcCandidates({ event = null } = {}) {
    const semantic = event?.abilities || event?.ability?.semantic || {};
    const catalog = this.getProcCatalog();
    return Object.values(catalog)
      .filter((entry) => semantic?.[entry.key] === true)
      .map((entry) => ({
        key: entry.key,
        category: entry.category,
        pendingType: entry.pendingType || null,
        implemented: entry.implemented === true,
        pendingSupported: entry.pendingSupported === true,
        target: entry.target || null,
        source: 'semantic-ability-true'
      }));
  }

  static resolve({ attacker = null, target = null, targetType = 'actor', event = null, damageResult = null, context = {} } = {}) {
    const semantic = event?.abilities || event?.ability?.semantic || {};
    const candidates = this.collectProcCandidates({ event });
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
    const proc = getProcModel(attacker);

    if (rawAbiUnverified) notes.push('raw-abi-present-proc-mapping-not-verified');

    for (const candidate of candidates) {
      const payload = payloadFor(candidate.key, proc);
      const prob = Number(payload.prob || 0);
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
        source: candidate.implemented ? 'ProcResolver.bcu-proc-roll-ready-to-apply' : 'ProcResolver.bcu-proc-roll-pending-no-apply',
        reason: candidate.implemented ? 'runtime-application-supported' : 'runtime-application-not-implemented',
        payload,
        context: {
          damageApplied: !!damageResult?.applied,
          finalDamage: Number.isFinite(damageResult?.finalDamage) ? damageResult.finalDamage : null,
          targetType
        }
      };
      pending.push(item);
      if (candidate.implemented) applied.push(item);
    }

    return {
      source: 'ProcResolver.v3-bcu-proc-roll-contract',
      mode: 'bcu-proc-roll-pending-apply-contract',
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
        pendingCount: pending.length,
        appliedCount: applied.length,
        skippedCount: skipped.length,
        rawAbiUnverified
      }
    };
  }
}
