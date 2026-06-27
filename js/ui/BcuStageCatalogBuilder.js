import { mapColcKey, stageKey, stageMapKey, toInt } from '../bcu/BcuIdentifier.js';

export const STAGE_SELECTOR_CATEGORIES = [
  { id: 'main', label: '通常ステージ', description: '日本編など', collectionCodes: ['CH'] },
  { id: 'legend', label: 'レジェンド系ステージ', description: 'レジェンド・真レジェンド・レジェンド0', collectionCodes: ['N', 'A', 'ND'] },
  { id: 'event', label: 'イベントステージ', description: 'イベント、強襲、EXなど', collectionCodes: ['S', 'E', 'RA', 'T', 'V', 'M', 'H', 'Q', 'B'] },
  { id: 'collab', label: 'コラボステージ', description: 'コラボ、コラボ強襲など', collectionCodes: ['C', 'CA'] },
  { id: 'special', label: '特殊ステージ', description: '道場、迷宮、検定、その他', collectionCodes: ['R', 'L', 'SR', 'G', 'DM'] },
];

export const MAP_COLC_ID_BY_CODE = {
  E: 4,
  N: 0,
  S: 1,
  C: 2,
  CH: 3,
  T: 6,
  V: 7,
  R: 11,
  M: 12,
  A: 13,
  B: 14,
  RA: 24,
  H: 25,
  CA: 27,
  Q: 31,
  L: 33,
  ND: 34,
  SR: 36,
  G: 37,
};

const COLLECTION_LABEL_FALLBACKS = {
  CH: '日本編',
  N: 'レジェンドストーリー',
  A: '真レジェンドステージ',
  ND: 'レジェンドストーリー0',
  S: 'イベントステージ',
  C: 'コラボステージ',
  E: 'EXステージ',
  RA: '強襲ステージ',
  CA: 'コラボ強襲ステージ',
  R: 'ネコ道場ランキング',
  L: '地底迷宮',
  SR: 'コロシアムステージ',
  G: 'にゃんこ道検定',
  DM: '月間・曜日ステージ',
};

const BCU_NON_MAPCOLC_COLLECTION_CODES = new Set(['D']);

const CATEGORY_BY_COLLECTION = new Map(
  STAGE_SELECTOR_CATEGORIES.flatMap((category) => category.collectionCodes.map((code) => [code, category.id]))
);
const CATEGORY_ORDER = new Map(STAGE_SELECTOR_CATEGORIES.map((category, index) => [category.id, index]));
const COLLECTION_ORDER = new Map(
  STAGE_SELECTOR_CATEGORIES.flatMap((category) => category.collectionCodes.map((code, index) => [code, CATEGORY_ORDER.get(category.id) * 100 + index]))
);

function resolveName(db, kind, key) {
  if (!db?.names || !key) return null;
  try {
    const hit = db.names.resolve(kind, key, db.locale || 'jp');
    if (hit?.source === 'lang' && hit.value && hit.value !== key) return { value: hit.value, file: hit.file || null, key };
  } catch {}
  return null;
}

function normalizeCollectionCode(value) {
  return String(value || '').trim().toUpperCase();
}

function collectionCodeOf(stage) {
  const direct = stage?.semanticEntry?.category || stage?.category;
  if (direct) return normalizeCollectionCode(direct);
  const mapPath = stage?.mapPath || stage?.semanticEntry?.mapPath || '';
  const first = String(mapPath).split('/').filter(Boolean)[0];
  if (first) return normalizeCollectionCode(first);
  const bundlePath = stage?.bundleRef?.bundlePath || stage?.semanticEntry?.bundleRef?.bundlePath || '';
  const parts = String(bundlePath).split('/');
  const stageIndex = parts.lastIndexOf('stage');
  if (stageIndex >= 0 && parts[stageIndex + 1]) return normalizeCollectionCode(parts[stageIndex + 1]);
  return 'UNKNOWN';
}

function stripCsv(value) {
  return String(value || '').replace(/\.csv$/i, '');
}

