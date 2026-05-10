import { BattleStatsLoader } from '../battle/BattleStatsLoader.js';
import { formCodeFromIndex, normalizeFormIndex, pad3, toInt, unitFormKey, unitKey } from './BcuIdentifier.js';
import { resolveUnitAsset, toFetchPath } from './BcuPathResolver.js';

const parseCsvRows = (text) => String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).map((line) => line.replace(/\/\/.*$/, '').trim()).filter(Boolean).map((line) => line.split(',').map((x) => x.trim()));
const toNumbers = (cols) => cols.map((v) => (Number.isFinite(Number(v)) ? Number(v) : 0));

export class BcuUnitRepository {
  constructor({ manifest, names, diagnostics, readText, locale = 'jp' }) {
    this.manifest = manifest;
    this.names = names;
    this.diagnostics = diagnostics;
    this.readText = readText;
    this.locale = locale;
    this.units = new Map();
    this.statsLoader = new BattleStatsLoader({ bcuDb: null });
  }

  async build() {
    const files = new Set(this.manifest.files || []);
    await Promise.all((this.manifest.indexes?.unitIds || []).map(async (id) => {
      const unitId = toInt(id, null);
      if (!Number.isFinite(unitId)) return;
      const id3 = pad3(unitId);
      const statsPath = (this.manifest.files || []).find((p) => p.endsWith(`/org/unit/${id3}/unit${id3}.csv`)) || `public/assets/bcu/000004/org/unit/${id3}/unit${id3}.csv`;
      let rows = [];
      try {
        rows = parseCsvRows(await this.readText(statsPath)).map(toNumbers);
      } catch (error) {
        this.diagnostics.units.missingStats.push({ unitId, file: statsPath, reason: error?.message || String(error) });
      }
      const forms = [];
      const formCount = Math.max(1, rows.length);
      for (let index = 0; index < formCount; index += 1) {
        const code = formCodeFromIndex(index);
        const raw = rows[index] || rows[0] || [];
        const name = this.names.unitForm(unitId, index, this.locale);
        if (name.source !== 'lang') this.diagnostics.units.missingNames.push({ unitId, formIndex: index, key: unitFormKey(unitId, index), source: name.source });
        const asset = resolveUnitAsset(files, unitId, code);
        if (!asset?.imagePath || !asset?.imgcutPath) this.diagnostics.units.missingAssets.push({ unitId, formIndex: index, asset });
        const stats = raw.length ? this.statsLoader.normalizeUnitStats(raw, {
          file: toFetchPath(statsPath),
          row: index,
          unitId,
          form: code,
          formRow: index,
          type: 'unit',
          mappingStatus: 'valid'
        }) : null;
        forms.push({ index, code, key: unitFormKey(unitId, index), name, stats, rawStats: raw, asset });
      }
      this.units.set(unitId, { id: unitId, id3, key: unitKey(unitId), sourcePack: '000004', folder: toFetchPath(`public/assets/bcu/000004/org/unit/${id3}/`), forms });
    }));
    return this;
  }

  get(unitId) { return this.units.get(toInt(unitId, -1)) || null; }
  getForm(unitId, formIndexOrCode = 0) {
    const index = normalizeFormIndex(formIndexOrCode);
    const unit = this.get(unitId);
    return unit?.forms?.[index] || unit?.forms?.[0] || null;
  }
  getFormStats(unitId, formIndexOrCode = 0) {
    const form = this.getForm(unitId, formIndexOrCode);
    if (!form?.stats) throw new Error(`BCU unit stats missing: unit=${unitId} form=${formIndexOrCode}`);
    return form.stats;
  }
  list() { return [...this.units.values()].sort((a, b) => a.id - b.id); }
}
