export class CharacterCatalogRuntime {
  static getContract() {
    return {
      source: 'CharacterCatalogRuntime.v1-facade',
      responsibilities: ['catalog-summary', 'roster-validation', 'preview-asset-contract', 'formation-compatibility', 'debug-diagnostics'],
      nonResponsibilities: ['asset-loading', 'actor-spawn', 'formation-persistence', 'battle-simulation', 'camera-rendering']
    };
  }

  static summarizeCatalog(catalog = []) {
    const list = Array.isArray(catalog) ? catalog : [];
    const byFaction = {};
    const bySourceKind = {};
    const missingCharacterId = [];
    const missingBaseCharacterId = [];
    const ids = new Map();
    const baseIds = new Map();
    for (const c of list) {
      byFaction[c?.faction || 'unknown'] = (byFaction[c?.faction || 'unknown'] || 0) + 1;
      bySourceKind[c?.sourceKind || 'unknown'] = (bySourceKind[c?.sourceKind || 'unknown'] || 0) + 1;
      if (!c?.characterId) missingCharacterId.push(c);
      if (!c?.baseCharacterId) missingBaseCharacterId.push(c);
      if (c?.characterId) ids.set(c.characterId, (ids.get(c.characterId) || 0) + 1);
      if (c?.baseCharacterId) baseIds.set(c.baseCharacterId, (baseIds.get(c.baseCharacterId) || 0) + 1);
    }
    return {
      total: list.length,
      byFaction,
      bySourceKind,
      missingCharacterId: missingCharacterId.length,
      missingBaseCharacterId: missingBaseCharacterId.length,
      duplicateCharacterIds: [...ids.entries()].filter(([,n])=>n>1).map(([k])=>k),
      duplicateBaseCharacterIds: [...baseIds.entries()].filter(([,n])=>n>1).map(([k])=>k),
      examples: list.slice(0, 5).map((c) => this.describeCharacter(c))
    };
  }

  static summarizeRosters(rosters = {}) {
    const out = {};
    for (const [k,v] of Object.entries(rosters || {})) out[k] = Array.isArray(v) ? v.length : 0;
    return out;
  }

  static validateCatalog(catalog = []) {
    const required = ['characterId','baseCharacterId','faction','label','sourceRoster','sourceSlotId','uiIcon'];
    const list = Array.isArray(catalog) ? catalog : [];
    const summary = this.summarizeCatalog(list);
    const missingRequiredFields = [];
    const errors = [];
    for (const c of list) {
      const missing = required.filter((f) => c?.[f] == null);
      if (missing.length) missingRequiredFields.push({ characterId: c?.characterId || null, missing });
    }
    if (summary.duplicateCharacterIds.length) errors.push('duplicate-character-id');
    if (missingRequiredFields.length) errors.push('missing-required-fields');
    return {
      ok: errors.length === 0,
      errors,
      warnings: summary.duplicateBaseCharacterIds.length ? ['duplicate-base-character-id'] : [],
      total: list.length,
      duplicateCharacterIds: summary.duplicateCharacterIds,
      duplicateBaseCharacterIds: summary.duplicateBaseCharacterIds,
      missingRequiredFields,
      source: 'CharacterCatalogRuntime.validateCatalog'
    };
  }

  static validateRosterEntries(roster = [], { expectedSide = null } = {}) {
    const required = ['slotId','assetId','statsType','statsId','sourceRoster','sourceSlotId','side','idleAnimId','moveAnimId','attackAnimId','knockbackAnimId','uiIcon'];
    const list = Array.isArray(roster) ? roster : [];
    const errors = [];
    for (const e of list) {
      const missing = required.filter((f) => e?.[f] == null);
      if (missing.length) errors.push({ slotId: e?.slotId || null, missing });
      if (expectedSide && e?.side !== expectedSide) errors.push({ slotId: e?.slotId || null, expectedSide, got: e?.side || null });
    }
    return { ok: errors.length === 0, total: list.length, errors };
  }

  static validatePreviewAssets(previewAssets = []) {
    const baseRequired = ['id','renderMode','model','animations'];
    const list = Array.isArray(previewAssets) ? previewAssets : [];
    const errors = [];
    const seen = new Set();
    for (const a of list) {
      if (seen.has(a?.id)) errors.push({ id: a?.id || null, reason: 'duplicate-id' });
      if (a?.id) seen.add(a.id);
      const required = Array.isArray(a?.layers) && a.layers.length > 0 ? baseRequired : (a?.semanticKey ? [...baseRequired, 'semanticKey'] : [...baseRequired, 'baseDir', 'image', 'imgcut']);
      const missing = required.filter((f) => !(a && Object.prototype.hasOwnProperty.call(a, f)));
      if (missing.length) errors.push({ id: a?.id || null, missing });
    }
    return { ok: errors.length === 0, total: list.length, errors, source: 'CharacterCatalogRuntime.validatePreviewAssets' };
  }

  static buildCatalogDiagnostics({ catalog = [], rosters = {}, previewAssets = [], formation = null } = {}) {
    return {
      contract: this.getContract(),
      catalogSummary: this.summarizeCatalog(catalog),
      rosterSummary: this.summarizeRosters(rosters),
      validation: this.validateCatalog(catalog),
      previewAssetValidation: this.validatePreviewAssets(previewAssets),
      formationCompatibility: { totalSlots: Array.isArray(formation?.pages) ? formation.pages.flat().length : null, source: 'candidate-only' },
      examples: { catalog: (catalog || []).slice(0,3).map((c)=>this.describeCharacter(c)) }
    };
  }

  static describeCharacter(character) { return { characterId: character?.characterId || null, baseCharacterId: character?.baseCharacterId || null, faction: character?.faction || null, label: character?.label || null, sourceRoster: character?.sourceRoster || null, sourceSlotId: character?.sourceSlotId || null }; }
  static describeRosterEntry(entry) { return { slotId: entry?.slotId || null, assetId: entry?.assetId || null, statsType: entry?.statsType || null, statsId: entry?.statsId ?? null, side: entry?.side || null }; }
  static getAssetCandidateSummary(entry) {
    const icon = entry?.uiIcon || {};
    return { slotId: entry?.slotId || null, assetId: entry?.assetId || null, statsType: entry?.statsType || null, statsId: entry?.statsId ?? null, bcuId: icon?.bcuId || null, baseDir: entry?.baseDir || null, image: entry?.image || null, imgcut: entry?.imgcut || null, model: entry?.model || null, animations: entry?.animations || null, iconPrimary: icon?.primary || null, iconFallback: icon?.fallback || null };
  }
}