function basenameOf(stage) {
  return stripCsv(stage?.stageId || stage?.basename || stage?.semanticEntry?.basename || stage?.semanticEntry?.stageId || stage?.key || '');
}

function groupOf(stage) {
  return String(stage?.groupDir || stage?.semanticEntry?.groupDir || '');
}

function numericAddressFromRecord(stage) {
  const mapColcId = toInt(stage?.mapColcId ?? stage?.numericAddress?.mapColcId, null);
  const mapId = toInt(stage?.mapId ?? stage?.numericAddress?.mapId, null);
  const stageNo = toInt(stage?.stageNo ?? stage?.numericAddress?.stageNo, null);
  if ([mapColcId, mapId, stageNo].every(Number.isFinite)) {
    return {
      mapColcId,
      mapId,
      mapNo: mapId,
      mapNoRaw: String(mapId).padStart(3, '0'),
      stageNo,
      stageNoRaw: String(stageNo).padStart(2, '0'),
      prefix: '',
      rawId: basenameOf(stage),
      source: 'core-db-numeric-stage-address'
    };
  }
  return null;
}

function normalAddress(stage, collectionCode) {
  const mapColcId = MAP_COLC_ID_BY_CODE[collectionCode];
  if (!Number.isInteger(mapColcId)) return null;
  const rawId = basenameOf(stage);
  const match = rawId.match(/^stage([A-Za-z]+)(-?\d+)_(-?\d+)/i);
  if (!match) return null;
  const mapNo = toInt(match[2], null);
  const stageNo = toInt(match[3], null);
  if (!Number.isFinite(mapNo) || !Number.isFinite(stageNo)) return null;
  return {
    prefix: match[1].toUpperCase(),
    mapColcId,
    mapId: mapNo,
    mapNo,
    mapNoRaw: match[2],
    stageNo,
    stageNoRaw: match[3],
    rawId,
    source: `BCU collection ${collectionCode}`
  };
}

function chapterAddress(stage) {
  const collectionCode = collectionCodeOf(stage);
  if (collectionCode !== 'CH') return null;
  const g = groupOf(stage);
  const rawId = basenameOf(stage);
  let m;
  if (g === 'stageZ') {
    m = rawId.match(/^stageZ(\d{2})_(\d{2})$/i);
    if (!m) return null;
    const id0 = Number(m[1]);
    const id1 = Number(m[2]);
    const mapId = id0 < 3 ? id0 : ({ 4: 10, 5: 12, 6: 13, 7: 15, 8: 16, 9: 17 })[id0];
    return Number.isInteger(mapId)
      ? { mapColcId: 3, mapId, mapNo: mapId, mapNoRaw: String(mapId), stageNo: id1, stageNoRaw: m[2], prefix: 'Z', rawId, source: 'BCU CH stageZ' }
      : null;
  }
  if (g === 'stageW') {
    m = rawId.match(/^stageW(\d{2})_(\d{2})$/i);
    if (!m) return null;
    const mapId = Number(m[1]) - 1;
    const stageNo = Number(m[2]);
    return Number.isInteger(mapId) && Number.isInteger(stageNo)
      ? { mapColcId: 3, mapId, mapNo: mapId, mapNoRaw: String(mapId), stageNo, stageNoRaw: m[2], prefix: 'W', rawId, source: 'BCU CH stageW' }
      : null;
  }
  if (g === 'stageSpace') {
    if (rawId === 'stageSpace09_Invasion_00') return { mapColcId: 3, mapId: 11, mapNo: 11, mapNoRaw: '11', stageNo: 0, stageNoRaw: '00', prefix: 'SPACE', rawId, source: 'BCU CH space special' };
    if (rawId === 'stageSpace09_Invasion_Z_00') return { mapColcId: 3, mapId: 18, mapNo: 18, mapNoRaw: '18', stageNo: 0, stageNoRaw: '00', prefix: 'SPACE', rawId, source: 'BCU CH space special zombie' };
    m = rawId.match(/^stageSpace(\d{2})_(\d{2})$/i);
    if (!m) return null;
    const mapId = Number(m[1]) - 1;
    const stageNo = Number(m[2]);
    return Number.isInteger(mapId) && Number.isInteger(stageNo)
      ? { mapColcId: 3, mapId, mapNo: mapId, mapNoRaw: String(mapId), stageNo, stageNoRaw: m[2], prefix: 'SPACE', rawId, source: 'BCU CH stageSpace' }
      : null;
  }
  if (g === 'stage') {
    m = rawId.match(/^stage(\d{2})$/i);
    if (!m) return null;
    // 日本編/EoC is split into its 3 real BCU chapters (Map_option 3000/3001/3002 = mapColc 3,
    // mapId 0/1/2). The chapters share the same prefecture stage CSVs (stage00-46 = 長崎県…沖縄県,
    // jp-StageName 003-<chapter>-<stageNo>), so a chapter variant is attached to each clone in
    // expandEocChapters() before the build loop. Without that hint (defensive) fall back to the
    // legacy single aggregate map (mapId 9).
    const ch = stage?.__eocChapter;
    if (ch && Number.isInteger(ch.mapId) && Number.isInteger(ch.stageNo)) {
      return { mapColcId: 3, mapId: ch.mapId, mapNo: ch.mapId, mapNoRaw: String(ch.mapId), stageNo: ch.stageNo, stageNoRaw: String(ch.stageNo).padStart(2, '0'), prefix: 'STAGE', rawId, source: EOC_CHAPTER_ADDRESS_SOURCE };
    }
    return { mapColcId: 3, mapId: 9, mapNo: 9, mapNoRaw: '9', stageNo: Number(m[1]), stageNoRaw: m[1], prefix: 'STAGE', rawId, source: 'BCU CH stage' };
  }
  return null;
}

