export class ProcResolver {
  static getProcCatalog() {
    return {
      freeze: { key: 'freeze', category: 'proc', implemented: false, notes: 'not-implemented' },
      slow: { key: 'slow', category: 'proc', implemented: false, notes: 'not-implemented' },
      weaken: { key: 'weaken', category: 'proc', implemented: false, notes: 'not-implemented' },
      knockbackProc: { key: 'knockbackProc', category: 'proc', implemented: false, notes: 'not-implemented' },
      warp: { key: 'warp', category: 'proc', implemented: false, notes: 'not-implemented' },
      curse: { key: 'curse', category: 'proc', implemented: false, notes: 'not-implemented' },
      toxic: { key: 'toxic', category: 'proc', implemented: false, notes: 'not-implemented' },
      wave: { key: 'wave', category: 'effect', implemented: false, notes: 'not-implemented' },
      miniWave: { key: 'miniWave', category: 'effect', implemented: false, notes: 'not-implemented' },
      surge: { key: 'surge', category: 'effect', implemented: false, notes: 'not-implemented' },
      miniSurge: { key: 'miniSurge', category: 'effect', implemented: false, notes: 'not-implemented' },
      barrierBreaker: { key: 'barrierBreaker', category: 'proc', implemented: false, notes: 'not-implemented' },
      shieldPierce: { key: 'shieldPierce', category: 'proc', implemented: false, notes: 'not-implemented' },
      zombieKiller: { key: 'zombieKiller', category: 'proc', implemented: false, notes: 'not-implemented' },
      soulstrike: { key: 'soulstrike', category: 'proc', implemented: false, notes: 'not-implemented' }
    };
  }

  static collectProcCandidates({ event = null } = {}) {
    const semantic = event?.abilities || event?.ability?.semantic || {};
    const catalog = this.getProcCatalog();
    return Object.keys(catalog).filter((key) => semantic?.[key] === true);
  }

  static resolve({ attacker = null, target = null, targetType = 'actor', event = null, damageResult = null, context = {} } = {}) {
    void attacker; void target; void targetType; void damageResult; void context;
    const semantic = event?.abilities || event?.ability?.semantic || {};
    const candidates = this.collectProcCandidates({ attacker, target, event, damageResult });
    const notes = [];
    if ((event?.rawAbi ?? 0) > 0 && event?.abilityMappingStatus === 'raw-only-unverified') {
      notes.push('raw-abi-present-proc-mapping-not-verified');
    }
    return {
      source: 'ProcResolver.v1-noop-contract',
      mode: 'noop',
      applied: [],
      pending: [],
      skipped: candidates.map((key) => ({ key, reason: 'not-implemented' })),
      notes,
      debug: {
        eventRawAbi: event?.rawAbi ?? null,
        abilityMappingStatus: event?.abilityMappingStatus || null,
        semantic,
        candidates
      }
    };
  }
}
