async function fetchText(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`Failed to fetch ${path}: ${r.status}`);
  return await r.text();
}

async function fetchTextSafe(path) {
  try { return await fetchText(path); } catch { return null; }
}

async function loadImage(path) {
  return await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Image load failed: ${path}`));
    img.src = path;
  });
}

function normalizeBgId(bgId) {
  const n = Number(bgId);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}
function pad2(v) { return String(Math.max(0, Number(v) || 0)).padStart(2, '0'); }
function pad3(v) { return String(Math.max(0, Number(v) || 0)).padStart(3, '0'); }

export function resolveStageBackgroundAssetCandidates(bgId = 0, fallbackStage = {}) {
  const requestedBgId = bgId;
  const normalized = normalizeBgId(bgId);
  const resolvedBgId = normalized === null ? 0 : normalized;
  const bg3 = pad3(resolvedBgId);
  const bg2 = pad2(resolvedBgId);
  const imagePath = `./public/assets/bcu/000001/org/img/bg/bg${bg3}.png`;
  const imgcutPath = `./public/assets/bcu/000001/org/battle/bg/bg${bg2}.imgcut`;
  return {
    requestedBgId,
    resolvedBgId,
    usedFallback: normalized === null,
    fallbackReason: normalized === null ? 'bgId-invalid-fallback-0' : null,
    imagePath,
    imgcutPath,
    imageCandidates: [imagePath, fallbackStage.imagePath].filter(Boolean),
    imgcutCandidates: [imgcutPath, fallbackStage.imgcutPath].filter(Boolean),
    csvPath: fallbackStage.csvPath || './public/assets/bcu/000001/org/battle/bg/bg.csv',
    stageId: fallbackStage.id || 0,
    cropName: fallbackStage.cropName || '背景bg',
    candidateReport: { bg3, bg2, imagePath, imgcutPath }
  };
}

function parseImgcut(text) {
  const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  const count = Number(lines[3] || 0);
  const parts = [];
  for (let i = 0; i < count; i += 1) {
    const cols = (lines[4 + i] || '').split(',');
    parts.push({ x: Number(cols[0] || 0), y: Number(cols[1] || 0), w: Number(cols[2] || 0), h: Number(cols[3] || 0), name: (cols[4] || '').trim() });
  }
  return { parts };
}

function parseRgb(cols, start) { return { r: Number(cols[start] || 0), g: Number(cols[start + 1] || 0), b: Number(cols[start + 2] || 0) }; }
function defaultBgRow(stageId = 0) { return { stageId, skyTop: { r: 0, g: 0, b: 0 }, skyBottom: { r: 0, g: 0, b: 0 }, groundTop: { r: 0, g: 0, b: 0 }, groundBottom: { r: 0, g: 0, b: 0 }, imgcutId: 0, showUpper: false }; }
function parseBgCsv(text, stageId) {
  if (typeof text !== 'string' || !text.trim()) return defaultBgRow(stageId);
  const rows = text.replace(/^\uFEFF/, '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  for (const row of rows) {
    const cols = row.split(',');
    if (Number(cols[0]) !== stageId) continue;
    return { stageId, skyTop: parseRgb(cols, 1), skyBottom: parseRgb(cols, 4), groundTop: parseRgb(cols, 7), groundBottom: parseRgb(cols, 10), imgcutId: Number(cols[13] || 0), showUpper: Number(cols[14] || 0) !== 0 };
  }
  return defaultBgRow(stageId);
}

export class StageBackgroundLoader {
  constructor(log) { this.log = log || (() => {}); }

  async load(stage) {
    const fallbackStage = stage || {};
    const bgResolved = resolveStageBackgroundAssetCandidates(stage?.bgId, fallbackStage);
    let image = null;
    let imagePath = null;
    for (const candidate of bgResolved.imageCandidates) {
      try { image = await loadImage(candidate); imagePath = candidate; break; } catch {}
    }
    let imgcutText = null;
    let imgcutPath = null;
    for (const candidate of bgResolved.imgcutCandidates) {
      imgcutText = await fetchTextSafe(candidate);
      if (imgcutText) { imgcutPath = candidate; break; }
    }

    if (!image || !imgcutText) {
      const fallbackImagePath = fallbackStage.imagePath || bgResolved.imagePath;
      const fallbackImgcutPath = fallbackStage.imgcutPath || bgResolved.imgcutPath;
      image = await loadImage(fallbackImagePath);
      imgcutText = await fetchText(fallbackImgcutPath);
      imagePath = fallbackImagePath;
      imgcutPath = fallbackImgcutPath;
      bgResolved.usedFallback = true;
      bgResolved.fallbackReason = bgResolved.fallbackReason || 'bgid-asset-load-failed-fallback-stage-path';
    }

    const csvPath = stage?.csvPath || bgResolved.csvPath;
    const csvText = await fetchTextSafe(csvPath);
    const bgRow = parseBgCsv(csvText, stage?.id || 0);
    const { parts } = parseImgcut(imgcutText);
    const part = parts.find((p) => p.name === stage?.cropName) || parts.find((p) => p.name === bgResolved.cropName) || parts[bgRow.imgcutId] || parts[0];
    const upperPart = bgRow.showUpper ? parts.find((p) => p.name === '背景上部') : null;
    return {
      image,
      crop: { x: part.x, y: part.y, w: part.w, h: part.h, name: part.name || stage?.cropName, cropRole: 'BCU Background.BG part' },
      upperCrop: upperPart ? { x: upperPart.x, y: upperPart.y, w: upperPart.w, h: upperPart.h, name: upperPart.name, upperCropRole: 'BCU Background.TOP part if present' } : null,
      colors: { skyTop: bgRow.skyTop, skyBottom: bgRow.skyBottom, groundTop: bgRow.groundTop, groundBottom: bgRow.groundBottom },
      source: { requestedBgId: bgResolved.requestedBgId, resolvedBgId: bgResolved.resolvedBgId, bgUsedFallback: !!bgResolved.usedFallback, bgFallbackReason: bgResolved.fallbackReason || null, imagePath, imgcutPath, csvPath, stageId: stage?.id || 0, imgcutId: bgRow.imgcutId, showUpper: bgRow.showUpper, backgroundCsvKind: 'bcu-bg-csv', candidateReport: bgResolved.candidateReport }
    };
  }
}
