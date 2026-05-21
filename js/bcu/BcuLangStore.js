import { backgroundKey, enemyCastleKey, enemyKey, mapColcKey, nyCastleKey, stageKey, stageMapKey, toInt, unitFormKey } from './BcuIdentifier.js';

const STANDARD_NAME_FILES = new Set([
  'StageName.txt', 'UnitName.txt', 'EnemyName.txt', 'ComboName.txt', 'RewardName.txt',
  'BackgroundName.txt', 'BGName.txt', 'BgName.txt',
  'CastleName.txt', 'CastleImgName.txt', 'EnemyCastleName.txt',
  'NyCastleName.txt', 'CatCastleName.txt', 'CastlePartName.txt'
]);

function stripLine(line) {
  return String(line || '').replace(/^\uFEFF/, '').split('//')[0].trim();
}

function splitLangLine(line) {
  if (line.includes('\t')) return line.split('\t').map((x) => x.trim());
  if (line.includes(',')) return line.split(',').map((x) => x.trim());
  return null;
}

function baseName(path) {
  return String(path || '').split('/').pop() || '';
}

function canonicalLangFileName(path, locale) {
  const name = baseName(path);
  const prefix = `${locale}-`;
  return name.startsWith(prefix) ? name.slice(prefix.length) : name;
}

function addToMap(map, locale, key, value, file) {
  if (!key || !value) return;
  if (!map.has(key)) map.set(key, new Map());
  map.get(key).set(locale, { value, file });
}

export class BcuLangStore {
  constructor({ locale = 'jp', diagnostics } = {}) {
    this.locale = locale;
    this.diagnostics = diagnostics;
    this.tables = new Map();
    this.generic = new Map();
    this.loadedLocales = [];
    this.loadedFiles = [];
  }

  add(locale, kind, key, value, file) {
    if (!this.tables.has(kind)) this.tables.set(kind, new Map());
    addToMap(this.tables.get(kind), locale, key, value, file);
  }

  async loadFromManifest(manifest, readText) {
    const langFiles = manifest?.langFiles || {};
    const locales = Object.keys(langFiles).filter((locale) => locale === 'jp').sort();
    this.loadedLocales = locales;
    this.diagnostics.lang.loadedLocales = locales;
    for (const locale of locales) {
      const files = [...langFiles[locale]].sort((a, b) => {
        const aa = STANDARD_NAME_FILES.has(canonicalLangFileName(a, locale)) ? 0 : 1;
        const bb = STANDARD_NAME_FILES.has(canonicalLangFileName(b, locale)) ? 0 : 1;
        return aa - bb || String(a).localeCompare(String(b));
      });
      for (const file of files) {
        let text = '';
        try { text = await readText(file); } catch (error) {
          this.diagnostics.lang.invalidLines.push({ locale, file, line: 0, reason: `load-failed:${error?.message || error}` });
          continue;
        }
        this.loadedFiles.push(file);
        this.diagnostics.lang.loadedFiles.push(file);
        this.parseFile(locale, file, text);
      }
    }
  }

  static fromCoreDb(coreDb, { locale = 'jp', diagnostics } = {}) {
    const store = new BcuLangStore({ locale, diagnostics });
    store.loadedLocales = ['jp'];
    if (diagnostics?.lang) diagnostics.lang.loadedLocales = ['jp'];
    const names = coreDb?.namesJp?.tables || coreDb?.namesJp || {};
    for (const [kind, table] of Object.entries(names)) {
      if (!table || typeof table !== 'object') continue;
      for (const [key, value] of Object.entries(table)) {
        const text = typeof value === 'string' ? value : value?.value;
        if (text) store.add('jp', kind, key, text, value?.file || 'core-db.zip:names-jp.json');
      }
    }
    store.loadedFiles = ['core-db.zip:names-jp.json'];
    if (diagnostics?.lang) diagnostics.lang.loadedFiles.push('core-db.zip:names-jp.json');
    return store;
  }

  parseFile(locale, file, text) {
    const name = canonicalLangFileName(file, locale);
    const lines = String(text || '').split(/\r?\n/);
    const parser = {
      'UnitName.txt': (cols) => this.parseUnitName(locale, file, cols),
      'EnemyName.txt': (cols) => this.parseEnemyName(locale, file, cols),
      'StageName.txt': (cols) => this.parseStageName(locale, file, cols),
      'BackgroundName.txt': (cols) => this.parseBackgroundName(locale, file, cols),
      'BGName.txt': (cols) => this.parseBackgroundName(locale, file, cols),
      'BgName.txt': (cols) => this.parseBackgroundName(locale, file, cols),
      'CastleName.txt': (cols) => this.parseEnemyCastleName(locale, file, cols),
      'CastleImgName.txt': (cols) => this.parseEnemyCastleName(locale, file, cols),
      'EnemyCastleName.txt': (cols) => this.parseEnemyCastleName(locale, file, cols),
      'NyCastleName.txt': (cols) => this.parseNyCastleName(locale, file, cols),
      'CatCastleName.txt': (cols) => this.parseNyCastleName(locale, file, cols),
      'CastlePartName.txt': (cols) => this.parseNyCastleName(locale, file, cols),
      'ComboName.txt': (cols) => cols.length >= 2 && this.add(locale, 'combo', `combo:${cols[0]}`, cols[1], file),
      'RewardName.txt': (cols) => cols.length >= 2 && this.add(locale, 'reward', `reward:${cols[0]}`, cols[1], file)
    }[name];
    if (!parser && name.endsWith('Name.txt')) {
      this.diagnostics.lang.unknownNameFiles.push({ locale, file, lineCount: lines.length });
    } else if (!parser && !name.endsWith('.properties') && !name.endsWith('.json') && !['Difficulty.txt'].includes(name)) {
      this.diagnostics.lang.unknownFiles.push({ locale, file, lineCount: lines.length });
    }
    if (!parser && !name.endsWith('Name.txt')) return;
    for (let i = 0; i < lines.length; i += 1) {
      const clean = stripLine(lines[i]);
      if (!clean) continue;
      const cols = splitLangLine(clean);
      if (!cols || cols.length < 2) {
        this.diagnostics.lang.invalidLines.push({ locale, file, line: i + 1, reason: 'missing-delimiter' });
        continue;
      }
      if (parser) parser(cols, i + 1);
      else if (name.endsWith('Name.txt')) this.generic.set(`${file}:${cols[0]}`, cols.slice(1).join('\t'));
    }
  }

