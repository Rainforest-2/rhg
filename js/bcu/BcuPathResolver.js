import { pad2, pad3, toInt } from './BcuIdentifier.js';

export const ENEMY_CASTLE_GROUPS = Object.freeze(['rc', 'ec', 'wc', 'sc']);

export function normalizeManifestPath(path) {
  if (!path) return null;
  const s = String(path).replace(/\\/g, '/');
  return s.startsWith('./') ? s.slice(2) : s;
}

export function toFetchPath(path) {
  if (!path) return null;
  const s = normalizeManifestPath(path);
  if (typeof window !== 'undefined') {
    const assetRoot = String(globalThis.__RHG_ASSET_BASE__ || '/assets').replace(/\/$/, '');
    const normalized = s.replace(/^\/+/, '');
    if (normalized === 'public/assets' || normalized === 'assets') return assetRoot;
    if (normalized.startsWith('public/assets/')) return `${assetRoot}/${normalized.slice('public/assets/'.length)}`;
    if (normalized.startsWith('assets/')) return `${assetRoot}/${normalized.slice('assets/'.length)}`;
  }
  return s.startsWith('http') || s.startsWith('/') ? s : `./${s}`;
}

export function pickFirstExisting(files, candidates) {
  const set = files instanceof Set ? files : new Set(files || []);
  return candidates.map(normalizeManifestPath).find((p) => p && set.has(p)) || null;
}

export function resolveUnitAsset(files, unitId, form = 'f') {
  const id3 = pad3(unitId);
  const all = [...(files || [])];
  const imageHit = all.find((p) => p.endsWith(`/org/unit/${id3}/${form}/${id3}_${form}.png`))
    || all.find((p) => p.endsWith(`/org/unit/${id3}/${form}/uni${id3}_${form}00.png`));
  const base = imageHit ? imageHit.slice(0, imageHit.lastIndexOf('/') + 1) : `public/assets/bcu/000004/org/unit/${id3}/${form}/`;
  const candidates = {
    image: [`${base}${id3}_${form}.png`, `${base}uni${id3}_${form}00.png`],
    imgcut: [`${base}${id3}_${form}.imgcut`, `${base}uni${id3}_${form}00.imgcut`],
    model: [`${base}${id3}_${form}.mamodel`],
    animations: [0, 1, 2, 3].map((i) => `${base}${id3}_${form}${String(i).padStart(2, '0')}.maanim`)
  };
  return {
    id: `unit-${id3}-${form}`,
    kind: 'unit',
    baseDir: toFetchPath(base),
    imagePath: toFetchPath(pickFirstExisting(files, candidates.image)),
    imgcutPath: toFetchPath(pickFirstExisting(files, candidates.imgcut)),
    modelPath: toFetchPath(pickFirstExisting(files, candidates.model)),
    animationPaths: candidates.animations.map((p) => pickFirstExisting(files, [p])).filter(Boolean).map(toFetchPath),
    image: candidates.image.map((p) => p.slice(base.length)),
    imgcut: candidates.imgcut.map((p) => p.slice(base.length)),
    model: candidates.model.map((p) => p.slice(base.length)),
    animations: candidates.animations.map((p, i) => ({ id: `anim0${i}`, file: p.slice(base.length) })),
    candidates
  };
}

