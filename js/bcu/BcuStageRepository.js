import { parseStageTriplet, stageKey, toInt } from './BcuIdentifier.js';

export class BcuStageRepository {
  constructor({ manifest, names, diagnostics, readText, enemies, backgrounds, castles, locale = 'jp' }) {
    this.manifest = manifest;
    this.names = names;
    this.diagnostics = diagnostics;
    this.readText = readText;
    this.enemies = enemies;
    this.backgrounds = backgrounds;
    this.castles = castles;
    this.locale = locale;
    this.stages = new Map();
  }

  async build() {
    for (const key of this.names.listKeys?.('stage') || []) {
      const parsed = parseStageTriplet(key);
      if (!parsed) continue;
      const name = this.names.resolve('stage', parsed.key, this.locale);
      this.stages.set(parsed.key, { ...parsed, sourcePath: null, name });
    }
    for (const file of this.manifest.indexes?.stageCsvFiles || []) {
      const triplet = this.tripletFromPath(file);
      if (!triplet) continue;
      const name = this.names.stage(`${triplet.mapColcId}-${triplet.mapId}-${triplet.stageId}`, this.locale);
      if (name.source !== 'lang') this.diagnostics.stages.missingNames.push({ key: triplet.key, file, source: name.source });
      this.stages.set(triplet.key, { ...triplet, sourcePath: `./${file}`, name });
    }
    return this;
  }

  tripletFromPath(file) {
    const name = String(file || '').split('/').pop()?.replace(/\.csv$/i, '') || '';
    const parts = name.split('-').map((x) => toInt(x, null));
    if (parts.length >= 3 && parts.slice(0, 3).every(Number.isFinite)) return { mapColcId: parts[0], mapId: parts[1], stageId: parts[2], key: stageKey(parts[0], parts[1], parts[2]) };
    return null;
  }

  get(key) {
    const parsed = parseStageTriplet(key);
    const realKey = parsed?.key || (String(key).startsWith('stage:') ? String(key) : `stage:${key}`);
    return this.stages.get(realKey) || null;
  }

  hydrateStageDefinition(stageDefinition) {
    const out = { ...stageDefinition };
    const bg = this.backgrounds.get(out.bgId ?? out.runtime?.bgId);
    const castle = this.castles.enemy.get(out.castleId ?? out.runtime?.castleId ?? 0);
    const stageMeta = out.stageKey ? this.get(out.stageKey) : null;
    out.background = bg;
    out.enemyCastle = castle;
    out.name = stageMeta?.name || (out.stageKey ? this.names.stage(out.stageKey, this.locale) : null);
    out.enemyRows = (out.enemyRows || []).map((row) => {
      const resolved = this.enemies.fromStageRawId(row.rawEnemyId ?? row.sourceEnemyId);
      if (!resolved.ok) this.diagnostics.stages.unresolvedEnemies.push({ rawEnemyId: row.rawEnemyId, enemyId: row.enemyId });
      return { ...row, enemy: resolved.enemy, enemyName: resolved.enemy?.name || null };
    });
    if (!bg) this.diagnostics.stages.unresolvedBackgrounds.push({ bgId: out.bgId ?? out.runtime?.bgId });
    if (!castle) this.diagnostics.stages.unresolvedCastles.push({ castleId: out.castleId ?? out.runtime?.castleId });
    return out;
  }

  list() { return [...this.stages.values()].sort((a, b) => a.key.localeCompare(b.key)); }
}
