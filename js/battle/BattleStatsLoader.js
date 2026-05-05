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

  buildLdForHit(raw, hitIndex, baseLdStart, baseLdRange, startIndex) {
    if (hitIndex <= 0) return { ldStartRaw: baseLdStart, ldRangeRaw: baseLdRange };
    const idx = startIndex + (hitIndex - 1) * 3;
    const flag = val(raw, idx, 0);
    if (flag === 1) return { ldStartRaw: val(raw, idx + 1, baseLdStart), ldRangeRaw: val(raw, idx + 2, baseLdRange) };
    return { ldStartRaw: baseLdStart, ldRangeRaw: baseLdRange };
  }

  buildAttackHits(config) {
    const safe = (n) => Number.isFinite(n) && n > 0 ? n : 0;
    const p = (n) => Number.isFinite(n) && n >= 0 ? n : 0;
    const { atk0, atk1, atk2, pre0, pre1, pre2, abi0, abi1, abi2, baseLdStart, baseLdRange, rawValues, ldOverrideBaseIndex } = config;
    const hits = [];
    const pushHit = (hitIndex, damageRaw, preFramesRaw, deltaFrames, abiRaw) => {
      const ld = this.buildLdForHit(rawValues, hitIndex, baseLdStart, baseLdRange, ldOverrideBaseIndex);
      hits.push({ hitIndex, damage: safe(damageRaw), preFrames: p(preFramesRaw), deltaFrames: Number.isFinite(deltaFrames) ? deltaFrames : 0, abi: Number.isFinite(abiRaw) ? abiRaw : 0, ldStartRaw: ld.ldStartRaw, ldRangeRaw: ld.ldRangeRaw, isLd: ld.ldRangeRaw > 0, isOmni: ld.ldRangeRaw < 0 });
    };
    pushHit(0, atk0, pre0, p(pre0), abi0);
    if (safe(atk1) > 0) pushHit(1, atk1, pre1, p(pre1) - p(pre0), abi1);
    if (safe(atk2) > 0) pushHit(2, atk2, pre2, p(pre2) - p(pre1), abi2);
    return hits;
  }

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
    if (!(stats.tbaFrames >= 0)) invalidFields.push('tbaFrames');
    if (!(stats.width >= 0)) invalidFields.push('width');
    if (!(stats.longPreFrames >= 0)) invalidFields.push('longPreFrames');
    if (!Array.isArray(stats.attackHits) || stats.attackHits.length < 1) invalidFields.push('attackHits');
    if (!(stats.attackCount >= 1)) invalidFields.push('attackCount');
    for (const hit of (stats.attackHits || [])) {
      if (!(hit?.damage >= 0)) invalidFields.push(`attackHits.damage.${hit?.hitIndex ?? '?'}`);
      if (!(hit?.preFrames >= 0)) invalidFields.push(`attackHits.preFrames.${hit?.hitIndex ?? '?'}`);
      if (Number.isFinite(hit?.deltaFrames) && hit.deltaFrames < 0) suspiciousFields.push(`attackHits.deltaFrames.${hit?.hitIndex ?? '?'}`);
    }
    return { valid: invalidFields.length === 0, invalidFields, suspiciousFields };
  }

  normalizeUnitStats(raw, sourceInfo) {
    const v = raw || [];
    const atk0 = val(v, 3, 0), atk1 = val(v, 59, 0), atk2 = val(v, 60, 0);
    const pre0 = val(v, 13, 0), pre1 = val(v, 61, 0), pre2 = val(v, 62, 0);
    const abi0 = val(v, 63, 0), abi1 = val(v, 64, 0), abi2 = val(v, 65, 0);
    const ldStartRaw = val(v, 44, 0), ldRangeRaw = val(v, 45, 0);
    const rawTbaFrames = val(v, 4, 0);
    const tbaFrames = Math.max(0, rawTbaFrames * 2);
    const attackHits = this.buildAttackHits({ atk0, atk1, atk2, pre0, pre1, pre2, abi0, abi1, abi2, baseLdStart: ldStartRaw, baseLdRange: ldRangeRaw, rawValues: v, ldOverrideBaseIndex: 99 });
    const stats = {
      hp: Math.max(1, val(v, 0, 1)), knockbacks: Math.max(1, val(v, 1, 1)), speed: Math.max(0, val(v, 2, 0)), damage: Math.max(0, atk0),
      attackWaitFrames: tbaFrames, tbaFrames, rawTbaFrames, detectionRange: Math.max(0, val(v, 5, 0)), range: Math.max(0, val(v, 5, 0)),
      width: Math.max(0, val(v, 9, 0)), costOrReward: Math.max(0, val(v, 6, 0)), respawnFrames: Math.max(0, val(v, 7, 0) * 2),
      attackType: val(v, 12, 0) === 1 ? 1 : 0, isRange: val(v, 12, 0) === 1, attackStartupFrames: Math.max(0, pre0),
      longPreFrames: Math.max(0, pre2 > 0 ? pre2 : (pre1 > 0 ? pre1 : pre0)), attackCount: attackHits.length, attackHits,
      front: val(v, 14, 0), back: val(v, 15, 0), ldStartRaw, ldRangeRaw, rawValues: v,
      source: { ...sourceInfo, type: 'unit', bcuAssetKind: 'unit', bcuRole: 'ally-unit', mapping: 'bcu-unit', assetSource: 'org/unit/{unit}/unit{unit}.csv', csvKind: 'unit-form-row', mappingStatus: 'valid', fallbackFields: [] }
    };
    const validation = this.validateStats(stats);
    if (!validation.valid) stats.source.mappingStatus = 'invalid';
    if (validation.suspiciousFields.length && stats.source.mappingStatus !== 'invalid') stats.source.mappingStatus = 'provisional';
    stats.source.fallbackFields.push(...validation.invalidFields, ...validation.suspiciousFields);
    return stats;
  }

  normalizeEnemyStats(raw, sourceInfo) {
    const v = raw || [];
    const atk0 = val(v, 3, 0), atk1 = val(v, 55, 0), atk2 = val(v, 56, 0);
    const pre0 = val(v, 12, 0), pre1 = val(v, 57, 0), pre2 = val(v, 58, 0);
    const abi0 = val(v, 59, 0), abi1 = val(v, 60, 0), abi2 = val(v, 61, 0);
    const ldStartRaw = val(v, 35, 0), ldRangeRaw = val(v, 36, 0);
    const rawTbaFrames = val(v, 4, 0);
    const tbaFrames = Math.max(0, rawTbaFrames * 2);
    const attackHits = this.buildAttackHits({ atk0, atk1, atk2, pre0, pre1, pre2, abi0, abi1, abi2, baseLdStart: ldStartRaw, baseLdRange: ldRangeRaw, rawValues: v, ldOverrideBaseIndex: 95 });
    const stats = {
      hp: Math.max(1, val(v, 0, 1)), knockbacks: Math.max(1, val(v, 1, 1)), speed: Math.max(0, val(v, 2, 0)), damage: Math.max(0, atk0),
      attackWaitFrames: tbaFrames, tbaFrames, rawTbaFrames, detectionRange: Math.max(0, val(v, 5, 0)), range: Math.max(0, val(v, 5, 0)),
      width: Math.max(0, val(v, 8, 0)), costOrReward: Math.max(0, val(v, 6, 0)), respawnFrames: 0,
      attackType: val(v, 11, 0) === 1 ? 1 : 0, isRange: val(v, 11, 0) === 1, attackStartupFrames: Math.max(0, pre0),
      longPreFrames: Math.max(0, pre2 > 0 ? pre2 : (pre1 > 0 ? pre1 : pre0)), attackCount: attackHits.length, attackHits,
      front: 0, back: 0, ldStartRaw, ldRangeRaw, rawValues: v,
      source: { ...sourceInfo, type: 'enemy', bcuAssetKind: 'enemy', bcuRole: 'enemy', mapping: 'bcu-enemy', assetSource: 'org/data/t_unit.csv', csvKind: 'enemy-table-row', mappingStatus: 'valid', fallbackFields: [] }
    };
    const validation = this.validateStats(stats);
    if (!validation.valid) stats.source.mappingStatus = 'invalid';
    if (validation.suspiciousFields.length && stats.source.mappingStatus !== 'invalid') stats.source.mappingStatus = 'provisional';
    stats.source.fallbackFields.push(...validation.invalidFields, ...validation.suspiciousFields);
    return stats;
  }


  describeStats(stats) {
    const source = stats?.source || {};
    return {
      type: source.type || '-',
      bcuAssetKind: source.bcuAssetKind || source.type || '-',
      bcuRole: source.bcuRole || '-',
      mapping: source.mapping || '-',
      file: source.file || '-',
      row: Number.isFinite(source.row) ? source.row : null,
      mappingStatus: source.mappingStatus || '-',
      hp: stats?.hp ?? null,
      damage: stats?.damage ?? null,
      speed: stats?.speed ?? null,
      range: stats?.range ?? stats?.detectionRange ?? null,
      width: stats?.width ?? null,
      isRange: !!stats?.isRange,
      attackCount: stats?.attackCount ?? null,
      attackHits: Array.isArray(stats?.attackHits)
        ? stats.attackHits.map((h) => ({ hitIndex: h.hitIndex, damage: h.damage, preFrames: h.preFrames, ldStartRaw: h.ldStartRaw, ldRangeRaw: h.ldRangeRaw, isLd: !!h.isLd, isOmni: !!h.isOmni }))
        : []
    };
  }

  normalizeStats(raw, sourceInfo) {
    return sourceInfo?.type === 'enemy' ? this.normalizeEnemyStats(raw, sourceInfo) : this.normalizeUnitStats(raw, sourceInfo);
  }

  async loadUnitStats(unitId, form = 'f', formRow = 0) { const unit = String(unitId).padStart(3, '0'); const file = `./public/assets/bcu/${UNIT_VERSION}/org/unit/${unit}/unit${unit}.csv`; const rows = this.parseUnitCsv(await fetchText(file)); const row = rows[formRow] || rows[0]; if (!row) throw new Error(`No unit stat rows in ${file}`); return this.normalizeUnitStats(row, { file, row: rows[formRow] ? formRow : 0, type: 'unit', form, provisional: true }); }
  async loadEnemyStats(enemyId) { const file = `./public/assets/bcu/${ENEMY_VERSION}/org/data/t_unit.csv`; const rows = this.parseEnemyTUnitCsv(await fetchText(file)); const rowIndex = Number(enemyId) + 2; const row = rows[rowIndex]; if (!row) throw new Error(`No enemy stat row found for enemyId=${enemyId} in ${file}`); return this.normalizeEnemyStats(row, { file, row: rowIndex, type: 'enemy', enemyId, provisional: true, note: 't_unit row mapping is provisional' }); }
}
