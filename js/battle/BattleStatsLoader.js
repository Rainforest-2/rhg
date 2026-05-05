import {
  BCU_STATS_SCHEMA_VERSION,
  UNIT_FIELD_SCHEMA,
  ENEMY_FIELD_SCHEMA,
  buildBcuAttackHits,
  summarizeBcuRawFields
} from './BcuStatsSchema.js';

const UNIT_VERSION = '000004';
const ENEMY_VERSION = '000001';

async function fetchText(path) {
  const isRelative = typeof path === 'string' && (path.startsWith('./') || path.startsWith('../'));
  if (isRelative && typeof window === 'undefined') {
    const { readFile } = await import('node:fs/promises');
    const { fileURLToPath, pathToFileURL } = await import('node:url');
    const cwdBase = pathToFileURL(`${process.cwd().replace(/\\/g, '/')}/`);
    const absPath = fileURLToPath(new URL(path, cwdBase));
    return await readFile(absPath, 'utf8');
  }
  const r = await fetch(path);
  if (!r.ok) throw new Error(`Failed to fetch ${path}: ${r.status}`);
  return await r.text();
}
const parseCsvRows = (text) => text.split(/\r?\n/).map((line) => line.replace(/\/\/.*$/, '').trim()).filter(Boolean).map((line) => line.split(',').map((x) => x.trim()));
const toNumbers = (cols) => cols.map((v) => (Number.isFinite(Number(v)) ? Number(v) : 0));
const val = (v, i, fallback = 0) => Number.isFinite(v?.[i]) ? v[i] : fallback;

export class BattleStatsLoader {
  parseUnitCsv(text) { return parseCsvRows(text).map(toNumbers); }
  parseEnemyTUnitCsv(text) { return parseCsvRows(text).map(toNumbers); }

  normalizeUnitStats(raw, sourceInfo = {}, fps = 30) {
    const v = raw || [];
    const UNIT = UNIT_FIELD_SCHEMA;
    const rawTbaFrames = val(v, UNIT.tba, 0);
    const tbaFrames = Math.max(0, rawTbaFrames * 2);
    const price = Math.max(0, val(v, UNIT.price, 0));
    const respawnFrames = Math.max(0, val(v, UNIT.respawn, 0) * 2);
    const attackHits = buildBcuAttackHits({ rawValues: v, kind: 'unit' });
    return {
      hp: Math.max(1, val(v, UNIT.hp, 1)),
      knockbacks: Math.max(1, val(v, UNIT.knockbacks, 1)),
      speed: Math.max(0, val(v, UNIT.speed, 0)),
      damage: Math.max(0, val(v, UNIT.atk0, 0)),
      rawTbaFrames,
      tbaFrames,
      attackWaitFrames: tbaFrames,
      detectionRange: Math.max(0, val(v, UNIT.range, 0)),
      range: Math.max(0, val(v, UNIT.range, 0)),
      price,
      costOrReward: price,
      respawnFrames,
      respawnSeconds: respawnFrames / (Number.isFinite(fps) && fps > 0 ? fps : 30),
      width: Math.max(0, val(v, UNIT.width, 0)),
      attackType: val(v, UNIT.attackType, 0) === 1 ? 1 : 0,
      isRange: val(v, UNIT.attackType, 0) === 1,
      attackStartupFrames: Math.max(0, val(v, UNIT.pre0, 0)),
      longPreFrames: Math.max(0, val(v, UNIT.pre2, 0) > 0 ? val(v, UNIT.pre2, 0) : (val(v, UNIT.pre1, 0) > 0 ? val(v, UNIT.pre1, 0) : val(v, UNIT.pre0, 0))),
      front: val(v, UNIT.front, 0),
      back: val(v, UNIT.back, 0),
      ldStartRaw: val(v, UNIT.ldStart, 0),
      ldRangeRaw: val(v, UNIT.ldRange, 0),
      loop: val(v, UNIT.loop, 0),
      attackCount: attackHits.length,
      attackHits,
      rawValues: v,
      source: {
        ...sourceInfo, type: 'unit', bcuAssetKind: 'unit', bcuRole: 'ally-unit', mapping: 'bcu-dataunit-v0111',
        csvKind: 'unit-form-row', mappingStatus: 'valid', schemaVersion: BCU_STATS_SCHEMA_VERSION,
        fieldSchemaSummary: summarizeBcuRawFields({ rawValues: v, kind: 'unit' })
      }
    };
  }