// 日本編/EoC chapter split (verified against BCU jp-StageName.txt + Map_option.csv):
//   - stage00-46 = the 47 prefecture stages (長崎県…沖縄県); every chapter replays the same CSVs,
//     so each is fanned out into all 3 chapters as 003-<chapter>-<stageNo>.
//   - stage47/49/50 = 西表島 第1/2/3章 -> each is that chapter's finale at stageNo 47
//     (003-000-047 / 003-001-047 / 003-002-047 all resolve to 西表島).
//   - stage48 (チャレンジバトル) / stage51 (ケリ姫降臨！) / stage52 are NOT part of the 3 chapters;
//     they stay on the legacy aggregate map (mapId 9) so nothing is lost.
const EOC_CHAPTER_ADDRESS_SOURCE = 'BCU CH stage chapter-split';
const EOC_PREFECTURE_MAX_STAGE_NO = 46;
const EOC_FINALE_CHAPTER_BY_STAGE = { 47: 0, 49: 1, 50: 2 };
const EOC_LEFTOVER_MAP_ID = 9;

function eocStageNumber(stage) {
  if (collectionCodeOf(stage) !== 'CH' || groupOf(stage) !== 'stage') return null;
  const m = basenameOf(stage).match(/^stage(\d{2})$/i);
  return m ? Number(m[1]) : null;
}

// Expand each EoC `CH/stage/stageNN.csv` record into its chapter variant(s). Non-EoC stages and any
// stageNN that does not match the chapter rules pass through unchanged (single element).
function expandEocChapters(stages) {
  const out = [];
  for (const stage of stages || []) {
    const num = eocStageNumber(stage);
    if (num === null) { out.push(stage); continue; }
    if (num <= EOC_PREFECTURE_MAX_STAGE_NO) {
      for (const mapId of [0, 1, 2]) out.push({ ...stage, __eocChapter: { mapId, stageNo: num } });
    } else if (num in EOC_FINALE_CHAPTER_BY_STAGE) {
      out.push({ ...stage, __eocChapter: { mapId: EOC_FINALE_CHAPTER_BY_STAGE[num], stageNo: 47 } });
    } else {
      out.push({ ...stage, __eocChapter: { mapId: EOC_LEFTOVER_MAP_ID, stageNo: num } });
    }
  }
  return out;
}

