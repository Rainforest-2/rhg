const UNIT_VERSION = '000004';
const ENEMY_VERSION = '000001';

async function fetchText(path) { const r = await fetch(path); if (!r.ok) throw new Error(`Failed to fetch ${path}: ${r.status}`); return await r.text(); }
const parseCsvRows = (text) => text.split(/\r?\n/).map((line) => line.replace(/\/\/.*$/, '').trim()).filter(Boolean).map((line) => line.split(',').map((x) => x.trim()));
const toNumbers = (cols) => cols.map((v) => (Number.isFinite(Number(v)) ? Number(v) : 0));

export class BattleStatsLoader {
  parseUnitCsv(text) { return parseCsvRows(text).map(toNumbers); }
  parseEnemyTUnitCsv(text) { return parseCsvRows(text).map(toNumbers); }

  validateStats(stats) {
    const invalidFields = [];
    const suspiciousFields = [];
    if (!(stats.hp > 0)) invalidFields.push('hp');
    if (!(stats.knockbacks >= 1)) invalidFields.push('knockbacks');
    if (!(stats.speed >= 0)) invalidFields.push('speed');
    if (!(stats.damage >= 0)) invalidFields.push('damage');
    if (!(stats.detectionRange >= 0)) invalidFields.push('detectionRange');
    if (!(stats.attackType === 0 || stats.attackType === 1)) invalidFields.push('attackType');
    if (!(stats.attackStartupFrames >= 0)) invalidFields.push('attackStartupFrames');
    if (!(stats.attackWaitFrames >= 0)) invalidFields.push('attackWaitFrames');
    if (stats.source?.type === 'enemy' && stats.attackStartupFrames === 0) suspiciousFields.push('attackStartupFrames');
    return { valid: invalidFields.length === 0, invalidFields, suspiciousFields };
  }

  normalizeStats(raw, sourceInfo) {
    const v = raw || [];
    const stats = {
      hp: v[0] ?? 1, knockbacks: v[1] ?? 0, speed: v[2] ?? 0, damage: v[3] ?? 0,
      attackWaitFrames: v[4] ?? 0, detectionRange: v[5] ?? 0, costOrReward: v[6] ?? 0, respawnFrames: v[7] ?? 0,
      detectAreaStartRaw: v[8] ?? 0, detectAreaEndRaw: v[9] ?? 0, attackType: v[12] ?? 0, attackStartupFrames: v[13] ?? 0,
      rawValues: v, source: { ...sourceInfo, mappingStatus: 'valid', fallbackFields: [] }
    };
    const validation = this.validateStats(stats);
    if (!validation.valid) stats.source.mappingStatus = 'invalid';
    if (validation.suspiciousFields.length && stats.source.mappingStatus !== 'invalid') stats.source.mappingStatus = 'provisional';
    if (validation.invalidFields.includes('attackType')) { stats.attackType = 0; stats.source.fallbackFields.push('attackType'); }
    if (validation.invalidFields.includes('attackStartupFrames')) { stats.attackStartupFrames = 8; stats.source.fallbackFields.push('attackStartupFrames'); }
    if (validation.suspiciousFields.includes('attackStartupFrames')) stats.source.fallbackFields.push('attackStartupFrames');
    return stats;
  }

  async loadUnitStats(unitId, form = 'f', formRow = 0) { const unit = String(unitId).padStart(3, '0'); const file = `./public/assets/bcu/${UNIT_VERSION}/org/unit/${unit}/unit${unit}.csv`; const rows = this.parseUnitCsv(await fetchText(file)); const row = rows[formRow] || rows[0]; if (!row) throw new Error(`No unit stat rows in ${file}`); return this.normalizeStats(row, { file, row: rows[formRow] ? formRow : 0, type: 'unit', form, provisional: true }); }
  async loadEnemyStats(enemyId) { const file = `./public/assets/bcu/${ENEMY_VERSION}/org/data/t_unit.csv`; const rows = this.parseEnemyTUnitCsv(await fetchText(file)); const rowIndex = Number(enemyId) + 2; const row = rows[rowIndex]; if (!row) throw new Error(`No enemy stat row found for enemyId=${enemyId} in ${file}`); return this.normalizeStats(row, { file, row: rowIndex, type: 'enemy', enemyId, provisional: true, note: 't_unit row mapping is provisional' }); }
}
