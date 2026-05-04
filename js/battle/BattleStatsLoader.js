const UNIT_VERSION = '000004';
const ENEMY_VERSION = '000001';

async function fetchText(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`Failed to fetch ${path}: ${r.status}`);
  return await r.text();
}

function parseCsvRows(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/\/\/.*$/, '').trim())
    .filter(Boolean)
    .map((line) => line.split(',').map((x) => x.trim()))
    .map((cols) => cols.filter((_, idx) => idx < cols.length));
}

function toNumbers(cols) {
  return cols.map((v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  });
}

export class BattleStatsLoader {
  parseUnitCsv(text) {
    return parseCsvRows(text).map(toNumbers);
  }

  parseEnemyTUnitCsv(text) {
    return parseCsvRows(text).map(toNumbers);
  }

  normalizeStats(raw, sourceInfo) {
    const values = raw || [];
    return {
      hp: values[0] ?? 1,
      knockbacks: values[1] ?? 0,
      speed: values[2] ?? 0,
      damage: values[3] ?? 0,
      attackIntervalFrames: values[4] ?? 0,
      range: values[5] ?? 0,
      rawEconomyValue: values[6] ?? 0,
      rawValues: values,
      source: sourceInfo
    };
  }

  async loadUnitStats(unitId, form = 'f', formRow = 0) {
    const unit = String(unitId).padStart(3, '0');
    const file = `./public/assets/bcu/${UNIT_VERSION}/org/unit/${unit}/unit${unit}.csv`;
    const text = await fetchText(file);
    const rows = this.parseUnitCsv(text);
    // Commonly row0/row1/row2 are base/evolved/true-form in unitXXX.csv.
    // Current preview uses form "f" sprite; for now we map to row0 provisionally.
    const row = rows[formRow] || rows[0];
    if (!row) throw new Error(`No unit stat rows in ${file}`);
    return this.normalizeStats(row, { file, row: rows[formRow] ? formRow : 0, type: 'unit', form, provisional: true });
  }

  async loadEnemyStats(enemyId) {
    const file = `./public/assets/bcu/${ENEMY_VERSION}/org/data/t_unit.csv`;
    const text = await fetchText(file);
    const rows = this.parseEnemyTUnitCsv(text);
    const candidate = [90, 3, 5, 8, 20, 110, 15];
    let rowIndex = rows.findIndex((r) => candidate.every((v, i) => r[i] === v));
    if (rowIndex < 0) rowIndex = Number(enemyId) + 2;
    const row = rows[rowIndex];
    if (!row) throw new Error(`No enemy stat row found for enemyId=${enemyId} in ${file}`);
    return this.normalizeStats(row, { file, row: rowIndex, type: 'enemy', enemyId, provisional: true, note: 't_unit row mapping is provisional' });
  }
}
