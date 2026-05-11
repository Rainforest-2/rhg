import { backgroundKey, pad3, toInt } from './BcuIdentifier.js';
import { resolveBackgroundAsset, toFetchPath } from './BcuPathResolver.js';

function parseRgb(cols, start) { return { r: Number(cols[start] || 0), g: Number(cols[start + 1] || 0), b: Number(cols[start + 2] || 0) }; }

export class BcuBackgroundRepository {
  constructor({ manifest, names, diagnostics, readText, locale = 'jp' }) {
    this.manifest = manifest;
    this.names = names;
    this.diagnostics = diagnostics;
    this.readText = readText;
    this.locale = locale;
    this.backgrounds = new Map();
  }

  async build() {
    const files = new Set(this.manifest.files || []);
    const bgCsvFiles = (this.manifest.files || []).filter((p) => p.endsWith('/org/battle/bg/bg.csv')).sort();
    for (const file of bgCsvFiles) {
      let text = '';
      try { text = await this.readText(file); } catch { continue; }
      const rows = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).map((x) => x.replace(/\/\/.*$/, '').trim()).filter(Boolean);
      for (const row of rows) {
        const cols = row.split(',').map((x) => x.trim());
        const id = toInt(cols[0], null);
        if (!Number.isFinite(id)) continue;
        let imageReferenceId = toInt(cols[15], null);
        if (id === 185) imageReferenceId = null;
        const csv = {
          skyTop: parseRgb(cols, 1),
          skyBottom: parseRgb(cols, 4),
          groundTop: parseRgb(cols, 7),
          groundBottom: parseRgb(cols, 10),
          imgcutId: id === 110 ? 1 : toInt(cols[13], 1),
          showUpper: id === 110 || toInt(cols[14], 0) === 1,
          imageReferenceId: Number.isFinite(imageReferenceId) && imageReferenceId >= 0 ? imageReferenceId : null,
          raw: cols,
          sourceFile: toFetchPath(file)
        };
        if (id === 185) csv.skyBottom.b = 46;
        const name = this.names.background(id, this.locale);
        if (name.source !== 'lang') this.diagnostics.backgrounds.missingNames.push({ bgId: id, key: backgroundKey(id), source: name.source });
        const assets = resolveBackgroundAsset(files, id, csv);
        if (!assets.imagePath || !assets.imgcutPath) this.diagnostics.backgrounds.missingAssets.push({ bgId: id, assets });
        this.backgrounds.set(id, { id, id3: pad3(id), key: backgroundKey(id), name, csv, assets });
      }
    }
    for (const id of this.manifest.indexes?.backgroundIds || []) {
      const bgId = toInt(id, null);
      if (!Number.isFinite(bgId) || this.backgrounds.has(bgId)) continue;
      const csv = { skyTop: { r: 0, g: 0, b: 0 }, skyBottom: { r: 0, g: 0, b: 0 }, groundTop: { r: 0, g: 0, b: 0 }, groundBottom: { r: 0, g: 0, b: 0 }, imgcutId: 1, showUpper: true, imageReferenceId: null, raw: [], sourceFile: null };
      const assets = resolveBackgroundAsset(files, bgId, csv);
      const name = this.names.background(bgId, this.locale);
      this.diagnostics.backgrounds.missingRows.push({ bgId });
      this.backgrounds.set(bgId, { id: bgId, id3: pad3(bgId), key: backgroundKey(bgId), name, csv, assets });
    }
    return this;
  }

  static fromCoreDb(coreDb, { manifest, names, diagnostics, locale = 'jp' } = {}) {
    const repo = new BcuBackgroundRepository({ manifest, names, diagnostics, readText: null, locale });
    for (const record of Object.values(coreDb?.backgrounds?.backgrounds || {})) {
      const id = toInt(record.id ?? record.bgId, null);
      if (!Number.isFinite(id)) continue;
      repo.backgrounds.set(id, {
        id,
        id3: record.id3 || pad3(id),
        key: record.key || backgroundKey(id),
        name: record.name || names.background(id, locale),
        csv: record.csv || {},
        assets: record.assets || null
      });
    }
    return repo;
  }

  get(bgId) { return this.backgrounds.get(toInt(bgId, -1)) || null; }
  list() { return [...this.backgrounds.values()].sort((a, b) => a.id - b.id); }
}