// Map_option.csv is authoritative for the chapter map names (3000/3001/3002 = 日本編第1章/2章/3章).
// The raw jp-StageName.txt map-name line for 003-000/001/002 carries an erroneous "ゾンビ" suffix,
// so override the resolved stageMap label for these split maps. Stage-level names (003-x-NN) are
// correct and keep resolving normally.
function eocChapterMapLabel(address) {
  if (address?.source !== EOC_CHAPTER_ADDRESS_SOURCE || address?.mapColcId !== 3) return null;
  if (address.mapId === 0) return '日本編 第1章';
  if (address.mapId === 1) return '日本編 第2章';
  if (address.mapId === 2) return '日本編 第3章';
  if (address.mapId === EOC_LEFTOVER_MAP_ID) return '日本編 その他';
  return null;
}

function dmAddress(stage) {
  if (collectionCodeOf(stage) !== 'DM' || groupOf(stage) !== 'StageDM') return null;
  const rawId = basenameOf(stage);
  const m = rawId.match(/^stageDM\d{3}_(\d{2})$/i);
  return m
    ? { mapColcId: 3, mapId: 14, mapNo: 14, mapNoRaw: '14', stageNo: Number(m[1]), stageNoRaw: m[1], prefix: 'DM', rawId, source: 'BCU DM StageDM' }
    : null;
}

function parseStageAddress(stage, collectionCode) {
  const parsed = numericAddressFromRecord(stage) || chapterAddress(stage) || dmAddress(stage) || normalAddress(stage, collectionCode);
  if (parsed) return { ...parsed, collectionCode };
  const rawId = basenameOf(stage) || stage?.stageKey || stage?.key || 'unknown';
  return {
    prefix: '',
    mapColcId: MAP_COLC_ID_BY_CODE[collectionCode] ?? null,
    mapId: null,
    mapNo: null,
    mapNoRaw: 'unknown',
    stageNo: null,
    stageNoRaw: rawId,
    rawId,
    collectionCode,
    source: 'unresolved-stage-address'
  };
}

function stageIdentity(stage) {
  return stage?.stageKey || stage?.key || stage?.stageId || stage?.semanticEntry?.stageId || stage?.basename || '';
}

function packRank(stage) {
  return String(stage?.packId || stage?.semanticEntry?.packId || '').padStart(12, '0');
}

function shouldReplaceStage(existing, candidate) {
  if (!existing) return true;
  return packRank(candidate.stage).localeCompare(packRank(existing.stage), 'ja', { numeric: true }) >= 0;
}

function collectionLabel(db, code, mapColcId) {
  const resolved = Number.isFinite(mapColcId) ? resolveName(db, 'mapColc', mapColcKey(mapColcId)) : null;
  return resolved?.value || COLLECTION_LABEL_FALLBACKS[code] || code || '未分類';
}

function mapLabelInfo(db, mapColcId, mapNo, fallback) {
  const resolved = Number.isFinite(mapColcId) && Number.isFinite(mapNo)
    ? resolveName(db, 'stageMap', stageMapKey(mapColcId, mapNo))
    : null;
  if (resolved?.value) return { value: normalizeStageDisplayLabel(resolved.value), source: 'lang', file: resolved.file || null, key: resolved.key || null };
  return { value: normalizeStageDisplayLabel(fallback || `マップ ${Number.isFinite(mapNo) ? mapNo : ''}`.trim()), source: 'fallback', file: null, key: null };
}

function stageLabelInfo(db, mapColcId, mapNo, stageNo, fallback) {
  const resolved = Number.isFinite(mapColcId) && Number.isFinite(mapNo) && Number.isFinite(stageNo)
    ? resolveName(db, 'stage', stageKey(mapColcId, mapNo, stageNo))
    : null;
  if (resolved?.value) return { value: normalizeStageDisplayLabel(resolved.value), source: 'lang', file: resolved.file || null, key: resolved.key || null };
  return { value: normalizeStageDisplayLabel(fallback || `ステージ ${Number.isFinite(stageNo) ? stageNo : ''}`.trim()), source: 'fallback', file: null, key: null };
}

