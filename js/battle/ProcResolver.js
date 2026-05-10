export class ProcResolver {
  static getProcCatalog() {
    const noApply = 'semantic-only pending hook; no runtime apply';
    return {
      freeze: { key: 'freeze', category: 'state', implemented: false, pendingSupported: true, pendingType: 'state', target: 'actor', notes: noApply },
      slow: { key: 'slow', category: 'state', implemented: false, pendingSupported: true, pendingType: 'state', target: 'actor', notes: noApply },
      weaken: { key: 'weaken', category: 'state', implemented: false, pendingSupported: true, pendingType: 'state', target: 'actor', notes: noApply },
      knockbackProc: { key: 'knockbackProc', category: 'kb', implemented: false, pendingSupported: true, pendingType: 'knockback', target: 'actor', notes: noApply },
      warp: { key: 'warp', category: 'state', implemented: false, pendingSupported: true, pendingType: 'state', target: 'actor', notes: noApply },
      curse: { key: 'curse', category: 'state', implemented: false, pendingSupported: true, pendingType: 'state', target: 'actor', notes: noApply },
      toxic: { key: 'toxic', category: 'state', implemented: false, pendingSupported: true, pendingType: 'state', target: 'actor', notes: noApply },
      wave: { key: 'wave', category: 'effect', implemented: false, pendingSupported: true, pendingType: 'effect', target: 'world', notes: noApply },
      miniWave: { key: 'miniWave', category: 'effect', implemented: false, pendingSupported: true, pendingType: 'effect', target: 'world', notes: noApply },
      surge: { key: 'surge', category: 'effect', implemented: false, pendingSupported: true, pendingType: 'effect', target: 'world', notes: noApply },
      miniSurge: { key: 'miniSurge', category: 'effect', implemented: false, pendingSupported: true, pendingType: 'effect', target: 'world', notes: noApply },
      barrierBreaker: { key: 'barrierBreaker', category: 'shield', implemented: false, pendingSupported: true, pendingType: 'shield', target: 'actor', notes: noApply },
      shieldPierce: { key: 'shieldPierce', category: 'shield', implemented: false, pendingSupported: true, pendingType: 'shield', target: 'actor', notes: noApply },
      zombieKiller: { key: 'zombieKiller', category: 'special', implemented: false, pendingSupported: true, pendingType: 'special', target: 'actor', notes: noApply },
      soulstrike: { key: 'soulstrike', category: 'special', implemented: false, pendingSupported: true, pendingType: 'special', target: 'actor', notes: noApply }
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
    const targetId = target?.instanceId || target?.label || target?.side || null;
    const attackerId = attacker?.instanceId || attacker?.label || null;
    const hitIndex = event?.hitIndex ?? null;
    const attackEventKey = context?.attackEventKey ?? event?.key ?? null;
    const rawAbiUnverified = (event?.rawAbi ?? 0) > 0 && event?.abilityMappingStatus === 'raw-only-unverified';

    if (rawAbiUnverified) {
      notes.push('raw-abi-present-proc-mapping-not-verified');
    }

    for (const candidate of candidates) {
      if (candidate.pendingSupported === true) {
        pending.push({
          key: candidate.key,
          category: candidate.category,
          pendingType: candidate.pendingType,
          targetType: candidate.target || targetType || null,
          targetId,
          attackerId,
          hitIndex,
          attackEventKey,
          source: 'ProcResolver.semantic-pending-no-apply',
          reason: 'runtime-application-not-implemented',
          context: {
            damageApplied: !!damageResult?.applied,
            finalDamage: Number.isFinite(damageResult?.finalDamage) ? damageResult.finalDamage : null,
            targetType
          }
        });
      } else {
        skipped.push({ key: candidate.key, category: candidate.category, reason: 'pending-not-supported' });
      }
    }

    return {
      source: 'ProcResolver.v2-pending-contract',
      mode: 'pending-no-apply',
      applied: [],
      pending,
      skipped,
      notes,
      debug: {
        eventRawAbi: event?.rawAbi ?? null,
        abilityMappingStatus: event?.abilityMappingStatus || null,
        semantic,
        candidates,
        candidateKeys,
        pendingCount: pending.length,
        skippedCount: skipped.length,
        rawAbiUnverified
      }
    };
  }
}