export function resolveEnemyAsset(files, enemyId) {
  const id3 = pad3(enemyId);
  const all = [...(files || [])];
  const foundBases = all
    .filter((p) => p.endsWith(`/org/enemy/${id3}/${id3}_e.png`))
    .map((p) => p.slice(0, p.lastIndexOf('/') + 1));
  const bases = [`public/assets/bcu/000002/org/enemy/${id3}/`, ...foundBases, `public/assets/bcu/000010/org/enemy/${id3}/`];
  for (const base of bases) {
    const candidates = {
      image: [`${base}${id3}_e.png`],
      imgcut: [`${base}${id3}_e.imgcut`],
      model: [`${base}${id3}_e.mamodel`],
      animations: [0, 1, 2, 3].map((i) => `${base}${id3}_e${String(i).padStart(2, '0')}.maanim`)
    };
    const imagePath = pickFirstExisting(files, candidates.image);
    if (!imagePath) continue;
    return {
      id: `enemy-${id3}`,
      kind: 'enemy',
      baseDir: toFetchPath(base),
      imagePath: toFetchPath(imagePath),
      imgcutPath: toFetchPath(pickFirstExisting(files, candidates.imgcut)),
      modelPath: toFetchPath(pickFirstExisting(files, candidates.model)),
      animationPaths: candidates.animations.map((p) => pickFirstExisting(files, [p])).filter(Boolean).map(toFetchPath),
      image: candidates.image.map((p) => p.slice(base.length)),
      imgcut: candidates.imgcut.map((p) => p.slice(base.length)),
      model: candidates.model.map((p) => p.slice(base.length)),
      animations: candidates.animations.map((p, i) => ({ id: `anim0${i}`, file: p.slice(base.length) })),
      candidates
    };
  }
  return null;
}

export function resolveBackgroundAsset(files, bgId, bgCsv = {}) {
  const imageId = Number.isFinite(Number(bgCsv.imageReferenceId)) ? Number(bgCsv.imageReferenceId) : toInt(bgId, 0);
  const imgcutId = Number(bgId) === 110 ? 1 : toInt(bgCsv.imgcutId, 1);
  const imageCandidates = [
    `public/assets/bcu/000001/org/img/bg/bg${pad3(imageId)}.png`,
    `public/assets/bcu/000001/org/img/bg/bg${pad3(bgId)}.png`
  ];
  const imgcutCandidates = [
    `public/assets/bcu/000001/org/battle/bg/bg${pad2(imgcutId)}.imgcut`,
    `public/assets/bcu/000001/org/battle/bg/bg${imgcutId}.imgcut`
  ];
  return {
    imagePath: toFetchPath(pickFirstExisting(files, imageCandidates)),
    imgcutPath: toFetchPath(pickFirstExisting(files, imgcutCandidates)),
    imageCandidates: imageCandidates.map(toFetchPath),
    imgcutCandidates: imgcutCandidates.map(toFetchPath)
  };
}

export function resolveEnemyCastleParts(castleId) {
  const requested = toInt(castleId, 0);
  const groupIndex = Math.floor(requested / 1000);
  const validGroupIndex = groupIndex >= 0 && groupIndex < ENEMY_CASTLE_GROUPS.length ? groupIndex : 0;
  const localCastleId = groupIndex === validGroupIndex ? requested - validGroupIndex * 1000 : 0;
  return {
    requested,
    numericId: validGroupIndex * 1000 + Math.max(0, localCastleId),
    groupIndex: validGroupIndex,
    groupName: ENEMY_CASTLE_GROUPS[validGroupIndex],
    localCastleId: Math.max(0, localCastleId),
    usedFallback: validGroupIndex !== groupIndex,
    fallbackReason: validGroupIndex !== groupIndex ? 'castle-group-out-of-range-fallback-rc' : null
  };
}

export function resolveEnemyCastleAsset(files, castleId) {
  const parts = resolveEnemyCastleParts(castleId);
  const base = `public/assets/bcu/000001/org/img/${parts.groupName}/`;
  const primary = `${base}${parts.groupName}${pad3(parts.localCastleId)}.png`;
  const candidates = [primary];
  for (const file of files || []) {
    if (String(file).includes(`/org/img/${parts.groupName}/${parts.groupName}${pad3(parts.localCastleId)}`) && String(file).endsWith('.png')) {
      candidates.push(file);
    }
  }
  const imagePath = pickFirstExisting(files, candidates);
  return {
    ...parts,
    imagePath: toFetchPath(imagePath || primary),
    imageCandidates: [...new Set(candidates)].map(toFetchPath),
    usesImgcut: false
  };
}