function normalizeNameKey(value) {
  return String(value || '').normalize('NFKC').replace(/\s+/g, ' ').trim();
}

export function normalizeStageDisplayLabel(value) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return text;
  const spaced = text.match(/^(.{4,}?)(?:\s+\1)+$/u);
  if (spaced?.[1]) return spaced[1].trim();
  const delimited = text.match(/^(.{2,}?)(?:\s*(?:[-－ー/／|｜:：])\s*\1)+$/u);
  if (delimited?.[1]) return delimited[1].trim();
  const chars = Array.from(text);
  for (let len = 4; len <= Math.floor(chars.length / 2); len += 1) {
    if (chars.length % len !== 0) continue;
    const unit = chars.slice(0, len).join('');
    if (unit.repeat(chars.length / len) === text) return unit;
  }
  return text;
}

function sortByCollectionThenMap(a, b) {
  const category = (CATEGORY_ORDER.get(a.categoryId) ?? 9999) - (CATEGORY_ORDER.get(b.categoryId) ?? 9999);
  if (category) return category;
  const collection = Math.min(...(a.collectionCodes || [a.collectionCode]).map((code) => COLLECTION_ORDER.get(code) ?? 9999))
    - Math.min(...(b.collectionCodes || [b.collectionCode]).map((code) => COLLECTION_ORDER.get(code) ?? 9999));
  if (collection) return collection;
  const map = String(a.mapNoRaw).localeCompare(String(b.mapNoRaw), 'ja', { numeric: true });
  if (map) return map;
  return a.label.localeCompare(b.label, 'ja', { numeric: true });
}

function sortStage(a, b) {
  const stageNo = String(a.stageNoRaw).localeCompare(String(b.stageNoRaw), 'ja', { numeric: true });
  if (stageNo) return stageNo;
  return a.label.localeCompare(b.label, 'ja', { numeric: true });
}

function appendUnique(list, value) {
  if (!value || list.includes(value)) return;
  list.push(value);
}

function rawMapKey(collectionCode, address) {
  const mapNoKey = Number.isFinite(address.mapNo) ? String(address.mapNo) : address.mapNoRaw;
  return `${collectionCode}:${mapNoKey}`;
}

function mapDedupeKey(categoryId, collectionCode, address, labelInfo) {
  const labelKey = labelInfo.source === 'lang' ? normalizeNameKey(labelInfo.value) : '';
  if (labelKey) return `${categoryId}:map-name:${labelKey}`;
  return `${categoryId}:${rawMapKey(collectionCode, address)}`;
}

function stageDedupeKey({ categoryId, mapKey, address, labelInfo, id }) {
  const labelKey = labelInfo.source === 'lang' ? normalizeNameKey(labelInfo.value) : '';
  if (categoryId === 'collab' && labelKey) return `${mapKey}:stage-name:${labelKey}`;
  const stageNoKey = Number.isFinite(address.stageNo) ? String(address.stageNo) : address.stageNoRaw;
  return `${mapKey}:${address.rawId || stageNoKey || id}`;
}

