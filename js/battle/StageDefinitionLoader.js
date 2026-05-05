async function fetchText(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Failed to fetch ${path}: ${response.status}`);
  return response.text();
}

function stripComment(line) {
  return String(line || '').split('//')[0].trim();
}

function parseNumberRow(line) {
  const clean = stripComment(line);
  if (!clean) return [];
  return clean
    .split(',')
    .map((x) => x.trim())
    .filter((x) => x.length > 0)
    .map((x) => Number(x))
    .filter((x) => Number.isFinite(x));
}

export class StageDefinitionLoader {
  constructor(log) {
    this.log = log || (() => {});
  }

  createFallback(reason, path = '') {
    return {
      ok: false,
      source: { path, kind: 'bcu-stage-csv', parser: 'StageDefinitionLoader', reason },
      castle: { mainCastleId: null, cannonId: null, raw: [] },
      meta: {
        stageLen: null,
        enemyBaseHp: null,
        minSpawnFrame: null,
        maxSpawnFrame: null,
        bgId: null,
        maxEnemyCount: null,
        raw: []
      },
      enemies: [],
      activeEnemies: [],
      summary: {
        stageLen: null,
        enemyBaseHp: null,
        bgId: null,
        maxEnemyCount: null,
        enemyRowCount: 0,
        activeEnemyRowCount: 0
      }
    };
  }

  parse(text, path = '') {
    const rows = String(text || '')
      .replace(/^\uFEFF/, '')
      .split(/\r?\n/)
      .map(parseNumberRow)
      .filter((row) => row.length);
    const castleRow = rows[0] || [];
    const metaRow = rows[1] || [];
    const enemies = rows.slice(2)
      .filter((row) => row.length >= 10)
      .map((row, index) => ({
        rowIndex: index + 2,
        enemyId: row[0],
        count: row[1],
        firstFrame: row[2],
        respawnMinFrame: row[3],
        respawnMaxFrame: row[4],
        baseHpTriggerPercent: row[5],
        frontLayer: row[6],
        backLayer: row[7],
        bossFlag: row[8],
        magnification: row[9],
        raw: row.slice(0, 10)
      }))
      .filter((e) => Number.isFinite(e.enemyId));
    const activeEnemies = enemies.filter((e) => e.enemyId > 0);
    return {
      ok: true,
      source: { path, kind: 'bcu-stage-csv', parser: 'StageDefinitionLoader' },
      castle: {
        mainCastleId: castleRow[0] ?? null,
        cannonId: castleRow[1] ?? null,
        raw: castleRow
      },
      meta: {
        stageLen: metaRow[0] ?? null,
        enemyBaseHp: metaRow[1] ?? null,
        minSpawnFrame: metaRow[2] ?? null,
        maxSpawnFrame: metaRow[3] ?? null,
        bgId: metaRow[4] ?? null,
        maxEnemyCount: metaRow[5] ?? null,
        raw: metaRow
      },
      enemies,
      activeEnemies,
      summary: {
        stageLen: metaRow[0] ?? null,
        enemyBaseHp: metaRow[1] ?? null,
        bgId: metaRow[4] ?? null,
        maxEnemyCount: metaRow[5] ?? null,
        enemyRowCount: enemies.length,
        activeEnemyRowCount: activeEnemies.length
      }
    };
  }

  async load(stageConfig = {}) {
    const path = stageConfig.stageCsvPath;
    if (!path) return this.createFallback('missing-stageCsvPath');
    try {
      const text = await fetchText(path);
      return this.parse(text, path);
    } catch (err) {
      this.log('warn', `stage definition load failed: ${err?.message || err}`);
      return this.createFallback('load-failed', path);
    }
  }
}
