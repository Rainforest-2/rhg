// Resolves the BGM ids for a stage from its sibling MapStageData (MSD) CSV.
//
// BCU stores the per-stage music in the map's MapStageData file, not in the
// enemy-layout CSV the battle loads. For a layout file
//   stage/<CAT>/StageR<SUF>/stageR<SUF><map>_<stage>.csv
// the music lives in
//   stage/<CAT>/MSD<SUF>/MapStageData<SUF>_<map>.csv
// on the data line for <stage> (line 2 + stageIndex; lines 0/1 are the map
// number and map pattern). Each data line is:
//   [0]=energy cost  [1]=clear XP  [2]=start music id
//   [3]=boss-music castle-HP% threshold  [4]=boss music id  ...
// (column meaning verified against the in-file Japanese comments).
//
// CH main-story stages are a second shape:
//   stage/CH/stage/stage47.csv
// uses the sibling
//   stage/CH/stageNormal/stageNormal0.csv
// row 47. This is what keeps EoC 西表島 on BCU music id 4 instead of the
// catalog-default id 0.

const LAYOUT_BASENAME_RE = /^stageR([A-Za-z]+)(\d+)_(\d+)$/;
const CH_STAGE_BASENAME_RE = /^stage(\d+)$/;

function stripCsvComment(line) {
  const idx = line.indexOf('//');
  return idx >= 0 ? line.slice(0, idx) : line;
}

// Non-comment, non-empty data rows (cells trimmed). Mirrors how the MSD files
// are authored: trailing `// comment` and blank lines are ignored.
export function parseMsdRows(text) {
  return String(text || '')
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .map((line) => stripCsvComment(line).split(',').map((c) => c.trim()))
    .filter((cells) => cells.some((c) => c !== '' && Number.isFinite(Number(c))));
}

// Derive the MSD bundle reference + stage index from a layout stage entry.
// Returns null for stage families that have no MapStageData sibling.
export function deriveMsdRef(stageEntry) {
  if (!stageEntry || stageEntry.kind !== 'stage-definition') return null;
  const layoutRef = stageEntry.bundleRef || {};
  const m = LAYOUT_BASENAME_RE.exec(stageEntry.basename || '');
  if (m) {
    const suf = m[1];
    const map = m[2];
    const stageIndex = Number.parseInt(m[3], 10);
    if (!Number.isFinite(stageIndex)) return null;
    const bundleKey = typeof layoutRef.bundleKey === 'string'
      ? layoutRef.bundleKey.replace(`/StageR${suf}`, `/MSD${suf}`)
      : null;
    const bundlePath = typeof layoutRef.bundlePath === 'string'
      ? layoutRef.bundlePath.replace(`__StageR${suf}`, `__MSD${suf}`)
      : null;
    if (!bundleKey || !bundlePath) return null;
    return {
      bundleRef: {
        bundleKey,
        bundlePath,
        internalPath: `MapStageData${suf}_${map}.csv`,
        readMode: layoutRef.readMode || 'zip-text'
      },
      stageIndex,
      debug: { suf, map, stageIndex }
    };
  }
  const ch = CH_STAGE_BASENAME_RE.exec(stageEntry.basename || '');
  const isChMainStage = ch
    && typeof layoutRef.bundleKey === 'string'
    && typeof layoutRef.bundlePath === 'string'
    && /\/CH\/stage$/.test(layoutRef.bundleKey);
  if (!isChMainStage) return null;
  const stageIndex = Number.parseInt(ch[1], 10);
  if (!Number.isFinite(stageIndex)) return null;
  const bundleKey = typeof layoutRef.bundleKey === 'string'
    ? layoutRef.bundleKey.replace('/CH/stage', '/CH/stageNormal')
    : null;
  const bundlePath = typeof layoutRef.bundlePath === 'string'
    ? layoutRef.bundlePath.replace('__CH__stage.zip', '__CH__stageNormal.zip')
    : null;
  if (!bundleKey || !bundlePath) return null;
  return {
    bundleRef: {
      bundleKey,
      bundlePath,
      internalPath: 'stageNormal0.csv',
      readMode: layoutRef.readMode || 'zip-text'
    },
    stageIndex,
    debug: { family: 'CH/stage', map: 'stageNormal0', stageIndex }
  };
}

// Extract music ids from already-parsed MSD rows for a given stage index.
// Returns null when the row or its music cells are missing/invalid.
export function parseStageMusicFromRows(rows, stageIndex, catalog) {
  const row = rows[2 + stageIndex];
  if (!Array.isArray(row)) return null;
  const startRaw = Number(row[2]);
  const thresholdRaw = Number(row[3]);
  const bossRaw = Number(row[4]);
  const startMusicId = catalog.normalizeId(startRaw);
  if (startMusicId == null) return null;
  const bossMusicId = catalog.normalizeId(bossRaw);
  const bossHpThresholdPercent = Number.isFinite(thresholdRaw) ? thresholdRaw : 100;
  return {
    startMusicId,
    bossMusicId,
    bossHpThresholdPercent,
    source: 'MapStageData',
    stageIndex
  };
}

// Full async resolution. `readMsdText(bundleRef)` must return the MSD CSV text.
// Always resolves to a usable music descriptor (catalog defaults on any miss).
export async function resolveStageMusic({ stageEntry, readMsdText, catalog }) {
  const defaults = catalog.defaults();
  const fallback = {
    startMusicId: defaults.startMusicId,
    bossMusicId: defaults.bossMusicId,
    bossHpThresholdPercent: defaults.bossHpThresholdPercent,
    source: 'catalog-default'
  };
  try {
    const ref = deriveMsdRef(stageEntry);
    if (!ref || typeof readMsdText !== 'function') return fallback;
    const text = await readMsdText(ref.bundleRef);
    const rows = parseMsdRows(text);
    const music = parseStageMusicFromRows(rows, ref.stageIndex, catalog);
    return music || fallback;
  } catch {
    return fallback;
  }
}