export function buildBcuStageCatalog(stages = [], { bcuDb = null } = {}) {
  const categories = STAGE_SELECTOR_CATEGORIES.map((category) => ({ ...category, maps: [], mapCount: 0, stageCount: 0 }));
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const mapsByKey = new Map();
  const stageById = new Map();

  for (const stage of expandEocChapters(stages)) {
    const id = stageIdentity(stage);
    if (!id) continue;
    const collectionCode = collectionCodeOf(stage);
    if (BCU_NON_MAPCOLC_COLLECTION_CODES.has(collectionCode)) continue;
    const categoryId = CATEGORY_BY_COLLECTION.get(collectionCode) || 'special';
    const category = categoryById.get(categoryId) || categoryById.get('special');
    const address = parseStageAddress(stage, collectionCode);
    const mapColcId = address.mapColcId;
    const eocLabel = eocChapterMapLabel(address);
    const mapInfo = eocLabel
      ? { value: normalizeStageDisplayLabel(eocLabel), source: 'bcu-map-option-eoc-chapter', file: null, key: null }
      : mapLabelInfo(bcuDb, mapColcId, address.mapNo, Number.isFinite(address.mapNo) ? `マップ ${address.mapNo}` : '未分類マップ');
    const mapKey = mapDedupeKey(category.id, collectionCode, address, mapInfo);
    const rawKey = rawMapKey(collectionCode, address);
    let map = mapsByKey.get(mapKey);
    if (!map) {
      const collection = collectionLabel(bcuDb, collectionCode, mapColcId);
      map = {
        key: mapKey,
        aliasKeys: [rawKey],
        categoryId: category.id,
        collectionCode,
        collectionCodes: [collectionCode],
        collectionLabel: collection,
        collectionLabels: [collection],
        mapColcId,
        mapNo: address.mapNo,
        mapNoRaw: address.mapNoRaw,
        label: mapInfo.value,
        labelSource: mapInfo.source,
        labelFile: mapInfo.file,
        stages: [],
        stageCount: 0,
        mergedMapCount: 1,
      };
      mapsByKey.set(mapKey, map);
      mapsByKey.set(rawKey, map);
      category.maps.push(map);
    } else {
      appendUnique(map.aliasKeys, rawKey);
      mapsByKey.set(rawKey, map);
      appendUnique(map.collectionCodes, collectionCode);
      appendUnique(map.collectionLabels, collectionLabel(bcuDb, collectionCode, mapColcId));
      map.mergedMapCount = Math.max(1, Number(map.mergedMapCount) || 1) + 1;
    }

    const stageInfo = stageLabelInfo(bcuDb, mapColcId, address.mapNo, address.stageNo, stage?.name?.value || stage?.label || address.rawId || id);
    const item = {
      key: id,
      id,
      label: stageInfo.value,
      labelSource: stageInfo.source,
      labelFile: stageInfo.file,
      labelKey: stageInfo.key,
      stage,
      mapKey,
      categoryId: category.id,
      collectionCode,
      collectionLabel: map.collectionLabel,
      collectionCodes: map.collectionCodes,
      collectionLabels: map.collectionLabels,
      mapLabel: map.label,
      mapNo: address.mapNo,
      mapNoRaw: address.mapNoRaw,
      mapColcId,
      stageNo: address.stageNo,
      stageNoRaw: address.stageNoRaw,
      rawId: address.rawId,
      addressSource: address.source,
      dedupePolicy: category.id === 'collab' && stageInfo.source === 'lang' ? 'collab-map-stage-name' : 'stage-identity'
    };
    if (!map.__stageByKey) map.__stageByKey = new Map();
    const dedupeKey = stageDedupeKey({ categoryId: category.id, mapKey, address, labelInfo: stageInfo, id });
    const existing = map.__stageByKey.get(dedupeKey);
    if (shouldReplaceStage(existing, item)) map.__stageByKey.set(dedupeKey, item);
  }

  for (const category of categories) {
    category.maps.sort(sortByCollectionThenMap);
    category.stageCount = 0;
    for (const map of category.maps) {
      map.stages = Array.from(map.__stageByKey?.values() || []).sort(sortStage);
      delete map.__stageByKey;
      map.stageCount = map.stages.length;
      category.stageCount += map.stageCount;
      for (const stage of map.stages) {
        stageById.set(stage.key, stage);
        if (stage.stage?.stageId) stageById.set(stage.stage.stageId, stage);
        if (stage.stage?.stageKey) stageById.set(stage.stage.stageKey, stage);
        if (stage.rawId) stageById.set(stage.rawId, stage);
      }
    }
    category.mapCount = category.maps.length;
  }

  return {
    categories,
    mapsByKey,
    stageById,
    getCategory(id) { return categoryById.get(id) || null; },
    getMap(key) { return mapsByKey.get(key) || null; },
    getStage(id) { return stageById.get(id) || null; },
  };
}
