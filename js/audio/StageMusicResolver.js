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
// CH main-story stages are a second shape: their music lives in a
// stage/CH/stageNormal/stageNormal<saga>_<chapter>(_Z|_Invasion).csv sibling.
// The whole main story (Empire of Cats / Into the Future / Cats of the Cosmos,
// 3 chapters each, plus their zombie outbreaks) is split across these files, so
// each chapter must map to its OWN MapStageData file or the BGM mixes between
// chapters. The layout group dir encodes which saga/chapter:
//
//   EoC   CH/stage/stage{SS}             -> stageNormal0.csv            row SS
//   ITF   CH/stageW/stageW{MM}_{SS}      -> stageNormal1_{MM-4}.csv     row SS  (MM 04..06)
//   CotC  CH/stageSpace/stageSpace{MM}_{SS} -> stageNormal2_{MM-7}.csv  row SS  (MM 07..09)
//   CotC invasion CH/stageSpace/stageSpace09_Invasion_{SS}
//                                        -> stageNormal2_2_Invasion.csv row SS
//   Outbreak (zombie) CH/stageZ/stageZ{MM}_{SS}
//       MM 00..02 -> stageNormal0_{MM}_Z.csv     row SS  (EoC outbreaks)
//       MM 04..06 -> stageNormal1_{MM-4}_Z.csv   row SS  (ITF outbreaks)
//
// MM is the global CH map number; (MM-4) folds ITF(4..6)->saga1 and CotC(7..9)
// ->saga2. Verified by layout-count vs MapStageData-row-count parity (48 each)
// and by the resulting per-chapter music ids. This keeps EoC 西表島 on id 4,
// 未来編の月 on its ITF theme, フィリバスター on its CotC theme, etc., instead of
// the catalog-default id 0.

const LAYOUT_BASENAME_RE = /^stageR([A-Za-z]+)(\d+)_(\d+)$/;

// Fold a global CH map number (MM) to its main-story saga + chapter (0-based).
// The CH main story is EoC(saga0)/ITF(saga1)/CotC(saga2), 3 chapters each:
//   regular   layouts use MM 04..06 (ITF) and 07..09 (CotC) -> (MM-4) folding;
//   outbreaks (stageZ) reuse MM 00..02 (EoC), 04..06 (ITF), 07..09 (CotC).
// Returns null outside the three known sagas/chapters.
function chMainSagaChapter(mm) {
  if (mm <= 2) return { saga: 0, chapter: mm };
  const k = mm - 4;
  if (k < 0) return null;
  const saga = Math.floor(k / 3) + 1;
  const chapter = k % 3;
  return saga <= 2 ? { saga, chapter } : null;
}

