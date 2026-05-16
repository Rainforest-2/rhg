import { BattleStatsLoader } from '../battle/BattleStatsLoader.js';
import { formCodeFromIndex, normalizeFormIndex, pad3, toInt, unitFormKey, unitKey } from './BcuIdentifier.js';
import { resolveUnitAsset, toFetchPath } from './BcuPathResolver.js';

const parseCsvRows = (text) => String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).map((line) => line.replace(/\/\/.*$/, '').trim()).filter(Boolean).map((line) => line.split(',').map((x) => x.trim()));
const toNumbers = (cols) => cols.map((v) => (Number.isFinite(Number(v)) ? Number(v) : 0));

function getRawStatsForCoreRecord(record) {
  if (Array.isArray(record?.rawStats) && record.rawStats.length) return record.rawStats;
  if (Array.isArray(record?.stats?.rawValues) && record.stats.rawValues.length) return record.stats.rawValues;
  return [];
}

function markMissingCombatModel(record, unitId, index, code, reason) {
  const stats = record?.stats || null;
  return {
    ...(stats || {}),
    __bcuCombatModelMissing: true,
    __bcuCombatModelMissingReason: reason,
    source: {
      ...(stats?.source || {}),
      mappingStatus: 'missing-bcu-raw-stats',
      unitId,
      form: code,
      formRow: index
    }
  };
}

function ensureCoreUnitStatsCombatModel(record, loader, unitId, index, code, diagnostics) {
  const stats = record?.stats || null;
  if (stats?.abilityModel?.mappingStatus === 'semantic-mapped' && stats?.bcuCombatModel) return stats;
  const raw = getRawStatsForCoreRecord(record);
  if (!raw.length) {
    const reason = `CoreDB unit stats missing raw stats needed for BCU combat model: unit=${unitId} form=${code}`;
    diagnostics?.units?.missingStats?.push?.({ unitId, formIndex: index, form: code, file: 'core-db', reason });
    return markMissingCombatModel(record, unitId, index, code, reason);
  }
  const normalized = loader.normalizeUnitStats(raw, {
    file: record?.sourceFile || stats?.source?.file || 'core-db',
    row: Number.isFinite(stats?.source?.row) ? stats.source.row : index,
    unitId,
    form: code,
    formRow: index,
    type: 'unit',
    mappingStatus: 'valid-coredb-normalized'
  });
  return { ...normalized, ...(stats || {}), rawValues: normalized.rawValues, bcuCombatModel: normalized.bcuCombatModel, traits: normalized.traits, traitFlags: normalized.traitFlags, bcuAbi: normalized.bcuAbi, bcuAbilityFlags: normalized.bcuAbilityFlags, bcuProc: normalized.bcuProc, abilityModel: normalized.abilityModel, abilities: normalized.abilities };
}

export class BcuUnitRepository {
  constructor({ manifest, names, diagnostics, readText, locale = 'jp' }) {
    this.manifest = manifest; this.names = names; this.diagnostics = diagnostics; this.readText = readText; this.locale = locale; this.units = new Map(); this.statsLoader = new BattleStatsLoader({ bcuDb: null });
  }

  async build() {
    const files = new Set(this.manifest.files || []);
    await Promise.all((this.manifest.indexes?.unitIds || []).map(async (id) => {
      const unitId = toInt(id, null); if (!Number.isFinite(unitId)) return;
      const id3 = pad3(unitId);
      const statsPath = (this.manifest.files || []).find((p) => p.endsWith(`/org/unit/${id3}/unit${id3}.csv`)) || `public/assets/bcu/000004/org/unit/${id3}/unit${id3}.csv`;
      let rows = [];
      try { rows = parseCsvRows(await this.readText(statsPath)).map(toNumbers); } catch (error) { this.diagnostics.units.missingStats.push({ unitId, file: statsPath, reason: error?.message || String(error) }); }
      const forms = [];
      const formCount = Math.max(1, rows.length);
      for (let index = 0; index < formCount; index += 1) {
        const code = formCodeFromIndex(index); const raw = rows[index] || rows[0] || [];
        const name = this.names.unitForm(unitId, index, this.locale);
        if (name.source !== 'lang') this.diagnostics.units.missingNames.push({ unitId, formIndex: index, key: unitFormKey(unitId, index), source: name.source });
        const asset = resolveUnitAsset(files, unitId, code);
        const semanticKey = `unit:${unitId}:${code}`;
        const semanticEntry = this.manifest.semanticIndexes?.actors?.byKey?.[semanticKey] || null;
        if (semanticEntry) { asset.semanticKey = semanticKey; asset.bundleRef = semanticEntry.bundleRef; asset.semanticStatus = semanticEntry.status; }
        if (!asset?.imagePath || !asset?.imgcutPath) this.diagnostics.units.missingAssets.push({ unitId, formIndex: index, asset });
        const stats = raw.length ? this.statsLoader.normalizeUnitStats(raw, { file: toFetchPath(statsPath), row: index, unitId, form: code, formRow: index, type: 'unit', mappingStatus: 'valid' }) : null;
        forms.push({ index, code, key: unitFormKey(unitId, index), name, stats, rawStats: raw, asset });
      }
      this.units.set(unitId, { id: unitId, id3, key: unitKey(unitId), sourcePack: '000004', folder: toFetchPath(`public/assets/bcu/000004/org/unit/${id3}/`), forms });
    }));
    return this;
  }

  static fromCoreDb(coreDb, { manifest, names, diagnostics, locale = 'jp' } = {}) {
    const repo = new BcuUnitRepository({ manifest, names, diagnostics, readText: null, locale });
    const byUnit = new Map();
    for (const record of Object.values(coreDb?.units?.forms || {})) {
      const unitId = toInt(record.unitId, null); if (!Number.isFinite(unitId)) continue;
      if (!byUnit.has(unitId)) byUnit.set(unitId, { id: unitId, id3: record.id3 || pad3(unitId), key: unitKey(unitId), sourcePack: record.sourcePack || 'core-db', folder: null, forms: [] });
      const unit = byUnit.get(unitId);
      const index = normalizeFormIndex(record.formIndex ?? record.form);
      const code = record.form || formCodeFromIndex(index);
      const stats = ensureCoreUnitStatsCombatModel(record, repo.statsLoader, unitId, index, code, diagnostics);
      unit.forms[index] = { index, code, key: record.key || unitFormKey(unitId, index), name: record.name || names.unitForm(unitId, index, locale), stats, rawStats: getRawStatsForCoreRecord(record), asset: record.asset || null };
    }
    for (const [unitId, unit] of byUnit) { unit.forms = unit.forms.filter(Boolean); repo.units.set(unitId, unit); }
    return repo;
  }

  get(unitId) { return this.units.get(toInt(unitId, -1)) || null; }
  getForm(unitId, formIndexOrCode = 0) { const index = normalizeFormIndex(formIndexOrCode); const unit = this.get(unitId); return unit?.forms?.[index] || unit?.forms?.[0] || null; }
  getFormStats(unitId, formIndexOrCode = 0) {
    const form = this.getForm(unitId, formIndexOrCode);
    if (!form?.stats) throw new Error(`BCU unit stats missing: unit=${unitId} form=${formIndexOrCode}`);
    if (form.stats.__bcuCombatModelMissing) throw new Error(form.stats.__bcuCombatModelMissingReason || `BCU unit combat model missing: unit=${unitId} form=${formIndexOrCode}`);
    return form.stats;
  }
  list() { return [...this.units.values()].sort((a, b) => a.id - b.id); }
}