  parseUnitName(locale, file, cols) {
    const unitId = toInt(cols[0], null);
    if (!Number.isFinite(unitId)) return;
    for (let i = 1; i < cols.length; i += 1) {
      if (cols[i]) this.add(locale, 'unitForm', unitFormKey(unitId, i - 1), cols[i], file);
    }
  }

  parseEnemyName(locale, file, cols) {
    const enemyId = toInt(cols[0], null);
    if (Number.isFinite(enemyId) && cols[1]) this.add(locale, 'enemy', enemyKey(enemyId), cols[1], file);
  }

  parseStageName(locale, file, cols) {
    const id = cols[0];
    const value = cols[cols.length - 1];
    const parts = id.split('-').map((x) => toInt(x, null));
    if (!value || parts.some((x) => !Number.isFinite(x))) return;
    if (parts.length === 1) this.add(locale, 'mapColc', mapColcKey(parts[0]), value, file);
    if (parts.length === 2) this.add(locale, 'stageMap', stageMapKey(parts[0], parts[1]), value, file);
    if (parts.length === 3) this.add(locale, 'stage', stageKey(parts[0], parts[1], parts[2]), value, file);
  }

  parseBackgroundName(locale, file, cols) {
    const raw = cols[0].replace(/^background:/, '').replace(/^bg:/, '').split('/').pop();
    const id = toInt(raw, null);
    if (Number.isFinite(id) && cols[1]) this.add(locale, 'background', backgroundKey(id), cols[1], file);
  }

  parseEnemyCastleName(locale, file, cols) {
    const raw = cols[0];
    let id = toInt(raw.replace(/^enemyCastle:/, '').replace(/^castle:/, ''), null);
    if (!Number.isFinite(id)) {
      const m = raw.match(/^(rc|ec|wc|sc)\/?(\d+)$/);
      if (m) id = ['rc', 'ec', 'wc', 'sc'].indexOf(m[1]) * 1000 + toInt(m[2], 0);
    }
    if (Number.isFinite(id) && cols[1]) this.add(locale, 'enemyCastle', enemyCastleKey(id), cols[1], file);
  }

  parseNyCastleName(locale, file, cols) {
    if (cols[0] && cols[1]) this.add(locale, 'nyCastle', nyCastleKey(cols[0]), cols[1], file);
  }

  resolve(kind, key, locale = this.locale) {
    const requestedLocale = locale || this.locale;
    if (requestedLocale !== 'jp') throw new Error(`Unsupported BCU language locale: ${requestedLocale}`);
    const table = this.tables.get(kind);
    const localeMap = table?.get(key);
    const warnings = [];
    const order = [requestedLocale, 'jp', ...this.loadedLocales].filter(Boolean);
    for (const loc of [...new Set(order)]) {
      const hit = localeMap?.get(loc);
      if (hit?.value) {
        if (loc !== requestedLocale) warnings.push(`locale-fallback:${requestedLocale}->${loc}`);
        return { value: hit.value, locale: loc, requestedLocale, source: 'lang', file: hit.file, key, warnings };
      }
    }
    const value = key;
    const result = { value, locale: requestedLocale, requestedLocale, source: 'fallback-id', key, warnings: [`missing-${kind}-name`] };
    this.diagnostics.lang.missingNames.push({ kind, key, locale: requestedLocale, fallback: value });
    return result;
  }

  listKeys(kind) {
    return [...(this.tables.get(kind)?.keys() || [])];
  }

  unitForm(unitId, formIndex = 0, locale = this.locale) { return this.resolve('unitForm', unitFormKey(unitId, formIndex), locale); }
  enemy(enemyId, locale = this.locale) { return this.resolve('enemy', enemyKey(enemyId), locale); }
  stage(keyOrTriplet, locale = this.locale) {
    const key = String(keyOrTriplet).startsWith('stage:') ? keyOrTriplet : `stage:${keyOrTriplet}`;
    return this.resolve('stage', key, locale);
  }
  background(bgId, locale = this.locale) { return this.resolve('background', backgroundKey(bgId), locale); }
  enemyCastle(castleId, locale = this.locale) { return this.resolve('enemyCastle', enemyCastleKey(castleId), locale); }
  nyCastle(partId, locale = this.locale) { return this.resolve('nyCastle', nyCastleKey(partId), locale); }
}