  normalizeEnemyStats(raw, sourceInfo = {}) {
    const v = raw || [];
    const ENEMY = ENEMY_FIELD_SCHEMA;
    const rawTbaFrames = val(v, ENEMY.tba, 0);
    const tbaFrames = Math.max(0, rawTbaFrames * 2);
    const rewardRaw = Math.max(0, val(v, ENEMY.reward, 0));
    const attackHits = buildBcuAttackHits({ rawValues: v, kind: 'enemy' });
    return {
      hp: Math.max(1, val(v, ENEMY.hp, 1)), knockbacks: Math.max(1, val(v, ENEMY.knockbacks, 1)), speed: Math.max(0, val(v, ENEMY.speed, 0)), damage: Math.max(0, val(v, ENEMY.atk0, 0)),
      rawTbaFrames, tbaFrames, attackWaitFrames: tbaFrames, detectionRange: Math.max(0, val(v, ENEMY.range, 0)), range: Math.max(0, val(v, ENEMY.range, 0)),
      reward: rewardRaw, rewardRaw, dropAmount: rewardRaw * 100, costOrReward: rewardRaw, respawnFrames: 0,
      width: Math.max(0, val(v, ENEMY.width, 0)), attackType: val(v, ENEMY.attackType, 0) === 1 ? 1 : 0, isRange: val(v, ENEMY.attackType, 0) === 1,
      attackStartupFrames: Math.max(0, val(v, ENEMY.pre0, 0)), longPreFrames: Math.max(0, val(v, ENEMY.pre2, 0) > 0 ? val(v, ENEMY.pre2, 0) : (val(v, ENEMY.pre1, 0) > 0 ? val(v, ENEMY.pre1, 0) : val(v, ENEMY.pre0, 0))),
      ldStartRaw: val(v, ENEMY.ldStart, 0), ldRangeRaw: val(v, ENEMY.ldRange, 0), loop: val(v, ENEMY.loop, 0), star: val(v, ENEMY.star, 0),
      attackCount: attackHits.length, attackHits, rawValues: v,
      source: {
        ...sourceInfo, type: 'enemy', bcuAssetKind: 'enemy', bcuRole: 'enemy', mapping: 'bcu-dataenemy-v0111',
        csvKind: 'enemy-table-row', mappingStatus: 'valid', schemaVersion: BCU_STATS_SCHEMA_VERSION,
        fieldSchemaSummary: summarizeBcuRawFields({ rawValues: v, kind: 'enemy' })
      }
    };
  }

  describeStats(stats) { return stats; }
  normalizeStats(raw, sourceInfo) { return sourceInfo?.type === 'enemy' ? this.normalizeEnemyStats(raw, sourceInfo) : this.normalizeUnitStats(raw, sourceInfo); }

  async loadUnitStats(unitId, form = 'f', formRow = 0) {
    const unit = String(unitId).padStart(3, '0');
    const file = `./public/assets/bcu/${UNIT_VERSION}/org/unit/${unit}/unit${unit}.csv`;
    const rows = this.parseUnitCsv(await fetchText(file));
    const row = rows[formRow] || rows[0];
    if (!row) throw new Error(`No unit stat rows in ${file}`);
    return this.normalizeUnitStats(row, { file, row: rows[formRow] ? formRow : 0, unitId, form, formRow, mappingStatus: 'valid' });
  }

  async loadEnemyStats(enemyId) {
    const file = `./public/assets/bcu/${ENEMY_VERSION}/org/data/t_unit.csv`;
    const rows = this.parseEnemyTUnitCsv(await fetchText(file));
    const rowIndex = Number(enemyId) + 2;
    const row = rows[rowIndex];
    if (!row) throw new Error(`No enemy stat row found for enemyId=${enemyId} in ${file}`);
    return this.normalizeEnemyStats(row, { file, row: rowIndex, enemyId, form: null, formRow: rowIndex, mappingStatus: 'valid' });
  }
}
