import { BattleStatsLoader } from '../battle/BattleStatsLoader.js';
import { enemyKey, pad3, toInt } from './BcuIdentifier.js';
import { resolveEnemyAsset, toFetchPath } from './BcuPathResolver.js';

const parseCsvRows = (text) => String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).map((line) => line.replace(/\/\/.*$/, '').trim()).filter(Boolean).map((line) => line.split(',').map((x) => x.trim()));
const toNumbers = (cols) => cols.map((v) => (Number.isFinite(Number(v)) ? Number(v) : 0));

function ensureCoreEnemyStatsCombatModel(record, loader, enemyId) {
  const stats = record?.stats || null;
  if (stats?.abilityModel?.mappingStatus === 'semantic-mapped' && stats?.bcuCombatModel) return stats;
  const raw = Array.isArray(record?.rawStats) ? record.rawStats : [];
  if (!raw.length) {
    throw new Error(`CoreDB enemy stats missing rawStats needed for BCU combat model: enemy=${enemyId}`);
  }
  const row = Number.isFinite(record?.row) ? record.row : enemyId + 2;
  const normalized = loader.normalizeEnemyStats(raw, {
    file: record?.sourceFile || 'core-db',
    row,
    enemyId,
    type: 'enemy',
    mappingStatus: 'valid-coredb-normalized'
  });
  return {
    ...normalized,
    ...(stats || {}),
    bcuCombatModel: normalized.bcuCombatModel,
    traits: normalized.traits,
    traitFlags: normalized.traitFlags,
    bcuAbi: normalized.bcuAbi,
    bcuAbilityFlags: normalized.bcuAbilityFlags,
    bcuProc: normalized.bcuProc,
    abilityModel: normalized.abilityModel,
    abilities: normalized.abilities
  };
}

export class BcuEnemyRepository {
  constructor({ manifest, names, diagnostics, readText, locale = 'jp' }) {
    this.manifest = manifest;
    this.names = names;
    this.diagnostics = diagnostics;
    this.readText = readText;
    this.locale = locale;
    this.enemies = new Map();
    this.statsLoader = new BattleStatsLoader({ bcuDb: null });
  }

  async build() {
    const files = new Set(this.manifest.files || []);
    const statsPath = 'public/assets/bcu/000001/org/data/t_unit.csv';
    let rows = [];
    try { rows = parseCsvRows(await this.readText(statsPath)).map(toNumbers); }
    catch (error) { this.diagnostics.enemies.missingStats.push({ file: statsPath, reason: error?.message || String(error) }); }
    for (const id of this.manifest.indexes?.enemyIds || []) {
      const enemyId = toInt(id, null);
      if (!Number.isFinite(enemyId)) continue;
      const id3 = pad3(enemyId);
      const rowIndex = enemyId + 2;
      const raw = rows[rowIndex] || [];
      const name = this.names.enemy(enemyId, this.locale);
      if (name.source !== 'lang') this.diagnostics.enemies.missingNames.push({ enemyId, key: enemyKey(enemyId), source: name.source });
      const asset = resolveEnemyAsset(files, enemyId);
      const semanticKey = `enemy:${enemyId}`;
      const semanticEntry = this.manifest.semanticIndexes?.actors?.byKey?.[semanticKey] || null;
      if (asset && semanticEntry) { asset.semanticKey = semanticKey; asset.bundleRef = semanticEntry.bundleRef; asset.semanticStatus = semanticEntry.status; }
      if (!asset?.imagePath || !asset?.imgcutPath) this.diagnostics.enemies.missingAssets.push({ enemyId, asset });
      const stats = raw.length ? this.statsLoader.normalizeEnemyStats(raw, { file: toFetchPath(statsPath), row: rowIndex, enemyId, type: 'enemy', mappingStatus: 'valid' }) : null;
      this.enemies.set(enemyId, { id: enemyId, id3, key: enemyKey(enemyId), sourcePack: '000001', name, stats, rawStats: raw, asset });
    }
    return this;
  }

  static fromCoreDb(coreDb, { manifest, names, diagnostics, locale = 'jp' } = {}) {
    const repo = new BcuEnemyRepository({ manifest, names, diagnostics, readText: null, locale });
    for (const record of Object.values(coreDb?.enemies?.enemies || {})) {
      const enemyId = toInt(record.enemyId ?? record.id, null);
      if (!Number.isFinite(enemyId)) continue;
      const stats = ensureCoreEnemyStatsCombatModel(record, repo.statsLoader, enemyId);
      repo.enemies.set(enemyId, {
        id: enemyId,
        id3: record.id3 || pad3(enemyId),
        key: record.key || enemyKey(enemyId),
        sourcePack: record.sourcePack || 'core-db',
        name: record.name || names.enemy(enemyId, locale),
        stats,
        rawStats: record.rawStats || [],
        asset: record.asset || null
      });
    }
    return repo;
  }

  get(enemyId) { return this.enemies.get(toInt(enemyId, -1)) || null; }
  getStats(enemyId) { const enemy = this.get(enemyId); if (!enemy?.stats) throw new Error(`BCU enemy stats missing: enemy=${enemyId}`); return enemy.stats; }
  fromStageRawId(rawEnemyId) { const raw = toInt(rawEnemyId, null); const enemyId = Number.isFinite(raw) ? raw - 2 : null; const enemy = Number.isFinite(enemyId) ? this.get(enemyId) : null; return { rawEnemyId: raw, enemyId, enemy, ok: !!enemy }; }
  list() { return [...this.enemies.values()].sort((a, b) => a.id - b.id); }
}
