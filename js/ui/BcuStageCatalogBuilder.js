import { mapColcKey, stageKey, stageMapKey, toInt } from '../bcu/BcuIdentifier.js';

export const STAGE_SELECTOR_CATEGORIES = [
  { id: 'main', label: '通常ステージ', description: '日本編など', collectionCodes: ['CH'] },
  { id: 'legend', label: 'レジェンド系ステージ', description: 'レジェンド・真レジェンド・レジェンド0', collectionCodes: ['N', 'A', 'ND'] },
  { id: 'event', label: 'イベントステージ', description: 'イベント、強襲、EXなど', collectionCodes: ['S', 'E', 'RA', 'T', 'V', 'M', 'H', 'Q', 'B'] },
  { id: 'collab', label: 'コラボステージ', description: 'コラボ、コラボ強襲など', collectionCodes: ['C', 'CA'] },
  { id: 'special', label: '特殊ステージ', description: '道場、迷宮、検定、その他', collectionCodes: ['R', 'L', 'SR', 'G', 'D', 'DM'] },
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
  D: '特殊ステージ',
  DM: '月間・曜日ステージ',
};

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
    if (hit?.source === 'lang' && hit.value && hit.value !== key) return { value: hit.value, file: hit.file || null };
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

function parseStageAddress(stage, collectionCode) {
  const rawId = stage?.stageId || stage?.semanticEntry?.stageId || stage?.basename || stage?.semanticEntry?.basename || stage?.stageKey || '';
  const match = String(rawId).match(/^stage([A-Za-z]+)(-?\d+)_(-?\d+)/i);
  if (!match) {
    return {
      prefix: '',
      mapNo: null,
      mapNoRaw: 'unknown',
      stageNo: null,
      stageNoRaw: String(rawId || 'unknown'),
      rawId,
      collectionCode,
    };
  }
  return {
    prefix: match[1].toUpperCase(),
    mapNo: toInt(match[2], null),
    mapNoRaw: match[2],
    stageNo: toInt(match[3], null),
    stageNoRaw: match[3],
    rawId,
    collectionCode,
  };
}

function stageIdentity(stage) {
  return stage?.stageKey || stage?.stageId || stage?.semanticEntry?.stageId || stage?.basename || '';
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

function mapLabel(db, mapColcId, mapNo, fallback) {
  const resolved = Number.isFinite(mapColcId) && Number.isFinite(mapNo)
    ? resolveName(db, 'stageMap', stageMapKey(mapColcId, mapNo))
    : null;
  return resolved?.value || fallback || `マップ ${Number.isFinite(mapNo) ? mapNo : ''}`.trim();
}

function stageLabel(db, mapColcId, mapNo, stageNo, fallback) {
  const resolved = Number.isFinite(mapColcId) && Number.isFinite(mapNo) && Number.isFinite(stageNo)
    ? resolveName(db, 'stage', stageKey(mapColcId, mapNo, stageNo))
    : null;
  return resolved?.value || fallback || `ステージ ${Number.isFinite(stageNo) ? stageNo : ''}`.trim();
}

function sortByCollectionThenMap(a, b) {
  const collection = (COLLECTION_ORDER.get(a.collectionCode) ?? 9999) - (COLLECTION_ORDER.get(b.collectionCode) ?? 9999);
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

export function buildBcuStageCatalog(stages = [], { bcuDb = null } = {}) {
  const categories = STAGE_SELECTOR_CATEGORIES.map((category) => ({ ...category, maps: [], mapCount: 0, stageCount: 0 }));
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const mapsByKey = new Map();
  const stageById = new Map();

  for (const stage of stages || []) {
    const id = stageIdentity(stage);
    if (!id) continue;
    const collectionCode = collectionCodeOf(stage);
    const mapColcId = MAP_COLC_ID_BY_CODE[collectionCode] ?? null;
    const categoryId = CATEGORY_BY_COLLECTION.get(collectionCode) || 'special';
    const category = categoryById.get(categoryId) || categoryById.get('special');
    const address = parseStageAddress(stage, collectionCode);
    const mapNoKey = Number.isFinite(address.mapNo) ? String(address.mapNo) : address.mapNoRaw;
    const mapKey = `${collectionCode}:${mapNoKey}`;
    let map = mapsByKey.get(mapKey);
    if (!map) {
      const label = mapLabel(bcuDb, mapColcId, address.mapNo, Number.isFinite(address.mapNo) ? `マップ ${address.mapNo}` : '未分類マップ');
      map = {
        key: mapKey,
        categoryId: category.id,
        collectionCode,
        collectionLabel: collectionLabel(bcuDb, collectionCode, mapColcId),
        mapColcId,
        mapNo: address.mapNo,
        mapNoRaw: address.mapNoRaw,
        label,
        stages: [],
        stageCount: 0,
      };
      mapsByKey.set(mapKey, map);
      category.maps.push(map);
    }

    const stageNoKey = Number.isFinite(address.stageNo) ? String(address.stageNo) : address.stageNoRaw;
    const dedupeKey = `${mapKey}:${address.rawId || stageNoKey}`;
    const existing = map.__stageByKey?.get(dedupeKey);
    const label = stageLabel(bcuDb, mapColcId, address.mapNo, address.stageNo, stage?.label || address.rawId || id);
    const item = {
      key: id,
      id,
      label,
      stage,
      mapKey,
      categoryId: category.id,
      collectionCode,
      collectionLabel: map.collectionLabel,
      mapLabel: map.label,
      mapNo: address.mapNo,
      mapNoRaw: address.mapNoRaw,
      stageNo: address.stageNo,
      stageNoRaw: address.stageNoRaw,
      rawId: address.rawId,
    };
    if (!map.__stageByKey) map.__stageByKey = new Map();
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