// Resolve a CH main-story layout (group dir + basename) to its MapStageData
// internal filename + stage row. Returns null for shapes with no music sibling.
function chMainStageMsd(group, basename) {
  if (group === 'stage') {
    const m = /^stage(\d+)$/.exec(basename);
    return m ? { internalPath: 'stageNormal0.csv', stageIndex: Number(m[1]) } : null;
  }
  // ITF (stageW) + CotC (stageSpace) regular + invasion (optionally zombie).
  if (group === 'stageW' || group === 'stageSpace') {
    const inv = /^stage(?:W|Space)(\d+)_Invasion(_Z)?_(\d+)$/.exec(basename);
    if (inv) {
      const sc = chMainSagaChapter(Number(inv[1]));
      return sc ? { internalPath: `stageNormal${sc.saga}_${sc.chapter}_Invasion${inv[2] || ''}.csv`, stageIndex: Number(inv[3]) } : null;
    }
    const m = /^stage(?:W|Space)(\d+)_(\d+)$/.exec(basename);
    if (!m) return null;
    const sc = chMainSagaChapter(Number(m[1]));
    return sc ? { internalPath: `stageNormal${sc.saga}_${sc.chapter}.csv`, stageIndex: Number(m[2]) } : null;
  }
  // Zombie outbreaks (stageZ) -> the _Z MapStageData of the same saga/chapter.
  if (group === 'stageZ') {
    const m = /^stageZ(\d+)_(\d+)$/.exec(basename);
    if (!m) return null;
    const sc = chMainSagaChapter(Number(m[1]));
    return sc ? { internalPath: `stageNormal${sc.saga}_${sc.chapter}_Z.csv`, stageIndex: Number(m[2]) } : null;
  }
  return null;
}

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
    // Two suffixes can differ. The MSD *filename* suffix comes from the layout
    // basename (stageR<fileSuf><map>_<stage> -> MapStageData<fileSuf>_<map>.csv),
    // while the MSD *bundle dir* suffix comes from the layout's group dir
    // (StageR<dirSuf> -> MSD<dirSuf>). They match for most categories, but BCU
    // ships category RA as StageRRA/stageRA*.csv with MSDRA/MapStageDataA_*.csv,
    // i.e. dirSuf="RA" but fileSuf="A". Using the basename suffix for both (the
    // old behavior) replaced nothing on the StageRRA bundleKey, so RA stages
    // resolved no music and fell back to the catalog default.
    const fileSuf = m[1];
    const map = m[2];
    const stageIndex = Number.parseInt(m[3], 10);
    if (!Number.isFinite(stageIndex)) return null;
    const dirMatch = /\/StageR([A-Za-z]+)$/.exec(layoutRef.bundleKey || '');
    const dirSuf = dirMatch ? dirMatch[1] : fileSuf;
    const bundleKey = typeof layoutRef.bundleKey === 'string'
      ? layoutRef.bundleKey.replace(`/StageR${dirSuf}`, `/MSD${dirSuf}`)
      : null;
    const bundlePath = typeof layoutRef.bundlePath === 'string'
      ? layoutRef.bundlePath.replace(`__StageR${dirSuf}`, `__MSD${dirSuf}`)
      : null;
    if (!bundleKey || !bundlePath) return null;
    // The replacement must actually apply, else the ref would point at the layout
    // bundle (which holds no MapStageData) and read as a silent miss.
    if (bundleKey === layoutRef.bundleKey || bundlePath === layoutRef.bundlePath) return null;
    return {
      bundleRef: {
        bundleKey,
        bundlePath,
        internalPath: `MapStageData${fileSuf}_${map}.csv`,
        readMode: layoutRef.readMode || 'zip-text'
      },
      stageIndex,
      debug: { dirSuf, fileSuf, map, stageIndex }
    };
  }
  // CH main-story families (EoC stage / ITF stageW / CotC stageSpace / zombie
  // stageZ). The MapStageData always lives in the CH/stageNormal bundle (which
  // ships only in the base pack; the build's cross-pack bake resolves it).
  if (typeof layoutRef.bundleKey !== 'string' || typeof layoutRef.bundlePath !== 'string') return null;
  const chGroupMatch = /\/CH\/(stage|stageW|stageSpace|stageZ)$/.exec(layoutRef.bundleKey);
  if (!chGroupMatch) return null;
  const chGroup = chGroupMatch[1];
  const msd = chMainStageMsd(chGroup, stageEntry.basename || '');
  if (!msd || !Number.isFinite(msd.stageIndex)) return null;
  const bundleKey = layoutRef.bundleKey.replace(`/CH/${chGroup}`, '/CH/stageNormal');
  const bundlePath = layoutRef.bundlePath.replace(`__CH__${chGroup}.zip`, '__CH__stageNormal.zip');
  // The replacement must actually apply, else the bundleRef would point at the
  // layout (a wrong/nonexistent MSD) — bail rather than emit a bogus ref.
  if (bundleKey === layoutRef.bundleKey || bundlePath === layoutRef.bundlePath) return null;
  return {
    bundleRef: {
      bundleKey,
      bundlePath,
      internalPath: msd.internalPath,
      readMode: layoutRef.readMode || 'zip-text'
    },
    stageIndex: msd.stageIndex,
    debug: { family: `CH/${chGroup}`, internalPath: msd.internalPath, stageIndex: msd.stageIndex }
  };
}

// Read music ids baked onto the stage-index entry at build time
// (`scripts/build-bcu-stage-index.mjs`). Returns a usable descriptor or null.
//
// The build pre-resolves each stage's MapStageData music from the raw BCU CSVs
// and stores it on the entry, so the runtime never has to fetch the sibling
// MSD/stageNormal bundle a second time. That second fetch is the one fragile
// link in the live path: when it fails in the browser, the bare catch in
// resolveStageMusic falls back to the catalog default (id 0 = 000.m4a) even
// though the correct id (e.g. 西表島 = 4) is well-defined. Preferring the baked
// value removes that failure mode entirely.
export function musicFromBakedEntry(stageEntry, catalog) {
  const baked = stageEntry && typeof stageEntry === 'object' ? stageEntry.music : null;
  if (!baked || typeof baked !== 'object') return null;
  const startMusicId = catalog.normalizeId(baked.startMusicId);
  if (startMusicId == null) return null;
  const bossMusicId = catalog.normalizeId(baked.bossMusicId);
  const thresholdRaw = Number(baked.bossHpThresholdPercent);
  return {
    startMusicId,
    bossMusicId,
    bossHpThresholdPercent: Number.isFinite(thresholdRaw) ? thresholdRaw : 100,
    source: 'stage-index-baked',
    stageIndex: Number.isFinite(Number(baked.stageIndex)) ? Number(baked.stageIndex) : null
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
  // Prefer the music ids baked onto the stage-index entry at build time. This
  // is the in-memory entry the runtime already holds, so it needs no fetch and
  // cannot fall through to 000.m4a when a runtime MSD bundle read fails.
  const baked = musicFromBakedEntry(stageEntry, catalog);
  if (baked) return baked;
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
