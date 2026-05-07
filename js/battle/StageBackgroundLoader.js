async function fetchText(path) { const r = await fetch(path); if (!r.ok) throw new Error(`Failed to fetch ${path}: ${r.status}`); return await r.text(); }
async function loadImage(url) { return await new Promise((res, rej) => { const img = new Image(); img.onload = () => res(img); img.onerror = () => rej(new Error(`Image load failed: ${url}`)); img.src = url; }); }
function loadImageSafe(url) { return loadImage(url).catch(() => null); }
function normalizeBgId(bgId) { const n = Number(bgId); if (!Number.isFinite(n) || n < 0) return null; return Math.floor(n); }

export function resolveStageBackgroundAssetCandidates(bgId = 0, fallbackStage = {}) {
  const requestedBgId = bgId;
  const normalized = normalizeBgId(bgId);
  const resolvedBgId = normalized === null ? 0 : normalized;
  const bg3 = String(Math.max(0, resolvedBgId)).padStart(3, '0');
  const bg2 = String(Math.max(0, resolvedBgId)).padStart(2, '0');
  const imagePath = `./public/assets/bcu/000001/org/img/bg/bg${bg3}.png`;
  const imgcutPath = `./public/assets/bcu/000001/org/battle/bg/bg${bg2}.imgcut`;
  return {
    requestedBgId,
    resolvedBgId,
    usedFallback: normalized === null,
    fallbackReason: normalized === null ? 'bgId-invalid-fallback-0' : null,
    imagePath,
    imgcutPath,
    csvPath: fallbackStage.csvPath || './public/assets/bcu/000001/org/battle/bg/bg.csv',
    stageId: fallbackStage.id || 0,
    cropName: fallbackStage.cropName || '背景bg',
    candidateReport: { bg3, bg2, imageCandidates: [imagePath, fallbackStage.imagePath || null].filter(Boolean), imgcutCandidates: [imgcutPath, fallbackStage.imgcutPath || null].filter(Boolean) }
  };
}

function parseImgcut(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  const count = Number(lines[3] || 0);
  const parts = [];
  for (let i = 0; i < count; i++) {
    const cols = (lines[4 + i] || '').split(',');
    parts.push({ x: Number(cols[0] || 0), y: Number(cols[1] || 0), w: Number(cols[2] || 0), h: Number(cols[3] || 0), name: (cols[4] || '').trim() });
  }
  return { parts };
}

function parseRgb(cols, start) { return { r: Number(cols[start] || 0), g: Number(cols[start + 1] || 0), b: Number(cols[start + 2] || 0) }; }

function parseBgCsv(text, stageId) {
  const rows = text.replace(/^\uFEFF/, '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  for (const row of rows) {
    const cols = row.split(',');
    if (Number(cols[0]) !== stageId) continue;
    return {
      stageId,
      skyTop: parseRgb(cols, 1),
      skyBottom: parseRgb(cols, 4),
      groundTop: parseRgb(cols, 7),
      groundBottom: parseRgb(cols, 10),
      imgcutId: Number(cols[13] || 0),
      showUpper: Number(cols[14] || 0) !== 0
    };
  }
  return {
    stageId,
    skyTop: { r: 0, g: 0, b: 0 },
    skyBottom: { r: 0, g: 0, b: 0 },
    groundTop: { r: 0, g: 0, b: 0 },
    groundBottom: { r: 0, g: 0, b: 0 },
    imgcutId: 0,
    showUpper: false
  };
}

export class StageBackgroundLoader {
  constructor(log) { this.log = log || (() => {}); }
  async load(stage) {
    if (this.__test) {
      const bgResolved = resolveStageBackgroundAssetCandidates(stage?.bgId, stage || {});
      return { image: { width: 1024, height: 512, src: bgResolved.imagePath }, crop: { x: 0, y: 0, w: 512, h: 256, name: stage?.cropName || '背景bg' }, upperCrop: null, colors: { skyTop: { r: 0, g: 0, b: 0 }, skyBottom: { r: 0, g: 0, b: 0 }, groundTop: { r: 0, g: 0, b: 0 }, groundBottom: { r: 0, g: 0, b: 0 } }, source: { requestedBgId: bgResolved.requestedBgId, resolvedBgId: bgResolved.resolvedBgId, bgUsedFallback: bgResolved.usedFallback, bgFallbackReason: bgResolved.fallbackReason, imagePath: bgResolved.imagePath, imgcutPath: bgResolved.imgcutPath, csvPath: bgResolved.csvPath, stageId: stage?.id || 0, imgcutId: 0, showUpper: false, backgroundCsvKind: 'bcu-bg-csv' } };
    }
    const fallbackStage = stage || {};
    const bgResolved = resolveStageBackgroundAssetCandidates(stage?.bgId, fallbackStage);
    const bgImagePath = bgResolved.imagePath;
    const bgImgcutPath = bgResolved.imgcutPath;
    const imagePath = stage?.imagePath || bgImagePath;
    const imgcutPath = stage?.imgcutPath || bgImgcutPath;
    const csvPath = stage?.csvPath || bgResolved.csvPath;
    let image = null;
    let imgcutText = null;
    let bgFallbackReason = bgResolved.fallbackReason;
    image = await loadImageSafe(bgImagePath);
    if (image) {
      try { imgcutText = await fetchText(bgImgcutPath); } catch { imgcutText = null; }
    }
    if (!image || !imgcutText) {
      if (!bgFallbackReason) bgFallbackReason = 'bgid-asset-load-failed-fallback-stage-path';
      image = image || await loadImageSafe(imagePath);
      imgcutText = imgcutText || await fetchText(imgcutPath);
    }
    if (!image) throw new Error('No image for stage background');
    const csvText = await fetchText(csvPath);
    const bgRow = parseBgCsv(csvText, stage.id || 0);
    const { parts } = parseImgcut(imgcutText);
    if (!parts.length) throw new Error('No imgcut parts for stage background');
    let part = parts.find((p) => p.name === stage.cropName);
    if (!part) { this.log('warn', `stage background crop '${stage.cropName}' not found; fallback parts[0]`); part = parts[0]; }
    const upperPart = bgRow.showUpper ? parts.find((p) => p.name === '背景上部') : null;
    return {
      image,
      crop: { x: part.x, y: part.y, w: part.w, h: part.h, name: part.name || stage.cropName || 'part0', cropRole: 'BCU Background.BG part' },
      upperCrop: upperPart ? { x: upperPart.x, y: upperPart.y, w: upperPart.w, h: upperPart.h, name: upperPart.name, upperCropRole: 'BCU Background.TOP part if present' } : null,
      colors: { skyTop: bgRow.skyTop, skyBottom: bgRow.skyBottom, groundTop: bgRow.groundTop, groundBottom: bgRow.groundBottom },
      source: { requestedBgId: bgResolved.requestedBgId, resolvedBgId: bgResolved.resolvedBgId, bgUsedFallback: !!bgFallbackReason || !!bgResolved.usedFallback, bgFallbackReason: bgFallbackReason || null, imagePath: image.src || imagePath, imgcutPath: imgcutText === null ? null : (bgFallbackReason ? imgcutPath : bgImgcutPath), csvPath, stageId: stage.id || 0, imgcutId: bgRow.imgcutId, showUpper: bgRow.showUpper, backgroundCsvKind: 'bcu-bg-csv', candidateReport: bgResolved.candidateReport }
    };
  }
}
