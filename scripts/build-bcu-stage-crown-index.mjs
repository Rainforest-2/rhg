// Build the stage-crown (星/冠) magnification index from each pack's Map_option.csv.
//
// BCU fact (util/stage/MapColc.java): the per-map crown system lives in Map_option.csv. Each row is
// one StageMap; `星解放` is the number of released crowns (1..4) and `星1倍率`..`星4倍率` are the
// enemy stat magnification percentages for crown levels ★1..★4 (★1 is always 100). EStage.java then
// applies it at battle time:  mul = st.getCont().stars[star] * 0.01f  (scales enemy HP & ATK).
//
// The bundled Map_option.csv uses the labelled JP header format (older than the BCU-reference column
// layout), and several variants insert extra columns (e.g. `裏星解放`, `XP2倍広告`). So columns are
// resolved BY HEADER NAME, never by fixed index.
//
// Output: public/assets/generated/bcu-stage-crown-index.json
//   entries: [{ packId, mapId, crownCount, stars:[100,...], backCrownCount, name }]
//   byKey:   { "<packId>:<mapId>": entry }
import { readdirSync, readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const BCU_ROOT = 'public/assets/bcu';
const OUT_PATH = 'public/assets/generated/bcu-stage-crown-index.json';

const STAR_RATE_HEADERS = ['星1倍率', '星2倍率', '星3倍率', '星4倍率'];

function splitCsvLine(line) {
  return line.split(',').map((s) => s.trim());
}

function parseMapOption(text, packId) {
  const lines = String(text || '').replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length < 2) return [];
  const header = splitCsvLine(lines[0]);
  const col = (name) => header.indexOf(name);
  const crownCol = col('星解放');
  const backCrownCol = col('裏星解放'); // may be -1
  const nameCol = col('マップ名');
  const starCols = STAR_RATE_HEADERS.map((h) => col(h));
  if (crownCol < 0 || starCols.some((c) => c < 0)) return [];

  const out = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cells = splitCsvLine(lines[i]);
    const mapId = Number.parseInt(cells[0], 10);
    if (!Number.isInteger(mapId)) continue;
    const crownCount = Math.max(1, Math.min(4, Number.parseInt(cells[crownCol], 10) || 1));
    const allRates = starCols.map((c) => {
      const v = Number.parseInt(cells[c], 10);
      return Number.isFinite(v) ? v : 100;
    });
    // BCU StageMap.stars: the first `crownCount` magnifications; star 0 (★1) is always 100.
    const stars = allRates.slice(0, crownCount);
    if (stars.length === 0) stars.push(100);
    stars[0] = 100;
    const backCrownCount = backCrownCol >= 0 ? (Number.parseInt(cells[backCrownCol], 10) || 0) : 0;
    out.push({
      packId,
      mapId,
      crownCount: stars.length,
      stars,
      backCrownCount,
      name: nameCol >= 0 ? (cells[nameCol] || '') : ''
    });
  }
  return out;
}

function main() {
  let packsScanned = 0;
  let rawMultiCrown = 0;
  if (!existsSync(BCU_ROOT)) {
    throw new Error(`missing ${BCU_ROOT}`);
  }
  // The 58 pack directories are cumulative version snapshots, so the same logical map repeats across
  // them. Dedup by content (mapId + crownCount + stars + name) keeping the newest (lexically highest)
  // pack id. Only maps with >= 2 crowns are emitted: a map absent from this index has a single crown
  // and is treated as ★1 only ("難易度が一つしかないステージは基本星1とみなす").
  const deduped = new Map();
  for (const pack of readdirSync(BCU_ROOT)) {
    const optPath = path.join(BCU_ROOT, pack, 'org', 'data', 'Map_option.csv');
    if (!existsSync(optPath)) continue;
    packsScanned += 1;
    for (const row of parseMapOption(readFileSync(optPath, 'utf8'), pack)) {
      if (row.crownCount < 2) continue;
      rawMultiCrown += 1;
      const contentKey = `${row.mapId}|${row.crownCount}|${row.stars.join('-')}|${row.name}`;
      const prev = deduped.get(contentKey);
      if (!prev || row.packId > prev.packId) deduped.set(contentKey, row);
    }
  }
  const entries = [...deduped.values()].sort((a, b) => (a.name === b.name ? a.mapId - b.mapId : a.name < b.name ? -1 : 1));

  // byName groups every multi-crown map sharing a display name to its max crown count + representative
  // stars, so a UI keyed on the map label (as the difficulty patch is) can resolve crown tabs directly.
  const byName = {};
  for (const e of entries) {
    if (!e.name) continue;
    const cur = byName[e.name];
    if (!cur || e.crownCount > cur.crownCount) byName[e.name] = { crownCount: e.crownCount, stars: e.stars, mapId: e.mapId, packId: e.packId };
  }
  const byKey = {};
  for (const e of entries) byKey[`${e.packId}:${e.mapId}`] = e;

  const index = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    source: 'public/assets/bcu/<pack>/org/data/Map_option.csv (星解放 / 星N倍率, parsed by header)',
    bcuReference: 'MapColc.java Map_option.csv stars; EStage.java mul = stars[star]*0.01',
    note: 'Only maps with crownCount >= 2 are listed; any map not present is single-crown (★1 only).',
    defaultStars: [100, 150, 200, 300],
    packsScanned,
    count: entries.length,
    entries,
    byKey,
    byName
  };
  mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, `${JSON.stringify(index, null, 1)}\n`);
  console.log(`wrote ${OUT_PATH}: packs=${packsScanned} rawMultiCrownRows=${rawMultiCrown} dedupedMaps=${entries.length} names=${Object.keys(byName).length}`);
}

main();
