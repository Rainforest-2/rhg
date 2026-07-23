// Build the stage-crown (星/冠) magnification index from each pack's Map_option.csv.
//
// BCU fact (util/stage/MapColc.java): the per-map crown system lives in Map_option.csv. Each row is
// one StageMap; `星解放` is the number of released crowns (1..4) and `星1倍率`..`星4倍率` are the
// enemy stat magnification percentages for crown levels ★1..★4 (★1 is always 100). EStage.java then
// applies it at battle time: mul = st.getCont().stars[star] * 0.01f.
//
// Output preserves every exact packId+mapId identity. Name indexes contain candidate arrays and an
// ambiguity flag; they never collapse conflicting maps to the largest crown count.
import { readdirSync, readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const BCU_ROOT = 'public/assets/bcu';
const OUT_PATH = 'public/assets/generated/bcu-stage-crown-index.json';
const STAR_RATE_HEADERS = ['星1倍率', '星2倍率', '星3倍率', '星4倍率'];

function splitCsvLine(line) {
  return line.split(',').map((s) => s.trim());
}

function normalizeName(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/^(?:レジェンドステージ|真レジェンドステージ|レジェンドストーリー0|日本編|未来編|宇宙編)\s*[：:]\s*/u, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function signature(entry) {
  return `${entry.crownCount}:${entry.stars.join(',')}`;
}

function parseMapOption(text, packId) {
  const lines = String(text || '').replace(/^﻿/, '').split(/\r?\n/).filter((line) => line.trim() !== '');
  if (lines.length < 2) return [];
  const header = splitCsvLine(lines[0]);
  const col = (name) => header.indexOf(name);
  const crownCol = col('星解放');
  const backCrownCol = col('裏星解放');
  const nameCol = col('マップ名');
  const starCols = STAR_RATE_HEADERS.map((name) => col(name));
  if (crownCol < 0 || starCols.some((index) => index < 0)) return [];

  const out = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cells = splitCsvLine(lines[i]);
    const mapId = Number.parseInt(cells[0], 10);
    if (!Number.isInteger(mapId)) continue;
    const crownCount = Math.max(1, Math.min(4, Number.parseInt(cells[crownCol], 10) || 1));
    const allRates = starCols.map((index) => {
      const value = Number.parseInt(cells[index], 10);
      return Number.isFinite(value) ? value : 100;
    });
    const stars = allRates.slice(0, crownCount);
    if (stars.length === 0) stars.push(100);
    stars[0] = 100;
    const backCrownCount = backCrownCol >= 0 ? (Number.parseInt(cells[backCrownCol], 10) || 0) : 0;
    const name = nameCol >= 0 ? (cells[nameCol] || '') : '';
    out.push({
      packId,
      mapId,
      crownCount: stars.length,
      stars,
      backCrownCount,
      name,
      normalizedName: normalizeName(name)
    });
  }
  return out;
}

function groupEntries(entries, keyOf) {
  const groups = {};
  for (const entry of entries) {
    const key = keyOf(entry);
    if (key == null || key === '') continue;
    if (!groups[key]) groups[key] = [];
    groups[key].push(entry);
  }
  return Object.fromEntries(Object.entries(groups).map(([key, candidates]) => {
    const sorted = [...candidates].sort((a, b) => String(a.packId).localeCompare(String(b.packId)) || a.mapId - b.mapId);
    const signatures = [...new Set(sorted.map(signature))];
    return [key, {
      entries: sorted,
      candidateCount: sorted.length,
      signatures,
      ambiguous: signatures.length > 1
    }];
  }));
}

function main() {
  let packsScanned = 0;
  let rawMultiCrown = 0;
  if (!existsSync(BCU_ROOT)) throw new Error(`missing ${BCU_ROOT}`);

  // Preserve every packId:mapId identity. Asset packs may be cumulative snapshots,
  // but exact lookup must remain possible for any stage option that names an older
  // pack. Deduplicate only duplicate rows inside the same exact identity.
  const byExactIdentity = new Map();
  for (const pack of readdirSync(BCU_ROOT).sort()) {
    const optPath = path.join(BCU_ROOT, pack, 'org', 'data', 'Map_option.csv');
    if (!existsSync(optPath)) continue;
    packsScanned += 1;
    for (const row of parseMapOption(readFileSync(optPath, 'utf8'), pack)) {
      if (row.crownCount < 2) continue;
      rawMultiCrown += 1;
      byExactIdentity.set(`${row.packId}:${row.mapId}`, row);
    }
  }

  const entries = [...byExactIdentity.values()].sort((a, b) =>
    String(a.packId).localeCompare(String(b.packId))
      || a.mapId - b.mapId
      || String(a.name).localeCompare(String(b.name)));
  const byKey = Object.fromEntries(entries.map((entry) => [`${entry.packId}:${entry.mapId}`, entry]));
  const byMapId = groupEntries(entries, (entry) => String(entry.mapId));
  const byName = groupEntries(entries, (entry) => entry.name);
  const byNormalizedName = groupEntries(entries, (entry) => entry.normalizedName);
  const ambiguousNameCount = Object.values(byName).filter((group) => group.ambiguous).length;
  const ambiguousMapIdCount = Object.values(byMapId).filter((group) => group.ambiguous).length;

  const index = {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    source: 'public/assets/bcu/<pack>/org/data/Map_option.csv (星解放 / 星N倍率, parsed by header)',
    bcuReference: 'MapColc.java Map_option.csv stars; EStage.java mul = stars[star]*0.01',
    note: 'Every crownCount >= 2 packId:mapId is retained. Exact identity wins; ambiguous fallback resolves to ★1.',
    defaultStars: [100, 150, 200, 300],
    packsScanned,
    count: entries.length,
    ambiguousNameCount,
    ambiguousMapIdCount,
    entries,
    byKey,
    byMapId,
    byName,
    byNormalizedName
  };
  mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, `${JSON.stringify(index, null, 1)}\n`);
  console.log(`wrote ${OUT_PATH}: packs=${packsScanned} rawRows=${rawMultiCrown} exactIdentities=${entries.length} ambiguousNames=${ambiguousNameCount} ambiguousMapIds=${ambiguousMapIdCount}`);
}

main();
